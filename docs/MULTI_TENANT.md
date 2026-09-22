# Multi-Site Architecture Overview

This document provides a high-level overview of the multi-tenant architecture implemented in Ammoura platform.

## What is Multi-Tenancy?

Multi-tenancy allows a single deployment of the Ammoura platform to serve multiple independent stores/sites. Each site:

- Has its own isolated data (products, users, orders)
- Can use a custom domain
- Maintains its own settings and configuration
- Operates independently while sharing the same codebase

## How It Works

### 1. Site Resolution

When a request comes in:

```
Request → hooks.server.ts → Lookup site by hostname → Set site_id in locals
```

The `hooks.server.ts` file automatically:

1. Extracts the hostname from the request (e.g., `store1.example.com`)
2. Queries the database for a site with that domain
3. Stores the `site_id` in `event.locals.siteId`
4. Makes it available to all pages and endpoints

### 2. Data Scoping

All database queries are automatically scoped by `site_id`:

```typescript
// Every query includes site_id
const products = await getAllProducts(db, siteId);
const users = await getAllUsers(db, siteId);
const orders = await getAllOrders(db, siteId);
```

This ensures:

- Site A cannot see Site B's data
- No cross-contamination of data
- Proper data isolation

### 3. Database Schema

Every table that contains site-specific data has a `site_id` column:

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,  -- Links product to a specific site
  name TEXT NOT NULL,
  -- ... other columns
  FOREIGN KEY (site_id) REFERENCES sites(id)
);
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Internet Traffic                      │
└─────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    store1.com        store2.com        store3.com
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              SvelteKit + Cloudflare Pages                │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │            hooks.server.ts                       │   │
│  │  • Extracts hostname                             │   │
│  │  • Looks up site in database                     │   │
│  │  • Sets event.locals.siteId                      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Repository Layer                        │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Products    │  │    Users     │  │   Orders     │  │
│  │  Repository  │  │  Repository  │  │  Repository  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                 │                 │            │
│         └─────────────────┼─────────────────┘            │
│                           │                               │
│             All queries include site_id                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 Cloudflare D1 Database                   │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Site 1  │  │  Site 2  │  │  Site 3  │              │
│  │  Data    │  │  Data    │  │  Data    │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                           │
│  All data scoped by site_id                              │
└─────────────────────────────────────────────────────────┘
```

## Usage Example

### Setting Up Multiple Sites

1. **Create sites in the database:**

```sql
INSERT INTO sites (id, name, domain, description, status)
VALUES
  ('site-1', 'Electronics Store', 'electronics.example.com', 'Electronic gadgets', 'active'),
  ('site-2', 'Fashion Store', 'fashion.example.com', 'Fashion and apparel', 'active');
```

2. **Configure DNS:**
   - Point `electronics.example.com` to your Cloudflare Pages deployment
   - Point `fashion.example.com` to your Cloudflare Pages deployment

3. **Add products for each site:**

```typescript
// Products for Electronics Store
await createProduct(db, 'site-1', {
  name: 'Wireless Headphones',
  description: 'Premium audio',
  price: 199.99
  // ... other fields
});

// Products for Fashion Store
await createProduct(db, 'site-2', {
  name: 'Designer Dress',
  description: 'Elegant evening wear',
  price: 299.99
  // ... other fields
});
```

### Accessing Data in Pages

In any SvelteKit page or endpoint:

```typescript
// src/routes/+page.server.ts
import { getDB, getAllProducts } from '$lib/server/db';

export async function load({ platform, locals }) {
  const db = getDB(platform);
  const siteId = locals.siteId; // Automatically set by hooks.server.ts

  // This will only return products for the current site
  const products = await getAllProducts(db, siteId);

  return { products };
}
```

## Benefits

### For Platform Owners

- **Single Codebase**: Maintain one codebase for all sites
- **Scalability**: Add unlimited sites without additional infrastructure
- **Cost Efficiency**: Shared resources across all sites
- **Centralized Updates**: Deploy updates to all sites simultaneously

### For Store Owners

- **Data Isolation**: Complete separation of data between sites
- **Custom Domains**: Each site can have its own domain
- **Independent Configuration**: Each site can have unique settings
- **Performance**: Efficient queries with proper indexing

## Data Isolation Guarantees

### 1. Database Level

- Foreign key constraints ensure referential integrity
- Indexes optimize site-scoped queries
- Unique constraints prevent data leaks

### 2. Application Level

- All repository functions require `site_id`
- Hooks automatically set site context
- Type-safe interfaces prevent accidental cross-site queries

### 3. Query Level

- Every query includes `WHERE site_id = ?`
- Prepared statements prevent SQL injection
- Batch operations maintain site context

## Performance Considerations

### Indexing Strategy

```sql
-- All multi-tenant tables have site_id index
CREATE INDEX idx_products_site_id ON products(site_id);
CREATE INDEX idx_users_site_id ON users(site_id);
CREATE INDEX idx_orders_site_id ON orders(site_id);

-- Composite indexes for common queries
CREATE INDEX idx_products_category ON products(site_id, category);
CREATE INDEX idx_users_email ON users(site_id, email);
```

### Query Optimization

- Site lookups are cached in memory
- Prepared statements reduce parsing overhead
- Batch operations minimize round trips
- Indexes ensure fast site-scoped queries

## Security

### Multi-Tenant Security

1. **Data Isolation**: Site ID required for all queries
2. **SQL Injection Prevention**: Prepared statements only
3. **Secure ID Generation**: Cryptographically strong UUIDs
4. **Foreign Key Constraints**: Prevent orphaned records
5. **Unique Constraints**: Prevent duplicate data per site

### Best Practices

- Never trust client-provided site_id
- Always use locals.siteId from hooks
- Validate site exists before operations
- Use transactions for multi-step operations
- Audit site-crossing queries

## Limitations and Considerations

### Current Limitations

1. **Shared Resources**: All sites share the same database
2. **Single Region**: Data stored in one D1 region
3. **No Site-Specific Migrations**: Schema changes affect all sites

### Future Enhancements

1. **Per-Site Settings**: Custom themes, logos, payment processors
2. **Site-Specific Analytics**: Track metrics per site
3. **Resource Quotas**: Limit products/users per site
4. **Site Templates**: Quick setup for new sites
5. **Cross-Site Features**: Marketplace, cross-selling

## Migration from Single-Tenant

If migrating from a single-tenant system:

1. **Create default site:**

```sql
INSERT INTO sites (id, name, domain, description, status)
VALUES ('default-site', 'Default Store', 'localhost', 'Default site', 'active');
```

2. **Update existing data:**

```sql
-- Add site_id column to existing tables
ALTER TABLE products ADD COLUMN site_id TEXT DEFAULT 'default-site';
ALTER TABLE users ADD COLUMN site_id TEXT DEFAULT 'default-site';
-- Repeat for all tables
```

3. **Update application code:**
   - Add site_id parameters to repository functions
   - Update hooks to resolve site context
   - Test thoroughly before production deployment

## Monitoring and Debugging

### Check Current Site

```typescript
// In any server-side code
console.log('Current site:', locals.siteId);
```

### Query Site Data

```bash
# Check all sites
wrangler d1 execute hermes-db --command="SELECT * FROM sites"

# Check products for a specific site
wrangler d1 execute hermes-db --command="SELECT * FROM products WHERE site_id = 'site-1'"
```

### Debug Site Resolution

Add logging to `hooks.server.ts`:

```typescript
console.log('Hostname:', event.url.hostname);
console.log('Resolved site ID:', siteId);
```

## Resources

- [DATABASE.md](./DATABASE.md) - Complete database schema and API reference
- [D1_SETUP.md](./D1_SETUP.md) - Setup instructions
- [Cloudflare D1 Multi-Tenant Best Practices](https://developers.cloudflare.com/d1/examples/multi-tenant/)
