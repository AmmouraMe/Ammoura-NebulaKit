/**
 * Generic revision types for tracking changes across multiple entity types
 */

export type EntityType =
  'page' | 'product' | 'category' | 'theme' | 'site' | 'component' | 'layout';

/**
 * Component revision data structure - stores the full component state
 */
export interface ComponentRevisionData {
  name: string;
  description?: string;
  type: string;
  config: Record<string, unknown>;
  children?: ComponentChildData[];
}

/**
 * Layout revision data structure - stores the full layout state
 */
export interface LayoutRevisionData {
  name: string;
  description?: string;
  slug: string;
  is_default: boolean;
  widgets: LayoutWidgetData[];
  pageProperties?: Record<string, unknown>;
}

/**
 * Widget data for layout revisions
 */
export interface LayoutWidgetData {
  id: string;
  type: string;
  position: number;
  config: Record<string, unknown>;
}

/**
 * Child widget data for component revisions
 * Can be either nested (with children property) or flat (with parent_id references)
 */
export interface ComponentChildData {
  id: string;
  type: string;
  position: number;
  config: Record<string, unknown>;
  children?: ComponentChildData[];
  parent_id?: string; // Used in flat format to reference parent
}

/**
 * Generic revision record from database
 */
export interface Revision {
  id: string;
  site_id: string;
  entity_type: EntityType;
  entity_id: string;
  revision_hash: string;
  parent_revision_id?: string;
  data: string; // JSON snapshot
  user_id?: string;
  created_at: number;
  is_current: boolean;
  message?: string;
}

/**
 * Parsed revision with typed data
 */
export interface ParsedRevision<T = unknown> extends Omit<Revision, 'data'> {
  data: T;
}

/**
 * Revision node for building history tree
 */
export interface RevisionNode<T = unknown> extends ParsedRevision<T> {
  children: RevisionNode<T>[];
  depth: number;
  branch: number;
}

/**
 * Data for creating a new revision
 */
export interface CreateRevisionInput<T = unknown> {
  entity_type: EntityType;
  entity_id: string;
  data: T;
  user_id?: string;
  message?: string;
  parent_revision_id?: string;
}

/**
 * Options for querying revisions
 */
export interface GetRevisionsOptions {
  limit?: number;
  offset?: number;
  include_current_only?: boolean;
}

/**
 * Revision metadata for list views
 */
export interface RevisionMetadata {
  id: string;
  revision_hash: string;
  created_at: number;
  user_id?: string;
  message?: string;
  is_current: boolean;
  parent_revision_id?: string;
}
