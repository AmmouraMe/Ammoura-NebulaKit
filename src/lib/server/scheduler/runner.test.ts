import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pruneRunHistory, runJob, runJobs, RUN_HISTORY_DAYS } from './runner';
import type { JobDetail, ScheduledJob } from './types';
import * as records from '$lib/server/db/scheduled-jobs';

vi.mock('$lib/server/db/scheduled-jobs', () => ({
  claimScheduledJob: vi.fn(),
  completeScheduledJob: vi.fn(),
  startJobRun: vi.fn(),
  finishJobRun: vi.fn(),
  pruneJobRuns: vi.fn()
}));

const db = {} as D1Database;
const env = { DB: db } as unknown as App.Platform['env'];

function makeJob(overrides: Partial<ScheduledJob> = {}): ScheduledJob {
  return {
    name: 'test-job',
    description: 'A job used by tests',
    cron: '*/10 * * * *',
    timeoutMs: 1_000,
    lockMs: 60_000,
    run: async (): Promise<JobDetail> => ({ did: 'work' }),
    ...overrides
  };
}

/** A clock the test drives, so durations are asserted rather than observed. */
function fakeClock(...readings: number[]): () => number {
  const queue = [...readings];
  let last = 0;
  return () => {
    last = queue.length > 0 ? (queue.shift() as number) : last;
    return last;
  };
}

beforeEach(() => {
  vi.mocked(records.claimScheduledJob).mockResolvedValue(true);
  vi.mocked(records.completeScheduledJob).mockResolvedValue(true);
  vi.mocked(records.startJobRun).mockResolvedValue('run-1');
  vi.mocked(records.finishJobRun).mockResolvedValue(undefined);
  vi.mocked(records.pruneJobRuns).mockResolvedValue(0);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('runJob', () => {
  it('runs the handler and records the outcome it returned', async () => {
    const summary = await runJob(db, env, makeJob(), {
      trigger: 'cron',
      cron: '*/10 * * * *',
      now: 1_000,
      monotonicNow: fakeClock(0, 250)
    });

    expect(summary).toMatchObject({
      job: 'test-job',
      outcome: 'succeeded',
      durationMs: 250,
      detail: { did: 'work' }
    });
    expect(records.completeScheduledJob).toHaveBeenCalledWith(
      db,
      'test-job',
      expect.any(String),
      'succeeded',
      expect.objectContaining({ durationMs: 250, detail: '{"did":"work"}' })
    );
  });

  it('gives the handler the run time and a signal', async () => {
    const run = vi.fn(async () => ({}));

    await runJob(db, env, makeJob({ run }), { trigger: 'manual', now: 4_242 });

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ db, env, now: 4_242, signal: expect.any(AbortSignal) })
    );
  });

  it('locks for longer than the timeout, converted to whole seconds', async () => {
    await runJob(db, env, makeJob({ lockMs: 90_000 }), { trigger: 'cron', now: 1_000 });

    expect(records.claimScheduledJob).toHaveBeenCalledWith(
      db,
      'test-job',
      expect.any(String),
      1_090,
      1_000
    );
  });

  it('does nothing when the job is already locked', async () => {
    vi.mocked(records.claimScheduledJob).mockResolvedValue(false);
    const run = vi.fn(async () => ({}));

    const summary = await runJob(db, env, makeJob({ run }), { trigger: 'cron', now: 1_000 });

    expect(summary.outcome).toBe('skipped');
    expect(run).not.toHaveBeenCalled();
    expect(records.startJobRun).not.toHaveBeenCalled();
    // Nothing was claimed, so nothing may be released.
    expect(records.completeScheduledJob).not.toHaveBeenCalled();
  });

  it('records a throwing handler as failed rather than throwing', async () => {
    const job = makeJob({
      run: async () => {
        throw new Error('provider unreachable');
      }
    });

    const summary = await runJob(db, env, job, { trigger: 'cron', now: 1_000 });

    expect(summary.outcome).toBe('failed');
    expect(summary.error).toBe('provider unreachable');
    expect(records.completeScheduledJob).toHaveBeenCalledWith(
      db,
      'test-job',
      expect.any(String),
      'failed',
      expect.objectContaining({ error: 'provider unreachable' })
    );
  });

  it('describes a non-Error throw rather than storing "[object Object]"', async () => {
    const job = makeJob({
      run: async () => {
        throw 'a bare string';
      }
    });

    const summary = await runJob(db, env, job, { trigger: 'cron', now: 1_000 });

    expect(summary.error).toBe('a bare string');
  });

  it('times out a handler that overruns, and releases the lock', async () => {
    vi.useFakeTimers();
    const job = makeJob({
      timeoutMs: 50,
      run: () => new Promise<JobDetail>(() => {})
    });

    const pending = runJob(db, env, job, { trigger: 'cron', now: 1_000 });
    await vi.advanceTimersByTimeAsync(60);
    const summary = await pending;

    expect(summary.outcome).toBe('timed_out');
    expect(records.completeScheduledJob).toHaveBeenCalledWith(
      db,
      'test-job',
      expect.any(String),
      'timed_out',
      expect.anything()
    );
    vi.useRealTimers();
  });

  it('aborts the signal when the timeout fires, so a handler can stop early', async () => {
    vi.useFakeTimers();
    let observed: AbortSignal | undefined;
    const job = makeJob({
      timeoutMs: 50,
      run: ({ signal }) => {
        observed = signal;
        return new Promise<JobDetail>(() => {});
      }
    });

    const pending = runJob(db, env, job, { trigger: 'cron', now: 1_000 });
    await vi.advanceTimersByTimeAsync(60);
    await pending;

    expect(observed?.aborted).toBe(true);
    vi.useRealTimers();
  });

  it('skips the run when the claim itself fails, without pretending it ran', async () => {
    vi.mocked(records.claimScheduledJob).mockRejectedValue(new Error('D1 unavailable'));
    const run = vi.fn(async () => ({}));

    const summary = await runJob(db, env, makeJob({ run }), { trigger: 'cron', now: 1_000 });

    expect(summary.outcome).toBe('skipped');
    expect(summary.error).toBe('D1 unavailable');
    expect(run).not.toHaveBeenCalled();
  });

  it('still does the work when the history row cannot be opened', async () => {
    vi.mocked(records.startJobRun).mockRejectedValue(new Error('insert failed'));
    const run = vi.fn(async () => ({ did: 'work' }));

    const summary = await runJob(db, env, makeJob({ run }), { trigger: 'cron', now: 1_000 });

    expect(run).toHaveBeenCalled();
    expect(summary.outcome).toBe('succeeded');
    expect(records.finishJobRun).not.toHaveBeenCalled();
  });

  it('does not throw when recording the outcome fails', async () => {
    vi.mocked(records.completeScheduledJob).mockRejectedValue(new Error('write failed'));
    vi.mocked(records.finishJobRun).mockRejectedValue(new Error('write failed'));

    const summary = await runJob(db, env, makeJob(), { trigger: 'cron', now: 1_000 });

    expect(summary.outcome).toBe('succeeded');
  });

  it('opens the run record with the trigger and cron that caused it', async () => {
    await runJob(db, env, makeJob(), {
      trigger: 'cron',
      cron: '*/10 * * * *',
      now: 1_000
    });

    expect(records.startJobRun).toHaveBeenCalledWith(db, 'test-job', 'cron', 1_000, '*/10 * * * *');
  });
});

describe('runJobs', () => {
  it('runs every job, and one failure does not stop the others', async () => {
    const good = vi.fn(async () => ({ ok: true }));
    const jobs = [
      makeJob({
        name: 'bad',
        run: async () => {
          throw new Error('nope');
        }
      }),
      makeJob({ name: 'good', run: good })
    ];

    const summaries = await runJobs(db, env, jobs, { trigger: 'cron', now: 1_000 });

    expect(summaries.map((s) => s.outcome)).toEqual(['failed', 'succeeded']);
    expect(good).toHaveBeenCalled();
  });

  it('returns nothing for an empty job list', async () => {
    await expect(runJobs(db, env, [], { trigger: 'cron', now: 1_000 })).resolves.toEqual([]);
  });
});

describe('pruneRunHistory', () => {
  it('prunes at the retention cutoff', async () => {
    vi.mocked(records.pruneJobRuns).mockResolvedValue(4);

    const pruned = await pruneRunHistory(db, 1_000_000);

    expect(pruned).toBe(4);
    expect(records.pruneJobRuns).toHaveBeenCalledWith(
      db,
      1_000_000 - RUN_HISTORY_DAYS * 24 * 60 * 60
    );
  });

  it('swallows a failed prune — housekeeping must not break a tick', async () => {
    vi.mocked(records.pruneJobRuns).mockRejectedValue(new Error('delete failed'));

    await expect(pruneRunHistory(db, 1_000_000)).resolves.toBe(0);
  });
});
