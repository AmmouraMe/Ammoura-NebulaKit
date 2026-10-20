import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDB } from '$lib/server/db/connection';
import { createActivityLog } from '$lib/server/db/activity-logs';
import {
  D1Registry,
  D1ReleaseStore,
  parseReleaseForm,
  registerSite,
  syncAll,
  syncSite
} from '$lib/server/orchestrator';
import { parseRegistration, pendingBySite, toSiteView } from '$lib/server/orchestrator/view';

/**
 * The control room: Ammoura's list of client NebulaKit sites. Platform
 * engineers only, since it holds a key to every client's site.
 */
function registry(platform: App.Platform | undefined) {
  const key = platform?.env?.ENCRYPTION_KEY;
  if (!key) return null;
  return new D1Registry(getDB(platform), key);
}

function requireEngineer(locals: App.Locals) {
  const user = locals.currentUser;
  if (!user) throw redirect(303, '/auth/login');
  if (user.role !== 'platform_engineer') throw redirect(303, '/admin/dashboard');
  return user;
}

export const load: PageServerLoad = async ({ locals, platform }) => {
  requireEngineer(locals);
  const sites = registry(platform);
  if (!sites) return { sites: [], releases: [], pending: {}, configured: false };
  const [list, releases] = await Promise.all([
    sites.list(),
    new D1ReleaseStore(getDB(platform)).list()
  ]);
  return {
    sites: list.map(toSiteView),
    releases,
    pending: pendingBySite(list, releases),
    configured: true
  };
};

export const actions: Actions = {
  register: async ({ request, locals, platform }) => {
    const user = requireEngineer(locals);
    const sites = registry(platform);
    if (!sites) return fail(500, { error: 'ENCRYPTION_KEY is not set, so keys cannot be stored.' });

    const parsed = parseRegistration(await request.formData());
    if (!parsed.ok) return fail(400, { error: parsed.error });

    try {
      const site = await registerSite(sites, parsed.value);
      await createActivityLog(getDB(platform), locals.siteId || 'default-site', {
        user_id: user.id,
        action: 'Registered a client site',
        entity_type: 'orchestrated_site',
        entity_id: site.id,
        entity_name: site.name
      });
      return { success: `${site.name} is registered and answered.` };
    } catch (err) {
      // registerSite calls the site first, so a bad key or address lands here.
      return fail(400, { error: (err as Error).message });
    }
  },

  sync: async ({ request, locals, platform }) => {
    requireEngineer(locals);
    const sites = registry(platform);
    if (!sites) return fail(500, { error: 'ENCRYPTION_KEY is not set.' });
    const id = String((await request.formData()).get('id') ?? '');
    try {
      const site = await syncSite(sites, id);
      return site.status === 'healthy'
        ? { success: `${site.name} answered.` }
        : fail(502, { error: `${site.name} did not answer: ${site.lastError}` });
    } catch (err) {
      return fail(404, { error: (err as Error).message });
    }
  },

  syncAll: async ({ locals, platform }) => {
    requireEngineer(locals);
    const sites = registry(platform);
    if (!sites) return fail(500, { error: 'ENCRYPTION_KEY is not set.' });
    const all = await syncAll(sites);
    const down = all.filter((site) => site.status !== 'healthy').length;
    return {
      success: `Checked ${all.length} sites. ${down === 0 ? 'All answered.' : `${down} did not answer.`}`
    };
  },

  remove: async ({ request, locals, platform }) => {
    const user = requireEngineer(locals);
    const sites = registry(platform);
    if (!sites) return fail(500, { error: 'ENCRYPTION_KEY is not set.' });
    const id = String((await request.formData()).get('id') ?? '');
    const site = await sites.get(id);
    if (!site || !(await sites.remove(site.id))) return fail(404, { error: 'No such site.' });
    await createActivityLog(getDB(platform), locals.siteId || 'default-site', {
      user_id: user.id,
      action: 'Removed a client site from the control room',
      entity_type: 'orchestrated_site',
      entity_id: site.id,
      entity_name: site.name
    });
    return { success: `${site.name} is no longer listed. The site itself is untouched.` };
  },

  recordRelease: async ({ request, locals, platform }) => {
    const user = requireEngineer(locals);
    const parsed = parseReleaseForm(await request.formData());
    if (!parsed.ok) return fail(400, { error: parsed.error });
    const db = getDB(platform);
    await new D1ReleaseStore(db).save(parsed.value);
    await createActivityLog(db, locals.siteId || 'default-site', {
      user_id: user.id,
      action: 'Recorded a release',
      entity_type: 'orchestrator_release',
      entity_id: parsed.value.id,
      entity_name: parsed.value.id
    });
    return { success: `${parsed.value.id} is recorded.` };
  },

  removeRelease: async ({ request, locals, platform }) => {
    requireEngineer(locals);
    const id = String((await request.formData()).get('id') ?? '');
    return (await new D1ReleaseStore(getDB(platform)).remove(id))
      ? { success: `${id} is no longer listed.` }
      : fail(404, { error: 'No such release.' });
  }
};
