import type { RequestHandler } from './$types';
import { json, error as svelteKitError } from '@sveltejs/kit';
import { updateLayoutComponents, getLayoutComponents, getLayout } from '$lib/server/db/layouts';
import { getDB } from '$lib/server/db/connection';

export const GET: RequestHandler = async ({ params, platform, locals }) => {
  const db = getDB(platform);
  const layoutId = parseInt(params.layoutId);

  if (isNaN(layoutId)) {
    throw svelteKitError(400, 'Invalid layout ID');
  }

  // Layout ids are global; only this site's layouts are reachable here.
  if (!(await getLayout(db, locals.siteId, layoutId))) {
    throw svelteKitError(404, 'Layout not found');
  }

  try {
    const components = await getLayoutComponents(db, layoutId);
    return json({ components });
  } catch (err) {
    console.error('Failed to get layout components:', err);
    throw svelteKitError(500, 'Failed to get layout components');
  }
};

export const PUT: RequestHandler = async ({ params, request, platform, locals }) => {
  const db = getDB(platform);
  const layoutId = parseInt(params.layoutId);

  if (isNaN(layoutId)) {
    throw svelteKitError(400, 'Invalid layout ID');
  }

  // Layout ids are global; only this site's layouts are reachable here.
  if (!(await getLayout(db, locals.siteId, layoutId))) {
    throw svelteKitError(404, 'Layout not found');
  }

  try {
    const body = (await request.json()) as { components?: unknown };
    const { components } = body;

    if (!Array.isArray(components)) {
      throw svelteKitError(400, 'Invalid components data');
    }

    await updateLayoutComponents(db, layoutId, components);

    return json({ success: true });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('Failed to update layout components:', err);
    throw svelteKitError(500, 'Failed to update layout components');
  }
};
