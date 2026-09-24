import { describe, it, expect } from 'vitest';
import {
  claimScheduledJob,
  completeScheduledJob,
  finishJobRun,
  getScheduledJob,
  listJobRuns,
  listScheduledJobs,
  pruneJobRuns,
  startJobRun
} from './scheduled-jobs';

interface RecordedCall {
  sql: string;
  params: unknown[];
}

/**
 * A D1 double that records every statement and returns queued results, so a
 * test can assert the SQL shape as well as the values bound to it.
 */
function createMockDb() {
  const calls: RecordedCall[] = [];
  const firstResults: unknown[] = [];
  const allResults: unknown[][] = [];
  const runResults: D1Result[] = [];

  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          const record: RecordedCall = { sql, params };
          return {
            async first() {
              calls.push(record);
              return firstResults.length > 0 ? firstResults.shift() : null;
            },
            async all() {
              calls.push(record);
              return { results: allResults.length > 0 ? allResults.shift() : [] };
            },
            async run() {
              calls.push(record);
              return runResults.length > 0
                ? runResults.shift()
                : ({ meta: { changes: 1 } } as unknown as D1Result);
            }
          };
        }
      };
    }
  };

  return {
    db: db as unknown as D1Database,
    calls,
    queueFirst: (value: unknown) => firstResults.push(value),
    queueAll: (value: unknown[]) => allResults.push(value),
    queueRun: (value: D1Result) => runResults.push(value)
  };
}

/** D1 reports how many rows a statement touched; 0 is how a rejected claim reads. */
function runResult(changes: number): D1Result {
  return { meta: { changes } } as unknown as D1Result;
}

describe('claimScheduledJob', () => {
  it('claims a job that has never run, inserting its row', async () => {
    const { db, calls } = createMockDb();

    const claimed = await claimScheduledJob(db, 'sweep', 'token-1', 1_200, 1_000);

    expect(claimed).toBe(true);
    expect(calls[0].sql).toContain('INSERT INTO scheduled_jobs');
    expect(calls[0].sql).toContain('ON CONFLICT(name) DO UPDATE');
    expect(calls[0].params).toEqual(['sweep', 1_200, 'token-1', 1_000, 1_000, 1_000, 1_000]);
  });

  it('refuses the claim when another run still holds the lock', async () => {
    const { db, queueRun } = createMockDb();
    queueRun(runResult(0));

    await expect(claimScheduledJob(db, 'sweep', 'token-2', 1_200, 1_000)).resolves.toBe(false);
  });

  it('only takes an existing row when its lock is free or expired', async () => {
    const { db, calls } = createMockDb();

    await claimScheduledJob(db, 'sweep', 'token-1', 1_200, 1_000);

    // Without this clause a second scheduler would overwrite a live lock and
    // both runs would proceed.
    expect(calls[0].sql).toContain(
      'WHERE scheduled_jobs.locked_until IS NULL OR scheduled_jobs.locked_until <= ?'
    );
  });

  it('treats a missing changes count as a failed claim', async () => {
    const { db, queueRun } = createMockDb();
    queueRun({ meta: {} } as unknown as D1Result);

    await expect(claimScheduledJob(db, 'sweep', 'token', 1_200, 1_000)).resolves.toBe(false);
  });
});

describe('completeScheduledJob', () => {
  it('releases the lock and records a success, resetting the failure count', async () => {
    const { db, calls } = createMockDb();

    const written = await completeScheduledJob(db, 'sweep', 'token-1', 'succeeded', {
      finishedAt: 1_050,
      durationMs: 412,
      detail: '{"considered":3}'
    });

    expect(written).toBe(true);
    expect(calls[0].sql).toContain('locked_until = NULL');
    expect(calls[0].sql).toContain('consecutive_failures = 0');
    expect(calls[0].params).toEqual([
      1_050,
      412,
      'succeeded',
      null,
      '{"considered":3}',
      1_050,
      'sweep',
      'token-1'
    ]);
  });

  it('increments the failure count on a failure', async () => {
    const { db, calls } = createMockDb();

    await completeScheduledJob(db, 'sweep', 'token-1', 'failed', {
      finishedAt: 1_050,
      durationMs: 9,
      error: 'boom'
    });

    expect(calls[0].sql).toContain('consecutive_failures = consecutive_failures + 1');
  });

  it('counts a timeout as a failure too', async () => {
    const { db, calls } = createMockDb();

    await completeScheduledJob(db, 'sweep', 'token-1', 'timed_out', {
      finishedAt: 1_050,
      durationMs: 25_000
    });

    expect(calls[0].sql).toContain('consecutive_failures = consecutive_failures + 1');
  });

  it('scopes the write to the lock token it holds', async () => {
    const { db, calls, queueRun } = createMockDb();
    queueRun(runResult(0));

    // A run whose lock expired and was taken by someone else must not
    // overwrite the newer run's record on its way out.
    const written = await completeScheduledJob(db, 'sweep', 'stale-token', 'succeeded', {
      finishedAt: 1_050,
      durationMs: 5
    });

    expect(written).toBe(false);
    expect(calls[0].sql).toContain('WHERE name = ? AND lock_token = ?');
  });
});

describe('run records', () => {
  it('opens a run before the handler starts', async () => {
    const { db, calls } = createMockDb();

    const runId = await startJobRun(db, 'sweep', 'cron', 1_000, '*/10 * * * *');

    expect(runId).toBeTruthy();
    expect(calls[0].sql).toContain('INSERT INTO scheduled_job_runs');
    expect(calls[0].params.slice(1)).toEqual(['sweep', 'cron', '*/10 * * * *', 1_000, 1_000]);
  });

  it('records a manual run with no cron expression', async () => {
    const { db, calls } = createMockDb();

    await startJobRun(db, 'sweep', 'manual', 1_000);

    expect(calls[0].params.slice(1)).toEqual(['sweep', 'manual', null, 1_000, 1_000]);
  });

  it('closes a run with its outcome', async () => {
    const { db, calls } = createMockDb();

    await finishJobRun(db, 'run-1', 'failed', {
      finishedAt: 1_030,
      durationMs: 30_000,
      error: 'boom'
    });

    expect(calls[0].sql).toContain('UPDATE scheduled_job_runs');
    expect(calls[0].params).toEqual([1_030, 30_000, 'failed', 'boom', null, 'run-1']);
  });
});

describe('reading jobs and runs', () => {
  it('lists job rows by name', async () => {
    const { db, queueAll, calls } = createMockDb();
    queueAll([{ name: 'sweep' }]);

    const jobs = await listScheduledJobs(db);

    expect(jobs).toHaveLength(1);
    expect(calls[0].sql).toContain('ORDER BY name');
  });

  it('returns an empty list rather than undefined when nothing has run', async () => {
    const { db } = createMockDb();

    await expect(listScheduledJobs(db)).resolves.toEqual([]);
    await expect(listJobRuns(db)).resolves.toEqual([]);
  });

  it('reads one job by name', async () => {
    const { db, queueFirst, calls } = createMockDb();
    queueFirst({ name: 'sweep' });

    const job = await getScheduledJob(db, 'sweep');

    expect(job?.name).toBe('sweep');
    expect(calls[0].params).toEqual(['sweep']);
  });

  it('filters runs by job when asked, newest first', async () => {
    const { db, calls } = createMockDb();

    await listJobRuns(db, { jobName: 'sweep', limit: 5 });

    expect(calls[0].sql).toContain('WHERE job_name = ?');
    expect(calls[0].sql).toContain('ORDER BY started_at DESC');
    expect(calls[0].params).toEqual(['sweep', 5]);
  });

  it('caps the limit, so one call cannot read the whole history', async () => {
    const { db, calls } = createMockDb();

    await listJobRuns(db, { limit: 100_000 });

    expect(calls[0].params).toEqual([200]);
  });

  it('floors a limit below one back up to one', async () => {
    const { db, calls } = createMockDb();

    await listJobRuns(db, { limit: 0 });

    expect(calls[0].params).toEqual([1]);
  });
});

describe('pruneJobRuns', () => {
  it('deletes runs older than the cutoff and reports how many', async () => {
    const { db, calls, queueRun } = createMockDb();
    queueRun(runResult(7));

    const deleted = await pruneJobRuns(db, 500);

    expect(deleted).toBe(7);
    expect(calls[0].sql).toContain('DELETE FROM scheduled_job_runs WHERE started_at < ?');
    expect(calls[0].params).toEqual([500]);
  });
});
