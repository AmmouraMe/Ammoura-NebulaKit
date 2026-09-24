import { json, error } from '@sveltejs/kit';
import { getDB } from '$lib/server/db/connection';
import { getComponentRevisionById } from '$lib/server/db/component-revisions';
import type { RequestHandler } from './$types';
import type { ComponentRevisionData, ParsedRevision } from '$lib/types/revisions';
import type { PageComponent, ComponentType } from '$lib/types/pages';

/**
 * Response format for component revision that matches ParsedPageRevision structure
 * This allows AdvancedBuilder to use the same code for all entity types
 */
interface ComponentRevisionResponse {
  id: string;
  page_id: string;
  revision_hash: string;
  parent_revision_id?: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  color_theme?: string;
  components: PageComponent[];
  is_published: boolean;
  created_by?: string;
  created_at: number;
  notes?: string;
  pageProperties?: Record<string, string>;
}

/**
 * Child data can be in two formats:
 * 1. Nested format (original): children have config.children for sub-children
 * 2. Flat format (from draft saves): children have parent_id property
 */
interface ChildWithParentId {
  id: string;
  type: string;
  position: number;
  config: Record<string, unknown>;
  parent_id?: string;
}

/**
 * Convert component revision data to PageComponent format for AdvancedBuilder
 * This handles both nested format (config.children) and flat format (parent_id).
 * The format is detected automatically based on whether children have parent_id properties.
 */
function revisionDataToComponents(
  componentId: number,
  data: ComponentRevisionData,
  createdAt: number
): PageComponent[] {
  const result: PageComponent[] = [];

  // Check both data.children (new format) and data.config.children (seeded format from migration 0054)
  const children =
    data.children ||
    ((data.config as Record<string, unknown> | undefined)?.children as
      ComponentRevisionData['children'] | undefined) ||
    [];

  if (!children || children.length === 0) {
    return result;
  }

  // Detect if children are in flat format (have parent_id property) or nested format (have config.children)
  // Check if any child has a parent_id property defined (even if undefined value)
  const isFlat = children.some(
    (child) => 'parent_id' in child || (child as ChildWithParentId).parent_id !== undefined
  );

  if (isFlat) {
    // Flat format: children already have parent_id, just convert to PageComponent format
    const flatChildren = children as ChildWithParentId[];
    for (const child of flatChildren) {
      // Clone config to avoid mutating original
      const childConfig = { ...child.config } as Record<string, unknown>;
      // Remove children from config if present (shouldn't be in flat format, but just in case)
      delete childConfig.children;

      result.push({
        id: child.id,
        page_id: String(componentId),
        type: child.type as ComponentType,
        position: child.position,
        config: childConfig,
        created_at: createdAt,
        updated_at: createdAt,
        parent_id: child.parent_id
      });
    }
  } else {
    // Nested format: recursively flatten children
    /**
     * Recursively flatten nested children structure into a flat array
     * with parent_id set correctly for each child.
     * This matches the logic in +page.server.ts flattenChildren function.
     */
    function flattenChildren(
      childrenToFlatten: typeof children,
      parentId: string | undefined
    ): void {
      // Sort children by position before processing
      const sortedChildren = [...childrenToFlatten].sort((a, b) => a.position - b.position);

      for (const child of sortedChildren) {
        // Clone config to avoid mutating original
        const childConfig = { ...child.config } as Record<string, unknown>;
        const nestedChildren = childConfig.children as typeof children | undefined;

        // Remove children from config - they'll be separate components with parent_id
        delete childConfig.children;

        // Add this component to the result
        result.push({
          id: child.id,
          page_id: String(componentId),
          type: child.type as ComponentType,
          position: child.position,
          config: childConfig,
          created_at: createdAt,
          updated_at: createdAt,
          parent_id: parentId
        });

        // Recursively flatten nested children
        if (nestedChildren && Array.isArray(nestedChildren) && nestedChildren.length > 0) {
          flattenChildren(nestedChildren, child.id);
        }
      }
    }

    // Flatten all children - direct children have parent_id: undefined
    flattenChildren(children, undefined);
  }

  return result;
}

/**
 * GET /api/components/[id]/revisions/[revisionId]
 * Get a specific component revision
 */
export const GET: RequestHandler = async ({ params, platform, locals }) => {
  const db = getDB(platform);
  const siteId = locals.siteId;
  const componentId = parseInt(params.id);
  const revisionId = params.revisionId;

  if (isNaN(componentId)) {
    throw error(400, 'Invalid component ID');
  }

  try {
    const revision = (await getComponentRevisionById(
      db,
      siteId,
      revisionId
    )) as ParsedRevision<ComponentRevisionData> | null;
    if (!revision) {
      throw error(404, 'Revision not found');
    }

    // Verify this revision belongs to the specified component
    if (revision.entity_id !== String(componentId)) {
      throw error(404, 'Revision not found for this component');
    }

    // Convert to response format compatible with AdvancedBuilder
    const response: ComponentRevisionResponse = {
      id: revision.id,
      page_id: String(componentId),
      revision_hash: revision.revision_hash,
      parent_revision_id: revision.parent_revision_id,
      title: revision.data.name,
      slug: revision.data.type, // Components don't have slugs, use type
      status: revision.is_current ? 'published' : 'draft',
      components: revisionDataToComponents(componentId, revision.data, revision.created_at),
      is_published: revision.is_current,
      created_by: revision.user_id,
      created_at: revision.created_at,
      notes: revision.message,
      // Extract pageProperties from component config (backgroundColor, etc.)
      // Use 'transparent' as default for backgroundColor to match getDefaultConfig behavior
      pageProperties: {
        backgroundColor: (revision.data.config?.backgroundColor as string) || 'transparent',
        backgroundImage: (revision.data.config?.backgroundImage as string) || '',
        minHeight: (revision.data.config?.minHeight as string) || '',
        borderColor: (revision.data.config?.borderColor as string) || '',
        borderWidth: (revision.data.config?.borderWidth as string) || '',
        borderStyle: (revision.data.config?.borderStyle as string) || '',
        borderRadius: (revision.data.config?.borderRadius as string) || '',
        padding: (revision.data.config?.padding as string) || '',
        boxShadow: (revision.data.config?.boxShadow as string) || ''
      }
    };

    return json(response);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error fetching component revision:', err);
    throw error(500, 'Failed to fetch revision');
  }
};
