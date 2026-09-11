/**
 * Checkout money rules shared by the storefront and the server.
 *
 * The storefront shows these numbers and the server charges them, so they must
 * come from one place — a copy of the rate in the Svelte page and another in
 * the API would silently drift and quote a customer one total while billing
 * another.
 *
 * The rate itself is per-site and lives in site settings, so it is a parameter
 * here rather than a constant. Both callers resolve it with
 * `taxRateFromSettings` so the percent-to-fraction conversion also happens in
 * exactly one place.
 */

/**
 * The part of a site's tax settings that checkout acts on.
 *
 * Structural on purpose: `TaxSettings` from `$lib/server/db/site-settings`
 * satisfies it, but this module stays free of server imports so the storefront
 * bundle can use it.
 */
export interface CheckoutTaxSettings {
  calculationsEnabled: boolean;
  /** Whole percent, as the admin tax form collects it — 8.25 means 8.25%. */
  defaultRate: number;
}

/**
 * Resolve a site's tax settings to the fraction checkout multiplies by.
 *
 * A store that has not turned tax calculations on charges no tax. That is what
 * the admin toggle says it does, and charging a rate the merchant never set is
 * worse than charging none: they would owe a remittance nobody recorded.
 *
 * Tax classes are not applied yet. `TaxSettings.taxClasses` can hold named
 * rates, but no product or variant carries a class assignment, so there is
 * nothing to match an item against — every line uses the site default until
 * products gain a tax-class field.
 */
export function taxRateFromSettings(settings: CheckoutTaxSettings | null | undefined): number {
  if (!settings?.calculationsEnabled) return 0;

  const percent = settings.defaultRate;
  // A corrupt or absent setting must not become NaN and poison every total.
  if (!Number.isFinite(percent) || percent <= 0) return 0;

  return Math.min(percent, 100) / 100;
}

/** Round to whole cents; avoids 0.1 + 0.2 style drift reaching Stripe. */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function calculateOrderTax(subtotal: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return roundMoney(subtotal * rate);
}
