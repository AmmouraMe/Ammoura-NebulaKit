/**
 * Pages repository with multi-tenant support
 * All queries are scoped by site_id
 */

import { executeOne, execute, generateId, getCurrentTimestamp } from './connection.js';
import type { WidgetConfig } from '$lib/types/pages.js';

// Raw database row interface (before boolean conversion)
interface DBPageRaw {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  content?: string;
  colorTheme?: string;
  layout_id?: number;
  published_revision_id?: string;
  draft_revision_id?: string;
  is_builtin: number | boolean; // Database stores as 0/1
  created_at: number;
  updated_at: number;
}

export interface DBPage {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  content?: string;
  colorTheme?: string;
  layout_id?: number;
  published_revision_id?: string;
  draft_revision_id?: string;
  is_builtin: boolean; // If true, this is a system page that cannot be deleted
  created_at: number;
  updated_at: number;
}

/**
 * Convert raw database page to properly typed page
 */
function mapPageFromDB(page: DBPageRaw): DBPage {
  return {
    ...page,
    is_builtin: Boolean(page.is_builtin)
  };
}

export interface EnrichedPage extends DBPage {
  published_at?: number;
  draft_at?: number;
  has_unpublished_changes: boolean;
}

export interface DBPageWidget {
  id: string;
  page_id: string;
  type:
    | 'single_product'
    | 'product_list'
    | 'text'
    | 'image'
    | 'hero'
    | 'button'
    | 'spacer'
    | 'columns'
    | 'heading'
    | 'divider'
    | 'features'
    | 'pricing'
    | 'cta';
  config: string; // JSON string
  position: number;
  created_at: number;
  updated_at: number;
}

export interface CreatePageData {
  title: string;
  slug: string;
  status: 'draft' | 'published';
  content?: string;
  colorTheme?: string;
  layout_id?: number;
}

export interface UpdatePageData {
  title?: string;
  slug?: string;
  status?: 'draft' | 'published';
  content?: string;
  colorTheme?: string;
  layout_id?: number;
}

export interface CreatePageComponentData {
  type:
    | 'single_product'
    | 'product_list'
    | 'text'
    | 'image'
    | 'hero'
    | 'button'
    | 'spacer'
    | 'columns'
    | 'heading'
    | 'divider';
  config: WidgetConfig;
  position: number;
}

/**
 * @deprecated Use CreatePageComponentData instead
 */
export type CreateWidgetData = CreatePageComponentData;

export interface UpdatePageComponentData {
  type?:
    | 'single_product'
    | 'product_list'
    | 'text'
    | 'image'
    | 'hero'
    | 'button'
    | 'spacer'
    | 'columns'
    | 'heading'
    | 'divider';
  config?: WidgetConfig;
  position?: number;
}

/**
 * @deprecated Use UpdatePageComponentData instead
 */
export type UpdateWidgetData = UpdatePageComponentData;

/**
 * Get a page by ID (scoped by site)
 */
export async function getPageById(
  db: D1Database,
  siteId: string,
  pageId: string
): Promise<DBPage | null> {
  const result = await executeOne<DBPageRaw>(
    db,
    'SELECT * FROM pages WHERE id = ? AND site_id = ?',
    [pageId, siteId]
  );
  return result ? mapPageFromDB(result) : null;
}

/**
 * Get a page by slug (scoped by site)
 */
export async function getPageBySlug(
  db: D1Database,
  siteId: string,
  slug: string
): Promise<DBPage | null> {
  const result = await executeOne<DBPageRaw>(
    db,
    'SELECT * FROM pages WHERE slug = ? AND site_id = ?',
    [slug, siteId]
  );
  return result ? mapPageFromDB(result) : null;
}

/**
 * Get all pages for a site
 */
export async function getAllPages(db: D1Database, siteId: string): Promise<DBPage[]> {
  const result = await execute<DBPageRaw>(
    db,
    'SELECT * FROM pages WHERE site_id = ? ORDER BY updated_at DESC',
    [siteId]
  );
  return (result.results || []).map(mapPageFromDB);
}

/**
 * Get all pages for a site with enriched revision information
 */
export async function getAllPagesWithRevisionInfo(
  db: D1Database,
  siteId: string
): Promise<EnrichedPage[]> {
  const query = `
    SELECT 
      p.*,
      pr_pub.created_at as published_at,
      pr_draft.created_at as draft_at
    FROM pages p
    LEFT JOIN page_revisions pr_pub ON p.published_revision_id = pr_pub.id
    LEFT JOIN page_revisions pr_draft ON p.draft_revision_id = pr_draft.id
    WHERE p.site_id = ?
    ORDER BY p.updated_at DESC
  `;

  const result = await execute<DBPageRaw & { published_at?: number; draft_at?: number }>(
    db,
    query,
    [siteId]
  );

  // Enrich pages with has_unpublished_changes flag
  // A page has unpublished changes if:
  // 1. draft_revision_id differs from published_revision_id AND draft is newer or equal timestamp, OR
  // 2. draft_revision_id differs from published_revision_id AND we don't have timestamp data
  return (result.results || []).map((page) => {
    const hasDifferentRevisions =
      !!page.draft_revision_id &&
      !!page.published_revision_id &&
      page.draft_revision_id !== page.published_revision_id;

    const draftIsNewerOrEqual =
      !!page.draft_at && !!page.published_at && page.draft_at >= page.published_at;

    const missingTimestamps = !page.draft_at || !page.published_at;

    return {
      ...page,
      is_builtin: Boolean(page.is_builtin),
      has_unpublished_changes: hasDifferentRevisions && (draftIsNewerOrEqual || missingTimestamps)
    };
  });
}

/**
 * Get published pages for a site
 */
export async function getPublishedPages(db: D1Database, siteId: string): Promise<DBPage[]> {
  const result = await execute<DBPageRaw>(
    db,
    "SELECT * FROM pages WHERE site_id = ? AND status = 'published' ORDER BY updated_at DESC",
    [siteId]
  );
  return (result.results || []).map(mapPageFromDB);
}

/**
 * Create a new page (scoped by site)
 */
export async function createPage(
  db: D1Database,
  siteId: string,
  data: CreatePageData
): Promise<DBPage> {
  // Check if slug already exists
  const existing = await getPageBySlug(db, siteId, data.slug);
  if (existing) {
    throw new Error(`Page with slug "${data.slug}" already exists`);
  }

  const id = generateId();
  const timestamp = getCurrentTimestamp();

  await db
    .prepare(
      `INSERT INTO pages (id, site_id, title, slug, status, content, color_theme, layout_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      siteId,
      data.title,
      data.slug,
      data.status,
      data.content || null,
      data.colorTheme || null,
      data.layout_id || null,
      timestamp,
      timestamp
    )
    .run();

  const page = await getPageById(db, siteId, id);
  if (!page) {
    throw new Error('Failed to create page');
  }
  return page;
}

/**
 * Update a page (scoped by site)
 */
export async function updatePage(
  db: D1Database,
  siteId: string,
  pageId: string,
  data: UpdatePageData
): Promise<DBPage | null> {
  const page = await getPageById(db, siteId, pageId);
  if (!page) {
    return null;
  }

  // If slug is being updated, check for conflicts
  if (data.slug !== undefined && data.slug !== page.slug) {
    const existing = await getPageBySlug(db, siteId, data.slug);
    if (existing) {
      throw new Error(`Page with slug "${data.slug}" already exists`);
    }
  }

  const timestamp = getCurrentTimestamp();
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    params.push(data.title);
  }
  if (data.slug !== undefined) {
    updates.push('slug = ?');
    params.push(data.slug);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);
  }
  if (data.content !== undefined) {
    updates.push('content = ?');
    params.push(data.content);
  }
  if (data.colorTheme !== undefined) {
    updates.push('color_theme = ?');
    params.push(data.colorTheme);
  }
  if (data.layout_id !== undefined) {
    updates.push('layout_id = ?');
    params.push(data.layout_id);
  }

  if (updates.length === 0) {
    return page;
  }

  updates.push('updated_at = ?');
  params.push(timestamp);
  params.push(pageId);
  params.push(siteId);

  await db
    .prepare(`UPDATE pages SET ${updates.join(', ')} WHERE id = ? AND site_id = ?`)
    .bind(...params)
    .run();

  return await getPageById(db, siteId, pageId);
}

/**
 * Delete a page (scoped by site)
 */
export async function deletePage(db: D1Database, siteId: string, pageId: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM pages WHERE id = ? AND site_id = ?')
    .bind(pageId, siteId)
    .run();

  // GC content translations for the page and its widgets (best-effort)
  try {
    const { deleteTranslationsForEntity } = await import('../i18n/content-translations.js');
    await deleteTranslationsForEntity(db, siteId, 'page_widget', pageId);
    await deleteTranslationsForEntity(db, siteId, 'page', pageId);
  } catch (error) {
    console.error('Failed to GC page translations:', error);
  }

  return (result.meta?.changes || 0) > 0;
}

/**
 * Get all components for a page
 */
export async function getPageComponents(db: D1Database, pageId: string): Promise<DBPageWidget[]> {
  const result = await execute<DBPageWidget>(
    db,
    'SELECT * FROM page_widgets WHERE page_id = ? ORDER BY position ASC',
    [pageId]
  );
  return result.results || [];
}

/**
 * @deprecated Use getPageComponents instead
 */
export const getPageWidgets = getPageComponents;

/**
 * Get a widget by ID
 */
export async function getWidgetById(
  db: D1Database,
  widgetId: string
): Promise<DBPageWidget | null> {
  return await executeOne<DBPageWidget>(db, 'SELECT * FROM page_widgets WHERE id = ?', [widgetId]);
}

/**
 * Get a widget by ID, but only when its page belongs to `siteId`. Widget ids
 * carry no site of their own, so every API that takes one must come through
 * here or another tenant's widget is one guessed id away.
 */
export async function getWidgetByIdForSite(
  db: D1Database,
  siteId: string,
  widgetId: string
): Promise<DBPageWidget | null> {
  return await executeOne<DBPageWidget>(
    db,
    `SELECT pw.* FROM page_widgets pw
     JOIN pages p ON p.id = pw.page_id
     WHERE pw.id = ? AND p.site_id = ?`,
    [widgetId, siteId]
  );
}

/**
 * Create a new component for a page
 */
export async function createPageComponent(
  db: D1Database,
  pageId: string,
  data: CreatePageComponentData
): Promise<DBPageWidget> {
  const id = generateId();
  const timestamp = getCurrentTimestamp();
  const configJson = JSON.stringify(data.config);

  await db
    .prepare(
      `INSERT INTO page_widgets (id, page_id, type, config, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, pageId, data.type, configJson, data.position, timestamp, timestamp)
    .run();

  const component = await getWidgetById(db, id);
  if (!component) {
    throw new Error('Failed to create page component');
  }
  return component;
}

/**
 * @deprecated Use createPageComponent instead
 */
export const createWidget = createPageComponent;

/**
 * Update a page component
 */
export async function updatePageComponent(
  db: D1Database,
  componentId: string,
  data: UpdatePageComponentData
): Promise<DBPageWidget | null> {
  const component = await getWidgetById(db, componentId);
  if (!component) {
    return null;
  }

  const timestamp = getCurrentTimestamp();
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.type !== undefined) {
    updates.push('type = ?');
    params.push(data.type);
  }
  if (data.config !== undefined) {
    updates.push('config = ?');
    params.push(JSON.stringify(data.config));
  }
  if (data.position !== undefined) {
    updates.push('position = ?');
    params.push(data.position);
  }

  if (updates.length === 0) {
    return component;
  }

  updates.push('updated_at = ?');
  params.push(timestamp);
  params.push(componentId);

  await db
    .prepare(`UPDATE page_widgets SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  return await getWidgetById(db, componentId);
}

/**
 * @deprecated Use updatePageComponent instead
 */
export const updateWidget = updatePageComponent;

/**
 * Delete a page component
 */
export async function deletePageComponent(db: D1Database, componentId: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM page_widgets WHERE id = ?').bind(componentId).run();
  return (result.meta?.changes || 0) > 0;
}

/**
 * @deprecated Use deletePageComponent instead
 */
export const deleteWidget = deletePageComponent;

/**
 * Delete all widgets for a page
 */
export async function deletePageWidgets(db: D1Database, pageId: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM page_widgets WHERE page_id = ?').bind(pageId).run();
  return (result.meta?.changes || 0) > 0;
}

/**
 * Reorder components for a page
 */
export async function reorderPageComponents(
  db: D1Database,
  pageId: string,
  componentIds: string[]
): Promise<void> {
  const timestamp = getCurrentTimestamp();

  // Update position for each component
  for (let i = 0; i < componentIds.length; i++) {
    await db
      .prepare('UPDATE page_widgets SET position = ?, updated_at = ? WHERE id = ? AND page_id = ?')
      .bind(i, timestamp, componentIds[i], pageId)
      .run();
  }
}

/**
 * @deprecated Use reorderPageComponents instead
 */
export const reorderWidgets = reorderPageComponents;
