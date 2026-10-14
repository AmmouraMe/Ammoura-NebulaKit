import { describe, it, expect } from 'vitest';
import {
  DEFAULT_REGIONAL_PRICING,
  appliesToProduct,
  orderMultiplier,
  parseRegionalPricing,
  priceLevel,
  priceMultiplier,
  regionalPrice,
  type RegionalPricingSettings
} from './regionalPricing';

const on: RegionalPricingSettings = { ...DEFAULT_REGIONAL_PRICING, enabled: true };

describe('priceMultiplier', () => {
  it('is full price when switched off', () => {
    expect(priceMultiplier(DEFAULT_REGIONAL_PRICING, 'IN')).toBe(1);
  });

  it('is full price for the US, dearer countries, and unknown ones', () => {
    expect(priceMultiplier(on, 'US')).toBe(1);
    expect(priceMultiplier(on, 'CH')).toBe(1);
    expect(priceMultiplier(on, 'ZZ')).toBe(1);
    expect(priceMultiplier(on, null)).toBe(1);
  });

  it('passes on the chosen share of the gap, in 5% steps', () => {
    const level = priceLevel('BR')!;
    expect(level).toBeLessThan(1);
    const m = priceMultiplier({ ...on, strength: 0.5, maxDiscount: 0.9 }, 'BR');
    expect(m).toBeCloseTo(Math.round((1 - 0.5 * (1 - level)) / 0.05) * 0.05, 5);
  });

  it('never goes past the largest discount', () => {
    expect(priceMultiplier({ ...on, strength: 1, maxDiscount: 0.4 }, 'NG')).toBe(0.6);
  });

  it('uses an owner override, still held to the cap', () => {
    expect(priceMultiplier({ ...on, overrides: { DE: 0.8 } }, 'de')).toBe(0.8);
    expect(priceMultiplier({ ...on, maxDiscount: 0.3, overrides: { IN: 0.2 } }, 'IN')).toBe(0.7);
  });
});

describe('orderMultiplier', () => {
  it('takes the least generous of the order’s countries', () => {
    const india = priceMultiplier(on, 'IN');
    expect(india).toBeLessThan(1);
    expect(orderMultiplier(on, ['IN', 'IN', 'IN'])).toBe(india);
    expect(orderMultiplier(on, ['IN', 'US', 'IN'])).toBe(1);
  });

  it('leaves out countries it does not know', () => {
    expect(orderMultiplier(on, [null, 'IN', undefined])).toBe(priceMultiplier(on, 'IN'));
    expect(orderMultiplier(on, [null])).toBe(1);
  });
});

describe('regionalPrice', () => {
  it('rounds to cents and leaves full price alone', () => {
    expect(regionalPrice(19.99, 0.6)).toBe(11.99);
    expect(regionalPrice(19.99, 1)).toBe(19.99);
  });
});

describe('parseRegionalPricing', () => {
  it('fills defaults for missing or bad input', () => {
    expect(parseRegionalPricing(null)).toEqual(DEFAULT_REGIONAL_PRICING);
    expect(parseRegionalPricing('x')).toEqual(DEFAULT_REGIONAL_PRICING);
  });

  it('clamps numbers and drops bad overrides', () => {
    const s = parseRegionalPricing({
      enabled: true,
      strength: 3,
      maxDiscount: 0.99,
      overrides: { IN: 0.5, us: 0.5, BR: 0.01, DE: 'x', FR: 1 },
      showNotice: false,
      scope: 'all'
    });
    expect(s).toEqual({
      enabled: true,
      strength: 1,
      maxDiscount: 0.9,
      overrides: { IN: 0.5, FR: 1 },
      showNotice: false,
      scope: 'all'
    });
  });
});

describe('appliesToProduct', () => {
  it('covers digital products only, unless the owner chose all', () => {
    expect(appliesToProduct(on, 'digital')).toBe(true);
    expect(appliesToProduct(on, 'physical')).toBe(false);
    expect(appliesToProduct({ ...on, scope: 'all' }, 'physical')).toBe(true);
    expect(appliesToProduct(DEFAULT_REGIONAL_PRICING, 'digital')).toBe(false);
  });
});
