/**
 * Server-side repricing for checkout.
 *
 * The cart lives in the browser, so the checkout request arrives carrying its
 * own idea of what everything costs. None of that may be trusted: a tampered
 * request claiming `price: 0.01` for a $200 product used to flow straight into
 * the Stripe line items and the order row, so the customer paid a cent, the
 * webhook marked the order paid, and Printful fulfilled it at the merchant's
 * expense. Every amount that reaches Stripe is now derived here from the
 * products table instead.
 */

import { getProductById } from './db/products.js';
import { getProductVariantById } from './db/product-variants.js';
import { getTaxSettings } from './db/site-settings.js';
import {
  calculateOrderTax,
  calculateOrderTotal,
  NO_TAX,
  roundMoney,
  type TaxRule
} from '../checkout-pricing.js';

export interface RepriceableItem {
  product_id?: string;
  variant_id?: string;
  name: string;
  price: number;
  quantity: number;
}

export interface RepricedItem<T> {
  /** The submitted item with `price` replaced by the authoritative one. */
  item: T;
  lineTotal: number;
}

export interface RepricedCheckout<T> {
  items: Array<RepricedItem<T>>;
  subtotal: number;
  tax: number;
  total: number;
  /** The rule the tax was charged under, for the caller to record or show. */
  taxRule: TaxRule;
}

/**
 * The site's tax rule, read from its own settings.
 *
 * Never from the request: a rate the browser sends is a rate a browser can
 * change. A settings read that fails falls back to no tax rather than to a
 * guessed rate — charging nothing is recoverable, overcharging a customer is
 * not.
 */
export async function getCheckoutTaxRule(db: D1Database, siteId: string): Promise<TaxRule> {
  try {
    const settings = await getTaxSettings(db, siteId);
    return {
      enabled: settings.calculationsEnabled,
      ratePercent: settings.defaultRate,
      pricesIncludeTax: settings.pricesIncludeTax
    };
  } catch (error) {
    console.error('Failed to read tax settings; charging no tax', error);
    return NO_TAX;
  }
}

export class CheckoutPricingError extends Error {}

/**
 * Quantities are integers in [1, 999]; anything else is a tampered or corrupt
 * cart. The upper bound keeps a hostile request from overflowing the Stripe
 * line item and from creating an order nobody can fulfil.
 */
function assertValidQuantity(quantity: unknown, label: string): number {
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
    throw new CheckoutPricingError(`Invalid quantity for "${label}"`);
  }
  if (quantity > 999) {
    throw new CheckoutPricingError(`Quantity for "${label}" exceeds the 999 per-item limit`);
  }
  return quantity;
}

/**
 * Replace each item's client-supplied price with the one stored for that
 * product/variant, and recompute subtotal, tax and total from the result.
 *
 * Tax comes from the site's own settings, read here rather than accepted from
 * the request — see `getCheckoutTaxRule`.
 *
 * Shipping is passed through: it is chosen from server-offered options but the
 * selection logic (per-product groups, free-shipping thresholds) still lives in
 * the storefront, so the cost is not yet re-derivable here.
 */
export async function repriceCheckout<T extends RepriceableItem>(
  db: D1Database,
  siteId: string,
  items: T[],
  shippingCost: number
): Promise<RepricedCheckout<T>> {
  if (!Number.isFinite(shippingCost) || shippingCost < 0) {
    throw new CheckoutPricingError('Invalid shipping cost');
  }

  const repriced: Array<RepricedItem<T>> = [];

  for (const item of items) {
    const label = item.name || item.product_id || 'item';
    const quantity = assertValidQuantity(item.quantity, label);

    let unitPrice: number;

    if (item.variant_id) {
      const variant = await getProductVariantById(db, siteId, item.variant_id);
      if (!variant) {
        throw new CheckoutPricingError(`Unknown product variant for "${label}"`);
      }
      // A variant id from another product would otherwise let a shopper attach
      // the cheapest variant on the store to any product they like.
      if (item.product_id && variant.product_id !== item.product_id) {
        throw new CheckoutPricingError(`Variant does not belong to "${label}"`);
      }
      unitPrice = variant.price;
    } else {
      if (!item.product_id) {
        throw new CheckoutPricingError(`Missing product for "${label}"`);
      }
      const product = await getProductById(db, siteId, item.product_id);
      if (!product) {
        throw new CheckoutPricingError(`Unknown product "${label}"`);
      }
      unitPrice = product.price;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new CheckoutPricingError(`"${label}" is not purchasable`);
    }

    unitPrice = roundMoney(unitPrice);
    repriced.push({
      item: { ...item, price: unitPrice },
      lineTotal: roundMoney(unitPrice * quantity)
    });
  }

  const subtotal = roundMoney(repriced.reduce((sum, entry) => sum + entry.lineTotal, 0));
  const taxRule = await getCheckoutTaxRule(db, siteId);
  const tax = calculateOrderTax(subtotal, taxRule);
  const shipping = roundMoney(shippingCost);

  return {
    items: repriced,
    subtotal,
    tax,
    total: calculateOrderTotal(subtotal, shipping, tax, taxRule),
    taxRule
  };
}
