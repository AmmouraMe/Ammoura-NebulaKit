/**
 * Site provisioning for platform accounts (tenancy plan T2): create a site,
 * grant the creator ownership, and attach the free platform subdomain.
 */

import { createSite, type Site } from './db/sites.js';
import { executeOne } from './db/connection.js';
import { addSiteMember } from './db/site-members.js';
import { addSiteDomain } from './db/site-domains.js';
import { upsertSiteSetting } from './db/site-settings.js';
import { createPage } from './db/pages.js';
import { createRevision } from './db/revisions.js';
import { seedBuiltinPage, CURRENT_BUILTIN_VERSION } from './db/builtin-seeding.js';
import { BUILTIN_PAGES, CREATION_SEEDED_PAGE_SLUGS } from '$lib/utils/editor/pageDefaults';
import { validateSlug } from './slugs.js';
import { purgeRouteCache } from './site-routing.js';
import type { PageComponent } from '$lib/types/pages';

/**
 * The wildcard domain platform subdomains live under (slug.<domain>).
 * Falls back to `localhost` in development, where slug.localhost resolves to
 * 127.0.0.1 in modern browsers.
 */
export function getPlatformSitesDomain(env: Record<string, unknown> | undefined): string {
  return (env?.PLATFORM_SITES_DOMAIN as string) || 'localhost';
}

export async function isSlugTaken(db: D1Database, slug: string): Promise<boolean> {
  const row = await executeOne<{ id: string }>(db, 'SELECT id FROM sites WHERE slug = ?', [slug]);
  return row !== null;
}

/**
 * Starter home page for freshly created sites: a welcome heading plus the
 * store's products. Without a published home page the renderer falls back to
 * the platform marketing homepage, which is wrong on a tenant storefront.
 * `${site.name}` is substituted at render time from the site's settings.
 */
function starterHomeComponents(): PageComponent[] {
  return [
    {
      id: 'starter-welcome-heading',
      type: 'heading',
      position: 0,
      config: {
        heading: 'Welcome to ${site.name}',
        level: 1,
        alignment: 'center',
        textColor: 'theme:text',
        backgroundColor: 'transparent'
      }
    },
    {
      id: 'starter-welcome-text',
      type: 'text',
      position: 1,
      config: {
        text: 'We are just getting set up — take a look around.',
        alignment: 'center',
        backgroundColor: 'transparent'
      }
    },
    {
      id: 'starter-product-list',
      type: 'product_list',
      position: 2,
      config: {
        category: '',
        limit: 6,
        sortBy: 'created_at',
        sortOrder: 'desc',
        columns: { desktop: 3, tablet: 2, mobile: 1 },
        backgroundColor: 'transparent'
      }
    }
  ] as unknown as PageComponent[];
}

export interface CreateSiteForAccountResult {
  site?: Site;
  hostname?: string;
  error?: string;
}

export async function createSiteForAccount(
  db: D1Database,
  kv: KVNamespace | undefined,
  accountId: string,
  name: string,
  slug: string,
  platformSitesDomain: string
): Promise<CreateSiteForAccountResult> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { error: 'Site name is required' };
  }

  const slugCheck = validateSlug(slug);
  if (!slugCheck.valid) {
    return { error: slugCheck.error };
  }

  if (await isSlugTaken(db, slug)) {
    return { error: 'This site name is already taken' };
  }

  const hostname = `${slug}.${platformSitesDomain}`;

  // sites.domain is still NOT NULL/UNIQUE; mirror the platform hostname there
  // until the legacy column is dropped.
  const site = await createSite(db, { name: trimmedName, domain: hostname });

  await db.prepare('UPDATE sites SET slug = ? WHERE id = ?').bind(slug, site.id).run();

  // Seed the store name so ${site.name} in builtins shows the tenant's own
  // name instead of the getGeneralSettings platform fallback.
  await upsertSiteSetting(db, site.id, 'general_store_name', trimmedName);

  // Seed a published starter home page so the new site renders its own
  // storefront instead of the platform marketing fallback.
  try {
    const homePage = await createPage(db, site.id, {
      title: 'Home',
      slug: '/',
      status: 'published'
    });
    await createRevision(db, site.id, homePage.id, {
      title: 'Home',
      slug: '/',
      status: 'published',
      components: starterHomeComponents(),
      notes: 'Starter home page'
    });
  } catch (error) {
    // A site without a home page still renders (fallback); don't fail creation
    console.error('Could not seed starter home page:', error);
  }

  // Seed the built-in pages a site needs from its first minute: the legal pages
  // the default footer links to (issue #72), and the coming-soon holding page,
  // so the visibility toggle works without the owner first having to know that a
  // page needs seeding. seedBuiltinPage is reused rather than createPage so the
  // ids, is_builtin flag and published revision match what the production seeder
  // expects and it stays idempotent.
  for (const definition of BUILTIN_PAGES.filter((p) =>
    CREATION_SEEDED_PAGE_SLUGS.includes(p.slug)
  )) {
    try {
      await seedBuiltinPage(db, site.id, definition, CURRENT_BUILTIN_VERSION);
    } catch (error) {
      // A missing built-in page is a broken link or a toggle that needs a
      // second try, not a failed signup.
      console.error(`Could not seed built-in page ${definition.slug}:`, error);
    }
  }

  await addSiteMember(db, site.id, accountId, 'owner');

  await addSiteDomain(db, {
    site_id: site.id,
    hostname,
    kind: 'platform',
    is_primary: true,
    status: 'active'
  });

  await purgeRouteCache(kv, hostname);

  return { site: { ...site, slug } as Site, hostname };
}
