import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getDB } from '$lib/server/db/connection';
import { getComingSoonSettings, updateComingSoonSettings } from '$lib/server/db/site-settings';
import { createActivityLog } from '$lib/server/db/activity-logs';
import { seedBuiltinPage, CURRENT_BUILTIN_VERSION } from '$lib/server/db/builtin-seeding';
import { BUILTIN_PAGES } from '$lib/utils/editor/pageDefaults';
import { COMING_SOON_SLUG } from '$lib/server/coming-soon';

/** The built-in definition for the holding page, looked up once. */
const HOLDING_PAGE = BUILTIN_PAGES.find((page) => page.slug === COMING_SOON_SLUG);

export const load: PageServerLoad = async ({ platform, locals }) => {
  const db = getDB(platform);
  const siteId = locals.siteId || 'default-site';

  const settings = await getComingSoonSettings(db, siteId);

  // Whether the owner has a holding page to edit. Sites created before the
  // feature existed do not, and the toggle seeds one when it is switched on —
  // but the link to edit it should only appear once there is something there.
  let holdingPage: { id: string; title: string } | null = null;
  try {
    holdingPage = await db
      .prepare('SELECT id, title FROM pages WHERE site_id = ? AND slug = ?')
      .bind(siteId, COMING_SOON_SLUG)
      .first<{ id: string; title: string }>();
  } catch (error) {
    console.error('Failed to look up the holding page:', error);
  }

  return { settings, holdingPage, holdingPageSlug: COMING_SOON_SLUG };
};

export const actions: Actions = {
  default: async ({ request, platform, locals }) => {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';
    const userId = locals.currentUser?.id;

    if (!userId) {
      return fail(401, { error: 'Unauthorized' });
    }

    const formData = await request.formData();
    const enabled = formData.get('comingSoonEnabled') === 'on';

    try {
      // Seed the holding page BEFORE turning the gate on, never after. A site
      // whose gate is up and whose holding page is missing serves a bare 503 to
      // every visitor, and the owner would have no way to tell from here that
      // that is what they had just done.
      if (enabled && HOLDING_PAGE) {
        await seedBuiltinPage(db, siteId, HOLDING_PAGE, CURRENT_BUILTIN_VERSION);
      }

      await updateComingSoonSettings(db, siteId, { enabled });

      await createActivityLog(db, siteId, {
        user_id: userId,
        action: enabled ? 'Enabled the coming-soon page' : 'Took the site live',
        entity_type: 'settings',
        entity_id: 'visibility'
      });

      return { success: true, enabled };
    } catch (error) {
      console.error('Failed to update visibility settings:', error);
      return fail(500, { error: 'Could not save. The site was left as it was.' });
    }
  }
};
