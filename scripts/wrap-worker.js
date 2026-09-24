#!/usr/bin/env node

/**
 * Add a scheduled() handler to the built Worker.
 *
 * `@sveltejs/adapter-cloudflare` emits a fetch-only `_worker.js`, so a
 * Cloudflare Cron Trigger has nothing to call. `worker/entry.js` wraps it:
 * `fetch` passes through untouched, `scheduled()` is added.
 *
 * The wrapper cannot simply be `main` in wrangler.toml. The adapter WRITES to
 * whatever `main` names, so pointing it at a hand-written file overwrites that
 * file on the next build — which is exactly what happened the first time this
 * was tried. So the adapter keeps its path, and this script runs after the
 * build and swaps the two:
 *
 *   _worker.js  (adapter's)  →  _app-worker.js
 *   worker/entry.js          →  _worker.js
 *
 * Run by `npm run build`. See docs/SCHEDULED_JOBS.md.
 */

import { readFileSync, writeFileSync, renameSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = '.svelte-kit/cloudflare';
const ADAPTER_WORKER = join(OUT_DIR, '_worker.js');
/** Where the adapter's output is moved to, and what the wrapper imports. */
const WRAPPED_WORKER = join(OUT_DIR, '_app-worker.js');
const ASSETS_IGNORE = join(OUT_DIR, '.assetsignore');
const WRAPPER_SOURCE = join('worker', 'entry.js');

/** The line the wrapper imports through, rewritten to its built location. */
const SOURCE_IMPORT = "from '../.svelte-kit/cloudflare/_app-worker.js'";
const BUILT_IMPORT = "from './_app-worker.js'";

function fail(message) {
  console.error(`wrap-worker: ${message}`);
  process.exit(1);
}

if (!existsSync(ADAPTER_WORKER)) {
  fail(`${ADAPTER_WORKER} does not exist — run the build first.`);
}

const wrapper = readFileSync(WRAPPER_SOURCE, 'utf8');
if (!wrapper.includes(SOURCE_IMPORT)) {
  // If the import is renamed in one place and not the other, the wrapper would
  // be written with a broken import and the failure would surface as a deploy
  // error with no obvious cause.
  fail(`${WRAPPER_SOURCE} no longer imports ${SOURCE_IMPORT}`);
}

renameSync(ADAPTER_WORKER, WRAPPED_WORKER);
writeFileSync(ADAPTER_WORKER, wrapper.replace(SOURCE_IMPORT, BUILT_IMPORT));

// The adapter writes .assetsignore each build, listing its own artifacts. The
// file it produced is now under a new name, and an unignored _app-worker.js
// would be served as a static asset — the whole server bundle, publicly.
const ignore = readFileSync(ASSETS_IGNORE, 'utf8');
if (!ignore.split('\n').includes('_app-worker.js')) {
  appendFileSync(ASSETS_IGNORE, `${ignore.endsWith('\n') ? '' : '\n'}_app-worker.js\n`);
}

console.log('wrap-worker: added scheduled() to the built Worker');
