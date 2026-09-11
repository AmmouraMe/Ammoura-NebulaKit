import { describe, it, expect, vi, beforeEach } from 'vitest';
import { repriceCheckout, CheckoutPricingError } from './checkout-pricing';

vi.mock('./db/products.js', () => ({ getProductById: vi.fn() }));
vi.mock('./db/product-variants.js', () => ({ getProductVariantById: vi.fn() }));
vi.mock('./db/site-settings.js', () => ({ getTaxSettings: vi.fn() }));

const { getProductById } = await import('./db/products.js');
const { getProductVariantById } = await import('./db/product-variants.js');
const { getTaxSettings } = await import('./db/site-settings.js');

const getProduct = getProductById as ReturnType<typeof vi.fn>;
const getVariant = getProductVariantById as ReturnType<typeof vi.fn>;
const getTax = getTaxSettings as ReturnType<typeof vi.fn>;

const db = {} as D1Database;
const SITE = 'site-1';

/** The site charges tax at `percent`; `null` leaves calculations switched off. */
function siteTax(percent: number | null) {
  getTax.mockResolvedValue({
    calculationsEnabled: percent !== null,
    pricesIncludeTax: false,
    displayPricesWithTax: false,
    defaultRate: percent ?? 0,
    taxClasses: []
  });
}

describe('repriceCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    siteTax(8);
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
    expect(result.total).toBe(200 + 200 * 0.08);
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
    expect(result.total).toBe(54.54);
  });

  it('charges the site its own rate, not a platform-wide one', async () => {
    getProduct.mockResolvedValue({ id: 'p1', price: 100 });
    siteTax(8.25);

    const result = await repriceCheckout(
      db,
      SITE,
      [{ product_id: 'p1', name: 'Tee', price: 100, quantity: 1 }],
      0
    );

    expect(getTax).toHaveBeenCalledWith(db, SITE);
    expect(result.taxRate).toBe(0.0825);
    expect(result.tax).toBe(8.25);
    expect(result.total).toBe(108.25);
  });

  it('charges no tax when the site has not enabled calculations', async () => {
    getProduct.mockResolvedValue({ id: 'p1', price: 100 });
    siteTax(null);

    const result = await repriceCheckout(
      db,
      SITE,
      [{ product_id: 'p1', name: 'Tee', price: 100, quantity: 1 }],
      15
    );

    expect(result.taxRate).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.total).toBe(115);
  });

  it('ignores a rate the site left at zero even with calculations on', async () => {
    getProduct.mockResolvedValue({ id: 'p1', price: 100 });
    siteTax(0);

    const result = await repriceCheckout(
      db,
      SITE,
      [{ product_id: 'p1', name: 'Tee', price: 100, quantity: 1 }],
      0
    );

    expect(result.tax).toBe(0);
    expect(result.total).toBe(100);
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
