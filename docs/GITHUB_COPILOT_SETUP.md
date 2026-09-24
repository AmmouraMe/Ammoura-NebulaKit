# GitHub Copilot Setup Guide

## Overview

This document describes the comprehensive GitHub Copilot configuration for the
Hermes project, ensuring consistent code quality, proper formatting, and test
coverage standards.

## Configuration Location

The primary Copilot instructions are located in:

```
.github/copilot-instructions.md
```

## Key Features

### 1. Code Quality Enforcement

GitHub Copilot is configured to ensure all generated code:

- ✅ Passes TypeScript strict type checking (`npm run check`)
- ✅ Follows Prettier formatting rules
- ✅ Adheres to ESLint guidelines
- ✅ Maintains test coverage above 80% (target: 90%)
- ✅ Follows TDD (Test-Driven Development) practices

### 2. Formatting Standards

**Prettier Configuration (`.prettierrc`):**

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 100
}
```

**Key Rules:**

- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings, double quotes in HTML attributes
- **Semicolons**: Required at end of statements
- **Trailing commas**: None (important: `trailingComma: 'none'`)
- **Line length**: 100 characters (soft limit)

### 3. TypeScript Standards

- **Strict mode enabled**: All type checks enforced
- **Explicit return types**: Always declare function return types
- **No `any` types**: Use proper typing or `unknown`
- **Import types**: Use `import type { ... }` for type-only imports
- **SvelteKit types**: Use `App.Locals`, `App.Platform`, etc.

### 4. Test Coverage Requirements

**Coverage Thresholds (vitest.config.ts):**

```typescript
thresholds: {
  lines: 80,       // Target: 90%
  functions: 80,   // Target: 90%
  branches: 75,    // Target: 85%
  statements: 80   // Target: 90%
}
```

**What's Covered:**

- ✅ `src/lib/server/**` - Database and business logic
- ✅ `src/lib/stores/**` - All stores
- ✅ `src/lib/utils/**` - All utility functions

**What's Excluded:**

- ❌ `src/lib/components/**` - Components (optional testing)
- ❌ `src/routes/**` - Route files
- ❌ `src/lib/types/**` - Type definitions
- ❌ Test files themselves

### 5. Quality Gates

**Before ANY code is considered complete, it MUST pass:**

```bash
# 1. Format check/fix
npm run format

# 2. Lint check
npm run lint

# 3. Type check (CRITICAL)
npm run check

# 4. Test with coverage
npm run test:coverage

# 5. Complete verification (runs all above)
npm run gate
```

**If `npm run gate` passes, code quality is verified.**

## Test-Driven Development (TDD)

### TDD is Mandatory

GitHub Copilot is instructed to **ALWAYS write tests FIRST** before
implementation.

### TDD Workflow (Red-Green-Refactor)

1. **RED**: Write a failing test that describes the desired behavior
2. **GREEN**: Write the minimum code needed to make the test pass
3. **REFACTOR**: Improve the code while keeping tests green

### TDD Development Loop

```bash
# Start test watcher
npm run test:watch

# 1. Write failing test (RED)
# 2. Write minimal implementation (GREEN)
# 3. Check coverage
npm run test:coverage

# 4. Refactor and repeat (REFACTOR)
# 5. Before committing
npm run gate
```

### TDD Checklist

Before considering a feature complete:

- [ ] All tests written before implementation
- [ ] All tests pass (`npm test`)
- [ ] Coverage >80% for new code
- [ ] Edge cases tested (null, undefined, empty, errors)
- [ ] Integration points tested (DB queries, API calls)
- [ ] User interactions tested (clicks, typing, navigation)
- [ ] Error handling tested
- [ ] Tests are readable and maintainable

## Common Quality Issues to Avoid

### ❌ TypeScript Errors

```typescript
// BAD: Using 'any'
function process(data: any) {}

// GOOD: Proper typing
function process(data: Product) {}

// BAD: No return type
function getTotal() {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// GOOD: Explicit return type
function getTotal(): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### ❌ Formatting Errors

```typescript
// BAD: Double quotes, trailing comma, tabs
{
	"name": "test",
	"value": 123,
}

// GOOD: Single quotes, no trailing comma, 2 spaces
{
  name: 'test',
  value: 123
}
```

### ❌ Missing Tests

```typescript
// BAD: No tests for new function
export function calculateDiscount(price: number, percent: number): number {
  return price * (percent / 100);
}

// GOOD: Comprehensive tests
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

## Automated Quality Enforcement

### Pre-commit Hook (Husky)

The husky pre-commit hook (`.husky/pre-commit`) runs `npm run gate`: Prettier
check, ESLint, `svelte-check` and the full test suite. It reports formatting
problems rather than rewriting files; run `npm run format` to fix them.

**Git commits will fail if:**

- Formatting is incorrect
- ESLint errors exist
- Type checking fails
- Any test fails

## Coverage Improvement Strategies

If coverage is below target:

1. **Identify uncovered lines**: Check `coverage/lcov-report/index.html`
2. **Write targeted tests**: Focus on uncovered branches and edge cases
3. **Test error paths**: Ensure try/catch blocks are tested
4. **Mock external dependencies**: Database, APIs, file system
5. **Test async operations**: Both success and failure scenarios

### Coverage Workflow

```bash
npm run test:coverage        # Identify gaps
start coverage/index.html    # Visual coverage report (Windows)
npm run test:watch           # Write tests interactively
npm run test:coverage        # Verify improvement
```

## Quality Checklist for Every Code Change

Before submitting code, verify:

- [ ] **Formatting**: Code follows Prettier config
- [ ] **Linting**: No ESLint errors or warnings
- [ ] **Type Safety**: `npm run check` passes
- [ ] **Tests Pass**: `npm test` succeeds
- [ ] **Coverage**: ≥80% on new/modified code
- [ ] **TDD Followed**: Tests written before implementation
- [ ] **Documentation**: JSDoc comments on public APIs
- [ ] **No Secrets**: No hardcoded secrets or sensitive data
- [ ] **Multi-tenant Safe**: Database queries include `site_id`
- [ ] **Error Handling**: Try/catch on async operations

## Quick Reference Commands

```bash
# Development
npm run dev                  # Start dev server
npm run build                # Build for production
npm run preview              # Preview production build

# Quality Checks
npm run format               # Auto-fix formatting
npm run lint                 # Check linting
npm run check                # Type check (CRITICAL)
npm test                     # Run tests
npm run test:coverage        # Run tests with coverage
npm run gate              # Complete verification

# Testing
npm run test:watch           # Interactive test mode
npm run test:ui              # Vitest UI
npm run test:coverage:watch  # Coverage in watch mode

# Database
npm run db:migrate:local     # Run migrations locally
npm run db:seed:local        # Seed local database
npm run db:reset:local       # Reset local database
```

## When Quality Gates Can Be Skipped

**NEVER.** Quality gates are mandatory for all code changes.

**Exception**: When explicitly prototyping/spiking (must refactor with tests
after).

## Benefits of This Setup

1. **Consistent Code Quality**: All code follows the same standards
2. **Fewer Bugs**: TDD catches issues early
3. **Better Coverage**: Enforced thresholds ensure comprehensive testing
4. **Faster Reviews**: Automated checks reduce manual review time
5. **Type Safety**: Strict TypeScript prevents runtime errors
6. **Maintainability**: Well-tested code is easier to modify

## Troubleshooting

### `npm run check` fails with type errors

- Fix all TypeScript type errors before proceeding
- Use proper types instead of `any`
- Add explicit return types to functions
- Use `import type` for type-only imports

### Coverage below 80%

- Run `npm run test:coverage` to identify gaps
- Open `coverage/index.html` for visual report
- Write tests for uncovered lines and branches
- Test error paths and edge cases

### ESLint errors

- Run `npm run lint` to see errors
- Many can be auto-fixed with `npm run format`
- Avoid using `any` types
- Use proper TypeScript patterns

### Tests failing

- Check test output for specific failures
- Ensure mocks are properly configured
- Verify test data matches expected structure
- Check for async/await issues

## Additional Resources

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/docs/svelte-testing-library/intro/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Prettier Documentation](https://prettier.io/docs/en/index.html)
- [ESLint Documentation](https://eslint.org/docs/latest/)

## Project-Specific Documentation

- [Architecture Patterns](.github/copilot-instructions.md#architecture-patterns)
- [Multi-Tenant Architecture](MULTI_TENANT.md)
- [Database Guidelines](DATABASE.md)
- [Testing Strategy](.github/copilot-instructions.md#test-driven-development-tdd)
