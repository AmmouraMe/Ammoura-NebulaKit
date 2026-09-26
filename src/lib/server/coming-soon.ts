/**
 * The coming-soon gate: what the public may still see before a site goes live.
 *
 * A site that is being built needs somewhere to point a domain at that is not a
 * half-finished storefront. Every tenant reaches that stage, and until now the
 * only answers were "publish nothing and serve an empty shop" or "park the
 * domain somewhere else entirely" — which is what customperfections.com did, on
 * Squarespace, for four months.
 *
 * The gate itself lives in `hooks.server.ts`; this module is only the decision
 * about paths, pulled out so it can be tested and read on its own. The idea and
 * the shape of the exemption list are ported from the gate proved on
 * customperfections.com (`site/src/lib/coming-soon-gate.ts` there).
 *
 * ## The exemption list is not a list of harmless things
 *
 * It is a list of things that would be actively BROKEN by being gated, and the
 * difference matters every time someone adds to it. Three kinds:
 *
 * **The app's own machinery** — `/admin`, `/auth`, `/user`, `/api`. Gating those
 * locks the owner out of the site they are building, and breaks the sign-up form
 * that the holding page itself posts to.
 *
 * **Assets** — anything with a file extension, plus SvelteKit's own `/_app`
 * bundle. The holding page is built from them, so gating them gates the holding
 * page.
 *
 * **The legal pages.** This is the one that looks wrong and is not. Setting up
 * any OAuth provider means handing over a privacy policy URL, and the provider
 * fetches it as an anonymous visitor — Custom Perfections found this when
 * Facebook refused their app, because the URL returned a holding page. Google
 * asks for the same two, and so does every app store, payment processor and ad
 * platform anyone will ever apply to. The deeper reason has nothing to do with
 * Facebook: a privacy policy that cannot be read without getting past a gate is
 * not a privacy policy. It is the one page on a site that exists specifically to
 * be read by someone who has not agreed to anything yet.
 */

/** Where the holding page lives. A real builder page, editable like any other. */
export const COMING_SOON_SLUG = '/coming-soon';

/**
 * Prefixes that are never gated. Matched as a path segment, so `/apiary` is not
 * treated as `/api` — a prefix test on the raw string would gate the owner's
 * page named "Authenticity" as if it were `/auth`.
 */
export const EXEMPT_PREFIXES = [
  '/admin',
  '/auth',
  '/api',
  '/user',
  '/account',
  '/_app',
  '/.well-known'
];

/**
 * Exact paths that are never gated.
 *
 * `/privacy-policy` and `/terms-of-service` are the builder's own builtin slugs;
 * the shorter spellings are here because that is what an external form asks for
 * and what people type.
 */
export const EXEMPT_PATHS = [
  COMING_SOON_SLUG,
  '/privacy-policy',
  '/terms-of-service',
  '/privacy',
  '/terms',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico'
];

/** A path segment boundary match, so /apiary is not /api. */
function hasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * What an asset extension looks like: a dot, then a letter, then a few more
 * letters or digits.
 *
 * "Contains a dot" was the first version and it was too broad — a page at
 * `/shop/v2.0` is a page, and gating it as though it were a file meant the
 * holding page never appeared there. Requiring the extension to START with a
 * letter separates `.woff2` and `.js` from `.0` and `.2024`. Up to twelve
 * characters so `.webmanifest` still counts.
 */
const ASSET_EXTENSION = /\.[a-z][a-z0-9]{1,11}$/i;

/**
 * True when this path must be served normally even with the gate up.
 *
 * The extension rule is what lets every image, font and stylesheet the holding
 * page needs through without any of them being listed. Only the last segment is
 * examined, so a directory called `/v1.2` does not make everything under it a
 * file.
 */
export function isExemptPath(pathname: string): boolean {
  if (EXEMPT_PATHS.includes(pathname)) return true;
  if (EXEMPT_PREFIXES.some((prefix) => hasPrefix(pathname, prefix))) return true;
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  return ASSET_EXTENSION.test(lastSegment);
}

export interface GateDecision {
  /** Whether to serve the holding page instead of what was asked for. */
  gated: boolean;
  /** Why not, for the tests and for anyone reading a log. */
  reason:
    'gated' | 'not-enabled' | 'exempt-path' | 'owner' | 'data-request' | 'non-document-request';
}

export interface GateInput {
  enabled: boolean;
  pathname: string;
  /** A signed-in admin or platform engineer: the person building the site. */
  isAdmin: boolean;
  /** The request method. Only document GETs are ever replaced. */
  method?: string;
  /**
   * SvelteKit's client-side navigation data requests, which carry `__data.json`
   * in the path. They are handled by the extension rule, but named here because
   * getting them wrong produces a page that looks fine until you click a link.
   */
  isDataRequest?: boolean;
}

/**
 * Should this request get the holding page?
 *
 * Fails OPEN, not closed: every branch that is not clearly "gate this" serves
 * the real site. A gate that errs towards gating takes a live shop offline,
 * which is a far worse failure than a holding page missing for one request.
 */
export function decideGate(input: GateInput): GateDecision {
  if (!input.enabled) return { gated: false, reason: 'not-enabled' };

  // The owner sees their own site as it really is. Building behind a gate you
  // cannot see past is building blind.
  if (input.isAdmin) return { gated: false, reason: 'owner' };

  if (input.isDataRequest) return { gated: false, reason: 'data-request' };

  // Only a request for a page is replaced with a page. A POST that got this far
  // is for an exempt API anyway, and answering it with HTML would be a lie about
  // what happened.
  const method = input.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    return { gated: false, reason: 'non-document-request' };
  }

  if (isExemptPath(input.pathname)) return { gated: false, reason: 'exempt-path' };

  return { gated: true, reason: 'gated' };
}

/**
 * The status a gated response carries.
 *
 * 503 rather than 200: the site is not live, and saying so is what keeps a
 * search engine from indexing a holding page as the storefront, and what lets an
 * uptime check tell "not launched yet" from "launched and broken". It is the
 * same choice customperfections.com made.
 *
 * `Retry-After` is deliberately absent — nobody knows when the site launches,
 * and a made-up number is worse than none.
 */
export const GATED_STATUS = 503;

export const GATED_HEADERS: Record<string, string> = {
  // Never cached. A holding page cached at an edge outlives the launch that was
  // supposed to replace it, and the owner cannot flush someone else's CDN.
  'cache-control': 'no-store, must-revalidate',
  'x-robots-tag': 'noindex'
};
