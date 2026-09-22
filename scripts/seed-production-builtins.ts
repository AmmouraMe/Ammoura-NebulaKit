/**
 * Production seed script for Ammoura built-in components
 *
 * This script seeds built-in components into production databases while
 * respecting the revision system. It can be run via wrangler:
 *
 * Usage:
 *   npx wrangler d1 execute hermes-db --file=scripts/seed-production-builtins.sql
 *
 * Or programmatically via API endpoint (requires platform_engineer role).
 *
 * The script:
 * 1. Creates new built-in components that don't exist
 * 2. Adds new default revisions (v2, v3, etc.) for updated configs
 * 3. Upgrades sites still on the previous default to the new default
 * 4. Leaves sites with custom configurations on their current revision
 */

// Re-export everything from the main module for backwards compatibility
export {
  runProductionSeed,
  seedAllBuiltinComponents,
  migrateInitialRevisionsToVersioned,
  BUILTIN_COMPONENTS,
  PRIMITIVE_COMPONENTS,
  CURRENT_BUILTIN_VERSION
} from '../src/lib/server/db/builtin-seeding';
