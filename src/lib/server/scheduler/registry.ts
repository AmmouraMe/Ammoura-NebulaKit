/**
 * The job registry: every piece of recurring work the platform owns.
 *
 * Adding a job is one entry in this array. Its cron expression must also be
 * listed in `[triggers] crons` in `wrangler.toml` — `registry.test.ts` asserts
 * that, by reading the file, so a job cannot be registered on a schedule that
 * nothing fires.
 */

import { FULFILLMENT_RETRY_JOB } from './jobs/fulfillment-retry';
import type { ScheduledJob } from './types';

export const SCHEDULED_JOBS: readonly ScheduledJob[] = [FULFILLMENT_RETRY_JOB];

/** Every distinct cron expression the registry needs fired. */
export function registeredCrons(): string[] {
  return [...new Set(SCHEDULED_JOBS.map((job) => job.cron))].sort();
}

export function getScheduledJobByName(name: string): ScheduledJob | undefined {
  return SCHEDULED_JOBS.find((job) => job.name === name);
}

/** The jobs a given cron expression is responsible for. */
export function jobsForCron(cron: string): ScheduledJob[] {
  return SCHEDULED_JOBS.filter((job) => job.cron === cron);
}
