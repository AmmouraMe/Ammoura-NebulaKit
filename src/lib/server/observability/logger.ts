import { scrub } from './scrub';

/**
 * Structured logging for the Worker.
 *
 * Every server log line is one JSON object on a single line, so `wrangler tail`
 * and Logpush can filter on fields instead of grepping prose. The shape is
 * fixed: level, time, msg, and whatever request context is bound.
 *
 * All context and payloads go through `scrub` first — see scrub.ts. Nothing in
 * here should be able to leak a customer address or a provider credential, no
 * matter what a caller passes.
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);
}

/**
 * Request-scoped fields carried on every line. `requestId` ties a request's
 * lines together; `siteId` keeps one tenant's logs separable from another's.
 *
 * `userRole` rather than a user id, on purpose: knowing an admin hit the error
 * is what helps, and the raw identity is what we are not allowed to keep
 * (issue #75, Privacy).
 */
export interface LogContext {
  requestId?: string;
  siteId?: string;
  route?: string;
  method?: string;
  userRole?: string;
  release?: string;
  environment?: string;
  [key: string]: unknown;
}

export interface LoggerOptions {
  level?: LogLevel;
  context?: LogContext;
  /** Injectable for tests; defaults to the global console. */
  sink?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
  /** Injectable for tests; defaults to Date.now. */
  now?: () => number;
}

export interface Logger {
  level: LogLevel;
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  /** A logger with extra context merged in; the parent is untouched. */
  child(context: LogContext): Logger;
  context: LogContext;
}

/**
 * Resolve the active level. An explicit `LOG_LEVEL` wins; otherwise production
 * is `info`, so debug logging is off unless someone asks for it (issue #75,
 * Structured logging).
 */
export function resolveLogLevel(configured: unknown, isDev: boolean): LogLevel {
  if (isLogLevel(configured)) {
    return configured;
  }
  return isDev ? 'debug' : 'info';
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const sink = options.sink ?? console;
  const now = options.now ?? Date.now;
  const context = options.context ?? {};

  function emit(entryLevel: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (LEVEL_RANK[entryLevel] < LEVEL_RANK[level]) {
      return;
    }

    const time = new Date(now()).toISOString();

    // Both the scrub and the serialise are inside the try. Reading a field can
    // itself throw — a getter that raises is enough — and a logger that throws
    // would take down the request it was only supposed to describe.
    let serialized: string;
    try {
      serialized = JSON.stringify({
        level: entryLevel,
        time,
        msg: message,
        ...(scrub(context) as Record<string, unknown>),
        ...(fields ? (scrub(fields) as Record<string, unknown>) : {})
      });
    } catch {
      serialized = JSON.stringify({
        level: entryLevel,
        time,
        msg: message,
        logError: 'context could not be serialised'
      });
    }

    sink[entryLevel](serialized);
  }

  return {
    level,
    context,
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),
    child: (extra) => createLogger({ level, sink, now, context: { ...context, ...extra } })
  };
}
