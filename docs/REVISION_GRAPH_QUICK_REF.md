# Revision History Graph - Quick Reference

## Component Overview

The `RevisionHistoryGraph` component displays page revisions in a git-like tree
structure with branches, showing the parent-child relationships between
revisions.

## Features

### Visual Elements

- **Nodes**: Circular markers representing each revision
- **Lanes**: Vertical columns for different branches
- **Connections**: Lines connecting parent → child revisions
- **Info Cards**: Detailed information for each revision

### Layout

```
Lane 0    Lane 1    Lane 2    Info Cards
  ●────────────────────────────┤ [rev-1] Initial (✓)
  │                            │
  ●────────────────────────────┤ [rev-2] Update 1
  │        ╱                   │
  │       ●────────────────────┤ [rev-3] Branch A
  │       │                    │
  ●───────┼────────────────────┤ [rev-4] Update 2
          │                    │
          ●────────────────────┤ [rev-5] Branch A.1
```

## Usage

```svelte
<script lang="ts">
  import RevisionHistoryGraph from '$lib/components/admin/RevisionHistoryGraph.svelte';
  import type { RevisionNode } from '$lib/types/pages';

  let revisions: RevisionNode[] = [
    // Your revision data here
  ];
  let currentRevisionId: string | null = null;

  function handleSelect(revisionId: string): void {
    currentRevisionId = revisionId;
    // Load revision data, etc.
  }
</script>

<RevisionHistoryGraph {revisions} {currentRevisionId} onSelectRevision={handleSelect} />
```

## Props

| Prop                | Type                   | Required | Description                                        |
| ------------------- | ---------------------- | -------- | -------------------------------------------------- |
| `revisions`         | `RevisionNode[]`       | Yes      | Array of revision nodes with depth and branch info |
| `currentRevisionId` | `string \| null`       | Yes      | ID of currently selected revision                  |
| `onSelectRevision`  | `(id: string) => void` | Yes      | Callback when a revision is selected               |

## RevisionNode Structure

```typescript
interface RevisionNode {
  id: string;
  page_id: string;
  revision_hash: string;
  parent_revision_id?: string;
  title: string;
  slug: string;
  status: 'published' | 'draft';
  created_at: number;
  is_published: boolean;
  color_theme?: string;
  widgets: PageWidget[];
  children: RevisionNode[];
  depth: number; // 0 = root, 1 = first child, etc.
  branch: number; // 0 = main, 1 = branch A, 2 = branch B, etc.
  created_by?: string;
  notes?: string;
}
```

## Visual Legend

### Node States

- **○** Regular node (draft)
- **●** Selected node (filled with branch color)
- **◎** Published node (double ring)
- **◉** Selected published node (filled + double ring)

### Colors

- **Blue (#3b82f6)**: Branch 0 (main)
- **Green (#10b981)**: Branch 1
- **Orange (#f59e0b)**: Branch 2
- **Purple (#8b5cf6)**: Branch 3
- **Red (#ef4444)**: Branch 4
- _(cycles through colors for branches 5+)_

### Info Card Elements

```
┌─────────────────────────┐
│ abc123f  ✓  L0          │ ← Hash, Published badge, Lane badge
│ Revision Title          │ ← Page title
│ 2h · Jane Doe           │ ← Time and author
└─────────────────────────┘
```

## Interaction

### Mouse/Touch

- **Click node or card**: Select revision
- **Hover node**: Scale up + shadow
- **Hover connection**: Thicker line

### Keyboard

- **Tab**: Navigate between nodes
- **Enter/Space**: Select focused node

## Mobile Behavior

### Screen Sizes

- **Desktop (>768px)**: Full layout
- **Tablet (≤768px)**: Smaller text, larger touch targets
- **Mobile (≤480px)**: Compact layout, stacked meta info

### Touch Optimizations

- Momentum scrolling on iOS
- Minimum 44px touch targets (48px on small screens)
- Horizontal scroll with gradient indicator
- Thinner connection lines (2px vs 2.5px)

## Customization

### Adjust Spacing

```typescript
// In component constants:
const LEVEL_HEIGHT = 80; // Vertical space between levels
const LANE_WIDTH = 50; // Horizontal space between lanes
const CARD_WIDTH = 220; // Width of info cards
```

### Add Branch Colors

```typescript
function getBranchColor(branch: number): string {
  const colors = [
    'var(--color-primary, #3b82f6)'
    // Add more colors here
  ];
  return colors[branch % colors.length];
}
```

### Modify Animations

```css
@keyframes pulse {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.35;
  }
}
```

## Performance

- **Layout Calculation**: O(n) where n = number of revisions
- **Rendering**: Optimized with Svelte reactivity
- **Memory**: Efficient with reactive statements

## Troubleshooting

### Nodes Not Showing

- Ensure `depth` and `branch` properties are set on revisions
- Check that `revisions` array is not empty

### Connections Missing

- Verify `parent_revision_id` is correctly set
- Ensure parent node exists in the revisions array

### Layout Issues

- Check that depth increases by 1 for each level
- Ensure branch numbers are consistent

### Mobile Scrolling Issues

- Verify viewport meta tag is set
- Check for CSS conflicts with `overflow` properties

## Testing

Run tests:

```bash
npm test -- src/lib/components/admin/RevisionHistoryGraph.test.ts
```

Visual test page:

```
Open tests/manual/revision-graph-visual.html in a browser
```

## Accessibility

- ✅ ARIA labels on interactive elements
- ✅ Keyboard navigation support
- ✅ Color contrast meets WCAG AA
- ✅ Screen reader friendly
- ✅ Focus indicators

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ iOS Safari 14+
- ✅ Chrome Mobile

## Related Files

- **Component**: `src/lib/components/admin/RevisionHistoryGraph.svelte`
- **Layout Logic**: `src/lib/utils/revisionGraphLayout.ts`
- **Tests**: `src/lib/components/admin/RevisionHistoryGraph.test.ts`
- **Types**: `src/lib/types/pages.ts` (RevisionNode interface)
- **Documentation**: `docs/REVISION_GRAPH_IMPLEMENTATION.md`

## Examples

### Simple Linear Chain

```typescript
const revisions = [
  { id: '1', parent_revision_id: undefined, depth: 0, branch: 0 },
  { id: '2', parent_revision_id: '1', depth: 1, branch: 0 },
  { id: '3', parent_revision_id: '2', depth: 2, branch: 0 }
];
```

### With Branches

```typescript
const revisions = [
  { id: '1', parent_revision_id: undefined, depth: 0, branch: 0 }, // Root
  { id: '2', parent_revision_id: '1', depth: 1, branch: 0 }, // Main
  { id: '3', parent_revision_id: '1', depth: 1, branch: 1 }, // Branch A
  { id: '4', parent_revision_id: '2', depth: 2, branch: 0 } // Main continues
];
```

## Support

For issues or questions:

1. Check the implementation docs: `docs/REVISION_GRAPH_IMPLEMENTATION.md`
2. Review test cases: `RevisionHistoryGraph.test.ts`
3. Examine visual tests: `tests/manual/revision-graph-visual.html`
