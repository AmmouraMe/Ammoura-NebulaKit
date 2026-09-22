# GitHub Copilot Instructions for Ammoura

## Project Overview

Ammoura is a modern multi-tenant eCommerce platform built with SvelteKit and TypeScript, deployed on Cloudflare Pages with D1 database and R2 storage. It features a WYSIWYG page builder, responsive design, and comprehensive theme system. It supports role-based authentication and is designed for scalability and maintainability. It includes a robust testing suite and follows strict code quality standards. It is intended to serve as a foundation for building customizable online stores with ease. It has a modular architecture to facilitate future enhancements. It will prioritize security best practices and data integrity. It has a way for site owners to manage products, orders, and customers through an admin dashboard which will include analytics and reporting features. It will also support integrations with third-party services such as payment gateways and shipping providers. It will be optimized for performance and SEO. It has detailed documentation to assist developers in understanding and extending the platform. It has features for AI assistance in content creation and customer support. It will comply with relevant data protection regulations.

## Tech Stack

- **Framework**: SvelteKit 2.x with TypeScript (strict mode)
- **Deployment**: Cloudflare Pages with Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite-based serverless SQL)
- **Storage**: Cloudflare R2 (for media files)
- **Testing**: Vitest with Testing Library
- **Code Quality**: ESLint 9, Prettier, svelte-check

## Contribution Workflow

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

## Development Commands

### Local Development Server

**IMPORTANT**: During local development, the development server is almost always already running in another terminal on **port 4236**. When testing or previewing changes:

- **DO NOT** start a new development server with `npm run dev`
- **DO** use the already running server at `http://localhost:4236`
- **DO** use Chrome Dev Tools MCP when needed, when it's available
- If you need to verify the server is running, check for processes on port 4236 rather than starting a new one.

Only start a new server if explicitly asked or if you confirm no server is currently running.

### Essential Commands

- `npm run dev` - Start development server (auto-migrates and seeds DB)
- `npm run build` - Build for production with Cloudflare adapter
- `npm run preview` - Preview production build locally (auto-migrates DB)
- `npm test` - Run tests with Vitest
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run check` - Type check with svelte-check
- `npm run gate` - Run `lint`, `check` and `test` in sequence
- Deployment is automatic on merge to `main` (see `docs/CI.md`); do not deploy
  or migrate production from a local machine

### Database Commands

- `npm run db:setup:local` - Migrate and seed local D1 database
- `npm run db:setup:preview` - Migrate and seed preview database
- `npm run db:migrate:local` - Run migrations on local database
- `npm run db:seed:local` - Seed local database with sample data
- `npm run db:reset:local` - Reset local database (keeps structure)

## Code Style & Conventions

### TypeScript

- **Strict mode enabled** - All type checks enforced
- **Explicit return types** - Always declare function return types
- **Use App namespace types** - Leverage SvelteKit's `App.Locals`, `App.Platform`, etc.
- **No `any` types** - Use `unknown` or proper typing
- **Import types** - Use `import type` for type-only imports

### Naming Conventions

- **camelCase**: Variables, functions, file names (except components)
- **PascalCase**: Svelte components, TypeScript interfaces/types, stores
- **UPPER_SNAKE_CASE**: Constants and environment variables
- **kebab-case**: CSS classes, route folders

### File Organization

```
src/
├── routes/              # SvelteKit routes (file-based routing)
│   ├── +page.svelte     # Page components
│   ├── +page.server.ts  # Server load functions
│   ├── +layout.svelte   # Layout components
│   └── +layout.server.ts # Layout load functions
├── lib/
│   ├── components/      # Reusable Svelte components
│   ├── server/          # Server-side only code
│   │   └── db/          # Database layer (multi-tenant aware)
│   ├── stores/          # Svelte stores (reactive state)
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── hooks.server.ts      # Server hooks (multi-tenant context)
└── app.d.ts            # Global type augmentation
```

### Import Order

1. SvelteKit imports (`@sveltejs/*`)
2. External libraries (alphabetical)
3. Internal modules (alphabetical)
4. Types (use `import type`)
5. CSS/styles (last)

Example:

```typescript
import { page } from '$app/stores';
import type { PageServerLoad } from './$types';

import { writable } from 'svelte/store';

import { getProducts } from '$lib/server/db/products';
import { formatPrice } from '$lib/utils/math';
import type { Product } from '$lib/types/products';

import './styles.css';
```

### Svelte Component Structure

```svelte
<script lang="ts">
  // 1. Imports
  import type { ComponentProps } from './types';

  // 2. Props (use export let)
  export let title: string;
  export let items: Item[] = [];

  // 3. Component state
  let count = 0;

  // 4. Reactive declarations
  $: doubled = count * 2;
  $: if (count > 10) {
    console.log('Count is high!');
  }

  // 5. Functions
  function handleClick(): void {
    count++;
  }

  // 6. Lifecycle (onMount, beforeUpdate, etc.)
  import { onMount } from 'svelte';
  onMount(() => {
    // initialization
  });
</script>

<!-- 7. Template -->
<div class="container">
  <h1>{title}</h1>
  <button on:click={handleClick}>Count: {count}</button>
</div>

<!-- 8. Styles (scoped by default) -->
<style>
  .container {
    padding: 1rem;
  }
</style>
```

### Formatting

- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Required
- **Quotes**: Single quotes for strings, double quotes in HTML attributes
- **Line length**: 100 characters (soft limit)
- **Trailing commas**: Yes (for multi-line)

## Architecture Patterns

### Multi-Tenant Architecture

- **Every DB query must use `tenantContext`** from `hooks.server.ts`
- **Site ID required** for all tenant-specific operations
- Use `locals.tenantContext` in server load functions
- Reference: `docs/MULTI_TENANT.md`

Example:

```typescript
export const load: PageServerLoad = async ({ locals, params }) => {
  const { siteId } = locals.tenantContext;
  const products = await getProducts(locals.platform.env.DB, siteId);
  return { products };
};
```

### Database Layer

- **Location**: `src/lib/server/db/`
- **Pattern**: One file per entity (e.g., `products.ts`, `pages.ts`)
- **Always use prepared statements** for SQL queries
- **Include site_id in WHERE clauses** for multi-tenant queries
- **Error handling**: Use try/catch and return meaningful errors

Example:

```typescript
export async function getProduct(
  db: D1Database,
  siteId: number,
  productId: number
): Promise<Product | null> {
  try {
    const result = await db
      .prepare('SELECT * FROM products WHERE site_id = ? AND id = ?')
      .bind(siteId, productId)
      .first<Product>();
    return result;
  } catch (error) {
    console.error('Failed to get product:', error);
    throw error;
  }
}
```

### Svelte Stores

- **Location**: `src/lib/stores/`
- **Use writable stores** for mutable state
- **Use derived stores** for computed values
- **Export store and typed helpers** (subscribe, set, update)
- Existing stores: `auth`, `cart`, `checkout`, `confirm`, `products`, `prompt`, `theme`, `toast`

Example:

```typescript
import { writable } from 'svelte/store';
import type { User } from '$lib/types/auth';

function createAuthStore() {
  const { subscribe, set, update } = writable<User | null>(null);

  return {
    subscribe,
    login: (user: User) => set(user),
    logout: () => set(null),
    updateProfile: (data: Partial<User>) => update((u) => (u ? { ...u, ...data } : null))
  };
}

export const auth = createAuthStore();
```

### Error Handling

- **Use SvelteKit error helpers**: `error()`, `redirect()`, `fail()`
- **Create +error.svelte pages** for custom error UI
- **Server errors**: Use try/catch, log errors, return user-friendly messages
- **Form validation**: Return `fail()` with field-specific errors

Example:

```typescript
import { fail, error } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const formData = await request.formData();
    const title = formData.get('title')?.toString();

    if (!title) {
      return fail(400, { title, missing: true });
    }

    try {
      await createPage(locals.platform.env.DB, title);
    } catch (e) {
      console.error('Failed to create page:', e);
      throw error(500, 'Failed to create page');
    }

    return { success: true };
  }
};
```

## Testing

### Test Structure

- **Location**: Co-located with source files (`*.test.ts`) or in `tests/` folder
- **Framework**: Vitest with Testing Library for Svelte
- **Coverage**: Aim for >80% coverage on critical paths
- **Run tests**: `npm test` or `npm run test:watch`

### Test Patterns

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Component from './Component.svelte';

describe('Component', () => {
  it('renders correctly', () => {
    render(Component, { props: { title: 'Test' } });
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(Component);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

## Test-Driven Development (TDD)

### TDD Philosophy

**ALWAYS write tests FIRST before implementing functionality.** TDD is the default development approach for this project.

### TDD Workflow (Red-Green-Refactor)

1. **RED**: Write a failing test that describes the desired behavior
2. **GREEN**: Write the minimum code needed to make the test pass
3. **REFACTOR**: Improve the code while keeping tests green

### When to Use TDD

**Always use TDD for:**

- New functions and utilities
- New database operations
- New API endpoints and server actions
- New stores and state management
- Business logic and data transformations
- Form validation logic
- Component behavior (user interactions, state changes)

**TDD is less critical for:**

- Simple UI styling (but test behavior)
- Initial prototypes/spikes (refactor with tests after)
- One-off scripts

### TDD Process Examples

#### Example 1: Creating a New Utility Function

```typescript
// Step 1: Write the test FIRST (utils/formatters.test.ts)
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatters';

describe('formatCurrency', () => {
  it('formats numbers as USD currency', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatCurrency(10.999)).toBe('$11.00');
  });
});

// Step 2: Run test - it FAILS (RED)
// Step 3: Implement the function (utils/formatters.ts)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// Step 4: Run test - it PASSES (GREEN)
// Step 5: Refactor if needed while keeping tests green
```

#### Example 2: Creating a Database Function

```typescript
// Step 1: Write the test FIRST (server/db/products.test.ts)
import { describe, it, expect, beforeEach } from 'vitest';
import { getProductsByCategory } from './products';

describe('getProductsByCategory', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { id: 1, name: 'Product 1', category: 'electronics' },
              { id: 2, name: 'Product 2', category: 'electronics' }
            ]
          })
        })
      })
    };
  });

  it('fetches products filtered by category', async () => {
    const products = await getProductsByCategory(mockDb, 1, 'electronics');

    expect(products).toHaveLength(2);
    expect(products[0].category).toBe('electronics');
    expect(mockDb.prepare).toHaveBeenCalledWith(
      expect.stringContaining('WHERE site_id = ? AND category = ?')
    );
  });

  it('returns empty array when no products found', async () => {
    mockDb.prepare().bind().all.mockResolvedValue({ results: [] });

    const products = await getProductsByCategory(mockDb, 1, 'nonexistent');
    expect(products).toEqual([]);
  });
});

// Step 2: Run test - it FAILS (RED)
// Step 3: Implement the function (server/db/products.ts)
export async function getProductsByCategory(
  db: D1Database,
  siteId: number,
  category: string
): Promise<Product[]> {
  try {
    const result = await db
      .prepare('SELECT * FROM products WHERE site_id = ? AND category = ?')
      .bind(siteId, category)
      .all<Product>();
    return result.results || [];
  } catch (error) {
    console.error('Failed to get products by category:', error);
    return [];
  }
}

// Step 4: Run test - it PASSES (GREEN)
// Step 5: Refactor if needed
```

#### Example 3: Creating a Svelte Component with TDD

```typescript
// Step 1: Write the test FIRST (components/ProductCard.test.ts)
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ProductCard from './ProductCard.svelte';

describe('ProductCard', () => {
  const mockProduct = {
    id: 1,
    name: 'Test Product',
    price: 29.99,
    image: '/test.jpg'
  };

  it('displays product name and price', () => {
    render(ProductCard, { props: { product: mockProduct } });

    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('$29.99')).toBeInTheDocument();
  });

  it('displays product image with alt text', () => {
    render(ProductCard, { props: { product: mockProduct } });

    const image = screen.getByAltText('Test Product');
    expect(image).toHaveAttribute('src', '/test.jpg');
  });

  it('emits addToCart event when button clicked', async () => {
    const user = userEvent.setup();
    const { component } = render(ProductCard, { props: { product: mockProduct } });

    const addToCartSpy = vi.fn();
    component.$on('addToCart', addToCartSpy);

    const button = screen.getByRole('button', { name: /add to cart/i });
    await user.click(button);

    expect(addToCartSpy).toHaveBeenCalledWith(
      expect.objectContaining({ detail: mockProduct })
    );
  });
});

// Step 2: Run test - it FAILS (RED)
// Step 3: Implement the component (components/ProductCard.svelte)
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Product } from '$lib/types/products';

  export let product: Product;

  const dispatch = createEventDispatcher<{ addToCart: Product }>();

  function handleAddToCart(): void {
    dispatch('addToCart', product);
  }
</script>

<div class="product-card">
  <img src={product.image} alt={product.name} />
  <h3>{product.name}</h3>
  <p>${product.price.toFixed(2)}</p>
  <button on:click={handleAddToCart}>Add to Cart</button>
</div>

// Step 4: Run test - it PASSES (GREEN)
// Step 5: Add styles, refactor
```

### TDD Best Practices

#### Test Organization

- **One test file per source file** - Keep tests close to implementation
- **Descriptive test names** - Use "it should..." or "it displays..." format
- **Arrange-Act-Assert** - Structure tests clearly
- **Test one thing** - Each test should verify a single behavior

#### Mock Strategy

- **Mock external dependencies** - Database, APIs, file system
- **Don't mock what you own** - Test real implementations of your utilities
- **Use Vitest's vi.fn()** - For function mocks and spies
- **Reset mocks between tests** - Use `beforeEach` for clean state

#### Coverage Goals

- **>80% line coverage** - Minimum for all new code
- **>90% branch coverage** - Critical paths and business logic
- **100% for utilities** - Pure functions should be fully tested
- **Run coverage regularly** - `npm run test:coverage`

#### Writing Testable Code

- **Pure functions** - Prefer functions without side effects
- **Dependency injection** - Pass dependencies as parameters
- **Single responsibility** - Functions should do one thing
- **Avoid tight coupling** - Make components loosely coupled

### TDD Integration with Workflow

```bash
# TDD Development Loop
1. npm run test:watch           # Start test watcher
2. Write failing test           # RED
3. Write minimal implementation # GREEN
4. npm run test:coverage        # Check coverage
5. Refactor and repeat          # REFACTOR

# Before committing
npm run gate                    # Runs lint, check, and test
```

### Common TDD Patterns

#### Testing Async Operations

```typescript
it('fetches data successfully', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
  expect(data.length).toBeGreaterThan(0);
});

it('handles errors gracefully', async () => {
  mockFetch.mockRejectedValue(new Error('Network error'));
  await expect(fetchData()).rejects.toThrow('Network error');
});
```

#### Testing State Changes

```typescript
it('updates count when button clicked', async () => {
  const user = userEvent.setup();
  render(Counter);

  const button = screen.getByRole('button');
  expect(screen.getByText('Count: 0')).toBeInTheDocument();

  await user.click(button);
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

#### Testing Form Validation

```typescript
it('shows error for invalid email', async () => {
  const user = userEvent.setup();
  render(LoginForm);

  const emailInput = screen.getByLabelText(/email/i);
  await user.type(emailInput, 'invalid-email');
  await user.tab(); // Trigger blur

  expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
});
```

### TDD Checklist

Before considering a feature complete:

- [ ] All tests written before implementation
- [ ] All tests pass (`npm test`)
- [ ] Coverage >80% for new code (`npm run test:coverage`)
- [ ] Edge cases tested (null, undefined, empty, errors)
- [ ] Integration points tested (DB queries, API calls)
- [ ] User interactions tested (clicks, typing, navigation)
- [ ] Error handling tested
- [ ] Tests are readable and maintainable

## Database Migrations

- **Location**: `migrations/` folder
- **Naming**: `XXXX_description.sql` (e.g., `0001_initial_schema.sql`)
- **Sequential numbering** - Always increment from last migration
- **Idempotent when possible** - Use `IF NOT EXISTS` clauses
- **Include rollback strategy** in comments
- **Test locally first** before deploying

Example:

```sql
-- Migration: 0012_add_user_preferences
-- Description: Add user preferences table for storing user settings
-- Rollback: DROP TABLE IF EXISTS user_preferences;

CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  site_id INTEGER NOT NULL,
  preferences TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_site ON user_preferences(site_id);
```

## Key Features

### WYSIWYG Page Builder

- **Location**: `src/routes/(admin)/dashboard/pages/`
- **Widget-based system** - Drag and drop widgets
- **Widget types**: Hero, Text, Image, Video, Product Grid, Custom HTML
- **Page revisions** - Track changes with auto-save
- **Reference**: `docs/WYSIWYG_PAGE_BUILDER.md`

### Theme System

- **CSS custom properties** for theming
- **Per-page color overrides** supported
- **Dark mode toggle** available
- **Responsive breakpoints**: mobile (< 768px), tablet (768-1024px), desktop (> 1024px)
- **Reference**: `docs/THEME_SYSTEM.md`

### Authentication

- **Session-based** with secure cookies
- **Roles**: admin, platform_engineer, customer
- **Protected routes** via hooks
- **Reference**: `docs/AUTHENTICATION_SETUP.md`

## Common Tasks

### Creating a New Page Route

1. Create `+page.svelte` in `src/routes/your-route/`
2. Add `+page.server.ts` if server-side data loading needed
3. Use TypeScript for all logic
4. Export `load` function for data fetching
5. Add tests in `page.test.ts`

### Creating a Database Entity

1. Add migration in `migrations/XXXX_entity_name.sql`
2. Create TypeScript interface in `src/lib/types/entity.ts`
3. Create DB functions in `src/lib/server/db/entity.ts`
4. Add tests for DB functions
5. Run `npm run db:migrate:local` to apply migration

### Creating a Reusable Component

1. Create `ComponentName.svelte` in `src/lib/components/`
2. Use TypeScript for props: `export let prop: Type;`
3. Export component from `src/lib/components/index.ts` if needed
4. Add JSDoc comments for prop documentation
5. Create tests: `ComponentName.test.ts`

### Adding a Store

1. Create store file in `src/lib/stores/storeName.ts`
2. Define TypeScript interfaces for state
3. Export store with typed methods
4. Export from `src/lib/stores/index.ts`
5. Use in components with `$storeName` syntax

## Important Notes

### Environment Variables

- **PLATFORM_ENGINEER_EMAIL** - the user with this email is elevated to
  `platform_engineer` on their next sign-in; this is how the first superuser is
  created (nothing is seeded)
- **ENCRYPTION_KEY** - encrypts stored provider credentials
- Set in `.dev.vars` for local development
- Use `wrangler secret put` for production

### Platform-Specific

- **Cloudflare Workers runtime** - No Node.js APIs available
- **Use `locals.platform.env`** to access bindings (DB, R2, etc.)
- **Edge functions** - Keep cold start time low
- **D1 limitations** - No foreign key enforcement (handle in application)

### Documentation

- Comprehensive docs in `docs/` folder
- Read relevant docs before modifying core features
- Update docs when adding significant features

### Security

**CRITICAL SECURITY REQUIREMENTS - NEVER VIOLATE THESE:**

#### Secrets and Sensitive Data

- **NEVER store secrets in plaintext** - All sensitive data MUST be encrypted at rest
- **NEVER commit secrets** - Use `.dev.vars` (gitignored) for local development
- **Encryption required for:**
  - API keys (OAuth client secrets, payment gateway keys, etc.)
  - Authentication tokens and session secrets
  - Database credentials
  - Any PII (Personally Identifiable Information)
  - User passwords (use bcrypt/argon2 with salt)

#### Database Security

- **Encrypt sensitive columns** - Use application-level encryption for:
  - OAuth client secrets in `sso_providers.client_secret`
  - Payment information
  - Personal health information
  - Financial data
- **Use prepared statements** - NEVER use string concatenation for SQL
- **Multi-tenant isolation** - Always filter by `site_id` in WHERE clauses
- **Audit logging** - Log access to sensitive data

#### Activity Logging

**ALWAYS log significant actions to the activity logs for audit trails and user transparency:**

- **What to log:**
  - Settings changes (site settings, theme settings, user preferences, etc.)
  - Content modifications (creating, updating, deleting products, pages, orders)
  - User actions (login, logout, password changes, role changes)
  - Administrative actions (user management, permissions changes)
  - Payment and order operations (order placement, fulfillment, refunds)
  - SSO configuration changes (provider setup, client secret updates)
  - Data imports/exports
  - System configuration changes

- **What NOT to log:**
  - Simple page views (unless specifically required for analytics)
  - Read-only operations (viewing lists, reading data)
  - Automated system tasks (unless they modify data)
  - High-frequency operations (search queries, auto-save drafts - unless final save)

- **Log entry requirements:**
  - **User identification**: Always include `user_id` and `site_id`
  - **Action description**: Clear, human-readable description of what was done
  - **Entity information**: Include entity type and ID (e.g., `product_id`, `page_id`)
  - **Timestamp**: Automatically captured by `created_at`
  - **Context**: Include relevant details (old value → new value for updates)

- **Implementation pattern:**

  ```typescript
  import { logActivity } from '$lib/server/db/activityLogs';

  // After successful action
  await logActivity(
    db,
    siteId,
    userId,
    'Updated product pricing',
    `Changed price from $${oldPrice} to $${newPrice} for product "${productName}"`,
    'product',
    productId
  );
  ```

- **Best practices:**
  - Log AFTER successful operations (not before)
  - Include meaningful context for future reference
  - Use consistent action verbs (Created, Updated, Deleted, Changed, etc.)
  - Don't log sensitive data (passwords, tokens, full credit cards)
  - Keep descriptions concise but informative

#### Input Validation and Sanitization

- **Sanitize user input** - Especially for HTML/SQL
- **Validate all inputs** - Check types, lengths, formats
- **CSRF protection** - Enabled by default in SvelteKit (verify it's working)
- **XSS prevention** - Escape output, use Content Security Policy
- **SQL injection prevention** - Always use prepared statements

#### Authentication and Authorization

- **Secure session management** - Use httpOnly, secure, sameSite cookies
- **Role-based access control** - Verify permissions before data access
- **Rate limiting** - Implement for login, API endpoints
- **Password requirements** - Enforce strong passwords (min 12 chars, complexity)
- **MFA support** - Plan for multi-factor authentication

#### API and Network Security

- **HTTPS only** - Never transmit sensitive data over HTTP
- **API authentication** - Require auth tokens for all sensitive endpoints
- **CORS configuration** - Restrict to known domains only
- **Request size limits** - Prevent DoS attacks

#### Security Review Checklist

Before implementing any feature that handles sensitive data:

- [ ] **Encryption**: Are secrets encrypted at rest and in transit?
- [ ] **Access control**: Is authorization properly enforced?
- [ ] **Input validation**: Are all inputs validated and sanitized?
- [ ] **Audit logging**: Are security events logged?
- [ ] **Error handling**: Do errors reveal sensitive information?
- [ ] **Dependencies**: Are all packages up-to-date and vulnerability-free?

#### Security Testing

- **Test for common vulnerabilities**:
  - SQL injection
  - XSS (Cross-Site Scripting)
  - CSRF (Cross-Site Request Forgery)
  - Authentication bypass
  - Authorization bypass
  - Sensitive data exposure

#### Compliance Considerations

- **GDPR**: Right to erasure, data portability, consent management
- **PCI-DSS**: Never store full credit card numbers, CVV codes
- **HIPAA**: If handling health data, ensure compliance
- **SOC 2**: Implement security controls and audit trails

**If you're unsure about security implications, ASK. Security is non-negotiable.**

### Browser API Restrictions

**NEVER use native browser dialogs. Use our custom implementations instead:**

#### Prompt Dialog

- **NEVER use** `prompt()` or `window.prompt()`
- **ALWAYS use** `promptStore.show()` from `$lib/stores/prompt`

```typescript
import { promptStore } from '$lib/stores/prompt';

// Basic usage - returns string or null (if canceled)
const name = await promptStore.show('Enter your name');
if (name !== null) {
  console.log(`Hello, ${name}!`);
}

// With options
const email = await promptStore.show('Enter your email', {
  defaultValue: 'user@example.com',
  inputType: 'email', // 'text' | 'number' | 'email' | 'password' | 'url' | 'tel'
  placeholder: 'email@domain.com',
  confirmText: 'Submit', // Default: 'OK'
  cancelText: 'Skip', // Default: 'Cancel'
  required: true // Prevents empty submissions
});
```

**Why?**

- Native `prompt()` blocks the main thread
- Cannot be styled to match our theme
- Poor accessibility
- Inconsistent across browsers
- Our implementation is promise-based and non-blocking

#### Alert Dialog

- **NEVER use** `alert()` or `window.alert()`
- **ALWAYS use** `toastStore` from `$lib/stores/toast` for notifications

```typescript
import { toastStore } from '$lib/stores/toast';

toastStore.success('Operation completed!');
toastStore.error('Something went wrong');
toastStore.info('Here is some information');
toastStore.warning('Please be careful');
```

#### Confirm Dialog

- **NEVER use** `confirm()` or `window.confirm()`
- **ALWAYS use** `confirmStore.show()` from `$lib/stores/confirm`

```typescript
import { confirmStore } from '$lib/stores/confirm';

// Basic usage - returns boolean (true if confirmed, false if canceled)
const confirmed = await confirmStore.show('Delete this item?');
if (confirmed) {
  // Proceed with deletion
}

// With options
const shouldDelete = await confirmStore.show('Delete this product permanently?', {
  title: 'Confirm Deletion', // Dialog title (default: 'Confirm')
  confirmText: 'Delete', // Confirm button text (default: 'OK')
  cancelText: 'Keep', // Cancel button text (default: 'Cancel')
  variant: 'danger' // 'default' | 'danger' | 'warning'
});

// Variant examples:
// 'danger' - Red confirm button (for destructive actions like delete)
// 'warning' - Orange confirm button (for unsaved changes, resets)
// 'default' - Primary colored confirm button (for neutral confirmations)
```

**Why?**

- Native `confirm()` blocks the main thread
- Cannot be styled to match our theme
- Poor accessibility
- Inconsistent across browsers
- Our implementation is promise-based and non-blocking
- Supports variants for visual distinction of action severity

## Quality Gates & Completion Criteria

### Before Considering ANY Task Complete

**CRITICAL: You MUST verify all of these checks pass before declaring a task complete:**

#### 1. Code Formatting & Linting (MUST PASS)

```bash
npm run format  # Auto-fix formatting issues
npm run lint    # Check for linting errors
npm run check   # TypeScript type checking
```

**If `npm run check` fails, the code is NOT complete.** Fix all type errors before finishing.

**Common formatting rules that MUST be followed:**

- **2 spaces indentation** (never tabs)
- **Single quotes** for strings in TypeScript/JavaScript
- **No trailing commas** in objects/arrays (trailingComma: 'none')
- **100 character line length** (soft limit)
- **Semicolons required** at end of statements
- **Explicit return types** on all functions
- **No `any` types** - use proper typing or `unknown`
- **Import type** for type-only imports: `import type { ... }`

#### 2. Test Coverage Requirements (MUST MEET)

```bash
npm run test:coverage  # Run with coverage report
```

**Coverage Thresholds (ENFORCED):**

- **Lines: ≥80%** (target: 90%)
- **Functions: ≥80%** (target: 90%)
- **Branches: ≥75%** (target: 85%)
- **Statements: ≥80%** (target: 90%)

**Coverage applies to:**

- `src/lib/server/**` (database, utilities, business logic)
- `src/lib/stores/**` (all stores)
- `src/lib/utils/**` (all utility functions)
- `src/lib/components/**` (all components)

**Coverage excludes:**

- Routes in `src/routes/**`
- Type definitions in `src/lib/types/**`
- Test files themselves

**If coverage drops below 80%, you MUST write additional tests before finishing and you should strive to reach 90%**

#### 3. All Tests Must Pass

```bash
npm test  # All tests must pass
```

**No failing tests allowed.** If tests fail:

1. Fix the implementation bug, OR
2. Fix the test if it's incorrect, OR
3. Update the test if requirements changed

#### 4. Pre-Commit Verification

```bash
npm run gate  # Runs lint, check, and test in sequence
```

**This is the gold standard.** If `npm run gate` passes, code quality is verified.

### Quality Checklist for Every Code Change

Before submitting code, verify:

- [ ] **Formatting**: Code follows Prettier config (2 spaces, single quotes, no trailing commas)
- [ ] **Linting**: No ESLint errors or warnings
- [ ] **Type Safety**: `npm run check` passes with no TypeScript errors
- [ ] **Tests Pass**: `npm test` shows all tests passing
- [ ] **Coverage**: `npm run test:coverage` shows ≥80% on new/modified code
- [ ] **TDD Followed**: Tests written BEFORE implementation
- [ ] **Documentation**: JSDoc comments on public APIs
- [ ] **No Secrets**: No hardcoded secrets or sensitive data
- [ ] **Multi-tenant Safe**: Database queries include `site_id` where applicable
- [ ] **Error Handling**: Try/catch blocks on async operations

### Automated Quality Enforcement

This project uses **lint-staged** with **husky** for pre-commit hooks:

```json
{
  "*.{js,ts,svelte}": ["prettier --write", "eslint --fix"]
}
```

**Git commits will fail if:**

- Formatting is incorrect
- ESLint errors exist
- Type checking fails

**Always run `npm run gate` before considering work complete.**

### Coverage Improvement Strategies

If coverage is below target:

1. **Identify uncovered lines**: Check `coverage/lcov-report/index.html`
2. **Write targeted tests**: Focus on uncovered branches and edge cases
3. **Test error paths**: Ensure try/catch blocks are tested
4. **Mock external dependencies**: Database, APIs, file system
5. **Test async operations**: Both success and failure scenarios

Example coverage improvement workflow:

```bash
npm run test:coverage        # Identify gaps
open coverage/index.html     # Visual coverage report
npm run test:watch           # Write tests interactively
npm run test:coverage        # Verify improvement
```

### Common Quality Issues to Avoid

#### TypeScript Errors

```typescript
// ❌ BAD: Using 'any'
function process(data: any) {}

// ✅ GOOD: Proper typing
function process(data: Product) {}

// ❌ BAD: No return type
function getTotal() {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ GOOD: Explicit return type
function getTotal(): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

#### Formatting Errors

```typescript
// ❌ BAD: Double quotes, trailing comma, tabs
{
	"name": "test",
	"value": 123,
}

// ✅ GOOD: Single quotes, no trailing comma, 2 spaces
{
  name: 'test',
  value: 123
}
```

#### Missing Tests

```typescript
// ❌ BAD: No tests for new function
export function calculateDiscount(price: number, percent: number): number {
  return price * (percent / 100);
}

// ✅ GOOD: Comprehensive tests
describe('calculateDiscount', () => {
  it('calculates discount correctly', () => {
    expect(calculateDiscount(100, 10)).toBe(10);
  });

  it('handles zero discount', () => {
    expect(calculateDiscount(100, 0)).toBe(0);
  });

  it('handles 100% discount', () => {
    expect(calculateDiscount(100, 100)).toBe(100);
  });
});
```

### When to Skip Quality Gates

**NEVER.** Quality gates are mandatory for all code changes.

**Exception**: When explicitly prototyping/spiking (must refactor with tests after).

## References

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- Project docs: `docs/` folder
- Agent guidelines: `AGENTS.md`

### Svelte/SvelteKit LLM Documentation

The following files in the project root contain Svelte and SvelteKit documentation optimized for LLM consumption:

- `llms.txt` - Index of Svelte documentation resources with links to various documentation sets
- `llms-full.txt` - Complete Svelte and SvelteKit developer documentation (33,000+ lines)

When working with Svelte components, SvelteKit routing, or framework-specific patterns, reference these files for authoritative documentation on:

- Svelte component syntax and reactivity (`$:`, `{#if}`, `{#each}`, etc.)
- SvelteKit routing conventions (`+page.svelte`, `+layout.svelte`, `+server.ts`)
- Stores and state management (`writable`, `readable`, `derived`)
- Lifecycle functions (`onMount`, `beforeUpdate`, `afterUpdate`)
- Special elements (`<svelte:component>`, `<svelte:element>`, `<svelte:window>`)
- Actions, transitions, and animations
- Form handling and progressive enhancement
- Server-side rendering and hydration
