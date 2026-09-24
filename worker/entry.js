/**
 * The deployed Worker entry point.
 *
 * `@sveltejs/adapter-cloudflare` emits a fetch-only `_worker.js` — an ESM
 * module whose default export has a `fetch` and nothing else. A Cloudflare
 * Cron Trigger needs a `scheduled()` export to call, so before this file the
 * platform could not run anything on a schedule, and the one recurring job it
 * had was curled from GitHub Actions instead. See issue #114.
 *
 * This wraps the adapter's output rather than replacing it: `fetch` is passed
 * through untouched, and `scheduled` is added.
 *
 * It is NOT `main` in wrangler.toml. The adapter writes to whatever `main`
 * names, so pointing it here overwrites this file on the next build. Instead
 * `scripts/wrap-worker.js` runs after the build, moves the adapter's output to
 * `_app-worker.js` and copies this file into its place — which is why the
 * import below is rewritten to `./_app-worker.js` on the way. This file does
 * not resolve from its own location, and is not meant to.
 *
 * The scheduled handler deliberately does no work of its own. It builds a
 * request and hands it to the app's own `fetch`, so every job runs inside
 * SvelteKit with the same bindings, the same `$lib` code and the same request
 * lifecycle as any other endpoint. The alternative — a second bundle of app
 * code reachable from plain JS — would mean two ways to run the same handler.
 *
 * This file is plain JavaScript on purpose. It is not part of the SvelteKit
 * build, so it is never type-checked or transformed; keeping it small and
 * dependency-free is what makes that safe.
 */

import worker from '../.svelte-kit/cloudflare/_app-worker.js';

/**
 * Any hostname works. `hooks.server.ts` resolves an unknown host to
 * 'default-site', and no job reads the tenant off the request — each one
 * scopes its own rows by the site_id it finds on them.
 */
const DISPATCH_ORIGIN = 'https://scheduler.internal';

const TOKEN_HEADER = 'x-scheduler-internal-token';
const TOKEN_ENV_KEY = 'SCHEDULER_INTERNAL_TOKEN';

/**
 * Run the jobs registered for one cron expression.
 *
 * Authentication is a token minted here, put on a copy of `env` and sent in a
 * header. It exists only for the life of this invocation and never leaves the
 * isolate, so the dispatch endpoint can tell an internal call from an external
 * one without depending on CRON_SECRET being configured.
 */
async function dispatch(cron, env, ctx) {
  const token = crypto.randomUUID();
  const url = `${DISPATCH_ORIGIN}/api/cron/run?cron=${encodeURIComponent(cron)}`;

  const request = new Request(url, {
    method: 'POST',
    headers: { [TOKEN_HEADER]: token }
  });

  const response = await worker.fetch(request, { ...env, [TOKEN_ENV_KEY]: token }, ctx);

  // A cron invocation has no caller to return a status to, so the log is the
  // only place a failed dispatch can surface.
  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable>');
    console.error(`Scheduled dispatch for "${cron}" failed with ${response.status}: ${body}`);
    return;
  }

  console.log(`Scheduled dispatch for "${cron}": ${await response.text()}`);
}

export default {
  fetch: worker.fetch,

  /**
   * Cloudflare calls this for each configured cron trigger, passing the
   * expression that fired. The registry decides which jobs that expression
   * owns, so adding a job on an existing schedule needs no change here.
   */
  async scheduled(controller, env, ctx) {
    const work = dispatch(controller.cron, env, ctx).catch((error) => {
      console.error(`Scheduled dispatch for "${controller.cron}" threw:`, error);
    });

    // Without this the invocation can be torn down the moment this function
    // returns, killing the jobs mid-flight.
    ctx.waitUntil(work);
    await work;
  }
};
