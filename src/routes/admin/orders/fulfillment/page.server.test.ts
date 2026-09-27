import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/db/connection', () => ({
  getDB: vi.fn(() => ({ tag: 'db' }))
}));

const mockGetUnsettledRelays = vi.fn();
const mockGetRecentSucceededRelays = vi.fn();
const mockGetUntrackedPaidOrders = vi.fn();
const mockGetFulfillmentRelay = vi.fn();
const mockReopenRelay = vi.fn();
vi.mock('$lib/server/db/fulfillment-relays', () => ({
  getUnsettledRelays: (...args: unknown[]) => mockGetUnsettledRelays(...args),
  getRecentSucceededRelays: (...args: unknown[]) => mockGetRecentSucceededRelays(...args),
  getUntrackedPaidOrders: (...args: unknown[]) => mockGetUntrackedPaidOrders(...args),
  getFulfillmentRelay: (...args: unknown[]) => mockGetFulfillmentRelay(...args),
  reopenRelay: (...args: unknown[]) => mockReopenRelay(...args)
}));

const mockGetOrderById = vi.fn();
const mockUpdateOrderShippingAddress = vi.fn();
vi.mock('$lib/server/db/orders', () => ({
  getOrderById: (...args: unknown[]) => mockGetOrderById(...args),
  updateOrderShippingAddress: (...args: unknown[]) => mockUpdateOrderShippingAddress(...args)
}));

const mockRelayPaidOrderToPrintful = vi.fn();
vi.mock('$lib/server/integrations/printful/relay', () => ({
  PRINTFUL_PROVIDER_TYPE: 'printful',
  relayPaidOrderToPrintful: (...args: unknown[]) => mockRelayPaidOrderToPrintful(...args)
}));

import { load, actions } from './+page.server';

const adminUser = {
  id: 'user-1',
  role: 'admin',
  permissions: '[]',
  status: 'active'
};

const customerUser = {
  id: 'user-2',
  role: 'customer',
  permissions: '[]',
  status: 'active'
};

const relayRow = {
  id: 'relay-1',
  site_id: 'site-1',
  order_id: 'order-1',
  provider_type: 'printful',
  status: 'dead_lettered',
  attempts: 8,
  max_attempts: 8,
  next_attempt_at: null,
  last_attempt_at: 2000,
  failure_kind: 'permanent',
  last_error: 'Variant unavailable',
  last_response: '{"code":422}',
  external_order_id: null,
  created_at: 1000,
  updated_at: 2000
};

const order = {
  id: 'order-1',
  total: 42.5,
  shipping_address: JSON.stringify({ email: 'john@example.com' })
};

function loadEvent(user: unknown = adminUser) {
  return {
    platform: { env: { DB: {}, ENCRYPTION_KEY: 'key' } },
    locals: { siteId: 'site-1', currentUser: user }
  } as never;
}

interface FulfillmentPageData {
  relays: Array<{
    orderId: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    lastResponse: string | null;
    orderTotal: number | null;
    customerEmail: string | null;
    shippingAddress: Record<string, string> | null;
  }>;
  recentlyFulfilled: unknown[];
  untrackedOrders: Array<{ id: string; total: number; createdAt: number }>;
}

/** `load` is typed as possibly returning void; the tests only run the path that returns data. */
async function runLoad(user: unknown = adminUser): Promise<FulfillmentPageData> {
  return (await load(loadEvent(user))) as unknown as FulfillmentPageData;
}

function actionEvent(fields: Record<string, string>, user: unknown = adminUser, env?: unknown) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return {
    request: { formData: async () => formData } as unknown as Request,
    platform: { env: env ?? { DB: {}, ENCRYPTION_KEY: 'key' } },
    locals: { siteId: 'site-1', currentUser: user }
  } as never;
}

describe('/admin/orders/fulfillment load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUnsettledRelays.mockResolvedValue([relayRow]);
    mockGetRecentSucceededRelays.mockResolvedValue([]);
    mockGetUntrackedPaidOrders.mockResolvedValue([]);
    mockGetOrderById.mockResolvedValue(order);
  });

  it('rejects a request with no session', async () => {
    await expect(load(loadEvent(null))).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a user without order read permission', async () => {
    await expect(load(loadEvent(customerUser))).rejects.toMatchObject({ status: 403 });
  });

  it('reads only this site’s relays', async () => {
    await load(loadEvent());

    expect(mockGetUnsettledRelays).toHaveBeenCalledWith({ tag: 'db' }, 'site-1');
    expect(mockGetUntrackedPaidOrders).toHaveBeenCalledWith({ tag: 'db' }, 'site-1');
  });

  it('shows the error, the attempt count and the raw provider response', async () => {
    const result = await runLoad();

    expect(result.relays[0]).toMatchObject({
      orderId: 'order-1',
      status: 'dead_lettered',
      attempts: 8,
      maxAttempts: 8,
      lastError: 'Variant unavailable',
      lastResponse: '{"code":422}',
      orderTotal: 42.5,
      customerEmail: 'john@example.com'
    });
  });

  it('survives an order whose address will not parse', async () => {
    mockGetOrderById.mockResolvedValue({ ...order, shipping_address: 'not json' });

    const result = await runLoad();

    expect(result.relays[0].customerEmail).toBeNull();
  });

  it('offers the address for editing on a dead-lettered relay', async () => {
    mockGetOrderById.mockResolvedValue({
      ...order,
      shipping_address: JSON.stringify({
        email: 'john@example.com',
        city: 'Leeds',
        country: 'Other'
      })
    });

    const result = await runLoad();

    expect(result.relays[0].shippingAddress).toMatchObject({
      city: 'Leeds',
      country: 'Other',
      address: ''
    });
  });

  it('does not offer the address on a relay that is still retrying', async () => {
    mockGetUnsettledRelays.mockResolvedValue([{ ...relayRow, status: 'pending' }]);

    const result = await runLoad();

    expect(result.relays[0].shippingAddress).toBeNull();
  });

  it('lists paid orders that were never relayed at all', async () => {
    mockGetUntrackedPaidOrders.mockResolvedValue([{ id: 'order-9', total: 10, created_at: 5 }]);

    const result = await runLoad();

    expect(result.untrackedOrders).toEqual([{ id: 'order-9', total: 10, createdAt: 5 }]);
  });
});

describe('/admin/orders/fulfillment retry action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFulfillmentRelay.mockResolvedValue(relayRow);
    mockReopenRelay.mockResolvedValue(true);
    mockRelayPaidOrderToPrintful.mockResolvedValue({
      outcome: 'succeeded',
      externalOrderId: '555',
      attempts: 9
    });
  });

  it('rejects a user without order write permission', async () => {
    await expect(
      actions.retry(actionEvent({ relayId: 'relay-1', orderId: 'order-1' }, customerUser))
    ).rejects.toMatchObject({ status: 403 });
  });

  it('reopens a dead-lettered relay before retrying it', async () => {
    const result = await actions.retry(actionEvent({ relayId: 'relay-1', orderId: 'order-1' }));

    expect(mockReopenRelay).toHaveBeenCalledWith({ tag: 'db' }, 'site-1', 'relay-1', 3);
    expect(mockRelayPaidOrderToPrintful).toHaveBeenCalledWith(
      { tag: 'db' },
      'site-1',
      'order-1',
      'key'
    );
    expect(result).toMatchObject({ success: true });
  });

  it('does not reopen a relay that is still retrying on its own', async () => {
    mockGetFulfillmentRelay.mockResolvedValue({ ...relayRow, status: 'pending' });

    await actions.retry(actionEvent({ relayId: 'relay-1', orderId: 'order-1' }));

    expect(mockReopenRelay).not.toHaveBeenCalled();
    expect(mockRelayPaidOrderToPrintful).toHaveBeenCalled();
  });

  it('refuses a relay that belongs to another site', async () => {
    mockGetFulfillmentRelay.mockResolvedValue(null);

    const result = await actions.retry(actionEvent({ relayId: 'relay-1', orderId: 'order-1' }));

    expect(result).toMatchObject({ status: 404 });
    expect(mockRelayPaidOrderToPrintful).not.toHaveBeenCalled();
  });

  it('refuses a relay id that does not match the order', async () => {
    const result = await actions.retry(actionEvent({ relayId: 'other-relay', orderId: 'order-1' }));

    expect(result).toMatchObject({ status: 404 });
    expect(mockRelayPaidOrderToPrintful).not.toHaveBeenCalled();
  });

  it('refuses a request with no relay named', async () => {
    const result = await actions.retry(actionEvent({}));

    expect(result).toMatchObject({ status: 400 });
  });

  it('reports a failed retry as a failure the operator can read', async () => {
    mockRelayPaidOrderToPrintful.mockResolvedValue({
      outcome: 'dead_lettered',
      failureKind: 'permanent',
      error: 'Variant unavailable',
      attempts: 9
    });

    const result = await actions.retry(actionEvent({ relayId: 'relay-1', orderId: 'order-1' }));

    expect(result).toMatchObject({ status: 422 });
    expect(JSON.stringify(result)).toContain('Variant unavailable');
  });

  it('treats an order that had already arrived as a success', async () => {
    mockRelayPaidOrderToPrintful.mockResolvedValue({
      outcome: 'skipped',
      reason: 'already_succeeded'
    });

    const result = await actions.retry(actionEvent({ relayId: 'relay-1', orderId: 'order-1' }));

    expect(result).toMatchObject({ success: true });
  });

  it('stops when there is no encryption key to decrypt the provider config', async () => {
    const result = await actions.retry(
      actionEvent({ relayId: 'relay-1', orderId: 'order-1' }, adminUser, { DB: {} })
    );

    expect(result).toMatchObject({ status: 500 });
    expect(mockRelayPaidOrderToPrintful).not.toHaveBeenCalled();
  });
});

describe('/admin/orders/fulfillment relayOrder action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrderById.mockResolvedValue(order);
    mockRelayPaidOrderToPrintful.mockResolvedValue({
      outcome: 'succeeded',
      externalOrderId: '555',
      attempts: 1
    });
  });

  it('relays an order that had no relay record', async () => {
    const result = await actions.relayOrder(actionEvent({ orderId: 'order-1' }));

    expect(mockRelayPaidOrderToPrintful).toHaveBeenCalledWith(
      { tag: 'db' },
      'site-1',
      'order-1',
      'key'
    );
    expect(result).toMatchObject({ success: true });
  });

  it('refuses an order that belongs to another site', async () => {
    mockGetOrderById.mockResolvedValue(null);

    const result = await actions.relayOrder(actionEvent({ orderId: 'order-1' }));

    expect(result).toMatchObject({ status: 404 });
    expect(mockRelayPaidOrderToPrintful).not.toHaveBeenCalled();
  });

  it('says so when the order has nothing Printful can make', async () => {
    mockRelayPaidOrderToPrintful.mockResolvedValue(null);

    const result = await actions.relayOrder(actionEvent({ orderId: 'order-1' }));

    expect(result).toMatchObject({ status: 422 });
    expect(JSON.stringify(result)).toContain('nothing to relay');
  });

  it('rejects a user without order write permission', async () => {
    await expect(
      actions.relayOrder(actionEvent({ orderId: 'order-1' }, customerUser))
    ).rejects.toMatchObject({ status: 403 });
  });

  it('refuses a request with no order named', async () => {
    const result = await actions.relayOrder(actionEvent({}));

    expect(result).toMatchObject({ status: 400 });
  });
});

describe('/admin/orders/fulfillment updateAddress action', () => {
  const storedAddress = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '555-0100',
    address: '1 Old Road',
    city: 'Leeds',
    state: '',
    zipCode: 'LS1 1AA',
    country: 'Other'
  };

  const fields = {
    relayId: 'relay-1',
    orderId: 'order-1',
    firstName: 'John',
    lastName: 'Doe',
    phone: '555-0100',
    address: '  1 New Road ',
    city: 'Leeds',
    state: '',
    zipCode: 'LS1 1AA',
    country: 'GB'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFulfillmentRelay.mockResolvedValue(relayRow);
    mockGetOrderById.mockResolvedValue({
      ...order,
      shipping_address: JSON.stringify(storedAddress)
    });
    mockUpdateOrderShippingAddress.mockResolvedValue(true);
  });

  it('saves the corrected address, keeping the email, without retrying', async () => {
    const result = await actions.updateAddress(actionEvent(fields));

    expect(mockUpdateOrderShippingAddress).toHaveBeenCalledWith(
      { tag: 'db' },
      'site-1',
      'order-1',
      { ...storedAddress, address: '1 New Road', country: 'GB' }
    );
    expect(mockRelayPaidOrderToPrintful).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true });
  });

  it('stores a country name as its ISO code', async () => {
    await actions.updateAddress(actionEvent({ ...fields, country: 'United Kingdom' }));

    expect(mockUpdateOrderShippingAddress.mock.calls[0][3]).toMatchObject({ country: 'GB' });
  });

  it('refuses a country Printful cannot ship to', async () => {
    const result = await actions.updateAddress(actionEvent({ ...fields, country: 'Other' }));

    expect(result).toMatchObject({ status: 400 });
    expect(JSON.stringify(result)).toContain('Other');
    expect(mockUpdateOrderShippingAddress).not.toHaveBeenCalled();
  });

  it('names every missing part of the address', async () => {
    const result = await actions.updateAddress(
      actionEvent({ ...fields, firstName: '', lastName: ' ', city: '', zipCode: '' })
    );

    expect(result).toMatchObject({ status: 400 });
    const text = JSON.stringify(result);
    expect(text).toContain('name');
    expect(text).toContain('city');
    expect(text).toContain('postal code');
    expect(mockUpdateOrderShippingAddress).not.toHaveBeenCalled();
  });

  it('refuses a relay that is still retrying on its own', async () => {
    mockGetFulfillmentRelay.mockResolvedValue({ ...relayRow, status: 'pending' });

    const result = await actions.updateAddress(actionEvent(fields));

    expect(result).toMatchObject({ status: 409 });
    expect(mockUpdateOrderShippingAddress).not.toHaveBeenCalled();
  });

  it('refuses a relay that belongs to another site', async () => {
    mockGetFulfillmentRelay.mockResolvedValue(null);

    const result = await actions.updateAddress(actionEvent(fields));

    expect(result).toMatchObject({ status: 404 });
    expect(mockUpdateOrderShippingAddress).not.toHaveBeenCalled();
  });

  it('refuses a request with no relay named', async () => {
    const result = await actions.updateAddress(actionEvent({}));

    expect(result).toMatchObject({ status: 400 });
  });

  it('rejects a user without order write permission', async () => {
    await expect(actions.updateAddress(actionEvent(fields, customerUser))).rejects.toMatchObject({
      status: 403
    });
  });
});
