import { json, type Handle } from '@sveltejs/kit';
import { getDB, getAccountBySessionToken, getUserBySessionToken } from '$lib/server/db';
import { ACCOUNT_SESSION_COOKIE } from '$lib/server/db/account-sessions';
import { USER_SESSION_COOKIE } from '$lib/server/db/user-sessions';
import {
  getSiteSettings,
  readComingSoon,
  readLanguageSettings
} from '$lib/server/db/site-settings';
import { COMING_SOON_SLUG, decideGate, GATED_HEADERS, GATED_STATUS } from '$lib/server/coming-soon';
import { resolveSiteIdForHostname } from '$lib/server/site-routing';
import { getPlatformSitesDomain } from '$lib/server/sites-service';
import { resolveLocale, isSupportedLocale, LOCALE_COOKIE, DEFAULT_LOCALE } from '$lib/i18n';
import { dev } from '$app/environment';

/**
 * SvelteKit hooks for multi-tenant site handling and authentication
 */

/** Dev-only cookie that pins the origin to one tenant site (see below). */
const DEV_SITE_COOKIE = 'dev_site';

/** Everything under these is the owner's, read or write. */
const OWNER_ONLY_PREFIXES = ['/api/admin/', '/api/ai-chat/'];

/** Exact paths only the owner may call. */
const OWNER_ONLY_PATHS = ['/api/media/upload', '/api/ai-chat'];

/**
 * Catalog and page-builder APIs. Reads stay public because the storefront
 * renders from them; writes are the owner's alone. Before this, anyone could
 * `DELETE /api/products` or `POST /api/pages` against any tenant with no
 * session at all — only `/api/admin/*` was ever guarded, and these live
 * outside that prefix.
 */
const OWNER_ONLY_WRITE_PREFIXES = [
  '/api/products',
  '/api/pages',
  '/api/page-components',
  '/api/components',
  '/api/layouts',
  '/api/orders/'
];

/**
 * Shoppers are anonymous by nature, so these stay open on every method.
 * `design-upload` does its own validation and rate limiting; `POST /api/orders`
 * is how a customer places an order in the first place.
 */
const PUBLIC_WRITE_PATTERNS = [/^\/api\/products\/[^/]+\/design-upload$/, /^\/api\/orders$/];

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** An absent method is treated as a write, so the guard fails closed. */
export function isOwnerOnlyRequest(pathname: string, method: string | undefined): boolean {
  if (OWNER_ONLY_PATHS.includes(pathname)) {
    return true;
  }
  if (OWNER_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (method && READ_METHODS.has(method)) {
    return false;
  }
  if (PUBLIC_WRITE_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return false;
  }
  return OWNER_ONLY_WRITE_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)
  );
}

export const handle: Handle = async ({ event, resolve }) => {
  // Get the hostname from the request
  const hostname = event.url.hostname;

  // Resolve the site from the hostname via site_domains (KV-cached when a
  // SITE_ROUTES namespace is bound), falling back to the legacy sites.domain
  // column. Unknown hosts still fall back to 'default-site' until the strict
  // 404 cutover (tenancy plan §2.3 / §6).
  let siteId = 'default-site';

  // DEV-ONLY: tenant-site simulation.
  // In production, tenant sites live at NAME.<PLATFORM_SITES_DOMAIN>. In dev
  // (localhost or the dev tunnel) that wildcard DNS doesn't exist, so
  // /subdomain/NAME sets a cookie and redirects to /; every request on the
  // origin then serves that site — root-relative links, cart and checkout all
  // work. Visit /subdomain with no name to return to the default site.
  // (A URL rewrite via event.url.pathname doesn't work: SvelteKit matches
  // routes on the original URL, so the old prefix approach 404'd.)
  let devSubdomainResolved = false;
  if (dev) {
    const subdomainMatch = event.url.pathname.match(/^\/subdomain(?:\/([^/]+))?(\/.*)?$/);
    if (subdomainMatch) {
      const slug = subdomainMatch[1];
      const rest = subdomainMatch[2] || '/';
      const cookie = slug
        ? event.cookies.serialize(DEV_SITE_COOKIE, slug, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: 60 * 60 * 24
          })
        : event.cookies.serialize(DEV_SITE_COOKIE, '', { path: '/', maxAge: 0 });
      return new Response(null, {
        status: 302,
        headers: { location: slug ? rest : '/', 'set-cookie': cookie }
      });
    }

    const devSlug = event.cookies?.get(DEV_SITE_COOKIE);
    if (devSlug && event.platform?.env?.DB) {
      try {
        const db = getDB(event.platform);
        const row = await db
          .prepare('SELECT id FROM sites WHERE slug = ? LIMIT 1')
          .bind(devSlug)
          .first<{ id: string }>();
        if (row) {
          siteId = row.id;
          devSubdomainResolved = true;
        }
      } catch {
        // ignore — fallback to hostname resolution below
      }
    }
  }

  if (!devSubdomainResolved) {
    try {
      if (event.platform?.env?.DB) {
        const db = getDB(event.platform);
        const kv = event.platform.env.SITE_ROUTES as KVNamespace | undefined;
        const resolved = await resolveSiteIdForHostname(
          db,
          kv,
          hostname,
          getPlatformSitesDomain(event.platform.env as Record<string, unknown>)
        );

        if (resolved) {
          siteId = resolved;
        }
      }
    } catch (error) {
      // Only log error in production; in dev, database might not be set up yet
      if (!dev) {
        console.error('Error loading site context:', error);
      }
      // Continue with default site on error
    }
  }

  // Set the site ID in locals for use in endpoints and pages
  event.locals.siteId = siteId;

  // Locale resolution (i18n core): explicit cookie choice → Accept-Language →
  // site default → platform default. The site's language settings come from
  // site_settings; without a DB (early dev) everything falls back to 'en'.
  // Note: in dev the /subdomain simulation shares one locale cookie across
  // simulated tenants (single origin) — harmless.
  let languageSettings = { defaultLocale: DEFAULT_LOCALE, enabledLocales: [DEFAULT_LOCALE] };
  // The coming-soon gate is read from the SAME settings row set as the locales.
  // One read, two answers: a second query per request for one boolean would be a
  // tax on every page view of every tenant, forever.
  let comingSoon = { enabled: false };
  if (event.platform?.env?.DB) {
    try {
      const rows = await getSiteSettings(getDB(event.platform), siteId);
      const settingsMap = new Map(rows.map((row) => [row.setting_key, row.setting_value]));
      languageSettings = readLanguageSettings(settingsMap);
      comingSoon = readComingSoon(settingsMap);
    } catch {
      // Defaults above, and the gate stays DOWN. A settings read that fails must
      // not take a live storefront offline.
    }
  }
  const enabledLocales = languageSettings.enabledLocales.filter(isSupportedLocale);
  event.locals.i18n = {
    defaultLocale: languageSettings.defaultLocale,
    enabledLocales: enabledLocales.length ? enabledLocales : [DEFAULT_LOCALE]
  };
  event.locals.locale = resolveLocale({
    cookieLocale: event.cookies?.get(LOCALE_COOKIE),
    acceptLanguage: event.request?.headers?.get('accept-language') ?? null,
    siteDefault: languageSettings.defaultLocale,
    enabledLocales: event.locals.i18n.enabledLocales
  });

  // Resolve platform account from the server-side session (tenancy plan T1).
  // The cookie holds an opaque token; identity/role always comes from the DB.
  const accountToken = event.cookies?.get(ACCOUNT_SESSION_COOKIE);
  if (accountToken && event.platform?.env?.DB) {
    try {
      const db = getDB(event.platform);
      const result = await getAccountBySessionToken(db, accountToken);
      if (result) {
        event.locals.account = result.account;
      } else {
        event.cookies.delete(ACCOUNT_SESSION_COOKIE, { path: '/' });
      }
    } catch (error) {
      if (!dev) {
        console.error('Error resolving account session:', error);
      }
    }
  }

  // Resolve the site-scoped admin/staff user from their server-side session.
  // The cookie holds an opaque token; identity, role, permissions and status
  // always come from the `users` row (migration 0101). It previously held the
  // user record as plain JSON, which meant anyone could send
  // `user_session={"role":"platform_engineer"}` and be believed — httpOnly
  // stops a script READING a cookie, not a client SENDING one.
  const userToken = event.cookies?.get(USER_SESSION_COOKIE);
  if (userToken && event.platform?.env?.DB) {
    try {
      const db = getDB(event.platform);
      const resolved = await getUserBySessionToken(db, userToken);
      if (resolved) {
        event.locals.currentUser = resolved.user;
        event.locals.isAdmin =
          resolved.user.role === 'admin' || resolved.user.role === 'platform_engineer';

        // Admin UI language preference: on admin/user surfaces the signed-in
        // user's own locale wins over the site's visitor resolution (it may be
        // any supported locale, not just the site's enabled ones).
        const path = event.url.pathname;
        if (
          resolved.user.locale &&
          isSupportedLocale(resolved.user.locale) &&
          (path.startsWith('/admin') || path.startsWith('/user'))
        ) {
          event.locals.locale = resolved.user.locale;
        }
      } else {
        event.cookies.delete(USER_SESSION_COOKIE, { path: '/' });
      }
    } catch (error) {
      if (!dev) {
        console.error('Error resolving user session:', error);
      }
    }
  }

  // Owner-only API surfaces. `/admin/*` pages already redirect anonymous
  // visitors, but the JSON APIs behind them answered anyone — `/api/admin/*`
  // returned 200, and `/api/media/upload` accepted 50MB from the public
  // internet. Guard them in one place rather than per route.
  if (!event.locals.isAdmin && isOwnerOnlyRequest(event.url.pathname, event.request?.method)) {
    return json({ message: 'Unauthorized' }, { status: 401 });
  }

  // The coming-soon gate. Last, because it has to know whether this is the owner
  // — the person building the site always sees the site, never the holding page.
  //
  // The holding page is served IN PLACE rather than redirected to, so the URL a
  // visitor was given survives: when the gate comes down, their reload lands on
  // the page they were looking for. Route resolution happens before `handle`, so
  // the URL cannot simply be rewritten here; instead the holding page is fetched
  // as an internal sub-request, which routes and renders it through the ordinary
  // page pipeline. That is what keeps it a real builder page — editable, themed,
  // and able to use every component — rather than a hand-coded HTML string.
  //
  // The sub-request cannot recurse: COMING_SOON_SLUG is on the exemption list.
  const gate = decideGate({
    enabled: comingSoon.enabled,
    pathname: event.url.pathname,
    isAdmin: Boolean(event.locals.isAdmin),
    method: event.request?.method,
    isDataRequest: event.url.pathname.endsWith('__data.json')
  });

  if (gate.gated) {
    try {
      const holding = await event.fetch(COMING_SOON_SLUG);
      if (holding.ok) {
        const headers = new Headers(GATED_HEADERS);
        const contentType = holding.headers.get('content-type');
        if (contentType) headers.set('content-type', contentType);
        return new Response(await holding.text(), { status: GATED_STATUS, headers });
      }
    } catch (error) {
      if (!dev) {
        console.error('Coming-soon holding page failed to render:', error);
      }
    }
    // The holding page is missing or broken. Serving the real site is the wrong
    // answer here — the owner asked for it to be hidden — so say plainly that
    // there is nothing to see yet rather than leaking a half-built shop.
    return new Response('This site is not published yet.', {
      status: GATED_STATUS,
      headers: { ...GATED_HEADERS, 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  return resolve(event, {
    // app.html carries lang="%lang%"; emit the resolved locale
    transformPageChunk: ({ html }) => html.replace('%lang%', event.locals.locale)
  });
};
