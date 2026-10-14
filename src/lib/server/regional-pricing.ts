/**
 * Regional pricing for the request in hand. The hook puts the shopper's
 * country and the site's settings on `locals`; this turns them into prices.
 *
 * Prices are lowered where the server hands products to the storefront (page
 * loads and the storefront's product API calls), so every price the shopper
 * sees, and the price the cart keeps, is already the regional one. Checkout
 * recomputes it from the database (`repriceCheckout`), so the browser's
 * figure is never what is charged.
 *
 * Admin screens read base prices: a lowered price must never be shown in a
 * product editor, where saving it would make it the new base price.
 */
import {
  appliesToProduct,
  DEFAULT_REGIONAL_PRICING,
  priceMultiplier,
  regionalPrice,
  type ProductType,
  type RegionalPricingSettings,
  type ShopperPricingSummary
} from '$lib/utils/regionalPricing';
import { countryName } from '$lib/data/countries';

export interface ShopperPricing {
  settings: RegionalPricingSettings;
  country: string | null;
  /** The share of the base price this shopper pays for an eligible product. */
  multiplier: number;
}

export function shopperPricing(
  locals: Partial<Pick<App.Locals, 'country' | 'regionalPricing'>>
): ShopperPricing {
  const settings = locals.regionalPricing ?? DEFAULT_REGIONAL_PRICING;
  const country = locals.country ?? null;
  return { settings, country, multiplier: priceMultiplier(settings, country) };
}

export function summarizeShopperPricing(pricing: ShopperPricing): ShopperPricingSummary {
  return {
    country: pricing.country,
    countryName: pricing.country ? countryName(pricing.country) : null,
    multiplier: pricing.multiplier,
    scope: pricing.settings.scope,
    showNotice: pricing.settings.showNotice
  };
}

/** The multiplier for one product: 1 when the settings do not cover its type. */
export function productMultiplier(pricing: ShopperPricing, type: ProductType): number {
  return appliesToProduct(pricing.settings, type) ? pricing.multiplier : 1;
}

/**
 * A storefront product at this shopper's price. The base price is kept as
 * `regularPrice` when it differs, so a page can show it struck through.
 * Variant prices are lowered by the same multiplier.
 */
export function withShopperPrice<
  T extends { price: number; type?: ProductType; variants?: { price: number }[] }
>(pricing: ShopperPricing, product: T): T & { regularPrice?: number } {
  const m = productMultiplier(pricing, product.type);
  if (m >= 1) return product;
  return {
    ...product,
    price: regionalPrice(product.price, m),
    regularPrice: product.price,
    ...(product.variants
      ? {
          variants: product.variants.map((v) => ({
            ...v,
            price: regionalPrice(v.price, m),
            regularPrice: v.price
          }))
        }
      : {})
  };
}
