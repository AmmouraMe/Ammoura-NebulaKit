import { describe, it, expect, vi, beforeEach } from 'vitest';
import { repriceCheckout, getCheckoutTaxRule, CheckoutPricingError } from './checkout-pricing';

vi.mock('./db/products.js', () => ({ getProductById: vi.fn() }));
vi.mock('./db/product-variants.js', () => ({ getProductVariantById: vi.fn() }));
vi.mock('./db/site-settings.js', () => ({ getTaxSettings: vi.fn() }));

const { getProductById } = await import('./db/products.js');
const { getProductVariantById } = await import('./db/product-variants.js');
const { getTaxSettings } = await import('./db/site-settings.js');

const getProduct = getProductById as ReturnType<typeof vi.fn>;
const getVariant = getProductVariantById as ReturnType<typeof vi.fn>;
const getTax = getTaxSettings as ReturnType<typeof vi.fn>;

/** What `getTaxSettings` returns for a site, with the parts checkout reads. */
function taxSettings(overrides: Record<string, unknown> = {}) {
  return {
    calculationsEnabled: false,
    pricesIncludeTax: false,
    displayPricesWithTax: false,
    defaultRate: 0,
    taxClasses: [],
    ...overrides
  };
}

const db = {} as D1Database;
const SITE = 'site-1';

describe('repriceCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Most cases care about prices, not tax; a store with tax switched off is
    // also the platform default, so it is the baseline here.
    getTax.mockResolvedValue(taxSettings());
  });

  it('ignores the price the client sent and charges the stored one', async () => {
    getProduct.mockResolvedValue({ id: 'p1', price: 200 });

    const result = await repriceCheckout(
      db,
      SITE,
      [{ product_id: 'p1', name: 'Jacket', price: 0.01, quantity: 1 }],
      0
    );

    expect(result.items[0].item.price).toBe(200);
    expect(result.subtotal).toBe(200);
    expect(result.total).toBe(200);
  });

  it('prices a variant from the variant row, not the parent product', async () => {
    getVariant.mockResolvedValue({ id: 'v1', product_id: 'p1', price: 45 });

    const result = await repriceCheckout(
      db,
      SITE,
      [{ product_id: 'p1', variant_id: 'v1', name: 'Tee / L', price: 1, quantity: 2 }],
      0
    );

    expect(getProduct).not.toHaveBeenCalled();
    expect(result.items[0].lineTotal).toBe(90);
    expect(result.subtotal).toBe(90);
  });

  it('rejects a variant belonging to a different product', async () => {
    getVariant.mockResolvedValue({ id: 'v1', product_id: 'other-product', price: 1 });

    await expect(
      repriceCheckout(
        db,
        SITE,
        [{ product_id: 'p1', variant_id: 'v1', name: 'Tee', price: 1, quantity: 1 }],
        0
      )
    ).rejects.toThrow(CheckoutPricingError);
  });

  it('rejects an unknown product rather than charging the claimed price', async () => {
    getProduct.mockResolvedValue(null);

    await expect(
      repriceCheckout(db, SITE, [{ product_id: 'ghost', name: 'Ghost', price: 5, quantity: 1 }], 0)
    ).rejects.toThrow(CheckoutPricingError);
  });

  it('rejects an item with no product reference at all', async () => {
    await expect(
      repriceCheckout(db, SITE, [{ name: 'Mystery', price: 5, quantity: 1 }], 0)
    ).rejects.toThrow(CheckoutPricingError);
  });

  it.each([0, -1, 1.5, Number.NaN, 1000])('rejects quantity %p', async (quantity) => {
    getProduct.mockResolvedValue({ id: 'p1', price: 10 });

    await expect(
      repriceCheckout(db, SITE, [{ product_id: 'p1', name: 'Tee', price: 10, quantity }], 0)
    ).rejects.toThrow(CheckoutPricingError);
  });

  it('rejects a negative shipping cost', async () => {
    getProduct.mockResolvedValue({ id: 'p1', price: 10 });

    await expect(
      repriceCheckout(db, SITE, [{ product_id: 'p1', name: 'Tee', price: 10, quantity: 1 }], -50)
    ).rejects.toThrow(CheckoutPricingError);
  });

  it('adds shipping to the total but never to the taxed subtotal', async () => {
    getTax.mockResolvedValue(taxSettings({ calculationsEnabled: true, defaultRate: 8 }));
    getProduct.mockResolvedValue({ id: 'p1', price: 100 });

    const result = await repriceCheckout(
      db,
      SITE,
      [{ product_id: 'p1', name: 'Tee', price: 100, quantity: 1 }],
      15
    );

    expect(result.subtotal).toBe(100);
    expect(result.tax).toBe(8);
    expect(result.total).toBe(123);
  });

  it('sums multiple items and rounds to whole cents', async () => {
    getProduct.mockImplementation(async (_db: unknown, _site: string, id: string) =>
      id === 'p1' ? { id: 'p1', price: 10.1 } : { id: 'p2', price: 20.2 }
    );

    const result = await repriceCheckout(
      db,
      SITE,
      [
        { product_id: 'p1', name: 'A', price: 0, quantity: 3 },
        { product_id: 'p2', name: 'B', price: 0, quantity: 1 }
      ],
      0
    );

    expect(result.subtotal).toBe(50.5);
    expect(result.total).toBe(50.5);
  });

  describe('tax comes from the site, not the request', () => {
    it('charges nothing when the site has tax calculations switched off', async () => {
      getTax.mockResolvedValue(taxSettings({ calculationsEnabled: false, defaultRate: 8 }));
      getProduct.mockResolvedValue({ id: 'p1', price: 100 });

      const result = await repriceCheckout(
        db,
        SITE,
        [{ product_id: 'p1', name: 'Tee', price: 100, quantity: 1 }],
        0
      );

      expect(result.tax).toBe(0);
      expect(result.total).toBe(100);
    });

    it('charges the site’s own rate, read as a percent', async () => {
      getTax.mockResolvedValue(taxSettings({ calculationsEnabled: true, defaultRate: 8.25 }));
      getProduct.mockResolvedValue({ id: 'p1', price: 100 });

      const result = await repriceCheckout(
        db,
        SITE,
        [{ product_id: 'p1', name: 'Tee', price: 100, quantity: 1 }],
        0
      );

      expect(result.tax).toBe(8.25);
      expect(result.total).toBe(108.25);
    });

    it('gives two stores two different totals for the same cart', async () => {
      getProduct.mockResolvedValue({ id: 'p1', price: 100 });
      const cart = [{ product_id: 'p1', name: 'Tee', price: 100, quantity: 1 }];

      getTax.mockResolvedValue(taxSettings({ calculationsEnabled: true, defaultRate: 20 }));
      const uk = await repriceCheckout(db, SITE, cart, 0);

      getTax.mockResolvedValue(taxSettings({ calculationsEnabled: true, defaultRate: 8.6 }));
      const az = await repriceCheckout(db, 'site-2', cart, 0);

      expect(uk.total).toBe(120);
      expect(az.total).toBe(108.6);
    });

    it('extracts rather than adds tax when the site’s prices include it', async () => {
      getTax.mockResolvedValue(
        taxSettings({ calculationsEnabled: true, defaultRate: 20, pricesIncludeTax: true })
      );
      getProduct.mockResolvedValue({ id: 'p1', price: 120 });

      const result = await repriceCheckout(
        db,
        SITE,
        [{ product_id: 'p1', name: 'Tee', price: 120, quantity: 1 }],
        5
      );

      expect(result.subtotal).toBe(120);
      expect(result.tax).toBe(20);
      // 120 already contains the 20; only shipping is added on top.
      expect(result.total).toBe(125);
    });

    it('reports the rule it charged under', async () => {
      getTax.mockResolvedValue(taxSettings({ calculationsEnabled: true, defaultRate: 7.5 }));
      getProduct.mockResolvedValue({ id: 'p1', price: 10 });

      const result = await repriceCheckout(
        db,
        SITE,
        [{ product_id: 'p1', name: 'Tee', price: 10, quantity: 1 }],
        0
      );

      expect(result.taxRule).toEqual({
        enabled: true,
        ratePercent: 7.5,
        pricesIncludeTax: false
      });
    });

    it('charges no tax rather than a guessed rate when the settings read fails', async () => {
      getTax.mockRejectedValue(new Error('D1 unavailable'));
      getProduct.mockResolvedValue({ id: 'p1', price: 100 });

      const result = await repriceCheckout(
        db,
        SITE,
        [{ product_id: 'p1', name: 'Tee', price: 100, quantity: 1 }],
        0
      );

      expect(result.tax).toBe(0);
      expect(result.total).toBe(100);
    });

    it('reads the settings of the site it was asked about', async () => {
      getProduct.mockResolvedValue({ id: 'p1', price: 10 });

      await repriceCheckout(
        db,
        'site-42',
        [{ product_id: 'p1', name: 'Tee', price: 10, quantity: 1 }],
        0
      );

      expect(getTax).toHaveBeenCalledWith(db, 'site-42');
    });
  });

  describe('getCheckoutTaxRule', () => {
    it('reads the site’s switches and rate', async () => {
      getTax.mockResolvedValue(
        taxSettings({ calculationsEnabled: true, defaultRate: 19, pricesIncludeTax: true })
      );

      await expect(getCheckoutTaxRule(db, SITE)).resolves.toEqual({
        enabled: true,
        ratePercent: 19,
        pricesIncludeTax: true
      });
    });

    it('falls back to no tax when the settings cannot be read', async () => {
      getTax.mockRejectedValue(new Error('nope'));

      await expect(getCheckoutTaxRule(db, SITE)).resolves.toEqual({
        enabled: false,
        ratePercent: 0,
        pricesIncludeTax: false
      });
    });
  });

  it('preserves non-price fields on the item it returns', async () => {
    getProduct.mockResolvedValue({ id: 'p1', price: 30 });

    const result = await repriceCheckout(
      db,
      SITE,
      [
        {
          product_id: 'p1',
          name: 'Tee',
          price: 1,
          quantity: 1,
          customizations: [{ zone: 'front' }]
        } as never
      ],
      0
    );

    expect(result.items[0].item).toMatchObject({
      product_id: 'p1',
      name: 'Tee',
      price: 30,
      customizations: [{ zone: 'front' }]
    });
  });
});
