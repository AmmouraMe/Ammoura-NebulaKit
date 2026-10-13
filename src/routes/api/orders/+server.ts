/**
 * Orders API endpoint
 *
 * Creates an order record directly, with no payment gateway involved — for
 * manual/invoice-style orders (e.g. the custom order forms feature) where
 * payment is handled outside Stripe. The real cart → Stripe Checkout flow
 * lives at POST /api/checkout/session; this endpoint never used to actually
 * verify payment either (it accepted a hardcoded test card), so nothing
 * that depended on real payment verification is being removed here.
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { createOrder } from '$lib/server/db/orders';
import { toCountryCode } from '$lib/data/countries';
import { isRestrictedAddress, RESTRICTED_REGION_MESSAGE } from '$lib/data/restrictedRegions';
import {
  saveEquipmentValuesForOrderItems,
  type OrderItemEquipmentValueSubmission
} from '$lib/server/db/equipment';

interface CreateOrderRequest {
  items: Array<{
    product_id?: string;
    variant_id?: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    equipment_values?: OrderItemEquipmentValueSubmission[];
  }>;
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  shipping_address: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  billing_address: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  payment_method: Record<string, unknown>;
  shipping_details?: {
    groups: Array<{
      id: string;
      shippingOptionId: string;
      shippingOptionName: string;
      shippingCost: number;
      products: Array<{
        id: string;
        name: string;
        quantity: number;
      }>;
    }>;
  };
}

/**
 * POST /api/orders
 * Create a new order
 */
export async function POST({ request, platform, locals }: RequestEvent): Promise<Response> {
  try {
    const db = getDB(platform);
    const siteId = locals.siteId;
    const userId = locals.currentUser?.id;

    const data = (await request.json()) as CreateOrderRequest;

    // Validate required fields
    if (!data.items || data.items.length === 0) {
      return json(
        { success: false, error: 'Order must contain at least one item' },
        { status: 400 }
      );
    }

    if (!data.shipping_address || !data.billing_address || !data.payment_method) {
      return json({ success: false, error: 'Missing required order information' }, { status: 400 });
    }

    // No orders to or from places under US sanctions (see restrictedRegions).
    const addresses = [data.shipping_address, data.billing_address];
    if (
      addresses.some((address) => {
        const country = toCountryCode(address.country ?? '');
        return country !== null && isRestrictedAddress(country, address.state);
      })
    ) {
      return json({ success: false, error: RESTRICTED_REGION_MESSAGE }, { status: 451 });
    }

    // Create order in database
    const order = await createOrder(db, siteId, {
      user_id: userId,
      items: data.items,
      subtotal: data.subtotal,
      shipping_cost: data.shipping_cost,
      tax: data.tax,
      total: data.total,
      shipping_address: data.shipping_address,
      billing_address: data.billing_address,
      payment_method: data.payment_method,
      shipping_details: data.shipping_details
    });

    await saveEquipmentValuesForOrderItems(db, order.id, data.items);

    return json({
      success: true,
      orderId: order.id,
      order: {
        id: order.id,
        status: order.status,
        total: order.total,
        created_at: order.created_at
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return json({ success: false, error: 'Failed to create order' }, { status: 500 });
  }
}
