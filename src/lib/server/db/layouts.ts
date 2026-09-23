/**
 * Database operations for layouts
 */

import type { Layout, LayoutWidget, WidgetConfig } from '$lib/types/pages';

/**
 * Get all layouts for a site
 */
export async function getLayouts(db: D1Database, siteId: string): Promise<Layout[]> {
  try {
    const result = await db
      .prepare('SELECT * FROM layouts WHERE site_id = ? ORDER BY is_default DESC, name ASC')
      .bind(siteId)
      .all<Layout>();

    return result.results || [];
  } catch (error) {
    console.error('Failed to get layouts:', error);
    throw error;
  }
}

/**
 * Get a single layout by ID
 */
export async function getLayout(
  db: D1Database,
  siteId: string,
  layoutId: number
): Promise<Layout | null> {
  try {
    const result = await db
      .prepare('SELECT * FROM layouts WHERE id = ? AND site_id = ?')
      .bind(layoutId, siteId)
      .first<Layout>();

    return result;
  } catch (error) {
    console.error('Failed to get layout:', error);
    throw error;
  }
}

/**
 * Get a layout by slug
 */
export async function getLayoutBySlug(
  db: D1Database,
  siteId: number,
  slug: string
): Promise<Layout | null> {
  try {
    const result = await db
      .prepare('SELECT * FROM layouts WHERE slug = ? AND site_id = ?')
      .bind(slug, siteId)
      .first<Layout>();

    return result;
  } catch (error) {
    console.error('Failed to get layout by slug:', error);
    throw error;
  }
}

/**
 * Get the default layout for a site
 */
export async function getDefaultLayout(db: D1Database, siteId: string): Promise<Layout | null> {
  try {
    const result = await db
      .prepare('SELECT * FROM layouts WHERE site_id = ? AND is_default = 1')
      .bind(siteId)
      .first<Layout>();

    return result;
  } catch (error) {
    console.error('Failed to get default layout:', error);
    throw error;
  }
}

/**
 * Create a new layout
 */
export async function createLayout(
  db: D1Database,
  siteId: string,
  data: {
    name: string;
    description?: string;
    slug: string;
    is_default?: boolean;
    page_properties?: string;
  }
): Promise<Layout> {
  try {
    // If setting as default, unset any existing default
    if (data.is_default) {
      await db.prepare('UPDATE layouts SET is_default = 0 WHERE site_id = ?').bind(siteId).run();
    }

    const result = await db
      .prepare(
        `INSERT INTO layouts (site_id, name, description, slug, is_default, page_properties)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING *`
      )
      .bind(
        siteId,
        data.name,
        data.description || null,
        data.slug,
        data.is_default ? 1 : 0,
        data.page_properties || null
      )
      .first<Layout>();

    if (!result) {
      throw new Error('Failed to create layout');
    }

    return result;
  } catch (error) {
    console.error('Failed to create layout:', error);
    throw error;
  }
}

/**
 * Update a layout
 */
export async function updateLayout(
  db: D1Database,
  siteId: string,
  layoutId: number,
  data: {
    name?: string;
    description?: string;
    slug?: string;
    is_default?: boolean;
    page_properties?: string;
  }
): Promise<Layout> {
  try {
    // If setting as default, unset any existing default
    if (data.is_default) {
      await db
        .prepare('UPDATE layouts SET is_default = 0 WHERE site_id = ? AND id != ?')
        .bind(siteId, layoutId)
        .run();
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.slug !== undefined) {
      updates.push('slug = ?');
      values.push(data.slug);
    }
    if (data.is_default !== undefined) {
      updates.push('is_default = ?');
      values.push(data.is_default ? 1 : 0);
    }
    if (data.page_properties !== undefined) {
      updates.push('page_properties = ?');
      values.push(data.page_properties);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    values.push(layoutId, siteId);

    const result = await db
      .prepare(
        `UPDATE layouts SET ${updates.join(', ')}
         WHERE id = ? AND site_id = ?
         RETURNING *`
      )
      .bind(...values)
      .first<Layout>();

    if (!result) {
      throw new Error('Layout not found or update failed');
    }

    return result;
  } catch (error) {
    console.error('Failed to update layout:', error);
    throw error;
  }
}

/**
 * Delete a layout
 */
export async function deleteLayout(
  db: D1Database,
  siteId: string,
  layoutId: number
): Promise<void> {
  try {
    // Don't allow deleting the default layout
    const layout = await getLayout(db, siteId, layoutId);
    if (layout?.is_default) {
      throw new Error('Cannot delete the default layout');
    }

    await db
      .prepare('DELETE FROM layouts WHERE id = ? AND site_id = ?')
      .bind(layoutId, siteId)
      .run();
  } catch (error) {
    console.error('Failed to delete layout:', error);
    throw error;
  }
}

/**
 * Get all components for a layout
 */
export async function getLayoutComponents(
  db: D1Database,
  layoutId: number
): Promise<LayoutWidget[]> {
  try {
    const result = await db
      .prepare('SELECT * FROM layout_widgets WHERE layout_id = ? ORDER BY position ASC')
      .bind(layoutId)
      .all();

    const components = (result.results || []).map((component) => ({
      ...component,
      config: typeof component.config === 'string' ? JSON.parse(component.config) : component.config
    })) as LayoutWidget[];

    return components;
  } catch (error) {
    console.error('Failed to get layout components:', error);
    throw error;
  }
}

/**
 * @deprecated Use getLayoutComponents instead
 */
export const getLayoutWidgets = getLayoutComponents;

/**
 * Create a layout widget
 */
export async function createLayoutWidget(
  db: D1Database,
  layoutId: number,
  data: {
    id: string;
    type: string;
    position: number;
    config: WidgetConfig;
  }
): Promise<LayoutWidget> {
  try {
    const result = await db
      .prepare(
        `INSERT INTO layout_widgets (id, layout_id, type, position, config)
         VALUES (?, ?, ?, ?, ?)
         RETURNING *`
      )
      .bind(data.id, layoutId, data.type, data.position, JSON.stringify(data.config))
      .first();

    if (!result) {
      throw new Error('Failed to create layout widget');
    }

    return {
      ...result,
      config: typeof result.config === 'string' ? JSON.parse(result.config) : result.config
    } as LayoutWidget;
  } catch (error) {
    console.error('Failed to create layout widget:', error);
    throw error;
  }
}

/**
 * Update a layout widget
 */
export async function updateLayoutWidget(
  db: D1Database,
  widgetId: string,
  data: {
    type?: string;
    position?: number;
    config?: WidgetConfig;
  }
): Promise<LayoutWidget> {
  try {
    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (data.type !== undefined) {
      updates.push('type = ?');
      values.push(data.type);
    }
    if (data.position !== undefined) {
      updates.push('position = ?');
      values.push(data.position);
    }
    if (data.config !== undefined) {
      updates.push('config = ?');
      values.push(JSON.stringify(data.config));
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(widgetId);

    const result = await db
      .prepare(
        `UPDATE layout_widgets SET ${updates.join(', ')}
         WHERE id = ?
         RETURNING *`
      )
      .bind(...values)
      .first();

    if (!result) {
      throw new Error('Layout widget not found or update failed');
    }

    return {
      ...result,
      config: typeof result.config === 'string' ? JSON.parse(result.config) : result.config
    } as LayoutWidget;
  } catch (error) {
    console.error('Failed to update layout widget:', error);
    throw error;
  }
}

/**
 * Delete a layout widget
 */
export async function deleteLayoutWidget(db: D1Database, widgetId: string): Promise<void> {
  try {
    await db.prepare('DELETE FROM layout_widgets WHERE id = ?').bind(widgetId).run();
  } catch (error) {
    console.error('Failed to delete layout widget:', error);
    throw error;
  }
}

/**
 * Update multiple layout components (for batch operations like reordering)
 */
export async function updateLayoutComponents(
  db: D1Database,
  layoutId: number,
  components: Array<{
    id: string;
    type?: string;
    position?: number;
    config?: WidgetConfig;
  }>
): Promise<void> {
  try {
    // Use a transaction for batch updates
    const batch = components.map((component) => {
      const updates: string[] = [];
      const values: (string | number)[] = [];

      if (component.type !== undefined) {
        updates.push('type = ?');
        values.push(component.type);
      }
      if (component.position !== undefined) {
        updates.push('position = ?');
        values.push(component.position);
      }
      if (component.config !== undefined) {
        updates.push('config = ?');
        values.push(JSON.stringify(component.config));
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(component.id, layoutId);

      // Scoped to the layout so a caller can only touch widgets it owns.
      return db
        .prepare(`UPDATE layout_widgets SET ${updates.join(', ')} WHERE id = ? AND layout_id = ?`)
        .bind(...values);
    });

    await db.batch(batch);
  } catch (error) {
    console.error('Failed to update layout components:', error);
    throw error;
  }
}

/**
 * @deprecated Use updateLayoutComponents instead
 */
export const updateLayoutWidgets = updateLayoutComponents;
