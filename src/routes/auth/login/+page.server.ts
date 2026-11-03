import type { PageServerLoad } from './$types';
import { getDB } from '$lib/server/db/connection';
import { getEnabledSSOProviders } from '$lib/server/db/sso-providers';
import { getEnvOAuthProviders } from '$lib/server/oauth/env-providers';
import { isDevLoginEnabled } from '$lib/server/dev-login';

export const load: PageServerLoad = async ({ platform, locals }) => {
  const db = getDB(platform);
  const siteId = locals.siteId;
  const devLoginEnabled = isDevLoginEnabled(platform?.env as Record<string, unknown> | undefined);

  try {
    // Fetch enabled SSO providers from database
    // Note: We don't pass encryption key here since we don't need client_secret for the login page
    const ssoProviders = await getEnabledSSOProviders(db, siteId);

    // Map to simpler structure for client
    const providers = ssoProviders.map((p) => ({
      id: p.provider,
      name: p.display_name || p.provider,
      icon: p.icon || '',
      enabled: true
    }));

    // Also detect providers configured via environment variables
    const envProviders = getEnvOAuthProviders(platform?.env as unknown as Record<string, unknown>);
    const dbProviderIds = new Set(providers.map((p) => p.id));

    // Add env-var providers not already in DB
    for (const ep of envProviders) {
      if (!dbProviderIds.has(ep.provider)) {
        providers.push({
          id: ep.provider,
          name: ep.displayName,
          icon: ep.icon,
          enabled: true
        });
      }
    }

    return {
      ssoProviders: providers,
      devLoginEnabled
    };
  } catch (error) {
    console.error('Failed to load SSO providers:', error);
    // Return empty array on error, login should still work with password
    return {
      ssoProviders: [],
      devLoginEnabled
    };
  }
};
