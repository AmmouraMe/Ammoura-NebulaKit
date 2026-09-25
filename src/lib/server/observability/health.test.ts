import { describe, it, expect, vi } from 'vitest';
import { checkHealth } from './health';

function okEnv() {
  return {
    DB: { prepare: () => ({ first: async () => ({ 1: 1 }) }) },
    MEDIA_BUCKET: { head: async () => null },
    SITE_ROUTES: { get: async () => null }
  };
}

describe('checkHealth', () => {
  it('reports ok when all three bindings answer', async () => {
    const report = await checkHealth(okEnv(), { release: '0.1.0', environment: 'production' });

    expect(report.status).toBe('ok');
    expect(report.release).toBe('0.1.0');
    expect(report.environment).toBe('production');
    expect(report.checks.d1.status).toBe('ok');
    expect(report.checks.r2.status).toBe('ok');
    expect(report.checks.kv.status).toBe('ok');
  });

  it('fails when D1 throws, and says so without the raw error', async () => {
    const env = okEnv();
    env.DB = {
      prepare: () => ({
        first: async () => {
          throw new Error('D1_ERROR: no such table');
        }
      })
    };

    const report = await checkHealth(env);
    expect(report.status).toBe('error');
    expect(report.checks.d1.status).toBe('error');
    expect(report.checks.d1.error).toBe('D1_ERROR: no such table');
  });

  it('fails when R2 is unreachable', async () => {
    const env = okEnv();
    env.MEDIA_BUCKET = {
      head: async () => {
        throw new Error('unreachable');
      }
    };

    expect((await checkHealth(env)).status).toBe('error');
  });

  it('skips KV rather than failing when the optional binding is absent', async () => {
    const env = okEnv();
    delete (env as Partial<ReturnType<typeof okEnv>>).SITE_ROUTES;

    const report = await checkHealth(env);
    expect(report.status).toBe('ok');
    expect(report.checks.kv.skipped).toBe(true);
  });

  it('errors when a required binding is missing', async () => {
    const report = await checkHealth(undefined);
    expect(report.status).toBe('error');
    expect(report.checks.d1.error).toBe('DB binding missing');
    expect(report.checks.r2.error).toBe('MEDIA_BUCKET binding missing');
  });

  it('times a check out rather than hanging the endpoint', async () => {
    vi.useFakeTimers();
    const env = okEnv();
    env.DB = { prepare: () => ({ first: () => new Promise<never>(() => {}) }) };

    const pending = checkHealth(env, { timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(60);
    const report = await pending;
    vi.useRealTimers();

    expect(report.checks.d1.status).toBe('error');
    expect(report.checks.d1.error).toContain('timed out');
  });

  it('records a duration for each check', async () => {
    let clock = 1000;
    const report = await checkHealth(okEnv(), {
      now: () => {
        clock += 5;
        return clock;
      }
    });
    expect(report.checks.d1.durationMs).toBeGreaterThan(0);
    expect(report.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('defaults release and environment when not given', async () => {
    const report = await checkHealth(okEnv());
    expect(report.release).toBe('unknown');
    expect(report.environment).toBe('unknown');
  });
});
