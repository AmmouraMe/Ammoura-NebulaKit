# AI-Aware Builder System

## Overview

The advanced WYSIWYG builder now has full AI awareness and capabilities to
manipulate pages, layouts, and components through natural language commands.
When viewing a page/layout/component in the builder, the AI assistant
understands the current context and can perform live widget operations.

## Architecture

### 1. Builder Context Store

**Location**: `src/lib/stores/builderContext.ts`

A Svelte store that tracks the current builder state and makes it available to
the AI assistant:

```typescript
interface BuilderContextState {
  mode: 'page' | 'layout' | 'component' | null;
  entityId: string | null;
  entityName: string;
  slug: string;
  widgets: PageWidget[];
  isActive: boolean;
  layoutId: number | null;
}
```

**Key Methods**:

- `activate()` - Called when builder mounts
- `updateState()` - Syncs changes to widgets/title/slug
- `deactivate()` - Called when builder unmounts

### 2. AI Context Detection

**Location**: `src/lib/server/ai/context-detector.ts`

Extended context types to include builder-specific contexts:

```typescript
type AIContextType =
  | 'page_building' // Creating new page
  | 'page_editing' // Editing existing page
  | 'layout_building' // Creating new layout
  | 'layout_editing' // Editing existing layout
  | 'component_building' // Creating new component
  | 'component_editing'; // Editing existing component
// ... other contexts
```

**URL Detection**:

- `/admin/builder` → `page_building` or `page_editing`
- `/admin/builder/layout/[id]` → `layout_editing`
- `/admin/builder/component/[id]` → `component_editing`

### 3. AI System Prompts

**Location**: `src/lib/server/ai/prompts.ts`

Builder-specific prompts that teach the AI:

- Available widget types (hero, text, image, navbar, etc.)
- Actions it can perform (add, remove, update, reorder)
- JSON response format for widget changes
- Best practices for layout and component design

### 4. Widget Manipulation

**Server-Side Parser**: `src/lib/server/ai/widget-parser.ts`

- Parses AI responses for widget change commands
- Validates widget change structure
- Creates default widgets with appropriate configs

**Client-Side Utilities**: `src/lib/utils/widgetChanges.ts`

- Applies widget changes to current widget array
- Handles add/remove/update/reorder operations
- Maintains proper position indexing

### 5. AI Response Handling

**Backend**: `src/routes/api/ai-chat/+server.ts`

- Detects `widget_changes` in AI responses
- Streams changes back to client with `widgetChanges` field

**Frontend**: `src/lib/components/ai/AIAssistant.svelte`

- Parses streaming responses for widget changes
- Dispatches `applyChanges` events with change data

**Builder Integration**: `src/lib/components/builder/BuilderAIPanel.svelte`

- Receives widget changes from AI Assistant
- Applies changes using widget utilities
- Updates builder state in real-time

## Usage

### User Experience

1. **Open AI Panel**: User clicks AI icon in builder toolbar
2. **AI Awareness**: AI instantly knows:
   - What mode they're in (page/layout/component)
   - Current entity name and slug
   - All existing widgets and their configurations
   - Available widget types
3. **Natural Language Commands**:

   ```
   User: "Add a hero section at the top"
   AI: "I'll add a hero section to your page..."
   [Hero widget appears at position 0]
   AI: "Done! The hero section has been added."
   ```

4. **Live Updates**: Changes appear instantly in the builder canvas

### Example Interactions

#### Adding a Widget

```
User: "Add a hero section"
AI Response (conversational): "I'll add a hero widget at the top of your page with a welcome message..."
AI Response (JSON):
{
  "type": "widget_changes",
  "changes": {
    "action": "add",
    "widgets": [{
      "id": "temp-12345",
      "type": "hero",
      "position": 0,
      "config": {
        "heading": "Welcome",
        "subheading": "Your subtitle here"
      }
    }]
  }
}
```

#### Removing Widgets

```
User: "Remove the second hero section"
AI Response: "I'll remove the second hero widget from your layout..."
AI Response (JSON):
{
  "type": "widget_changes",
  "changes": {
    "action": "remove",
    "widgetIds": ["widget-abc-123"]
  }
}
```

#### Updating Widgets

```
User: "Change the hero heading to 'Welcome to Our Store'"
AI Response: "I'll update the hero heading for you..."
AI Response (JSON):
{
  "type": "widget_changes",
  "changes": {
    "action": "update",
    "widgets": [{
      "id": "existing-widget-id",
      "config": {
        "heading": "Welcome to Our Store"
      }
    }]
  }
}
```

## Widget Change Actions

### 1. Add Widgets

Adds new widgets at a specific position or at the end.

```json
{
  "action": "add",
  "widgets": [/* PageWidget objects */],
  "position": 0 // Optional: insert at specific position
}
```

### 2. Remove Widgets

Removes widgets by their IDs.

```json
{
  "action": "remove",
  "widgetIds": ["widget-id-1", "widget-id-2"]
}
```

### 3. Update Widgets

Updates configuration of existing widgets.

```json
{
  "action": "update",
  "widgets": [
    {
      "id": "existing-widget-id",
      "config": {
        "heading": "New Heading"
        // Only include fields that changed
      }
    }
  ]
}
```

### 4. Reorder Widgets

Changes the order of widgets.

```json
{
  "action": "reorder",
  "widgets": [/* Array of widgets in new order */]
}
```

## Available Widget Types

- **hero** - Full-width banner with heading, subheading, CTA
- **text** - Rich text content blocks
- **image** - Images with captions
- **single_product** - Display a single product
- **product_list** - Product grid displays
- **button** - Call-to-action buttons
- **navbar** - Navigation menus
- **container** - Layout wrappers with padding
- **flex** - Flexible row/column layouts
- **heading** - Text headings
- **divider** - Visual separators
- **spacer** - Vertical spacing
- **yield** - (Layouts only) Page content placeholder

## AI Capabilities by Context

### Page Building/Editing

- Add page sections (hero, text, images, etc.)
- Remove unwanted sections
- Reorder page layout
- Update content and styling
- Suggest layout improvements

### Layout Building/Editing

- Add reusable layout structures
- Configure header/footer
- Add navigation bars
- Design responsive layouts
- Place yield widgets for page content

### Component Building/Editing

- Configure component widgets
- Set component properties
- Design reusable elements
- Test component previews

## Technical Details

### Data Flow

1. **Builder Activation**:

   ```
   AdvancedBuilder mounts
   → builderContextStore.activate()
   → State syncs on every change
   ```

2. **AI Request**:

   ```
   User sends message
   → BuilderAIPanel passes entityData with builder context
   → API /ai-chat detects builder context from URL
   → Loads appropriate system prompt
   → AI generates response with widget_changes
   ```

3. **Apply Changes**:
   ```
   AI response streams back
   → AIAssistant parses widgetChanges
   → Dispatches applyChanges event
   → BuilderAIPanel applies changes using widgetChanges utility
   → Updates widgets array
   → AdvancedBuilder re-renders with new widgets
   → Builder state syncs to store
   ```

### Error Handling

- **Invalid JSON**: Gracefully ignored, AI provides conversational response
- **Unknown widget type**: Falls back to text widget
- **Invalid position**: Adds to end of widget array
- **Missing widget ID**: Skips that widget in updates
- **Server errors**: Caught and logged, user sees error message

## Testing the Feature

### Manual Testing

1. Navigate to `/admin/builder` (new page)
2. Open AI panel (click AI icon in toolbar)
3. Try commands like:
   - "Add a hero section"
   - "Remove the first text widget"
   - "Update the hero heading to say 'Welcome to My Store'"
   - "Add a navbar at the top"
   - "Create a product grid with 4 columns"

### Expected Behavior

- AI should acknowledge the request conversationally
- Changes should appear immediately in the canvas
- Undo/redo should work after AI changes
- Auto-save should capture AI-made changes
- History should track AI modifications

## Future Enhancements

### Planned Features

1. **Bulk Operations**: "Add 3 feature sections"
2. **Style Suggestions**: "Make the hero more modern"
3. **Content Generation**: "Write content for this text widget about organic
   products"
4. **Image Selection**: "Find a good hero image for a bakery"
5. **Responsive Adjustments**: "Optimize this layout for mobile"
6. **A/B Testing**: "Create a variant of this page with different copy"

### Integration Opportunities

- **Theme System**: "Apply the dark theme to this page"
- **Media Library**: "Insert the latest uploaded image"
- **Product Catalog**: "Add top 5 selling products to grid"
- **Analytics**: "Suggest improvements based on page performance"

## Troubleshooting

### AI Doesn't See Builder Context

**Symptoms**: AI responds generally, doesn't know about current widgets

**Solutions**:

1. Check `builderContextStore.isActive` is true
2. Verify `entityData.builder` is populated in BuilderAIPanel
3. Check browser console for errors in store updates

### Widget Changes Don't Apply

**Symptoms**: AI responds with JSON but nothing changes

**Solutions**:

1. Check console for `widgetChanges` log
2. Verify `applyWidgetChanges` function is called
3. Check widget IDs match existing widgets
4. Ensure AdvancedBuilder's `handleApplyChanges` event handler fires

### Type Errors in Widget Config

**Symptoms**: TypeScript errors when creating widgets

**Solutions**:

- Use `Record<string, unknown>` for config objects
- Check widget type exists in `WidgetType` enum
- Verify config structure matches widget requirements

## Related Documentation

- [Advanced Builder](./ADVANCED_COMPONENT_BUILDER.md)
- [AI Chat System](../README.md#ai-assistant)
- [Widget Types](./WYSIWYG_PAGE_BUILDER.md)
- [Context Detection](../src/lib/server/ai/context-detector.ts)

## API Reference

### builderContextStore

```typescript
import { builderContextStore } from '$lib/stores/builderContext';

// Activate builder context
builderContextStore.activate(
  mode: 'page' | 'layout' | 'component',
  entityId: string | null,
  entityName: string,
  slug: string,
  widgets: PageWidget[],
  layoutId: number | null
);

// Update state
builderContextStore.updateState({ widgets: newWidgets });

// Deactivate
builderContextStore.deactivate();
```

### Widget Change Utilities

```typescript
import { applyWidgetChanges } from '$lib/utils/widgetChanges';

const updatedWidgets = applyWidgetChanges(currentWidgets, {
  type: 'widget_changes',
  changes: {
    action: 'add',
    widgets: [newWidget]
  }
});
```

## Conclusion

The AI-aware builder system provides a powerful, intuitive interface for
building pages, layouts, and components through natural language. The AI
understands the current context and can perform live manipulations that
immediately reflect in the builder, creating a seamless editing experience.
