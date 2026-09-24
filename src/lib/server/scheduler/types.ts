/**
 * The shape of a scheduled job.
 *
 * A job is a plain async function plus the metadata the runner needs to
 * schedule it, lock it and record it. Adding one is a single entry in
 * `registry.ts` — no new workflow file, no new secret, no new deploy target.
 */

/** Everything a handler is given. Deliberately small. */
export interface JobContext {
  db: D1Database;
  /** Worker bindings and secrets, for jobs that need a provider key. */
  env: App.Platform['env'];
  /** Unix seconds at which the run started. Handlers take time from here, not
   * from `Date.now()`, so a run is testable at a fixed moment. */
  now: number;
  /** Aborted when the job exceeds its timeout. A handler doing many steps
   * should check it between them. */
  signal: AbortSignal;
}

/**
 * A JSON-serializable summary of what the run did. Stored on the run record,
 * so "the sweep considered 12 relays and dead-lettered 1" survives the run.
 */
export type JobDetail = Record<string, unknown>;

export interface ScheduledJob {
  /** Stable identifier. It is the primary key of the job row, so renaming a
   * job starts its history over — treat it as permanent. */
  name: string;
  /** One line, shown wherever jobs are listed. */
  description: string;
  /**
   * The Cloudflare cron expression this job runs on. It must also appear in
   * `[triggers] crons` in `wrangler.toml`, or nothing will fire it — the
   * registry test asserts exactly that, so the two cannot drift.
   */
  cron: string;
  /** Give up on the handler after this long. */
  timeoutMs: number;
  /**
   * How long the lock is held. Longer than `timeoutMs`, so a run that hangs
   * past its timeout cannot have a second run started underneath it, and short
   * enough that a run killed mid-flight frees the job within an acceptable
   * delay.
   */
  lockMs: number;
  run(context: JobContext): Promise<JobDetail>;
}
