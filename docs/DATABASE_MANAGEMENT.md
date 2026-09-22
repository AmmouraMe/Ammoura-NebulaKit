# Database Management

This document describes the database automation scripts and workflows for Ammoura platform.

## Overview

Ammoura uses Cloudflare D1 as its primary database with automated migration and seeding capabilities. The database setup is automated across different environments:

- **Local Development**: Auto-migrates and seeds on `npm run dev`
- **Preview**: Auto-migrates and seeds on `npm run preview`
- **Production**: Auto-migrates on `npm run build` and `npm run deploy` (no auto-seeding)

## NPM Scripts

### Database Setup

```bash
# Full database setup (migrate + seed) for local development
npm run db:setup:local

# Full database setup for preview environment
npm run db:setup:preview

# Full database setup for production (migrates only, no seed)
npm run db:setup
```

### Migrations

```bash
# Run migrations on local database
npm run db:migrate:local

# Run migrations on preview database
npm run db:migrate:preview

# Run migrations on production database
npm run db:migrate
```

### Seeding

```bash
# Seed local database (dev data)
npm run db:seed:local

# Seed preview database (dev data)
npm run db:seed:preview

# Seed production database (BLOCKED - will exit safely)
npm run db:seed
```

**Note:** Seeding is automatically blocked for production to prevent accidental data corruption.

## Automated Workflows

### Development Workflow

When you run `npm run dev`:

1. Database migrations are applied to local D1 database
2. Database is seeded with sample data
3. Development server starts

### Preview Workflow

When you run `npm run preview`:

1. Database migrations are applied to preview D1 database
2. Database is seeded with sample data
3. Preview server starts

### Build Workflow

When you run `npm run build`:

1. Database migrations are applied to production D1 database
2. Application is built for production
3. No seeding occurs (production safety)

### Deployment Workflow

When you run `npm run deploy`:

1. Database migrations are applied to production D1 database
2. Application is deployed to Cloudflare Pages
3. No seeding occurs (production safety)

## Migration Files

Migrations are stored in the `migrations/` directory:

- `0001_initial_schema.sql` - Initial database schema with multi-tenant support
- `0002_seed_data.sql` - Sample data for development/preview environments
- `0024_generic_revisions.sql` - Generic revision tracking system for products, pages, etc.

### Creating New Migrations

1. Create a new migration file in `migrations/` directory:

   ```bash
   touch migrations/0003_add_reviews_table.sql
   ```

2. Write your migration SQL:

   ```sql
   -- migrations/0003_add_reviews_table.sql
   CREATE TABLE IF NOT EXISTS reviews (
     id TEXT PRIMARY KEY,
     site_id TEXT NOT NULL,
     product_id TEXT NOT NULL,
     rating INTEGER NOT NULL,
     comment TEXT,
     created_at INTEGER NOT NULL,
     FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
     FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
   );

   CREATE INDEX IF NOT EXISTS idx_reviews_site_product ON reviews(site_id, product_id);
   ```

3. Run the migration:
   ```bash
   npm run db:migrate:local
   ```

## Environment-Specific Behavior

| Environment | Migrations | Seeding    | When                   |
| ----------- | ---------- | ---------- | ---------------------- |
| Local       | ✅ Auto    | ✅ Auto    | `npm run dev`          |
| Preview     | ✅ Auto    | ✅ Auto    | `npm run preview`      |
| Production  | ✅ Auto    | ❌ Blocked | `npm run build/deploy` |

## Manual Database Operations

### View Database Contents

```bash
# Local database
wrangler d1 execute hermes-db --local --command="SELECT * FROM sites"

# Production database
wrangler d1 execute hermes-db --command="SELECT * FROM sites"
```

### Execute Custom SQL

```bash
# Local database
wrangler d1 execute hermes-db --local --file=./custom-script.sql

# Production database
wrangler d1 execute hermes-db --file=./custom-script.sql
```

### Reset Local Database

```bash
# Delete local database state
rm -rf .wrangler/state/v3/d1/

# Re-run setup
npm run db:setup:local
```

## CI/CD Integration

For automated deployments, the database migrations run automatically:

### Cloudflare Pages

When deploying via Cloudflare Pages:

1. Set build command: `npm run build`
2. Migrations run automatically before build
3. No manual database setup required

### GitHub Actions

Example workflow:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

The `npm run deploy` command automatically runs migrations before deploying.

## Troubleshooting

### Migration Failed

If a migration fails:

```bash
# Check migration status
wrangler d1 migrations list hermes-db --local

# View database schema
wrangler d1 execute hermes-db --local --command=".schema"

# Rollback (manual)
# Note: D1 doesn't support automated rollbacks
# You'll need to write a reverse migration
```

### Seed Data Already Exists

The seed script is idempotent and uses `INSERT OR IGNORE` statements. Running it multiple times is safe.

### Database Not Found

Ensure the database is created in Cloudflare:

```bash
wrangler d1 create hermes-db
```

Then update the `database_id` in `wrangler.toml` with the returned ID.

## Best Practices

1. **Test migrations locally first**: Always run `npm run db:migrate:local` and verify before deploying
2. **Test against production clone**: Run `npm run db:test-migrations` before deploying to production
3. **Keep migrations small**: Each migration should do one thing
4. **Never modify existing migrations**: Create new migrations instead
5. **Use transactions**: Wrap related changes in transactions
6. **Document schema changes**: Add comments to migration files
7. **Backup before major changes**: Run `npm run db:backup` before running destructive migrations

## Backup and Restore

For backing up, restoring, and testing migrations against production data, see:

- **[Database Backup and Restore Guide](./DATABASE_BACKUP_RESTORE.md)** - Complete backup/restore documentation

Quick commands:

```bash
# Backup production database
npm run db:backup

# Test migrations against production clone (RECOMMENDED before deploy)
npm run db:test-migrations

# Restore backup to local for development
npm run db:restore -- --file backups/backup.sql --to local
```

## Security Notes

- Production database seeding is automatically blocked
- All migrations use prepared statements
- Foreign key constraints enforce referential integrity
- Site-scoped queries prevent cross-tenant data access

## Further Reading

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [D1 Migrations Guide](https://developers.cloudflare.com/d1/platform/migrations/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Database Schema Documentation](./DATABASE.md)
- [Revision System Documentation](./REVISIONS.md)
- [Database Backup and Restore Guide](./DATABASE_BACKUP_RESTORE.md)
