# Database Backup and Restore Guide

This guide explains how to backup, restore, and safely test migrations against production data without ever disrupting production.

## Overview

Ammoura provides a complete database backup and restore system that allows you to:

1. **Backup** production, preview, or local databases to SQL files
2. **Restore** backups to staging, local, or preview environments
3. **Test migrations** against a clone of production data
4. **Download backups** for safekeeping or disaster recovery

## Quick Start

### Test Migrations Safely (Recommended)

The easiest way to test your migrations against production data:

```bash
npm run db:test-migrations
```

This single command will:

1. Backup your production database
2. Create a staging database (if needed)
3. Restore the production backup to staging
4. Run all pending migrations on staging
5. Report success or failure

If migrations fail on staging, **do not deploy to production**!

### Manual Backup and Restore

```bash
# Backup production database
npm run db:backup

# Restore to staging for testing
npm run db:restore -- --file backups/2026-01-26T12-00-00_production.sql --to staging

# Restore to local for development
npm run db:restore -- --file backups/2026-01-26T12-00-00_production.sql --to local
```

## Commands Reference

### Backup Commands

| Command                        | Description                           |
| ------------------------------ | ------------------------------------- |
| `npm run db:backup`            | Backup production database            |
| `npm run db:backup:production` | Backup production database (explicit) |
| `npm run db:backup:preview`    | Backup preview database               |
| `npm run db:backup:local`      | Backup local database                 |

**Options:**

- `--output <path>` - Custom output file path
- `--no-data` - Schema only, no data

**Examples:**

```bash
# Backup with custom filename
npm run db:backup -- --output my-backup.sql

# Backup schema only (no data)
npm run db:backup -- --no-data
```

### Restore Commands

```bash
npm run db:restore -- --file <backup.sql> --to <target>
```

**Targets:**

| Target       | Description                | Safety                  |
| ------------ | -------------------------- | ----------------------- |
| `staging`    | Cloud staging database     | ✅ Safe                 |
| `local`      | Local development database | ✅ Safe                 |
| `preview`    | Cloud preview database     | ⚠️ Careful              |
| `production` | Production database        | 🛑 Requires `--confirm` |

**Options:**

- `--file <path>` - Path to backup SQL file (required)
- `--to <target>` - Target database (required)
- `--confirm` - Required for production restores
- `--wipe` - Wipe target before restore

**Examples:**

```bash
# Restore to staging (auto-wipes)
npm run db:restore -- --file backups/backup.sql --to staging

# Restore to local development
npm run db:restore -- --file backups/backup.sql --to local

# Restore to production (DANGER - requires confirmation)
npm run db:restore -- --file backups/backup.sql --to production --confirm
```

### Migration Testing

```bash
npm run db:test-migrations
```

**Options:**

- `--seed` - Also test seed scripts after migrations
- `--skip-backup` - Use existing backup (faster)
- `--file <path>` - Use specific backup file
- `--keep` - Keep staging data after test

**Examples:**

```bash
# Full test with fresh backup
npm run db:test-migrations

# Quick re-test using existing backup
npm run db:test-migrations -- --skip-backup

# Test with specific backup file
npm run db:test-migrations -- --file backups/known-good.sql

# Test migrations and seeds
npm run db:test-migrations -- --seed
```

## Backup Storage

Backups are stored in the `backups/` directory (gitignored):

```
backups/
├── .gitignore                          # Ignores all backup files
├── 2026-01-26T12-00-00_production.sql  # Production backup
├── 2026-01-26T12-00-00_preview.sql     # Preview backup
└── 2026-01-26T12-00-00_local.sql       # Local backup
```

**Naming Convention:** `<timestamp>_<environment>.sql`

## Environments

### Production (`hermes-db`)

- **Database ID:** `2e952313-eb3d-4a77-914f-828a112a317b`
- Contains real customer data
- Migrations run on deploy
- **NEVER** seed or wipe

### Preview (`hermes-db-preview`)

- **Database ID:** `a60090e4-72b8-4101-a4f2-83d19c4b6266`
- Used for PR preview deployments
- Auto-wiped and seeded on each deploy
- Safe for testing

### Staging (`hermes-db-staging`)

- **Created on first use** by `db:test-migrations`
- Clone of production for migration testing
- Safe to experiment with
- Can be wiped and restored freely

### Local

- SQLite database in `.wrangler/state/`
- Used for local development
- Can be wiped freely

## Workflows

### Pre-Deployment Migration Testing

Before deploying new migrations to production:

```bash
# 1. Test migrations against production clone
npm run db:test-migrations

# 2. If successful, deploy
npm run deploy
```

### Disaster Recovery

If production gets corrupted:

```bash
# 1. Use a known-good backup
npm run db:restore -- --file backups/known-good.sql --to production --confirm

# 2. Type "RESTORE PRODUCTION" when prompted
```

### Development with Production Data

To develop with realistic data:

```bash
# 1. Backup production
npm run db:backup

# 2. Restore to local
npm run db:restore -- --file backups/latest.sql --to local

# 3. Start development
npm run dev
```

### Scheduled Backups

For automated backups, add a GitHub Action or Cloudflare Worker that runs:

```bash
npm run db:backup
```

Store backups in R2, S3, or another cloud storage service.

## Staging Database Setup

The first time you run `npm run db:test-migrations`, it will:

1. Create a new D1 database called `hermes-db-staging`
2. Display the database ID
3. Suggest adding it to `wrangler.toml`

Update `wrangler.toml` with the real staging database ID:

```toml
[env.staging]
name = "hermes-staging"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "hermes-db-staging"
database_id = "YOUR_ACTUAL_STAGING_DB_ID"
migrations_dir = "migrations"
```

## Best Practices

### Before Every Production Deploy

1. ✅ Run `npm run db:test-migrations`
2. ✅ Verify migrations applied successfully
3. ✅ Run `npm run deploy`

### Regular Backups

- Schedule daily production backups
- Keep at least 7 days of backups
- Store backups in multiple locations

### When Testing Migrations

- Always test against a fresh production clone
- Test both migrations AND rollback scenarios
- Verify data integrity after migrations

### Security

- Backup files contain ALL production data
- Never commit backups to git (they're gitignored)
- Store backups securely (encrypted if possible)
- Limit access to backup/restore commands

## Troubleshooting

### "Database not found"

```bash
# List available databases
npx wrangler d1 list
```

### "Permission denied"

Ensure you're logged into Wrangler:

```bash
npx wrangler login
```

### Large Database Backups

For very large databases, backups may take several minutes. The progress will be shown in the terminal.

### Restore Fails Halfway

If a restore fails partway through:

1. Wipe the target database
2. Try the restore again

```bash
npm run db:restore -- --file backup.sql --to staging --wipe
```

## Related Documentation

- [Database Management](./DATABASE_MANAGEMENT.md) - General database workflows
- [Multi-Tenant Architecture](./MULTI_TENANT.md) - How tenant isolation works
- [Preview Database Setup](./PREVIEW_DATABASE_SETUP.md) - Preview environment details
