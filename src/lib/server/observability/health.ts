/**
 * Health checks for the three bindings a request depends on.
 *
 * Each check is cheap and read-only: a trivial D1 query, an R2 HEAD of a key
 * that does not need to exist, and a KV read. The point is reachability and
 * credentials, not correctness — a check that writes would be a health check
 * that can break production.
 */

export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface HealthCheck {
  status: HealthStatus;
  /** Round-trip in milliseconds. */
  durationMs: number;
  /** Present only when the check did not pass. Never carries a credential. */
  error?: string;
  /** Set when a binding is simply not configured, which is not a failure. */
  skipped?: boolean;
}

export interface HealthReport {
  status: HealthStatus;
  release: string;
  environment: string;
  time: string;
  checks: Record<string, HealthCheck>;
}

interface HealthEnv {
  DB?: { prepare(query: string): { first(): Promise<unknown> } };
  MEDIA_BUCKET?: { head(key: string): Promise<unknown> };
  SITE_ROUTES?: { get(key: string): Promise<unknown> };
}

export interface HealthOptions {
  release?: string;
  environment?: string;
  now?: () => number;
  /** Fail a check that has not answered in this long. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 3000;

/** Reduce an error to a short, safe string — never the raw object. */
function describe(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message.slice(0, 200);
  }
  return String(cause).slice(0, 200);
}

async function timed(
  run: () => Promise<unknown>,
  now: () => number,
  timeoutMs: number
): Promise<HealthCheck> {
  const started = now();
  try {
    await Promise.race([
      run(),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
    return { status: 'ok', durationMs: now() - started };
  } catch (cause) {
    return { status: 'error', durationMs: now() - started, error: describe(cause) };
  }
}

/**
 * Run every check and fold the results into one status.
 *
 * A missing optional binding is `skipped`, not a failure — `SITE_ROUTES` is
 * genuinely optional (routing falls back to direct D1 lookups). A missing
 * required binding is an error, because nothing works without it.
 */
export async function checkHealth(
  env: HealthEnv | undefined,
  options: HealthOptions = {}
): Promise<HealthReport> {
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const checks: Record<string, HealthCheck> = {};

  checks.d1 = env?.DB
    ? await timed(() => env.DB!.prepare('SELECT 1').first(), now, timeoutMs)
    : { status: 'error', durationMs: 0, error: 'DB binding missing' };

  checks.r2 = env?.MEDIA_BUCKET
    ? await timed(() => env.MEDIA_BUCKET!.head('__health__'), now, timeoutMs)
    : { status: 'error', durationMs: 0, error: 'MEDIA_BUCKET binding missing' };

  // Optional by design: see wrangler.toml. Absent means "routing does direct
  // D1 lookups", which is a supported configuration rather than a fault.
  checks.kv = env?.SITE_ROUTES
    ? await timed(() => env.SITE_ROUTES!.get('__health__'), now, timeoutMs)
    : { status: 'ok', durationMs: 0, skipped: true };

  const statuses = Object.values(checks).map((check) => check.status);
  const status: HealthStatus = statuses.includes('error')
    ? 'error'
    : statuses.includes('degraded')
      ? 'degraded'
      : 'ok';

  return {
    status,
    release: options.release ?? 'unknown',
    environment: options.environment ?? 'unknown',
    time: new Date(now()).toISOString(),
    checks
  };
}
