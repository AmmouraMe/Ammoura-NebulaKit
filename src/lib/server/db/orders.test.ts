import { describe, it, expect, vi } from 'vitest';
import {
  getOrderById,
  getAllOrders,
  getOrdersByUser,
  getOrderItems,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  getOrderByStripeSessionId,
  setOrderStripeSession,
  markOrderPaid,
  updateOrderShippingAddress,
  type DBOrder,
  type DBOrderItem,
  type CreateOrderData
} from './orders';

describe('Orders Repository', () => {
  const siteId = 'test-site';
  const mockOrder: DBOrder = {
    id: 'order-1',
    site_id: siteId,
    user_id: 'user-1',
    status: 'pending',
    payment_status: 'unpaid',
    stripe_session_id: null,
    stripe_payment_intent_id: null,
    subtotal: 100,
    shipping_cost: 10,
    tax: 5,
    total: 115,
    shipping_address: '123 Main St',
    billing_address: '123 Main St',
    payment_method: 'stripe',
    shipping_details: '{}',
    created_at: Date.now(),
    updated_at: Date.now()
  };

  const mockOrderItem: DBOrderItem = {
    id: 'item-1',
    order_id: 'order-1',
    product_id: 'product-1',
    variant_id: null,
    name: 'Test Product',
    price: 50.0,
    quantity: 2,
    image: 'test.jpg',
    created_at: 1234567890
  };

  describe('getOrderById', () => {
    it('should get order by ID scoped by site', async () => {
      const mockFirst = vi.fn().mockResolvedValue(mockOrder);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await getOrderById(mockDB, siteId, 'order-1');

      expect(mockPrepare).toHaveBeenCalledWith('SELECT * FROM orders WHERE id = ? AND site_id = ?');
      expect(mockBind).toHaveBeenCalledWith('order-1', siteId);
      expect(result).toEqual(mockOrder);
    });

    it('should return null when order not found', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await getOrderById(mockDB, siteId, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAllOrders', () => {
    it('should get all orders for a site', async () => {
      const mockResults = { results: [mockOrder], success: true };
      const mockAll = vi.fn().mockResolvedValue(mockResults);
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await getAllOrders(mockDB, siteId);

      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT * FROM orders WHERE site_id = ? ORDER BY created_at DESC'
      );
      expect(mockBind).toHaveBeenCalledWith(siteId);
      expect(result).toEqual([mockOrder]);
    });

    it('should return empty array when no orders found', async () => {
      const mockResults = { results: [], success: true };
      const mockAll = vi.fn().mockResolvedValue(mockResults);
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await getAllOrders(mockDB, siteId);

      expect(result).toEqual([]);
    });
  });

  describe('getOrdersByUser', () => {
    it('should get orders by user scoped by site', async () => {
      const mockResults = { results: [mockOrder], success: true };
      const mockAll = vi.fn().mockResolvedValue(mockResults);
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await getOrdersByUser(mockDB, siteId, 'user-1');

      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT * FROM orders WHERE site_id = ? AND user_id = ? ORDER BY created_at DESC'
      );
      expect(mockBind).toHaveBeenCalledWith(siteId, 'user-1');
      expect(result).toEqual([mockOrder]);
    });

    it('should return empty array when no orders found for user', async () => {
      const mockResults = { results: [], success: true };
      const mockAll = vi.fn().mockResolvedValue(mockResults);
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await getOrdersByUser(mockDB, siteId, 'user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getOrderItems', () => {
    it('should get order items for an order', async () => {
      const mockResults = { results: [mockOrderItem], success: true };
      const mockAll = vi.fn().mockResolvedValue(mockResults);
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await getOrderItems(mockDB, 'order-1');

      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at'
      );
      expect(mockBind).toHaveBeenCalledWith('order-1');
      expect(result).toEqual([mockOrderItem]);
    });

    it('should return empty array when no items found', async () => {
      const mockResults = { results: [], success: true };
      const mockAll = vi.fn().mockResolvedValue(mockResults);
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await getOrderItems(mockDB, 'order-1');

      expect(result).toEqual([]);
    });
  });

  describe('createOrder', () => {
    it('should create order with items', async () => {
      const orderData: CreateOrderData = {
        user_id: 'user-1',
        items: [
          {
            product_id: 'product-1',
            name: 'Test Product',
            price: 50.0,
            quantity: 2,
            image: 'test.jpg'
          }
        ],
        subtotal: 100.0,
        shipping_cost: 10.0,
        tax: 5.0,
        total: 115.0,
        shipping_address: { street: '123 Main St' },
        billing_address: { street: '123 Main St' },
        payment_method: { type: 'credit-card' }
      };

      const mockResults = [
        { results: [], success: true },
        { results: [], success: true }
      ];
      const mockBatch = vi.fn().mockResolvedValue(mockResults);
      const mockFirst = vi.fn().mockResolvedValue(mockOrder);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });

      const mockDB = {
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: mockBatch
      } as unknown as D1Database;

      const result = await createOrder(mockDB, siteId, orderData);

      expect(mockBatch).toHaveBeenCalled();
      expect(result).toEqual(mockOrder);
    });

    it('should create order without user_id', async () => {
      const orderData: CreateOrderData = {
        items: [
          {
            name: 'Test Product',
            price: 50.0,
            quantity: 2,
            image: 'test.jpg'
          }
        ],
        subtotal: 100.0,
        shipping_cost: 10.0,
        tax: 5.0,
        total: 115.0,
        shipping_address: { street: '123 Main St' },
        billing_address: { street: '123 Main St' },
        payment_method: { type: 'credit-card' }
      };

      const mockResults = [{ results: [], success: true }];
      const mockBatch = vi.fn().mockResolvedValue(mockResults);
      const mockFirst = vi.fn().mockResolvedValue(mockOrder);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });

      const mockDB = {
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: mockBatch
      } as unknown as D1Database;

      const result = await createOrder(mockDB, siteId, orderData);

      expect(result).toEqual(mockOrder);
    });

    it('should create order with multiple items', async () => {
      const orderData: CreateOrderData = {
        user_id: 'user-1',
        items: [
          {
            product_id: 'product-1',
            name: 'Product 1',
            price: 50.0,
            quantity: 1,
            image: 'test1.jpg'
          },
          {
            product_id: 'product-2',
            name: 'Product 2',
            price: 75.0,
            quantity: 1,
            image: 'test2.jpg'
          }
        ],
        subtotal: 125.0,
        shipping_cost: 10.0,
        tax: 6.25,
        total: 141.25,
        shipping_address: { street: '123 Main St' },
        billing_address: { street: '123 Main St' },
        payment_method: { type: 'credit-card' }
      };

      const mockResults = [
        { results: [], success: true },
        { results: [], success: true },
        { results: [], success: true }
      ];
      const mockBatch = vi.fn().mockResolvedValue(mockResults);
      const mockFirst = vi.fn().mockResolvedValue(mockOrder);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });

      const mockDB = {
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: mockBatch
      } as unknown as D1Database;

      const result = await createOrder(mockDB, siteId, orderData);

      expect(result).toEqual(mockOrder);
    });

    it('should throw error when order creation fails', async () => {
      const orderData: CreateOrderData = {
        items: [
          {
            name: 'Test Product',
            price: 50.0,
            quantity: 2,
            image: 'test.jpg'
          }
        ],
        subtotal: 100.0,
        shipping_cost: 10.0,
        tax: 5.0,
        total: 115.0,
        shipping_address: { street: '123 Main St' },
        billing_address: { street: '123 Main St' },
        payment_method: { type: 'credit-card' }
      };

      const mockResults = [{ results: [], success: true }];
      const mockBatch = vi.fn().mockResolvedValue(mockResults);
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });

      const mockDB = {
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: mockBatch
      } as unknown as D1Database;

      await expect(createOrder(mockDB, siteId, orderData)).rejects.toThrow(
        'Failed to create order'
      );
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const mockFirst = vi.fn().mockResolvedValue(mockOrder);
      const mockBindGet = vi.fn().mockReturnValue({ first: mockFirst });
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockBindUpdate = vi.fn().mockReturnValue({ run: mockRun });

      const mockDB = {
        prepare: vi
          .fn()
          .mockReturnValueOnce({ bind: mockBindGet })
          .mockReturnValueOnce({ bind: mockBindUpdate })
          .mockReturnValueOnce({ bind: mockBindGet })
      } as unknown as D1Database;

      const result = await updateOrderStatus(mockDB, siteId, 'order-1', 'shipped');

      expect(result).toEqual(mockOrder);
    });

    it('should return null when order not found', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockDB = {
        prepare: vi.fn().mockReturnValue({ bind: mockBind })
      } as unknown as D1Database;

      const result = await updateOrderStatus(mockDB, siteId, 'nonexistent', 'shipped');

      expect(result).toBeNull();
    });

    it('should update to all valid statuses', async () => {
      const statuses: Array<'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'> = [
        'pending',
        'processing',
        'shipped',
        'delivered',
        'cancelled'
      ];

      for (const status of statuses) {
        const mockFirst = vi.fn().mockResolvedValue(mockOrder);
        const mockBindGet = vi.fn().mockReturnValue({ first: mockFirst });
        const mockRun = vi.fn().mockResolvedValue({ success: true });
        const mockBindUpdate = vi.fn().mockReturnValue({ run: mockRun });

        const mockDB = {
          prepare: vi
            .fn()
            .mockReturnValueOnce({ bind: mockBindGet })
            .mockReturnValueOnce({ bind: mockBindUpdate })
            .mockReturnValueOnce({ bind: mockBindGet })
        } as unknown as D1Database;

        const result = await updateOrderStatus(mockDB, siteId, 'order-1', status);

        expect(result).toEqual(mockOrder);
      }
    });
  });

  describe('deleteOrder', () => {
    it('should delete order scoped by site', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 }, success: true });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await deleteOrder(mockDB, siteId, 'order-1');

      expect(mockPrepare).toHaveBeenCalledWith('DELETE FROM orders WHERE id = ? AND site_id = ?');
      expect(mockBind).toHaveBeenCalledWith('order-1', siteId);
      expect(result).toBe(true);
    });

    it('should return false when order not found', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 0 }, success: true });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await deleteOrder(mockDB, siteId, 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getAllOrders - undefined results fallback', () => {
    it('should return empty array when results is undefined', async () => {
      const mockAll = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await getAllOrders(mockDB, siteId);

      expect(result).toEqual([]);
    });
  });

  describe('getOrdersByUser - undefined results fallback', () => {
    it('should return empty array when results is undefined', async () => {
      const mockAll = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await getOrdersByUser(mockDB, siteId, 'user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getOrderItems - undefined results fallback', () => {
    it('should return empty array when results is undefined', async () => {
      const mockAll = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await getOrderItems(mockDB, 'order-1');

      expect(result).toEqual([]);
    });
  });

  describe('createOrder - null user_id branch', () => {
    it('should handle order creation without user_id', async () => {
      const orderData: CreateOrderData = {
        user_id: '',
        items: [
          {
            product_id: 'prod-1',
            name: 'Test Product',
            quantity: 1,
            price: 100,
            image: ''
          }
        ],
        subtotal: 100,
        shipping_cost: 0,
        tax: 0,
        total: 100,
        shipping_address: { city: 'Test' },
        billing_address: { city: 'Test' },
        payment_method: { type: 'test' }
      };

      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockFirst = vi.fn().mockResolvedValue({
        id: 'order-new',
        site_id: siteId,
        user_id: null,
        status: 'pending',
        total_amount: 100,
        currency: 'USD',
        shipping_address: '{"city":"Test"}',
        billing_address: '{"city":"Test"}',
        notes: null,
        metadata: null,
        created_at: 12345,
        updated_at: 12345
      });

      const mockDB = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: mockRun,
            first: mockFirst
          })
        }),
        batch: vi.fn().mockResolvedValue([])
      } as unknown as D1Database;

      const result = await createOrder(mockDB, siteId, orderData);
      expect(result).toBeDefined();
    });
  });

  describe('createOrder shipping_details branch', () => {
    it('should use null when shipping_details is not provided', async () => {
      const mockOrder = {
        id: 'order-new',
        site_id: siteId,
        status: 'pending',
        total: 100,
        items: '[]',
        shipping_details: null,
        created_at: 1000,
        updated_at: 1000
      };
      const mockFirst = vi.fn().mockResolvedValue(mockOrder);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockBatch = vi.fn().mockResolvedValue([{ results: [], success: true }]);

      const mockDB = {
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: mockBatch
      } as unknown as D1Database;

      const orderData: CreateOrderData = {
        total: 100,
        subtotal: 90,
        shipping_cost: 5,
        tax: 5,
        items: [],
        shipping_address: { street: '123 Main St' },
        billing_address: { street: '123 Main St' },
        payment_method: { type: 'credit-card' }
      };

      const result = await createOrder(mockDB, siteId, orderData);
      expect(result).toBeDefined();
    });
  });

  describe('createOrder with shipping_details', () => {
    it('should serialize shipping_details when present', async () => {
      const mockOrder: DBOrder = {
        id: 'order-2',
        site_id: siteId,
        user_id: null,
        status: 'pending',
        payment_status: 'unpaid',
        stripe_session_id: null,
        stripe_payment_intent_id: null,
        total: 100,
        subtotal: 90,
        shipping_cost: 5,
        tax: 5,
        shipping_address: '{}',
        billing_address: '{}',
        payment_method: '{}',
        shipping_details: '{"carrier":"USPS"}',
        created_at: 1000,
        updated_at: 1000
      };
      const mockFirst = vi.fn().mockResolvedValue(mockOrder);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockBatch = vi.fn().mockResolvedValue([{ results: [], success: true }]);

      const mockDB = {
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: mockBatch
      } as unknown as D1Database;

      const orderData: CreateOrderData = {
        total: 100,
        subtotal: 90,
        shipping_cost: 5,
        tax: 5,
        items: [],
        shipping_address: { street: '123 Main St' },
        billing_address: { street: '123 Main St' },
        payment_method: { type: 'credit-card' },
        shipping_details: {
          groups: [
            {
              id: 'g1',
              shippingOptionId: 'so1',
              shippingOptionName: 'USPS',
              shippingCost: 5,
              products: [{ id: 'p1', name: 'Test', quantity: 1 }]
            }
          ]
        }
      };

      const result = await createOrder(mockDB, siteId, orderData);
      expect(result).toBeDefined();
    });

    it('should serialize null shipping_details as null', async () => {
      const mockOrder: DBOrder = {
        id: 'order-3',
        site_id: siteId,
        user_id: null,
        status: 'pending',
        payment_status: 'unpaid',
        stripe_session_id: null,
        stripe_payment_intent_id: null,
        total: 100,
        subtotal: 90,
        shipping_cost: 5,
        tax: 5,
        shipping_address: '{}',
        billing_address: '{}',
        payment_method: '{}',
        shipping_details: null,
        created_at: 1000,
        updated_at: 1000
      };
      const mockFirst = vi.fn().mockResolvedValue(mockOrder);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockBatch = vi.fn().mockResolvedValue([{ results: [], success: true }]);

      const mockDB = {
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: mockBatch
      } as unknown as D1Database;

      const result = await createOrder(mockDB, siteId, {
        status: 'pending',
        total: 100,
        subtotal: 90,
        shipping_cost: 5,
        tax: 5,
        items: [],
        shipping_address: { street: '123 Main St' },
        billing_address: { street: '123 Main St' },
        payment_method: { type: 'credit-card' }
      } as CreateOrderData);
      expect(result).toBeDefined();
    });
  });

  describe('getOrderByStripeSessionId', () => {
    it('looks up an order by its Stripe Checkout Session id, scoped by site', async () => {
      const mockFirst = vi.fn().mockResolvedValue(mockOrder);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await getOrderByStripeSessionId(mockDB, siteId, 'cs_test_123');

      expect(mockBind).toHaveBeenCalledWith(siteId, 'cs_test_123');
      expect(result).toEqual(mockOrder);
    });
  });

  describe('setOrderStripeSession', () => {
    it('stores the Stripe Checkout Session id on the order', async () => {
      const mockRun = vi.fn().mockResolvedValue({});
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      await setOrderStripeSession(mockDB, siteId, 'order-1', 'cs_test_123');

      expect(mockBind).toHaveBeenCalledWith('cs_test_123', expect.any(Number), 'order-1', siteId);
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe('updateOrderShippingAddress', () => {
    it('writes the address as JSON, scoped by site', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await updateOrderShippingAddress(mockDB, siteId, 'order-1', {
        city: 'Leeds',
        country: 'GB'
      });

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('AND site_id = ?'));
      expect(mockBind).toHaveBeenCalledWith(
        '{"city":"Leeds","country":"GB"}',
        expect.any(Number),
        'order-1',
        siteId
      );
      expect(result).toBe(true);
    });

    it('returns false when no order on this site matched', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockDB = {
        prepare: vi.fn().mockReturnValue({ bind: mockBind })
      } as unknown as D1Database;

      expect(await updateOrderShippingAddress(mockDB, siteId, 'order-x', {})).toBe(false);
    });
  });

  describe('markOrderPaid', () => {
    it('flips an unpaid order to paid and returns true', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await markOrderPaid(mockDB, siteId, 'order-1', 'pi_test_123');

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining("payment_status = 'unpaid'")
      );
      expect(mockBind).toHaveBeenCalledWith('pi_test_123', expect.any(Number), 'order-1', siteId);
      expect(result).toBe(true);
    });

    it('returns false (no-op) when the order was already paid — retried webhook', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await markOrderPaid(mockDB, siteId, 'order-1', 'pi_test_123');

      expect(result).toBe(false);
    });
  });
});
