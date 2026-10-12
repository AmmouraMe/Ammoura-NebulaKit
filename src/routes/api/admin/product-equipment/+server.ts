import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getDB,
  getEquipmentById,
  getProductById,
  getProductEquipmentLinks,
  getProductFitInfo,
  addProductEquipment,
  removeProductEquipment,
  setProductEquipmentSize
} from '$lib/server/db';

/** A size id must be one the machine owns; null clears it. */
async function resolveSizeId(
  db: D1Database,
  siteId: string,
  equipmentId: string,
  raw: unknown
): Promise<string | null> {
  const equipment = await getEquipmentById(db, siteId, equipmentId);
  if (!equipment) {
    throw error(404, 'Equipment not found');
  }
  if (raw === null || raw === undefined || raw === '') return null;
  const sizeId = String(raw);
  if (!equipment.capabilities?.sizes?.some((s) => s.id === sizeId)) {
    throw error(400, 'That size is not one this equipment has');
  }
  return sizeId;
}

function rethrow(err: unknown, message: string): never {
  if (err && typeof err === 'object' && 'status' in err) {
    throw err;
  }
  console.error(`${message}:`, err);
  throw error(500, message);
}

// GET links for a product (with what the fit checks need) or for a machine
export const GET: RequestHandler = async ({ platform, locals, url }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';
    const productId = url.searchParams.get('productId');
    const equipmentId = url.searchParams.get('equipmentId');

    if (productId) {
      const [links, product] = await Promise.all([
        getProductEquipmentLinks(db, siteId, { productId }),
        getProductFitInfo(db, siteId, productId)
      ]);
      if (!product) {
        throw error(404, 'Product not found');
      }
      return json({ links, product });
    }
    if (equipmentId) {
      return json({ links: await getProductEquipmentLinks(db, siteId, { equipmentId }) });
    }
    throw error(400, 'Product ID or Equipment ID is required');
  } catch (err) {
    rethrow(err, 'Failed to fetch product equipment');
  }
};

// POST link a machine to a product, optionally at one of its sizes
export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';
    const data = (await request.json()) as {
      productId?: string;
      equipmentId?: string;
      sortOrder?: number;
      sizeId?: string | null;
    };

    if (!data.productId || !data.equipmentId) {
      throw error(400, 'Product ID and Equipment ID are required');
    }
    const productId = String(data.productId);
    const equipmentId = String(data.equipmentId);

    // Both sides must belong to this site — ids alone would let one tenant link
    // another's machine or product.
    if (!(await getProductById(db, siteId, productId))) {
      throw error(404, 'Product not found');
    }
    const sizeId = await resolveSizeId(db, siteId, equipmentId, data.sizeId);

    const association = await addProductEquipment(
      db,
      siteId,
      productId,
      equipmentId,
      typeof data.sortOrder === 'number' ? data.sortOrder : 0,
      sizeId
    );

    return json(association, { status: 201 });
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      throw error(409, 'That product is already linked to this equipment');
    }
    rethrow(err, 'Failed to add equipment to product');
  }
};

// PATCH change the size a linked product is made at
export const PATCH: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';
    const data = (await request.json()) as {
      productId?: string;
      equipmentId?: string;
      sizeId?: string | null;
    };

    if (!data.productId || !data.equipmentId) {
      throw error(400, 'Product ID and Equipment ID are required');
    }
    const equipmentId = String(data.equipmentId);
    const sizeId = await resolveSizeId(db, siteId, equipmentId, data.sizeId);
    const updated = await setProductEquipmentSize(
      db,
      siteId,
      String(data.productId),
      equipmentId,
      sizeId
    );
    if (!updated) {
      throw error(404, 'Product equipment association not found');
    }
    return json({ success: true, sizeId });
  } catch (err) {
    rethrow(err, 'Failed to update product equipment');
  }
};

// DELETE remove equipment from a product
export const DELETE: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';
    const data = (await request.json()) as { productId?: string; equipmentId?: string };

    if (!data.productId || !data.equipmentId) {
      throw error(400, 'Product ID and Equipment ID are required');
    }

    const deleted = await removeProductEquipment(
      db,
      siteId,
      String(data.productId),
      String(data.equipmentId)
    );

    if (!deleted) {
      throw error(404, 'Product equipment association not found');
    }

    return json({ success: true });
  } catch (err) {
    rethrow(err, 'Failed to remove equipment from product');
  }
};
