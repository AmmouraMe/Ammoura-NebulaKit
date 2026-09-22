# Ammoura™ eCommerce Platform

| Statements                                                                              | Branches                                                                            | Functions                                                                             | Lines                                                                         |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| ![Statements](https://img.shields.io/badge/statements-95%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-92%25-brightgreen.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-96%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-95%25-brightgreen.svg?style=flat) |

Ammoura is a modern multi-tenant eCommerce platform built with SvelteKit and
TypeScript, deployed as a Cloudflare Worker with D1 database and R2 storage. It
features a WYSIWYG page builder, responsive design, and comprehensive theme
system. It supports role-based authentication and is designed for scalability
and maintainability. It includes a robust testing suite and follows strict code
quality standards. It is intended to serve as a foundation for building
customizable online stores with ease. It has a modular architecture to
facilitate future enhancements. It will prioritize security best practices and
data integrity. It has a way for site owners to manage products, orders, and
customers through an admin dashboard which will include analytics and reporting
features. It will also support integrations with third-party services such as
payment gateways and shipping providers. It will be optimized for performance
and SEO. It has detailed documentation to assist developers in understanding and
extending the platform. It has features for AI assistance in content creation
and customer support. It will comply with relevant data protection regulations.

## 🚀 Stack & Features

- **SvelteKit** - Modern web framework with TypeScript support
- **Cloudflare Workers** - Edge deployment with static assets
- **Cloudflare D1** - Serverless SQL database with multi-tenant support
- **TypeScript** - Type-safe development
- **Multi-Tenant Architecture** - Support for multiple stores/sites
- **Multi-Provider SSO** - OAuth 2.0 authentication with Google, Facebook,
  GitHub, etc.
- **Responsive Design** - Mobile-first and responsive design for all features

## 📦 Contributing Code / Local Dev Setup

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

### Prerequisites

- Node.js 18+
- npm

### Quick Setup

```bash
# Fork the repository on your local system
git clone https://github.com/AmmouraMe/Ammoura-NebulaKit.git

# Change to the project directory
cd Ammoura-NebulaKit

# Install npm packages
npm install

# Create D1 database. The `hermes-` prefix is the project's old codename and is
# kept deliberately: these names match live Cloudflare resources, so they are
# identifiers rather than branding. Match whatever wrangler.toml declares.
wrangler d1 create hermes-db
# Update wrangler.toml with the database_id from output of above command

# Setup database (migrate + seed for local dev)
npm run db:setup:local

# Run local dev server
npm run dev

# Open local instance
open http://localhost:4236/
```

## 🛠️ Available Scripts

### Development

- `npm run dev` - Start the plain Vite development server on port 4236
- `npm run preview` - Build and preview with the remote preview bindings
- `npm run preview:local` - Build, migrate and seed local D1, then preview
- `npm test` - Run tests with Vitest
- `npm run test:coverage` - Run tests with coverage report
- `npm run badges` - Run coverage and refresh the README coverage badges (see
  [COVERAGE_BADGE_SETUP.md](COVERAGE_BADGE_SETUP.md))
- `npm run gate` - Lint, check and test, the same three things CI runs

### Database Management

- `npm run db:setup:local` - Migrate and seed local database
- `npm run db:migrate:local` - Run migrations on local database
- `npm run db:seed:local` - Seed local database with sample data
- `npm run db:setup:preview` - Migrate and seed preview database
- `npm run db:migrate` - Run migrations on production database

See [docs/DATABASE_MANAGEMENT.md](docs/DATABASE_MANAGEMENT.md) for detailed
database management guide.

## 🗄️ Database

The platform uses Cloudflare D1 for data persistence with full multi-tenant
support. Database migrations and seeding use explicit scripts:

- **Development**: Easily reset database: `npm run db:reset:local`
- **Local preview**: `npm run preview:local` migrates and seeds local D1
- **Production**: Migrated by CI on merge to `main`, never from a laptop
  (seeding is blocked for safety)

### Database Scripts

```bash
# Local development
npm run db:migrate:local    # Run migrations only
npm run db:seed:local       # Seed with sample data
npm run db:setup:local      # Both migrate and seed
npm run db:reset:local      # Dangerously reset and seed

# Production — CI runs these on merge to `main`. See docs/CI.md.
npm run db:migrate          # Run migrations only (no seed)
npm run deploy              # Migrate, then deploy
```

See [docs/DATABASE_MANAGEMENT.md](docs/DATABASE_MANAGEMENT.md) for complete
database management guide.

## 🌐 Deployment

**Deployment is automatic.** A merge to `main` builds the project, applies the
production D1 migrations and runs `wrangler deploy` from GitHub Actions. Nobody
runs a deploy command on their own machine, and production migrations run in CI
and nowhere else. See [docs/CI.md](docs/CI.md).

`npm run deploy` still exists for recovery, but it is not part of the normal
path.

### Build Configuration

- **Build Command**: `npm run build`
- **Worker Entry**: `.svelte-kit/cloudflare/_worker.js`
- **Node.js Version**: 22 (pinned in `.nvmrc`; CI uses the same file)
- **D1 Database**: Configured in `wrangler.toml`

## 🔧 Configuration

### Cloudflare Adapter

The project uses `@sveltejs/adapter-cloudflare` configured in `svelte.config.js`
for:

- Edge-side rendering
- Static asset optimization
- Platform proxy support

### Wrangler Configuration

See `wrangler.toml` for Cloudflare Workers configuration.

## 📈 Next Steps

This foundation includes:

- ✅ SvelteKit project with TypeScript
- ✅ Cloudflare Workers adapter configuration
- ✅ Modern tooling setup (ESLint, Prettier, Vitest)
- ✅ Basic styling and responsive layout

### Database Features

- ✅ Multi-tenant architecture (site-scoped data)
- ✅ Products, users, orders, and carts tables
- ✅ Repository pattern for data access
- ✅ Migration system
- ✅ Type-safe database queries

### Upcoming Features

- Payment integration
- Advanced admin features
- Inventory management
- Analytics and reporting

## 🤖 GitHub Copilot Configuration

This project is configured with comprehensive GitHub Copilot instructions to
ensure:

- ✅ **Consistent Code Quality**: Automatic adherence to project standards
- ✅ **Test Coverage**: Enforced 80%+ coverage (target: 90%)
- ✅ **Type Safety**: Strict TypeScript with explicit return types
- ✅ **Formatting**: Automatic Prettier formatting (2 spaces, single quotes, no
  trailing commas)
- ✅ **TDD Approach**: Tests written before implementation

### Quality Gates

Before ANY code is considered complete:

```bash
npm run gate  # Runs lint, check, and test
```

All code must pass:

- `npm run lint` - Prettier formatting and ESLint checks
- `npm run check` - TypeScript type checking
- `npm run test:coverage` - Test coverage ≥80%

CI runs the same commands on every pull request, drafts included, and the
result is required before merge. See [docs/CI.md](docs/CI.md).

### For Developers Using Copilot:

See [docs/GITHUB_COPILOT_SETUP.md](docs/GITHUB_COPILOT_SETUP.md) for complete
Copilot configuration details.

---

## 📜 Brand & Legal

**Ammoura™** is a trademark of David William Monaghan.

**Name Origin:** Inspired by King Hammurabi of Babylon (c. 1792-1750 BCE), creator of one of history's first commercial legal codes. Just as Hammurabi brought order and fairness to ancient markets, Ammoura provides the foundation for modern digital commerce.

**Copyright © 2025 StarSpace Group.**

This software is free software licensed under the **GNU Affero General Public
License v3.0** — see [LICENSE.md](LICENSE.md) and [NOTICE.md](NOTICE.md) (which
also covers the bundled Editor.js components, Apache-2.0). The Ammoura™ name and
brand are protected trademarks and are not covered by that licence.
