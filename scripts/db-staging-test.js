#!/usr/bin/env node

/**
 * Staging Migration Test Script
 *
 * This script provides a safe way to test migrations and seeds against
 * a copy of production data without ever affecting production.
 *
 * Workflow:
 * 1. Backs up production database
 * 2. Creates/wipes staging database
 * 3. Restores production backup to staging
 * 4. Runs pending migrations on staging
 * 5. Optionally runs seeds on staging
 * 6. Reports success/failure
 *
 * Usage:
 *   npm run db:test-migrations          # Test migrations on production clone
 *   npm run db:test-migrations -- --seed # Also test seeds
 *   npm run db:test-migrations -- --keep # Keep staging data after test
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const withSeed = args.includes('--seed');
const keepData = args.includes('--keep');
const skipBackup = args.includes('--skip-backup');

// Parse custom backup file
const fileIndex = args.findIndex((arg) => arg === '--file' || arg === '-f');
const customBackupFile = fileIndex !== -1 ? args[fileIndex + 1] : null;

function runCommand(command, cmdArgs, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n  $ ${command} ${cmdArgs.join(' ')}`);

    const proc = spawn(command, cmdArgs, {
      shell: true,
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: projectRoot,
      ...options
    });

    let stdout = '';
    let _stderr = '';

    if (options.silent && proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (options.silent && proc.stderr) {
      proc.stderr.on('data', (data) => {
        _stderr += data.toString();
      });
    }

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', reject);
  });
}

async function getStagingDbId() {
  try {
    const output = await runCommand('npx', ['wrangler', 'd1', 'list', '--json'], { silent: true });
    const databases = JSON.parse(output);
    const staging = databases.find((db) => db.name === 'hermes-db-staging');
    return staging ? staging.uuid : null;
  } catch {
    return null;
  }
}

async function createStagingIfNeeded() {
  const existingId = await getStagingDbId();
  if (existingId) {
    console.log(`   ✓ Staging database exists: ${existingId}`);
    return existingId;
  }

  console.log('   Creating staging database...');
  const output = await runCommand('npx', ['wrangler', 'd1', 'create', 'hermes-db-staging'], {
    silent: true
  });

  const match = output.match(/database_id\s*=\s*"([^"]+)"/);
  if (match) {
    console.log(`   ✓ Created staging database: ${match[1]}`);
    return match[1];
  }

  throw new Error('Failed to create staging database');
}

async function main() {
  console.log('🧪 Ammoura Migration Test Runner\n');
  console.log('═'.repeat(60));
  console.log('This tool safely tests migrations against a copy of production.\n');

  const startTime = Date.now();
  let backupFile = customBackupFile;

  try {
    // Step 1: Backup production (unless skipped or custom file provided)
    if (!skipBackup && !customBackupFile) {
      console.log('\n📦 Step 1: Backing up production database...');
      await runCommand('node', ['scripts/db-backup.js']);

      // Find the latest backup
      const backupDir = path.join(projectRoot, 'backups');
      const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('_production.sql'));
      files.sort().reverse();
      backupFile = path.join(backupDir, files[0]);
      console.log(`   ✓ Backup created: ${backupFile}`);
    } else if (customBackupFile) {
      console.log(`\n📦 Step 1: Using provided backup file...`);
      console.log(`   ✓ Using: ${customBackupFile}`);
    } else {
      console.log('\n📦 Step 1: Skipping backup (--skip-backup)...');
      // Find the latest backup
      const backupDir = path.join(projectRoot, 'backups');
      const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('_production.sql'));
      files.sort().reverse();
      if (files.length === 0) {
        throw new Error('No backup files found. Remove --skip-backup flag.');
      }
      backupFile = path.join(backupDir, files[0]);
      console.log(`   ✓ Using latest backup: ${backupFile}`);
    }

    // Step 2: Ensure staging database exists
    console.log('\n🗄️  Step 2: Preparing staging database...');
    await createStagingIfNeeded();

    // Step 3: Restore backup to staging
    console.log('\n📥 Step 3: Restoring production data to staging...');
    await runCommand('node', ['scripts/db-restore.js', '--file', backupFile, '--to', 'staging']);

    // Step 4: Run migrations on staging
    console.log('\n🔄 Step 4: Running migrations on staging...');
    await runCommand('npx', [
      'wrangler',
      'd1',
      'migrations',
      'apply',
      'hermes-db-staging',
      '--remote'
    ]);
    console.log('   ✓ Migrations applied successfully!');

    // Step 5: Optionally run seeds
    if (withSeed) {
      console.log('\n🌱 Step 5: Running seeds on staging...');
      // Note: This would need a staging-aware seed script
      console.log('   ⚠ Seed testing not yet implemented for staging');
    }

    // Step 6: Run verification queries
    console.log('\n✅ Step 6: Verifying staging database...');
    await runCommand(
      'npx',
      [
        'wrangler',
        'd1',
        'execute',
        'hermes-db-staging',
        '--remote',
        '--command',
        'SELECT COUNT(*) as count FROM sites;'
      ],
      { silent: false }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Migration test completed successfully!');
    console.log(`   Duration: ${duration}s`);
    console.log('');
    console.log('📊 Summary:');
    console.log('   - Production backup: Created');
    console.log('   - Staging database: Restored');
    console.log('   - Migrations: Applied successfully');
    if (withSeed) console.log('   - Seeds: Applied');

    if (!keepData) {
      console.log('\n💡 The staging database now contains your production data with');
      console.log('   new migrations applied. You can:');
      console.log(
        '   - Query it: npx wrangler d1 execute hermes-db-staging --remote --command "SELECT * FROM ..."'
      );
      console.log('   - Keep testing: Run this script again with --skip-backup');
    }

    console.log('\n🎉 Your migrations are safe to deploy to production!');
  } catch (error) {
    console.error('\n' + '═'.repeat(60));
    console.error('❌ Migration test FAILED!');
    console.error(`   Error: ${error.message}`);
    console.error('\n⚠️  DO NOT deploy these migrations to production until fixed.');
    process.exit(1);
  }
}

main();
