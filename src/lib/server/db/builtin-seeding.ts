/**
 * Production seeding service for built-in components, layouts, and pages
 *
 * This module provides functions to:
 * A) Create items that don't exist (new built-ins)
 * B) Add a v2 that is a fork of the last default configuration
 * C) If the site's currently published revision was the last default config,
 *    update it to the new default version
 *
 * The key concept is tracking "default" revisions - revisions that represent
 * the platform's official configuration for built-in items. These are identified
 * by having a message that starts with "Default configuration v" (e.g., "Default configuration v1").
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  ParsedRevision,
  ComponentRevisionData,
  LayoutRevisionData
} from '$lib/types/revisions';
import {
  createRevision,
  getRevisions,
  getCurrentRevision,
  setCurrentRevision
} from './revisions-service';
import type { ComponentType } from '$lib/types/pages';
import { getDefaultConfig } from '$lib/utils/editor/componentDefaults';
import { BUILTIN_PAGES, type BuiltinPageDefinition } from '$lib/utils/editor/pageDefaults';
import { BUILTIN_LAYOUTS, type BuiltinLayoutDefinition } from '$lib/utils/editor/layoutDefaults';

/**
 * Default revision message prefix - used to identify platform-provided default revisions
 */
export const DEFAULT_REVISION_MESSAGE_PREFIX = 'Default configuration v';

/**
 * Result of a seeding operation
 */
export interface SeedResult {
  action: 'created' | 'upgraded' | 'skipped';
  entityType: 'component' | 'layout' | 'page';
  entityName: string;
  entityId: string;
  siteId: string;
  previousVersion?: number;
  newVersion?: number;
  message: string;
}

/**
 * Built-in component definition for seeding
 */
export interface BuiltinComponentDefinition {
  name: string;
  description?: string;
  type: ComponentType;
  isGlobal: boolean;
  isPrimitive: boolean;
}

/**
 * Get the latest default revision for an entity
 * Default revisions are identified by their message starting with "Default configuration v"
 */
export async function getLatestDefaultRevision<T>(
  db: D1Database,
  siteId: string,
  entityType: 'component' | 'layout' | 'page',
  entityId: string
): Promise<{ revision: ParsedRevision<T>; version: number } | null> {
  const allRevisions = await getRevisions<T>(db, siteId, entityType, entityId);

  // Find all default revisions and get the one with the highest version
  const defaultRevisions = allRevisions.filter(
    (r) => r.message && r.message.startsWith(DEFAULT_REVISION_MESSAGE_PREFIX)
  );

  if (defaultRevisions.length === 0) {
    return null;
  }

  // Parse version numbers and find the latest
  let latestRevision: ParsedRevision<T> | null = null;
  let latestVersion = 0;

  for (const rev of defaultRevisions) {
    const versionMatch = rev.message?.match(/Default configuration v(\d+)/);
    if (versionMatch) {
      const version = parseInt(versionMatch[1], 10);
      if (version > latestVersion) {
        latestVersion = version;
        latestRevision = rev;
      }
    }
  }

  if (!latestRevision) {
    return null;
  }

  return { revision: latestRevision, version: latestVersion };
}

/**
 * Check if the current published revision is a default revision
 */
export async function isCurrentRevisionDefault<T>(
  db: D1Database,
  siteId: string,
  entityType: 'component' | 'layout' | 'page',
  entityId: string
): Promise<{ isDefault: boolean; version: number | null }> {
  const currentRevision = await getCurrentRevision<T>(db, siteId, entityType, entityId);

  if (!currentRevision) {
    return { isDefault: false, version: null };
  }

  if (!currentRevision.message?.startsWith(DEFAULT_REVISION_MESSAGE_PREFIX)) {
    return { isDefault: false, version: null };
  }

  const versionMatch = currentRevision.message.match(/Default configuration v(\d+)/);
  const version = versionMatch ? parseInt(versionMatch[1], 10) : null;

  return { isDefault: true, version };
}

/**
 * Seed a built-in component for a specific site
 *
 * This function:
 * 1. Creates the component if it doesn't exist
 * 2. Creates a new default revision (vN+1) if the config has changed
 * 3. If the site's current revision is the previous default, upgrades to the new default
 */
export async function seedBuiltinComponent(
  db: D1Database,
  siteId: string,
  definition: BuiltinComponentDefinition,
  defaultVersion: number
): Promise<SeedResult> {
  const { name, description, type, isGlobal, isPrimitive } = definition;

  // Get the default config from componentDefaults.ts
  const defaultConfig = getDefaultConfig(type);

  // Check if component exists
  const existingComponent = await db
    .prepare(
      `
      SELECT id, config FROM components 
      WHERE site_id = ? AND name = ? AND is_global = ? AND is_primitive = ?
    `
    )
    .bind(siteId, name, isGlobal ? 1 : 0, isPrimitive ? 1 : 0)
    .first<{ id: number; config: string }>();

  if (!existingComponent) {
    // A) Create the component if it doesn't exist
    const insertResult = await db
      .prepare(
        `
        INSERT INTO components (site_id, name, description, type, config, is_global, is_primitive, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
      )
      .bind(
        siteId,
        name,
        description || null,
        type,
        JSON.stringify(defaultConfig),
        isGlobal ? 1 : 0,
        isPrimitive ? 1 : 0
      )
      .run();

    const componentId = insertResult.meta.last_row_id as number;

    // Create the initial default revision
    const revisionMessage = `${DEFAULT_REVISION_MESSAGE_PREFIX}${defaultVersion}`;
    const revisionData: ComponentRevisionData = {
      name,
      description,
      type,
      config: defaultConfig as unknown as Record<string, unknown>,
      children: (defaultConfig as { children?: unknown[] }).children as
        ComponentRevisionData['children'] | undefined
    };

    const revision = await createRevision<ComponentRevisionData>(db, siteId, {
      entity_type: 'component',
      entity_id: String(componentId),
      data: revisionData,
      message: revisionMessage
    });

    // Mark as current
    await setCurrentRevision(db, siteId, 'component', String(componentId), revision.id);

    return {
      action: 'created',
      entityType: 'component',
      entityName: name,
      entityId: String(componentId),
      siteId,
      newVersion: defaultVersion,
      message: `Created new built-in component "${name}" with default v${defaultVersion}`
    };
  }

  // Component exists - check if we need to add a new default revision
  const componentId = String(existingComponent.id);
  const latestDefault = await getLatestDefaultRevision<ComponentRevisionData>(
    db,
    siteId,
    'component',
    componentId
  );

  if (latestDefault && latestDefault.version >= defaultVersion) {
    // Already have this version or newer
    return {
      action: 'skipped',
      entityType: 'component',
      entityName: name,
      entityId: componentId,
      siteId,
      previousVersion: latestDefault.version,
      message: `Component "${name}" already has default v${latestDefault.version}, skipping v${defaultVersion}`
    };
  }

  // B) Create a new default revision as a fork of the latest default
  const currentStatus = await isCurrentRevisionDefault<ComponentRevisionData>(
    db,
    siteId,
    'component',
    componentId
  );

  const revisionMessage = `${DEFAULT_REVISION_MESSAGE_PREFIX}${defaultVersion}`;
  const revisionData: ComponentRevisionData = {
    name,
    description,
    type,
    config: defaultConfig as unknown as Record<string, unknown>,
    children: (defaultConfig as { children?: unknown[] }).children as
      ComponentRevisionData['children'] | undefined
  };

  const newRevision = await createRevision<ComponentRevisionData>(db, siteId, {
    entity_type: 'component',
    entity_id: componentId,
    data: revisionData,
    message: revisionMessage,
    parent_revision_id: latestDefault?.revision.id
  });

  // C) If current revision is the previous default, upgrade to the new default
  if (currentStatus.isDefault && currentStatus.version === latestDefault?.version) {
    // Also update the component's config in the database
    await db
      .prepare(
        `
        UPDATE components 
        SET config = ?, type = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `
      )
      .bind(JSON.stringify(defaultConfig), type, existingComponent.id)
      .run();

    await setCurrentRevision(db, siteId, 'component', componentId, newRevision.id);

    return {
      action: 'upgraded',
      entityType: 'component',
      entityName: name,
      entityId: componentId,
      siteId,
      previousVersion: latestDefault?.version,
      newVersion: defaultVersion,
      message: `Upgraded component "${name}" from default v${latestDefault?.version} to v${defaultVersion}`
    };
  }

  // New default revision created but not published (site has customized)
  return {
    action: 'skipped',
    entityType: 'component',
    entityName: name,
    entityId: componentId,
    siteId,
    previousVersion: latestDefault?.version,
    newVersion: defaultVersion,
    message: `Added default v${defaultVersion} for "${name}" but site has custom configuration (not upgraded)`
  };
}

/**
 * Seed all built-in components for all sites
 */
export async function seedAllBuiltinComponents(
  db: D1Database,
  definitions: BuiltinComponentDefinition[],
  defaultVersion: number
): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  // Get all sites
  const sitesResult = await db.prepare('SELECT id FROM sites').all<{ id: string }>();

  const sites = sitesResult.results || [];

  for (const site of sites) {
    for (const definition of definitions) {
      const result = await seedBuiltinComponent(db, site.id, definition, defaultVersion);
      results.push(result);
    }
  }

  return results;
}

/**
 * Migrate existing "Initial default configuration" revisions to versioned format
 *
 * This is a one-time migration to convert old revision messages to the new format.
 * Old: "Initial default configuration"
 * New: "Default configuration v1"
 */
export async function migrateInitialRevisionsToVersioned(
  db: D1Database,
  entityType: 'component' | 'layout' | 'page'
): Promise<number> {
  const result = await db
    .prepare(
      `
      UPDATE revisions 
      SET message = 'Default configuration v1'
      WHERE entity_type = ? 
        AND message = 'Initial default configuration'
    `
    )
    .bind(entityType)
    .run();

  return result.meta.changes || 0;
}

/**
 * Get a summary of all default revisions across all sites
 */
export async function getDefaultRevisionsSummary(
  db: D1Database,
  entityType: 'component' | 'layout' | 'page'
): Promise<
  Array<{
    siteId: string;
    entityId: string;
    entityName: string;
    currentVersion: number | null;
    latestDefaultVersion: number | null;
    isOnLatestDefault: boolean;
  }>
> {
  // Get all revisions with default messages
  const revisionsResult = await db
    .prepare(
      `
      SELECT 
        r.site_id,
        r.entity_id,
        r.message,
        r.is_current,
        CASE 
          WHEN r.entity_type = 'component' THEN c.name
          WHEN r.entity_type = 'layout' THEN l.name
          ELSE r.entity_id
        END as entity_name
      FROM revisions r
      LEFT JOIN components c ON r.entity_type = 'component' AND r.entity_id = CAST(c.id AS TEXT)
      LEFT JOIN layouts l ON r.entity_type = 'layout' AND r.entity_id = CAST(l.id AS TEXT)
      WHERE r.entity_type = ?
        AND r.message LIKE 'Default configuration v%'
      ORDER BY r.site_id, r.entity_id, r.created_at DESC
    `
    )
    .bind(entityType)
    .all<{
      site_id: string;
      entity_id: string;
      message: string;
      is_current: number;
      entity_name: string;
    }>();

  const revisions = revisionsResult.results || [];

  // Group by site + entity and analyze
  const grouped = new Map<
    string,
    {
      siteId: string;
      entityId: string;
      entityName: string;
      versions: Array<{ version: number; isCurrent: boolean }>;
    }
  >();

  for (const rev of revisions) {
    const key = `${rev.site_id}:${rev.entity_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        siteId: rev.site_id,
        entityId: rev.entity_id,
        entityName: rev.entity_name,
        versions: []
      });
    }

    const versionMatch = rev.message.match(/Default configuration v(\d+)/);
    if (versionMatch) {
      grouped.get(key)!.versions.push({
        version: parseInt(versionMatch[1], 10),
        isCurrent: rev.is_current === 1
      });
    }
  }

  // Generate summary
  const summary = [];
  for (const [, data] of grouped) {
    const sortedVersions = data.versions.sort((a, b) => b.version - a.version);
    const latestVersion = sortedVersions[0]?.version || null;
    const currentVersion = data.versions.find((v) => v.isCurrent)?.version || null;

    summary.push({
      siteId: data.siteId,
      entityId: data.entityId,
      entityName: data.entityName,
      currentVersion,
      latestDefaultVersion: latestVersion,
      isOnLatestDefault: currentVersion === latestVersion
    });
  }

  return summary;
}

/**
 * Current default version for built-in components
 *
 * IMPORTANT: Increment this when making breaking changes to componentDefaults.ts
 * that should be propagated to production sites.
 *
 * Version history:
 * - v1: Initial release (migrations 0033-0059)
 * - v2: Navbar links collapse behind a hamburger on mobile
 *       (containerMobileCollapse on nav-links-container)
 * - v3: Navbar and footer defaults are childless, rendering the NavBar and
 *       Footer builtins natively (hamburger, mobile menu, cart/auth/account,
 *       theme toggle) instead of the container-children header/footer
 *
 * Bumping this constant does NOT reach an existing database on its own — it
 * only takes effect when an admin calls POST /api/admin/seed-builtins. New
 * databases are built by the SQL migrations, so a version bump that matters
 * for a fresh site needs a migration too. v3 shipped without one and every
 * new site kept the pre-v3 navbar until migration 0104 backfilled it.
 */
export const CURRENT_BUILTIN_VERSION = 3;

/**
 * All built-in component definitions
 */
export const BUILTIN_COMPONENTS: BuiltinComponentDefinition[] = [
  // Built-in composite components
  {
    name: 'Navigation Bar',
    description: 'Site-wide navigation header with logo, links, and user menu',
    type: 'navbar',
    isGlobal: true,
    isPrimitive: false
  },
  {
    name: 'Footer',
    description: 'Site-wide footer with links and copyright',
    type: 'footer',
    isGlobal: true,
    isPrimitive: false
  },
  {
    name: 'Hero',
    description: 'Large hero section with title, subtitle, and call-to-action',
    type: 'hero',
    isGlobal: true,
    isPrimitive: false
  },
  {
    name: 'Container',
    description: 'Container with padding and background options',
    type: 'container',
    isGlobal: true,
    isPrimitive: false
  },
  {
    name: 'Features',
    description: 'Feature grid showcase section',
    type: 'features',
    isGlobal: true,
    isPrimitive: false
  },
  {
    name: 'Pricing',
    description: 'Pricing table section',
    type: 'pricing',
    isGlobal: true,
    isPrimitive: false
  }
];

/**
 * All primitive component definitions
 */
export const PRIMITIVE_COMPONENTS: BuiltinComponentDefinition[] = [
  {
    name: 'Text',
    description: 'Rich text content block',
    type: 'text',
    isGlobal: true,
    isPrimitive: true
  },
  {
    name: 'Heading',
    description: 'Heading text (H1-H6)',
    type: 'heading',
    isGlobal: true,
    isPrimitive: true
  },
  {
    name: 'Button',
    description: 'Clickable button with link',
    type: 'button',
    isGlobal: true,
    isPrimitive: true
  },
  {
    name: 'Image',
    description: 'Image with alt text and sizing',
    type: 'image',
    isGlobal: true,
    isPrimitive: true
  },
  {
    name: 'Spacer',
    description: 'Vertical spacing between elements',
    type: 'spacer',
    isGlobal: true,
    isPrimitive: true
  },
  {
    name: 'Divider',
    description: 'Horizontal line divider',
    type: 'divider',
    isGlobal: true,
    isPrimitive: true
  },
  {
    name: 'Icon',
    description: 'SVG icon from icon library',
    type: 'icon',
    isGlobal: true,
    isPrimitive: true
  },
  {
    name: 'Columns',
    description: 'Multi-column layout',
    type: 'columns',
    isGlobal: true,
    isPrimitive: true
  },
  {
    name: 'Dropdown',
    description: 'Dropdown menu for navigation',
    type: 'dropdown',
    isGlobal: true,
    isPrimitive: true
  },
  {
    name: 'Theme Toggle',
    description: 'Light/dark theme toggle button',
    type: 'theme_toggle',
    isGlobal: true,
    isPrimitive: true
  }
];

/**
 * Run the production seed for all built-in components
 */
export async function runProductionSeed(db: D1Database): Promise<{
  results: SeedResult[];
  migrated: number;
  summary: {
    created: number;
    upgraded: number;
    skipped: number;
  };
}> {
  // First, migrate any old "Initial default configuration" messages to v1
  const componentsMigrated = await migrateInitialRevisionsToVersioned(db, 'component');
  const layoutsMigrated = await migrateInitialRevisionsToVersioned(db, 'layout');
  const pagesMigrated = await migrateInitialRevisionsToVersioned(db, 'page');

  // Seed all built-in and primitive components
  const allDefinitions = [...BUILTIN_COMPONENTS, ...PRIMITIVE_COMPONENTS];
  const componentResults = await seedAllBuiltinComponents(
    db,
    allDefinitions,
    CURRENT_BUILTIN_VERSION
  );

  // Seed all built-in layouts
  const layoutResults = await seedAllBuiltinLayouts(db, CURRENT_BUILTIN_VERSION);

  // Seed all built-in pages
  const pageResults = await seedAllBuiltinPages(db, CURRENT_BUILTIN_VERSION);

  // Combine all results
  const results = [...componentResults, ...layoutResults, ...pageResults];

  // Calculate summary
  const summary = {
    created: results.filter((r) => r.action === 'created').length,
    upgraded: results.filter((r) => r.action === 'upgraded').length,
    skipped: results.filter((r) => r.action === 'skipped').length
  };

  return {
    results,
    migrated: componentsMigrated + layoutsMigrated + pagesMigrated,
    summary
  };
}

// ============================================================================
// Built-in Layout Seeding
// ============================================================================

/**
 * Seed a built-in layout for a specific site
 */
export async function seedBuiltinLayout(
  db: D1Database,
  siteId: string,
  definition: BuiltinLayoutDefinition,
  defaultVersion: number
): Promise<SeedResult> {
  const { slug, name, description, isDefault, getWidgets } = definition;

  // Check if layout exists
  const existingLayout = await db
    .prepare('SELECT id FROM layouts WHERE site_id = ? AND slug = ?')
    .bind(siteId, slug)
    .first<{ id: number }>();

  if (!existingLayout) {
    // A) Create the layout if it doesn't exist
    const insertResult = await db
      .prepare(
        `
        INSERT INTO layouts (site_id, name, description, slug, is_default, is_builtin)
        VALUES (?, ?, ?, ?, ?, 1)
      `
      )
      .bind(siteId, name, description, slug, isDefault ? 1 : 0)
      .run();

    const layoutId = insertResult.meta.last_row_id as number;

    // Get the widgets with component IDs resolved
    const widgets = await resolveLayoutWidgetComponentIds(
      db,
      siteId,
      scopeLayoutWidgetIds(siteId, getWidgets())
    );

    // Create the initial default revision
    const revisionMessage = `${DEFAULT_REVISION_MESSAGE_PREFIX}${defaultVersion}`;
    const revisionData: LayoutRevisionData = {
      name,
      description,
      slug,
      is_default: isDefault,
      widgets
    };

    const revision = await createRevision<LayoutRevisionData>(db, siteId, {
      entity_type: 'layout',
      entity_id: String(layoutId),
      data: revisionData,
      message: revisionMessage
    });

    // Mark as current
    await setCurrentRevision(db, siteId, 'layout', String(layoutId), revision.id);

    // Also insert the layout widgets into the layout_widgets table
    for (const widget of widgets) {
      await db
        .prepare(
          `
          INSERT INTO layout_widgets (id, layout_id, type, position, config)
          VALUES (?, ?, ?, ?, ?)
        `
        )
        .bind(widget.id, layoutId, widget.type, widget.position, JSON.stringify(widget.config))
        .run();
    }

    return {
      action: 'created',
      entityType: 'layout',
      entityName: name,
      entityId: String(layoutId),
      siteId,
      newVersion: defaultVersion,
      message: `Created new built-in layout "${name}" with default v${defaultVersion}`
    };
  }

  // Layout exists - check if we need to add a new default revision
  const layoutId = String(existingLayout.id);
  const latestDefault = await getLatestDefaultRevision<LayoutRevisionData>(
    db,
    siteId,
    'layout',
    layoutId
  );

  if (latestDefault && latestDefault.version >= defaultVersion) {
    return {
      action: 'skipped',
      entityType: 'layout',
      entityName: name,
      entityId: layoutId,
      siteId,
      previousVersion: latestDefault.version,
      message: `Layout "${name}" already has default v${latestDefault.version}, skipping v${defaultVersion}`
    };
  }

  // B) Create a new default revision
  const currentStatus = await isCurrentRevisionDefault<LayoutRevisionData>(
    db,
    siteId,
    'layout',
    layoutId
  );

  const widgets = await resolveLayoutWidgetComponentIds(
    db,
    siteId,
    scopeLayoutWidgetIds(siteId, getWidgets())
  );
  const revisionMessage = `${DEFAULT_REVISION_MESSAGE_PREFIX}${defaultVersion}`;
  const revisionData: LayoutRevisionData = {
    name,
    description,
    slug,
    is_default: isDefault,
    widgets
  };

  const newRevision = await createRevision<LayoutRevisionData>(db, siteId, {
    entity_type: 'layout',
    entity_id: layoutId,
    data: revisionData,
    message: revisionMessage,
    parent_revision_id: latestDefault?.revision.id
  });

  // C) If current revision is the previous default, upgrade to the new default
  if (currentStatus.isDefault && currentStatus.version === latestDefault?.version) {
    // Update layout_widgets table
    await db
      .prepare('DELETE FROM layout_widgets WHERE layout_id = ?')
      .bind(existingLayout.id)
      .run();

    for (const widget of widgets) {
      await db
        .prepare(
          `
          INSERT INTO layout_widgets (id, layout_id, type, position, config)
          VALUES (?, ?, ?, ?, ?)
        `
        )
        .bind(
          widget.id,
          existingLayout.id,
          widget.type,
          widget.position,
          JSON.stringify(widget.config)
        )
        .run();
    }

    await setCurrentRevision(db, siteId, 'layout', layoutId, newRevision.id);

    return {
      action: 'upgraded',
      entityType: 'layout',
      entityName: name,
      entityId: layoutId,
      siteId,
      previousVersion: latestDefault?.version,
      newVersion: defaultVersion,
      message: `Upgraded layout "${name}" from default v${latestDefault?.version} to v${defaultVersion}`
    };
  }

  return {
    action: 'skipped',
    entityType: 'layout',
    entityName: name,
    entityId: layoutId,
    siteId,
    previousVersion: latestDefault?.version,
    newVersion: defaultVersion,
    message: `Added default v${defaultVersion} for layout "${name}" but site has custom configuration (not upgraded)`
  };
}

/**
 * Scope layout widget ids to the site. layout_widgets.id is a global primary
 * key, but layoutDefaults generates deterministic ids (default-navbar-0), so
 * seeding a second site collides with the first — the layout analog of the
 * page-id collision handled in seedBuiltinPage.
 */
function scopeLayoutWidgetIds(
  siteId: string,
  widgets: LayoutRevisionData['widgets']
): LayoutRevisionData['widgets'] {
  return widgets.map((widget) => ({ ...widget, id: `${widget.id}--${siteId}` }));
}

/**
 * Resolve component IDs for layout widgets (navbar, footer)
 */
async function resolveLayoutWidgetComponentIds(
  db: D1Database,
  siteId: string,
  widgets: LayoutRevisionData['widgets']
): Promise<LayoutRevisionData['widgets']> {
  const resolvedWidgets = [...widgets];

  for (const widget of resolvedWidgets) {
    if (widget.type === 'navbar') {
      const navbarComponent = await db
        .prepare(
          "SELECT id FROM components WHERE site_id = ? AND type = 'navbar' AND is_global = 1"
        )
        .bind(siteId)
        .first<{ id: number }>();
      if (navbarComponent) {
        widget.config = { ...widget.config, componentId: navbarComponent.id };
      }
    } else if (widget.type === 'footer') {
      const footerComponent = await db
        .prepare(
          "SELECT id FROM components WHERE site_id = ? AND type = 'footer' AND is_global = 1"
        )
        .bind(siteId)
        .first<{ id: number }>();
      if (footerComponent) {
        widget.config = { ...widget.config, componentId: footerComponent.id };
      }
    }
  }

  return resolvedWidgets;
}

/**
 * Seed all built-in layouts for all sites
 */
export async function seedAllBuiltinLayouts(
  db: D1Database,
  defaultVersion: number
): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  const sitesResult = await db.prepare('SELECT id FROM sites').all<{ id: string }>();
  const sites = sitesResult.results || [];

  for (const site of sites) {
    for (const definition of BUILTIN_LAYOUTS) {
      const result = await seedBuiltinLayout(db, site.id, definition, defaultVersion);
      results.push(result);
    }
  }

  return results;
}

// ============================================================================
// Built-in Page Seeding
// ============================================================================

/**
 * Seed a built-in page for a specific site
 */
export async function seedBuiltinPage(
  db: D1Database,
  siteId: string,
  definition: BuiltinPageDefinition,
  defaultVersion: number
): Promise<SeedResult> {
  const { id: pageId, title, slug, description: _description, getWidgets } = definition;

  // pages.id is a global primary key, so the stable builtin id must be
  // site-scoped or seeding any second site collides with the first.
  // default-site keeps the bare id for backwards compatibility.
  const sitePageId = siteId === 'default-site' ? pageId : `${pageId}--${siteId}`;

  // Check if page exists (either id form, always scoped to this site)
  const existingPage = await db
    .prepare('SELECT id FROM pages WHERE site_id = ? AND id IN (?, ?)')
    .bind(siteId, pageId, sitePageId)
    .first<{ id: string }>();

  // Also check by slug in case it was created without the builtin ID.
  // Deliberately NOT filtered on is_builtin: createSiteForAccount seeds a
  // starter home page with a generated id and is_builtin = 0, and a filtered
  // lookup would miss it and then break on pages' UNIQUE(site_id, slug).
  // Adopting the existing page is safe — the branch below only adds an
  // unpublished default revision unless the site is already on a default.
  const pageBySlug = existingPage
    ? null
    : await db
        .prepare('SELECT id FROM pages WHERE site_id = ? AND slug = ?')
        .bind(siteId, slug)
        .first<{ id: string }>();

  if (!existingPage) {
    if (!pageBySlug) {
      // A) Create the page if it doesn't exist
      const now = Math.floor(Date.now() / 1000);
      await db
        .prepare(
          `
          INSERT INTO pages (id, site_id, title, slug, status, is_builtin, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'published', 1, ?, ?)
        `
        )
        .bind(sitePageId, siteId, title, slug, now, now)
        .run();

      const widgets = getWidgets();

      // Create the initial default revision using page_revisions table
      const revisionId = `${sitePageId}-rev-${defaultVersion}`;
      const revisionHash = generateRevisionHash(sitePageId, defaultVersion);

      await db
        .prepare(
          `
          INSERT INTO page_revisions (
            id, page_id, revision_hash, parent_revision_id,
            title, slug, status, widgets_snapshot,
            created_by, created_at, is_published, notes
          ) VALUES (?, ?, ?, NULL, ?, ?, 'published', ?, 'system', ?, 1, ?)
        `
        )
        .bind(
          revisionId,
          sitePageId,
          revisionHash,
          title,
          slug,
          JSON.stringify(widgets),
          now,
          `${DEFAULT_REVISION_MESSAGE_PREFIX}${defaultVersion}`
        )
        .run();

      return {
        action: 'created',
        entityType: 'page',
        entityName: title,
        entityId: sitePageId,
        siteId,
        newVersion: defaultVersion,
        message: `Created new built-in page "${title}" with default v${defaultVersion}`
      };
    }
  }

  // Page exists - check if we need to add a new default revision
  const actualPageId = existingPage?.id || pageBySlug?.id || sitePageId;

  // Get latest default revision from page_revisions table
  const latestDefault = await getLatestDefaultPageRevision(db, actualPageId);

  if (latestDefault && latestDefault.version >= defaultVersion) {
    return {
      action: 'skipped',
      entityType: 'page',
      entityName: title,
      entityId: actualPageId,
      siteId,
      previousVersion: latestDefault.version,
      message: `Page "${title}" already has default v${latestDefault.version}, skipping v${defaultVersion}`
    };
  }

  // B) Create a new default revision
  const currentIsDefault = await isCurrentPageRevisionDefault(db, actualPageId);

  const widgets = getWidgets();
  const now = Math.floor(Date.now() / 1000);
  const revisionId = `${actualPageId}-rev-${defaultVersion}-${now}`;
  const revisionHash = generateRevisionHash(actualPageId, defaultVersion);

  await db
    .prepare(
      `
      INSERT INTO page_revisions (
        id, page_id, revision_hash, parent_revision_id,
        title, slug, status, widgets_snapshot,
        created_by, created_at, is_published, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 'published', ?, 'system', ?, ?, ?)
    `
    )
    .bind(
      revisionId,
      actualPageId,
      revisionHash,
      latestDefault?.revisionId || null,
      title,
      slug,
      JSON.stringify(widgets),
      now,
      currentIsDefault.isDefault && currentIsDefault.version === latestDefault?.version ? 1 : 0,
      `${DEFAULT_REVISION_MESSAGE_PREFIX}${defaultVersion}`
    )
    .run();

  // C) If current revision is the previous default, upgrade to the new default
  if (currentIsDefault.isDefault && currentIsDefault.version === latestDefault?.version) {
    // Mark the old published revision as not published
    await db
      .prepare(
        `
        UPDATE page_revisions 
        SET is_published = 0 
        WHERE page_id = ? AND id != ? AND is_published = 1
      `
      )
      .bind(actualPageId, revisionId)
      .run();

    return {
      action: 'upgraded',
      entityType: 'page',
      entityName: title,
      entityId: actualPageId,
      siteId,
      previousVersion: latestDefault?.version,
      newVersion: defaultVersion,
      message: `Upgraded page "${title}" from default v${latestDefault?.version} to v${defaultVersion}`
    };
  }

  return {
    action: 'skipped',
    entityType: 'page',
    entityName: title,
    entityId: actualPageId,
    siteId,
    previousVersion: latestDefault?.version,
    newVersion: defaultVersion,
    message: `Added default v${defaultVersion} for page "${title}" but site has custom configuration (not upgraded)`
  };
}

/**
 * Get the latest default revision for a page from page_revisions table
 */
async function getLatestDefaultPageRevision(
  db: D1Database,
  pageId: string
): Promise<{ revisionId: string; version: number } | null> {
  const result = await db
    .prepare(
      `
      SELECT id, notes 
      FROM page_revisions 
      WHERE page_id = ? AND notes LIKE 'Default configuration v%'
      ORDER BY created_at DESC
    `
    )
    .bind(pageId)
    .all<{ id: string; notes: string }>();

  const revisions = result.results || [];

  let latestRevision: { id: string; notes: string } | null = null;
  let latestVersion = 0;

  for (const rev of revisions) {
    const versionMatch = rev.notes?.match(/Default configuration v(\d+)/);
    if (versionMatch) {
      const version = parseInt(versionMatch[1], 10);
      if (version > latestVersion) {
        latestVersion = version;
        latestRevision = rev;
      }
    }
  }

  if (!latestRevision) {
    return null;
  }

  return { revisionId: latestRevision.id, version: latestVersion };
}

/**
 * Check if the current published page revision is a default revision
 */
async function isCurrentPageRevisionDefault(
  db: D1Database,
  pageId: string
): Promise<{ isDefault: boolean; version: number | null }> {
  const result = await db
    .prepare(
      `
      SELECT notes 
      FROM page_revisions 
      WHERE page_id = ? AND is_published = 1
      LIMIT 1
    `
    )
    .bind(pageId)
    .first<{ notes: string }>();

  if (!result) {
    return { isDefault: false, version: null };
  }

  if (!result.notes?.startsWith(DEFAULT_REVISION_MESSAGE_PREFIX)) {
    return { isDefault: false, version: null };
  }

  const versionMatch = result.notes.match(/Default configuration v(\d+)/);
  const version = versionMatch ? parseInt(versionMatch[1], 10) : null;

  return { isDefault: true, version };
}

/**
 * Generate a short revision hash for pages
 */
function generateRevisionHash(pageId: string, version: number): string {
  // revision_hash is globally UNIQUE; the previous prefix+version+timestamp
  // scheme collided when seeding several pages/sites in the same instant.
  void pageId;
  void version;
  return crypto.randomUUID().replace(/-/g, '').substring(0, 8);
}

/**
 * Seed all built-in pages for all sites
 */
export async function seedAllBuiltinPages(
  db: D1Database,
  defaultVersion: number
): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  const sitesResult = await db.prepare('SELECT id FROM sites').all<{ id: string }>();
  const sites = sitesResult.results || [];

  for (const site of sites) {
    for (const definition of BUILTIN_PAGES) {
      const result = await seedBuiltinPage(db, site.id, definition, defaultVersion);
      results.push(result);
    }
  }

  return results;
}

// Re-export the built-in definitions
export { BUILTIN_PAGES, BUILTIN_LAYOUTS };
export type { BuiltinPageDefinition, BuiltinLayoutDefinition };
