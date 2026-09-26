/**
 * Printful order relay — the moment a paid Ammoura order actually becomes a
 * real order placed with Printful.
 *
 * Called once per order, right after the Stripe webhook marks it paid, and
 * again by the sweep in $lib/server/fulfillment/sweep for anything that failed
 * the first time. Only order items whose selected variant is mapped to a
 * Printful sync variant (via product_variants.printful_sync_variant_id) are
 * relayed; orders with no Printful-fulfilled items are a no-op.
 *
 * Everything about retrying, backoff and dead-lettering lives in
 * $lib/server/fulfillment/relay-runner. This file only knows how to place one
 * Printful order and which Printful failures are worth trying again.
 */

import { getOrderById, getOrderItems, type DBOrder } from '$lib/server/db/orders';
import { getProductVariantById } from '$lib/server/db/product-variants';
import { getFulfillmentProvidersByType } from '$lib/server/db/fulfillment-providers';
import { RelayFailure } from '$lib/server/fulfillment/relay-errors';
import { runRelayAttempt, type RunRelayResult } from '$lib/server/fulfillment/relay-runner';
import { getPrintfulOrder, storePrintfulOrder } from './db';
import { isTransientPrintfulFailure, PrintfulApiError } from './errors';
import { PrintfulService } from './service';
import { toCountryCode } from '$lib/data/countries';
import type { PrintfulOrder, PrintfulOrderRequest, PrintfulRecipient } from './types';

export const PRINTFUL_PROVIDER_TYPE = 'printful';
const PRINTFUL_PROVIDER_LABEL = 'Printful';

interface StoredShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  state?: string;
  zipCode: string;
  country: string;
}

/** What the stored address calls its country, for an error a human must read. */
function shippingCountry(order: DBOrder): string {
  try {
    const addr = JSON.parse(order.shipping_address) as StoredShippingAddress;
    return addr.country?.trim() || '(blank)';
  } catch {
    return '(unreadable)';
  }
}

function buildRecipient(order: DBOrder): PrintfulRecipient | null {
  const addr = JSON.parse(order.shipping_address) as StoredShippingAddress;
  const countryCode = toCountryCode(addr.country);
  if (!countryCode) return null;

  return {
    name: `${addr.firstName} ${addr.lastName}`.trim(),
    address1: addr.address,
    city: addr.city,
    state_code: addr.state,
    country_code: countryCode,
    zip: addr.zipCode,
    phone: addr.phone,
    email: addr.email
  };
}

/**
 * Turn a Printful client error into a relay failure that says whether the
 * order can ever succeed. A 429 or a 503 is Printful having a bad minute; a
 * 422 on an unavailable variant is Printful having read the order and refused.
 */
function toPrintfulRelayFailure(error: unknown): RelayFailure {
  if (error instanceof RelayFailure) return error;

  const response = error instanceof PrintfulApiError ? error.body : null;
  const message = error instanceof Error ? error.message : String(error);
  const kind = isTransientPrintfulFailure(error) ? 'transient' : 'permanent';
  return new RelayFailure(kind, message, response, error);
}

/**
 * Collect the order lines Printful is responsible for. Lines without a variant,
 * or whose variant is not mapped to a Printful sync variant, belong to some
 * other fulfillment path and are left alone.
 */
async function collectPrintfulItems(
  db: D1Database,
  siteId: string,
  orderId: string
): Promise<PrintfulOrderRequest['items']> {
  const orderItems = await getOrderItems(db, orderId);
  const items: PrintfulOrderRequest['items'] = [];

  for (const item of orderItems) {
    if (!item.variant_id) continue;
    const variant = await getProductVariantById(db, siteId, item.variant_id);
    if (!variant?.printful_sync_variant_id) continue;
    items.push({
      sync_variant_id: variant.printful_sync_variant_id,
      quantity: item.quantity
    });
  }

  return items;
}

/**
 * Relay a paid order to Printful, recording the attempt.
 *
 * Safe to call repeatedly: an order Printful already holds is adopted rather
 * than placed twice. A no-op for orders with no Printful-fulfilled items.
 * Never throws — a relay failure must not stop the Stripe webhook returning
 * 200, or Stripe retries the whole payment path.
 */
export async function relayPaidOrderToPrintful(
  db: D1Database,
  siteId: string,
  orderId: string,
  encryptionKey: string
): Promise<RunRelayResult | null> {
  try {
    const order = await getOrderById(db, siteId, orderId);
    if (!order) return null;

    const printfulItems = await collectPrintfulItems(db, siteId, orderId);
    if (printfulItems.length === 0) return null;

    return await runRelayAttempt(db, {
      siteId,
      orderId,
      providerType: PRINTFUL_PROVIDER_TYPE,
      providerLabel: PRINTFUL_PROVIDER_LABEL,
      execute: async (relay) => {
        // An order we already recorded locally needs no second placement. This
        // is the cheap idempotency check; the remote one below covers the case
        // where Printful accepted the order but we never heard back.
        const stored = await getPrintfulOrder(db, siteId, orderId);
        const storedId = stored?.printful_order_id;
        if (typeof storedId === 'number' || typeof storedId === 'string') {
          return {
            externalOrderId: String(storedId),
            detail: `Order ${orderId} was already placed with Printful (Printful order ${storedId})`
          };
        }

        const providers = await getFulfillmentProvidersByType(db, siteId, PRINTFUL_PROVIDER_TYPE);
        const provider = providers[0];
        if (!provider) {
          throw RelayFailure.permanent(
            'No Printful provider is connected for this site. Connect Printful, then retry this order.'
          );
        }

        const recipient = buildRecipient(order);
        if (!recipient) {
          throw RelayFailure.permanent(
            `Shipping country "${shippingCountry(order)}" is not a country we can give Printful as an ISO code. Fix the address on order ${orderId}, then retry.`
          );
        }

        const service = await PrintfulService.fromProvider(provider, encryptionKey);

        // Retries only. A first attempt cannot have created anything yet, and
        // this costs a request.
        if (relay.attempts > 0) {
          const adopted = await findExistingPrintfulOrder(service, orderId);
          if (adopted) {
            await storePrintfulOrder(db, siteId, orderId, adopted.id, JSON.stringify(adopted));
            return {
              externalOrderId: String(adopted.id),
              detail: `Order ${orderId} was already with Printful from an earlier attempt (Printful order ${adopted.id})`
            };
          }
        }

        let printfulOrder: PrintfulOrder;
        try {
          printfulOrder = await service.createOrderWithPrintful({
            external_id: order.id,
            shipping: 'standard',
            items: printfulItems,
            recipient
          });
        } catch (error) {
          throw toPrintfulRelayFailure(error);
        }

        await storePrintfulOrder(
          db,
          siteId,
          order.id,
          printfulOrder.id,
          JSON.stringify(printfulOrder)
        );

        return {
          externalOrderId: String(printfulOrder.id),
          detail: `Order ${order.id} relayed to Printful (Printful order ${printfulOrder.id})`
        };
      }
    });
  } catch (err) {
    // Only the pre-flight reads can land here; runRelayAttempt handles its own.
    console.error(`Failed to relay order ${orderId} to Printful:`, err);
    return null;
  }
}

/**
 * Ask Printful whether it already holds this order. A lookup that itself fails
 * must not be read as "no order exists" — that is how duplicates get made — so
 * the failure is re-thrown and the attempt is retried instead.
 */
async function findExistingPrintfulOrder(
  service: PrintfulService,
  orderId: string
): Promise<PrintfulOrder | null> {
  try {
    return await service.findOrderByExternalId(orderId);
  } catch (error) {
    throw toPrintfulRelayFailure(error);
  }
}
