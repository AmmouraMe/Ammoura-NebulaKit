import {
  getDB,
  getProductById,
  getProductMedia,
  getProductFulfillmentOptions,
  getCustomizationZones,
  getCustomizationFields,
  getProductEquipmentWithFields,
  getProductVariants,
  getPrintAreasByIds
} from '$lib/server/db';
import { getProductShippingOptions } from '$lib/server/db/shipping-options';
import { translateProducts } from '$lib/server/i18n/content-translations';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { logProductAction } from '$lib/server/activity-logger';
import { shopperPricing, withShopperPrice } from '$lib/server/regional-pricing';

export const load: PageServerLoad = async ({
  params,
  platform,
  locals,
  getClientAddress,
  request
}) => {
  // If platform is not available (development without D1), return error
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';

    // Fetch product from D1 database (translated for the request locale)
    const dbProductRaw = await getProductById(db, siteId, params.id);
    const dbProduct = dbProductRaw
      ? (
          await translateProducts(db, siteId, locals.locale, locals.i18n?.defaultLocale ?? 'en', [
            dbProductRaw
          ])
        )[0]
      : null;

    if (!dbProduct) {
      throw error(404, 'Product not found');
    }

    // Fetch product media
    const dbMedia = await getProductMedia(db, siteId, params.id);

    // Fetch fulfillment options
    const fulfillmentOptions = await getProductFulfillmentOptions(db, siteId, params.id);

    // Fetch shipping options for physical products
    const shippingOptionsRaw =
      dbProduct.type === 'physical' ? await getProductShippingOptions(db, siteId, params.id) : [];

    // Fetch customization zones
    const customizationZones = await getCustomizationZones(db, siteId, params.id);

    // Physical geometry (inches + required DPI) for whichever zones are linked
    // to a template print area. Drives the customizer's print-quality meter;
    // zones with no linked area simply get no geometry and no meter.
    const printAreas = await getPrintAreasByIds(
      db,
      customizationZones.map((z) => z.printAreaId).filter((id): id is string => Boolean(id))
    );

    // Fetch customization fields (customer input fields)
    const customizationFields = await getCustomizationFields(db, siteId, params.id);

    // Fetch equipment with fields for this product
    const productEquipment = await getProductEquipmentWithFields(db, siteId, params.id);

    // Fetch variants (size/color, incl. Printful-backed ones)
    const dbVariants = await getProductVariants(db, siteId, params.id);
    const variants = dbVariants.map((v) => ({
      id: v.id,
      label: v.label,
      size: v.size || undefined,
      color: v.color || undefined,
      price: v.price,
      stockQuantity: v.stock_quantity
    }));

    const shippingOptions = shippingOptionsRaw.map((opt) => ({
      shippingOptionId: opt.shippingOptionId,
      optionName: opt.optionName || '',
      isDefault: opt.isDefault,
      priceOverride: opt.priceOverride,
      thresholdOverride: opt.thresholdOverride,
      estimatedDaysMin: opt.optionEstimatedDaysMin,
      estimatedDaysMax: opt.optionEstimatedDaysMax,
      carrier: opt.optionCarrier
    }));

    // Transform database product to match the Product type, at this shopper's
    // regional price (see $lib/server/regional-pricing)
    const product = withShopperPrice(shopperPricing(locals), {
      id: dbProduct.id,
      name: dbProduct.name,
      description: dbProduct.description,
      price: dbProduct.price,
      image: dbProduct.image,
      category: dbProduct.category,
      stock: dbProduct.stock,
      type: dbProduct.type,
      tags: JSON.parse(dbProduct.tags || '[]') as string[],
      fulfillmentOptions,
      shippingOptions,
      variants
    });

    // Transform media items
    const media = dbMedia.map((m) => ({
      id: m.id,
      productId: m.product_id,
      type: m.type,
      url: m.url,
      thumbnailUrl: m.thumbnail_url || undefined,
      filename: m.filename,
      size: m.size,
      mimeType: m.mime_type,
      width: m.width || undefined,
      height: m.height || undefined,
      duration: m.duration || undefined,
      displayOrder: m.display_order
    }));

    // Log product view
    try {
      await logProductAction(db, {
        siteId,
        userId: locals.currentUser?.id || null,
        action: 'viewed',
        productId: product.id,
        productName: product.name,
        ipAddress: getClientAddress(),
        userAgent: request.headers.get('user-agent')
      });
    } catch (logError) {
      // Don't fail the request if logging fails
      console.error('Failed to log product view:', logError);
    }

    return {
      product,
      media,
      customizationZones,
      printAreas,
      customizationFields,
      productEquipment
    };
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error loading product:', err);
    throw error(500, 'Failed to load product');
  }
};
