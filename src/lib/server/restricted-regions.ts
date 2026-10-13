/**
 * The request side of the restricted-regions block (see
 * `$lib/data/restrictedRegions` for the list and why it exists).
 *
 * Cloudflare tells us where each request comes from: `request.cf` carries the
 * country and the subdivision, and the `cf-ipcountry` header carries the
 * country. A VPN gets past this, which is why checkout also checks the
 * addresses on the order.
 */
import { isRestrictedLocation } from '$lib/data/restrictedRegions';

/**
 * The API calls that create an account or an order. Pages and browsing stay
 * open: the signup and checkout pages call these, and show the refusal.
 */
const BLOCKED_ROUTES: { pattern: RegExp; methods?: readonly string[] }[] = [
  { pattern: /^\/api\/account\/signup$/ },
  { pattern: /^\/api\/auth\/oauth\/[^/]+(\/callback)?$/ },
  { pattern: /^\/api\/checkout\/session$/ },
  { pattern: /^\/api\/orders$/, methods: ['POST'] }
];

export interface RequestLocation {
  country: string | null;
  region: string | null;
}

interface CfLocation {
  country?: string;
  regionCode?: string;
}

/**
 * Where a request comes from. `cf` is Cloudflare's request metadata
 * (`platform.cf` under adapter-cloudflare); it is absent in dev and tests,
 * where the header is the fallback and usually absent too.
 */
export function requestLocation(
  cf: CfLocation | undefined | null,
  headers: Headers | undefined
): RequestLocation {
  const country = cf?.country || headers?.get('cf-ipcountry') || null;
  // Cloudflare sends XX for unknown and T1 for Tor; neither is a place.
  const known = country && /^[A-Z]{2}$/i.test(country) && !/^(XX|T1)$/i.test(country);
  return {
    country: known ? country.toUpperCase() : null,
    region: cf?.regionCode || null
  };
}

/** True when this path and method create an account or an order. */
export function isGeoBlockedRoute(pathname: string, method: string | undefined): boolean {
  return BLOCKED_ROUTES.some(
    (route) =>
      route.pattern.test(pathname) &&
      (!route.methods || (method !== undefined && route.methods.includes(method)))
  );
}

/** True when a request from this location to this route must be refused. */
export function shouldBlockRequest(
  location: RequestLocation,
  pathname: string,
  method: string | undefined
): boolean {
  return (
    isGeoBlockedRoute(pathname, method) && isRestrictedLocation(location.country, location.region)
  );
}
