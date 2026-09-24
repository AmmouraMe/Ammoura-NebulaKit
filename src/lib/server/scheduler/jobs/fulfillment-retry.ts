/**
 * The fulfillment retry sweep, as a scheduled job.
 *
 * This work is not new. It ran every ten minutes from a GitHub Actions
 * workflow that curled an authenticated endpoint, because the Worker had no
 * scheduled() handler of its own. The sweep itself is unchanged — only what
 * calls it is.
 */

import { sweepDueRelays, SWEEP_DEFAULT_LIMIT } from '$lib/server/fulfillment/sweep';
import type { JobContext, JobDetail, ScheduledJob } from '../types';

export const FULFILLMENT_RETRY_JOB: ScheduledJob = {
  name: 'fulfillment-retry',
  description: 'Retry paid orders that have not reached their fulfillment provider',
  // Matches the cadence the GitHub workflow used. The backoff is measured in
  // minutes to hours, so ten minutes is ample.
  cron: '*/10 * * * *',
  timeoutMs: 25_000,
  // Comfortably longer than the timeout: a sweep that hangs past 25s must not
  // have a second one started on top of it.
  lockMs: 120_000,

  async run({ db, env, now }: JobContext): Promise<JobDetail> {
    const encryptionKey = env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      // Provider credentials are encrypted at rest, so without the key there
      // is no way to reach any provider. Failing loudly beats a sweep that
      // silently considers nothing.
      throw new Error('ENCRYPTION_KEY is not configured');
    }

    const result = await sweepDueRelays(db, encryptionKey, { limit: SWEEP_DEFAULT_LIMIT, now });
    return { ...result };
  }
};
