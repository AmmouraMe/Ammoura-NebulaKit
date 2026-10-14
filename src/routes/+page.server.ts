import type { PageServerLoad } from './$types';
import { getDB, getAllProducts, getProductFulfillmentOptions } from '$lib/server/db';
import * as pagesDb from '$lib/server/db/pages';
import { getPublishedRevision, getMostRecentDraftRevision } from '$lib/server/db/revisions';
import { resolveComponentRefs } from '$lib/server/db/components';
import { translateComponents, translateProducts } from '$lib/server/i18n/content-translations';
import * as colorThemes from '$lib/server/db/color-themes';
import type { PageComponent, PageProperties } from '$lib/types/pages';
import { shopperPricing, withShopperPrice } from '$lib/server/regional-pricing';

export const load: PageServerLoad = async ({ platform, locals, url }) => {
  // If platform is not available (development without D1), fall back to empty array
  if (!platform?.env?.DB) {
    return {
      products: [],
      page: null,
      components: [],
      isAdmin: false,
      systemLightTheme: 'vibrant',
      systemDarkTheme: 'midnight'
    };
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';

    // Get system default theme IDs
    const [systemLightThemeId, systemDarkThemeId] = await Promise.all([
      colorThemes.getThemePreference(db, siteId, 'system-light-theme'),
      colorThemes.getThemePreference(db, siteId, 'system-dark-theme')
    ]);

    // Check if a page exists for the home route '/'
    const page = await pagesDb.getPageBySlug(db, siteId, '/');

    // Admin preview (?preview) renders the most recent draft revision (matches
    // the [...slug] route), so the builder's device-width preview iframe shows
    // unsaved-but-drafted edits. Public viewers always get the published one.
    const isPreview = url.searchParams.has('preview') && (locals.isAdmin || false);

    let components: PageComponent[] = [];
    let pageProperties: PageProperties | undefined;
    if (page && (page.status === 'published' || isPreview)) {
      let revision = isPreview ? await getMostRecentDraftRevision(db, siteId, page.id) : null;
      if (!revision) {
        revision = await getPublishedRevision(db, siteId, page.id);
      }
      const rawComponents = revision?.components || [];
      pageProperties = revision?.pageProperties;

      // Resolve component_ref types to actual component types for frontend rendering
      components = await resolveComponentRefs(db, siteId, rawComponents);

      // Overlay per-locale content translations (no-op for the default locale)
      components = await translateComponents(
        db,
        siteId,
        locals.locale,
        locals.i18n?.defaultLocale ?? 'en',
        page.id,
        components
      );
    }

    // Fetch products from D1 database
    const dbProducts = await translateProducts(
      db,
      siteId,
      locals.locale,
      locals.i18n?.defaultLocale ?? 'en',
      await getAllProducts(db, siteId)
    );

    // Transform database products to match the Product type, at this
    // shopper's regional price
    const pricing = shopperPricing(locals);
    const products = await Promise.all(
      dbProducts.map(async (p) => {
        const fulfillmentOptions = await getProductFulfillmentOptions(db, siteId, p.id);
        return withShopperPrice(pricing, {
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          image: p.image,
          category: p.category,
          stock: p.stock,
          type: p.type,
          tags: JSON.parse(p.tags || '[]') as string[],
          fulfillmentOptions
        });
      })
    );

    return {
      products,
      page,
      components,
      pageProperties,
      colorTheme: page?.colorTheme || null,
      isAdmin: locals.isAdmin || false,
      systemLightTheme: systemLightThemeId || 'vibrant',
      systemDarkTheme: systemDarkThemeId || 'midnight'
    };
  } catch (error) {
    console.error('Error loading home page:', error);
    // Return empty arrays on error to prevent page from breaking
    return {
      products: [],
      page: null,
      components: [],
      isAdmin: false,
      systemLightTheme: 'vibrant',
      systemDarkTheme: 'midnight'
    };
  }
};
