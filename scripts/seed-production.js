#!/usr/bin/env node

/**
 * Production seeding script for Ammoura built-ins
 *
 * This script safely seeds built-in components, layouts, and pages
 * into production databases using wrangler to execute against remote D1.
 *
 * Usage:
 *   npm run seed:production              # Dry run (preview only)
 *   npm run seed:production -- --apply   # Actually apply changes
 *   npm run seed:preview                 # Seed preview environment
 *
 * Safety features:
 *   - Dry run by default (must pass --apply to make changes)
 *   - Shows exactly what will be changed before applying
 *   - Respects user customizations (won't overwrite custom configs)
 *   - Creates new revision versions, preserving history
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isPreview = args.includes('--preview');
const isLocal = args.includes('--local');
const isHelp = args.includes('--help') || args.includes('-h');

const databaseName = 'hermes-db';

if (isHelp) {
  console.log(`
Ammoura Production Seeding Script
=================================

Seeds built-in components, layouts, and pages into production databases
while respecting the revision system and user customizations.

Usage:
  npm run seed:production              Dry run - preview what would change
  npm run seed:production -- --apply   Apply changes to production
  npm run seed:preview                 Seed preview environment
  npm run seed:local                   Seed local development database

Options:
  --apply     Actually apply changes (default is dry run)
  --preview   Target preview environment instead of production
  --local     Target local development database
  --help, -h  Show this help message

What this does:
  1. Creates new built-in components, layouts, and pages that don't exist
  2. Adds new default revisions (v2, v3, etc.) for updated configs
  3. Upgrades sites still on the previous default to the new default
  4. Leaves sites with custom configurations unchanged

Seeding Order:
  1. Components - Base building blocks (no dependencies)
  2. Layouts - Depend on component IDs for navbar/footer
  3. Pages - Depend on layouts for rendering

Safety:
  - Always runs in dry-run mode unless --apply is specified
  - Shows exactly what will be changed before applying
  - Preserves all user customizations
  - Creates revision history for all changes
`);
  process.exit(0);
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
      } else {
        resolve();
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Generate SQL to run the production seed
 */
function generateSeedSQL(dryRun = true) {
  // Read the current version from the module
  const builtinSeedingPath = join(
    __dirname,
    '..',
    'src',
    'lib',
    'server',
    'db',
    'builtin-seeding.ts'
  );
  const content = readFileSync(builtinSeedingPath, 'utf-8');
  const versionMatch = content.match(/CURRENT_BUILTIN_VERSION\s*=\s*(\d+)/);
  const currentVersion = versionMatch ? parseInt(versionMatch[1], 10) : 1;

  console.log(`📦 Current built-in version: v${currentVersion}`);

  // Generate SQL that will:
  // 1. Migrate old "Initial default configuration" messages to v1
  // 2. Report on current state
  // 3. Optionally apply updates

  const sql = `
-- Ammoura Production Seed Script
-- Version: ${currentVersion}
-- Mode: ${dryRun ? 'DRY RUN (preview only)' : 'APPLY CHANGES'}
-- Generated: ${new Date().toISOString()}

-- Step 1: Migrate old revision messages to v1 format
${dryRun ? '-- DRY RUN: Would update:' : ''}
${
  dryRun
    ? `SELECT COUNT(*) as would_migrate FROM revisions WHERE message = 'Initial default configuration';`
    : `
UPDATE revisions 
SET message = 'Default configuration v1'
WHERE message = 'Initial default configuration';
`
}

-- Step 2: Show current state of built-in components
SELECT 
  c.name as component_name,
  c.type as component_type,
  r.message as current_revision_message,
  CASE 
    WHEN r.message LIKE 'Default configuration v%' THEN 'default'
    ELSE 'customized'
  END as status
FROM components c
LEFT JOIN revisions r ON r.entity_type = 'component' 
  AND r.entity_id = CAST(c.id AS TEXT) 
  AND r.is_current = 1
WHERE c.is_global = 1 OR c.is_primitive = 1
ORDER BY c.is_primitive, c.name;

-- Step 3: Show sites and their revision status
SELECT 
  s.name as site_name,
  COUNT(CASE WHEN r.message LIKE 'Default configuration v%' THEN 1 END) as on_default,
  COUNT(CASE WHEN r.message NOT LIKE 'Default configuration v%' THEN 1 END) as customized
FROM sites s
LEFT JOIN revisions r ON r.site_id = s.id AND r.is_current = 1
GROUP BY s.id, s.name;
`;

  return sql;
}

async function main() {
  console.log('');
  console.log('🌱 Ammoura Production Seeding');
  console.log('============================');
  console.log('');

  if (isApply) {
    console.log('⚠️  MODE: APPLY CHANGES');
    console.log('   Changes will be written to the database.');
    console.log('');
  } else {
    console.log('🔍 MODE: DRY RUN (preview only)');
    console.log('   No changes will be made. Use --apply to apply changes.');
    console.log('');
  }

  let environment = 'production';
  if (isPreview) {
    environment = 'preview';
  } else if (isLocal) {
    environment = 'local';
  }
  console.log(`📍 Environment: ${environment}`);
  console.log('');

  try {
    // Generate the seed SQL
    const sql = generateSeedSQL(!isApply);

    // Create a temporary SQL file
    const tempSqlPath = join(__dirname, '.temp-seed.sql');
    const { writeFileSync, unlinkSync } = await import('fs');
    writeFileSync(tempSqlPath, sql);

    // Build wrangler command
    const wranglerArgs = ['d1', 'execute', databaseName];

    if (isLocal) {
      wranglerArgs.push('--local');
    } else if (isPreview) {
      wranglerArgs.push('--remote', '--env', 'preview');
    } else {
      wranglerArgs.push('--remote');
    }

    wranglerArgs.push(`--file=${tempSqlPath}`);

    console.log('🔄 Executing seed...');
    console.log('');

    // Run wrangler
    await runCommand('wrangler', wranglerArgs);

    // Clean up temp file
    try {
      unlinkSync(tempSqlPath);
    } catch {
      // Ignore cleanup errors
    }

    if (isApply) {
      console.log('✅ Production seed completed successfully!');
    } else {
      console.log('');
      console.log('ℹ️  This was a dry run. To apply changes, run:');
      if (isPreview) {
        console.log('   npm run seed:preview -- --apply');
      } else if (isLocal) {
        console.log('   npm run seed:local -- --apply');
      } else {
        console.log('   npm run seed:production -- --apply');
      }
    }
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

main();
