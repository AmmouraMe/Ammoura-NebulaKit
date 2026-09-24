/**
 * Running a job: claim it, record it, time it out, release it.
 *
 * `runJob` never throws. Its callers are a cron handler and an operator
 * endpoint, and neither has anywhere useful to report an exception to — the
 * record in the database is the report.
 */

import {
  claimScheduledJob,
  completeScheduledJob,
  finishJobRun,
  pruneJobRuns,
  startJobRun,
  type JobOutcome,
  type JobTrigger,
  type RunOutcome
} from '$lib/server/db/scheduled-jobs';
import { getCurrentTimestamp } from '$lib/server/db/connection';
import type { JobDetail, ScheduledJob } from './types';

/** Run history older than this is dropped. Long enough to debug a bad week. */
export const RUN_HISTORY_DAYS = 30;

export interface RunJobOptions {
  trigger: JobTrigger;
  cron?: string | null;
  /** Unix seconds. Injected by tests; defaults to the wall clock. */
  now?: number;
  /** Wall-clock milliseconds, for the duration. Injected by tests. */
  monotonicNow?: () => number;
}

export interface JobRunSummary {
  job: string;
  outcome: RunOutcome;
  durationMs: number;
  detail?: JobDetail;
  error?: string;
}

/** Thrown into the run record when the handler outlives its timeout. */
class JobTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Job exceeded its ${timeoutMs}ms timeout`);
    this.name = 'JobTimeoutError';
  }
}

/**
 * Race a handler against its timeout.
 *
 * A Worker cannot truly kill a running promise, so the abort signal is how a
 * handler cooperates. What this does guarantee is that the run is recorded and
 * the lock is released on time, rather than waiting on something that has hung.
 */
async function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new JobTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/** Errors reach the database as text, and unknown throws are not always Errors. */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Run one job, if it is not already running.
 *
 * The claim is what makes this safe to call twice at once: the second caller
 * loses the conditional update and returns `skipped` without doing the work.
 */
export async function runJob(
  db: D1Database,
  env: App.Platform['env'],
  job: ScheduledJob,
  options: RunJobOptions
): Promise<JobRunSummary> {
  const now = options.now ?? getCurrentTimestamp();
  const clock = options.monotonicNow ?? (() => Date.now());
  const lockToken = crypto.randomUUID();
  const lockedUntil = now + Math.ceil(job.lockMs / 1000);

  let claimed = false;
  try {
    claimed = await claimScheduledJob(db, job.name, lockToken, lockedUntil, now);
  } catch (error) {
    // A failure to claim is not a failure of the job, and there is no lock to
    // release. Report it and leave the job for the next tick.
    console.error(`Could not claim job "${job.name}":`, error);
    return { job: job.name, outcome: 'skipped', durationMs: 0, error: describeError(error) };
  }

  if (!claimed) {
    return { job: job.name, outcome: 'skipped', durationMs: 0 };
  }

  const startedAtMs = clock();
  let runId: string | null = null;
  try {
    runId = await startJobRun(db, job.name, options.trigger, now, options.cron ?? null);
  } catch (error) {
    // Losing the history row is survivable; refusing to do the work is not.
    console.error(`Could not open a run record for job "${job.name}":`, error);
  }

  let outcome: JobOutcome = 'succeeded';
  let detail: JobDetail | undefined;
  let error: string | undefined;

  try {
    detail = await withTimeout((signal) => job.run({ db, env, now, signal }), job.timeoutMs);
  } catch (thrown) {
    outcome = thrown instanceof JobTimeoutError ? 'timed_out' : 'failed';
    error = describeError(thrown);
    console.error(`Job "${job.name}" ${outcome}:`, thrown);
  }

  const durationMs = Math.max(0, clock() - startedAtMs);
  const finishedAt = now + Math.round(durationMs / 1000);
  const detailJson = detail ? JSON.stringify(detail) : null;

  // Recording the outcome must not itself throw out of runJob. If the write
  // fails the lock still expires on its own, which is exactly what the
  // expiry is for.
  try {
    await completeScheduledJob(db, job.name, lockToken, outcome, {
      finishedAt,
      durationMs,
      error: error ?? null,
      detail: detailJson
    });
  } catch (writeError) {
    console.error(`Could not record the outcome of job "${job.name}":`, writeError);
  }

  if (runId) {
    try {
      await finishJobRun(db, runId, outcome, {
        finishedAt,
        durationMs,
        error: error ?? null,
        detail: detailJson
      });
    } catch (writeError) {
      console.error(`Could not close the run record for job "${job.name}":`, writeError);
    }
  }

  return { job: job.name, outcome, durationMs, detail, error };
}

/**
 * Run several jobs together.
 *
 * In parallel, and each isolated: `runJob` never throws, so one job failing
 * cannot stop the others from running or from being recorded.
 */
export async function runJobs(
  db: D1Database,
  env: App.Platform['env'],
  jobs: readonly ScheduledJob[],
  options: RunJobOptions
): Promise<JobRunSummary[]> {
  return Promise.all(jobs.map((job) => runJob(db, env, job, options)));
}

/**
 * Drop run history that is past the retention window.
 *
 * Best-effort, and never allowed to fail a tick: history growing is a smaller
 * problem than a scheduler that stops because a DELETE failed.
 */
export async function pruneRunHistory(
  db: D1Database,
  now: number = getCurrentTimestamp()
): Promise<number> {
  try {
    return await pruneJobRuns(db, now - RUN_HISTORY_DAYS * 24 * 60 * 60);
  } catch (error) {
    console.error('Could not prune scheduled job run history:', error);
    return 0;
  }
}
