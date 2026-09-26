#!/usr/bin/env node

/**
 * Database Backup Script for Cloudflare D1
 *
 * Creates a backup of the D1 database by exporting it to a SQL file.
 * The backup can be restored to any D1 database (staging, local, or production).
 *
 * Usage:
 *   npm run db:backup              # Backup production database
 *   npm run db:backup -- --preview # Backup preview database
 *   npm run db:backup -- --local   # Backup local database
 *
 * Options:
 *   --output <path>  Custom output path (default: backups/<timestamp>_<env>.sql)
 *   --no-data        Schema only, no data
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const isLocal = args.includes('--local');
const isPreview = args.includes('--preview');
const noData = args.includes('--no-data');

// Parse custom output path
const outputIndex = args.findIndex((arg) => arg === '--output' || arg === '-o');
const customOutput = outputIndex !== -1 ? args[outputIndex + 1] : null;

// Database configuration from wrangler.toml
const DB_CONFIG = {
  production: {
    name: 'hermes-db',
    id: '2e952313-eb3d-4a77-914f-828a112a317b'
  },
  preview: {
    name: 'hermes-db-preview',
    id: 'a60090e4-72b8-4101-a4f2-83d19c4b6266'
  }
};

function getEnvironment() {
  if (isLocal) return 'local';
  if (isPreview) return 'preview';
  return 'production';
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function ensureBackupDir() {
  const backupDir = path.join(projectRoot, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    // Add .gitignore to backups folder
    fs.writeFileSync(
      path.join(backupDir, '.gitignore'),
      '# Ignore all backup files\n*.sql\n*.sqlite\n'
    );
  }
  return backupDir;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      shell: true,
      ...options
    });

    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed: ${stderr || stdout}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function backupLocal() {
  console.log('📦 Backing up local database...\n');

  const env = getEnvironment();
  const timestamp = getTimestamp();
  const backupDir = ensureBackupDir();
  const outputPath = customOutput || path.join(backupDir, `${timestamp}_${env}.sql`);

  // For local, we export using wrangler d1 export with --local flag
  const wranglerArgs = [
    'd1',
    'export',
    DB_CONFIG.production.name,
    '--local',
    '--output',
    outputPath
  ];

  if (noData) {
    wranglerArgs.push('--no-data');
  }

  try {
    console.log(`Running: npx wrangler ${wranglerArgs.join(' ')}`);
    await runCommand('npx', ['wrangler', ...wranglerArgs]);
    console.log(`\n✅ Local backup saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

async function backupRemote() {
  const env = getEnvironment();
  const dbConfig = env === 'preview' ? DB_CONFIG.preview : DB_CONFIG.production;
  const timestamp = getTimestamp();
  const backupDir = ensureBackupDir();
  const outputPath = customOutput || path.join(backupDir, `${timestamp}_${env}.sql`);

  console.log(`📦 Backing up ${env} database (${dbConfig.name})...\n`);

  // For remote databases, use wrangler d1 export with --remote flag
  const wranglerArgs = ['d1', 'export', dbConfig.name, '--remote', '--output', outputPath];

  if (noData) {
    wranglerArgs.push('--no-data');
  }

  try {
    console.log(`Running: npx wrangler ${wranglerArgs.join(' ')}`);
    await runCommand('npx', ['wrangler', ...wranglerArgs]);

    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`\n✅ Backup completed successfully!`);
    console.log(`   📁 File: ${outputPath}`);
    console.log(`   📊 Size: ${sizeMB} MB`);
    console.log(`\n💡 To restore this backup:`);
    console.log(`   npm run db:restore -- --file "${outputPath}" --to staging`);

    return outputPath;
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  console.log('🗄️  Ammoura Database Backup Tool\n');
  console.log('═'.repeat(50));

  if (isLocal) {
    await backupLocal();
  } else {
    await backupRemote();
  }
}

main();
