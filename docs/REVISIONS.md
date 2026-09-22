# Revision System Documentation

## Overview

The Ammoura platform includes a modular, type-safe revision system for tracking changes to entities like products, pages, and future additions like categories and themes. The system is inspired by Git's approach, storing complete snapshots of entity state with parent-child relationships for branching and history visualization.

## Architecture

### Database Schema

The revision system uses a single generic `revisions` table that supports multiple entity types:

```sql
CREATE TABLE revisions (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('page', 'product', 'category', 'theme', 'site')),
  entity_id TEXT NOT NULL,
  revision_hash TEXT NOT NULL UNIQUE,
  parent_revision_id TEXT,
  data TEXT NOT NULL, -- JSON snapshot of entity state
  user_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  is_current INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_revision_id) REFERENCES revisions(id) ON DELETE SET NULL
);
```

**Indexes:**

- `idx_revisions_site_entity` - Fast lookups by site + entity type + entity ID
- `idx_revisions_hash` - Unique revision hash lookups
- `idx_revisions_parent` - Parent-child relationship queries
- `idx_revisions_current` - Quick access to current revisions
- `idx_revisions_created_at` - Chronological ordering

### Key Concepts

1. **Entity Types**: The system supports multiple entity types (product, page, category, theme, site)
2. **Revision Hash**: Each revision has a unique 8-character hash (like Git commits)
3. **Parent-Child Relationships**: Revisions form a tree structure for branching
4. **Current Revision**: One revision per entity can be marked as "current" (the live version)
5. **Full Snapshots**: Each revision stores the complete entity state (not diffs)
6. **Multi-Tenant**: All revisions are scoped by site_id

## Service Layer

### Generic Revision Service

Located at `src/lib/server/db/revisions-service.ts`, this provides reusable functions for any entity type:

#### Core Functions

**`createRevision<T>(db, siteId, input)`**

- Creates a new revision for an entity
- Automatically generates unique revision hash
- Supports parent-child linking
- Type-safe data storage

```typescript
const revision = await createRevision(db, siteId, {
  entity_type: 'product',
  entity_id: productId,
  data: { name: 'Product Name', price: 99.99 },
  user_id: userId,
  message: 'Updated price',
  parent_revision_id: previousRevisionId
});
```

**`getRevisions<T>(db, siteId, entityType, entityId, options?)`**

- Retrieves all revisions for an entity
- Supports pagination via `limit` and `offset`
- Can filter to current revision only
- Returns parsed data (not JSON strings)

```typescript
const revisions = await getRevisions(db, siteId, 'product', productId, {
  limit: 50
});
```

**`getRevisionById<T>(db, siteId, revisionId)`**

- Fetches a specific revision by ID
- Returns null if not found
- Parses JSON data automatically

**`getCurrentRevision<T>(db, siteId, entityType, entityId)`**

- Gets the currently published/live revision
- Returns the revision marked with `is_current = 1`

**`setCurrentRevision(db, siteId, entityType, entityId, revisionId)`**

- Marks a revision as current (unmarks all others)
- Used when publishing or restoring

**`restoreRevision<T>(db, siteId, revisionId, userId?)`**

- Restores an old revision by creating a new one at the head
- Like `git revert` - preserves history
- Automatically marks the new revision as current

**`buildRevisionTree<T>(db, siteId, entityType, entityId)`**

- Builds a tree structure for visualization
- Handles orphaned revisions gracefully
- Calculates depth and branch numbers
- Returns nodes with parent-child relationships

**`getHeadRevisions<T>(db, siteId, entityType, entityId)`**

- Returns revisions without children (branch tips)
- Useful for showing active branches

**`deleteOldRevisions(db, siteId, entityType, entityId, olderThanSeconds)`**

- Prunes old revisions for cleanup
- Never deletes current revisions
- Returns count of deleted revisions

### Product-Specific Service

Located at `src/lib/server/db/product-revisions.ts`, this wraps the generic service with product-specific logic:

```typescript
// Create a product revision
const revision = await createProductRevision(
  db,
  siteId,
  productId,
  userId,
  'Updated product details'
);

// Get all product revisions
const revisions = await getProductRevisions(db, siteId, productId);

// Restore a previous version
const restoredRevision = await restoreProductRevision(db, siteId, productId, revisionId, userId);
```

The product service automatically:

- Captures current product state when creating revisions
- Applies revision data back to the product table when restoring
- Handles JSON parsing for product-specific fields (tags)

## API Endpoints

### Product Revisions API

**GET `/api/products/[id]/revisions`**

- List all revisions for a product
- Query params: `limit` (optional)
- Returns: `{ revisions: ParsedRevision[] }`

**POST `/api/products/[id]/revisions`**

- Create a new revision for a product
- Body: `{ message?: string }`
- Returns: `{ revision: ParsedRevision }` (201 status)

**GET `/api/products/[id]/revisions/[revisionId]`**

- Get a specific product revision
- Returns: `{ revision: ParsedRevision }`

**POST `/api/products/[id]/revisions/[revisionId]/restore`**

- Restore a product to a previous revision
- Returns: `{ revision: ParsedRevision, product: string }`

### Example Usage

```javascript
// Fetch revision history
const response = await fetch('/api/products/prod-123/revisions?limit=10');
const { revisions } = await response.json();

// Create a revision
await fetch('/api/products/prod-123/revisions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Updated pricing' })
});

// Restore a previous version
await fetch('/api/products/prod-123/revisions/rev-456/restore', {
  method: 'POST'
});
```

## Type Definitions

Located in `src/lib/types/revisions.ts`:

```typescript
// Generic revision from database
interface Revision {
  id: string;
  site_id: string;
  entity_type: EntityType;
  entity_id: string;
  revision_hash: string;
  parent_revision_id?: string;
  data: string; // JSON
  user_id?: string;
  created_at: number;
  is_current: boolean;
  message?: string;
}

// Parsed revision with typed data
interface ParsedRevision<T> {
  // ... same as Revision but data: T
}

// For creating revisions
interface CreateRevisionInput<T> {
  entity_type: EntityType;
  entity_id: string;
  data: T;
  user_id?: string;
  message?: string;
  parent_revision_id?: string;
}
```

## Usage Patterns

### Creating a Revision on Entity Update

```typescript
import { updateProduct } from '$lib/server/db/products';
import { createProductRevision } from '$lib/server/db/product-revisions';

export const actions = {
  update: async ({ request, locals, platform }) => {
    const formData = await request.formData();
    const db = platform.env.DB;
    const siteId = locals.siteId;

    // Update the product
    await updateProduct(db, siteId, productId, {
      name: formData.get('name'),
      price: parseFloat(formData.get('price'))
    });

    // Create a revision
    await createProductRevision(db, siteId, productId, locals.user?.id, 'Updated product via form');
  }
};
```

### Viewing Revision History

```typescript
import { getProductRevisions } from '$lib/server/db/product-revisions';

export const load = async ({ params, locals, platform }) => {
  const db = platform.env.DB;
  const siteId = locals.siteId;

  const revisions = await getProductRevisions(db, siteId, params.id, 50);

  return { revisions };
};
```

### Comparing Revisions

```typescript
import { getRevisionById } from '$lib/server/db/revisions-service';

const rev1 = await getRevisionById(db, siteId, revision1Id);
const rev2 = await getRevisionById(db, siteId, revision2Id);

// Compare data
const priceChanged = rev1.data.price !== rev2.data.price;
const nameChanged = rev1.data.name !== rev2.data.name;
```

### Building a Revision Tree

```typescript
import { buildProductRevisionTree } from '$lib/server/db/product-revisions';

const tree = await buildProductRevisionTree(db, siteId, productId);

// Tree structure:
// [
//   {
//     ...revision,
//     children: [...childRevisions],
//     depth: 0,
//     branch: 0
//   },
//   ...
// ]
```

## Performance Considerations

### Database Efficiency

1. **Indexes**: All common queries are covered by indexes
2. **Snapshot Size**: Full snapshots are used (typically <10KB per revision)
3. **Query Optimization**:
   - Use `limit` parameter to control result set size
   - Fetch only what you need (avoid loading all revisions unnecessarily)

### Performance Targets

- ✅ **Create revision**: <50ms
- ✅ **List 50 revisions**: <100ms
- ✅ **Restore revision**: <200ms (includes DB write + update entity)
- ✅ **Build revision tree**: <150ms for 100 revisions

### Optimization Tips

1. **Pagination**: Always use `limit` when fetching revisions
2. **Lazy Loading**: Don't fetch revision history until needed
3. **Caching**: Consider caching current revision in memory
4. **Pruning**: Implement background job to delete revisions >90 days old

## Adding Revisions to New Entities

To add revision support to a new entity (e.g., categories):

### 1. Update Migration

Add the entity type to the CHECK constraint:

```sql
-- In migrations/0024_generic_revisions.sql
entity_type TEXT NOT NULL CHECK (entity_type IN ('page', 'product', 'category', 'theme', 'site'))
```

### 2. Create Entity-Specific Service

```typescript
// src/lib/server/db/category-revisions.ts
import { createRevision, getRevisions, restoreRevision } from './revisions-service';

export async function createCategoryRevision(
  db: D1Database,
  siteId: string,
  categoryId: string,
  userId?: string,
  message?: string
) {
  const category = await getCategoryById(db, siteId, categoryId);
  if (!category) throw new Error('Category not found');

  const revisionData = {
    name: category.name,
    description: category.description
    // ... other fields
  };

  return createRevision(db, siteId, {
    entity_type: 'category',
    entity_id: categoryId,
    data: revisionData,
    user_id: userId,
    message
  });
}

// ... other functions
```

### 3. Add API Endpoints

Follow the same pattern as product revisions in `src/routes/api/categories/[id]/revisions/`.

### 4. Add Tests

Create comprehensive tests for the new entity-specific service.

## Best Practices

### DO:

- ✅ Create a revision after every entity update
- ✅ Include meaningful commit messages
- ✅ Use pagination when fetching history
- ✅ Mark revisions as current when publishing
- ✅ Test revision restore functionality

### DON'T:

- ❌ Store sensitive data in revision messages
- ❌ Create revisions for trivial changes (e.g., view counts)
- ❌ Delete revisions manually (use the service functions)
- ❌ Modify revision data after creation
- ❌ Bypass the service layer to access the revisions table directly

## Troubleshooting

### Revision Not Created

**Problem**: Revision isn't being saved after entity update.

**Solution**: Ensure you're calling `createRevision` or entity-specific revision function after the update:

```typescript
await updateProduct(db, siteId, productId, data);
await createProductRevision(db, siteId, productId, userId);
```

### Duplicate Revision Hashes

**Problem**: Getting unique constraint violations on `revision_hash`.

**Solution**: The service automatically handles hash collisions. If you're getting this error, ensure you're using `createRevision` from the service layer, not inserting directly.

### Orphaned Revisions

**Problem**: Revisions showing up without proper parent linkage.

**Solution**: The `buildRevisionTree` function handles orphaned revisions gracefully by chaining them chronologically. This can happen during migrations or if parent_revision_id is null.

### Performance Issues

**Problem**: Revision queries are slow.

**Solutions**:

1. Add indexes if querying by new fields
2. Use pagination (`limit` parameter)
3. Consider archiving old revisions (>90 days)
4. Profile queries with `.all()` vs `.first()`

## Migration Notes

### Migrating Existing Page Revisions

The current page revision system in `src/lib/server/db/revisions.ts` continues to work. To migrate to the generic system:

1. Keep the existing `page_revisions` table for backward compatibility
2. New page revisions can optionally use the generic `revisions` table
3. Create a migration script to copy `page_revisions` to `revisions` table
4. Update page editor to use generic service

This is **optional** and not required for the product revision functionality.

## Future Enhancements

1. **Delta Diffs**: Store only changed fields (not full snapshots)
2. **Revision Approvals**: Workflow for reviewing changes before publishing
3. **File Versioning**: Track R2 asset versions alongside entity revisions
4. **Automated Pruning**: Background job to delete old revisions
5. **Rich Diff UI**: Visual comparison of revision differences
6. **Revision Comments**: Allow comments on specific revisions
7. **Revision Tags**: Tag important revisions (e.g., "pre-launch", "v1.0")

## See Also

- [Database Management](./DATABASE_MANAGEMENT.md) - Database setup and migrations
- [Multi-Tenant Architecture](./MULTI_TENANT.md) - Understanding site_id scoping
- [WYSIWYG Page Builder](./WYSIWYG_PAGE_BUILDER.md) - Page revision UI
