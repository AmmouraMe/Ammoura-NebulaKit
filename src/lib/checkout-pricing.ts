/**
 * Checkout money rules shared by the storefront and the server.
 *
 * The storefront shows these numbers and the server charges them, so they must
 * come from one place — a copy of the rate in the Svelte page and another in
 * the API would silently drift and quote a customer one total while billing
 * another.
 */

/**
 * What a site charges in sales tax, as checkout needs it.
 *
 * Derived from the site's own tax settings (`getTaxSettings`), which is the
 * whole point: this is a multi-tenant platform, and a store in Portland does
 * not charge what a store in London charges. Until 2026-09-20 checkout applied
 * one hardcoded 8% to every store on the platform and ignored the settings the
 * admin UI had been collecting all along.
 */
export interface TaxRule {
  /** The site's "Enable Tax Calculations" switch. Off means no tax is added. */
  enabled: boolean;
  /** Percent, as the admin form states it: `8.25` means 8.25%, not 825%. */
  ratePercent: number;
  /**
   * The site's "Prices Include Tax" switch. When on, the displayed price is
   * already tax-inclusive, so nothing is added to the total — the tax is
   * reported as the portion of the subtotal it represents, which is what an
   * order record and a receipt need.
   */
  pricesIncludeTax: boolean;
}

/**
 * A site with no tax settings saved charges no tax.
 *
 * This is the honest default and not a placeholder: a store that has never
 * opened the tax page has not told us what jurisdiction it is in, and
 * inventing a rate for it takes money from its customers on a guess.
 */
export const NO_TAX: TaxRule = { enabled: false, ratePercent: 0, pricesIncludeTax: false };

/** Round to whole cents; avoids 0.1 + 0.2 style drift reaching Stripe. */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** A rate percent that is safe to multiply by, whatever the settings hold. */
function usableRate(rule: TaxRule): number {
  if (!rule.enabled) return 0;
  const percent = rule.ratePercent;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  // The admin form caps the rate at 100%; a stored value beyond it is corrupt,
  // and charging it would be worse than charging nothing.
  if (percent > 100) return 0;
  return percent / 100;
}

/**
 * The tax on an order subtotal.
 *
 * Added on top of the subtotal for a tax-exclusive store, and extracted from
 * it for a tax-inclusive one — where `subtotal` already contains the tax, so
 * the tax is `subtotal - subtotal / (1 + rate)`.
 */
export function calculateOrderTax(subtotal: number, rule: TaxRule = NO_TAX): number {
  const rate = usableRate(rule);
  if (rate === 0) return 0;
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;

  if (rule.pricesIncludeTax) {
    return roundMoney(subtotal - subtotal / (1 + rate));
  }
  return roundMoney(subtotal * rate);
}

/**
 * What the customer pays. Tax is added for a tax-exclusive store and already
 * inside the subtotal for a tax-inclusive one, so it is never added twice.
 */
export function calculateOrderTotal(
  subtotal: number,
  shippingCost: number,
  tax: number,
  rule: TaxRule = NO_TAX
): number {
  const addedTax = rule.pricesIncludeTax ? 0 : tax;
  return roundMoney(subtotal + shippingCost + addedTax);
}
