import { describe, it, expect } from 'vitest';
import { taxRateFromSettings, calculateOrderTax, roundMoney } from './checkout-pricing';

/** Settings as `getTaxSettings` returns them, with the two fields checkout reads. */
function settings(calculationsEnabled: boolean, defaultRate: number) {
  return { calculationsEnabled, defaultRate };
}

describe('taxRateFromSettings', () => {
  it('turns the admin form percent into the fraction checkout multiplies by', () => {
    expect(taxRateFromSettings(settings(true, 8.25))).toBe(0.0825);
  });

  it('charges nothing when the site has calculations switched off', () => {
    // Even with a rate saved: the toggle is the merchant's answer.
    expect(taxRateFromSettings(settings(false, 8.25))).toBe(0);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'falls back to no tax for the unusable rate %p',
    (rate) => {
      expect(taxRateFromSettings(settings(true, rate))).toBe(0);
    }
  );

  it('caps a rate above 100% instead of billing a multiple of the cart', () => {
    expect(taxRateFromSettings(settings(true, 5000))).toBe(1);
  });

  it.each([null, undefined])('charges nothing when settings are %p', (value) => {
    expect(taxRateFromSettings(value)).toBe(0);
  });
});

describe('calculateOrderTax', () => {
  it('applies the rate it is given and rounds to whole cents', () => {
    expect(calculateOrderTax(19.99, 0.0825)).toBe(1.65);
  });

  it('returns zero for a zero rate without producing -0 or NaN', () => {
    expect(calculateOrderTax(100, 0)).toBe(0);
    expect(calculateOrderTax(100, Number.NaN)).toBe(0);
  });
});

describe('roundMoney', () => {
  it('removes float drift that would otherwise reach Stripe', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });
});
