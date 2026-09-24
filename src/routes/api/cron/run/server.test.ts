import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/db/connection', () => ({
  getDB: vi.fn(() => ({ tag: 'db' }))
}));

const mockRunJobs = vi.fn();
const mockPrune = vi.fn();
vi.mock('$lib/server/scheduler/runner', () => ({
  runJobs: (...args: unknown[]) => mockRunJobs(...args),
  pruneRunHistory: (...args: unknown[]) => mockPrune(...args)
}));

// Hoisted, because vi.mock factories are lifted above every other statement
// in the file and would otherwise reach these before they exist.
const { sweepJob, otherJob } = vi.hoisted(() => {
  const sweep = {
    name: 'fulfillment-retry',
    description: 'sweep',
    cron: '*/10 * * * *',
    timeoutMs: 1_000,
    lockMs: 60_000,
    run: async () => ({})
  };
  return { sweepJob: sweep, otherJob: { ...sweep, name: 'other', cron: '0 3 * * *' } };
});

vi.mock('$lib/server/scheduler/registry', () => ({
  SCHEDULED_JOBS: [sweepJob, otherJob],
  getScheduledJobByName: (name: string) => [sweepJob, otherJob].find((job) => job.name === name),
  jobsForCron: (cron: string) => [sweepJob, otherJob].filter((job) => job.cron === cron)
}));

import { POST } from './+server';
import type { RequestHandler } from './$types';
import { INTERNAL_SCHEDULER_TOKEN_HEADER } from '$lib/server/scheduler/internal-token';

type ExtractRequestEvent<T> = T extends (event: infer E) => unknown ? E : never;
type MockRequestEvent = ExtractRequestEvent<RequestHandler>;

function makeEvent(
  options: {
    headers?: Record<string, string>;
    env?: Record<string, unknown>;
    query?: string;
  } = {}
): MockRequestEvent {
  const env = options.env ?? { DB: {}, CRON_SECRET: 'operator-secret' };
  const headers = options.headers ?? {};

  const request = {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null
    }
  } as unknown as Request;

  return {
    request,
    platform: { env },
    url: new URL(`http://localhost/api/cron/run${options.query ?? ''}`)
  } as unknown as MockRequestEvent;
}

/**
 * SvelteKit's error() throws; this unwraps the status for an assertion.
 * Takes `unknown` because a RequestHandler is typed MaybePromise<Response>.
 */
async function statusOf(work: unknown): Promise<number> {
  try {
    await work;
  } catch (thrown) {
    return (thrown as { status: number }).status;
  }
  throw new Error('expected the handler to throw');
}

describe('POST /api/cron/run', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunJobs.mockResolvedValue([
      { job: 'fulfillment-retry', outcome: 'succeeded', durationMs: 12 }
    ]);
    mockPrune.mockResolvedValue(0);
  });

  describe('authorization', () => {
    it('accepts the internal token the scheduled() handler mints', async () => {
      const event = makeEvent({
        headers: { [INTERNAL_SCHEDULER_TOKEN_HEADER]: 'per-invocation' },
        env: { DB: {}, SCHEDULER_INTERNAL_TOKEN: 'per-invocation' },
        query: '?cron=*%2F10+*+*+*+*'
      });

      const response = await POST(event);

      expect(response.status).toBe(200);
    });

    it('runs the platform schedule even when no operator secret is configured', async () => {
      // The scheduler must not depend on CRON_SECRET having been set.
      const event = makeEvent({
        headers: { [INTERNAL_SCHEDULER_TOKEN_HEADER]: 'per-invocation' },
        env: { DB: {}, SCHEDULER_INTERNAL_TOKEN: 'per-invocation' }
      });

      await expect(POST(event)).resolves.toBeDefined();
    });

    it('rejects a wrong internal token', async () => {
      const event = makeEvent({
        headers: { [INTERNAL_SCHEDULER_TOKEN_HEADER]: 'guessed' },
        env: { DB: {}, SCHEDULER_INTERNAL_TOKEN: 'per-invocation', CRON_SECRET: 'secret' }
      });

      expect(await statusOf(POST(event))).toBe(401);
    });

    it('accepts the operator bearer token', async () => {
      const event = makeEvent({ headers: { authorization: 'Bearer operator-secret' } });

      expect((await POST(event)).status).toBe(200);
    });

    it('rejects a wrong bearer token', async () => {
      const event = makeEvent({ headers: { authorization: 'Bearer wrong' } });

      expect(await statusOf(POST(event))).toBe(401);
    });

    it('rejects a request with no credentials at all', async () => {
      expect(await statusOf(POST(makeEvent()))).toBe(401);
    });

    it('refuses rather than running openly when neither secret is set', async () => {
      const event = makeEvent({ env: { DB: {} } });

      expect(await statusOf(POST(event))).toBe(503);
    });

    it('does not let an empty internal token match an unset one', async () => {
      const event = makeEvent({
        headers: { [INTERNAL_SCHEDULER_TOKEN_HEADER]: '' },
        env: { DB: {}, SCHEDULER_INTERNAL_TOKEN: '', CRON_SECRET: 'secret' }
      });

      expect(await statusOf(POST(event))).toBe(401);
    });

    it('refuses when the database is not bound', async () => {
      const event = makeEvent({ env: { CRON_SECRET: 'operator-secret' } });

      expect(await statusOf(POST(event))).toBe(503);
    });
  });

  describe('job selection', () => {
    const authorized = { authorization: 'Bearer operator-secret' };

    it('runs every job on the given cron, as a cron-triggered run', async () => {
      await POST(makeEvent({ headers: authorized, query: '?cron=*%2F10+*+*+*+*' }));

      expect(mockRunJobs).toHaveBeenCalledWith(expect.anything(), expect.anything(), [sweepJob], {
        trigger: 'cron',
        cron: '*/10 * * * *'
      });
    });

    it('runs one named job, as a manual run', async () => {
      await POST(makeEvent({ headers: authorized, query: '?job=other' }));

      expect(mockRunJobs).toHaveBeenCalledWith(expect.anything(), expect.anything(), [otherJob], {
        trigger: 'manual',
        cron: null
      });
    });

    it('runs the whole registry when given neither', async () => {
      await POST(makeEvent({ headers: authorized }));

      expect(mockRunJobs).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        [sweepJob, otherJob],
        { trigger: 'manual', cron: null }
      );
    });

    it('404s on a job that is not registered', async () => {
      const event = makeEvent({ headers: authorized, query: '?job=no-such-job' });

      expect(await statusOf(POST(event))).toBe(404);
    });

    it('rejects being given both a cron and a job', async () => {
      const event = makeEvent({ headers: authorized, query: '?cron=*&job=other' });

      expect(await statusOf(POST(event))).toBe(400);
    });

    it('accepts a cron no job claims without running anything', async () => {
      // A trigger can outlive the last job that used it. Waking for nothing is
      // harmless; erroring would make a deploy look broken.
      const response = await POST(makeEvent({ headers: authorized, query: '?cron=0+0+31+2+*' }));

      expect(await response.json()).toEqual({ ok: true, cron: '0 0 31 2 *', ran: [] });
      expect(mockRunJobs).not.toHaveBeenCalled();
    });
  });

  it('reports what ran, and prunes history on the way out', async () => {
    mockPrune.mockResolvedValue(3);

    const response = await POST(
      makeEvent({ headers: { authorization: 'Bearer operator-secret' }, query: '?job=other' })
    );

    expect(await response.json()).toEqual({
      ok: true,
      cron: null,
      ran: [{ job: 'fulfillment-retry', outcome: 'succeeded', durationMs: 12 }],
      pruned: 3
    });
  });
});
