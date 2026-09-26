# Cloudflare D1 Database Integration

This document provides comprehensive information about the Cloudflare D1
database integration with multi-site support for the Ammoura platform.

## Overview

Ammoura uses Cloudflare D1, a serverless SQL database, as its primary data
storage solution. The database schema is designed with multi-tenancy in mind,
allowing a single deployment to serve multiple stores/sites.

## Architecture

### Multi-Tenant Design

All database tables include a `site_id` column that scopes data to a specific
store/site. This approach provides:

- **Data isolation**: Each site's data is logically separated
- **Scalability**: Support for unlimited number of sites
- **Performance**: Efficient queries with proper indexing
- **Security**: Row-level site scoping prevents cross-site data access

### Database Schema

The database consists of the following tables:

#### Sites Table

Stores information about each store/site in the platform.

```sql
CREATE TABLE sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  description TEXT,
  settings TEXT, -- JSON configuration
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### Users Table

Stores user accounts scoped by site.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id),
  UNIQUE(site_id, email)
);
```

#### Products Table

Stores product catalog scoped by site.

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  image TEXT NOT NULL,
  category TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'physical',
  tags TEXT, -- JSON array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id)
);
```

#### Orders Table

Stores customer orders scoped by site.

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
  billing_address TEXT NOT NULL, -- JSON
  payment_method TEXT NOT NULL, -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### Order Items Table

Stores line items for each order.

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
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

#### Carts Table

Stores shopping cart data scoped by site.

```sql
CREATE TABLE carts (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  items TEXT NOT NULL, -- JSON array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Setup Instructions

### 1. Create D1 Database

Create a D1 database using Wrangler CLI:

```bash
# Create production database
wrangler d1 create hermes-db

# Create preview/development database (optional)
wrangler d1 create hermes-db-preview
```

### 2. Update wrangler.toml

Update the `database_id` in `wrangler.toml` with the ID returned from the create
command:

```toml
[[d1_databases]]
binding = "DB"
database_name = "hermes-db"
database_id = "your-database-id-here"
migrations_dir = "migrations"
```

### 3. Run Migrations

Apply the database schema using Wrangler:

```bash
# For production
wrangler d1 migrations apply hermes-db

# For preview/development
wrangler d1 migrations apply hermes-db --local
```

### 4. Seed Database (Optional)

Load seed data for development:

```bash
# For local development
wrangler d1 execute hermes-db --local --file=./migrations/0002_seed_data.sql

# For production
wrangler d1 execute hermes-db --file=./migrations/0002_seed_data.sql
```

## Usage

### Accessing the Database

The database is available through the platform context in SvelteKit:

```typescript
import { getDB } from '$lib/server/db';

export async function load({ platform }) {
  const db = getDB(platform);
  // Use db...
}
```

### Repository Pattern

All database operations use repository functions that automatically scope by
site:

```typescript
import { createProduct, getAllProducts } from '$lib/server/db';

export async function load({ platform, locals }) {
  const db = getDB(platform);
  const siteId = locals.siteId;

  // Get all products for the current site
  const products = await getAllProducts(db, siteId);

  return { products };
}
```

### Multi-Tenant Awareness

The site context is automatically determined from the request hostname via
`hooks.server.ts`:

1. Request comes in with a hostname (e.g., `store1.example.com`)
2. Hook looks up the site by domain in the database
3. Site ID is stored in `event.locals.siteId`
4. All database queries use this site ID for scoping

## API Reference

### Connection Module (`$lib/server/db/connection.ts`)

- `getDB(platform)` - Get D1 database instance
- `execute(db, sql, params)` - Execute SQL query
- `executeOne(db, sql, params)` - Execute query and return first result
- `executeBatch(db, statements)` - Execute multiple statements
- `generateId()` - Generate unique ID
- `getCurrentTimestamp()` - Get Unix timestamp

### Sites Repository (`$lib/server/db/sites.ts`)

- `getSiteById(db, id)` - Get site by ID
- `getSiteByDomain(db, domain)` - Get site by domain
- `getAllSites(db)` - Get all sites
- `createSite(db, data)` - Create new site
- `updateSite(db, id, data)` - Update site
- `deleteSite(db, id)` - Delete site

### Products Repository (`$lib/server/db/products.ts`)

- `getProductById(db, siteId, productId)` - Get product by ID
- `getAllProducts(db, siteId)` - Get all products
- `getProductsByCategory(db, siteId, category)` - Get products by category
- `createProduct(db, siteId, data)` - Create product
- `updateProduct(db, siteId, productId, data)` - Update product
- `deleteProduct(db, siteId, productId)` - Delete product
- `updateProductStock(db, siteId, productId, stockChange)` - Update stock

### Users Repository (`$lib/server/db/users.ts`)

- `getUserById(db, siteId, userId)` - Get user by ID
- `getUserByEmail(db, siteId, email)` - Get user by email
- `getAllUsers(db, siteId)` - Get all users
- `getUsersByRole(db, siteId, role)` - Get users by role
- `createUser(db, siteId, data)` - Create user
- `updateUser(db, siteId, userId, data)` - Update user
- `deleteUser(db, siteId, userId)` - Delete user

### Orders Repository (`$lib/server/db/orders.ts`)

- `getOrderById(db, siteId, orderId)` - Get order by ID
- `getAllOrders(db, siteId)` - Get all orders
- `getOrdersByUser(db, siteId, userId)` - Get orders by user
- `getOrderItems(db, orderId)` - Get order items
- `createOrder(db, siteId, data)` - Create order with items
- `updateOrderStatus(db, siteId, orderId, status)` - Update order status
- `deleteOrder(db, siteId, orderId)` - Delete order

## Migration Management

### Creating New Migrations

1. Create a new SQL file in the `migrations/` directory
2. Name it with a sequential number: `000X_description.sql`
3. Write your SQL statements
4. Apply the migration using Wrangler

Example:

```sql
-- migrations/0003_add_reviews.sql
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  user_id TEXT,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
```

### Applying Migrations

```bash
# Local development
wrangler d1 migrations apply hermes-db --local

# Production
wrangler d1 migrations apply hermes-db
```

## Local Development

For local development, Wrangler provides a local D1 instance:

```bash
# Start dev server with local D1
npm run dev
```

The local D1 database persists in `.wrangler/state/v3/d1/` directory.

## Testing

### Querying the Database

You can query the database directly using Wrangler:

```bash
# Local
wrangler d1 execute hermes-db --local --command="SELECT * FROM sites"

# Production
wrangler d1 execute hermes-db --command="SELECT * FROM sites"
```

### Database Console

Access the D1 console in Cloudflare Dashboard:

1. Go to Workers & Pages
2. Select D1
3. Click on your database
4. Use the Console tab to run queries

## Performance Considerations

### Indexes

All tables have appropriate indexes for common queries:

- Site ID indexes on all multi-tenant tables
- Email lookup index on users table
- Category index on products table
- User ID index on orders table

### Query Optimization

- Always scope queries by `site_id` first
- Use prepared statements (automatic in repository functions)
- Use batch operations for multiple inserts
- Limit result sets when paginating

### Caching

Consider implementing caching strategies:

- Cache site configurations
- Cache frequently accessed products
- Use Cloudflare KV for session data

## Security

### Multi-Tenant Isolation

- All queries automatically scoped by site ID
- Foreign key constraints ensure data integrity
- Unique constraints prevent duplicate emails per site

### Best Practices

1. Always validate site ID in hooks
2. Use prepared statements (repository functions do this)
3. Sanitize user inputs
4. Hash passwords before storing
5. Use transactions for multi-step operations

## Automated Preview Environment Setup

Cloudflare Pages preview deployments automatically set up a fresh database with
seed data. This ensures each preview branch has its own isolated, pre-populated
database for testing.

### How It Works

The `scripts/preview-build.js` script detects the environment using Cloudflare
Pages environment variables:

- **Preview Environments**: Automatically wipes, migrates, and seeds the
  database
- **Production Environments**: Only runs migrations (no data wipe)
- **Local Development**: Skips automatic database setup

### Build Process

For preview deployments (non-main branches):

1. **Wipe**: Clears all existing data from the preview database
2. **Migrate**: Applies all schema migrations
3. **Seed**: Populates database with sample data
4. **Build**: Compiles the SvelteKit application

### Configuration

The build command is configured in `wrangler.toml`:

```toml
[build]
command = "npm run build:pages"
```

This runs the `scripts/preview-build.js` script which handles environment
detection and database setup.

### Environment Variables

Cloudflare Pages provides these environment variables:

- `CF_PAGES`: Set to `"1"` for all Pages builds
- `CF_PAGES_BRANCH`: The git branch being built
- Production branches: `main` or `master`
- Preview branches: Any other branch name

### Manual Database Management

You can still manually manage preview databases:

```bash
# Reset and re-seed preview database
npm run db:reset:preview

# Run migrations only
npm run db:migrate:preview

# Seed with sample data
npm run db:seed:preview
```

## Troubleshooting

### Database Not Available

If `platform.env.DB` is undefined:

1. Check `wrangler.toml` configuration
2. Ensure migrations have been applied
3. Restart the dev server

### Migration Errors

If migrations fail:

1. Check SQL syntax
2. Verify foreign key references
3. Review Wrangler logs

### Site Not Found

If site lookup fails:

1. Ensure seed data has been loaded
2. Check domain configuration
3. Verify database connection

## Resources

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [SvelteKit Platform Context](https://kit.svelte.dev/docs/adapter-cloudflare)
