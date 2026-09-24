import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSweep = vi.fn();
vi.mock('$lib/server/fulfillment/sweep', () => ({
  sweepDueRelays: (...args: unknown[]) => mockSweep(...args),
  SWEEP_DEFAULT_LIMIT: 25
}));

import { FULFILLMENT_RETRY_JOB } from './fulfillment-retry';

const db = { tag: 'db' } as unknown as D1Database;

function context(env: Record<string, unknown>) {
  return {
    db,
    env: env as unknown as App.Platform['env'],
    now: 1_700_000_000,
    signal: new AbortController().signal
  };
}

describe('the fulfillment retry job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSweep.mockResolvedValue({
      considered: 2,
      succeeded: 1,
      retrying: 1,
      deadLettered: 0,
      skipped: 0
    });
  });

  it('sweeps due relays at the run time it was given', async () => {
    const detail = await FULFILLMENT_RETRY_JOB.run(context({ ENCRYPTION_KEY: 'key' }));

    expect(mockSweep).toHaveBeenCalledWith(db, 'key', { limit: 25, now: 1_700_000_000 });
    expect(detail).toEqual({
      considered: 2,
      succeeded: 1,
      retrying: 1,
      deadLettered: 0,
      skipped: 0
    });
  });

  it('fails loudly without the encryption key rather than sweeping nothing', async () => {
    // Provider credentials are encrypted at rest. Without the key no provider
    // is reachable, and a run that quietly considered nothing would look fine.
    await expect(FULFILLMENT_RETRY_JOB.run(context({}))).rejects.toThrow('ENCRYPTION_KEY');
    expect(mockSweep).not.toHaveBeenCalled();
  });

  it('keeps the cadence the GitHub workflow used', () => {
    expect(FULFILLMENT_RETRY_JOB.cron).toBe('*/10 * * * *');
  });
});
