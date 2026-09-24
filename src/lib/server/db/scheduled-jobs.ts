/**
 * Scheduled job records — the platform's own account of its recurring work.
 *
 * Two tables (migration 0106): `scheduled_jobs` holds one durable row per
 * registered job, carrying both the lock and the last-run summary;
 * `scheduled_job_runs` holds the history.
 *
 * Platform-level, not tenant data. A job sweeps across sites, so there is no
 * `site_id` here — see the migration for why.
 */

import { execute, executeOne, generateId, getCurrentTimestamp } from './connection';

export type JobOutcome = 'succeeded' | 'failed' | 'timed_out';

/** `skipped` is only ever a run outcome: the job was locked by another run. */
export type RunOutcome = JobOutcome | 'skipped';

export type JobTrigger = 'cron' | 'manual';

export interface ScheduledJobRecord {
  name: string;
  locked_until: number | null;
  lock_token: string | null;
  last_started_at: number | null;
  last_finished_at: number | null;
  last_duration_ms: number | null;
  last_outcome: JobOutcome | null;
  last_error: string | null;
  last_detail: string | null;
  consecutive_failures: number;
  created_at: number;
  updated_at: number;
}

export interface ScheduledJobRun {
  id: string;
  job_name: string;
  trigger: JobTrigger;
  cron: string | null;
  started_at: number;
  finished_at: number | null;
  duration_ms: number | null;
  outcome: RunOutcome | null;
  error: string | null;
  detail: string | null;
  created_at: number;
}

const JOB_COLUMNS = `name, locked_until, lock_token, last_started_at, last_finished_at,
  last_duration_ms, last_outcome, last_error, last_detail, consecutive_failures,
  created_at, updated_at`;

const RUN_COLUMNS = `id, job_name, trigger, cron, started_at, finished_at, duration_ms,
  outcome, error, detail, created_at`;

/**
 * Take the lock on a job, creating its row the first time it is ever run.
 *
 * This is the only thing standing between two schedulers and a double run, so
 * it has to be atomic. The INSERT and the UPDATE are one statement: the row is
 * inserted if absent, and on conflict it is updated **only** when the existing
 * lock is free or expired. D1 reports `meta.changes === 0` when the WHERE
 * clause rejects the update, and that is the caller's answer.
 *
 * An expired lock is claimable on purpose. A run that died mid-flight — an
 * isolate evicted, a deploy — must not lock a job out forever.
 *
 * @returns true when this caller now holds the lock.
 */
export async function claimScheduledJob(
  db: D1Database,
  name: string,
  lockToken: string,
  lockedUntil: number,
  now: number = getCurrentTimestamp()
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO scheduled_jobs (name, locked_until, lock_token, last_started_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         locked_until = excluded.locked_until,
         lock_token = excluded.lock_token,
         last_started_at = excluded.last_started_at,
         updated_at = excluded.updated_at
       WHERE scheduled_jobs.locked_until IS NULL OR scheduled_jobs.locked_until <= ?`
    )
    .bind(name, lockedUntil, lockToken, now, now, now, now)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Release the lock and write the outcome of the run that held it.
 *
 * Scoped by `lock_token`: a run whose lock already expired and was taken by
 * someone else must not overwrite the newer run's record on its way out.
 */
export async function completeScheduledJob(
  db: D1Database,
  name: string,
  lockToken: string,
  outcome: JobOutcome,
  fields: {
    finishedAt: number;
    durationMs: number;
    error?: string | null;
    detail?: string | null;
  }
): Promise<boolean> {
  const succeeded = outcome === 'succeeded';

  const result = await db
    .prepare(
      `UPDATE scheduled_jobs SET
         locked_until = NULL,
         lock_token = NULL,
         last_finished_at = ?,
         last_duration_ms = ?,
         last_outcome = ?,
         last_error = ?,
         last_detail = ?,
         consecutive_failures = ${succeeded ? '0' : 'consecutive_failures + 1'},
         updated_at = ?
       WHERE name = ? AND lock_token = ?`
    )
    .bind(
      fields.finishedAt,
      fields.durationMs,
      outcome,
      fields.error ?? null,
      fields.detail ?? null,
      fields.finishedAt,
      name,
      lockToken
    )
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/** Open a run record. Written before the handler starts, so a run that never
 * returns still leaves a trace with a NULL outcome. */
export async function startJobRun(
  db: D1Database,
  jobName: string,
  trigger: JobTrigger,
  startedAt: number,
  cron: string | null = null
): Promise<string> {
  const id = generateId();
  await execute(
    db,
    `INSERT INTO scheduled_job_runs (id, job_name, trigger, cron, started_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, jobName, trigger, cron, startedAt, startedAt]
  );
  return id;
}

/** Close a run record with what happened. */
export async function finishJobRun(
  db: D1Database,
  runId: string,
  outcome: RunOutcome,
  fields: {
    finishedAt: number;
    durationMs: number;
    error?: string | null;
    detail?: string | null;
  }
): Promise<void> {
  await execute(
    db,
    `UPDATE scheduled_job_runs SET finished_at = ?, duration_ms = ?, outcome = ?, error = ?, detail = ?
     WHERE id = ?`,
    [
      fields.finishedAt,
      fields.durationMs,
      outcome,
      fields.error ?? null,
      fields.detail ?? null,
      runId
    ]
  );
}

/** Every job row the platform has ever run. */
export async function listScheduledJobs(db: D1Database): Promise<ScheduledJobRecord[]> {
  const result = await execute<ScheduledJobRecord>(
    db,
    `SELECT ${JOB_COLUMNS} FROM scheduled_jobs ORDER BY name`
  );
  return result.results ?? [];
}

export async function getScheduledJob(
  db: D1Database,
  name: string
): Promise<ScheduledJobRecord | null> {
  return executeOne<ScheduledJobRecord>(
    db,
    `SELECT ${JOB_COLUMNS} FROM scheduled_jobs WHERE name = ?`,
    [name]
  );
}

/** Most recent runs, newest first — for one job, or across all of them. */
export async function listJobRuns(
  db: D1Database,
  options: { jobName?: string; limit?: number } = {}
): Promise<ScheduledJobRun[]> {
  const limit = Math.min(Math.max(Math.floor(options.limit ?? 20), 1), 200);

  const result = options.jobName
    ? await execute<ScheduledJobRun>(
        db,
        `SELECT ${RUN_COLUMNS} FROM scheduled_job_runs
         WHERE job_name = ? ORDER BY started_at DESC LIMIT ?`,
        [options.jobName, limit]
      )
    : await execute<ScheduledJobRun>(
        db,
        `SELECT ${RUN_COLUMNS} FROM scheduled_job_runs ORDER BY started_at DESC LIMIT ?`,
        [limit]
      );

  return result.results ?? [];
}

/**
 * Drop run history older than the cutoff.
 *
 * Called by the runner rather than by a job of its own: history that needs its
 * own scheduled job to stay small is a second thing that can fail.
 */
export async function pruneJobRuns(db: D1Database, olderThan: number): Promise<number> {
  const result = await db
    .prepare(`DELETE FROM scheduled_job_runs WHERE started_at < ?`)
    .bind(olderThan)
    .run();
  return result.meta?.changes ?? 0;
}
