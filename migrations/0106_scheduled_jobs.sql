-- Scheduled jobs: the platform's own record of recurring work.
--
-- Until now the only recurring job was the fulfillment retry sweep, driven by
-- a GitHub Actions workflow curling an authenticated endpoint every ten
-- minutes. These two tables move that record into the platform: what ran, when,
-- for how long, and what happened.
--
-- Platform-level infrastructure, deliberately NOT tenant-scoped. A job sweeps
-- across every site; the rows it touches carry their own site_id and the
-- handler scopes each one. There is no site_id here because a job does not
-- belong to a site. Nothing tenant-facing reads these tables.
--
-- Rollback: DROP TABLE scheduled_job_runs; DROP TABLE scheduled_jobs;

-- One row per registered job. Also the lock: a run claims a job with a
-- conditional UPDATE against locked_until, and only the claimer proceeds.
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  name TEXT PRIMARY KEY,
  -- Held by the current run. Both are cleared when the run finishes, and a
  -- claim also succeeds once locked_until has passed, so a run that died
  -- mid-flight cannot lock a job out forever.
  locked_until INTEGER,
  lock_token TEXT,
  last_started_at INTEGER,
  last_finished_at INTEGER,
  last_duration_ms INTEGER,
  last_outcome TEXT CHECK (
    last_outcome IS NULL OR last_outcome IN ('succeeded', 'failed', 'timed_out')
  ),
  last_error TEXT,
  -- JSON summary the handler returned on its last successful run.
  last_detail TEXT,
  -- Reset to 0 by a success. A climbing number is the signal worth alerting on.
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- One row per run. Pruned by the runner, so this stays small without a
-- separate maintenance job.
CREATE TABLE IF NOT EXISTS scheduled_job_runs (
  id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL,
  -- 'cron' is the platform's own scheduler; 'manual' is an operator or a test
  -- driving the job by hand through the authenticated endpoint.
  trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'manual')),
  -- The cron expression that fired this run, when a schedule caused it.
  cron TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  duration_ms INTEGER,
  -- NULL while the run is in flight. 'skipped' means the job was already
  -- locked by another run, which is a normal outcome, not a failure.
  outcome TEXT CHECK (
    outcome IS NULL OR outcome IN ('succeeded', 'failed', 'timed_out', 'skipped')
  ),
  error TEXT,
  detail TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_scheduled_job_runs_job_started
  ON scheduled_job_runs (job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_job_runs_started
  ON scheduled_job_runs (started_at);
