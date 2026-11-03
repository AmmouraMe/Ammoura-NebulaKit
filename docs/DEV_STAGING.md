# dev-staging environment

A production-shaped place to try a change before it reaches production. Same
Workers runtime, same adapter output and the same migrations, on its own D1
database and its own R2 bucket — so a bad migration or a bad seed cannot reach
`hermes-db` or `hermes-media`.

- **URL:** https://dev-staging-e2ab5e.ammoura.me
- **Worker:** `hermes-dev-staging` — the `[env.dev-staging]` block in
  `wrangler.toml`
- **D1:** `hermes-db-dev-staging`
- **R2:** `hermes-media-dev-staging`
- **DNS:** a Worker custom domain on the `ammoura.me` zone. Wrangler creates the
  record and issues the certificate; do not add the record by hand.

This is not a Cloudflare Pages environment. The platform runs as a Worker with
static assets, so an environment is a `[env.*]` block, not a Pages branch
setting.

## Deploying

```bash
npm run deploy:dev-staging      # migrate, build, then deploy
```

Unlike the production `deploy` script, this one builds first, so it deploys the
branch you are on rather than whatever is left in `.svelte-kit/`.

Production deploys are automatic and run from GitHub Actions. Staging is
deliberately manual: it is a place to put a branch, and a branch is chosen by
hand.

## What is in the database

Migrations only — one `default-site`, the seeded product templates, no users and
no products.

Provider credentials (Stripe, Printful, Resend) are not Worker secrets. They are
entered per site under `/admin/providers` and `/admin/settings/email` and stored
encrypted in D1, so a fresh staging database has none. Re-enter them in the
staging admin, with test keys.

Two Worker secrets do have to be set for the environment itself:

```bash
npx wrangler secret put ENCRYPTION_KEY --env dev-staging
npx wrangler secret put PLATFORM_ENGINEER_EMAIL --env dev-staging
```

Generate a staging `ENCRYPTION_KEY` of its own; never reuse production's. Sign up
at `/signup` with the address in `PLATFORM_ENGINEER_EMAIL` and the role is
applied on the next sign-in — see
[AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md).

### One-click logins

Staging sets `DEV_LOGIN = "true"` in its `[env.dev-staging.vars]`, so the DEV
panel that `vite dev` shows on `/auth/login` and `/account/login` is there too:
**New user**, **Existing user** (`dev@dev.local`, with a Dev Store) and
**Superadmin** (`superadmin@dev.local`, platform engineer). The gate is
`src/lib/server/dev-login.ts`; the panel and `/api/dev/login-as` both use it,
and only the exact string `"true"` switches it on. Production never sets it.

To work against realistic data instead, restore a production backup into the
staging database (`npm run db:backup:production`, then `npm run db:restore`).
Never repoint the staging binding at `hermes-db`.

## OAuth on staging

Register these redirect URIs exactly:

- `https://dev-staging-e2ab5e.ammoura.me/api/auth/oauth/google/callback`
- `https://dev-staging-e2ab5e.ammoura.me/api/auth/oauth/discord/callback`

Then set the credentials as Worker secrets, for example:

```bash
npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID --env dev-staging
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET --env dev-staging
```

The login page lists whichever providers it finds credentials for. No database
row and no redeploy are needed; a secret applies as soon as it is set. See
[OAUTH_SSO_SETUP.md](OAUTH_SSO_SETUP.md).

## Tenant subdomains do not work here

`PLATFORM_SITES_DOMAIN` is `dev-staging-e2ab5e.ammoura.me` rather than
`ammoura.me`. It has to be: with `ammoura.me`, `site-routing.ts` would read the
staging hostname itself as the tenant slug `dev-staging-e2ab5e` and every request
would miss into the default site.

The cost is that a tenant site on staging would be
`slug.dev-staging-e2ab5e.ammoura.me`, which does not resolve and could not be
certificated if it did — a wildcard covers exactly one label, so `*.ammoura.me`
does not reach a second level. Covering it needs a paid certificate.

Test tenant routing at `slug.localhost:4236` locally instead. See
[MULTI_TENANT.md](MULTI_TENANT.md).

## Known warning

The build warns that SvelteKit imports `node:async_hooks` without the
`nodejs_compat` compatibility flag. `wrangler.toml` sets no flags, so production
has the same warning. Staging is identical on purpose — if it ever bites, the
flag belongs on both.
