# Checkout and Orders Documentation

## Overview

This document describes the checkout process, order management system, and
testing procedures for the Hermes eCommerce platform.

## Checkout Process

### Customer Flow

1. **Add Items to Cart**: Customers browse products and add items to their cart
2. **Navigate to Checkout**: Click "Checkout" from the cart page
3. **Complete Checkout Form**:
   - Step 1: Shipping Address
   - Step 2: Billing Address (can copy from shipping)
   - Step 3: Payment Method
4. **Submit Order**: Order is created and stored in the database
5. **Success Page**: Confirmation page with order details

### Implementation Details

- **Checkout Store**: `src/lib/stores/checkout.ts` manages checkout state
- **Checkout Page**: `src/routes/checkout/+page.svelte` provides the UI
- **API Endpoint**: `src/routes/api/orders/+server.ts` handles order creation
- **Database Layer**: `src/lib/server/db/orders.ts` manages order persistence

## Test Credit Card

For testing the checkout process, use the following test credit card:

```
Card Number: 5555 5555 5555 5555
Expiry Date: 01/23
CVV: 456
Cardholder Name: Any name
```

**Important Notes:**

- This test card is **only accepted in development/testing environments**
- The exact expiry date and CVV must be used as specified above
- Any other card number will go through basic validation (13-19 digits, valid
  expiry, 3-4 digit CVV)
- No actual payment processing occurs - orders are created immediately

### Payment Validation

The payment validation logic in `src/routes/api/orders/+server.ts`:

1. **Test Card Validation**:
   - Checks if card number is `5555555555555555` (without spaces)
   - Validates expiry month is `01` and year is `23`
   - Validates CVV is `456`
   - Returns validation error if any field is incorrect

2. **General Card Validation**:
   - Card number must be 13-19 digits
   - Must contain only digits (after removing spaces/dashes)
   - Expiry date must not be in the past
   - CVV must be 3 or 4 digits

3. **Security**:
   - Only last 4 digits of card number are stored
   - CVV is **never** stored in the database
   - Payment method details are stored as JSON in the orders table

## Orders Admin Interface

### Accessing Orders

Navigate to `/admin/orders` to view all orders for your site.

### Orders List View

**Features:**

- View all orders with key information
- Filter by order status
- See customer details (name and email)
- View order totals and item counts
- Quick statistics: Total orders, Pending, Delivered

**Columns:**

- Order ID (shortened)
- Date (formatted)
- Customer (name and email)
- Items count
- Total amount
- Status badge (color-coded)
- Actions (View Details button)

### Order Details View

Navigate to `/admin/orders/[id]` to view a specific order.

**Information Displayed:**

1. **Order Summary**
   - Order ID
   - Current status
   - Order date
   - Last updated date

2. **Status Management**
   - Update order status with one click
   - Available statuses: Pending, Processing, Shipped, Delivered, Cancelled
   - Color-coded status badges

3. **Order Items**
   - Product images
   - Product names
   - Quantities
   - Individual prices
   - Line totals
   - Order totals (subtotal, shipping, tax, total)

4. **Customer Information**
   - Shipping address (full details)
   - Billing address (full details)

5. **Payment Information**
   - Payment type
   - Card number (masked, last 4 digits only)
   - Cardholder name
   - Expiry date

### Updating Order Status

**Via API:**

```bash
PATCH /api/orders/[id]/status
Content-Type: application/json

{
  "status": "shipped"
}
```

**Valid Statuses:**

- `pending`: Order received but not yet processed
- `processing`: Order is being prepared
- `shipped`: Order has been shipped to customer
- `delivered`: Order has been delivered
- `cancelled`: Order has been cancelled

## Database Schema

### Orders Table

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal REAL NOT NULL,
  shipping_cost REAL NOT NULL,
  tax REAL NOT NULL,
  total REAL NOT NULL,
  shipping_address TEXT NOT NULL, -- JSON
  billing_address TEXT NOT NULL,  -- JSON
  payment_method TEXT NOT NULL,   -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### Order Items Table

```sql
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  image TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);
```

## Tax

Tax is the **site's own**, not the platform's. `$lib/checkout-pricing` holds
the money rules the storefront and the server share, and a `TaxRule` carries
what a site charges:

| Field              | From the admin tax page   | Meaning                                  |
| ------------------ | ------------------------- | ---------------------------------------- |
| `enabled`          | "Enable Tax Calculations" | off ⇒ no tax is charged at all           |
| `ratePercent`      | "Default Tax Rate (%)"    | a **percent** — `8.25` is 8.25%          |
| `pricesIncludeTax` | "Prices Include Tax"      | on ⇒ the tax is already inside the price |

- `calculateOrderTax(subtotal, rule)` — adds the rate for a tax-exclusive
  store, and **extracts** it (`subtotal - subtotal / (1 + rate)`) for a
  tax-inclusive one.
- `calculateOrderTotal(subtotal, shipping, tax, rule)` — adds the tax only when
  it is not already in the subtotal, so it is never charged twice.
- A rate that is not a finite number in `(0, 100]` is treated as no tax.
  Charging a corrupt rate is worse than charging none.

**A store with no tax settings saved charges nothing.** That is deliberate, not
a placeholder: a store that has never opened the tax page has not said what
jurisdiction it is in, and inventing a rate for it takes money from its
customers on a guess. Until 2026-09-20 checkout applied a hardcoded 8% to every
store on the platform and never read these settings at all — a UK store quoted
US sales tax, and the admin tax page changed nothing.

**The server never takes the rate from the request.** `repriceCheckout` reads
the site's settings itself (`getCheckoutTaxRule`), for the same reason it
re-derives every price: a number the browser sends is a number a browser can
change. If the settings read fails, checkout charges no tax rather than a
guessed rate. `/checkout` gets the same rule from its own `+page.server.ts`, so
the quote on the page and the charge on the card come from one source.

`POST /api/checkout/session` then checks that the Stripe line items sum to the
order total before creating the session, and refuses if they do not — the order
row and the Stripe charge are built by two different pieces of code, and a
disagreement means the customer is billed one amount while the merchant's
records hold another.

**Not yet applied:** per-product tax classes (`TaxSettings.taxClasses`) and
"Display Prices With Tax" on product pages. Every taxed line uses the site's
default rate.

## Addresses and countries

A country is stored as an **ISO 3166-1 alpha-2 code** (`US`, `GB`, `JP`) in
every address the platform holds — the checkout's shipping and billing
addresses, and the store's own address in admin settings. `$lib/data/countries`
owns the list and the conversions:

- `COUNTRIES` — every officially assigned ISO-2 code plus `XK` (Kosovo),
  sorted by English name. `COMMON_COUNTRIES` is the short list a picker shows
  above the rest.
- `toCountryCode(value)` — an ISO-2 code for a code, a name, or one of the
  older spellings (`USA`, `Czech Republic`, `Ivory Coast`). `null` when the
  value names no country.
- `countryName(code)` — the display name, or the code itself when unknown, so
  an unexpected value shows rather than disappears.

`CountrySelect.svelte` is the one picker. Do not write a second `<select>` of
countries.

**Why it is one list and not a handful of options.** The checkout form used to
offer six countries and `Other`. `Other` is not a country: an order placed with
it was charged, marked paid, and then stuck at the fulfilment relay, which
cannot give Printful a country code for it. The relay dead-letters such an
order permanently (see `FULFILLMENT_RELAY.md`), naming the country the address
holds, and `POST /api/checkout/session` now rejects an unresolvable country
**before** taking the money. Addresses stored before 2026-09-20 hold names
rather than codes; `toCountryCode` still reads them.

## Multi-Tenant Isolation

All order operations are **scoped by site_id**:

- Orders can only be viewed by the site they belong to
- API endpoints automatically filter by `locals.siteId`
- Database queries always include `site_id` in WHERE clauses

## API Endpoints

### Create Order

```
POST /api/orders
```

**Request Body:**

```json
{
  "items": [
    {
      "product_id": "prod-123",
      "name": "Product Name",
      "price": 29.99,
      "quantity": 2,
      "image": "/images/product.jpg"
    }
  ],
  "subtotal": 59.98,
  "shipping_cost": 9.99,
  "tax": 5.6 /* ignored — re-derived from the site's tax settings */,
  "total": 75.57,
  "shipping_address": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "555-1234",
    "address": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "zipCode": "12345",
    "country": "US"
  },
  "billing_address": {
    /* same structure as shipping_address */
  },
  "payment_method": {
    "type": "credit-card",
    "cardNumber": "5555 5555 5555 5555",
    "cardHolderName": "John Doe",
    "expiryMonth": "01",
    "expiryYear": "23",
    "cvv": "456"
  }
}
```

**Response:**

```json
{
  "success": true,
  "orderId": "order-abc123",
  "order": {
    "id": "order-abc123",
    "status": "pending",
    "total": 75.57,
    "created_at": 1234567890
  }
}
```

### Update Order Status

```
PATCH /api/orders/[id]/status
```

**Request Body:**

```json
{
  "status": "shipped"
}
```

**Response:**

```json
{
  "success": true,
  "order": {
    "id": "order-abc123",
    "status": "shipped",
    "updated_at": 1234567890
  }
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run orders API tests
npm test -- src/routes/api/orders/+server.test.ts

# Run orders database tests
npm test -- src/lib/server/db/orders.test.ts
```

### Test Coverage

The following are tested:

- ✅ Order creation with test card
- ✅ Payment validation (correct test card details)
- ✅ Rejection of invalid CVV
- ✅ Rejection of expired cards
- ✅ Rejection of empty orders
- ✅ Database CRUD operations
- ✅ Multi-tenant isolation

### Manual Testing

1. **Start the development server:**

   ```bash
   npm run dev
   ```

2. **Add products to cart** by browsing to the homepage

3. **Go to checkout** at `/checkout`

4. **Fill out the checkout form:**
   - Enter any shipping address
   - Optionally copy to billing address
   - Use the test credit card: `5555 5555 5555 5555`, `01/23`, `456`

5. **Submit the order** and verify success page

6. **View order in admin** at `/admin/orders`

7. **Test status updates** by clicking into an order and changing its status

## Security Considerations

- ✅ CVV is never stored
- ✅ Only last 4 digits of card are stored
- ✅ All orders are scoped by site_id
- ✅ Payment validation prevents basic input errors
- ✅ Test card only works in development

## Future Enhancements

Potential improvements for the checkout and orders system:

1. ~~**Real Payment Integration**~~ — done: Stripe Checkout Sessions plus the
   `checkout.session.completed` webhook. PayPal is still only a settings field.
2. **Email Notifications**: Send order confirmation and status update emails
3. **Order Tracking**: Add tracking numbers and carrier information
4. **Refunds**: Add refund processing capabilities
5. **Order History**: Customer-facing order history page
6. **Inventory Management**: Automatic inventory deduction on order creation
7. **Order Search**: Search and filter orders by various criteria
8. **Export**: Export orders to CSV for accounting/reporting
9. **Shipping Labels**: Integration with shipping label providers
10. **Analytics**: Order analytics dashboard with charts and metrics
