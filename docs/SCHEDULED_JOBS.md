# Scheduled jobs

Recurring work the platform owns: what runs, when, and what happened. Adding a
job is one entry in a registry.

## Why this exists

`@sveltejs/adapter-cloudflare` emits a **fetch-only** `_worker.js`. It has a
`fetch` export and nothing else, so a Cloudflare Cron Trigger had no
`scheduled()` handler to call and a Queue consumer had nowhere to attach.

The platform worked around it once: the fulfillment retry sweep became an
authenticated endpoint, and a GitHub Actions workflow curled it every ten
minutes. That was acceptable for a backoff measured in hours, and it does not
generalise. It puts production timing on a CI provider's best-effort scheduler,
it needs a secret in a third-party account, and each new job means another
workflow file. See issue #114.

## How it works

```
Cron Trigger  →  worker/entry.js scheduled()  →  POST /api/cron/run  →  runner  →  job
```

**`worker/entry.js`** wraps the adapter's output. `fetch` passes through
untouched; `scheduled()` is added.

It is **not** `main` in `wrangler.toml`, and this is the part worth knowing
before changing anything here. `adapter-cloudflare` v7 _writes to_ whatever
`main` names, so pointing `main` at a hand-written file overwrites that file on
the next build — silently, leaving a deploy with no `scheduled()` export and no
error anywhere. So `main` stays the adapter's own path and the swap happens
after the build:

```
npm run build
  → vite build                   # adapter writes .svelte-kit/cloudflare/_worker.js
  → node scripts/wrap-worker.js  # _worker.js → _app-worker.js
                                 # worker/entry.js → _worker.js
                                 # and _app-worker.js added to .assetsignore
```

`worker/entry.js` therefore imports `../.svelte-kit/cloudflare/_app-worker.js`,
which the script rewrites to `./_app-worker.js` as it copies. The file does not
resolve from its own location and is not meant to. If that import is ever
renamed, `wrap-worker.js` fails the build rather than writing a broken entry.

The `.assetsignore` line matters: without it the moved `_app-worker.js` would be
served as a static asset — the entire server bundle, publicly.

The scheduled handler does **no work of its own**. It builds a request and
hands it to the app's own `fetch`, so jobs run inside SvelteKit with the same
bindings, the same `$lib` code and the same request lifecycle as any other
endpoint. The alternative — a second bundle of app code reachable from plain
JS — would mean two ways to run the same handler.

`worker/entry.js` is plain JavaScript on purpose. It is not part of the
SvelteKit build, so it is never type-checked or transformed. Keep it small and
dependency-free.

### Authentication

Two callers reach `POST /api/cron/run`:

| Caller                                 | Credential                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| The Worker's own `scheduled()` handler | A token minted per invocation, put on a copy of `env`, sent in `x-scheduler-internal-token`. It never leaves the isolate. |
| An operator, by hand                   | `Authorization: Bearer $CRON_SECRET`                                                                                      |

The platform's schedule does not depend on `CRON_SECRET` being set. That secret
is now only for forcing a job by hand, and if it is unset the endpoint refuses
every external request rather than running openly.

### Locking

Two ticks must not overlap. Claiming a job is a single conditional statement —
an `INSERT … ON CONFLICT DO UPDATE … WHERE locked_until IS NULL OR
locked_until <= ?` — and D1 reporting zero changed rows _is_ the answer that
someone else holds it. A run that loses the claim records `skipped` and does
nothing.

Locks expire. A run killed mid-flight — an isolate evicted, a deploy — must not
lock its job out forever, so `lockMs` is also the longest a dead run can block
one.

### Timeouts

A Worker cannot truly kill a running promise. `timeoutMs` guarantees that the
run is _recorded_ and the _lock released_ on time; the handler is also given an
`AbortSignal` so it can stop cooperatively. Long handlers should check
`signal.aborted` between steps.

Set `lockMs` comfortably longer than `timeoutMs`, or a hung run can have a
second one started underneath it. `registry.test.ts` asserts this.

## Adding a job

1. Write the handler in `src/lib/server/scheduler/jobs/<name>.ts`:

   ```ts
   export const PRUNE_CARTS_JOB: ScheduledJob = {
     name: 'prune-carts',
     description: 'Delete abandoned cart sessions older than 30 days',
     cron: '0 4 * * *',
     timeoutMs: 25_000,
     lockMs: 120_000,
     async run({ db, env, now, signal }) {
       const deleted = await pruneCarts(db, now);
       return { deleted };
     }
   };
   ```

2. Add it to `SCHEDULED_JOBS` in `src/lib/server/scheduler/registry.ts`.

3. Add its cron expression to `[triggers] crons` in `wrangler.toml`, if it is
   not already there. **`registry.test.ts` reads `wrangler.toml` and asserts
   both directions** — a job on a cron nothing fires, and a trigger no job
   claims, both fail the build. A job that silently never runs is the failure
   this is here to prevent.

Things worth knowing when writing one:

- **Return a JSON-serializable summary.** It is stored on the run record, so
  "considered 12, dead-lettered 1" survives the run and shows up in the status
  endpoint.
- **Throw to fail.** The runner catches it, records the message, and increments
  `consecutive_failures`. Do not swallow errors to look tidy — a job that fails
  quietly is worse than one that fails loudly.
- **Take time from `now`**, not `Date.now()`, so the job is testable at a fixed
  moment.
- **Jobs are platform-wide.** They sweep across sites; each row carries its own
  `site_id` and the handler scopes what it touches by it. A job is not a tenant.
- **Renaming a job starts its history over** — the name is the primary key of
  its row. Treat it as permanent.

## Running a job by hand

```bash
# One job
curl -X POST "https://<host>/api/cron/run?job=fulfillment-retry" \
  -H "Authorization: Bearer $CRON_SECRET"

# Everything on one schedule, exactly as the cron would
curl -X POST "https://<host>/api/cron/run?cron=*/10%20*%20*%20*%20*" \
  -H "Authorization: Bearer $CRON_SECRET"

# The whole registry
curl -X POST "https://<host>/api/cron/run" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Locally, put `CRON_SECRET` in `.dev.vars` and use
`http://localhost:4236`. Note that `vite dev` serves the SvelteKit app
directly — `worker/entry.js` is not in the loop, so **cron triggers do not fire
in `npm run dev`**. Drive jobs by hand there, or use `npm run preview`, which
runs the built worker under wrangler.

A manual run is recorded with `trigger = 'manual'`, so it is distinguishable
from the schedule in the history.

## Seeing what ran

```
GET /api/admin/scheduled-jobs           # every job, with its last run
GET /api/admin/scheduled-jobs?runs=1    # plus recent history
GET /api/admin/scheduled-jobs?runs=1&job=fulfillment-retry&limit=50
```

Platform engineers only — these are the platform's rows, not a site's.

`consecutiveFailures` is the field worth alerting on. One failed sweep is
noise; six in a row is an outage.

## Retention

Run history older than 30 days is pruned by the runner at the end of each
dispatch. Deliberately not a job of its own: history that needs a scheduled job
to stay small is a second thing that can fail.

## What is not here

**Exact-second scheduling.** Cron Triggers fire on a minute boundary and can
run late under load. Durable Object alarms are the answer when a job must act at
a precise moment, and nothing here forecloses adding them — `runJob` does not
care what called it.

Auctions (#113) looked like the case that needed them, and on inspection are
not: a late bid is refused by the _bid_ endpoint checking the clock, not by the
scheduler. The scheduler only has to settle a closed auction, and settling
within a minute is fine. Reach for alarms when a job's correctness actually
depends on the second, not merely because it sounds more precise.

## Files

| Path                                             | What it is                                                     |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `worker/entry.js`                                | The deployed entry; adds `scheduled()` to the adapter's output |
| `src/lib/server/scheduler/registry.ts`           | The list of jobs                                               |
| `src/lib/server/scheduler/types.ts`              | The job contract                                               |
| `src/lib/server/scheduler/runner.ts`             | Claim, run, time out, record, release                          |
| `src/lib/server/scheduler/jobs/`                 | The handlers                                                   |
| `src/lib/server/db/scheduled-jobs.ts`            | The two tables                                                 |
| `src/routes/api/cron/run/+server.ts`             | Dispatch                                                       |
| `src/routes/api/admin/scheduled-jobs/+server.ts` | Status                                                         |
| `migrations/0106_scheduled_jobs.sql`             | `scheduled_jobs`, `scheduled_job_runs`                         |
