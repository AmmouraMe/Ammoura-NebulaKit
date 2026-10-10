import type { PageServerLoad } from './$types';
import { isDevLoginEnabled } from '$lib/server/dev-login';

export const load: PageServerLoad = async ({ platform }) => {
  return {
    devLoginEnabled: isDevLoginEnabled(platform?.env as Record<string, unknown> | undefined)
  };
};
