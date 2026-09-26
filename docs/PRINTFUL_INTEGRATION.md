# Printful Integration

## Overview

Ammoura integrates with Printful, a print-on-demand fulfillment service, allowing you to:

- **Sync Products** - Import Printful's catalog directly into your store
- **Manage Inventory** - Let Printful handle stock management
- **Create Orders** - Automatically send customer orders to Printful for fulfillment
- **Track Shipments** - Receive real-time updates on order status and tracking information
- **Multi-variant Support** - Offer products with multiple sizes, colors, and customizations

## Architecture

### Components

1. **PrintfulClient** (`src/lib/server/integrations/printful/client.ts`)
   - Low-level API communication with Printful
   - Handles authentication and error handling
   - Methods for products, variants, orders

2. **PrintfulService** (`src/lib/server/integrations/printful/service.ts`)
   - High-level business logic
   - Product syncing
   - Inventory checks
   - Order creation and management

3. **Database Layer** (`src/lib/server/integrations/printful/db.ts`)
   - Stores Printful product and order data
   - Tracks sync state
   - Links Ammoura products to Printful products

4. **API Endpoints**
   - `POST /api/admin/printful/sync` - Sync products from Printful
   - `GET /api/admin/printful/status` - Check Printful connection status
   - `POST /api/webhooks/printful` - Receive order status updates

## Setup

### 1. Get Printful API Key

1. Sign in to [Printful Dashboard](https://printful.com/dashboard)
2. Go to **Account** → **API**
3. Generate a new API key
4. Copy the API key (you'll need it in the next step)

### 2. Create Printful Provider in Ammoura

1. Go to Admin Dashboard → **Fulfillment Providers**
2. Click **Add Provider**
3. **Name**: Enter a name (e.g., "Printful Store")
4. **Type**: Select **Printful**
5. Click **Create Provider**

### 3. Configure API Key

1. On the provider card, click **Configure**
2. Paste your Printful API key
3. Click **Test Connection** to verify it works
4. Click **Sync Products** to import Printful's catalog

### 4. Setup Webhook (Optional but Recommended)

For real-time order updates:

1. Go to Printful Dashboard → **Account** → **Webhooks**
2. Add new webhook:
   - **URL**: `https://your-store.com/api/webhooks/printful`
   - **Events**: Select all order-related events
   - **Test connection** to verify

## Usage

### Creating Products with Printful

1. In admin dashboard, create a new product
2. Under **Fulfillment Options**, add Printful provider
3. Select a Printful product and variant
4. Set your markup/profit margin
5. Save product

### Placing Orders

When a customer places an order with Printful fulfillment:

1. Order is validated and inventory checked
2. A relay record is written, then the order data is sent to the Printful API
3. A failed hand-off is retried with backoff, or dead-lettered where it is
   visible and retryable by hand — see
   [FULFILLMENT_RELAY.md](./FULFILLMENT_RELAY.md)
4. Printful processes, prints, and ships the product
5. Webhook updates received on status changes
6. Customer receives tracking information

### Inventory Management

- Printful manages all inventory
- Stock levels sync automatically
- Out-of-stock variants are unavailable
- No manual stock management needed

## Database Schema

### printful_products

```sql
CREATE TABLE printful_products (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  printful_product_id INTEGER NOT NULL,
  printful_data TEXT NOT NULL, -- Full Printful product JSON
  synced_at INTEGER NOT NULL,
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE (site_id, printful_product_id)
);
```

### printful_orders

```sql
CREATE TABLE printful_orders (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  printful_order_id INTEGER NOT NULL,
  printful_data TEXT NOT NULL, -- Full Printful order JSON
  status TEXT NOT NULL,
  synced_at INTEGER NOT NULL,
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE (site_id, order_id)
);
```

## API Reference

### PrintfulClient

```typescript
class PrintfulClient {
  // Products
  async getProducts(): Promise<PrintfulProduct[]>;
  async getProductById(productId: number): Promise<PrintfulProduct>;
  async getVariantById(variantId: number): Promise<PrintfulVariant>;

  // Orders
  async createOrder(orderRequest: PrintfulOrderRequest): Promise<PrintfulOrder>;
  async getOrder(orderId: number): Promise<PrintfulOrder>;
  async getOrders(): Promise<PrintfulOrder[]>;
  async cancelOrder(orderId: number): Promise<boolean>;

  // Store
  async getStore(): Promise<StoreInfo>;
}
```

### PrintfulService

```typescript
class PrintfulService {
  // Products
  async syncProducts(): Promise<PrintfulProduct[]>;
  async getProductDetails(productId: number): Promise<PrintfulProduct>;

  // Inventory
  async checkInventory(variantId: number): Promise<boolean>;

  // Orders
  async createOrderWithPrintful(orderRequest: PrintfulOrderRequest): Promise<PrintfulOrder>;
  async getOrderStatus(orderId: number): Promise<PrintfulOrder>;
  async cancelOrder(orderId: number): Promise<boolean>;
  async getAllOrders(): Promise<PrintfulOrder[]>;

  // Config
  getPrintfulConfig(): PrintfulServiceConfig;
  isConfigValid(): boolean;
}
```

## Error Handling

### Common Errors

| Error               | Cause                           | Solution                                     |
| ------------------- | ------------------------------- | -------------------------------------------- |
| `Invalid API Key`   | API key is incorrect or expired | Regenerate API key in Printful Dashboard     |
| `Product not found` | Printful product doesn't exist  | Verify product ID, re-sync products          |
| `Out of stock`      | Variant is out of stock         | Wait for restock or choose different variant |
| `Invalid order`     | Order data is malformed         | Check recipient address and item details     |
| `Network error`     | Can't reach Printful API        | Check internet connection, Printful status   |

### Retry Strategy

A paid order that fails to reach Printful is recorded in `fulfillment_relays`
and retried on a schedule — 8 attempts over roughly four hours, with
exponential backoff and jitter. A failure Printful will never accept (a bad
address, an unavailable variant, a revoked key) is not retried at all; it is
dead-lettered immediately so a human sees it.

Anything that gives up lands on `/admin/orders/fulfillment` with its error and
the raw Printful response, and the store's admins are notified. Retries are
idempotent: the order carries our order id as its `external_id`, and a retry
adopts an order Printful already holds instead of placing a second one.

Order webhooks are still returned 200 immediately, so Printful does not retry
them.

Full detail, including how to configure the sweep, is in
[FULFILLMENT_RELAY.md](./FULFILLMENT_RELAY.md).

## Security

### API Key Storage

- API keys are stored encrypted in the provider config
- Never committed to version control
- Only accessible to admin users
- Transmitted over HTTPS only

### Webhook Validation

- Webhook events are logged for audit trail
- Only process events from verified Printful
- All order changes logged to activity logs

## Monitoring & Debugging

### Check Integration Status

```bash
curl -X GET "https://your-store.com/api/admin/printful/status?providerId=your-provider-id" \
  -H "Authorization: Bearer your-token"
```

### Sync Products Manually

```bash
curl -X POST "https://your-store.com/api/admin/printful/sync" \
  -H "Content-Type: application/json" \
  -d '{"providerId": "your-provider-id"}'
```

### View Activity Logs

All Printful activities are logged in the admin dashboard activity logs:

- Product syncs
- Order creation
- Order updates
- Status changes

## Limitations

- **Physical products only** - Printful doesn't support digital/service products
- **Printful pricing** - Store owners cannot manually adjust base costs (only markups)
- **Customization** - Only print areas (customization zones) supported, no text fields
- **No variants in our schema** - Variants are managed in Printful

## FAQ

### Q: How do I sync products automatically?

A: Currently sync is manual via the admin UI. You can also use the API endpoint:

```bash
POST /api/admin/printful/sync
```

Future versions will support automatic scheduled syncs.

### Q: Can I use multiple Printful accounts?

A: Yes! Create multiple Printful providers, each with different API keys.

### Q: What happens if a product goes out of stock?

A: The product becomes unavailable for purchase. Webhook updates reflect this change.

### Q: How do I handle returns/refunds?

A: Refunds are managed in Printful dashboard. Ammoura will receive webhook updates.

### Q: Can I test without placing real orders?

A: Use Printful's sandbox API by providing a sandbox API key. Set up a development provider.

## References

- [Printful API Documentation](https://printful.com/api/docs)
- [Printful Webhook Events](https://printful.com/api/docs/webhooks)
- [Printful Dashboard](https://printful.com/dashboard)
- [Printful Support](https://printful.com/support)

## Support

For issues with the Printful integration:

1. Check [Printful Status](https://printful.com/status) for service issues
2. Review activity logs in admin dashboard
3. Test API key via "Test Connection" button
4. Re-sync products if data seems stale
5. Contact Printful support for API-level issues
