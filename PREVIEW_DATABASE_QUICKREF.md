# Preview Database Quick Reference

## Overview

There are three database environments:

1. **Remote Preview D1** (`hermes-db-preview`) - Cloudflare's shared preview
   database. `npm run preview` and the **Preview deploy** GitHub Action use it.
2. **Local D1** - SQLite emulation stored in `.wrangler/state/`.
   `npm run preview:local` and `npm run dev` use it.
3. **Remote Production D1** (`hermes-db`) - `npm run preview:prod` uses it.

The `hermes-` prefix is the project's old codename. The names are live
Cloudflare resources; see `wrangler.toml`.

## Preview Commands

```bash
# Local build + remote preview database (matches the preview Worker)
npm run preview

# Local build + local database (fast development, no cloud connection)
npm run preview:local

# Local build + remote production database (test against prod data)
npm run preview:prod
```

### `npm run preview` (Remote Preview DB) ⭐ Recommended

- Builds the production bundle
- Runs `wrangler dev --remote --env preview` against the compiled worker
  (`.svelte-kit/cloudflare/_worker.js`)
- Uses the same D1 and R2 (`hermes-media-preview`) as the preview Worker
- Available at `http://localhost:4236`
- **Best for:** Testing what the preview deployment will show

### `npm run preview:local` (Local DB)

- Builds the production bundle
- Migrates and seeds the local D1 database (`db:setup:local:seed`)
- Runs `wrangler dev` with local bindings
- Available at `http://localhost:4236`
- **Best for:** Fast iteration when offline or avoiding cloud costs

### `npm run preview:prod` (Remote Production DB)

- Builds the production bundle
- Connects to the **remote production D1 database**
- Available at `http://localhost:4236`
- **Best for:** Debugging production issues locally
- ⚠️ **Caution:** This uses live production data!

## Preview Deployments

The preview Worker (`hermes-preview`) is deployed by hand. Open **Actions →
Preview deploy → Run workflow** in GitHub, pick the branch, and optionally give
a PR number to comment the URL on. The workflow builds, applies pending
migrations to the shared preview D1, and runs `wrangler deploy --env preview`.

Two things to know:

- The preview environment is **shared**. The last branch to run wins.
- The workflow **never wipes or reseeds** the preview database. Reset it by
  hand when a branch needs clean data (next section).

Details: [docs/CI.md](docs/CI.md#preview-deploys).

## Manual Database Commands

```bash
# Preview database (full reset with seed data)
npm run db:reset:preview

# Preview setup (migrate + seed, no wipe)
npm run db:setup:preview:seed

# Local database (full reset with seed data)
npm run db:reset:local

# Local setup (migrate + seed, no wipe)
npm run db:setup:local:seed
```

## Technical Details

| Command                 | Tool                                  | Bindings          | Use Case                        |
| ----------------------- | ------------------------------------- | ----------------- | ------------------------------- |
| `npm run preview`       | `wrangler dev --remote --env preview` | Remote preview    | Test against cloud preview data |
| `npm run preview:local` | `wrangler dev`                        | Local emulation   | Fast local testing (offline OK) |
| `npm run preview:prod`  | `wrangler dev --remote`               | Remote production | Debug prod issues               |

`wrangler dev` without `--remote` only emulates D1 and R2 locally. To reach
remote Cloudflare resources, the remote commands pass `--remote` and point at
the compiled worker entry point.

### First Run Notes

The first time you run `npm run preview`, wrangler may prompt you to
authenticate with Cloudflare. Run `wrangler login` first if needed.

## Troubleshooting

**Preview deploy fails with wrangler errors?** → Check the Cloudflare API
credentials in repository secrets (see [docs/CI.md](docs/CI.md)).

**Seed data missing?** → Run `npm run db:reset:preview`, then check
`scripts/seed-data.sql` for errors.
