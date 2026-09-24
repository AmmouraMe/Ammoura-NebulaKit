# Fulfillment Relay: Retry and Dead Letter

A paid order whose hand-off to the print provider fails is money taken with
nothing shipped. This document describes the machinery that makes that hand-off
durable: where the record lives, when a failure is retried, when it stops being
retried, and what an operator does about it.

Implements [#73](https://github.com/AmmouraMe/Ammoura-Svelte/issues/73).

## The path an order takes

1. Stripe calls `/api/webhooks/stripe`. The order is marked paid.
2. `relayPaidOrderToPrintful` collects the order lines whose variant is mapped
   to a Printful sync variant. An order with none is not Printful's to make,
   and nothing further happens.
3. A row is written to `fulfillment_relays` for that (site, order, provider)
   **before** the provider is called. The relay outlives the request.
4. One attempt is made. The outcome is written back to the row and to
   `activity_logs`.
5. A transient failure is scheduled for another attempt. A permanent failure,
   or a transient one that has used up its attempts, is dead-lettered and the
   store's admins are notified.

## Transient or permanent

The distinction is the whole design. It lives in
`src/lib/server/integrations/printful/errors.ts`.

| Failure                                                  | Kind      | What happens          |
| -------------------------------------------------------- | --------- | --------------------- |
| Network error, timeout, no response at all               | transient | retried with backoff  |
| HTTP 408, 409, 423, 425, 429, or any 5xx                 | transient | retried with backoff  |
| HTTP 400, 401, 403, 404, 422 — Printful read and said no | permanent | dead-lettered at once |
| No Printful provider connected for the site              | permanent | dead-lettered at once |
| Shipping country with no ISO code we can send            | permanent | dead-lettered at once |
| Anything unrecognised                                    | transient | retried with backoff  |

Unrecognised failures are transient on purpose. Retrying something hopeless
costs a few requests. Giving up on something recoverable costs a customer the
goods they paid for.

## Backoff

Defined in `src/lib/server/fulfillment/relay-runner.ts`.

- 8 attempts, the first one included.
- The delay starts at 2 minutes and doubles: 2, 4, 8, 16, 32, 64, 128 minutes.
- The delay is capped at 6 hours.
- Each delay carries ±20% of random jitter. Orders paid in the same burst fail
  together; without jitter they would retry together and rebuild the pile-up
  that rate-limited them.

A relay therefore keeps trying for about four hours before it gives up.

## No duplicate orders

Three checks stand between a retry and a second Printful order for the same
sale:

1. **Every order is sent with `external_id` set to our own order id.** Printful
   holds it, and it is how the other two checks find the order.
2. **The local record.** If `printful_orders` already has a row for the order,
   the relay adopts it and calls the attempt a success.
3. **The remote record.** From the second attempt onward, the relay asks
   Printful for `GET /orders/@{our order id}` first. An order that a previous
   attempt created before timing out is adopted rather than placed again.

If that lookup itself fails, the attempt fails too. A lookup error is never
read as "no order exists" — that is exactly how a duplicate gets made.

## Where a stuck order shows up

`/admin/orders/fulfillment` is the one screen that answers "which paid orders
have not reached the fulfillment provider". It shows three things:

- **Paid, never sent** — paid orders with print-fulfilled lines and no relay row
  at all. These are orders taken before the relay existed, or written by a path
  that bypassed it.
- **In flight and failed** — every relay still retrying or dead-lettered, with
  the attempt count, the next scheduled attempt, the error, and the raw provider
  response.
- **Recently fulfilled** — the last ten that succeeded, so a retry that worked
  is visible instead of a row silently disappearing.

Every row has a **Retry now** button. Retrying a dead-lettered relay reopens it
with three fresh attempts, so a fixed cause gets a real chance rather than one
shot. Both actions need the `orders:write` permission.

When a relay dead-letters, every admin of that site gets an urgent in-app
notification linking to this screen. The customer who paid should not be the one
who discovers the order never shipped.

## The sweep

Retries are driven by the **`fulfillment-retry` scheduled job**, which runs
every ten minutes on a Cloudflare Cron Trigger. It retries every relay whose
backoff has elapsed, across all sites, up to 25 in a pass. Each retry is scoped
by the `site_id` on the row it came from.

The job is registered in `src/lib/server/scheduler/registry.ts` and the full
mechanism is documented in [SCHEDULED_JOBS.md](./SCHEDULED_JOBS.md). Nothing
here needs configuring: the Cron Trigger is in `wrangler.toml` and deploys with
the Worker.

To force a sweep without waiting for the cron:

```bash
curl -X POST "https://<a site domain>/api/cron/run?job=fulfillment-retry" \
  -H "Authorization: Bearer $CRON_SECRET"
```

`CRON_SECRET` is optional and only used for that manual path — the schedule
itself authenticates in-process. Locally, put it in `.dev.vars` and call
`http://localhost:4236/api/cron/run?job=fulfillment-retry`.

### It used to be a GitHub Actions workflow

Until issue #114 there was no `scheduled()` handler to attach a Cron Trigger to:
`@sveltejs/adapter-cloudflare` emits a fetch-only `_worker.js`. The sweep was an
authenticated endpoint, `POST /api/cron/fulfillment-retry`, curled every ten
minutes by `.github/workflows/fulfillment-retry.yml`. Both are gone. Production
timing no longer depends on GitHub's best-effort scheduler, and the
`FULFILLMENT_RETRY_URL` repository secret is no longer read by anything and can
be deleted.

Cloudflare Queues remain the natural transport for the retry itself, and are
still worth considering — the relay table stays the record either way, so the
transport can be swapped underneath it.

## Schema

`fulfillment_relays`, added in `migrations/0104_fulfillment_relays.sql`. One row
per (site, order, provider).

| Column              | Meaning                                                  |
| ------------------- | -------------------------------------------------------- |
| `status`            | `pending`, `succeeded` or `dead_lettered`                |
| `attempts`          | Attempts made, the first one included                    |
| `max_attempts`      | Budget for this relay; a manual retry raises it          |
| `next_attempt_at`   | When the sweep may try again; NULL once settled          |
| `failure_kind`      | `transient` or `permanent`                               |
| `last_error`        | Message from the last failure                            |
| `last_response`     | Raw provider response body from the last failure         |
| `external_order_id` | The provider's own order id, once the order exists there |

## Adding another provider

The runner knows nothing about Printful. To relay to a second provider:

1. Write the adapter. It places one order and throws `RelayFailure.transient()`
   or `RelayFailure.permanent()` — see
   `src/lib/server/fulfillment/relay-errors.ts`.
2. Call `runRelayAttempt` with the provider's `providerType` and a human
   `providerLabel`.
3. Add the provider to the dispatch in
   `src/lib/server/fulfillment/sweep.ts`. A relay naming a provider the sweep
   does not know is skipped and logged, never silently retried forever.

## Related

- [PRINTFUL_INTEGRATION.md](./PRINTFUL_INTEGRATION.md) — the integration itself
- [FULFILLMENT_PROVIDERS_ADMIN.md](./FULFILLMENT_PROVIDERS_ADMIN.md) — connecting a provider
- [CI.md](./CI.md) — the workflows that run against this repository
