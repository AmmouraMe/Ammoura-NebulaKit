# Editor Quick Reference Guide

## For Developers Working on the Edit Page Interface

### Component Overview

| Component        | Purpose           | Lines | Location                    |
| ---------------- | ----------------- | ----- | --------------------------- |
| `PageEditor`     | Main orchestrator | 320   | `src/lib/components/admin/` |
| `EditorToolbar`  | Top toolbar       | 260   | `src/lib/components/admin/` |
| `EditorCanvas`   | Center canvas     | 180   | `src/lib/components/admin/` |
| `EditorSidebar`  | Sidebar container | 110   | `src/lib/components/admin/` |
| `WidgetControls` | Widget overlay    | 140   | `src/lib/components/admin/` |

### Utility Modules

| Module              | Purpose           | Lines | Location                |
| ------------------- | ----------------- | ----- | ----------------------- |
| `historyManager`    | Undo/redo         | 57    | `src/lib/utils/editor/` |
| `autoSaveManager`   | Auto-save         | 72    | `src/lib/utils/editor/` |
| `keyboardShortcuts` | Keyboard handling | 60    | `src/lib/utils/editor/` |
| `widgetDefaults`    | Widget configs    | 98    | `src/lib/utils/editor/` |

## Common Tasks

### Adding a New Widget Type

1. Add type to `src/lib/types/pages.ts`:

```typescript
export type WidgetType = 'text' | 'image' | 'my_new_widget';
```

2. Add default config in `src/lib/utils/editor/widgetDefaults.ts`:

```typescript
case 'my_new_widget':
  return { /* default config */ };
```

3. Add label:

```typescript
my_new_widget: 'My New Widget';
```

4. Create renderer in `src/lib/components/admin/widgets/`

### Modifying the Toolbar

Edit `src/lib/components/admin/EditorToolbar.svelte`

Add new controls in the appropriate section:

- `toolbar-left` - Page metadata inputs
- `toolbar-center` - Viewport/preview controls
- `toolbar-right` - Action buttons

### Adding a Keyboard Shortcut

Edit `src/lib/utils/editor/keyboardShortcuts.ts`:

```typescript
// In createHandler()
else if (e.ctrlKey && e.key === 'k' && this.handlers.myAction) {
  e.preventDefault();
  this.handlers.myAction();
}
```

Register in `PageEditor.svelte`:

```typescript
keyboardManager = new KeyboardShortcutManager({
  // ...existing handlers
  myAction: handleMyAction
});
```

### Customizing Auto-Save Behavior

Edit `src/lib/utils/editor/autoSaveManager.ts`:

Change interval:

```typescript
const AUTO_SAVE_INTERVAL = 30000; // Change this value
```

Modify save conditions in `PageEditor.svelte`:

```typescript
autoSaveManager = new AutoSaveManager(
  async () => {
    /* save logic */
  },
  () => {
    // Add your conditions here
    return shouldSave;
  }
);
```

### Extending History Manager

Edit `src/lib/utils/editor/historyManager.ts`:

Change max history:

```typescript
const MAX_HISTORY = 50; // Change this value
```

Add history metadata:

```typescript
// Modify saveState to include timestamps, user info, etc.
```

## Event Handling Pattern

All components use this consistent pattern:

```typescript
// Component definition
interface Events {
  myAction: (param: string) => void;
}

export let events: Events;

// In template
<button on:click={() => events.myAction('value')}>

// Parent usage
<MyComponent events={{ myAction: handleMyAction }} />
```

## Props Pattern

Components use explicit, typed props:

```typescript
// Required props
export let widgets: PageWidget[];
export let currentBreakpoint: Breakpoint;

// Optional props with defaults
export let collapsed = false;
export let pageId: string | null = null;

// Bindable props (two-way binding)
export let title: string;
export let slug: string;
```

## Testing

### Unit Test a Utility

```typescript
import { HistoryManager } from '$lib/utils/editor/historyManager';

test('can undo', () => {
  const history = new HistoryManager([]);
  // Test logic
});
```

### Component Test

```typescript
import { render } from '@testing-library/svelte';
import EditorToolbar from '$lib/components/admin/EditorToolbar.svelte';

test('renders toolbar', () => {
  const { getByText } = render(EditorToolbar, {
    props: {/* props */}
  });
});
```

## Debugging

### View Current State

Add to `PageEditor.svelte`:

```typescript
$: console.log('Current state:', {
  widgets: widgets.length,
  selected: selectedWidget?.id,
  canUndo: historyManager?.canUndo()
});
```

### Debug Auto-Save

In browser console:

```javascript
// Check last save time
localStorage.getItem('lastAutoSave');

// Disable auto-save temporarily
// Comment out: autoSaveManager.start()
```

### Debug Keyboard Shortcuts

Add logging in `keyboardShortcuts.ts`:

```typescript
return (e: KeyboardEvent) => {
  console.log('Key pressed:', e.key, e.ctrlKey);
  // Rest of handler
};
```

## Common Issues

### "Cannot read property of undefined"

- Check if manager is initialized in `onMount`
- Use optional chaining: `historyManager?.canUndo()`

### Auto-save not triggering

- Verify `title` and `slug` are set
- Check `shouldSave` callback returns true
- Ensure `autoSaveManager.start()` is called

### Undo/redo not working

- Verify `historyManager.saveState()` is called after changes
- Check state is being deep cloned
- Ensure history isn't being reset unexpectedly

### Keyboard shortcuts not working

- Verify `keyboardManager.attach()` is called
- Check for conflicts with browser shortcuts
- Ensure handler is registered in constructor

## Performance Tips

1. **Avoid unnecessary re-renders**
   - Use `$:` reactive statements carefully
   - Memoize expensive computations

2. **Optimize widget rendering**
   - Implement virtual scrolling for many widgets
   - Lazy load widget properties

3. **Debounce frequent operations**
   - Use `setTimeout` for auto-save triggers
   - Debounce search/filter operations

## Best Practices

✅ **DO:**

- Keep components under 300 lines
- Use TypeScript types for all props
- Follow the event pattern for callbacks
- Write JSDoc comments for public APIs
- Test utilities in isolation

❌ **DON'T:**

- Mix UI and business logic
- Mutate props directly
- Create circular dependencies
- Bypass the event system
- Skip type definitions

## File Locations Quick Reference

```
Components:       src/lib/components/admin/
Utilities:        src/lib/utils/editor/
Types:           src/lib/types/pages.ts
Documentation:   docs/EDITOR_*.md
Tests:           tests/editor/
```

## Getting Help

1. Check `docs/EDITOR_ARCHITECTURE.md` for detailed docs
2. Review `docs/COMPONENT_DIAGRAM.md` for visual reference
3. Look at existing components for examples
4. Original backup: `PageEditor.backup.svelte`

## Useful Commands

```bash
# Run dev server
npm run dev

# Run tests
npm test

# Type check
npm run check

# Lint
npm run lint

# Restore original (if needed)
Copy-Item src/lib/components/admin/PageEditor.backup.svelte src/lib/components/admin/PageEditor.svelte -Force
```

## Version Info

- Refactored: October 29, 2025
- Original size: 1029 lines
- New size: 320 lines (69% reduction)
- Components created: 4 new + 1 refactored
- Utilities created: 4 new modules
