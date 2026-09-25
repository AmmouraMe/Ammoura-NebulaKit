import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkHealth } from '$lib/server/observability';
import { dev } from '$app/environment';

/**
 * GET /health — is this Worker able to reach D1, R2 and KV?
 *
 * Public and unauthenticated so an uptime monitor can poll it, which means the
 * body has to stay boring: statuses and timings, no binding names beyond the
 * three fixed keys, no error object, no configuration. 503 on failure so a
 * monitor sees it without parsing the body.
 */
export const GET: RequestHandler = async ({ platform, setHeaders }) => {
  const report = await checkHealth(platform?.env, {
    release: __APP_VERSION__,
    environment: dev ? 'development' : 'production'
  });

  setHeaders({ 'cache-control': 'no-store' });

  return json(report, { status: report.status === 'error' ? 503 : 200 });
};
