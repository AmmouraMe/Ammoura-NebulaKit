#!/usr/bin/env node

/**
 * Database Restore Script for Cloudflare D1
 *
 * Restores a SQL backup file to a D1 database.
 * Useful for restoring production data to staging for testing.
 *
 * Usage:
 *   npm run db:restore -- --file <backup.sql> --to staging
 *   npm run db:restore -- --file <backup.sql> --to local
 *   npm run db:restore -- --file <backup.sql> --to preview
 *   npm run db:restore -- --file <backup.sql> --to production --confirm
 *
 * Options:
 *   --file <path>     Path to the SQL backup file (required)
 *   --to <target>     Target database: staging, local, preview, production
 *   --confirm         Required for production restores (safety check)
 *   --wipe            Wipe target database before restore (default for staging)
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);

// Parse arguments
const fileIndex = args.findIndex((arg) => arg === '--file' || arg === '-f');
const backupFile = fileIndex !== -1 ? args[fileIndex + 1] : null;

const toIndex = args.findIndex((arg) => arg === '--to' || arg === '-t');
const target = toIndex !== -1 ? args[toIndex + 1] : null;

const confirmProduction = args.includes('--confirm');
const wipeFirst = args.includes('--wipe');

// Database configuration
const DB_CONFIG = {
  production: {
    name: 'hermes-db',
    id: '2e952313-eb3d-4a77-914f-828a112a317b',
    remote: true,
    dangerous: true
  },
  preview: {
    name: 'hermes-db-preview',
    id: 'a60090e4-72b8-4101-a4f2-83d19c4b6266',
    remote: true,
    dangerous: false
  },
  staging: {
    name: 'hermes-db-staging',
    id: null, // Will be created if doesn't exist
    remote: true,
    dangerous: false
  },
  local: {
    name: 'hermes-db',
    id: null,
    remote: false,
    dangerous: false
  }
};

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      shell: true,
      stdio: options.stdio || 'pipe',
      ...options
    });

    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        if (options.verbose) process.stdout.write(data);
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        if (options.verbose) process.stderr.write(data);
      });
    }

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed (exit ${code}): ${stderr || stdout}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', reject);
  });
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function checkStagingDatabase() {
  console.log('🔍 Checking for staging database...');

  try {
    const output = await runCommand('npx', ['wrangler', 'd1', 'list', '--json']);
    const databases = JSON.parse(output);
    const staging = databases.find((db) => db.name === 'hermes-db-staging');

    if (staging) {
      console.log(`   ✓ Found existing staging database: ${staging.uuid}`);
      DB_CONFIG.staging.id = staging.uuid;
      return true;
    }
  } catch (_error) {
    // Database list failed, might not exist
  }

  return false;
}

async function createStagingDatabase() {
  console.log('📦 Creating staging database...');

  try {
    const output = await runCommand('npx', ['wrangler', 'd1', 'create', 'hermes-db-staging']);

    // Parse the database ID from output
    const match = output.match(/database_id\s*=\s*"([^"]+)"/);
    if (match) {
      DB_CONFIG.staging.id = match[1];
      console.log(`   ✓ Created staging database: ${DB_CONFIG.staging.id}`);
      console.log('\n💡 Add this to your wrangler.toml for easier access:');
      console.log(`
[env.staging]
name = "hermes-staging"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "hermes-db-staging"
database_id = "${DB_CONFIG.staging.id}"
migrations_dir = "migrations"
`);
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to create staging database:', error.message);
    return false;
  }

  return false;
}

async function wipeDatabase(dbConfig) {
  console.log(`🗑️  Wiping ${dbConfig.name}...`);

  // Get all tables and drop them
  const dropTablesSQL = `
    SELECT 'DROP TABLE IF EXISTS ' || name || ';' as stmt
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
    ORDER BY name;
  `;

  try {
    const wranglerArgs = ['d1', 'execute', dbConfig.name, '--command', dropTablesSQL];
    if (dbConfig.remote) wranglerArgs.push('--remote');

    const output = await runCommand('npx', ['wrangler', ...wranglerArgs]);

    // Parse the drop statements and execute them
    const lines = output.split('\n').filter((line) => line.includes('DROP TABLE'));
    for (const stmt of lines) {
      const dropArgs = ['d1', 'execute', dbConfig.name, '--command', stmt.trim()];
      if (dbConfig.remote) dropArgs.push('--remote');
      await runCommand('npx', ['wrangler', ...dropArgs]);
    }

    console.log('   ✓ Database wiped');
  } catch (_error) {
    // Might fail if database is empty, that's okay
    console.log('   ⚠ Wipe completed (database may have been empty)');
  }
}

async function restoreBackup(dbConfig, backupPath) {
  console.log(`\n📥 Restoring backup to ${dbConfig.name}...`);

  const wranglerArgs = ['d1', 'execute', dbConfig.name, '--file', backupPath];
  if (dbConfig.remote) wranglerArgs.push('--remote');

  try {
    console.log(`   Running: npx wrangler ${wranglerArgs.join(' ')}`);
    await runCommand('npx', ['wrangler', ...wranglerArgs], { verbose: true });
    console.log('\n   ✓ Restore completed successfully!');
    return true;
  } catch (error) {
    console.error('\n❌ Restore failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔄 Ammoura Database Restore Tool\n');
  console.log('═'.repeat(50));

  // Validate arguments
  if (!backupFile) {
    console.error('❌ Missing required argument: --file <backup.sql>');
    console.log('\nUsage:');
    console.log('  npm run db:restore -- --file <backup.sql> --to staging');
    console.log('  npm run db:restore -- --file <backup.sql> --to local');
    console.log('  npm run db:restore -- --file <backup.sql> --to preview');
    process.exit(1);
  }

  if (!target || !DB_CONFIG[target]) {
    console.error('❌ Missing or invalid target: --to <staging|local|preview|production>');
    process.exit(1);
  }

  // Check backup file exists
  const absolutePath = path.isAbsolute(backupFile)
    ? backupFile
    : path.join(process.cwd(), backupFile);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Backup file not found: ${absolutePath}`);
    process.exit(1);
  }

  const stats = fs.statSync(absolutePath);
  console.log(`\n📁 Backup file: ${absolutePath}`);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  const dbConfig = DB_CONFIG[target];

  // Safety check for production
  if (dbConfig.dangerous && !confirmProduction) {
    console.error('\n⛔ DANGER: You are about to restore to PRODUCTION database!');
    console.error('   This will OVERWRITE all production data!');
    console.error('   Add --confirm flag if you really want to do this.');
    process.exit(1);
  }

  if (dbConfig.dangerous) {
    const answer = await prompt('\n⚠️  Type "RESTORE PRODUCTION" to confirm: ');
    if (answer !== 'restore production') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // For staging, ensure database exists
  if (target === 'staging') {
    const exists = await checkStagingDatabase();
    if (!exists) {
      const created = await createStagingDatabase();
      if (!created) {
        process.exit(1);
      }
    }

    // Always wipe staging before restore
    await wipeDatabase(dbConfig);
  } else if (wipeFirst) {
    await wipeDatabase(dbConfig);
  }

  // Restore the backup
  const success = await restoreBackup(dbConfig, absolutePath);

  if (success) {
    console.log('\n✅ Database restore completed!\n');

    if (target === 'staging') {
      console.log('💡 To test against staging database:');
      console.log(
        '   npx wrangler d1 execute hermes-db-staging --remote --command "SELECT COUNT(*) FROM sites;"'
      );
    } else if (target === 'local') {
      console.log('💡 Start local development server:');
      console.log('   npm run dev');
    }
  } else {
    process.exit(1);
  }
}

main();
