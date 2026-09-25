import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getLayout,
  updateLayout,
  updateLayoutComponents,
  getLayoutComponents,
  createLayoutWidget,
  deleteLayoutWidget
} from '$lib/server/db/layouts';
import type { PageComponent } from '$lib/types/pages';

/**
 * PUT /api/layouts/[layoutId]
 * Update an existing layout with components
 */
export const PUT: RequestHandler = async ({ request, locals, platform, params }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const siteId = locals.siteId;
  const layoutId = parseInt(params.layoutId, 10);

  if (isNaN(layoutId)) {
    throw error(400, 'Invalid layout ID');
  }

  // updateLayout is site-scoped, but the widget writes below key on the
  // layout id alone — check ownership once, up front.
  if (!(await getLayout(platform.env.DB, siteId, layoutId))) {
    throw error(404, 'Layout not found');
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      description?: string;
      components?: PageComponent[];
      pageProperties?: Record<string, unknown>;
    };

    // Update the layout metadata if provided
    if (body.name || body.slug || body.description || body.pageProperties) {
      await updateLayout(platform.env.DB, siteId, layoutId, {
        name: body.name,
        slug: body.slug,
        description: body.description,
        page_properties: body.pageProperties ? JSON.stringify(body.pageProperties) : undefined
      });
    }

    // Update components if provided
    if (body.components) {
      // Get existing components to determine which ones to create/update/delete
      const existingComponents = await getLayoutComponents(platform.env.DB, layoutId);
      const existingIds = new Set(existingComponents.map((c) => c.id));
      const newIds = new Set(body.components.map((c) => c.id));

      // Components to update (exist in both)
      const componentsToUpdate = body.components
        .filter((c) => existingIds.has(c.id))
        .map((component, _index, arr) => ({
          id: component.id,
          type: component.type,
          // Normalize positions to be sequential
          position:
            [...arr]
              .sort((a, b) => a.position - b.position)
              .findIndex((c) => c.id === component.id) ?? component.position,
          config: component.config
        }));

      // Components to create (new ones)
      const componentsToCreate = body.components.filter((c) => !existingIds.has(c.id));

      // Components to delete (in existing but not in new)
      const componentIdsToDelete = [...existingIds].filter((id) => !newIds.has(id));

      // Delete removed components
      for (const id of componentIdsToDelete) {
        await deleteLayoutWidget(platform.env.DB, id);
      }

      // Create new components with correct positions
      for (const component of componentsToCreate) {
        const sortedComponents = [...body.components].sort((a, b) => a.position - b.position);
        const normalizedPosition = sortedComponents.findIndex((c) => c.id === component.id);

        await createLayoutWidget(platform.env.DB, layoutId, {
          id: component.id,
          type: component.type,
          position: normalizedPosition >= 0 ? normalizedPosition : component.position,
          config: component.config
        });
      }

      // Update existing components
      if (componentsToUpdate.length > 0) {
        await updateLayoutComponents(platform.env.DB, layoutId, componentsToUpdate);
      }
    }

    return json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Failed to update layout:', err);
    const message = err instanceof Error ? err.message : 'Failed to update layout';
    throw error(500, message);
  }
};
