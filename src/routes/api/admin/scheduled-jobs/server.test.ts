import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/db/connection', () => ({
  getDB: vi.fn(() => ({ tag: 'db' }))
}));

const mockListJobs = vi.fn();
const mockListRuns = vi.fn();
vi.mock('$lib/server/db/scheduled-jobs', () => ({
  listScheduledJobs: (...args: unknown[]) => mockListJobs(...args),
  listJobRuns: (...args: unknown[]) => mockListRuns(...args)
}));

const { sweepJob } = vi.hoisted(() => ({
  sweepJob: {
    name: 'fulfillment-retry',
    description: 'Retry paid orders',
    cron: '*/10 * * * *',
    timeoutMs: 25_000,
    lockMs: 120_000,
    run: async () => ({})
  }
}));

vi.mock('$lib/server/scheduler/registry', () => ({
  SCHEDULED_JOBS: [sweepJob]
}));

import { GET } from './+server';
import type { RequestHandler } from './$types';

type ExtractRequestEvent<T> = T extends (event: infer E) => unknown ? E : never;
type MockRequestEvent = ExtractRequestEvent<RequestHandler>;

function makeEvent(options: { role?: string | null; query?: string } = {}): MockRequestEvent {
  const currentUser = options.role === null ? undefined : { id: 'u1', role: options.role };

  return {
    platform: { env: { DB: {} } },
    locals: { currentUser },
    url: new URL(`http://localhost/api/admin/scheduled-jobs${options.query ?? ''}`)
  } as unknown as MockRequestEvent;
}

describe('GET /api/admin/scheduled-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListJobs.mockResolvedValue([]);
    mockListRuns.mockResolvedValue([]);
  });

  it('requires a signed-in user', async () => {
    const response = await GET(makeEvent({ role: null }));

    expect(response.status).toBe(401);
  });

  it('refuses a site admin — these rows belong to the platform, not a site', async () => {
    const response = await GET(makeEvent({ role: 'admin' }));

    expect(response.status).toBe(403);
  });

  it('lists a job that has never run, with nulls rather than omitting it', async () => {
    const response = await GET(makeEvent({ role: 'platform_engineer' }));

    expect(await response.json()).toEqual({
      success: true,
      jobs: [
        {
          name: 'fulfillment-retry',
          description: 'Retry paid orders',
          cron: '*/10 * * * *',
          timeoutMs: 25_000,
          running: false,
          lastStartedAt: null,
          lastFinishedAt: null,
          lastDurationMs: null,
          lastOutcome: null,
          lastError: null,
          lastDetail: null,
          consecutiveFailures: 0
        }
      ]
    });
  });

  it('reports the last run when there is one', async () => {
    mockListJobs.mockResolvedValue([
      {
        name: 'fulfillment-retry',
        locked_until: null,
        last_started_at: 1_700_000_000,
        last_finished_at: 1_700_000_012,
        last_duration_ms: 12_000,
        last_outcome: 'failed',
        last_error: 'provider unreachable',
        last_detail: null,
        consecutive_failures: 3
      }
    ]);

    const body = (await (await GET(makeEvent({ role: 'platform_engineer' }))).json()) as {
      jobs: Array<Record<string, unknown>>;
    };

    expect(body.jobs[0]).toMatchObject({
      lastOutcome: 'failed',
      lastError: 'provider unreachable',
      lastDurationMs: 12_000,
      consecutiveFailures: 3,
      running: false
    });
  });

  it('marks a job as running while its lock is held', async () => {
    mockListJobs.mockResolvedValue([
      { name: 'fulfillment-retry', locked_until: 1_700_000_100, consecutive_failures: 0 }
    ]);

    const body = (await (await GET(makeEvent({ role: 'platform_engineer' }))).json()) as {
      jobs: Array<Record<string, unknown>>;
    };

    expect(body.jobs[0].running).toBe(true);
  });

  it('ignores a row left behind by a job that is no longer registered', async () => {
    mockListJobs.mockResolvedValue([
      { name: 'deleted-job', locked_until: null, consecutive_failures: 9 }
    ]);

    const body = (await (await GET(makeEvent({ role: 'platform_engineer' }))).json()) as {
      jobs: Array<{ name: string }>;
    };

    expect(body.jobs.map((job) => job.name)).toEqual(['fulfillment-retry']);
  });

  it('leaves run history out unless it is asked for', async () => {
    await GET(makeEvent({ role: 'platform_engineer' }));

    expect(mockListRuns).not.toHaveBeenCalled();
  });

  it('returns run history for one job when asked', async () => {
    mockListRuns.mockResolvedValue([{ id: 'run-1' }]);

    const response = await GET(
      makeEvent({ role: 'platform_engineer', query: '?runs=1&job=fulfillment-retry&limit=5' })
    );

    expect(mockListRuns).toHaveBeenCalledWith(expect.anything(), {
      jobName: 'fulfillment-retry',
      limit: 5
    });
    expect(await response.json()).toMatchObject({ runs: [{ id: 'run-1' }] });
  });

  it('falls back to a default limit when the one given is not a number', async () => {
    await GET(makeEvent({ role: 'platform_engineer', query: '?runs=1&limit=lots' }));

    expect(mockListRuns).toHaveBeenCalledWith(expect.anything(), {
      jobName: undefined,
      limit: 20
    });
  });
});
