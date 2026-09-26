/**
 * POST /api/checkout/session
 * Creates an order (unpaid) from the cart, then a Stripe Checkout Session
 * for it, and returns the Stripe-hosted URL to redirect the customer to.
 * The order is marked paid by POST /api/webhooks/stripe once Stripe
 * confirms the payment — never here, since the customer hasn't paid yet.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/server/db/connection';
import { createOrder, setOrderStripeSession } from '$lib/server/db/orders';
import { toCountryCode } from '$lib/data/countries';
import {
  saveEquipmentValuesForOrderItems,
  type OrderItemEquipmentValueSubmission
} from '$lib/server/db/equipment';
import type {
  OrderItemCustomizationInput,
  OrderItemFieldValueInput
} from '$lib/server/db/order-customizations';
import { getPaymentSettings } from '$lib/server/db/site-settings';
import { repriceCheckout, CheckoutPricingError } from '$lib/server/checkout-pricing';
import { getStripeClient } from '$lib/server/integrations/stripe/client';
import type Stripe from 'stripe';

interface CheckoutSessionRequest {
  items: Array<{
    product_id?: string;
    variant_id?: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    equipment_values?: OrderItemEquipmentValueSubmission[];
    customizations?: OrderItemCustomizationInput[];
    field_values?: OrderItemFieldValueInput[];
  }>;
  /** Ignored — the server reprices from the products table. */
  subtotal?: number;
  shipping_cost: number;
  /** Ignored — derived from the repriced subtotal. */
  tax?: number;
  /** Ignored — derived from the repriced subtotal. */
  total?: number;
  shipping_address: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  billing_address: Record<string, unknown>;
  shipping_details?: {
    groups: Array<{
      id: string;
      shippingOptionId: string;
      shippingOptionName: string;
      shippingCost: number;
      products: Array<{ id: string; name: string; quantity: number }>;
    }>;
  };
}

export const POST: RequestHandler = async ({ request, platform, locals, url }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  const encryptionKey = platform.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw error(500, 'Encryption key not configured');
  }

  const db = getDB(platform);
  const siteId = locals.siteId;
  const userId = locals.currentUser?.id;

  const data = (await request.json()) as CheckoutSessionRequest;

  if (!data.items?.length) {
    throw error(400, 'Order must contain at least one item');
  }
  if (!data.shipping_address || !data.billing_address) {
    throw error(400, 'Missing required order information');
  }

  // Countries are stored as ISO-2 and nothing else. The browser is not trusted
  // to do it: an address whose country cannot be resolved here would be taken,
  // charged, and then stuck at the fulfilment relay with nowhere to ship to.
  const shippingCountry = toCountryCode(data.shipping_address.country ?? '');
  if (!shippingCountry) {
    throw error(400, 'Shipping country is not a country we can ship to');
  }
  const billingCountryRaw = data.billing_address.country;
  const billingCountry = toCountryCode(
    typeof billingCountryRaw === 'string' ? billingCountryRaw : ''
  );
  if (!billingCountry) {
    throw error(400, 'Billing country is not a country we recognise');
  }
  data.shipping_address = { ...data.shipping_address, country: shippingCountry };
  data.billing_address = { ...data.billing_address, country: billingCountry };

  const paymentSettings = await getPaymentSettings(db, siteId, encryptionKey);
  if (!paymentSettings.stripeEnabled || !paymentSettings.stripeSecretKey) {
    throw error(400, 'Stripe is not configured for this store');
  }

  // Everything the browser said about money is discarded here and re-derived
  // from the products table; only the shipping selection is carried over.
  let priced;
  try {
    priced = await repriceCheckout(db, siteId, data.items, data.shipping_cost);
  } catch (err) {
    if (err instanceof CheckoutPricingError) {
      throw error(400, err.message);
    }
    throw err;
  }
  const items = priced.items.map((entry) => entry.item);

  const order = await createOrder(db, siteId, {
    user_id: userId,
    items,
    subtotal: priced.subtotal,
    shipping_cost: data.shipping_cost,
    tax: priced.tax,
    total: priced.total,
    shipping_address: data.shipping_address,
    billing_address: data.billing_address,
    payment_method: { type: 'stripe' },
    shipping_details: data.shipping_details
  });

  await saveEquipmentValuesForOrderItems(db, order.id, items);

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: { name: item.name },
      unit_amount: Math.round(item.price * 100)
    },
    quantity: item.quantity
  }));

  if (data.shipping_cost > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Shipping' },
        unit_amount: Math.round(data.shipping_cost * 100)
      },
      quantity: 1
    });
  }
  // A tax-inclusive store's prices already contain the tax, so `priced.tax`
  // reports it rather than adds it. A Tax line here would charge it twice and
  // make Stripe collect more than the order row says.
  if (priced.tax > 0 && !priced.taxRule.pricesIncludeTax) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Tax' },
        unit_amount: Math.round(priced.tax * 100)
      },
      quantity: 1
    });
  }

  // The order row and the Stripe charge are built from the same numbers by two
  // different pieces of code. When they disagree, the customer is billed one
  // amount and the merchant's records hold another, so refuse rather than
  // charge — this endpoint has shipped that bug before.
  const lineItemTotalCents = lineItems.reduce(
    (sum, line) => sum + (line.price_data?.unit_amount ?? 0) * (line.quantity ?? 1),
    0
  );
  if (lineItemTotalCents !== Math.round(priced.total * 100)) {
    console.error(
      `Checkout totals disagree for order ${order.id}: Stripe line items sum to ` +
        `${lineItemTotalCents} cents, order total is ${Math.round(priced.total * 100)} cents`
    );
    throw error(500, 'Checkout could not price this order consistently');
  }

  const stripe = getStripeClient(paymentSettings.stripeSecretKey);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      customer_email: data.shipping_address.email || undefined,
      success_url: `${url.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${url.origin}/checkout?canceled=1`,
      metadata: { orderId: order.id, siteId }
    });
  } catch (err) {
    console.error('Failed to create Stripe Checkout Session:', err);
    throw error(502, 'Failed to start checkout with Stripe');
  }

  if (!session.url) {
    throw error(502, 'Stripe did not return a checkout URL');
  }

  await setOrderStripeSession(db, siteId, order.id, session.id);

  return json({ success: true, url: session.url, orderId: order.id });
};
