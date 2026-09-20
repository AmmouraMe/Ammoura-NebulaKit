import { describe, it, expect } from 'vitest';
import {
  calculateOrderTax,
  calculateOrderTotal,
  roundMoney,
  NO_TAX,
  type TaxRule
} from './checkout-pricing';

function rule(overrides: Partial<TaxRule> = {}): TaxRule {
  return { enabled: true, ratePercent: 8, pricesIncludeTax: false, ...overrides };
}

describe('roundMoney', () => {
  it('rounds to whole cents', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(33.333333)).toBe(33.33);
  });
});

describe('calculateOrderTax', () => {
  it('charges nothing without a rule', () => {
    expect(calculateOrderTax(100)).toBe(0);
    expect(calculateOrderTax(100, NO_TAX)).toBe(0);
  });

  it('charges nothing when the site has calculations switched off', () => {
    expect(calculateOrderTax(100, rule({ enabled: false, ratePercent: 20 }))).toBe(0);
  });

  it('reads the rate as a percent, not a fraction', () => {
    // The admin form says "Default Tax Rate (%)" and caps at 100, so 8 is 8%.
    expect(calculateOrderTax(100, rule({ ratePercent: 8 }))).toBe(8);
    expect(calculateOrderTax(100, rule({ ratePercent: 8.25 }))).toBe(8.25);
    expect(calculateOrderTax(100, rule({ ratePercent: 0.5 }))).toBe(0.5);
  });

  it('rounds to whole cents', () => {
    expect(calculateOrderTax(19.99, rule({ ratePercent: 8.6 }))).toBe(1.72);
  });

  it('extracts the tax already inside a tax-inclusive price', () => {
    expect(calculateOrderTax(120, rule({ ratePercent: 20, pricesIncludeTax: true }))).toBe(20);
    expect(calculateOrderTax(100, rule({ ratePercent: 25, pricesIncludeTax: true }))).toBe(20);
  });

  it('refuses a corrupt rate rather than charging it', () => {
    for (const ratePercent of [NaN, Infinity, -5, 101, 800]) {
      expect(calculateOrderTax(100, rule({ ratePercent }))).toBe(0);
    }
  });

  it('charges nothing on an empty or nonsense subtotal', () => {
    expect(calculateOrderTax(0, rule())).toBe(0);
    expect(calculateOrderTax(-10, rule())).toBe(0);
    expect(calculateOrderTax(NaN, rule())).toBe(0);
  });
});

describe('calculateOrderTotal', () => {
  it('adds tax and shipping for a tax-exclusive store', () => {
    const tax = calculateOrderTax(100, rule({ ratePercent: 8 }));
    expect(calculateOrderTotal(100, 15, tax, rule({ ratePercent: 8 }))).toBe(123);
  });

  it('never adds the tax twice for a tax-inclusive store', () => {
    const inclusive = rule({ ratePercent: 20, pricesIncludeTax: true });
    const tax = calculateOrderTax(120, inclusive);
    expect(tax).toBe(20);
    expect(calculateOrderTotal(120, 5, tax, inclusive)).toBe(125);
  });

  it('is subtotal plus shipping when the store charges no tax', () => {
    expect(calculateOrderTotal(50.5, 4.99, 0, NO_TAX)).toBe(55.49);
  });

  it('rounds the total to whole cents', () => {
    expect(calculateOrderTotal(10.1 * 3, 0, 0, NO_TAX)).toBe(30.3);
  });
});
