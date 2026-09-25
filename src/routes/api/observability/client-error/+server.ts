import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createLogger, reportError, resolveLogLevel } from '$lib/server/observability';
import { dev } from '$app/environment';

/** Anything longer than this is not a stack trace, it is an attack. */
const MAX_BODY_BYTES = 16_000;

/**
 * POST /api/observability/client-error — receive one browser exception.
 *
 * Public by necessity: the visitor who hit the error is usually anonymous. It
 * is therefore treated as untrusted input — size-capped, shape-checked, and put
 * through the same scrubbing as every other event. The site id and role come
 * from `locals`, never from the body, so a caller cannot attribute their noise
 * to another tenant.
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ ok: false }, { status: 413 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ ok: false }, { status: 400 });
  }

  const logger = createLogger({
    level: resolveLogLevel(platform?.env?.LOG_LEVEL, dev),
    context: {
      siteId: locals.siteId,
      requestId: locals.requestId,
      route: typeof payload.route === 'string' ? payload.route : undefined,
      userRole: locals.currentUser?.role ?? (locals.account ? 'account' : 'anonymous'),
      release: __APP_VERSION__,
      environment: dev ? 'development' : 'production',
      source: 'client'
    }
  });

  const error = new Error(typeof payload.message === 'string' ? payload.message : 'Client error');
  error.name = typeof payload.name === 'string' ? payload.name : 'Error';
  if (typeof payload.stack === 'string') {
    error.stack = payload.stack;
  }

  reportError(error, logger.context, {
    logger,
    webhookUrl: platform?.env?.ERROR_WEBHOOK_URL as string | undefined,
    waitUntil: platform?.context?.waitUntil?.bind(platform.context)
  });

  return json({ ok: true });
};
