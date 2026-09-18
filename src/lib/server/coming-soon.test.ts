import { describe, it, expect } from 'vitest';
import {
  COMING_SOON_SLUG,
  decideGate,
  EXEMPT_PATHS,
  EXEMPT_PREFIXES,
  GATED_HEADERS,
  GATED_STATUS,
  isExemptPath
} from './coming-soon';

const gate = (over: Partial<Parameters<typeof decideGate>[0]> = {}) =>
  decideGate({ enabled: true, pathname: '/', isAdmin: false, ...over });

describe('isExemptPath', () => {
  it('lets the app own machinery through', () => {
    // Gating these locks the owner out of the site they are building.
    for (const path of ['/admin', '/admin/pages', '/auth/login', '/api/orders', '/user/settings']) {
      expect(isExemptPath(path)).toBe(true);
    }
  });

  it('matches on a segment boundary, so a page is not mistaken for a prefix', () => {
    // A prefix test on the raw string would gate an owner's page called
    // "Authenticity" as though it were /auth.
    expect(isExemptPath('/apiary')).toBe(false);
    expect(isExemptPath('/authenticity')).toBe(false);
    expect(isExemptPath('/administrators-of-the-year')).toBe(false);
  });

  it('lets every asset through, because the holding page is built from them', () => {
    for (const path of [
      '/fonts/brand.woff2',
      '/photos/tee.jpg',
      '/_app/immutable/chunk.js',
      '/favicon.ico'
    ]) {
      expect(isExemptPath(path)).toBe(true);
    }
  });

  it('tells an asset extension from a dot that happens to be in a page name', () => {
    // "contains a dot" was too broad: a page at /shop/v2.0 is a page, and gating
    // it as a file meant the holding page never appeared there.
    expect(isExemptPath('/shop/v2.0')).toBe(false);
    expect(isExemptPath('/v1.2/products')).toBe(false);
    expect(isExemptPath('/reports/q3.2024')).toBe(false);
    expect(isExemptPath('/site.webmanifest')).toBe(true);
    expect(isExemptPath('/style.css')).toBe(true);
  });

  it('lets the legal pages through, in both spellings', () => {
    // An OAuth provider fetches the privacy policy URL anonymously, and refuses
    // the app if it gets a holding page. More basically: a privacy policy behind
    // a gate is not a privacy policy.
    for (const path of ['/privacy', '/privacy-policy', '/terms', '/terms-of-service']) {
      expect(isExemptPath(path)).toBe(true);
    }
  });

  it('exempts the holding page itself, or the gate would recurse forever', () => {
    expect(isExemptPath(COMING_SOON_SLUG)).toBe(true);
  });

  it('gates an ordinary storefront path', () => {
    for (const path of ['/', '/products', '/products/mug', '/about', '/cart', '/checkout']) {
      expect(isExemptPath(path)).toBe(false);
    }
  });

  it('keeps the two lists free of a path that is also covered by a prefix', () => {
    // Not a correctness bug, but a duplicate is how a list starts to rot.
    for (const path of EXEMPT_PATHS) {
      expect(EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))).toBe(false);
    }
  });
});

describe('decideGate', () => {
  it('does nothing at all when the gate is off', () => {
    expect(gate({ enabled: false })).toEqual({ gated: false, reason: 'not-enabled' });
  });

  it('gates an anonymous visitor asking for a normal page', () => {
    expect(gate({ pathname: '/products' })).toEqual({ gated: true, reason: 'gated' });
  });

  it('never gates the owner — building behind a gate you cannot see past is blind', () => {
    expect(gate({ isAdmin: true, pathname: '/products' })).toEqual({
      gated: false,
      reason: 'owner'
    });
  });

  it('leaves exempt paths alone even with the gate up', () => {
    expect(gate({ pathname: '/privacy' }).gated).toBe(false);
    expect(gate({ pathname: '/api/orders' }).gated).toBe(false);
  });

  it('only ever replaces a document request', () => {
    // Answering a POST with HTML would be a lie about what happened.
    expect(gate({ pathname: '/products', method: 'POST' }).gated).toBe(false);
    expect(gate({ pathname: '/products', method: 'DELETE' }).gated).toBe(false);
    expect(gate({ pathname: '/products', method: 'HEAD' }).gated).toBe(true);
  });

  it('treats a missing method as a GET, which is what a page request is', () => {
    expect(gate({ pathname: '/products', method: undefined }).gated).toBe(true);
  });

  it('leaves client-side navigation data requests alone', () => {
    expect(gate({ pathname: '/products', isDataRequest: true }).gated).toBe(false);
  });

  it('fails open on every branch that is not clearly a gate', () => {
    // A gate that errs towards gating takes a live shop offline. That is a much
    // worse failure than one holding page missed.
    const notGated = [
      gate({ enabled: false }),
      gate({ isAdmin: true }),
      gate({ isDataRequest: true }),
      gate({ method: 'POST' }),
      gate({ pathname: '/admin' })
    ];
    expect(notGated.every((d) => d.gated === false)).toBe(true);
  });
});

describe('the gated response', () => {
  it('says the site is not live rather than pretending this is the page', () => {
    // 503 is what stops a search engine indexing the holding page as the shop,
    // and what lets an uptime check tell "not launched" from "launched, broken".
    expect(GATED_STATUS).toBe(503);
  });

  it('is never cached', () => {
    // A holding page cached at an edge outlives the launch meant to replace it,
    // and the owner cannot flush someone else's CDN.
    expect(GATED_HEADERS['cache-control']).toContain('no-store');
  });

  it('asks not to be indexed', () => {
    expect(GATED_HEADERS['x-robots-tag']).toBe('noindex');
  });

  it('promises no return date it cannot keep', () => {
    expect(GATED_HEADERS).not.toHaveProperty('retry-after');
  });
});
