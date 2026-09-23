import { json, error } from '@sveltejs/kit';
import { getDB } from '$lib/server/db/connection';
import * as pagesDb from '$lib/server/db/pages';
import type { RequestHandler } from './$types';

/**
 * PUT /api/page-components/[id]
 * Update a page component
 */
export const PUT: RequestHandler = async ({ params, request, platform, locals }) => {
  const db = getDB(platform);
  const componentId = params.id;

  try {
    if (!(await pagesDb.getWidgetByIdForSite(db, locals.siteId, componentId))) {
      throw error(404, 'Page component not found');
    }

    const data = (await request.json()) as {
      type?: string;
      config?: object;
      position?: number;
    };

    const updateData: pagesDb.UpdatePageComponentData = {
      type: data.type as 'single_product' | 'product_list' | 'text' | 'image' | undefined,
      config: data.config,
      position: data.position
    };

    const component = await pagesDb.updatePageComponent(db, componentId, updateData);
    if (!component) {
      throw error(404, 'Page component not found');
    }

    return json(component);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error updating page component:', err);
    throw error(500, 'Failed to update page component');
  }
};

/**
 * DELETE /api/page-components/[id]
 * Delete a page component
 */
export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
  const db = getDB(platform);
  const componentId = params.id;

  try {
    if (!(await pagesDb.getWidgetByIdForSite(db, locals.siteId, componentId))) {
      throw error(404, 'Page component not found');
    }

    const deleted = await pagesDb.deletePageComponent(db, componentId);
    if (!deleted) {
      throw error(404, 'Page component not found');
    }

    return json({ success: true });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error deleting page component:', err);
    throw error(500, 'Failed to delete page component');
  }
};
