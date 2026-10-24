import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getDB,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  syncProductImageFromMedia,
  getProductFulfillmentOptions,
  setProductFulfillmentOptions,
  getProductShippingOptions,
  setProductShippingOptions
} from '$lib/server/db';
import { createProductRevision } from '$lib/server/db/product-revisions';
import { shopperPricing, withShopperPrice } from '$lib/server/regional-pricing';

/**
 * GET all products. Base prices, unless `?pricing=shopper`: the storefront
 * widgets ask for that and get this shopper's regional prices. Admin screens
 * never ask, so a product editor never sees a lowered price it could save.
 */
export const GET: RequestHandler = async ({ platform, locals, url }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';

    const dbProducts = await getAllProducts(db, siteId);
    const pricing = url.searchParams.get('pricing') === 'shopper' ? shopperPricing(locals) : null;

    const products = await Promise.all(
      dbProducts.map(async (p) => {
        const fulfillmentOptions = await getProductFulfillmentOptions(db, siteId, p.id);
        const shippingOptionsRaw = await getProductShippingOptions(db, siteId, p.id);
        const shippingOptions = shippingOptionsRaw.map((opt) => ({
          shippingOptionId: opt.shippingOptionId,
          optionName: opt.optionName || '',
          isDefault: opt.isDefault,
          priceOverride: opt.priceOverride,
          thresholdOverride: opt.thresholdOverride
        }));
        const product = {
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          image: p.image,
          category: p.category,
          stock: p.stock,
          type: p.type,
          tags: JSON.parse(p.tags || '[]'),
          fulfillmentOptions,
          shippingOptions
        };
        return pricing ? withShopperPrice(pricing, product) : product;
      })
    );

    return json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    throw error(500, 'Failed to fetch products');
  }
};

// POST create new product
export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';

    const data = (await request.json()) as {
      name: string;
      description: string;
      price: number;
      image: string;
      category: string;
      stock: number;
      type: 'physical' | 'service' | 'digital';
      tags?: string[];
      fulfillmentOptions?: Array<{ providerId: string; cost: number; stockQuantity?: number }>;
      shippingOptions?: Array<{
        shippingOptionId: string;
        isDefault: boolean;
        priceOverride?: number;
        thresholdOverride?: number;
      }>;
    };

    const productData = {
      name: data.name,
      description: data.description,
      price: Number(data.price),
      image: data.image,
      category: data.category,
      stock: Number(data.stock),
      type: data.type,
      tags: data.tags || []
    };

    const dbProduct = await createProduct(db, siteId, productData);

    // Set fulfillment options if provided
    if (data.fulfillmentOptions && data.fulfillmentOptions.length > 0) {
      await setProductFulfillmentOptions(db, siteId, dbProduct.id, data.fulfillmentOptions);
    }

    // Set shipping options if provided
    if (data.shippingOptions && data.shippingOptions.length > 0) {
      await setProductShippingOptions(db, siteId, dbProduct.id, data.shippingOptions);
    }

    // Create initial revision for the product
    await createProductRevision(
      db,
      siteId,
      dbProduct.id,
      locals.user?.id,
      'Initial product creation'
    );

    const fulfillmentOptions = await getProductFulfillmentOptions(db, siteId, dbProduct.id);
    const shippingOptionsRaw = await getProductShippingOptions(db, siteId, dbProduct.id);
    const shippingOptions = shippingOptionsRaw.map((opt) => ({
      shippingOptionId: opt.shippingOptionId,
      optionName: opt.optionName || '',
      isDefault: opt.isDefault,
      priceOverride: opt.priceOverride,
      thresholdOverride: opt.thresholdOverride
    }));

    const product = {
      id: dbProduct.id,
      name: dbProduct.name,
      description: dbProduct.description,
      price: dbProduct.price,
      image: dbProduct.image,
      category: dbProduct.category,
      stock: dbProduct.stock,
      type: dbProduct.type,
      tags: JSON.parse(dbProduct.tags || '[]'),
      fulfillmentOptions,
      shippingOptions
    };

    return json(product, { status: 201 });
  } catch (err) {
    console.error('Error creating product:', err);
    throw error(500, 'Failed to create product');
  }
};

// PUT update product
export const PUT: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';

    const data = (await request.json()) as {
      id: string;
      name?: string;
      description?: string;
      price?: number;
      image?: string;
      category?: string;
      stock?: number;
      type?: 'physical' | 'service' | 'digital';
      tags?: string[];
      fulfillmentOptions?: Array<{ providerId: string; cost: number; stockQuantity?: number }>;
      shippingOptions?: Array<{
        shippingOptionId: string;
        isDefault: boolean;
        priceOverride?: number;
        thresholdOverride?: number;
      }>;
    };

    const updateData: {
      name?: string;
      description?: string;
      price?: number;
      image?: string;
      category?: string;
      stock?: number;
      type?: 'physical' | 'service' | 'digital';
      tags?: string[];
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = Number(data.price);
    if (data.image !== undefined) updateData.image = data.image;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.stock !== undefined) updateData.stock = Number(data.stock);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.tags !== undefined) updateData.tags = data.tags;

    const dbProduct = await updateProduct(db, siteId, data.id, updateData);

    if (!dbProduct) {
      throw error(404, 'Product not found');
    }

    // Update fulfillment options if provided
    if (data.fulfillmentOptions !== undefined) {
      await setProductFulfillmentOptions(db, siteId, data.id, data.fulfillmentOptions);
    }

    // Update shipping options if provided
    if (data.shippingOptions !== undefined) {
      await setProductShippingOptions(db, siteId, data.id, data.shippingOptions);
    }

    // Sync product image from media to ensure thumbnail is up to date
    await syncProductImageFromMedia(db, siteId, data.id);

    // Re-fetch the product to get the potentially updated image
    const updatedDbProduct = await getProductById(db, siteId, data.id);

    if (!updatedDbProduct) {
      throw error(404, 'Product not found after update');
    }

    const fulfillmentOptions = await getProductFulfillmentOptions(db, siteId, data.id);
    const shippingOptionsRaw = await getProductShippingOptions(db, siteId, data.id);
    const shippingOptions = shippingOptionsRaw.map((opt) => ({
      shippingOptionId: opt.shippingOptionId,
      optionName: opt.optionName || '',
      isDefault: opt.isDefault,
      priceOverride: opt.priceOverride,
      thresholdOverride: opt.thresholdOverride
    }));

    const product = {
      id: updatedDbProduct.id,
      name: updatedDbProduct.name,
      description: updatedDbProduct.description,
      price: updatedDbProduct.price,
      image: updatedDbProduct.image,
      category: updatedDbProduct.category,
      stock: updatedDbProduct.stock,
      type: updatedDbProduct.type,
      tags: JSON.parse(updatedDbProduct.tags || '[]'),
      fulfillmentOptions,
      shippingOptions
    };

    return json(product);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error updating product:', err);
    throw error(500, 'Failed to update product');
  }
};

// DELETE product
export const DELETE: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';

    const data = (await request.json()) as { id: string };

    const deleted = await deleteProduct(db, siteId, data.id);

    if (!deleted) {
      throw error(404, 'Product not found');
    }

    return json({ success: true });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error deleting product:', err);
    throw error(500, 'Failed to delete product');
  }
};
