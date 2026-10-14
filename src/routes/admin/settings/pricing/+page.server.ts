import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getDB } from '$lib/server/db/connection';
import {
  getRegionalPricingSettings,
  updateRegionalPricingSettings
} from '$lib/server/db/site-settings';
import { createActivityLog } from '$lib/server/db/activity-logs';
import { parseRegionalPricing } from '$lib/utils/regionalPricing';

export const load: PageServerLoad = async ({ platform, locals }) => {
  const db = getDB(platform);
  const siteId = locals.siteId || 'default-site';
  return {
    settings: await getRegionalPricingSettings(db, siteId),
    // So the owner can see what their own shoppers see, where they are.
    yourCountry: locals.country ?? null
  };
};

/** A percentage field (0–100) as a fraction, or the fallback when blank. */
function percent(value: FormDataEntryValue | null, fallback: number): number {
  const n = Number(value);
  return value === null || value === '' || !Number.isFinite(n) ? fallback : n / 100;
}

export const actions: Actions = {
  default: async ({ request, platform, locals }) => {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';
    const userId = locals.currentUser?.id;
    if (!userId) {
      return fail(401, { error: 'Unauthorized' });
    }

    const formData = await request.formData();
    let overrides: unknown = {};
    try {
      overrides = JSON.parse(String(formData.get('overrides') ?? '{}'));
    } catch {
      return fail(400, { error: 'The country overrides could not be read.' });
    }

    // parseRegionalPricing clamps every number and drops bad overrides, so
    // nothing out of range is ever stored.
    const settings = parseRegionalPricing({
      enabled: formData.get('enabled') === 'on',
      scope: formData.get('scope'),
      strength: percent(formData.get('strength'), 0.5),
      maxDiscount: percent(formData.get('maxDiscount'), 0.5),
      showNotice: formData.get('showNotice') === 'on',
      overrides
    });

    try {
      await updateRegionalPricingSettings(db, siteId, settings);
      await createActivityLog(db, siteId, {
        user_id: userId,
        action: settings.enabled ? 'Updated regional pricing' : 'Turned regional pricing off',
        entity_type: 'settings',
        entity_id: 'regional-pricing'
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to update regional pricing:', error);
      return fail(500, { error: 'Could not save. Your prices were left as they were.' });
    }
  }
};
