# Agent Guidelines

Guidelines for AI agents (Claude Code, Amp, GitHub Copilot, etc.) working on
this codebase — the **Ammoura™** multi-tenant eCommerce platform (codenamed
**Hermes**).

## Development Workflow

### Commands

- **Install**: `npm install` - Install dependencies (npm is the package
  manager; Node.js 18+)
- **Dev**: `npm run dev` - Start development server on **port 4236**
  - The dev server is almost always already running in another terminal on
    port 4236. **Do not** start a second one — use
    `http://localhost:4236` and check for a process on port 4236 before
    launching a new server.
- **Build**: `npm run build` - Build for production (Cloudflare adapter, then
  `scripts/wrap-worker.js`, which adds the `scheduled()` handler the adapter
  does not emit — see [docs/SCHEDULED_JOBS.md](docs/SCHEDULED_JOBS.md))
- **Preview**: `npm run preview` - Build + preview against the remote preview
  DB; `npm run preview:local` uses the local DB (migrates + seeds first);
  `npm run preview:prod` previews against production bindings
- **Type check**: `npm run check` - svelte-kit sync + svelte-check
- **Lint**: `npm run lint` - Prettier check + ESLint
- **Format**: `npm run format` - Format code with Prettier
- **Test**: `npm test` - Run tests once with Vitest (`npm run test:watch` for
  watch mode, `npm run test:coverage` for coverage)
- **Single test**: `npm test -- tests/file.test.ts` - Run a specific test file
  (also works for co-located `src/**/*.test.ts` files)
- **All quality gates**: `npm run gate` - Runs lint, check, and test in
  sequence; this must pass before work is considered complete. CI runs the same
  three on every pull request (see [docs/CI.md](docs/CI.md))
- **Deploy**: automatic. A merge to `main` builds, migrates production D1 and
  runs `wrangler deploy` from GitHub Actions. Never migrate or deploy production
  from a local machine; `npm run deploy` is for recovery only

### Database Commands

Scripts live in `scripts/` and wrap `wrangler d1 migrations apply` etc.:

- `npm run db:migrate` / `db:migrate:local` / `db:migrate:preview` - Apply
  pending migrations (production / local / preview DB)
- `npm run db:seed` / `db:seed:local` / `db:seed:preview` - Seed sample data
- `npm run db:setup:local` / `db:setup:local:seed` - Migrate (+ seed) the
  local D1 database; `db:setup:preview` / `db:setup:preview:seed` for preview
- `npm run db:reset:local` / `db:reset:preview` - Reset and reseed
- `npm run db:backup` / `db:backup:preview` / `db:backup:local` and
  `npm run db:restore` - Backup/restore (see `docs/DATABASE_BACKUP_RESTORE.md`)
- `npm run db:test-migrations` - Test migrations against a staging copy
- `npm run seed:production` / `seed:preview` / `seed:local` - Production-style
  seeding (see `docs/PRODUCTION_SEEDING.md`)

### Contribution Workflow

Every repository in the **AmmouraMe** organization follows the same four steps —
`Ammoura-Svelte`, `nabu`, `teaser`, and anything added later. Humans and AI
agents work the same way.

1. **Start from an issue, and claim it.** Work is tracked in GitHub Issues.
   Before writing code, take the issue: assign yourself, or comment that you
   are picking it up. This is what stops two people — or two agents — landing
   on the same work.
2. **Work on a branch.** Never commit to `main`. Cut `feature/<short-name>` for
   new work or `fix/<short-name>` for a bug. Include the issue number when it
   helps: `feature/68-code-editor`.
3. **Open a draft PR early.** As soon as there is a first commit, open the pull
   request **as a draft**. Do not wait until the work is done. An early draft
   shows what is in flight, gives CI somewhere to run, and lets reviewers
   comment before the design hardens. Link the issue in the body (`Closes #68`)
   so it closes on merge.
4. **Finish, then mark ready for review.** When the feature or fix is complete
   and the quality gates are green, update the PR description to say what
   actually landed, then take it out of draft and mark it **Ready for review**.

In short: the issue says _what_, the branch holds _how_, the draft PR shows
_progress_, and "ready for review" means _done_.

### Commits

- Use atomic commits with clear, descriptive messages
- Write commit messages in imperative mood: "Add feature" not "Added feature"
- Include issue or ticket references when applicable (e.g., `refs #123`)
- Keep commits logically grouped; avoid mixing unrelated changes
- The husky pre-commit hook runs `npm run gate` (Prettier check, ESLint,
  svelte-check, tests); commits fail if any of them fails

## Big-Picture Architecture

### Multi-Tenancy Model

One deployment serves many independent stores/sites. See
`docs/MULTI_TENANT.md`.

- **Site resolution**: `src/hooks.server.ts` extracts the hostname from each
  request, looks up the matching site in D1, and puts the tenant context on
  `event.locals`. Free platform subdomains use the wildcard domain in
  `wrangler.toml` (`PLATFORM_SITES_DOMAIN`, `ammoura.me` in production);
  locally this falls back to `localhost`, so sites are reachable at
  `http://<slug>.localhost:4236`.
- **Data scoping**: every tenant-specific table has a `site_id` column, and
  **every DB query must filter by `site_id` in its WHERE clause**. Use the
  tenant context from `locals` in server load functions/actions. This is the
  core isolation guarantee — never bypass it.
- **Roles**: `admin`, `platform_engineer`, `customer` (session-based auth with
  secure cookies; see `docs/AUTHENTICATION_SETUP.md`). A user session is only
  honoured on the site it was created for. Only a platform engineer may grant
  or revoke `platform_engineer` (`canAssignRole` in `$lib/server/permissions`),
  and nobody may grant a permission they do not hold.

### Cloudflare Platform

- Deployed as a Cloudflare **Worker** with static assets (`wrangler.toml`;
  migrated from Cloudflare Pages). `main` is the built SvelteKit worker — the
  adapter writes to that path, and `scripts/wrap-worker.js` then swaps in a
  wrapper that adds `scheduled()` (`docs/SCHEDULED_JOBS.md`). Never point
  `main` at a hand-written file: the adapter overwrites it.
- **D1** (`DB` binding) is the database; **R2** (`MEDIA_BUCKET`) stores media;
  optional **KV** (`SITE_ROUTES`) caches hostname → site id routing.
- Separate production and preview databases/buckets are configured in
  `wrangler.toml` (`env.preview`).
- Workers runtime: no Node.js APIs; access bindings via
  `locals.platform.env`. D1 does not enforce foreign keys — handle
  referential integrity in application code.
- Secrets: `.dev.vars` (gitignored) locally, `wrangler secret put` in
  production (e.g., `PLATFORM_ENGINEER_PASSWORD`).

### D1 Schema & Migrations

- Migrations live in `migrations/` as sequential `XXXX_description.sql` files
  applied via `wrangler d1 migrations apply` (wrapped by
  `scripts/db-migrate.js`).
- **Applied migrations are immutable**: never edit an existing migration file
  — `npm run deploy` applies migrations to the **production** database, so
  changing history breaks deployed environments. Always add a new
  sequential file (increment from the highest existing number) and test with
  `npm run db:migrate:local` (and `npm run db:test-migrations`) before
  deploying.
- Prefer idempotent statements (`IF NOT EXISTS`) and include a rollback
  strategy in comments.

### Route Structure

`src/routes/` (SvelteKit file-based routing):

- `[...slug]/` - Catch-all that renders builder-created CMS pages
- `admin/` - Admin dashboard (products, orders, pages/WYSIWYG builder,
  settings, users)
- `api/` - JSON/server endpoints (`+server.ts`)
- `cart/`, `checkout/`, `product/` - Storefront commerce flows
- `auth/`, `signup/`, `verify-email/`, `account/`, `user/` - Authentication
  and account management

### Key Subsystems

- **WYSIWYG page builder**: widget/component composition system with page
  revisions (`docs/WYSIWYG_PAGE_BUILDER.md`, `docs/EDITOR_ARCHITECTURE.md`,
  `docs/REVISIONS.md`)
- **Theme system**: CSS custom properties, per-page overrides, dark mode
  (`docs/THEME_SYSTEM.md`)
- **Integrations**: OAuth/SSO providers (`docs/OAUTH_SSO_SETUP.md`), Printful
  fulfillment (`docs/PRINTFUL_INTEGRATION.md`), shipping (`docs/SHIPPING.md`)
- **Scheduled jobs**: recurring work on Cloudflare Cron Triggers, declared in
  `src/lib/server/scheduler/registry.ts` (`docs/SCHEDULED_JOBS.md`)
- Comprehensive docs live in `docs/`; read the relevant doc before modifying a
  core feature, and update docs when adding significant features. `llms.txt`
  and `llms-full.txt` in the repo root contain Svelte/SvelteKit documentation
  optimized for LLM consumption.

## Code Standards

### Framework & Language

- **Primary Framework**: SvelteKit with TypeScript (strict mode)
- **Deployment**: Cloudflare Workers with Wrangler
- **Package Manager**: npm
- **Testing**: Vitest with Testing Library for unit tests

### Code Style

- **Formatting**: 2 spaces indentation, semicolons required, single quotes for
  strings
- **TypeScript**: Strict mode enabled; explicit return types on all functions;
  no `any` (use `unknown` or proper types); `import type` for type-only
  imports; use App namespace types
- **Naming Conventions**:
  - `camelCase` for variables and functions
  - `PascalCase` for components, stores, and classes
  - `UPPER_SNAKE_CASE` for constants and environment variables
  - `kebab-case` for CSS classes and route folders
- **Imports**: ES6 imports; organize by:
  1. SvelteKit imports (`import { ... } from '$app/...'`)
  2. External/third-party libraries
  3. Internal modules (relative paths)

### File Structure

Follow SvelteKit conventions:

- `src/routes/` - Route components and layouts
- `src/lib/components/` - Reusable Svelte components
- `src/lib/server/` - Server-only code; `src/lib/server/db/` is the database
  layer (one file per entity, multi-tenant aware, prepared statements only)
- `src/lib/stores/` - Svelte stores (`auth`, `cart`, `checkout`, `confirm`,
  `products`, `prompt`, `theme`, `toast`, ...)
- `src/lib/types/` - TypeScript type definitions
- `src/lib/utils/` - Utility functions
- `src/hooks.server.ts` - Server hooks (multi-tenant context, auth)
- `tests/` - Test files (tests may also be co-located as `*.test.ts`)

### Components

- Use `.svelte` file extension
- Declare props with `export let` statements at the top
- Use `$:` reactive statements for computed values
- Keep components focused and reusable
- Document component props with JSDoc comments

### Error Handling

- Use SvelteKit's error pages (create `+error.svelte` in routes) and helpers
  (`error()`, `redirect()`, `fail()` with field-specific form errors)
- Wrap async operations in try/catch blocks
- Return meaningful error messages to users
- Log errors appropriately for debugging

### Documentation & Comments

- Use JSDoc for public APIs and exported functions/components
- Write comments for complex logic or non-obvious decisions
- Avoid obvious comments on simple code
- Keep README and docs up to date with API changes

## Testing & Quality Gates

- **TDD is the default**: write failing tests first (red), implement (green),
  refactor. See `.github/copilot-instructions.md` for detailed patterns.
- **Coverage thresholds (enforced)**: ≥80% lines/functions/statements, ≥75%
  branches on `src/lib/**` (routes and type definitions excluded); target
  90%. Check with `npm run test:coverage`.
- No failing tests allowed; `npm run check` must pass with zero TypeScript
  errors before a task is complete.
- **`npm run gate` is the gold standard** (lint → `check` → tests; the
  husky pre-commit hook runs it) — run it before considering any work
  finished. `npm run prepare` only installs the git hooks. Quality gates are never skipped (exception: explicit
  prototypes/spikes, which must be refactored with tests afterwards).

## Security (non-negotiable)

- **Never store or commit secrets in plaintext** — encrypt sensitive data at
  rest (API keys, tokens, PII; passwords hashed with salted PBKDF2-SHA256 via `$lib/server/password`, on
  the server — never accept a hash computed in the browser)
- **Always use prepared statements** — never string-concatenate SQL
- **Always filter by `site_id`** for tenant data (multi-tenant isolation)
- **Log significant actions** to activity logs via
  `logActivity()` (`src/lib/server/db/activityLogs.ts`): settings changes,
  content modifications, user/admin actions, orders/payments. Include
  `user_id`, `site_id`, entity type/id, and meaningful context; never log
  passwords, tokens, or full card numbers. Do not log page views or
  read-only operations.
- Validate and sanitize all inputs; escape output (XSS); rely on SvelteKit
  CSRF protection; use httpOnly/secure/sameSite cookies; verify role-based
  authorization before data access
- If unsure about security implications, **ask** — see the full checklist in
  `.github/copilot-instructions.md`

## Browser API Restrictions

**NEVER use native browser dialogs:**

- **prompt()** → Use `promptStore.show()` from `$lib/stores/prompt`
- **alert()** → Use `toastStore` from `$lib/stores/toast`
- **confirm()** → Use `confirmStore.show()` from `$lib/stores/confirm`

See `.github/copilot-instructions.md` for detailed usage examples.

## Integration Notes

- **GitHub Copilot**: Uses this file as context; maintain clear, structured
  guidelines. Detailed patterns and examples live in
  `.github/copilot-instructions.md`.
- **Amp**: References this file for code style and command conventions; keep
  examples accurate and tested
- **Claude Code**: `CLAUDE.md` points here; this file is the canonical source
- All agents follow the code standards above; consistency across
  agent-generated code is prioritized

## Related Projects

Hermes lives inside a multi-repo workspace (each sibling is its own git
repository — never run git commands from the workspace root):

- [../CLAUDE.md](../CLAUDE.md) - Workspace map of the parent multi-repo
  workspace (project list, ports, package managers, conventions)
- [../NebulaKit/AGENTS.md](../NebulaKit/AGENTS.md) - SvelteKit + Cloudflare
  starter template with strict TDD/coverage rules; several sibling apps
  derive from it
- [../spacebot/CLAUDE.md](../spacebot/CLAUDE.md) - Discord bot platform;
  another SvelteKit + Cloudflare + D1 app with similar migration and tenancy
  conventions
