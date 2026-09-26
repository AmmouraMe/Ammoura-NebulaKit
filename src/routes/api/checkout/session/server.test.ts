import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/db/connection', () => ({ getDB: vi.fn(() => ({}) as D1Database) }));
vi.mock('$lib/server/db/orders', () => ({
  createOrder: vi.fn(),
  setOrderStripeSession: vi.fn()
}));
vi.mock('$lib/server/db/equipment', () => ({ saveEquipmentValuesForOrderItems: vi.fn() }));
vi.mock('$lib/server/db/site-settings', () => ({ getPaymentSettings: vi.fn() }));
vi.mock('$lib/server/checkout-pricing', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/checkout-pricing')>(
    '$lib/server/checkout-pricing'
  );
  return { ...actual, repriceCheckout: vi.fn() };
});
vi.mock('$lib/server/integrations/stripe/client', () => ({ getStripeClient: vi.fn() }));

const { POST } = await import('./+server');
const { createOrder } = await import('$lib/server/db/orders');
const { getPaymentSettings } = await import('$lib/server/db/site-settings');
const { repriceCheckout } = await import('$lib/server/checkout-pricing');
const { getStripeClient } = await import('$lib/server/integrations/stripe/client');

const createOrderMock = createOrder as ReturnType<typeof vi.fn>;
const getPaymentSettingsMock = getPaymentSettings as ReturnType<typeof vi.fn>;
const repriceMock = repriceCheckout as ReturnType<typeof vi.fn>;
const getStripeMock = getStripeClient as ReturnType<typeof vi.fn>;

const sessionsCreate = vi.fn();

const address = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '555-0100',
  address: '1 Analytical Way',
  city: 'London',
  state: '',
  zipCode: 'W1',
  country: 'GB'
};

function request(body: Record<string, unknown> = {}) {
  return {
    request: {
      json: async () => ({
        items: [{ product_id: 'p1', name: 'Tee', price: 100, quantity: 1, image: '' }],
        shipping_cost: 0,
        shipping_address: { ...address },
        billing_address: { ...address },
        ...body
      })
    },
    platform: { env: { DB: {}, ENCRYPTION_KEY: 'k' } },
    locals: { siteId: 'site-1', currentUser: { id: 'u1' } },
    url: new URL('https://shop.example/checkout')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/** What `repriceCheckout` would return for one $100 tee under `taxRule`. */
function priced(tax: number, total: number, taxRule: Record<string, unknown>) {
  return {
    items: [{ item: { name: 'Tee', price: 100, quantity: 1 }, lineTotal: 100 }],
    subtotal: 100,
    tax,
    total,
    taxRule
  };
}

function lineItemCents() {
  const lines = sessionsCreate.mock.calls[0][0].line_items;
  return lines.reduce(
    (sum: number, l: { price_data: { unit_amount: number }; quantity: number }) =>
      sum + l.price_data.unit_amount * l.quantity,
    0
  );
}

describe('POST /api/checkout/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPaymentSettingsMock.mockResolvedValue({
      stripeEnabled: true,
      stripeSecretKey: 'sk_test'
    });
    createOrderMock.mockResolvedValue({ id: 'order-1' });
    sessionsCreate.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/pay' });
    getStripeMock.mockReturnValue({ checkout: { sessions: { create: sessionsCreate } } });
  });

  it('charges a tax-exclusive store’s tax as its own line', async () => {
    repriceMock.mockResolvedValue(
      priced(8, 108, { enabled: true, ratePercent: 8, pricesIncludeTax: false })
    );

    const response = await POST(request());
    expect(response.status).toBe(200);

    const names = sessionsCreate.mock.calls[0][0].line_items.map(
      (l: { price_data: { product_data: { name: string } } }) => l.price_data.product_data.name
    );
    expect(names).toContain('Tax');
    expect(lineItemCents()).toBe(10800);
  });

  it('never adds a Tax line when the price already contains it', async () => {
    // The whole point: 120 inclusive of 20 tax must charge 120, not 140.
    repriceMock.mockResolvedValue(
      priced(20, 100, { enabled: true, ratePercent: 20, pricesIncludeTax: true })
    );

    await POST(request());

    const names = sessionsCreate.mock.calls[0][0].line_items.map(
      (l: { price_data: { product_data: { name: string } } }) => l.price_data.product_data.name
    );
    expect(names).not.toContain('Tax');
    expect(lineItemCents()).toBe(10000);
  });

  it('adds no Tax line for a store that charges no tax', async () => {
    repriceMock.mockResolvedValue(
      priced(0, 100, { enabled: false, ratePercent: 0, pricesIncludeTax: false })
    );

    await POST(request());

    expect(sessionsCreate.mock.calls[0][0].line_items).toHaveLength(1);
    expect(lineItemCents()).toBe(10000);
  });

  it('refuses rather than charging when the line items and the order total disagree', async () => {
    // A repricing that claims a total the line items cannot add up to.
    repriceMock.mockResolvedValue(
      priced(0, 999, { enabled: false, ratePercent: 0, pricesIncludeTax: false })
    );

    await expect(POST(request())).rejects.toMatchObject({ status: 500 });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('refuses a shipping country it cannot resolve, before any charge', async () => {
    await expect(
      POST(request({ shipping_address: { ...address, country: 'Other' } }))
    ).rejects.toMatchObject({ status: 400 });
    expect(repriceMock).not.toHaveBeenCalled();
    expect(createOrderMock).not.toHaveBeenCalled();
  });
});
