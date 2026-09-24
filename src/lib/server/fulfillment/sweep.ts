/**
 * The retry sweep: one pass over every relay whose backoff has elapsed.
 *
 * Driven by the `fulfillment-retry` scheduled job, on a Cron Trigger every ten
 * minutes. Until issue #114 there was no scheduled() handler to attach to, and
 * a GitHub Actions workflow curled an endpoint instead. See
 * docs/SCHEDULED_JOBS.md and docs/FULFILLMENT_RELAY.md.
 *
 * The sweep is platform-wide: it reads due relays across all sites, and each
 * retry it starts is scoped by the site_id on the row it came from.
 */

import { getDueRelays } from '$lib/server/db/fulfillment-relays';
import { getCurrentTimestamp } from '$lib/server/db/connection';
import {
  PRINTFUL_PROVIDER_TYPE,
  relayPaidOrderToPrintful
} from '$lib/server/integrations/printful/relay';

/** Relays handled in one pass, so a backlog cannot outrun the request budget. */
export const SWEEP_DEFAULT_LIMIT = 25;

export interface SweepResult {
  considered: number;
  succeeded: number;
  retrying: number;
  deadLettered: number;
  /** Already done, or a provider this build cannot relay to. */
  skipped: number;
}

export interface SweepOptions {
  limit?: number;
  now?: number;
}

/**
 * Retry every relay that is due. Never throws: one bad row must not stop the
 * rest of the sweep, and the caller is a cron job with nowhere to report to.
 */
export async function sweepDueRelays(
  db: D1Database,
  encryptionKey: string,
  options: SweepOptions = {}
): Promise<SweepResult> {
  const now = options.now ?? getCurrentTimestamp();
  const limit = options.limit ?? SWEEP_DEFAULT_LIMIT;

  const due = await getDueRelays(db, now, limit);
  const result: SweepResult = {
    considered: due.length,
    succeeded: 0,
    retrying: 0,
    deadLettered: 0,
    skipped: 0
  };

  for (const relay of due) {
    if (relay.provider_type !== PRINTFUL_PROVIDER_TYPE) {
      console.error(
        `Relay ${relay.id} names provider "${relay.provider_type}", which has no relay implementation`
      );
      result.skipped += 1;
      continue;
    }

    try {
      const outcome = await relayPaidOrderToPrintful(
        db,
        relay.site_id,
        relay.order_id,
        encryptionKey
      );

      if (!outcome || outcome.outcome === 'skipped') {
        result.skipped += 1;
      } else if (outcome.outcome === 'succeeded') {
        result.succeeded += 1;
      } else if (outcome.outcome === 'retrying') {
        result.retrying += 1;
      } else {
        result.deadLettered += 1;
      }
    } catch (error) {
      console.error(`Sweep failed on relay ${relay.id} (order ${relay.order_id}):`, error);
      result.skipped += 1;
    }
  }

  return result;
}
