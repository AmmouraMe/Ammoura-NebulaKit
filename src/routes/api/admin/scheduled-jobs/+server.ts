/**
 * Scheduled job status
 * GET /api/admin/scheduled-jobs
 *
 * What the platform's recurring work has been doing: every registered job with
 * its schedule, its last run, how long that took, how it ended, and the error
 * if it failed. Optionally the recent run history (`?runs=1`), for one job
 * (`?job=<name>`) or across all of them.
 *
 * Platform-wide rather than tenant data — a job sweeps across sites — so this
 * is restricted to platform engineers rather than site admins.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/server/db/connection';
import { listJobRuns, listScheduledJobs } from '$lib/server/db/scheduled-jobs';
import { SCHEDULED_JOBS } from '$lib/server/scheduler/registry';

export const GET: RequestHandler = async ({ platform, locals, url }) => {
  if (!locals.currentUser) {
    return json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  // Not `canPerformAction`: these rows are the platform's, not any site's, and
  // a site admin has no business reading another tenant's job outcomes.
  if (locals.currentUser.role !== 'platform_engineer') {
    return json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  const db = getDB(platform);
  const records = await listScheduledJobs(db);
  const byName = new Map(records.map((record) => [record.name, record]));

  // Driven by the registry, not by the table: a job that has never run must
  // still be listed, and a row left behind by a deleted job must not be.
  const jobs = SCHEDULED_JOBS.map((job) => {
    const record = byName.get(job.name);
    return {
      name: job.name,
      description: job.description,
      cron: job.cron,
      timeoutMs: job.timeoutMs,
      running: Boolean(record?.locked_until),
      lastStartedAt: record?.last_started_at ?? null,
      lastFinishedAt: record?.last_finished_at ?? null,
      lastDurationMs: record?.last_duration_ms ?? null,
      lastOutcome: record?.last_outcome ?? null,
      lastError: record?.last_error ?? null,
      lastDetail: record?.last_detail ?? null,
      consecutiveFailures: record?.consecutive_failures ?? 0
    };
  });

  if (url.searchParams.get('runs') !== '1') {
    return json({ success: true, jobs });
  }

  const jobName = url.searchParams.get('job') ?? undefined;
  const requestedLimit = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 20;

  const runs = await listJobRuns(db, { jobName, limit });

  return json({ success: true, jobs, runs });
};
