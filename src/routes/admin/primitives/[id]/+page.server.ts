import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllColorThemes } from '$lib/server/db/color-themes';
import { getComponent } from '$lib/server/db/components';
import { getDB } from '$lib/server/db/connection';
import {
  buildComponentRevisionTree,
  ensureComponentHasRevision
} from '$lib/server/db/component-revisions';
import type {
  RevisionNode as GenericRevisionNode,
  ComponentRevisionData
} from '$lib/types/revisions';
import type { ComponentChildData } from '$lib/types/revisions';
import type { ComponentType, PageStatus, RevisionNode, PageComponent } from '$lib/types/pages';

export const load: PageServerLoad = async ({ params, locals, platform }) => {
  const siteId = locals.siteId;
  const db = getDB(platform);

  // Load color themes for the site
  const colorThemes = await getAllColorThemes(db, siteId);

  // Primitive ID is required
  const primitiveId = parseInt(params.id);
  if (isNaN(primitiveId)) {
    throw error(400, 'Invalid primitive ID');
  }

  // Load existing primitive component
  const primitive = await getComponent(db, siteId, primitiveId);

  if (!primitive) {
    throw error(404, 'Primitive not found');
  }

  // Ensure this is actually a primitive
  if (!primitive.is_primitive) {
    throw error(400, 'This is not a primitive component');
  }

  // Create a single widget from the primitive's config
  // Primitives are single-widget components by definition
  const widgets = [
    {
      id: `primitive-${primitive.id}`,
      page_id: String(primitive.id),
      type: primitive.type,
      position: 0,
      config: primitive.config || {},
      created_at: new Date(primitive.created_at).getTime(),
      updated_at: new Date(primitive.updated_at).getTime(),
      parent_id: undefined
    }
  ];

  // Ensure primitive has at least one revision
  await ensureComponentHasRevision(db, siteId, primitive.id, {
    name: primitive.name,
    description: primitive.description,
    type: primitive.type,
    config: primitive.config || {}
  });

  // Get revision tree for the primitive (uses same system as components)
  const revisionTree = await buildComponentRevisionTree(db, siteId, primitive.id);

  // Get the current revision (is_current = true)
  const flatRevisions: GenericRevisionNode<ComponentRevisionData>[] = [];
  const flattenTree = (nodes: GenericRevisionNode<ComponentRevisionData>[]): void => {
    for (const node of nodes) {
      flatRevisions.push(node);
      flattenTree(node.children);
    }
  };
  flattenTree(revisionTree);
  const currentRevision = flatRevisions.find((r) => r.is_current);

  // Convert ComponentChildData to PageComponent format
  const childrenToComponents = (children: ComponentChildData[] | undefined): PageComponent[] => {
    if (!children) return [];
    return children.map((child, index) => ({
      id: child.id || `child-${index}`,
      page_id: String(primitive.id),
      type: child.type as ComponentType,
      position: child.position ?? index,
      config: child.config || {},
      parent_id: child.parent_id,
      created_at: 0,
      updated_at: 0
    }));
  };

  // Recursively map revisions to RevisionNode format for compatibility with AdvancedBuilder
  // This preserves the tree structure (children, depth, branch) from buildComponentRevisionTree
  const mapRevision = (r: GenericRevisionNode<ComponentRevisionData>): RevisionNode => {
    // Get children from revision data
    const revisionChildren =
      r.data.children ||
      ((r.data.config as Record<string, unknown> | undefined)?.children as
        ComponentChildData[] | undefined);

    return {
      id: r.id,
      page_id: String(primitive.id),
      revision_hash: r.revision_hash,
      parent_revision_id: r.parent_revision_id,
      title: r.data.name,
      slug: r.data.type,
      status: (r.is_current ? 'published' : 'draft') as PageStatus,
      color_theme: undefined,
      components: childrenToComponents(revisionChildren),
      is_published: r.is_current,
      created_by: r.user_id,
      created_at: r.created_at,
      notes: r.message,
      // Preserve tree structure from buildComponentRevisionTree
      children: r.children.map(mapRevision),
      depth: r.depth,
      branch: r.branch
    };
  };

  const mappedRevisions: RevisionNode[] = revisionTree.map(mapRevision);

  return {
    primitive,
    widgets,
    revisions: mappedRevisions,
    currentRevisionId: currentRevision?.id || null,
    currentRevisionIsPublished: currentRevision?.is_current || false,
    colorThemes,
    userName: locals.currentUser?.name || locals.currentUser?.email
  };
};
