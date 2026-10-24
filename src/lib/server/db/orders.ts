/**
 * Orders repository with multi-tenant support
 * All queries are scoped by site_id
 */

import {
  executeOne,
  execute,
  executeBatch,
  generateId,
  getCurrentTimestamp
} from './connection.js';
import {
  buildOrderItemCustomizationStatements,
  type OrderItemCustomizationInput,
  type OrderItemFieldValueInput
} from './order-customizations.js';

export interface DBOrder {
  id: string;
  site_id: string;
  user_id: string | null;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'refunded' | 'failed';
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  shipping_address: string; // JSON
  billing_address: string; // JSON
  payment_method: string; // JSON
  shipping_details: string | null; // JSON - package groups and shipping options
  created_at: number;
  updated_at: number;
}

export interface DBOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  price: number;
  quantity: number;
  image: string;
  created_at: number;
}

export interface CreateOrderData {
  user_id?: string;
  items: {
    product_id?: string;
    variant_id?: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    /** Placed artwork per customization zone (persisted per order item). */
    customizations?: OrderItemCustomizationInput[];
    /** Personalization field values (persisted per order item). */
    field_values?: OrderItemFieldValueInput[];
  }[];
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  shipping_address: Record<string, unknown>;
  billing_address: Record<string, unknown>;
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

export interface UpdateOrderData {
  status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
}

/**
 * Get an order by ID (scoped by site)
 */
export async function getOrderById(
  db: D1Database,
  siteId: string,
  orderId: string
): Promise<DBOrder | null> {
  return await executeOne<DBOrder>(db, 'SELECT * FROM orders WHERE id = ? AND site_id = ?', [
    orderId,
    siteId
  ]);
}

/**
 * Get all orders for a site
 */
export async function getAllOrders(db: D1Database, siteId: string): Promise<DBOrder[]> {
  const result = await execute<DBOrder>(
    db,
    'SELECT * FROM orders WHERE site_id = ? ORDER BY created_at DESC',
    [siteId]
  );
  return result.results || [];
}

/**
 * Get orders by user (scoped by site)
 */
export async function getOrdersByUser(
  db: D1Database,
  siteId: string,
  userId: string
): Promise<DBOrder[]> {
  const result = await execute<DBOrder>(
    db,
    'SELECT * FROM orders WHERE site_id = ? AND user_id = ? ORDER BY created_at DESC',
    [siteId, userId]
  );
  return result.results || [];
}

/**
 * Get order items for an order
 */
export async function getOrderItems(db: D1Database, orderId: string): Promise<DBOrderItem[]> {
  const result = await execute<DBOrderItem>(
    db,
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at',
    [orderId]
  );
  return result.results || [];
}

/**
 * Create a new order with items (scoped by site)
 */
export async function createOrder(
  db: D1Database,
  siteId: string,
  data: CreateOrderData
): Promise<DBOrder> {
  const orderId = generateId();
  const timestamp = getCurrentTimestamp();

  // Prepare batch statements for order and items
  const statements = [];

  // Insert order
  statements.push({
    sql: `INSERT INTO orders (id, site_id, user_id, status, subtotal, shipping_cost, tax, total, shipping_address, billing_address, payment_method, shipping_details, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      orderId,
      siteId,
      data.user_id || null,
      'pending',
      data.subtotal,
      data.shipping_cost,
      data.tax,
      data.total,
      JSON.stringify(data.shipping_address),
      JSON.stringify(data.billing_address),
      JSON.stringify(data.payment_method),
      data.shipping_details ? JSON.stringify(data.shipping_details) : null,
      timestamp,
      timestamp
    ]
  });

  // Insert order items — each with its customizations/field values bound to the
  // item's generated id, so the design travels with the exact line it belongs to.
  for (const item of data.items) {
    const itemId = generateId();
    statements.push({
      sql: `INSERT INTO order_items (id, order_id, product_id, variant_id, name, price, quantity, image, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        itemId,
        orderId,
        item.product_id || null,
        item.variant_id || null,
        item.name,
        item.price,
        item.quantity,
        item.image,
        timestamp
      ]
    });
    statements.push(
      ...buildOrderItemCustomizationStatements(itemId, item.customizations, item.field_values)
    );
  }

  await executeBatch(db, statements);

  const order = await getOrderById(db, siteId, orderId);
  if (!order) {
    throw new Error('Failed to create order');
  }
  return order;
}

/**
 * Update an order status (scoped by site)
 */
export async function updateOrderStatus(
  db: D1Database,
  siteId: string,
  orderId: string,
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
): Promise<DBOrder | null> {
  const order = await getOrderById(db, siteId, orderId);
  if (!order) {
    return null;
  }

  const timestamp = getCurrentTimestamp();
  await db
    .prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND site_id = ?')
    .bind(status, timestamp, orderId, siteId)
    .run();

  return await getOrderById(db, siteId, orderId);
}

/**
 * Replace an order's shipping address (scoped by site). For correcting an
 * address the fulfillment provider refused; returns false if no such order.
 */
export async function updateOrderShippingAddress(
  db: D1Database,
  siteId: string,
  orderId: string,
  shippingAddress: Record<string, unknown>
): Promise<boolean> {
  const timestamp = getCurrentTimestamp();
  const result = await db
    .prepare('UPDATE orders SET shipping_address = ?, updated_at = ? WHERE id = ? AND site_id = ?')
    .bind(JSON.stringify(shippingAddress), timestamp, orderId, siteId)
    .run();
  return (result.meta?.changes || 0) > 0;
}

/**
 * Get an order by its Stripe Checkout Session ID (scoped by site)
 */
export async function getOrderByStripeSessionId(
  db: D1Database,
  siteId: string,
  stripeSessionId: string
): Promise<DBOrder | null> {
  return await executeOne<DBOrder>(
    db,
    'SELECT * FROM orders WHERE site_id = ? AND stripe_session_id = ?',
    [siteId, stripeSessionId]
  );
}

/**
 * Record the Stripe Checkout Session an order is waiting payment on
 */
export async function setOrderStripeSession(
  db: D1Database,
  siteId: string,
  orderId: string,
  stripeSessionId: string
): Promise<void> {
  const timestamp = getCurrentTimestamp();
  await db
    .prepare('UPDATE orders SET stripe_session_id = ?, updated_at = ? WHERE id = ? AND site_id = ?')
    .bind(stripeSessionId, timestamp, orderId, siteId)
    .run();
}

/**
 * Mark an order paid, transitioning it from 'unpaid' only — a no-op (and
 * returns false) if it's already paid/refunded/failed, so a retried Stripe
 * webhook delivery can't double-trigger downstream effects (like relaying a
 * second order to Printful).
 */
export async function markOrderPaid(
  db: D1Database,
  siteId: string,
  orderId: string,
  stripePaymentIntentId: string | null
): Promise<boolean> {
  const timestamp = getCurrentTimestamp();
  const result = await db
    .prepare(
      `UPDATE orders SET payment_status = 'paid', stripe_payment_intent_id = ?, updated_at = ?
       WHERE id = ? AND site_id = ? AND payment_status = 'unpaid'`
    )
    .bind(stripePaymentIntentId, timestamp, orderId, siteId)
    .run();
  return (result.meta?.changes || 0) > 0;
}

/**
 * Delete an order (scoped by site)
 */
export async function deleteOrder(
  db: D1Database,
  siteId: string,
  orderId: string
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM orders WHERE id = ? AND site_id = ?')
    .bind(orderId, siteId)
    .run();
  return (result.meta?.changes || 0) > 0;
}
