# Cloudflare D1 Setup Guide

This guide will help you set up Cloudflare D1 database for the Ammoura platform.

## Prerequisites

- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Authenticated with Wrangler (`wrangler login`)

## Step-by-Step Setup

### 1. Create D1 Database

```bash
# Create production database
wrangler d1 create hermes-db

# You'll receive output like:
# ✅ Successfully created DB 'hermes-db' in region WEUR
# Created your database using D1's new storage backend.
#
# [[d1_databases]]
# binding = "DB"
# database_name = "hermes-db"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2. Update wrangler.toml

Copy the `database_id` from the output above and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "hermes-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Replace with your database ID
migrations_dir = "migrations"
```

### 3. Apply Migrations

```bash
# For local development
wrangler d1 migrations apply hermes-db --local

# For production
wrangler d1 migrations apply hermes-db
```

### 4. Load Seed Data (Optional)

```bash
# For local development
wrangler d1 execute hermes-db --local --file=./migrations/0002_seed_data.sql

# For production
wrangler d1 execute hermes-db --file=./migrations/0002_seed_data.sql
```

## Verify Setup

### Check Database Tables

```bash
# Local
wrangler d1 execute hermes-db --local --command="SELECT name FROM sqlite_master WHERE type='table'"

# Production
wrangler d1 execute hermes-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### Query Sample Data

```bash
# Local
wrangler d1 execute hermes-db --local --command="SELECT * FROM sites"
wrangler d1 execute hermes-db --local --command="SELECT id, name, price FROM products LIMIT 5"

# Production
wrangler d1 execute hermes-db --command="SELECT * FROM sites"
```

## Local Development

### Start Dev Server

```bash
npm run dev
```

The local D1 database is automatically available via Wrangler's platform proxy. Data persists in `.wrangler/state/v3/d1/`.

### Reset Local Database

If you need to reset your local database:

```bash
# Delete local database state
rm -rf .wrangler/state/v3/d1/

# Re-apply migrations
wrangler d1 migrations apply hermes-db --local

# Re-load seed data
wrangler d1 execute hermes-db --local --file=./migrations/0002_seed_data.sql
```

## Production Deployment

### Deploy to Cloudflare Pages

```bash
# Build and deploy
npm run deploy

# Or via Cloudflare Pages dashboard
# Connect your repository and configure:
# - Build command: npm run build
# - Output directory: .svelte-kit/cloudflare
# - Environment variables: Add D1 database binding in dashboard
```

### Bind D1 Database in Cloudflare Dashboard

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages > Your Pages Project
3. Go to Settings > Functions
4. Under "D1 Database Bindings", add:
   - Variable name: `DB`
   - D1 Database: Select `hermes-db`

## Managing Migrations

### Create New Migration

```bash
# Create a new migration file
touch migrations/0003_add_new_feature.sql
```

Example migration:

```sql
-- migrations/0003_add_reviews.sql
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  user_id TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_site_product ON reviews(site_id, product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
```

### Apply New Migration

```bash
# Local
wrangler d1 migrations apply hermes-db --local

# Production
wrangler d1 migrations apply hermes-db
```

## Multi-Tenant Setup

### Create Additional Sites

```sql
-- Add a new site via SQL
INSERT INTO sites (id, name, domain, description, status)
VALUES (
  'site-2',
  'Second Store',
  'store2.example.com',
  'My Second Store',
  'active'
);
```

Or use the repository API in your code:

```typescript
import { getDB, createSite } from '$lib/server/db';

const db = getDB(platform);
const newSite = await createSite(db, {
  name: 'Second Store',
  domain: 'store2.example.com',
  description: 'My Second Store'
});
```

### Configure Custom Domains

1. Add custom domain in Cloudflare Pages settings
2. Update DNS records to point to Cloudflare
3. Add site entry in database with matching domain
4. The `hooks.server.ts` will automatically resolve the site based on hostname

## Monitoring and Debugging

### View Database Metrics

1. Go to Cloudflare Dashboard
2. Navigate to D1 > Your Database
3. View metrics for:
   - Read queries per second
   - Write queries per second
   - Storage size

### Query Database via Dashboard

1. Go to Cloudflare Dashboard
2. Navigate to D1 > Your Database
3. Use the Console tab to run SQL queries

### Enable Debug Logging

Add to your `.dev.vars` file for local development:

```
DEBUG=true
```

## Troubleshooting

### Database Not Found

**Error:** `D1 database is not available`

**Solutions:**

1. Check `wrangler.toml` has correct binding name (`DB`)
2. Ensure migrations have been applied
3. Restart dev server (`npm run dev`)
4. Check that `platformProxy` is configured in `svelte.config.js`

### Migration Failed

**Error:** `Migration failed to apply`

**Solutions:**

1. Check SQL syntax in migration file
2. Verify foreign key references are correct
3. Check for duplicate table/index names
4. Review migration order

### Site Not Resolved

**Error:** Site always resolves to `default-site`

**Solutions:**

1. Ensure site exists in database with correct domain
2. Check that domain matches request hostname
3. Verify `hooks.server.ts` is loaded
4. Check for errors in browser console

### Permission Denied

**Error:** `Authorization error`

**Solutions:**

1. Run `wrangler login` to authenticate
2. Check you have proper permissions for the D1 database
3. Verify you're in the correct Cloudflare account

## Best Practices

1. **Always test migrations locally first** before applying to production
2. **Backup production data** before running migrations
3. **Use transactions** for related operations
4. **Index frequently queried columns** (especially `site_id`)
5. **Monitor database size** and query performance
6. **Use prepared statements** (automatic with repository pattern)
7. **Handle errors gracefully** in your application code

## Resources

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Limits and Pricing](https://developers.cloudflare.com/d1/platform/limits/)
- [Ammoura Database Documentation](./DATABASE.md)
