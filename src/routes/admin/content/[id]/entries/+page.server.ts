/**
 * Admin Content Entries listing page
 * Lists all entries for a specific content type
 */

import { error, fail } from '@sveltejs/kit';
import { getDB } from '$lib/server/db/connection';
import { getContentTypeById } from '$lib/server/db/contentTypes';
import {
  getContentEntries,
  deleteContentEntry,
  publishContentEntry,
  unpublishContentEntry
} from '$lib/server/db/contentEntries';
import { createActivityLog } from '$lib/server/db/activity-logs';
import type { PageServerLoad, Actions } from './$types';
import type { ContentEntryStatus } from '$lib/types/contentTypes';

export const load: PageServerLoad = async ({ params, platform, locals, url }) => {
  const db = getDB(platform);
  const siteId = locals.siteId;
  const contentTypeId = params.id;

  const contentType = await getContentTypeById(db, siteId, contentTypeId);
  if (!contentType) {
    throw error(404, 'Content type not found');
  }

  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = 25;
  const offset = (page - 1) * limit;
  const statusFilter = (url.searchParams.get('status') || undefined) as
    ContentEntryStatus | undefined;
  const search = url.searchParams.get('search') || undefined;

  const { entries, total } = await getContentEntries(db, siteId, contentTypeId, {
    status: statusFilter,
    limit,
    offset,
    search,
    sortBy: 'updated_at',
    sortOrder: 'desc'
  });

  const totalPages = Math.ceil(total / limit);

  return {
    contentType,
    entries,
    total,
    currentPage: page,
    totalPages,
    statusFilter: statusFilter || null,
    search: search || null
  };
};

export const actions: Actions = {
  delete: async ({ request, platform, locals, params }) => {
    const db = getDB(platform);
    const siteId = locals.siteId;
    const formData = await request.formData();
    const entryId = formData.get('entryId')?.toString();

    if (!entryId) {
      return fail(400, { error: 'Entry ID is required' });
    }

    try {
      await deleteContentEntry(db, siteId, entryId);

      await createActivityLog(db, siteId, {
        user_id: locals.currentUser?.id || 'unknown',
        action: 'Deleted content entry',
        description: `Deleted entry ${entryId} from content type ${params.id}`,
        entity_type: 'content_entry',
        entity_id: entryId
      });

      return { success: true };
    } catch (err) {
      console.error('Failed to delete entry:', err);
      return fail(500, { error: 'Failed to delete entry' });
    }
  },

  publish: async ({ request, platform, locals }) => {
    const db = getDB(platform);
    const siteId = locals.siteId;
    const formData = await request.formData();
    const entryId = formData.get('entryId')?.toString();

    if (!entryId) {
      return fail(400, { error: 'Entry ID is required' });
    }

    try {
      await publishContentEntry(db, siteId, entryId);

      await createActivityLog(db, siteId, {
        user_id: locals.currentUser?.id || 'unknown',
        action: 'Published content entry',
        description: `Published entry ${entryId}`,
        entity_type: 'content_entry',
        entity_id: entryId
      });

      return { success: true };
    } catch (err) {
      console.error('Failed to publish entry:', err);
      return fail(500, { error: 'Failed to publish entry' });
    }
  },

  unpublish: async ({ request, platform, locals }) => {
    const db = getDB(platform);
    const siteId = locals.siteId;
    const formData = await request.formData();
    const entryId = formData.get('entryId')?.toString();

    if (!entryId) {
      return fail(400, { error: 'Entry ID is required' });
    }

    try {
      await unpublishContentEntry(db, siteId, entryId);

      await createActivityLog(db, siteId, {
        user_id: locals.currentUser?.id || 'unknown',
        action: 'Unpublished content entry',
        description: `Unpublished entry ${entryId}`,
        entity_type: 'content_entry',
        entity_id: entryId
      });

      return { success: true };
    } catch (err) {
      console.error('Failed to unpublish entry:', err);
      return fail(500, { error: 'Failed to unpublish entry' });
    }
  }
};
