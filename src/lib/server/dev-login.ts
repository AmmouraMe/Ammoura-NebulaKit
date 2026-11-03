import { dev } from '$app/environment';

/**
 * Whether the one-click dev logins (/api/dev/login-as and the DEV panel on
 * the login screens) are available.
 *
 * Always on under `vite dev`. In a built Worker it is on only when the
 * environment sets `DEV_LOGIN = "true"` in its `[env.*.vars]` — dev-staging
 * does, production never does. Anything else, including "1", "yes" or an
 * unset var, keeps it off.
 */
export function isDevLoginEnabled(env: Record<string, unknown> | undefined): boolean {
  if (dev) {
    return true;
  }
  return env?.DEV_LOGIN === 'true';
}
