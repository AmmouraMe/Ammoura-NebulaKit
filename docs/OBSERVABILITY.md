# Observability

Structured logging, error capture, redaction and health checks. Everything lives
in `src/lib/server/observability/`, wired up in `src/hooks.server.ts`.

## Why this is hand-rolled

Issue #75 asked for the reasoning to be written down, so:

The runtime is Cloudflare Workers, which rules out any Node-only agent. That
leaves Sentry's `@sentry/cloudflare`, or the native pairing of Workers Analytics
Engine with Logpush, or something small in-tree. This repository does the last.

- **It ships to the edge on every request.** A vendor SDK is bundle weight paid
  by every visitor of every tenant, forever. The whole module here is under 500
  lines and tree-shakes to what each route uses.
- **Redaction had to be ours anyway.** This platform stores shipping addresses
  and encrypted provider credentials. A vendor's default scrubbing is tuned for
  a generic app; the list in `scrub.ts` is tuned for this schema, and it is
  testable line by line.
- **Alerting has to reach David, and Discord already does.** The project has
  Discord delivery in place. A webhook needs no account, no seat, no DSN.
- **The seam is one function.** `postAlert` inside `report.ts` is the only place
  that talks to the outside. Pointing it at Sentry later is a change there and
  nowhere else — the capture, context and scrubbing above it do not move.

What this does **not** give you, and what a vendor would: uploaded source maps,
so a minified client stack trace still reads as minified; issue grouping and
history in a UI; and release-over-release regression tracking. If those become
worth an account, the seam is ready.

## A log line

One JSON object per line, so `wrangler tail` and Logpush can filter on fields:

```json
{
  "level": "info",
  "time": "2026-09-11T12:00:00.000Z",
  "msg": "request",
  "requestId": "3f9c…",
  "siteId": "site-1",
  "route": "/checkout",
  "method": "POST",
  "userRole": "anonymous",
  "release": "0.1.0",
  "environment": "production",
  "status": 200,
  "durationMs": 84
}
```

`level`, `time` and `msg` are always present. The rest is request context bound
in `hooks.server.ts` plus whatever the call site passed.

Use the logger on `locals`, which is already bound to the request:

```ts
export const POST: RequestHandler = async ({ locals }) => {
  locals.log.info('order placed', { orderId, itemCount });
};
```

`locals.log.child({ … })` returns a logger with extra context and leaves the
parent alone.

## Request ids

`hooks.server.ts` mints one id per request and returns it as the `x-request-id`
response header. Every line from that request carries it, and `handleError`
passes it to `+error.svelte`, so a visitor can quote an id that maps to the log.

An inbound `x-request-id` is honoured so a trace survives a hop, but it is
stripped to `[A-Za-z0-9_-]` and capped at 64 characters — it ends up inside JSON
log lines, and a caller does not get to write those.

## Redaction

`scrub()` runs over every log field and every error payload.

It redacts **on the key name first** — `password`, `secret`, `token`,
`authorization`, `cookie`, `session`, and the PII this platform actually holds:
`email`, `phone`, `address`, `postal`, `firstName`, `card`, and friends. A value
that looks harmless today holds a token tomorrow; a key called `client_secret`
never stops being one.

It then scans **values** for shapes that leak under an innocent key: an email
address inside a `message`, a `Bearer` token inside a `url`, a long opaque run
that is obviously a key. Card numbers are only redacted when they also pass
Luhn, so a 13-digit epoch-millis timestamp is not mistaken for a card and
timings survive.

Cycles resolve to `[circular]`, depth and array length are capped, and both the
scrub and the serialise sit inside a `try` — a logger that throws would take
down the request it was only meant to describe.

**Role, never identity.** Events carry `userRole`, so you know an admin hit the
bug without keeping who they were.

## Errors

`handleError` in `hooks.server.ts` catches anything that escapes a load
function, endpoint or render. SvelteKit does not call it for `error(404)` and
other thrown `HttpError`s — those are control flow, not defects.

Browser exceptions go through `src/hooks.client.ts`, which posts them to
`POST /api/observability/client-error`. That endpoint is public by necessity —
the visitor who hit the error is usually anonymous — so it is treated as
untrusted input: size-capped, shape-checked, scrubbed. The site id and role come
from `locals`, never the body, so nobody can attribute their noise to another
tenant.

Every error gets a **fingerprint**: name, digit-folded message, first stack
frame, route. `record 41 not found` and `record 42 not found` from the same line
are one error type; the same message from a different route is not.

## Alerting

Set `ERROR_WEBHOOK_URL` and every captured error also posts there. Without it,
errors are still structured log lines — the webhook is the part that reaches
someone who is not watching a log stream.

```bash
npx wrangler secret put ERROR_WEBHOOK_URL              # production
npx wrangler secret put ERROR_WEBHOOK_URL --env dev-staging
```

A Discord channel webhook works as-is; the body is `{"content": "…"}`.

Alerts are throttled to 5 per fingerprint per minute **per isolate**. Workers
isolates are short-lived and numerous, so this is not a global rate limit — it
is enough to stop one hot loop from emptying a webhook, which is the failure
mode that actually happens. Logging is never throttled.

## Health

`GET /health` reports whether the Worker can reach D1, R2 and KV. It returns
`200` when everything answers and `503` when anything does not, so an uptime
monitor can watch the status code without parsing the body.

```json
{
  "status": "ok",
  "release": "0.1.0",
  "environment": "production",
  "time": "2026-09-11T12:00:00.000Z",
  "checks": {
    "d1": { "status": "ok", "durationMs": 12 },
    "r2": { "status": "ok", "durationMs": 30 },
    "kv": { "status": "ok", "durationMs": 0, "skipped": true }
  }
}
```

Checks are read-only — a trivial `SELECT 1`, an R2 `head` of a key that need not
exist, a KV `get`. A health check that writes is a health check that can break
production. Each has a 3-second timeout.

`SITE_ROUTES` absent is reported as `skipped`, not failed: routing falls back to
direct D1 lookups, which is a supported configuration.

The endpoint is public and unauthenticated so a monitor can poll it, which is
why the body stays boring — statuses and timings, no binding names beyond the
three fixed keys, no configuration.

## Configuration

| Variable            | Where                   | Effect                                                                          |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| `LOG_LEVEL`         | `[vars]` or `.dev.vars` | `debug`\|`info`\|`warn`\|`error`. Default: `info` in production, `debug` in dev |
| `ERROR_WEBHOOK_URL` | Worker secret           | Captured errors are alerted here. Unset: log lines only                         |

## Still open

Tracked on #75; this module does not close them:

- **Source map upload on deploy.** Client stack traces are minified. This needs
  a service that stores maps.
- **Uptime monitoring.** `/health` exists; nothing polls it yet. Point an
  external monitor at `https://<host>/health` and alert on a non-200.
- **Spike detection.** Fingerprints make "new error type" and "this one is
  spiking" computable, but nothing computes them — the throttle is a rate limit,
  not an analysis.
