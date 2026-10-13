/**
 * Places Ammoura does not serve: no signup, no checkout, no order. These are
 * the regions under comprehensive US sanctions (OFAC). Stripe refuses them
 * too, so an order from one would be taken and then never paid.
 *
 * This is one list on purpose. When OFAC's list changes, change it here and
 * nowhere else. Last checked against OFAC's sanctions programs: 2026-10-13.
 *
 * Syria: most of its sanctions were lifted in 2025. It stays blocked until
 * that is confirmed against OFAC's current list, because blocking a lawful
 * country costs a few customers and serving an embargoed one costs far more.
 *
 * Russia and Belarus are not here. They are not under a full embargo, so a
 * person there may hold an account. Stripe does not support them, so a
 * payment from there fails at Stripe on its own.
 *
 * Shared with the browser so the country picker can leave these out; the
 * server checks again and is the part that counts.
 */

/** Whole countries, ISO 3166-1 alpha-2. */
export const RESTRICTED_COUNTRY_CODES: readonly string[] = ['CU', 'IR', 'KP', 'SY'];

/**
 * Parts of a country, ISO 3166-2 subdivision codes: the Russian-occupied
 * regions of Ukraine that OFAC embargoes on their own.
 */
export const RESTRICTED_SUBDIVISIONS: readonly string[] = [
  'UA-43', // Crimea
  'UA-40', // Sevastopol
  'UA-14', // Donetsk
  'UA-09' // Luhansk
];

/**
 * How an address's free-text state field names those regions, in the
 * spellings people use. Matched against the whole field, without case.
 */
const RESTRICTED_REGION_NAMES =
  /\b(crimea|krym|krim|sevastopol|sebastopol|donetsk|donetska|donetskaya|luhansk|luhanska|lugansk|luganskaya)\b|крым|севастополь|донецк|луганськ|луганск/i;

/** The message a blocked visitor sees. It says why, without legal detail. */
export const RESTRICTED_REGION_MESSAGE =
  'Sorry, we cannot offer accounts or orders in your region because of US trade sanctions.';

/** True when a whole country is blocked. */
export function isRestrictedCountry(code: string | null | undefined): boolean {
  return !!code && RESTRICTED_COUNTRY_CODES.includes(code.trim().toUpperCase());
}

/**
 * True when a location is blocked. `region` is a subdivision code — either
 * the full form (`UA-43`) or the part after the dash (`43`), which is how
 * Cloudflare reports it.
 */
export function isRestrictedLocation(
  country: string | null | undefined,
  region?: string | null
): boolean {
  if (isRestrictedCountry(country)) return true;
  if (!country || !region) return false;
  const cc = country.trim().toUpperCase();
  const r = region.trim().toUpperCase();
  const full = r.includes('-') ? r : `${cc}-${r}`;
  return RESTRICTED_SUBDIVISIONS.includes(full);
}

/**
 * True when a postal address is in a blocked place. `country` must already
 * be an ISO-2 code. For a country that is blocked only in part, the state
 * field is read for the region's code or name.
 */
export function isRestrictedAddress(country: string, state?: string | null): boolean {
  if (isRestrictedCountry(country)) return true;
  const cc = country.trim().toUpperCase();
  if (!RESTRICTED_SUBDIVISIONS.some((s) => s.startsWith(`${cc}-`))) return false;
  const text = (state ?? '').trim();
  if (!text) return false;
  return isRestrictedLocation(cc, text) || RESTRICTED_REGION_NAMES.test(text);
}
