/**
 * Scheduled job dispatch
 * POST /api/cron/run
 *
 * The single entry point for running registered jobs. Two callers:
 *
 *  - the Worker's own `scheduled()` handler (`worker/entry.js`), which calls
 *    this in-process on a Cron Trigger and authenticates with a random token
 *    minted for that invocation and never sent anywhere;
 *  - an operator or a test, over HTTP with `Authorization: Bearer $CRON_SECRET`.
 *
 * The production schedule is the first one. The second exists so a job can be
 * run by hand without waiting for its cron.
 *
 * Selects work with `?cron=<expression>` (every job on that schedule) or
 * `?job=<name>` (one job). See docs/SCHEDULED_JOBS.md.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/server/db/connection';
import { getScheduledJobByName, jobsForCron, SCHEDULED_JOBS } from '$lib/server/scheduler/registry';
import { pruneRunHistory, runJobs } from '$lib/server/scheduler/runner';
import { INTERNAL_SCHEDULER_TOKEN_HEADER } from '$lib/server/scheduler/internal-token';
import { timingSafeEqual } from '$lib/server/timing-safe';

/**
 * Authorize the caller, or throw.
 *
 * The internal path is checked first and does not depend on CRON_SECRET being
 * set: the platform's own scheduler must keep working whether or not an
 * operator secret has been configured.
 */
function authorize(request: Request, env: App.Platform['env']): void {
  const internalToken = env.SCHEDULER_INTERNAL_TOKEN;
  const providedInternal = request.headers.get(INTERNAL_SCHEDULER_TOKEN_HEADER) ?? '';
  if (
    typeof internalToken === 'string' &&
    internalToken.length > 0 &&
    providedInternal.length > 0 &&
    timingSafeEqual(providedInternal, internalToken)
  ) {
    return;
  }

  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    // Refusing is the safe failure: an unauthenticated dispatch endpoint would
    // let anyone drive every site's recurring work.
    throw error(503, 'CRON_SECRET is not configured');
  }

  const authorization = request.headers.get('authorization') ?? '';
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!provided || !timingSafeEqual(provided, cronSecret)) {
    throw error(401, 'Unauthorized');
  }
}

export const POST: RequestHandler = async ({ request, platform, url }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  authorize(request, platform.env);

  const cron = url.searchParams.get('cron');
  const jobName = url.searchParams.get('job');

  if (cron && jobName) {
    throw error(400, 'Give either cron or job, not both');
  }

  let jobs;
  if (jobName) {
    const job = getScheduledJobByName(jobName);
    if (!job) {
      throw error(404, `No registered job named "${jobName}"`);
    }
    jobs = [job];
  } else if (cron) {
    jobs = jobsForCron(cron);
    if (jobs.length === 0) {
      // Not an error. A cron expression can outlive the last job that used it,
      // and a trigger firing into an empty registry is harmless.
      return json({ ok: true, cron, ran: [] });
    }
  } else {
    jobs = [...SCHEDULED_JOBS];
  }

  const trigger = cron ? 'cron' : 'manual';
  const ran = await runJobs(getDB(platform), platform.env, jobs, { trigger, cron });

  // Cheap, and it keeps history bounded without a second job that can fail.
  const pruned = await pruneRunHistory(getDB(platform));

  return json({ ok: true, cron, ran, pruned });
};
