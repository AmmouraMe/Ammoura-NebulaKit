/**
 * Tests for orders API endpoint
 *
 * This endpoint creates an order record directly with no payment gateway
 * involved (manual/invoice-style orders) — it never verified real payment
 * even before, and the real cart checkout path is POST /api/checkout/session.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './+server';
import type { RequestEvent } from '@sveltejs/kit';

describe('Orders API', () => {
  const mockOrder = {
    id: 'test-order-id',
    site_id: 'test-site',
    user_id: 'user-1',
    status: 'pending' as const,
    payment_status: 'unpaid' as const,
    stripe_session_id: null,
    stripe_payment_intent_id: null,
    subtotal: 59.98,
    shipping_cost: 9.99,
    tax: 5.6,
    total: 75.57,
    shipping_address: '{}',
    billing_address: '{}',
    payment_method: '{}',
    created_at: Date.now(),
    updated_at: Date.now()
  };

  const mockDB = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
        first: vi.fn().mockResolvedValue(mockOrder),
        all: vi.fn().mockResolvedValue({ results: [], success: true })
      })
    }),
    batch: vi.fn().mockResolvedValue([{ success: true }])
  };

  const mockPlatform = {
    env: {
      DB: mockDB
    }
  };

  const mockLocals = {
    siteId: 'test-site',
    currentUser: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'customer' as const
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseOrderData = {
    items: [
      {
        product_id: 'prod-1',
        name: 'Test Product',
        price: 29.99,
        quantity: 2,
        image: '/test.jpg'
      }
    ],
    subtotal: 59.98,
    shipping_cost: 9.99,
    tax: 5.6,
    total: 75.57,
    shipping_address: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '555-1234',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
      country: 'United States'
    },
    billing_address: {
      firstName: 'John',
      lastName: 'Doe',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
      country: 'United States'
    }
  };

  function makeRequest(body: unknown): RequestEvent {
    const request = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { request, platform: mockPlatform, locals: mockLocals } as unknown as RequestEvent;
  }

  describe('POST /api/orders', () => {
    it('creates an order with an arbitrary (non-card) payment_method payload', async () => {
      const response = await POST(
        makeRequest({
          ...baseOrderData,
          payment_method: { type: 'manual', reference: 'invoice-123' }
        })
      );
      const result = (await response.json()) as {
        success: boolean;
        orderId?: string;
        error?: string;
      };

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.orderId).toBeDefined();
    });

    it('rejects an order with no items', async () => {
      const response = await POST(
        makeRequest({
          ...baseOrderData,
          items: [],
          payment_method: { type: 'manual' }
        })
      );
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('at least one item');
    });

    it('rejects an order missing shipping/billing/payment info', async () => {
      const response = await POST(
        makeRequest({
          items: baseOrderData.items,
          subtotal: 59.98,
          shipping_cost: 9.99,
          tax: 5.6,
          total: 75.57
        })
      );
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required order information');
    });

    it('refuses an order to a sanctioned country', async () => {
      const response = await POST(
        makeRequest({
          ...baseOrderData,
          shipping_address: { ...baseOrderData.shipping_address, country: 'North Korea' },
          payment_method: { type: 'manual' }
        })
      );
      expect(response.status).toBe(451);
      expect(((await response.json()) as { success: boolean }).success).toBe(false);
    });
  });
});
