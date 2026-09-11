import type { PageServerLoad } from './$types';
import { getDB } from '$lib/server/db/connection';
import { getTaxSettings } from '$lib/server/db/site-settings';
import { taxRateFromSettings } from '$lib/checkout-pricing';

/**
 * Give the checkout page the site's own tax rate.
 *
 * The page must quote the number `repriceCheckout` will charge, so both sides
 * resolve the same settings through `taxRateFromSettings`. The rate is loaded
 * here rather than in the root layout because only this route spends it, and a
 * settings read on every storefront page would be paid for nothing.
 */
export const load: PageServerLoad = async ({ platform, locals }) => {
  // Development without D1: quote no tax rather than fail the page.
  if (!platform?.env?.DB) {
    return { taxRate: 0 };
  }

  const siteId = locals.siteId || 'default-site';

  try {
    return { taxRate: taxRateFromSettings(await getTaxSettings(getDB(platform), siteId)) };
  } catch (error) {
    // A settings read must not block checkout on its own. In practice the same
    // database is down for `repriceCheckout`, so the order will fail there with
    // a real error instead of quoting a wrong tax.
    console.error('Failed to load tax settings for checkout:', error);
    return { taxRate: 0 };
  }
};
