#!/usr/bin/env node

/**
 * Database migration script for Cloudflare D1
 * Applies all pending migrations to the specified environment
 */

import { spawn } from 'child_process';

const args = process.argv.slice(2);
const isLocal = args.includes('--local');
const isPreview = args.includes('--preview');

const databaseName = 'hermes-db';

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);

    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, CI: 'true' }
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

async function migrate() {
  try {
    console.log('🚀 Starting database migration...');

    const wranglerArgs = ['d1', 'migrations', 'apply', databaseName];
    // Environment selection logic:
    // 1. Local: --local
    // 2. Preview (local or remote): --preview --remote
    // 3. Production: --remote
    if (isLocal) {
      wranglerArgs.push('--local');
      console.log('📍 Environment: Local');
    } else if (isPreview) {
      wranglerArgs.push('--preview', '--remote');
      console.log('📍 Environment: Preview (local or CI, using --remote)');
    } else {
      wranglerArgs.push('--remote');
      console.log('📍 Environment: Production (using --remote)');
    }

    await runCommand('wrangler', wranglerArgs);

    console.log('✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
