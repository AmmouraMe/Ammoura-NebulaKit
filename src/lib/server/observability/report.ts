import { scrub, scrubString } from './scrub';
import type { LogContext, Logger } from './logger';

/**
 * Error capture.
 *
 * Two sinks, deliberately: every captured error becomes a structured `error`
 * log line (always, free, greppable in `wrangler tail` and Logpush), and — when
 * `ERROR_WEBHOOK_URL` is configured — an alert is pushed to a webhook so a
 * failure reaches someone without anyone watching a log stream.
 *
 * The webhook is a Discord-shaped JSON POST, which is what this project already
 * has for delivery. `postAlert` is a single function; pointing it at Sentry's
 * store endpoint or anything else is a change in one place. See
 * docs/OBSERVABILITY.md for why no vendor SDK is bundled.
 */

export interface ErrorEvent {
  fingerprint: string;
  name: string;
  message: string;
  stack?: string;
  context: LogContext;
}

/** Line the error actually came from, used to tell two errors apart. */
function firstFrame(stack: string | undefined): string {
  if (!stack) {
    return 'no-stack';
  }
  const line = stack
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('at '));
  return line ? line.slice(3) : 'no-frame';
}

/**
 * A stable id for "this kind of error here". Two requests hitting the same bug
 * share a fingerprint; the same message thrown from a different route does not.
 * Digits are folded out so `record 41 not found` and `record 42 not found`
 * count as one error type rather than two.
 */
export function fingerprintError(
  name: string,
  message: string,
  stack: string | undefined,
  route: string | undefined
): string {
  const normalizedMessage = message.replace(/\d+/g, 'N').slice(0, 200);
  return `${name}|${normalizedMessage}|${firstFrame(stack)}|${route ?? 'unknown'}`;
}

export function toErrorEvent(error: unknown, context: LogContext = {}): ErrorEvent {
  const asError =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : JSON.stringify(scrub(error)));

  const name = asError.name || 'Error';
  const message = scrubString(asError.message || 'Unknown error');
  const stack = asError.stack ? scrubString(asError.stack) : undefined;

  return {
    fingerprint: fingerprintError(
      name,
      message,
      asError.stack,
      context.route as string | undefined
    ),
    name,
    message,
    stack,
    context: scrub(context) as LogContext
  };
}

/**
 * Per-isolate alert throttle. A Worker isolate is short-lived and there are
 * many of them, so this is not a global rate limit — it is enough to stop one
 * hot loop from posting a thousand identical alerts from one isolate, which is
 * the failure mode that actually burns a webhook.
 */
const ALERT_WINDOW_MS = 60_000;
const ALERT_MAX_PER_WINDOW = 5;
const alertHistory = new Map<string, number[]>();

export function shouldAlert(fingerprint: string, now: number = Date.now()): boolean {
  const seen = (alertHistory.get(fingerprint) ?? []).filter((at) => now - at < ALERT_WINDOW_MS);
  if (seen.length >= ALERT_MAX_PER_WINDOW) {
    alertHistory.set(fingerprint, seen);
    return false;
  }
  seen.push(now);
  alertHistory.set(fingerprint, seen);
  return true;
}

/** Test seam: drop the throttle state between cases. */
export function resetAlertThrottle(): void {
  alertHistory.clear();
}

function alertBody(event: ErrorEvent): string {
  const { requestId, siteId, route, method, userRole, release, environment } = event.context;
  const lines = [
    `**${event.name}** — ${event.message}`,
    [
      environment && `env \`${environment}\``,
      siteId && `site \`${siteId}\``,
      route && `route \`${method ?? 'GET'} ${route}\``,
      userRole && `role \`${userRole}\``,
      requestId && `request \`${requestId}\``,
      release && `release \`${release}\``
    ]
      .filter(Boolean)
      .join(' · ')
  ];
  if (event.stack) {
    lines.push('```', event.stack.split('\n').slice(0, 8).join('\n').slice(0, 1500), '```');
  }
  return lines.join('\n');
}

export interface ReportOptions {
  logger: Logger;
  webhookUrl?: string;
  /** Cloudflare's ExecutionContext.waitUntil, so the POST outlives the response. */
  waitUntil?: (promise: Promise<unknown>) => void;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/**
 * Log the error and, if a webhook is configured and the throttle allows,
 * alert on it. Never throws: a reporting failure must not replace the error
 * the user was already getting.
 */
export function reportError(
  error: unknown,
  context: LogContext,
  options: ReportOptions
): ErrorEvent {
  const event = toErrorEvent(error, context);

  options.logger.error(event.message, {
    error: { name: event.name, stack: event.stack },
    fingerprint: event.fingerprint
  });

  const url = options.webhookUrl;
  if (!url || !shouldAlert(event.fingerprint, options.now?.() ?? Date.now())) {
    return event;
  }

  const doFetch = options.fetchImpl ?? fetch;
  const posted = doFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: alertBody(event) })
  })
    .then(() => undefined)
    .catch((cause: unknown) => {
      // Deliberately a log, not a throw. If the alert channel is down we still
      // have the structured line above.
      options.logger.warn('error alert webhook failed', {
        cause: cause instanceof Error ? cause.message : String(cause)
      });
    });

  if (options.waitUntil) {
    options.waitUntil(posted);
  }

  return event;
}
