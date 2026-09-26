/**
 * Site slug rules. The slug becomes the site's free platform subdomain
 * (slug.<PLATFORM_SITES_DOMAIN>), so it must be a valid DNS label and must
 * never collide with hostnames the platform reserves for itself.
 */

export const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'app',
  'admin',
  'dashboard',
  'account',
  'accounts',
  'auth',
  'login',
  'signup',
  'mail',
  'email',
  'smtp',
  'imap',
  'ftp',
  'cdn',
  'assets',
  'static',
  'media',
  'status',
  'connect',
  'ns1',
  'ns2',
  'dev',
  'staging',
  'preview',
  'test',
  'demo',
  'docs',
  'help',
  'support',
  'blog',
  'store',
  'shop',
  'checkout',
  'payments',
  'stripe',
  'webhooks',
  'ammoura',
  // The platform's codename until 2026-09-22. Still reserved: it names live
  // Cloudflare resources and old links, so no tenant should be able to take it.
  'hermes',
  'default-site'
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

export interface SlugValidation {
  valid: boolean;
  error?: string;
}

export function validateSlug(slug: string): SlugValidation {
  if (!slug) {
    return { valid: false, error: 'Slug is required' };
  }
  if (slug.length < 3) {
    return { valid: false, error: 'Slug must be at least 3 characters' };
  }
  if (slug.length > 63) {
    return { valid: false, error: 'Slug must be at most 63 characters' };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      valid: false,
      error: 'Use only lowercase letters, numbers, and hyphens (no leading/trailing hyphen)'
    };
  }
  if (slug.includes('--')) {
    return { valid: false, error: 'Slug cannot contain consecutive hyphens' };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { valid: false, error: 'This name is reserved' };
  }
  return { valid: true };
}

/**
 * Derive a slug suggestion from a free-form site name.
 */
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}
