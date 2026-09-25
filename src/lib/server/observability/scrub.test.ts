import { describe, it, expect } from 'vitest';
import { scrub, scrubString, REDACTED } from './scrub';

describe('scrubString', () => {
  it('redacts email addresses anywhere in free text', () => {
    expect(scrubString('failed for buyer@example.com on retry')).toBe(
      `failed for ${REDACTED} on retry`
    );
  });

  it('redacts a bearer token but keeps the prefix readable', () => {
    expect(scrubString('Authorization: Bearer abc123def')).toContain('Bearer [redacted]');
  });

  it('redacts key=value secrets in a url', () => {
    const scrubbed = scrubString('GET /x?api_key=sk_live_9f8e7d&page=2');
    expect(scrubbed).not.toContain('sk_live_9f8e7d');
    expect(scrubbed).toContain('page=2');
  });

  it('redacts a long opaque run that is almost certainly a key', () => {
    const key = 'A'.repeat(48);
    expect(scrubString(`token is ${key}`)).not.toContain(key);
  });

  it('redacts a card number that passes Luhn', () => {
    expect(scrubString('paid with 4242424242424242')).toBe(`paid with ${REDACTED}`);
  });

  it('leaves a 13-digit timestamp alone', () => {
    // The trap this guards: epoch millis is 13 digits and is not a card.
    expect(scrubString('at 1787896954123 ms')).toBe('at 1787896954123 ms');
  });

  it('leaves ordinary prose untouched', () => {
    expect(scrubString('order 42 shipped to the depot')).toBe('order 42 shipped to the depot');
  });
});

describe('scrub', () => {
  it('redacts by key name regardless of casing or separators', () => {
    const out = scrub({
      password: 'hunter2',
      STRIPE_SECRET_KEY: 'sk_live',
      clientSecret: 'shh',
      access_token: 'tok'
    }) as Record<string, unknown>;

    expect(Object.values(out)).toEqual([REDACTED, REDACTED, REDACTED, REDACTED]);
  });

  it('redacts personally identifying fields', () => {
    const out = scrub({
      email: 'a@b.com',
      phone: '555-0100',
      address: '37 Shawmut St',
      postalCode: '04240',
      firstName: 'Ada'
    }) as Record<string, unknown>;

    expect(Object.values(out).every((value) => value === REDACTED)).toBe(true);
  });

  it('keeps a count even when the key contains a sensitive word', () => {
    expect(scrub({ addressCount: 3 })).toEqual({ addressCount: 3 });
  });

  it('keeps operational fields', () => {
    expect(scrub({ siteId: 'site-1', status: 500, ok: false })).toEqual({
      siteId: 'site-1',
      status: 500,
      ok: false
    });
  });

  it('walks nested objects', () => {
    expect(scrub({ order: { id: 'o1', customer: { email: 'a@b.com' } } })).toEqual({
      order: { id: 'o1', customer: { email: REDACTED } }
    });
  });

  it('resolves a cycle instead of throwing', () => {
    const node: Record<string, unknown> = { name: 'root' };
    node.self = node;
    expect(scrub(node)).toEqual({ name: 'root', self: '[circular]' });
  });

  it('stops at max depth', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 'too far' } } } } } } };
    expect(JSON.stringify(scrub(deep))).toContain('[max depth]');
  });

  it('caps array length and says how many were dropped', () => {
    const out = scrub(
      Array.from({ length: 55 }, (_unused, i) => i),
      {
        maxArrayLength: 50
      }
    ) as unknown[];
    expect(out).toHaveLength(51);
    expect(out[50]).toBe('[+5 more]');
  });

  it('truncates an over-long string', () => {
    // Spaced words on purpose: an unbroken 50-character run would be caught by
    // the long-opaque-key rule and redacted before it could be truncated.
    const prose = 'log line words '.repeat(4);
    const out = scrub(prose, { maxStringLength: 10 }) as string;
    expect(out).toBe(`${prose.slice(0, 10)}…[truncated]`);
  });

  it('flattens an Error to name, message and stack', () => {
    const error = new TypeError('bad thing for a@b.com');
    const out = scrub(error) as Record<string, unknown>;
    expect(out.name).toBe('TypeError');
    expect(out.message).toBe(`bad thing for ${REDACTED}`);
    expect(typeof out.stack).toBe('string');
  });

  it('handles the primitives that JSON cannot', () => {
    expect(scrub(10n)).toBe('10');
    expect(scrub(() => undefined)).toBe('[function]');
    expect(scrub(Symbol('s'))).toBe('[symbol]');
    expect(scrub(null)).toBeNull();
    expect(scrub(undefined)).toBeUndefined();
  });

  it('renders a Date as ISO', () => {
    expect(scrub(new Date('2026-09-11T00:00:00.000Z'))).toBe('2026-09-11T00:00:00.000Z');
  });
});
