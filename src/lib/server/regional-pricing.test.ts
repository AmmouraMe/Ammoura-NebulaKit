import { describe, it, expect } from 'vitest';
import {
  shopperPricing,
  summarizeShopperPricing,
  withShopperPrice,
  productMultiplier
} from './regional-pricing';
import { DEFAULT_REGIONAL_PRICING } from '$lib/utils/regionalPricing';

const settings = { ...DEFAULT_REGIONAL_PRICING, enabled: true, overrides: { IN: 0.6 } };

describe('shopperPricing', () => {
  it('is full price with no settings or no country', () => {
    expect(shopperPricing({}).multiplier).toBe(1);
    expect(shopperPricing({ regionalPricing: settings, country: null }).multiplier).toBe(1);
  });

  it('carries the country’s multiplier', () => {
    const p = shopperPricing({ regionalPricing: settings, country: 'IN' });
    expect(p.multiplier).toBe(0.6);
    expect(summarizeShopperPricing(p)).toMatchObject({
      country: 'IN',
      countryName: 'India',
      multiplier: 0.6,
      scope: 'digital'
    });
  });
});

describe('withShopperPrice', () => {
  const india = shopperPricing({ regionalPricing: settings, country: 'IN' });

  it('lowers a covered product and keeps the base price', () => {
    const p = withShopperPrice(india, {
      price: 20,
      type: 'digital',
      variants: [{ price: 30 }]
    });
    expect(p.price).toBe(12);
    expect(p.regularPrice).toBe(20);
    expect(p.variants).toEqual([{ price: 18, regularPrice: 30 }]);
  });

  it('returns a product it does not cover unchanged', () => {
    const product = { price: 20, type: 'physical' };
    expect(withShopperPrice(india, product)).toBe(product);
    expect(productMultiplier(india, 'physical')).toBe(1);
  });
});
