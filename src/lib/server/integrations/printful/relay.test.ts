import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FulfillmentRelay } from '$lib/server/db/fulfillment-relays';

const mockGetOrderById = vi.fn();
const mockGetOrderItems = vi.fn();
vi.mock('$lib/server/db/orders', () => ({
  getOrderById: (...args: unknown[]) => mockGetOrderById(...args),
  getOrderItems: (...args: unknown[]) => mockGetOrderItems(...args)
}));

const mockGetProductVariantById = vi.fn();
vi.mock('$lib/server/db/product-variants', () => ({
  getProductVariantById: (...args: unknown[]) => mockGetProductVariantById(...args)
}));

const mockGetFulfillmentProvidersByType = vi.fn();
vi.mock('$lib/server/db/fulfillment-providers', () => ({
  getFulfillmentProvidersByType: (...args: unknown[]) => mockGetFulfillmentProvidersByType(...args)
}));

const mockStorePrintfulOrder = vi.fn();
const mockGetPrintfulOrder = vi.fn();
vi.mock('./db', () => ({
  storePrintfulOrder: (...args: unknown[]) => mockStorePrintfulOrder(...args),
  getPrintfulOrder: (...args: unknown[]) => mockGetPrintfulOrder(...args)
}));

const mockCreateOrderWithPrintful = vi.fn();
const mockFindOrderByExternalId = vi.fn();
const mockFromProvider = vi.fn();
vi.mock('./service', () => ({
  PrintfulService: {
    fromProvider: (...args: unknown[]) => mockFromProvider(...args)
  }
}));

/**
 * The runner is tested on its own. Here it is a harness: it hands back the
 * `execute` callback so each Printful-specific path can be driven directly.
 */
const mockRunRelayAttempt = vi.fn();
vi.mock('$lib/server/fulfillment/relay-runner', () => ({
  runRelayAttempt: (...args: unknown[]) => mockRunRelayAttempt(...args)
}));

import { RelayFailure } from '$lib/server/fulfillment/relay-errors';
import { PrintfulApiError } from './errors';
import { relayPaidOrderToPrintful } from './relay';

const db = {} as unknown as D1Database;
const siteId = 'site-1';
const orderId = 'order-1';
const encryptionKey = 'test-key';

const mockOrder = {
  id: orderId,
  site_id: siteId,
  shipping_address: JSON.stringify({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '555-1234',
    address: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zipCode: '12345',
    country: 'United States'
  })
};

function relayRow(overrides: Partial<FulfillmentRelay> = {}): FulfillmentRelay {
  return {
    id: 'relay-1',
    site_id: siteId,
    order_id: orderId,
    provider_type: 'printful',
    status: 'pending',
    attempts: 0,
    max_attempts: 8,
    next_attempt_at: null,
    last_attempt_at: null,
    failure_kind: null,
    last_error: null,
    last_response: null,
    external_order_id: null,
    created_at: 1000,
    updated_at: 1000,
    ...overrides
  };
}

/** Run the relay and return the `execute` callback it handed the runner. */
async function captureExecute(): Promise<
  (relay: FulfillmentRelay) => Promise<{ externalOrderId: string; detail?: string }>
> {
  await relayPaidOrderToPrintful(db, siteId, orderId, encryptionKey);
  expect(mockRunRelayAttempt).toHaveBeenCalled();
  return mockRunRelayAttempt.mock.calls[0][1].execute;
}

describe('relayPaidOrderToPrintful', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunRelayAttempt.mockResolvedValue({
      outcome: 'succeeded',
      externalOrderId: '555',
      attempts: 1
    });
    mockFromProvider.mockResolvedValue({
      createOrderWithPrintful: mockCreateOrderWithPrintful,
      findOrderByExternalId: mockFindOrderByExternalId
    });
    mockGetOrderById.mockResolvedValue(mockOrder);
    mockGetPrintfulOrder.mockResolvedValue(null);
    mockGetFulfillmentProvidersByType.mockResolvedValue([{ id: 'provider-1' }]);
    mockGetProductVariantById.mockResolvedValue({ printful_sync_variant_id: 999 });
    mockGetOrderItems.mockResolvedValue([{ variant_id: 'variant-1', quantity: 2 }]);
  });

  describe('orders that are not Printful’s to make', () => {
    it('starts no relay when the order does not exist', async () => {
      mockGetOrderById.mockResolvedValue(null);

      expect(await relayPaidOrderToPrintful(db, siteId, orderId, encryptionKey)).toBeNull();
      expect(mockRunRelayAttempt).not.toHaveBeenCalled();
    });

    it('starts no relay when no line has a variant', async () => {
      mockGetOrderItems.mockResolvedValue([{ variant_id: null, quantity: 1 }]);

      expect(await relayPaidOrderToPrintful(db, siteId, orderId, encryptionKey)).toBeNull();
      expect(mockRunRelayAttempt).not.toHaveBeenCalled();
    });

    it('starts no relay when no variant maps to a Printful sync variant', async () => {
      mockGetProductVariantById.mockResolvedValue({ printful_sync_variant_id: null });

      expect(await relayPaidOrderToPrintful(db, siteId, orderId, encryptionKey)).toBeNull();
      expect(mockRunRelayAttempt).not.toHaveBeenCalled();
    });

    it('never throws when the pre-flight reads fail', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetOrderById.mockRejectedValue(new Error('D1 is down'));

      expect(await relayPaidOrderToPrintful(db, siteId, orderId, encryptionKey)).toBeNull();
    });
  });

  describe('placing the order', () => {
    it('sends only the lines Printful is responsible for', async () => {
      mockGetOrderItems.mockResolvedValue([
        { variant_id: 'variant-1', quantity: 2 },
        { variant_id: null, quantity: 1 } // non-Printful line, ignored
      ]);
      mockCreateOrderWithPrintful.mockResolvedValue({ id: 555 });

      const execute = await captureExecute();
      const result = await execute(relayRow());

      expect(mockCreateOrderWithPrintful).toHaveBeenCalledWith({
        external_id: orderId,
        shipping: 'standard',
        items: [{ sync_variant_id: 999, quantity: 2 }],
        recipient: {
          name: 'John Doe',
          address1: '123 Main St',
          city: 'Anytown',
          state_code: 'CA',
          country_code: 'US',
          zip: '12345',
          phone: '555-1234',
          email: 'john@example.com'
        }
      });
      expect(result.externalOrderId).toBe('555');
      expect(mockStorePrintfulOrder).toHaveBeenCalledWith(
        db,
        siteId,
        orderId,
        555,
        expect.any(String)
      );
    });

    it('relays a country the old six-option form could never have taken', async () => {
      mockGetOrderItems.mockResolvedValue([{ variant_id: 'variant-1', quantity: 1 }]);
      mockCreateOrderWithPrintful.mockResolvedValue({ id: 556 });
      mockGetOrderById.mockResolvedValue({
        ...mockOrder,
        shipping_address: JSON.stringify({
          firstName: 'Aiko',
          lastName: 'Tanaka',
          email: 'aiko@example.com',
          address: '1-1 Chiyoda',
          city: 'Tokyo',
          zipCode: '100-0001',
          country: 'JP'
        })
      });

      const execute = await captureExecute();
      await execute(relayRow());

      expect(mockCreateOrderWithPrintful).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: expect.objectContaining({ country_code: 'JP', city: 'Tokyo' })
        })
      );
    });

    it('relays under the site and provider the relay row names', async () => {
      await relayPaidOrderToPrintful(db, siteId, orderId, encryptionKey);

      expect(mockRunRelayAttempt.mock.calls[0][1]).toMatchObject({
        siteId,
        orderId,
        providerType: 'printful',
        providerLabel: 'Printful'
      });
    });
  });

  describe('idempotency', () => {
    it('does not place the order again when one is already recorded locally', async () => {
      mockGetPrintfulOrder.mockResolvedValue({ printful_order_id: 777 });

      const execute = await captureExecute();
      const result = await execute(relayRow({ attempts: 2 }));

      expect(result.externalOrderId).toBe('777');
      expect(mockCreateOrderWithPrintful).not.toHaveBeenCalled();
      expect(mockFindOrderByExternalId).not.toHaveBeenCalled();
    });

    it('adopts an order a previous attempt managed to create', async () => {
      mockFindOrderByExternalId.mockResolvedValue({ id: 888, external_id: orderId });

      const execute = await captureExecute();
      const result = await execute(relayRow({ attempts: 1 }));

      expect(mockFindOrderByExternalId).toHaveBeenCalledWith(orderId);
      expect(mockCreateOrderWithPrintful).not.toHaveBeenCalled();
      expect(result.externalOrderId).toBe('888');
      expect(mockStorePrintfulOrder).toHaveBeenCalledWith(
        db,
        siteId,
        orderId,
        888,
        expect.any(String)
      );
    });

    it('does not ask Printful for an existing order on the first attempt', async () => {
      mockCreateOrderWithPrintful.mockResolvedValue({ id: 555 });

      const execute = await captureExecute();
      await execute(relayRow({ attempts: 0 }));

      expect(mockFindOrderByExternalId).not.toHaveBeenCalled();
    });

    it('retries rather than risking a duplicate when the lookup itself fails', async () => {
      mockFindOrderByExternalId.mockRejectedValue(
        new PrintfulApiError('HTTP 503: Service Unavailable', { status: 503 })
      );

      const execute = await captureExecute();
      const failure = await execute(relayRow({ attempts: 1 })).catch((error) => error);

      expect(failure).toBeInstanceOf(RelayFailure);
      expect((failure as RelayFailure).kind).toBe('transient');
      expect(mockCreateOrderWithPrintful).not.toHaveBeenCalled();
    });
  });

  describe('failures', () => {
    it('dead-letters when no Printful provider is connected', async () => {
      mockGetFulfillmentProvidersByType.mockResolvedValue([]);

      const execute = await captureExecute();
      const failure = await execute(relayRow()).catch((error) => error);

      expect(failure).toBeInstanceOf(RelayFailure);
      expect((failure as RelayFailure).kind).toBe('permanent');
      expect((failure as RelayFailure).message).toContain('No Printful provider is connected');
    });

    it('dead-letters an address Printful cannot be given a country code for', async () => {
      mockGetOrderById.mockResolvedValue({
        ...mockOrder,
        shipping_address: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          address: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'Wakanda'
        })
      });

      const execute = await captureExecute();
      const failure = await execute(relayRow()).catch((error) => error);

      expect((failure as RelayFailure).kind).toBe('permanent');
      expect((failure as RelayFailure).message).toContain('Wakanda');
      expect(mockCreateOrderWithPrintful).not.toHaveBeenCalled();
    });

    it('dead-letters the literal "Other" the old checkout form offered', async () => {
      mockGetOrderById.mockResolvedValue({
        ...mockOrder,
        shipping_address: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          address: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'Other'
        })
      });

      const execute = await captureExecute();
      const failure = await execute(relayRow()).catch((error) => error);

      expect((failure as RelayFailure).kind).toBe('permanent');
      expect((failure as RelayFailure).message).toContain('Other');
      expect(mockCreateOrderWithPrintful).not.toHaveBeenCalled();
    });

    it('retries a rate limit', async () => {
      mockCreateOrderWithPrintful.mockRejectedValue(
        new PrintfulApiError('HTTP 429: Too Many Requests', {
          status: 429,
          body: '{"code":429}'
        })
      );

      const execute = await captureExecute();
      const failure = await execute(relayRow()).catch((error) => error);

      expect((failure as RelayFailure).kind).toBe('transient');
      expect((failure as RelayFailure).response).toBe('{"code":429}');
    });

    it('gives up on an order Printful refuses', async () => {
      mockCreateOrderWithPrintful.mockRejectedValue(
        new PrintfulApiError('Variant is unavailable', { status: 422, body: '{"code":422}' })
      );

      const execute = await captureExecute();
      const failure = await execute(relayRow()).catch((error) => error);

      expect((failure as RelayFailure).kind).toBe('permanent');
      expect((failure as RelayFailure).message).toBe('Variant is unavailable');
    });

    it('does not record a Printful order when the call failed', async () => {
      mockCreateOrderWithPrintful.mockRejectedValue(new Error('Printful API error'));

      const execute = await captureExecute();
      await execute(relayRow()).catch(() => undefined);

      expect(mockStorePrintfulOrder).not.toHaveBeenCalled();
    });
  });
});
