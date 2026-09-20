/**
 * Checkout needs the site's tax rule before it can show a total.
 *
 * The page used to compute tax from a hardcoded 8% baked into the bundle, so
 * every store on the platform quoted the same rate whatever its settings said.
 * The rate is delivered here instead, from the same settings the server
 * charges with — see `$lib/server/checkout-pricing`.
 */
import { getDB } from '$lib/server/db/connection';
import { getCheckoutTaxRule } from '$lib/server/checkout-pricing';
import { NO_TAX } from '$lib/checkout-pricing';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, locals }) => {
  const siteId = locals.siteId;
  if (!platform?.env?.DB || !siteId) {
    return { taxRule: NO_TAX };
  }

  return { taxRule: await getCheckoutTaxRule(getDB(platform), siteId) };
};
