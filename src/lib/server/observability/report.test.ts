import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reportError,
  toErrorEvent,
  fingerprintError,
  shouldAlert,
  resetAlertThrottle
} from './report';
import { createLogger } from './logger';
import { REDACTED } from './scrub';

/** Typed so `mock.calls[0]` destructures instead of inferring an empty tuple. */
function fetchMock() {
  return vi.fn(async (_url: string, _init?: RequestInit) => new Response('ok'));
}

function silentLogger() {
  const sink = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { sink, logger: createLogger({ level: 'debug', sink }) };
}

beforeEach(() => {
  resetAlertThrottle();
});

describe('fingerprintError', () => {
  it('folds digits so the same bug on different rows counts once', () => {
    const a = fingerprintError('Error', 'record 41 not found', 'at load (x.js:1)', '/p');
    const b = fingerprintError('Error', 'record 42 not found', 'at load (x.js:1)', '/p');
    expect(a).toBe(b);
  });

  it('separates the same message thrown from a different route', () => {
    const a = fingerprintError('Error', 'nope', 'at load (x.js:1)', '/a');
    const b = fingerprintError('Error', 'nope', 'at load (x.js:1)', '/b');
    expect(a).not.toBe(b);
  });

  it('copes with no stack at all', () => {
    expect(fingerprintError('Error', 'nope', undefined, '/a')).toContain('no-stack');
  });
});

describe('toErrorEvent', () => {
  it('scrubs the message and the context', () => {
    const event = toErrorEvent(new Error('failed for buyer@example.com'), {
      siteId: 'site-1',
      customerEmail: 'buyer@example.com'
    });

    expect(event.message).toBe(`failed for ${REDACTED}`);
    expect((event.context as Record<string, unknown>).customerEmail).toBe(REDACTED);
    expect((event.context as Record<string, unknown>).siteId).toBe('site-1');
  });

  it('accepts a thrown string', () => {
    expect(toErrorEvent('just a string').message).toBe('just a string');
  });

  it('accepts a thrown object', () => {
    expect(toErrorEvent({ code: 500 }).name).toBe('Error');
  });
});

describe('shouldAlert', () => {
  it('allows a burst then throttles it', () => {
    const at = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(shouldAlert('fp', at)).toBe(true);
    }
    expect(shouldAlert('fp', at)).toBe(false);
  });

  it('lets the same fingerprint through again in the next window', () => {
    const at = 1_000_000;
    for (let i = 0; i < 5; i++) {
      shouldAlert('fp', at);
    }
    expect(shouldAlert('fp', at + 60_001)).toBe(true);
  });

  it('throttles per fingerprint, not globally', () => {
    const at = 1_000_000;
    for (let i = 0; i < 5; i++) {
      shouldAlert('one', at);
    }
    expect(shouldAlert('two', at)).toBe(true);
  });
});

describe('reportError', () => {
  it('always writes a structured error line', () => {
    const { sink, logger } = silentLogger();
    reportError(new Error('boom'), { siteId: 'site-1' }, { logger });

    expect(sink.error).toHaveBeenCalledTimes(1);
    const line = JSON.parse(sink.error.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(line.msg).toBe('boom');
    expect(line.fingerprint).toBeTruthy();
  });

  it('does not post anywhere when no webhook is configured', () => {
    const { logger } = silentLogger();
    const fetchImpl = vi.fn();
    reportError(new Error('boom'), {}, { logger, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts an alert when a webhook is configured', async () => {
    const { logger } = silentLogger();
    const fetchImpl = fetchMock();
    const waitUntil = vi.fn();

    reportError(
      new Error('boom'),
      { siteId: 'site-1', route: '/checkout', environment: 'production' },
      {
        logger,
        webhookUrl: 'https://hook.example/x',
        fetchImpl: fetchImpl as unknown as typeof fetch,
        waitUntil
      }
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://hook.example/x');
    const body = JSON.parse(init?.body as string) as { content: string };
    expect(body.content).toContain('boom');
    expect(body.content).toContain('site-1');
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('never leaks a scrubbed value into the alert body', () => {
    const { logger } = silentLogger();
    const fetchImpl = fetchMock();

    reportError(
      new Error('checkout failed for buyer@example.com'),
      { siteId: 'site-1' },
      {
        logger,
        webhookUrl: 'https://hook.example/x',
        fetchImpl: fetchImpl as unknown as typeof fetch
      }
    );

    const body = fetchImpl.mock.calls[0][1]?.body as string;
    expect(body).not.toContain('buyer@example.com');
    expect(body).toContain(REDACTED);
  });

  it('posts without waitUntil when there is no execution context', () => {
    const { logger } = silentLogger();
    const fetchImpl = fetchMock();

    expect(() =>
      reportError(
        new Error('boom'),
        {},
        {
          logger,
          webhookUrl: 'https://hook.example/x',
          fetchImpl: fetchImpl as unknown as typeof fetch
        }
      )
    ).not.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throttles the alert but keeps logging every occurrence', () => {
    const { sink, logger } = silentLogger();
    const fetchImpl = fetchMock();
    const options = {
      logger,
      webhookUrl: 'https://hook.example/x',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 2_000_000
    };

    for (let i = 0; i < 8; i++) {
      reportError(new Error('same bug'), { route: '/p' }, options);
    }

    expect(sink.error).toHaveBeenCalledTimes(8);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it('renders an alert for an error with no stack', () => {
    const { logger } = silentLogger();
    const fetchImpl = fetchMock();
    const bare = new Error('no stack here');
    delete bare.stack;

    reportError(
      bare,
      {},
      {
        logger,
        webhookUrl: 'https://hook.example/x',
        fetchImpl: fetchImpl as unknown as typeof fetch
      }
    );

    const body = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string);
    expect(body.content).toContain('no stack here');
    expect(body.content).not.toContain('```');
  });

  it('warns rather than throws when the webhook is down', async () => {
    const { sink, logger } = silentLogger();
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });

    expect(() =>
      reportError(
        new Error('boom'),
        {},
        {
          logger,
          webhookUrl: 'https://hook.example/x',
          fetchImpl: fetchImpl as unknown as typeof fetch
        }
      )
    ).not.toThrow();

    await vi.waitFor(() => expect(sink.warn).toHaveBeenCalled());
    expect(JSON.parse(sink.warn.mock.calls[0][0] as string).msg).toBe('error alert webhook failed');
  });
});
