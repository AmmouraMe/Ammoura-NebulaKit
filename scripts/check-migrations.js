#!/usr/bin/env node

/**
 * Migration integrity check.
 *
 * Two rules, both from issue #77 and both already stated in CLAUDE.md:
 *
 * 1. **A migration number is used once.** Duplicate numbers mean apply order
 *    falls out of filename sort rather than intent, and every migration added
 *    on top inherits that ambiguity. The issue counted four duplicates; by the
 *    time anyone looked again there were five, because nothing was watching.
 * 2. **A migration is immutable once it is on `main`.** A database that has
 *    already applied `0042` will never apply it again, so editing the file
 *    changes new environments and silently leaves old ones behind.
 *
 * Rule 1 runs anywhere. Rule 2 needs a base revision to compare against; pass
 * `--base <ref>` or let CI supply `GITHUB_BASE_REF`. Without one it is skipped
 * and said so, rather than passing quietly.
 *
 * Usage:
 *   node scripts/check-migrations.js
 *   node scripts/check-migrations.js --base origin/main
 */

import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MIGRATIONS_DIR = 'migrations';

/** `0042_add_thing.sql` — four digits, snake_case, `.sql`. */
export const MIGRATION_NAME_PATTERN = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

/**
 * Duplicate numbers that were already on `main` before this check existed.
 *
 * They cannot be renumbered: production has applied them under these exact
 * names, and renaming a migration is editing it. They are frozen here by full
 * filename so that the pair stays exactly these two files — swapping one for a
 * different migration at the same number is a new duplicate and fails.
 *
 * Do not add to this list. It records history; it is not a way to allow one
 * more.
 *
 * @type {Record<string, string[]>}
 */
export const HISTORICAL_DUPLICATES = {
  '0011': ['0011_advanced_user_management.sql', '0011_git_like_revisions.sql'],
  '0013': ['0013_activity_logs.sql', '0013_printful_integration.sql'],
  '0023': ['0023_encrypt_sso_secrets.sql', '0023_update_sso_provider_icons.sql'],
  '0024': ['0024_color_themes.sql', '0024_generic_revisions.sql'],
  '0104': ['0104_fulfillment_relays.sql', '0104_navbar_builtin_v3.sql']
};

/**
 * Filenames that do not match the naming convention.
 *
 * @param {string[]} filenames
 * @returns {string[]}
 */
export function findNamingViolations(filenames) {
  return filenames.filter((name) => !MIGRATION_NAME_PATTERN.test(name)).sort();
}

/**
 * Migration numbers used more than once, minus the frozen historical pairs.
 *
 * A number in `historical` is only forgiven when its files are exactly the
 * recorded ones; a different or extra file at that number is reported.
 *
 * @param {string[]} filenames
 * @param {Record<string, string[]>} [historical]
 * @returns {Array<{ number: string, files: string[] }>}
 */
export function findNewDuplicates(filenames, historical = HISTORICAL_DUPLICATES) {
  /** @type {Map<string, string[]>} */
  const byNumber = new Map();
  for (const name of filenames) {
    const match = MIGRATION_NAME_PATTERN.exec(name);
    if (!match) continue;
    const number = match[1];
    byNumber.set(number, [...(byNumber.get(number) ?? []), name]);
  }

  /** @type {Array<{ number: string, files: string[] }>} */
  const offenders = [];
  for (const [number, files] of byNumber) {
    if (files.length < 2) continue;
    const allowed = historical[number];
    const sorted = [...files].sort();
    if (
      allowed &&
      sorted.length === allowed.length &&
      sorted.every((f, i) => f === [...allowed].sort()[i])
    ) {
      continue;
    }
    offenders.push({ number, files: sorted });
  }
  return offenders.sort((a, b) => a.number.localeCompare(b.number));
}

/**
 * Migrations whose contents changed, or that vanished, since the base revision.
 *
 * @param {Record<string, string>} base  filename → content hash on the base ref
 * @param {Record<string, string>} head  filename → content hash now
 * @returns {Array<{ file: string, change: 'modified' | 'deleted' }>}
 */
export function findMutatedMigrations(base, head) {
  /** @type {Array<{ file: string, change: 'modified' | 'deleted' }>} */
  const mutated = [];
  for (const [file, hash] of Object.entries(base)) {
    if (!(file in head)) {
      mutated.push({ file, change: 'deleted' });
    } else if (head[file] !== hash) {
      mutated.push({ file, change: 'modified' });
    }
  }
  return mutated.sort((a, b) => a.file.localeCompare(b.file));
}

/** @param {string} content */
function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * @param {string} [dir]
 * @returns {string[]}
 */
export function listMigrations(dir = resolve(REPO_ROOT, MIGRATIONS_DIR)) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

/** @returns {Record<string, string>} filename → content hash, as it is on disk. */
function hashesOnDisk() {
  const dir = resolve(REPO_ROOT, MIGRATIONS_DIR);
  /** @type {Record<string, string>} */
  const out = {};
  for (const name of listMigrations(dir)) {
    out[name] = hash(readFileSync(resolve(dir, name), 'utf8'));
  }
  return out;
}

/**
 * Resolve a base ref the way a person means it: `main` should find
 * `origin/main` on a CI checkout, where the local branch does not exist.
 *
 * @param {string} ref
 * @returns {string | null}
 */
function resolveRef(ref) {
  for (const candidate of [ref, `origin/${ref}`]) {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`], {
        cwd: REPO_ROOT,
        stdio: 'ignore'
      });
      return candidate;
    } catch {
      // Try the next spelling.
    }
  }
  return null;
}

/**
 * @param {string} ref  already resolved by `resolveRef`
 * @returns {Record<string, string>}
 */
function hashesAtRef(ref) {
  const listing = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', MIGRATIONS_DIR], {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });

  /** @type {Record<string, string>} */
  const out = {};
  for (const path of listing.split('\n').filter((line) => line.endsWith('.sql'))) {
    const content = execFileSync('git', ['show', `${ref}:${path}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024
    });
    out[path.slice(`${MIGRATIONS_DIR}/`.length)] = hash(content);
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const baseIndex = argv.indexOf('--base');
  const baseRef = baseIndex >= 0 ? argv[baseIndex + 1] : process.env.GITHUB_BASE_REF || undefined;

  const filenames = listMigrations();
  /** @type {string[]} */
  const problems = [];

  for (const name of findNamingViolations(filenames)) {
    problems.push(`${name} is not named NNNN_snake_case_name.sql`);
  }

  for (const { number, files } of findNewDuplicates(filenames)) {
    problems.push(
      `migration number ${number} is used by ${files.length} files: ${files.join(', ')}`
    );
  }

  const resolved = baseRef ? resolveRef(baseRef) : null;
  if (baseRef && resolved === null) {
    problems.push(`cannot resolve base ref "${baseRef}" — fetch it, or drop --base`);
  } else if (resolved) {
    for (const { file, change } of findMutatedMigrations(hashesAtRef(resolved), hashesOnDisk())) {
      problems.push(`${file} was ${change}; migrations on ${resolved} are immutable`);
    }
  }

  if (problems.length > 0) {
    console.error('Migration check failed:');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      '\nAdd a new numbered migration instead of reusing a number or editing an applied one.'
    );
    process.exit(1);
  }

  console.log(
    `Migrations OK — ${filenames.length} files, no new duplicate numbers` +
      (resolved ? `, none changed since ${resolved}.` : '. Immutability not checked (no --base).')
  );
}

// Run only when invoked directly, so the test can import the rules.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
