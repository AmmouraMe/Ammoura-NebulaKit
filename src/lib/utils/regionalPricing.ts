/**
 * Regional pricing: a site owner can lower prices for buyers in countries
 * where money buys more, using the World Bank's price level index
 * (`$lib/data/priceLevelIndex`). A $20 design is a day's wage in some
 * places; this lets the owner meet those buyers part of the way.
 *
 * Prices only ever go down. A country priced above the US pays the base
 * price, and so does a country with no data.
 *
 * Shared by the storefront (to show the price) and checkout (to charge it).
 * Checkout recomputes it on the server; the browser's figure is never used.
 */
import { PRICE_LEVEL_INDEX } from '$lib/data/priceLevelIndex';

export interface RegionalPricingSettings {
  enabled: boolean;
  /**
   * How much of the gap to US prices is passed on, 0–1. At 0.5 a country
   * whose prices are 40% of the US gets 30% off (half of the 60% gap).
   */
  strength: number;
  /** The largest discount any country gets, 0–0.9. Protects the margin. */
  maxDiscount: number;
  /**
   * Per-country multipliers the owner set by hand (`IN: 0.6` = 40% off).
   * They win over the index, and are still held to `maxDiscount`.
   */
  overrides: Record<string, number>;
  /** Tell the shopper their prices were adjusted for their country. */
  showNotice: boolean;
  /**
   * Which products it applies to. Digital products cost nothing to make
   * again, so any discount is still margin. A printed tee costs the owner the
   * same wherever the buyer lives, so `all` is a choice to make with care.
   */
  scope: 'digital' | 'all';
}

/** What the storefront layout tells the page, to show the notice. */
export interface ShopperPricingSummary {
  country: string | null;
  countryName: string | null;
  /** 1 when nothing is lowered. */
  multiplier: number;
  scope: RegionalPricingSettings['scope'];
  showNotice: boolean;
}

export type ProductType = 'physical' | 'service' | 'digital' | string | null | undefined;

export const DEFAULT_REGIONAL_PRICING: RegionalPricingSettings = {
  enabled: false,
  strength: 0.5,
  maxDiscount: 0.5,
  overrides: {},
  showNotice: true,
  scope: 'digital'
};

/** Multipliers are rounded to this step so prices stay steady. */
const STEP = 0.05;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** The price level ratio for a country, or null when there is no data. */
export function priceLevel(country: string | null | undefined): number | null {
  if (!country) return null;
  return PRICE_LEVEL_INDEX[country.toUpperCase()]?.[0] ?? null;
}

/**
 * What a buyer in `country` pays, as a share of the base price: 1 is full
 * price, 0.7 is 30% off. Always between `1 - maxDiscount` and 1.
 */
export function priceMultiplier(
  settings: RegionalPricingSettings,
  country: string | null | undefined
): number {
  if (!settings.enabled || !country) return 1;
  const floor = 1 - clamp(settings.maxDiscount, 0, 0.9);
  const override = settings.overrides[country.toUpperCase()];
  let m: number;
  if (typeof override === 'number' && Number.isFinite(override)) {
    m = override;
  } else {
    const level = priceLevel(country);
    if (level === null || level >= 1) return 1;
    m = 1 - clamp(settings.strength, 0, 1) * (1 - level);
  }
  m = Math.round(m / STEP) * STEP;
  return Math.round(clamp(m, floor, 1) * 100) / 100;
}

/**
 * The multiplier for an order, from every country the order is tied to:
 * where the request came from, the billing address and the shipping address.
 * The least generous one wins, so a VPN or a borrowed address alone does not
 * buy a discount. A country that is unknown (null) is left out.
 */
export function orderMultiplier(
  settings: RegionalPricingSettings,
  countries: (string | null | undefined)[]
): number {
  const known = countries.filter((c): c is string => !!c);
  if (!settings.enabled || known.length === 0) return 1;
  return Math.max(...known.map((c) => priceMultiplier(settings, c)));
}

/** True when the settings lower this kind of product's price at all. */
export function appliesToProduct(settings: RegionalPricingSettings, type: ProductType): boolean {
  return settings.enabled && (settings.scope === 'all' || type === 'digital');
}

/** A base price at a multiplier, in whole cents. */
export function regionalPrice(base: number, multiplier: number): number {
  if (multiplier >= 1) return base;
  return Math.round(base * multiplier * 100) / 100;
}

/**
 * Settings read from storage, made safe: anything missing or out of range
 * falls back to the default, and override values outside 0.1–1 are dropped.
 */
export function parseRegionalPricing(raw: unknown): RegionalPricingSettings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number, lo: number, hi: number) =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d;
  const overrides: Record<string, number> = {};
  if (obj.overrides && typeof obj.overrides === 'object') {
    for (const [code, value] of Object.entries(obj.overrides as Record<string, unknown>)) {
      if (
        /^[A-Z]{2}$/.test(code) &&
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0.1 &&
        value <= 1
      ) {
        overrides[code] = Math.round(value * 100) / 100;
      }
    }
  }
  return {
    enabled: obj.enabled === true,
    strength: num(obj.strength, DEFAULT_REGIONAL_PRICING.strength, 0, 1),
    maxDiscount: num(obj.maxDiscount, DEFAULT_REGIONAL_PRICING.maxDiscount, 0, 0.9),
    overrides,
    showNotice: obj.showNotice !== false,
    scope: obj.scope === 'all' ? 'all' : 'digital'
  };
}
