import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getDB,
  getCustomizationFields,
  createCustomizationField,
  updateCustomizationField,
  deleteCustomizationField
} from '$lib/server/db';

// GET fields for a product
export const GET: RequestHandler = async ({ url, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  const productId = url.searchParams.get('productId');
  if (!productId) {
    throw error(400, 'productId query parameter is required');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';

    const fields = await getCustomizationFields(db, siteId, productId);
    return json(fields);
  } catch (err) {
    console.error('Error fetching customization fields:', err);
    throw error(500, 'Failed to fetch customization fields');
  }
};

// POST create new field
export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';

    const data = (await request.json()) as {
      productId: string;
      name: string;
      fieldType: string;
      options?: string[];
      placeholder?: string;
      required?: boolean;
      maxLength?: number;
      minValue?: number;
      maxValue?: number;
      defaultValue?: string;
      priceModifier?: number;
      sortOrder?: number;
    };

    if (!data.productId) {
      throw error(400, 'productId is required');
    }
    if (!data.name || data.name.trim().length === 0) {
      throw error(400, 'Field name is required');
    }
    const validTypes = ['text', 'textarea', 'select', 'color', 'number'];
    if (!data.fieldType || !validTypes.includes(data.fieldType)) {
      throw error(400, 'Valid field type is required (text, textarea, select, color, number)');
    }
    if (data.fieldType === 'select' && (!data.options || data.options.length === 0)) {
      throw error(400, 'Select fields require at least one option');
    }

    const field = await createCustomizationField(db, siteId, {
      productId: data.productId,
      name: data.name.trim(),
      fieldType: data.fieldType as 'text' | 'textarea' | 'select' | 'color' | 'number',
      options: data.options,
      placeholder: data.placeholder,
      required: data.required,
      maxLength: data.maxLength,
      minValue: data.minValue,
      maxValue: data.maxValue,
      defaultValue: data.defaultValue,
      priceModifier: data.priceModifier,
      sortOrder: data.sortOrder
    });

    return json(field, { status: 201 });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error creating customization field:', err);
    throw error(500, 'Failed to create customization field');
  }
};

// PUT update field
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
      fieldType?: string;
      options?: string[];
      placeholder?: string | null;
      required?: boolean;
      maxLength?: number | null;
      minValue?: number | null;
      maxValue?: number | null;
      defaultValue?: string | null;
      priceModifier?: number;
      sortOrder?: number;
    };

    if (!data.id) {
      throw error(400, 'Field ID is required');
    }

    const { id, ...updateData } = data;
    if (updateData.name !== undefined) {
      updateData.name = updateData.name.trim();
      if (updateData.name.length === 0) {
        throw error(400, 'Field name cannot be empty');
      }
    }
    if (updateData.fieldType !== undefined) {
      const validTypes = ['text', 'textarea', 'select', 'color', 'number'];
      if (!validTypes.includes(updateData.fieldType)) {
        throw error(400, 'Invalid field type');
      }
    }

    const field = await updateCustomizationField(db, siteId, id, {
      ...updateData,
      fieldType: updateData.fieldType as
        'text' | 'textarea' | 'select' | 'color' | 'number' | undefined
    });

    if (!field) {
      throw error(404, 'Customization field not found');
    }

    return json(field);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error updating customization field:', err);
    throw error(500, 'Failed to update customization field');
  }
};

// DELETE field
export const DELETE: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(503, 'Database not available');
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';

    const data = (await request.json()) as { id: string };

    if (!data.id) {
      throw error(400, 'Field ID is required');
    }

    const deleted = await deleteCustomizationField(db, siteId, data.id);

    if (!deleted) {
      throw error(404, 'Customization field not found');
    }

    return json({ success: true });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error deleting customization field:', err);
    throw error(500, 'Failed to delete customization field');
  }
};
