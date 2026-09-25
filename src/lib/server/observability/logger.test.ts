import { describe, it, expect, vi } from 'vitest';
import { createLogger, resolveLogLevel, isLogLevel } from './logger';
import { REDACTED } from './scrub';

function harness(level?: 'debug' | 'info' | 'warn' | 'error') {
  const sink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const logger = createLogger({
    level,
    sink,
    now: () => Date.parse('2026-09-11T12:00:00.000Z'),
    context: { requestId: 'req-1', siteId: 'site-1' }
  });
  return { sink, logger };
}

/** Every line is one JSON object; parse it rather than matching on prose. */
function lineFrom(mock: ReturnType<typeof vi.fn>) {
  return JSON.parse(mock.mock.calls[0][0] as string) as Record<string, unknown>;
}

describe('createLogger', () => {
  it('emits one JSON line with the fixed shape', () => {
    const { sink, logger } = harness('info');
    logger.info('request', { status: 200 });

    expect(sink.info).toHaveBeenCalledTimes(1);
    expect(lineFrom(sink.info)).toEqual({
      level: 'info',
      time: '2026-09-11T12:00:00.000Z',
      msg: 'request',
      requestId: 'req-1',
      siteId: 'site-1',
      status: 200
    });
  });

  it('drops lines below the active level', () => {
    const { sink, logger } = harness('warn');
    logger.debug('noise');
    logger.info('noise');
    logger.warn('kept');
    logger.error('kept');

    expect(sink.debug).not.toHaveBeenCalled();
    expect(sink.info).not.toHaveBeenCalled();
    expect(sink.warn).toHaveBeenCalledTimes(1);
    expect(sink.error).toHaveBeenCalledTimes(1);
  });

  it('scrubs both the bound context and the per-call fields', () => {
    const sink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const logger = createLogger({ level: 'info', sink, context: { apiKey: 'sk_live_x' } });
    logger.info('checkout', { customerEmail: 'buyer@example.com' });

    const line = lineFrom(sink.info);
    expect(line.apiKey).toBe(REDACTED);
    expect(line.customerEmail).toBe(REDACTED);
  });

  it('child() adds context without touching the parent', () => {
    const { sink, logger } = harness('info');
    const child = logger.child({ route: '/checkout' });

    child.info('a');
    logger.info('b');

    expect(lineFrom(sink.info).route).toBe('/checkout');
    expect(JSON.parse(sink.info.mock.calls[1][0] as string).route).toBeUndefined();
    expect(logger.context.route).toBeUndefined();
  });

  it('still logs when a field cannot be serialised', () => {
    const sink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const logger = createLogger({ level: 'info', sink });
    // A getter that throws survives scrub() (it copies values) but not
    // JSON.stringify; the fallback line must still carry the message.
    logger.info('boom', {
      get exploding() {
        throw new Error('nope');
      }
    });

    expect(sink.info).toHaveBeenCalledTimes(1);
    expect(lineFrom(sink.info).msg).toBe('boom');
  });
});

describe('resolveLogLevel', () => {
  it('honours an explicit level', () => {
    expect(resolveLogLevel('debug', false)).toBe('debug');
  });

  it('defaults to info in production, so debug is off', () => {
    expect(resolveLogLevel(undefined, false)).toBe('info');
    expect(resolveLogLevel('shouty', false)).toBe('info');
  });

  it('defaults to debug in development', () => {
    expect(resolveLogLevel(undefined, true)).toBe('debug');
  });
});

describe('isLogLevel', () => {
  it('accepts the four levels and nothing else', () => {
    expect(isLogLevel('warn')).toBe(true);
    expect(isLogLevel('trace')).toBe(false);
    expect(isLogLevel(3)).toBe(false);
  });
});
