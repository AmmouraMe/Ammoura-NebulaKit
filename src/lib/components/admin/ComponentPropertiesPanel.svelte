<script lang="ts">
  import { tick } from 'svelte';
  import type {
    PageComponent,
    ComponentConfig,
    Breakpoint,
    ColorTheme,
    PositionConfig,
    ColorThemeDefinition,
    ThemeColors
  } from '$lib/types/pages';
  import type { MediaLibraryItem } from '$lib/types';
  import MediaBrowser from './MediaBrowser.svelte';
  import MediaUpload from './MediaUpload.svelte';
  import ThemeColorInput from './ThemeColorInput.svelte';
  import ButtonIconPicker from './ButtonIconPicker.svelte';
  import TailwindContainerEditor from '../builder/TailwindContainerEditor.svelte';
  import ChildLayoutEditor from '../builder/ChildLayoutEditor.svelte';
  import UniversalStyleEditor from '../builder/UniversalStyleEditor.svelte';
  import MotionEditor from '../builder/MotionEditor.svelte';
  import ToggleSwitch from '../ToggleSwitch.svelte';
  import { GripVertical, Trash2 } from 'lucide-svelte';
  import { getThemeColors } from '$lib/utils/editor/colorThemes';

  export let component: PageComponent;
  export let currentBreakpoint: Breakpoint;
  export let colorTheme: ColorTheme = 'default';
  export let colorThemes: ColorThemeDefinition[] = [];
  export let onUpdate: (config: ComponentConfig) => void;

  /**
   * Motion edits come back as an event rather than a binding, and the handler
   * lives here rather than inline in the template: `CustomEvent<ComponentConfig>`
   * written as an inline annotation is parsed as markup at the first angle
   * bracket.
   */
  function handleMotionUpdate(event: CustomEvent<ComponentConfig>): void {
    config = event.detail;
    handleImmediateUpdate();
  }
  export let onDeleteChild: ((childId: string) => void) | undefined = undefined;
  // Context from parent - when this component is a child of a container
  export let parentDisplayMode: 'flex' | 'grid' | 'block' | undefined = undefined;
  // The currently selected child component ID (for auto-expanding)
  export let selectedChildId: string | null = null;
  // Whether content editing is allowed (false in layout mode - only structure editing allowed)
  export let isContentEditable = true;

  // Compute theme colors from colorThemes array (database-loaded themes) or fallback to static lookup
  $: currentThemeData = colorThemes.find((t) => t.id === colorTheme);
  let themeColors: ThemeColors;
  $: themeColors = currentThemeData?.colors || getThemeColors(colorTheme);

  // Default to 'style' tab when content is not editable (layout mode)
  let activeTab: 'content' | 'style' | 'responsive' | 'advanced' = isContentEditable
    ? 'content'
    : 'style';
  let lastComponentId = component.id;

  // Reset to appropriate tab when isContentEditable changes
  $: if (!isContentEditable && activeTab === 'content') {
    activeTab = 'style';
  }
  let showMediaBrowser = false;
  let selectedMediaItems: MediaLibraryItem[] = [];

  // Feature card collapse/expand state - initialize with all features collapsed if component is features type
  let collapsedFeatures = new Set<number>(
    component.type === 'features' && component.config.features
      ? component.config.features.map((_, i) => i)
      : []
  );

  // Drag and drop state
  let draggedIndex: number | null = null;
  let dragOverIndex: number | null = null;
  let dropPosition: 'before' | 'after' | null = null;

  // Container children drag state
  let draggedChildIndex: number | null = null;
  let dragOverChildIndex: number | null = null;

  // Container children expand/collapse state
  let expandedChildren = new Set<string>();

  // Auto-expand and scroll to selected child when selectedChildId changes
  $: if (selectedChildId) {
    // Find the child in this component's children (recursively)
    const childPath = findChildPath(config.children, selectedChildId);
    if (childPath.length > 0) {
      // Expand all ancestors in the path
      childPath.forEach((id) => expandedChildren.add(id));
      expandedChildren = expandedChildren; // Trigger reactivity

      // Scroll to the child panel after DOM updates
      tick().then(() => {
        const childPanel = document.getElementById(`child-panel-${selectedChildId}`);
        if (childPanel) {
          childPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          childPanel.classList.add('highlight');
          setTimeout(() => childPanel.classList.remove('highlight'), 2000);
        }
      });
    }
  }

  // Find path of IDs from root to target child
  function findChildPath(children: PageComponent[] | undefined, targetId: string): string[] {
    if (!children) return [];
    for (const child of children) {
      if (child.id === targetId) {
        return [child.id];
      }
      const nestedPath = findChildPath(child.config?.children, targetId);
      if (nestedPath.length > 0) {
        return [child.id, ...nestedPath];
      }
    }
    return [];
  }

  // Debounce timer for handleUpdate
  let updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  // Timer for resetting _isLocalUpdate flag
  let localUpdateResetTimer: ReturnType<typeof setTimeout> | null = null;

  // Initialize config with defaults only for missing properties (not empty strings)
  function initConfig(
    ComponentConfig: ComponentConfig,
    applyDefaults: boolean = false
  ): ComponentConfig {
    const newConfig = { ...ComponentConfig };

    // Only apply defaults when explicitly requested (on component switch)
    if (applyDefaults && component.type === 'hero') {
      if (newConfig.backgroundColor === undefined) newConfig.backgroundColor = 'transparent';
      if (newConfig.backgroundImage === undefined) newConfig.backgroundImage = '';
      if (newConfig.title === undefined) newConfig.title = 'Hero Title';
      if (newConfig.subtitle === undefined) newConfig.subtitle = '';
      if (newConfig.overlay === undefined) newConfig.overlay = false;
      if (newConfig.overlayOpacity === undefined) newConfig.overlayOpacity = 50;
      if (newConfig.ctaText === undefined) newConfig.ctaText = '';
      if (newConfig.ctaLink === undefined) newConfig.ctaLink = '#';
      if (newConfig.contentAlign === undefined) newConfig.contentAlign = 'center';
      if (newConfig.heroHeight === undefined) {
        newConfig.heroHeight = {
          desktop: '500px',
          tablet: '400px',
          mobile: '300px'
        };
      }
    }

    if (applyDefaults && component.type === 'features') {
      if (newConfig.title === undefined) newConfig.title = 'Features';
      if (newConfig.subtitle === undefined) newConfig.subtitle = '';
      if (newConfig.features === undefined) {
        newConfig.features = [
          {
            icon: '🎯',
            title: 'Feature One',
            description: 'Describe what makes this feature great'
          },
          {
            icon: '✨',
            title: 'Feature Two',
            description: 'Explain the benefits of this feature'
          },
          {
            icon: '🚀',
            title: 'Feature Three',
            description: 'Tell users why they need this'
          }
        ];
      }
      if (newConfig.cardBackground === undefined) newConfig.cardBackground = 'theme:surface';
      if (newConfig.cardBorderColor === undefined) newConfig.cardBorderColor = 'theme:border';
      if (newConfig.cardBorderRadius === undefined) newConfig.cardBorderRadius = 12;
      if (newConfig.featuresColumns === undefined) {
        newConfig.featuresColumns = { desktop: 3, tablet: 2, mobile: 1 };
      }
      if (newConfig.featuresGap === undefined) {
        newConfig.featuresGap = { desktop: 32, tablet: 24, mobile: 16 };
      }
    }

    return newConfig;
  }

  let config: ComponentConfig = initConfig(component.config, false);
  let _lastConfigString = JSON.stringify(component.config);
  let _isLocalUpdate = false;

  // Only sync when switching widgets
  $: if (component.id !== lastComponentId) {
    lastComponentId = component.id;
    config = initConfig(component.config, false); // Don't apply defaults, just copy existing config
    _lastConfigString = JSON.stringify(component.config);
    showMediaBrowser = false;
    selectedMediaItems = [];
    _isLocalUpdate = false;

    // Collapse all feature cards by default when switching to a features widget
    if (component.type === 'features' && config.features) {
      collapsedFeatures = new Set(config.features.map((_, index) => index));
    } else {
      collapsedFeatures = new Set();
    }
  }
  // Helper function to create new child widgets
  function _createTextWidget(): PageComponent {
    return {
      id: `temp-${Date.now()}`,
      type: 'text',
      config: {
        text: 'Text content',
        alignment: 'left',
        fontSize: 16
      },
      position: 0,
      page_id: '',
      created_at: Date.now(),
      updated_at: Date.now()
    };
  }

  // Helper function to ensure position object exists for current breakpoint
  function ensurePositionBreakpoint(): NonNullable<
    NonNullable<typeof config.position>[typeof currentBreakpoint]
  > {
    // Handle legacy data where position might be a string instead of an object
    if (!config.position || typeof config.position === 'string') {
      config.position = { desktop: {} };
    }
    if (!config.position[currentBreakpoint]) config.position[currentBreakpoint] = {};
    return config.position[currentBreakpoint]!;
  }

  // Helper function to set position type (to avoid inline type assertions in template)
  function setPositionType(value: string): void {
    const pos = ensurePositionBreakpoint();
    pos.type = value as PositionConfig['type'];
    handleImmediateUpdate();
  }

  // Helper function to set position offset value
  function setPositionOffset(property: 'top' | 'right' | 'bottom' | 'left', value: string): void {
    const pos = ensurePositionBreakpoint();
    pos[property] = value;
    handleUpdate();
  }

  // Helper function to set z-index
  function setPositionZIndex(value: string): void {
    const pos = ensurePositionBreakpoint();
    pos.zIndex = parseInt(value) || 0;
    handleUpdate();
  }

  // Sync external widget config changes to local config (e.g., from contenteditable)
  // NOTE: We explicitly exclude 'children' from syncing because children are managed locally
  // via handleDeleteChild, handleChildUpdate, etc. Syncing children from external would cause
  // race conditions where the old value overwrites local deletions/updates.
  $: {
    const currentConfigString = JSON.stringify(component.config);
    if (currentConfigString !== _lastConfigString) {
      // If it's not a local update, sync from external source
      if (!_isLocalUpdate) {
        // Update individual properties to maintain bind:value reactivity
        // IMPORTANT: Skip 'children' - those are managed locally and should not be synced back
        Object.keys(component.config).forEach((key) => {
          if (key !== 'children') {
            (config as Record<string, unknown>)[key] = (
              component.config as Record<string, unknown>
            )[key];
          }
        });
        _lastConfigString = currentConfigString;
      }
      // NOTE: When _isLocalUpdate is true, we intentionally do NOT sync back.
      // The previous logic tried to detect "external changes" even during local updates,
      // but this caused race conditions where typing in a textarea would be overwritten
      // because the debounced update hadn't finished yet.
    }
  }

  function handleUpdate() {
    // Mark as local update IMMEDIATELY to prevent sync back during debounce
    _isLocalUpdate = true;
    _lastConfigString = JSON.stringify(config);

    // Clear any existing timers to prevent stale resets
    if (updateDebounceTimer) {
      clearTimeout(updateDebounceTimer);
    }
    if (localUpdateResetTimer) {
      clearTimeout(localUpdateResetTimer);
      localUpdateResetTimer = null;
    }

    // Debounce updates to avoid excessive calls while typing
    updateDebounceTimer = setTimeout(() => {
      // Send the updated config to parent
      onUpdate(config);
      // Reset flag after a brief delay, but track the timer so it can be canceled
      localUpdateResetTimer = setTimeout(() => {
        _isLocalUpdate = false;
        localUpdateResetTimer = null;
      }, 100);
    }, 100); // 100ms debounce delay
  }

  // Immediate update without debouncing (for select changes, buttons, etc.)
  function handleImmediateUpdate() {
    // Mark as local update FIRST to prevent sync back
    _isLocalUpdate = true;
    _lastConfigString = JSON.stringify(config);

    // Clear any pending timers
    if (updateDebounceTimer) {
      clearTimeout(updateDebounceTimer);
      updateDebounceTimer = null;
    }
    if (localUpdateResetTimer) {
      clearTimeout(localUpdateResetTimer);
      localUpdateResetTimer = null;
    }

    // Send the updated config to parent
    onUpdate(config);
    // Reset flag after a brief delay, but track the timer
    localUpdateResetTimer = setTimeout(() => {
      _isLocalUpdate = false;
      localUpdateResetTimer = null;
    }, 100);
  }

  function handleMediaUploaded(media: MediaLibraryItem) {
    config.backgroundImage = media.url;
    handleImmediateUpdate();
  }

  function handleMediaSelected(media: MediaLibraryItem[]) {
    // For image widget with single selection, immediately apply and close
    if (media.length > 0 && component.type === 'image') {
      config.src = media[0].url;
      showMediaBrowser = false;
      handleImmediateUpdate();
    } else {
      // Update selection with the provided array for other uses
      selectedMediaItems = media;
    }
  }

  function handleAddSelectedMedia() {
    if (selectedMediaItems.length > 0) {
      // For now, just use the first selected item for background image
      // In the future, this could be extended to support multiple images
      config.backgroundImage = selectedMediaItems[0].url;
      selectedMediaItems = [];
      showMediaBrowser = false;
      handleImmediateUpdate();
    }
  }

  function handleCancelMediaBrowser() {
    selectedMediaItems = [];
    showMediaBrowser = false;
  }

  // Toggle feature card collapse/expand
  function toggleFeatureCollapse(index: number) {
    if (collapsedFeatures.has(index)) {
      collapsedFeatures.delete(index);
    } else {
      collapsedFeatures.add(index);
    }
    collapsedFeatures = collapsedFeatures; // Trigger reactivity
  }

  // Drag and drop handlers for features
  function handleDragStart(event: DragEvent, index: number) {
    draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', '');
    }
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    // Determine if we should drop before or after this item
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const mouseY = event.clientY;

    dragOverIndex = index;
    dropPosition = mouseY < midpoint ? 'before' : 'after';
  }

  function handleDragLeave() {
    dragOverIndex = null;
    dropPosition = null;
  }

  function handleDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();

    if (draggedIndex === null || !config.features) return;

    const features = [...config.features];
    const [draggedItem] = features.splice(draggedIndex, 1);

    // Calculate the actual insertion index based on drop position
    let insertIndex = dropIndex;
    if (dropPosition === 'after') {
      insertIndex = dropIndex + 1;
    }

    // Adjust if we're moving from before to after the drop point
    if (draggedIndex < dropIndex && dropPosition === 'before') {
      insertIndex = dropIndex;
    } else if (draggedIndex < dropIndex && dropPosition === 'after') {
      insertIndex = dropIndex;
    } else if (draggedIndex > dropIndex && dropPosition === 'before') {
      insertIndex = dropIndex;
    } else if (draggedIndex > dropIndex && dropPosition === 'after') {
      insertIndex = dropIndex + 1;
    }

    features.splice(insertIndex, 0, draggedItem);
    config.features = features;
    handleImmediateUpdate();

    draggedIndex = null;
    dragOverIndex = null;
    dropPosition = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
    dragOverIndex = null;
    dropPosition = null;
  }

  // Drag and drop handlers for container children
  function handleChildDragStart(event: DragEvent, index: number): void {
    draggedChildIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', '');
    }
  }

  function handleChildDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragOverChildIndex = index;
  }

  function handleChildDragLeave(): void {
    dragOverChildIndex = null;
  }

  function handleChildDrop(event: DragEvent, dropIndex: number): void {
    event.preventDefault();

    if (draggedChildIndex === null || !config.children) return;

    const children = [...config.children];
    const [draggedItem] = children.splice(draggedChildIndex, 1);

    // Adjust insertion index if needed
    let insertIndex = dropIndex;
    if (draggedChildIndex < dropIndex) {
      insertIndex = dropIndex;
    }

    children.splice(insertIndex, 0, draggedItem);

    // Update positions for all children to match their array index
    config.children = children.map((child, index) => ({
      ...child,
      position: index
    }));
    handleImmediateUpdate();

    draggedChildIndex = null;
    dragOverChildIndex = null;
  }

  function handleChildDragEnd(): void {
    draggedChildIndex = null;
    dragOverChildIndex = null;
  }

  function handleDeleteChild(index: number): void {
    if (!config.children) return;

    const children = [...config.children];
    const childId = children[index].id;
    children.splice(index, 1);
    config.children = children;

    // Remove from expanded set if it was expanded
    expandedChildren.delete(childId);
    expandedChildren = expandedChildren;

    // Notify parent about the deletion so it can remove from pageComponents
    if (onDeleteChild) {
      onDeleteChild(childId);
    }

    handleImmediateUpdate();
  }

  function _toggleChildExpanded(childId: string): void {
    if (expandedChildren.has(childId)) {
      expandedChildren.delete(childId);
    } else {
      expandedChildren.add(childId);
    }
    expandedChildren = expandedChildren; // Trigger reactivity
  }

  // Scroll to child widget properties panel
  function scrollToChildPanel(childId: string): void {
    const element = document.getElementById(`child-panel-${childId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Briefly highlight the panel
      element.classList.add('highlight');
      setTimeout(() => element.classList.remove('highlight'), 2000);
    }
  }

  function handleChildUpdate(childIndex: number, childConfig: ComponentConfig): void {
    if (!config.children) return;

    const children = [...config.children];
    children[childIndex] = {
      ...children[childIndex],
      config: childConfig
    };
    config.children = children;
    handleImmediateUpdate();
  }

  // Helper to create typed child update handlers
  function createChildUpdateHandler(childIndex: number): (childConfig: ComponentConfig) => void {
    return (childConfig: ComponentConfig) => handleChildUpdate(childIndex, childConfig);
  }
</script>

<div class="properties-panel">
  <div class="panel-tabs">
    {#if isContentEditable}
      <button
        type="button"
        class="tab"
        class:active={activeTab === 'content'}
        on:click={() => (activeTab = 'content')}
      >
        Content
      </button>
    {/if}
    {#if parentDisplayMode && component.type !== 'container'}
      <!-- Non-container child within a container: show Layout tab for child positioning -->
      <button
        type="button"
        class="tab layout-tab"
        class:active={activeTab === 'responsive'}
        on:click={() => (activeTab = 'responsive')}
        title="Layout settings for this child within the parent container"
      >
        Layout
      </button>
    {:else if component.type === 'container'}
      <!-- Container (nested or top-level): show Layout tab for container settings -->
      <button
        type="button"
        class="tab"
        class:active={activeTab === 'responsive'}
        on:click={() => (activeTab = 'responsive')}
        title="Container layout settings (flex/grid)"
      >
        Layout
      </button>
    {/if}
    <button
      type="button"
      class="tab"
      class:active={activeTab === 'style'}
      on:click={() => (activeTab = 'style')}
    >
      Style
    </button>
    {#if !parentDisplayMode && component.type !== 'container'}
      <button
        type="button"
        class="tab"
        class:active={activeTab === 'responsive'}
        on:click={() => (activeTab = 'responsive')}
      >
        Responsive
      </button>
    {/if}
    <button
      type="button"
      class="tab"
      class:active={activeTab === 'advanced'}
      on:click={() => (activeTab = 'advanced')}
    >
      Advanced
    </button>
  </div>

  <div class="panel-content">
    {#if activeTab === 'content'}
      <div class="content-tab">
        <!-- Common Anchor Name field for all widgets -->
        <div class="form-group anchor-section">
          <label>
            <span>Anchor Name (Optional)</span>
            <input
              type="text"
              bind:value={config.anchorName}
              on:input={handleUpdate}
              placeholder="e.g., about-us, contact"
              pattern="[a-z0-9-]+"
              title="Use lowercase letters, numbers, and hyphens only"
            />
          </label>
          <small class="help-text">
            Set an anchor name to link directly to this section using /#anchor-name
          </small>
        </div>

        {#if component.type === 'text'}
          <div class="section">
            <h4>Content</h4>
            <div class="form-group">
              <label>
                <span>Text Content</span>
                <textarea
                  bind:value={config.text}
                  on:input={handleUpdate}
                  rows="6"
                  placeholder="Enter your text..."
                />
              </label>
            </div>
          </div>
        {:else if component.type === 'heading'}
          <div class="section">
            <h4>Content</h4>
            <div class="form-group">
              <label>
                <span>Heading Text</span>
                <input
                  type="text"
                  bind:value={config.heading}
                  on:input={handleUpdate}
                  placeholder="Enter heading..."
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Heading Level</span>
                <select bind:value={config.level} on:change={handleImmediateUpdate}>
                  <option value={1}>H1 (Largest)</option>
                  <option value={2}>H2</option>
                  <option value={3}>H3</option>
                  <option value={4}>H4</option>
                  <option value={5}>H5</option>
                  <option value={6}>H6 (Smallest)</option>
                </select>
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Link (Optional)</span>
                <input
                  type="text"
                  bind:value={config.link}
                  on:input={handleUpdate}
                  placeholder="https://example.com or /page-slug"
                />
              </label>
            </div>
          </div>
        {:else if component.type === 'image'}
          <div class="section">
            <h4>Image</h4>
            {#if config.src}
              <div class="media-preview">
                <img src={config.src} alt={config.alt || 'Preview'} />
                <button
                  type="button"
                  class="btn-remove"
                  on:click={() => {
                    config.src = '';
                    handleImmediateUpdate();
                  }}
                >
                  Remove
                </button>
              </div>
            {/if}
            <div class="media-actions">
              <MediaUpload
                onMediaUploaded={(media) => {
                  config.src = media.url;
                  handleImmediateUpdate();
                }}
              />
              <button
                type="button"
                class="btn-secondary"
                on:click={() => (showMediaBrowser = !showMediaBrowser)}
              >
                {showMediaBrowser ? 'Hide' : 'Browse'} Library
              </button>
            </div>
            {#if showMediaBrowser}
              <div
                class="media-browser-modal"
                role="button"
                tabindex="0"
                on:click|self={handleCancelMediaBrowser}
                on:keydown={(e) => e.key === 'Escape' && handleCancelMediaBrowser()}
              >
                <div class="media-browser-content">
                  <div class="media-browser-header">
                    <h3>Media Library</h3>
                    <div class="header-actions">
                      {#if selectedMediaItems.length > 0}
                        <span class="selection-count">
                          {selectedMediaItems.length} selected
                        </span>
                      {/if}
                      <button
                        type="button"
                        class="modal-close-btn"
                        on:click={handleCancelMediaBrowser}
                        title="Close"
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <MediaBrowser
                    onSelect={handleMediaSelected}
                    allowMultiple={false}
                    showFooter={false}
                  />
                </div>
              </div>
            {/if}
            <div class="form-group">
              <label>
                <span>Alt Text</span>
                <input
                  type="text"
                  bind:value={config.alt}
                  on:input={handleUpdate}
                  placeholder="Describe the image..."
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Link URL (optional)</span>
                <input
                  type="url"
                  bind:value={config.link}
                  on:input={handleUpdate}
                  placeholder="https://..."
                />
              </label>
            </div>
          </div>
        {:else if component.type === 'icon'}
          <div class="section">
            <h4>Icon</h4>
            <div class="form-group">
              <span class="field-label">Icon Name</span>
              <ButtonIconPicker
                value={config.iconName || 'Star'}
                placeholder="Select an icon"
                on:change={(e) => {
                  config.iconName = e.detail || 'Star';
                  handleImmediateUpdate();
                }}
              />
              <p class="field-hint">Search from 1500+ Lucide icons or browse by category.</p>
            </div>
            <div class="form-group">
              <label>
                <span>Icon Size (px)</span>
                <input
                  type="number"
                  bind:value={config.iconSize}
                  on:input={handleUpdate}
                  min="12"
                  max="256"
                  placeholder="24"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Stroke Width</span>
                <input
                  type="number"
                  bind:value={config.strokeWidth}
                  on:input={handleUpdate}
                  min="0.5"
                  max="4"
                  step="0.5"
                  placeholder="2"
                />
              </label>
            </div>
            <div class="form-group">
              <ThemeColorInput
                value={config.iconColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Icon Color"
                defaultValue="theme:text"
                onChange={(newValue) => {
                  config.iconColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
            <div class="form-group">
              <label>
                <span>Alignment</span>
                <select bind:value={config.alignment} on:change={handleImmediateUpdate}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          </div>
        {:else if component.type === 'hero'}
          <div class="section">
            <h4>Text Content</h4>
            <div class="form-group">
              <label>
                <span>Title</span>
                <input
                  type="text"
                  bind:value={config.title}
                  on:input={handleUpdate}
                  placeholder="Hero title..."
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Subtitle</span>
                <textarea
                  bind:value={config.subtitle}
                  on:input={handleUpdate}
                  rows="3"
                  placeholder="Hero subtitle..."
                />
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Primary Call to Action</h4>
            <div class="form-group">
              <label>
                <span>Button Text</span>
                <input
                  type="text"
                  bind:value={config.ctaText}
                  on:input={handleUpdate}
                  placeholder="Get Started"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Button Link</span>
                <input
                  type="url"
                  bind:value={config.ctaLink}
                  on:input={handleUpdate}
                  placeholder="https://..."
                />
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Secondary Call to Action (Optional)</h4>
            <div class="form-group">
              <label>
                <span>Button Text</span>
                <input
                  type="text"
                  bind:value={config.secondaryCtaText}
                  on:input={handleUpdate}
                  placeholder="Learn More"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Button Link</span>
                <input
                  type="url"
                  bind:value={config.secondaryCtaLink}
                  on:input={handleUpdate}
                  placeholder="https://..."
                />
              </label>
            </div>
          </div>
        {:else if component.type === 'button'}
          <div class="section">
            <h4>Button Content</h4>
            <div class="form-group">
              <label>
                <span>Button Label</span>
                <input
                  type="text"
                  bind:value={config.label}
                  on:input={handleUpdate}
                  placeholder="Click here"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Link URL</span>
                <input
                  type="url"
                  bind:value={config.url}
                  on:input={handleUpdate}
                  placeholder="https://..."
                />
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.openInNewTab}
                  on:change={handleImmediateUpdate}
                />
                <span>Open in new tab</span>
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Button Icon</h4>
            <div class="form-group">
              <span class="field-label">Icon (appears left of text)</span>
              <ButtonIconPicker
                value={config.icon || ''}
                on:change={(e) => {
                  config.icon = e.detail || undefined;
                  handleImmediateUpdate();
                }}
              />
              <p class="field-hint">Search from 1500+ Lucide icons or browse by category.</p>
            </div>
          </div>
        {:else if component.type === 'dropdown'}
          <div class="section">
            <h4>Trigger Settings</h4>
            <div class="form-group">
              <label>
                <span>Trigger Label</span>
                <input
                  type="text"
                  bind:value={config.triggerLabel}
                  on:input={handleUpdate}
                  placeholder="Menu"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Trigger Icon</span>
                <select bind:value={config.triggerIcon} on:change={handleImmediateUpdate}>
                  <option value="">None</option>
                  <option value="user">User</option>
                  <option value="☰">Menu (☰)</option>
                  <option value="⚙️">Settings (⚙️)</option>
                  <option value="▼">Arrow (▼)</option>
                </select>
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Trigger Style</span>
                <select bind:value={config.triggerVariant} on:change={handleImmediateUpdate}>
                  <option value="text">Text</option>
                  <option value="button">Button</option>
                  <option value="icon">Icon Only</option>
                </select>
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.showChevron}
                  on:change={handleImmediateUpdate}
                />
                <span>Show chevron arrow</span>
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Menu Settings</h4>
            <div class="form-group">
              <label>
                <span>Menu Width</span>
                <input
                  type="text"
                  bind:value={config.menuWidth}
                  on:input={handleUpdate}
                  placeholder="200px"
                />
              </label>
              <p class="field-hint">Use px, rem, or 'auto'</p>
            </div>
            <div class="form-group">
              <label>
                <span>Menu Alignment</span>
                <select bind:value={config.menuAlign} on:change={handleImmediateUpdate}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Menu Background</span>
                <input
                  type="text"
                  bind:value={config.menuBackground}
                  on:input={handleUpdate}
                  placeholder="var(--color-bg-primary)"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Border Radius</span>
                <input
                  type="number"
                  bind:value={config.menuBorderRadius}
                  on:input={handleUpdate}
                  min="0"
                  max="50"
                  placeholder="8"
                />
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.menuShadow}
                  on:change={handleImmediateUpdate}
                />
                <span>Show drop shadow</span>
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Menu Items</h4>
            <p class="field-hint">
              Drag components into the dropdown menu in the canvas to add menu items. Use buttons
              for links, text for labels, and dividers for separators.
            </p>

            {#if config.children && config.children.length > 0}
              <div class="container-children-list">
                <h5>Menu Items ({config.children.length})</h5>
                {#each config.children as child, index (child.id)}
                  <div class="child-wrapper">
                    <div
                      class="child-item"
                      class:dragging={draggedChildIndex === index}
                      class:drag-over={dragOverChildIndex === index}
                      draggable="true"
                      on:dragstart={(e) => handleChildDragStart(e, index)}
                      on:dragover={(e) => handleChildDragOver(e, index)}
                      on:dragleave={handleChildDragLeave}
                      on:drop={(e) => handleChildDrop(e, index)}
                      on:dragend={handleChildDragEnd}
                      role="listitem"
                    >
                      <div class="drag-handle" title="Drag to reorder">
                        <GripVertical size={16} />
                      </div>
                      <div class="child-info">
                        <span class="child-type">{child.type}</span>
                        {#if child.config.label}
                          <span class="child-title">- {child.config.label}</span>
                        {:else if child.config.text}
                          <span class="child-title"
                            >- {child.config.text.substring(0, 30)}{child.config.text.length > 30
                              ? '...'
                              : ''}</span
                          >
                        {:else if child.config.heading}
                          <span class="child-title"
                            >- {child.config.heading.substring(0, 30)}{child.config.heading.length >
                            30
                              ? '...'
                              : ''}</span
                          >
                        {/if}
                      </div>
                      <button
                        type="button"
                        class="btn-edit-child"
                        on:click={() => scrollToChildPanel(child.id)}
                        title="Jump to properties"
                      >
                        ↓ Properties
                      </button>
                      <button
                        type="button"
                        class="btn-delete-child"
                        on:click={() => handleDeleteChild(index)}
                        title="Delete item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-children-state">
                <p>No menu items yet</p>
                <span>Drop widgets from the sidebar into the dropdown menu</span>
              </div>
            {/if}
          </div>
        {:else if component.type === 'theme_toggle'}
          <div class="section">
            <h4>Toggle Settings</h4>
            <div class="form-group">
              <label>
                <span>Size</span>
                <select bind:value={config.size} on:change={handleImmediateUpdate}>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Variant</span>
                <select bind:value={config.toggleVariant} on:change={handleImmediateUpdate}>
                  <option value="icon">Icon Only</option>
                  <option value="icon-label">Icon with Label</option>
                  <option value="button">Button Style</option>
                </select>
              </label>
              <p class="field-hint">
                "Icon Only" shows just the sun/moon icon. "Icon with Label" adds text like "Light
                Mode" or "Dark Mode". "Button Style" uses a filled button design.
              </p>
            </div>
            <div class="form-group">
              <label>
                <span>Alignment</span>
                <select bind:value={config.alignment} on:change={handleImmediateUpdate}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          </div>
        {:else if component.type === 'scene'}
          <div class="section">
            <h4>Backdrop</h4>
            <div class="form-group">
              <label>
                <span>Variant</span>
                <select bind:value={config.sceneVariant} on:change={handleImmediateUpdate}>
                  <option value="stars">Starfield</option>
                  <option value="aurora">Aurora</option>
                  <option value="grid">Perspective grid</option>
                </select>
              </label>
              <p class="field-hint">
                Drawn from the theme's own colours, so it restyles with the site rather than pinning
                a palette into the page. Put content inside this component to sit it over the
                backdrop.
              </p>
            </div>
            <div class="form-group">
              <label>
                <span>Height</span>
                <input
                  type="text"
                  bind:value={config.sceneHeight}
                  on:input={handleImmediateUpdate}
                  placeholder="420px"
                />
              </label>
              <p class="field-hint">Any CSS length — 420px, 60vh, 100dvh.</p>
            </div>
            <div class="form-group">
              <label>
                <span>Density ({config.sceneDensity ?? 50})</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  bind:value={config.sceneDensity}
                  on:input={handleImmediateUpdate}
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Speed ({config.sceneSpeed ?? 50})</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  bind:value={config.sceneSpeed}
                  on:input={handleImmediateUpdate}
                />
              </label>
              <p class="field-hint">
                Halfway along each slider is the designed value. The scene holds still for a visitor
                who has asked for reduced motion, whatever these say.
              </p>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.scenePointerParallax}
                  on:change={handleImmediateUpdate}
                />
                <span>Follow the pointer</span>
              </label>
              <p class="field-hint">
                The backdrop drifts a little with the cursor. It has no effect on a touch screen,
                and none under reduced motion.
              </p>
            </div>
          </div>
        {:else if component.type === 'divider'}
          <p class="tab-info">All divider settings are in the Style tab.</p>
        {:else if component.type === 'single_product'}
          <div class="section">
            <h4>Product Selection</h4>
            <div class="form-group">
              <label>
                <span>Product ID</span>
                <input
                  type="text"
                  bind:value={config.productId}
                  on:input={handleUpdate}
                  placeholder="Enter product ID..."
                />
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Display Options</h4>
            <div class="form-group">
              <label>
                <span>Layout</span>
                <select bind:value={config.layout} on:change={handleImmediateUpdate}>
                  <option value="card">Card</option>
                  <option value="inline">Inline</option>
                  <option value="detailed">Detailed</option>
                </select>
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.showPrice}
                  on:change={handleImmediateUpdate}
                />
                <span>Show Price</span>
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.showDescription}
                  on:change={handleImmediateUpdate}
                />
                <span>Show Description</span>
              </label>
            </div>
          </div>
        {:else if component.type === 'product_list'}
          <div class="section">
            <h4>Products</h4>
            <div class="form-group">
              <label>
                <span>Category (optional)</span>
                <input
                  type="text"
                  bind:value={config.category}
                  on:input={handleUpdate}
                  placeholder="Enter category..."
                />
              </label>
              <p class="field-hint">Leave empty to show products from all categories.</p>
            </div>
            <div class="form-group">
              <label>
                <span>Number of Products</span>
                <input
                  type="number"
                  bind:value={config.limit}
                  on:input={handleUpdate}
                  min="1"
                  max="24"
                />
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Sorting</h4>
            <div class="form-group">
              <label>
                <span>Sort By</span>
                <select bind:value={config.sortBy} on:change={handleImmediateUpdate}>
                  <option value="name">Name</option>
                  <option value="price">Price</option>
                  <option value="created_at">Date Created</option>
                </select>
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Sort Order</span>
                <select bind:value={config.sortOrder} on:change={handleImmediateUpdate}>
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
            </div>
          </div>
        {:else if component.type === 'spacer'}
          <div class="section">
            <h4>Spacing</h4>
            <div class="form-group">
              <label>
                <span>Space (pixels)</span>
                {#if typeof config.space === 'object'}
                  <input
                    type="number"
                    bind:value={config.space.desktop}
                    on:input={handleUpdate}
                    min="0"
                    placeholder="40"
                  />
                {:else}
                  <input
                    type="number"
                    bind:value={config.space}
                    on:input={handleUpdate}
                    min="0"
                    placeholder="40"
                  />
                {/if}
              </label>
              <p class="field-hint">Use the Responsive tab to set different spacing per device.</p>
            </div>
          </div>
        {:else if component.type === 'columns'}
          <div class="section">
            <h4>Layout</h4>
            <div class="form-group">
              <label>
                <span>Number of Columns</span>
                {#if typeof config.columnCount === 'object'}
                  <input
                    type="number"
                    bind:value={config.columnCount.desktop}
                    on:input={handleUpdate}
                    min="1"
                    max="6"
                  />
                {:else}
                  <input
                    type="number"
                    bind:value={config.columnCount}
                    on:input={handleUpdate}
                    min="1"
                    max="6"
                  />
                {/if}
              </label>
              <p class="field-hint">Use the Responsive tab to set different columns per device.</p>
            </div>
            <div class="form-group">
              <label>
                <span>Vertical Alignment</span>
                <select bind:value={config.verticalAlign} on:change={handleImmediateUpdate}>
                  <option value="stretch">Stretch (default)</option>
                  <option value="start">Top</option>
                  <option value="center">Center</option>
                  <option value="end">Bottom</option>
                </select>
              </label>
            </div>
          </div>
        {:else if component.type === 'container'}
          <!-- Show container content -->
          <div class="section">
            <h4>Container Content</h4>
            <p class="field-hint">
              Drag widgets from the sidebar into this container to add child elements. The container
              will arrange them based on your layout and style settings in the Style tab.
            </p>

            {#if config.children && config.children.length > 0}
              <div class="container-children-list">
                <h5>Child Widgets ({config.children.length})</h5>
                {#each config.children as child, index (child.id)}
                  <div class="child-wrapper">
                    <div
                      class="child-item"
                      class:dragging={draggedChildIndex === index}
                      class:drag-over={dragOverChildIndex === index}
                      draggable="true"
                      on:dragstart={(e) => handleChildDragStart(e, index)}
                      on:dragover={(e) => handleChildDragOver(e, index)}
                      on:dragleave={handleChildDragLeave}
                      on:drop={(e) => handleChildDrop(e, index)}
                      on:dragend={handleChildDragEnd}
                      role="listitem"
                    >
                      <div class="drag-handle" title="Drag to reorder">
                        <GripVertical size={16} />
                      </div>
                      <div class="child-info">
                        <span class="child-type">{child.type}</span>
                        {#if child.config.title}
                          <span class="child-title">- {child.config.title}</span>
                        {:else if child.config.text}
                          <span class="child-title"
                            >- {child.config.text.substring(0, 30)}{child.config.text.length > 30
                              ? '...'
                              : ''}</span
                          >
                        {/if}
                      </div>
                      <button
                        type="button"
                        class="btn-edit-child"
                        on:click={() => scrollToChildPanel(child.id)}
                        title="Jump to properties"
                      >
                        ↓ Properties
                      </button>
                      <button
                        type="button"
                        class="btn-delete-child"
                        on:click={() => handleDeleteChild(index)}
                        title="Delete widget"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-children-state">
                <p>No child widgets yet</p>
                <span>Drop widgets from the sidebar into the container</span>
              </div>
            {/if}
          </div>
        {:else if component.type === 'features'}
          <div class="section">
            <h4>Section Header</h4>
            <div class="form-group">
              <label>
                <span>Title</span>
                <input
                  type="text"
                  bind:value={config.title}
                  on:input={handleUpdate}
                  placeholder="Features"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Subtitle</span>
                <textarea
                  bind:value={config.subtitle}
                  on:input={handleUpdate}
                  placeholder="Describe what makes your product special..."
                  rows="2"
                />
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Feature Cards</h4>
            <div class="form-group">
              <div class="section-header">
                <span>Feature Cards</span>
                <button
                  type="button"
                  class="btn-add-item"
                  on:click={() => {
                    if (!config.features) config.features = [];
                    const newIndex = config.features.length;
                    config.features = [
                      ...config.features,
                      { icon: '✨', title: 'New Feature', description: 'Describe this feature...' }
                    ];
                    // Collapse the newly added feature by default
                    collapsedFeatures.add(newIndex);
                    collapsedFeatures = collapsedFeatures; // Trigger reactivity
                    handleImmediateUpdate();
                  }}
                >
                  + Add Feature
                </button>
              </div>
              <div class="items-list">
                {#if config.features && config.features.length > 0}
                  {#each config.features as feature, index}
                    <div
                      class="item-card"
                      class:collapsed={collapsedFeatures.has(index)}
                      class:dragging={draggedIndex === index}
                      class:drag-over-before={dragOverIndex === index && dropPosition === 'before'}
                      class:drag-over-after={dragOverIndex === index && dropPosition === 'after'}
                      role="listitem"
                      draggable="true"
                      on:dragstart={(e) => handleDragStart(e, index)}
                      on:dragover={(e) => handleDragOver(e, index)}
                      on:dragleave={handleDragLeave}
                      on:drop={(e) => handleDrop(e, index)}
                      on:dragend={handleDragEnd}
                    >
                      <div class="item-header">
                        <div class="item-header-left">
                          <button type="button" class="drag-handle" title="Drag to reorder">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                            >
                              <line
                                x1="4"
                                y1="8"
                                x2="20"
                                y2="8"
                                stroke-width="2"
                                stroke-linecap="round"
                              />
                              <line
                                x1="4"
                                y1="16"
                                x2="20"
                                y2="16"
                                stroke-width="2"
                                stroke-linecap="round"
                              />
                            </svg>
                          </button>
                          <span class="item-title">
                            {feature.icon}
                            {feature.title || `Feature ${index + 1}`}
                          </span>
                        </div>
                        <div class="item-header-right">
                          <button
                            type="button"
                            class="btn-collapse"
                            on:click={() => toggleFeatureCollapse(index)}
                            title={collapsedFeatures.has(index) ? 'Expand' : 'Collapse'}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                            >
                              <polyline
                                points="6 9 12 15 18 9"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            class="btn-remove-item"
                            on:click={() => {
                              if (config.features) {
                                config.features = config.features.filter((_, i) => i !== index);
                                handleImmediateUpdate();
                              }
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {#if !collapsedFeatures.has(index)}
                        <div class="item-fields">
                          <label>
                            <span>Icon/Emoji</span>
                            <input
                              type="text"
                              bind:value={feature.icon}
                              on:input={handleUpdate}
                              placeholder="🎯"
                              maxlength="4"
                            />
                          </label>
                          <label>
                            <span>Title</span>
                            <input
                              type="text"
                              bind:value={feature.title}
                              on:input={handleUpdate}
                              placeholder="Feature title"
                            />
                          </label>
                          <label>
                            <span>Description</span>
                            <textarea
                              bind:value={feature.description}
                              on:input={handleUpdate}
                              placeholder="Describe this feature..."
                              rows="3"
                            />
                          </label>
                        </div>
                      {/if}
                    </div>
                  {/each}
                {:else}
                  <p class="empty-state">No features yet. Click "Add Feature" to get started.</p>
                {/if}
              </div>
            </div>
          </div>
        {:else if component.type === 'pricing'}
          <!-- Pricing Component - Container-based architecture -->
          <!-- Properties are edited through child components in the builder -->
          <div class="section">
            <h4>Pricing Section</h4>
            <p class="info-text">
              This component uses Container-based architecture. Edit the header, pricing cards, and
              CTA by selecting and modifying child components directly in the builder canvas.
            </p>
          </div>
        {:else if component.type === 'navbar'}
          <div class="section">
            <h4>Logo</h4>
            <div class="form-group">
              <label>
                <span>Logo Text</span>
                <input
                  type="text"
                  value={config.logo?.text || 'Store'}
                  on:input={(e) => {
                    if (!config.logo)
                      config.logo = { text: 'Store', url: '/', image: '', imageHeight: 40 };
                    config.logo.text = e.currentTarget.value;
                    handleUpdate();
                  }}
                  placeholder="Site Title"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Logo URL</span>
                <input
                  type="url"
                  value={config.logo?.url || '/'}
                  on:input={(e) => {
                    if (!config.logo)
                      config.logo = { text: 'Store', url: '/', image: '', imageHeight: 40 };
                    config.logo.url = e.currentTarget.value;
                    handleUpdate();
                  }}
                  placeholder="/"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Logo Image URL (optional)</span>
                <input
                  type="url"
                  value={config.logo?.image || ''}
                  on:input={(e) => {
                    if (!config.logo)
                      config.logo = { text: 'Store', url: '/', image: '', imageHeight: 40 };
                    config.logo.image = e.currentTarget.value;
                    handleUpdate();
                  }}
                  placeholder="https://..."
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Logo Height (px)</span>
                <input
                  type="number"
                  value={config.logo?.imageHeight || 40}
                  on:input={(e) => {
                    if (!config.logo)
                      config.logo = { text: 'Store', url: '/', image: '', imageHeight: 40 };
                    config.logo.imageHeight = parseInt(e.currentTarget.value);
                    handleUpdate();
                  }}
                  min="20"
                  max="100"
                  placeholder="40"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Logo Position</span>
                <select bind:value={config.logoPosition} on:change={handleImmediateUpdate}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                </select>
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Navigation Links</h4>
            <div class="form-group">
              <div class="section-header">
                <span>Links</span>
                <button
                  type="button"
                  class="btn-add-item"
                  on:click={() => {
                    if (!config.links) config.links = [];
                    config.links = [...config.links, { text: 'New Link', url: '#' }];
                    handleImmediateUpdate();
                  }}
                >
                  Add Link
                </button>
              </div>
              <div class="repeater-items">
                {#if config.links && config.links.length > 0}
                  {#each config.links as link, index}
                    <div class="repeater-item">
                      <div class="repeater-item-header">
                        <span class="repeater-item-title">{link.text || `Link ${index + 1}`}</span>
                        <button
                          type="button"
                          class="btn-remove-item"
                          on:click={() => {
                            if (config.links) {
                              config.links = config.links.filter((_, i) => i !== index);
                              handleImmediateUpdate();
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <div class="repeater-item-content">
                        <label>
                          <span>Link Text</span>
                          <input
                            type="text"
                            bind:value={link.text}
                            on:input={handleUpdate}
                            placeholder="Link text"
                          />
                        </label>
                        <label>
                          <span>Link URL</span>
                          <input
                            type="url"
                            bind:value={link.url}
                            on:input={handleUpdate}
                            placeholder="/"
                          />
                        </label>
                        <label class="checkbox-label">
                          <input
                            type="checkbox"
                            bind:checked={link.openInNewTab}
                            on:change={handleImmediateUpdate}
                          />
                          <span>Open in new tab</span>
                        </label>
                      </div>
                    </div>
                  {/each}
                {:else}
                  <p class="empty-state">No links yet. Click "Add Link" to get started.</p>
                {/if}
              </div>
            </div>
            <div class="form-group">
              <label>
                <span>Links Position</span>
                <select bind:value={config.linksPosition} on:change={handleImmediateUpdate}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Action Buttons</h4>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.showSearch}
                  on:change={handleImmediateUpdate}
                />
                <span>Show Search</span>
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.showCart}
                  on:change={handleImmediateUpdate}
                />
                <span>Show Cart</span>
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.showAuth}
                  on:change={handleImmediateUpdate}
                />
                <span>Show Auth/Login</span>
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.showThemeToggle}
                  on:change={handleImmediateUpdate}
                />
                <span>Show Theme Toggle</span>
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.showLanguageSwitcher}
                  on:change={handleImmediateUpdate}
                />
                <span>Show Language Switcher</span>
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.showAccountMenu}
                  on:change={handleImmediateUpdate}
                />
                <span>Show Account Menu (when authenticated)</span>
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Actions Position</span>
                <select bind:value={config.actionsPosition} on:change={handleImmediateUpdate}>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Account Menu Items</h4>
            <p class="field-hint">
              These items appear in the dropdown menu when a user is authenticated.
            </p>
            <div class="form-group">
              <div class="section-header">
                <span>Menu Items</span>
                <button
                  type="button"
                  class="btn-add-item"
                  on:click={() => {
                    if (!config.accountMenuItems) config.accountMenuItems = [];
                    config.accountMenuItems = [
                      ...config.accountMenuItems,
                      { text: 'New Item', url: '#', icon: '📄' }
                    ];
                    handleImmediateUpdate();
                  }}
                >
                  Add Item
                </button>
              </div>
              <div class="repeater-items">
                {#if config.accountMenuItems && config.accountMenuItems.length > 0}
                  {#each config.accountMenuItems as item, index}
                    <div class="repeater-item">
                      <div class="repeater-item-header">
                        <span class="repeater-item-title">{item.text || `Item ${index + 1}`}</span>
                        <button
                          type="button"
                          class="btn-remove-item"
                          on:click={() => {
                            if (config.accountMenuItems) {
                              config.accountMenuItems = config.accountMenuItems.filter(
                                (_, i) => i !== index
                              );
                              handleImmediateUpdate();
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <div class="repeater-item-content">
                        <label>
                          <span>Icon (emoji or text)</span>
                          <input
                            type="text"
                            bind:value={item.icon}
                            on:input={handleUpdate}
                            placeholder="📄"
                            maxlength="4"
                          />
                        </label>
                        <label>
                          <span>Item Text</span>
                          <input
                            type="text"
                            bind:value={item.text}
                            on:input={handleUpdate}
                            placeholder="Menu item"
                          />
                        </label>
                        <label>
                          <span>Item URL</span>
                          <input
                            type="url"
                            bind:value={item.url}
                            on:input={handleUpdate}
                            placeholder="/user/profile"
                          />
                        </label>
                        <label class="checkbox-label">
                          <input
                            type="checkbox"
                            bind:checked={item.dividerBefore}
                            on:change={handleImmediateUpdate}
                          />
                          <span>Show divider before this item</span>
                        </label>
                      </div>
                    </div>
                  {/each}
                {:else}
                  <p class="empty-state">
                    No custom menu items. Standard items (profile, settings, logout) are included by
                    default.
                  </p>
                {/if}
              </div>
            </div>
          </div>
          <div class="section">
            <h4>Behavior</h4>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.sticky}
                  on:change={handleImmediateUpdate}
                />
                <span>Sticky Navigation (stays at top when scrolling)</span>
              </label>
            </div>
          </div>
        {/if}
      </div>
    {:else if activeTab === 'style'}
      <div class="style-tab">
        <!-- Widget-Specific Style Settings -->
        {#if component.type === 'hero'}
          <div class="section">
            <h4>Layout</h4>
            <div class="form-group">
              <label>
                <span>Content Alignment</span>
                <select bind:value={config.contentAlign} on:change={handleImmediateUpdate}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Background</h4>
            <div class="form-group">
              <label for="background-image">
                <span>Background Image</span>
              </label>
              {#if config.backgroundImage}
                <div class="media-preview">
                  <img src={config.backgroundImage} alt="Background" />
                  <button
                    type="button"
                    class="btn-remove"
                    on:click={() => {
                      config.backgroundImage = '';
                      handleImmediateUpdate();
                    }}
                  >
                    Remove
                  </button>
                </div>
              {/if}
              <div class="media-actions">
                <MediaUpload onMediaUploaded={handleMediaUploaded} />
                <button
                  type="button"
                  class="btn-secondary"
                  on:click={() => (showMediaBrowser = !showMediaBrowser)}
                >
                  {showMediaBrowser ? 'Hide' : 'Browse'} Library
                </button>
              </div>
              {#if showMediaBrowser}
                <div
                  class="media-browser-modal"
                  role="button"
                  tabindex="0"
                  on:click|self={handleCancelMediaBrowser}
                  on:keydown={(e) => e.key === 'Escape' && handleCancelMediaBrowser()}
                >
                  <div class="media-browser-content">
                    <div class="media-browser-header">
                      <h3>Media Library</h3>
                      <div class="header-actions">
                        {#if selectedMediaItems.length > 0}
                          <span class="selection-count">
                            {selectedMediaItems.length} selected
                          </span>
                        {/if}
                        <button
                          type="button"
                          class="modal-close-btn"
                          on:click={handleCancelMediaBrowser}
                          title="Close"
                        >
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <path
                              d="M18 6L6 18M6 6l12 12"
                              stroke-width="2"
                              stroke-linecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div class="media-browser-body">
                      <MediaBrowser
                        onSelect={handleMediaSelected}
                        selectedIds={selectedMediaItems.map((item) => item.id)}
                        showFooter={false}
                      />
                    </div>
                    <div class="media-browser-footer">
                      <button type="button" class="btn-cancel" on:click={handleCancelMediaBrowser}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        class="btn-add"
                        disabled={selectedMediaItems.length === 0}
                        on:click={handleAddSelectedMedia}
                      >
                        Add Selected ({selectedMediaItems.length})
                      </button>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
            <div class="form-group">
              <ThemeColorInput
                value={config.backgroundColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Background Color"
                defaultValue="transparent"
                onChange={(newValue) => {
                  config.backgroundColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
          </div>
          <div class="section">
            <h4>Overlay</h4>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.overlay}
                  on:change={handleImmediateUpdate}
                />
                <span>Add Dark Overlay</span>
              </label>
            </div>
            {#if config.overlay}
              <div class="form-group">
                <label>
                  <span>Overlay Opacity ({config.overlayOpacity || 50}%)</span>
                  <input
                    type="range"
                    bind:value={config.overlayOpacity}
                    on:input={handleUpdate}
                    min="0"
                    max="100"
                  />
                </label>
              </div>
            {/if}
          </div>
          <div class="section">
            <h4>Text Styling</h4>
            <div class="form-group">
              <ThemeColorInput
                value={config.titleColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Title Color"
                defaultValue="theme:text"
                onChange={(newValue) => {
                  config.titleColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
            <div class="form-group">
              <ThemeColorInput
                value={config.subtitleColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Subtitle Color"
                defaultValue="theme:textSecondary"
                onChange={(newValue) => {
                  config.subtitleColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
          </div>
        {/if}

        {#if component.type === 'text'}
          <div class="section">
            <h4>Alignment</h4>
            <div class="form-group">
              <label>
                <span>Text Alignment</span>
                <select bind:value={config.alignment} on:change={handleImmediateUpdate}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                  <option value="justify">Justify</option>
                </select>
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Typography & Color</h4>
            <div class="form-group">
              <ThemeColorInput
                value={config.textColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Text Color"
                defaultValue="theme:text"
                onChange={(newValue) => {
                  config.textColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
            <div class="form-group">
              <label>
                <span>Font Size (px)</span>
                <input
                  type="number"
                  bind:value={config.fontSize}
                  on:input={handleUpdate}
                  min="8"
                  max="72"
                  placeholder="16"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Line Height</span>
                <input
                  type="number"
                  bind:value={config.lineHeight}
                  on:input={handleUpdate}
                  min="1"
                  max="3"
                  step="0.1"
                  placeholder="1.6"
                />
              </label>
            </div>
          </div>
        {:else if component.type === 'heading'}
          <div class="section">
            <h4>Styling</h4>
            <div class="form-group">
              <label>
                <span>Text Alignment</span>
                <select bind:value={config.alignment} on:change={handleImmediateUpdate}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>
            <div class="form-group">
              <ThemeColorInput
                value={config.textColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Text Color"
                defaultValue="theme:text"
                onChange={(newValue) => {
                  config.textColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
          </div>
        {:else if component.type === 'image'}
          <div class="section">
            <h4>Dimensions</h4>
            <div class="form-group">
              <label>
                <span>Width</span>
                <input
                  type="text"
                  bind:value={config.imageWidth}
                  on:input={handleUpdate}
                  placeholder="100%, 500px, etc."
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Height</span>
                <input
                  type="text"
                  bind:value={config.imageHeight}
                  on:input={handleUpdate}
                  placeholder="auto, 300px, etc."
                />
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Display</h4>
            <div class="form-group">
              <label>
                <span>Object Fit</span>
                <select bind:value={config.objectFit} on:change={handleImmediateUpdate}>
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="fill">Fill</option>
                  <option value="none">None</option>
                </select>
              </label>
            </div>
          </div>
        {:else if component.type === 'hero'}
          {#if config.ctaText}
            <div class="section">
              <h4>Primary Button Styling</h4>
              <div class="form-group">
                <ThemeColorInput
                  value={config.ctaBackgroundColor}
                  currentTheme={colorTheme}
                  {themeColors}
                  label="Button Background Color"
                  defaultValue="theme:primary"
                  onChange={(newValue) => {
                    config.ctaBackgroundColor = newValue;
                    handleImmediateUpdate();
                  }}
                />
              </div>
              <div class="form-group">
                <ThemeColorInput
                  value={config.ctaTextColor}
                  currentTheme={colorTheme}
                  {themeColors}
                  label="Button Text Color"
                  defaultValue="theme:background"
                  onChange={(newValue) => {
                    config.ctaTextColor = newValue;
                    handleImmediateUpdate();
                  }}
                />
              </div>
              <div class="form-group">
                <label>
                  <span>Font Size</span>
                  <input
                    type="text"
                    bind:value={config.ctaFontSize}
                    on:input={handleUpdate}
                    placeholder="16px"
                  />
                </label>
              </div>
              <div class="form-group">
                <label>
                  <span>Font Weight</span>
                  <select bind:value={config.ctaFontWeight} on:change={handleImmediateUpdate}>
                    <option value="400">Normal (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">Semi-bold (600)</option>
                    <option value="700">Bold (700)</option>
                  </select>
                </label>
              </div>
            </div>
          {/if}
          {#if config.secondaryCtaText}
            <div class="section">
              <h4>Secondary Button Styling</h4>
              <div class="form-group">
                <ThemeColorInput
                  value={config.secondaryCtaBackgroundColor}
                  currentTheme={colorTheme}
                  {themeColors}
                  label="Button Background Color"
                  defaultValue="theme:secondary"
                  onChange={(newValue) => {
                    config.secondaryCtaBackgroundColor = newValue;
                    handleImmediateUpdate();
                  }}
                />
              </div>
              <div class="form-group">
                <ThemeColorInput
                  value={config.secondaryCtaTextColor}
                  currentTheme={colorTheme}
                  {themeColors}
                  label="Button Text Color"
                  defaultValue="theme:text"
                  onChange={(newValue) => {
                    config.secondaryCtaTextColor = newValue;
                    handleImmediateUpdate();
                  }}
                />
              </div>
              <div class="form-group">
                <ThemeColorInput
                  value={config.secondaryCtaBorderColor}
                  currentTheme={colorTheme}
                  {themeColors}
                  label="Button Border Color"
                  defaultValue="theme:border"
                  onChange={(newValue) => {
                    config.secondaryCtaBorderColor = newValue;
                    handleImmediateUpdate();
                  }}
                />
              </div>
              <div class="form-group">
                <label>
                  <span>Font Size</span>
                  <input
                    type="text"
                    bind:value={config.secondaryCtaFontSize}
                    on:input={handleUpdate}
                    placeholder="16px"
                  />
                </label>
              </div>
              <div class="form-group">
                <label>
                  <span>Font Weight</span>
                  <select
                    bind:value={config.secondaryCtaFontWeight}
                    on:change={handleImmediateUpdate}
                  >
                    <option value="400">Normal (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">Semi-bold (600)</option>
                    <option value="700">Bold (700)</option>
                  </select>
                </label>
              </div>
            </div>
          {/if}
        {:else if component.type === 'button'}
          <div class="section">
            <h4>Style</h4>
            <div class="form-group">
              <label>
                <span>Button Variant</span>
                <select bind:value={config.variant} on:change={handleImmediateUpdate}>
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="outline">Outline</option>
                  <option value="text">Text</option>
                </select>
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Button Size</span>
                <select bind:value={config.size} on:change={handleImmediateUpdate}>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Layout</h4>
            <div class="form-group">
              <label class="checkbox-label">
                {#if typeof config.fullWidth === 'object'}
                  <input
                    type="checkbox"
                    bind:checked={config.fullWidth.desktop}
                    on:change={handleImmediateUpdate}
                  />
                {:else}
                  <input
                    type="checkbox"
                    bind:checked={config.fullWidth}
                    on:change={handleImmediateUpdate}
                  />
                {/if}
                <span>Full width</span>
              </label>
              <p class="field-hint">Use the Responsive tab for per-device full width control.</p>
            </div>
          </div>
        {:else if component.type === 'divider'}
          <div class="section">
            <h4>Styling</h4>
            <div class="form-group">
              <label>
                <span>Thickness (px)</span>
                <input
                  type="number"
                  bind:value={config.thickness}
                  on:input={handleUpdate}
                  min="1"
                  max="10"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Style</span>
                <select bind:value={config.dividerStyle} on:change={handleImmediateUpdate}>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                </select>
              </label>
            </div>
            <div class="form-group">
              <ThemeColorInput
                value={config.dividerColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Divider Color"
                defaultValue="theme:border"
                onChange={(newValue) => {
                  config.dividerColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
            <div class="form-group">
              <label>
                <span>Vertical Spacing (pixels)</span>
                {#if typeof config.spacing === 'object'}
                  <input
                    type="number"
                    bind:value={config.spacing.desktop}
                    on:input={handleUpdate}
                    min="0"
                    placeholder="20"
                  />
                {:else}
                  <input
                    type="number"
                    bind:value={config.spacing}
                    on:input={handleUpdate}
                    min="0"
                    placeholder="20"
                  />
                {/if}
              </label>
              <p class="field-hint">
                Vertical spacing above and below the divider. Use Responsive tab for per-device
                spacing.
              </p>
            </div>
          </div>
        {:else if component.type === 'columns'}
          <div class="section">
            <h4>Spacing</h4>
            <div class="form-group">
              <label>
                <span>Gap Between Columns (pixels)</span>
                {#if typeof config.gap === 'object'}
                  <input
                    type="number"
                    bind:value={config.gap.desktop}
                    on:input={handleUpdate}
                    min="0"
                    placeholder="20"
                  />
                {:else}
                  <input
                    type="number"
                    bind:value={config.gap}
                    on:input={handleUpdate}
                    min="0"
                    placeholder="20"
                  />
                {/if}
              </label>
              <p class="field-hint">Use Responsive tab for per-device gap control.</p>
            </div>
          </div>
        {:else if component.type === 'container'}
          <TailwindContainerEditor
            {config}
            {currentBreakpoint}
            {colorTheme}
            {colorThemes}
            showTabNavigation={false}
            activeTabOverride="style"
            on:update={(e) => {
              config = e.detail;
              handleImmediateUpdate();
            }}
          />
        {:else if component.type === 'features'}
          <div class="section">
            <h4>Card Styling</h4>
            <div class="form-group">
              <ThemeColorInput
                value={config.cardBackground}
                currentTheme={colorTheme}
                {themeColors}
                label="Card Background Color"
                defaultValue="theme:surface"
                onChange={(newValue) => {
                  config.cardBackground = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
            <div class="form-group">
              <ThemeColorInput
                value={config.cardBorderColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Card Border Color"
                defaultValue="theme:border"
                onChange={(newValue) => {
                  config.cardBorderColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
            <div class="form-group">
              <label>
                <span>Border Width (px)</span>
                <input
                  type="number"
                  bind:value={config.cardBorderWidth}
                  on:input={handleUpdate}
                  min="0"
                  placeholder="1"
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Border Radius (px)</span>
                <input
                  type="number"
                  bind:value={config.cardBorderRadius}
                  on:input={handleUpdate}
                  min="0"
                  placeholder="12"
                />
              </label>
            </div>
          </div>
        {:else if component.type === 'pricing'}
          <!-- Pricing Component - Container-based architecture -->
          <div class="section">
            <h4>Container Background</h4>
            <div class="form-group">
              <ThemeColorInput
                value={config.containerBackground || config.backgroundColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Background"
                defaultValue="linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)"
                onChange={(newValue) => {
                  config.containerBackground = newValue;
                  config.backgroundColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
          </div>
        {:else if component.type === 'navbar'}
          <div class="section">
            <h4>Colors</h4>
            <div class="form-group">
              <ThemeColorInput
                value={config.navbarBackground}
                currentTheme={colorTheme}
                {themeColors}
                label="Background Color"
                defaultValue="transparent"
                onChange={(newValue) => {
                  config.navbarBackground = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
            <div class="form-group">
              <ThemeColorInput
                value={config.navbarTextColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Text Color"
                defaultValue="#000000"
                onChange={(newValue) => {
                  config.navbarTextColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
            <div class="form-group">
              <ThemeColorInput
                value={config.navbarHoverColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Hover Color"
                defaultValue="theme:primary"
                onChange={(newValue) => {
                  config.navbarHoverColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
            <div class="form-group">
              <ThemeColorInput
                value={config.navbarBorderColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Border Color"
                defaultValue="#e5e7eb"
                onChange={(newValue) => {
                  config.navbarBorderColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
          </div>
          <div class="section">
            <h4>Dropdown Styling</h4>
            <div class="form-group">
              <ThemeColorInput
                value={config.dropdownBackground}
                currentTheme={colorTheme}
                {themeColors}
                label="Dropdown Background"
                defaultValue="#ffffff"
                onChange={(newValue) => {
                  config.dropdownBackground = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
            <div class="form-group">
              <ThemeColorInput
                value={config.dropdownTextColor}
                currentTheme={colorTheme}
                {themeColors}
                label="Dropdown Text Color"
                defaultValue="#000000"
                onChange={(newValue) => {
                  config.dropdownTextColor = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
            <div class="form-group">
              <ThemeColorInput
                value={config.dropdownHoverBackground}
                currentTheme={colorTheme}
                {themeColors}
                label="Dropdown Hover Background"
                defaultValue="#f3f4f6"
                onChange={(newValue) => {
                  config.dropdownHoverBackground = newValue;
                  handleImmediateUpdate();
                }}
              />
            </div>
          </div>
          <div class="section">
            <h4>Layout</h4>
            <div class="form-group">
              <label>
                <span>Navbar Height (px, 0 = auto)</span>
                <input
                  type="number"
                  bind:value={config.navbarHeight}
                  on:input={handleUpdate}
                  min="0"
                  max="200"
                  placeholder="0"
                />
              </label>
              <p class="field-hint">Set to 0 for automatic height based on content.</p>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.navbarShadow}
                  on:change={handleImmediateUpdate}
                />
                <span>Show Shadow</span>
              </label>
            </div>
          </div>
          <div class="section">
            <h4>Positioning</h4>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.sticky}
                  on:change={handleImmediateUpdate}
                />
                <span>Sticky Header</span>
              </label>
              <p class="field-hint">
                When enabled, the navigation bar will stay fixed at the top of the viewport as the
                user scrolls.
              </p>
            </div>
          </div>
        {/if}

        <!-- Universal Style Section - appears for all non-container components -->
        {#if component.type !== 'container'}
          <UniversalStyleEditor
            {config}
            {currentBreakpoint}
            {colorTheme}
            {colorThemes}
            on:update={(e) => {
              config = e.detail;
              handleImmediateUpdate();
            }}
          />
        {/if}

        <!-- Universal Positioning Section - appears for all components -->
        <div class="section">
          <h4>Positioning</h4>
          <div class="form-group">
            <label>
              <span>Position Type</span>
              <select
                value={config.position?.[currentBreakpoint]?.type ||
                  config.position?.desktop?.type ||
                  'static'}
                on:change={(e) => setPositionType(e.currentTarget.value)}
              >
                <option value="static">Static (default)</option>
                <option value="relative">Relative</option>
                <option value="absolute">Absolute</option>
                <option value="fixed">Fixed</option>
                <option value="sticky">Sticky</option>
              </select>
            </label>
            <p class="field-hint">Controls how the element is positioned in the document flow.</p>
          </div>

          {#if (config.position?.[currentBreakpoint]?.type || config.position?.desktop?.type) && (config.position?.[currentBreakpoint]?.type || config.position?.desktop?.type) !== 'static'}
            <div class="form-group">
              <label>
                <span>Top</span>
                <input
                  type="text"
                  value={config.position?.[currentBreakpoint]?.top ||
                    config.position?.desktop?.top ||
                    ''}
                  placeholder="auto, 0, 10px, 1rem"
                  on:input={(e) => setPositionOffset('top', e.currentTarget.value)}
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Right</span>
                <input
                  type="text"
                  value={config.position?.[currentBreakpoint]?.right ||
                    config.position?.desktop?.right ||
                    ''}
                  placeholder="auto, 0, 10px, 1rem"
                  on:input={(e) => setPositionOffset('right', e.currentTarget.value)}
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Bottom</span>
                <input
                  type="text"
                  value={config.position?.[currentBreakpoint]?.bottom ||
                    config.position?.desktop?.bottom ||
                    ''}
                  placeholder="auto, 0, 10px, 1rem"
                  on:input={(e) => setPositionOffset('bottom', e.currentTarget.value)}
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Left</span>
                <input
                  type="text"
                  value={config.position?.[currentBreakpoint]?.left ||
                    config.position?.desktop?.left ||
                    ''}
                  placeholder="auto, 0, 10px, 1rem"
                  on:input={(e) => setPositionOffset('left', e.currentTarget.value)}
                />
              </label>
            </div>
            <div class="form-group">
              <label>
                <span>Z-Index</span>
                <input
                  type="number"
                  value={config.position?.[currentBreakpoint]?.zIndex ??
                    config.position?.desktop?.zIndex ??
                    0}
                  placeholder="0"
                  on:input={(e) => setPositionZIndex(e.currentTarget.value)}
                />
              </label>
              <p class="field-hint">Higher values appear in front of elements with lower values.</p>
            </div>
          {/if}
        </div>
      </div>
    {:else if activeTab === 'responsive'}
      <div class="responsive-tab">
        {#if parentDisplayMode && component.type !== 'container'}
          <!-- Child Layout Editor - shown when this non-container component is inside a container -->
          <ChildLayoutEditor
            {config}
            {currentBreakpoint}
            {parentDisplayMode}
            onUpdate={(updatedConfig) => {
              config = updatedConfig;
              handleImmediateUpdate();
            }}
          />
        {:else if component.type === 'container'}
          <!-- Container Layout Settings - shown for all containers including nested ones -->
          <TailwindContainerEditor
            {config}
            {currentBreakpoint}
            {colorTheme}
            {colorThemes}
            showTabNavigation={false}
            activeTabOverride="layout"
            on:update={(e) => {
              config = e.detail;
              handleImmediateUpdate();
            }}
          />
        {:else}
          <div class="breakpoint-info">
            <p>Configure different values for each device size:</p>
            <div class="current-breakpoint">
              Editing: <strong>{currentBreakpoint}</strong>
            </div>
          </div>

          {#if component.type === 'spacer' && config.space}
            <div class="form-group">
              <label>
                <span>Spacing ({currentBreakpoint})</span>
                <input
                  type="number"
                  bind:value={config.space[currentBreakpoint]}
                  on:input={handleUpdate}
                  min="0"
                  placeholder="px"
                />
              </label>
            </div>
          {:else if component.type === 'divider' && config.spacing}
            <div class="form-group">
              <label>
                <span>Spacing ({currentBreakpoint})</span>
                <input
                  type="number"
                  bind:value={config.spacing[currentBreakpoint]}
                  on:input={handleUpdate}
                  min="0"
                  placeholder="px"
                />
              </label>
            </div>
          {:else if component.type === 'hero' && config.heroHeight}
            <div class="form-group">
              <label>
                <span>Height ({currentBreakpoint})</span>
                <input
                  type="text"
                  bind:value={config.heroHeight[currentBreakpoint]}
                  on:input={handleUpdate}
                  placeholder="500px, 50vh, etc."
                />
              </label>
            </div>
          {:else if component.type === 'product_list' || component.type === 'columns'}
            <div class="form-group">
              <label>
                <span>Columns ({currentBreakpoint})</span>
                {#if component.type === 'product_list'}
                  {#if !config.columns}
                    {(() => {
                      config.columns = { desktop: 3 };
                      return '';
                    })()}
                  {/if}
                  <input
                    type="number"
                    bind:value={config.columns[currentBreakpoint]}
                    on:input={handleUpdate}
                    min="1"
                    max="6"
                  />
                {:else}
                  {#if !config.columnCount}
                    {(() => {
                      config.columnCount = { desktop: 2 };
                      return '';
                    })()}
                  {/if}
                  <input
                    type="number"
                    bind:value={config.columnCount[currentBreakpoint]}
                    on:input={handleUpdate}
                    min="1"
                    max="6"
                  />
                {/if}
              </label>
            </div>
            {#if component.type === 'columns'}
              <div class="form-group">
                <label>
                  <span>Gap ({currentBreakpoint}) - pixels</span>
                  {#if !config.gap}
                    {(() => {
                      config.gap = { desktop: 20 };
                      return '';
                    })()}
                  {/if}
                  <input
                    type="number"
                    bind:value={config.gap[currentBreakpoint]}
                    on:input={handleUpdate}
                    min="0"
                    placeholder="20"
                  />
                </label>
              </div>
            {/if}
          {:else if component.type === 'button' && config.fullWidth}
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={config.fullWidth[currentBreakpoint]}
                  on:change={handleImmediateUpdate}
                />
                <span>Full Width on {currentBreakpoint}</span>
              </label>
            </div>
          {:else if component.type === 'features'}
            <div class="form-group">
              <label>
                <span>Columns ({currentBreakpoint})</span>
                {#if !config.featuresColumns}
                  {(() => {
                    config.featuresColumns = { desktop: 3, tablet: 2, mobile: 1 };
                    return '';
                  })()}
                {/if}
                <input
                  type="number"
                  bind:value={config.featuresColumns[currentBreakpoint]}
                  on:input={handleUpdate}
                  min="1"
                />
              </label>
              <p class="field-hint">
                Number of feature cards per row on {currentBreakpoint} devices.
              </p>
            </div>
            <div class="form-group">
              <label>
                <span>Gap ({currentBreakpoint}) - pixels</span>
                {#if !config.featuresGap}
                  {(() => {
                    config.featuresGap = { desktop: 32, tablet: 24, mobile: 16 };
                    return '';
                  })()}
                {/if}
                <input
                  type="number"
                  bind:value={config.featuresGap[currentBreakpoint]}
                  on:input={handleUpdate}
                  min="0"
                  placeholder="32"
                />
              </label>
              <p class="field-hint">Space between feature cards on {currentBreakpoint} devices.</p>
            </div>
            <div class="form-group">
              <label>
                <span>Limit ({currentBreakpoint}) - Optional</span>
                <input
                  type="number"
                  value={config.featuresLimit?.[currentBreakpoint] ?? ''}
                  on:input={(e) => {
                    const val = e.currentTarget.value;
                    if (!config.featuresLimit) {
                      config.featuresLimit = { desktop: 0 };
                    }
                    if (val === '') {
                      // @ts-expect-error - Allow setting to undefined for optional values
                      config.featuresLimit[currentBreakpoint] = undefined;
                    } else {
                      config.featuresLimit[currentBreakpoint] = parseInt(val);
                    }
                  }}
                  on:input={handleUpdate}
                  min="1"
                  placeholder="Show all"
                />
              </label>
              <p class="field-hint">
                Maximum number of features to display on {currentBreakpoint} devices. Leave empty to show
                all.
              </p>
            </div>
          {:else if component.type === 'navbar' && config.navbarPadding}
            <div class="form-group">
              <h4>Padding ({currentBreakpoint})</h4>
              {#if !config.navbarPadding[currentBreakpoint]}
                {(() => {
                  if (!config.navbarPadding) {
                    config.navbarPadding = {
                      desktop: { top: 16, right: 24, bottom: 16, left: 24 },
                      tablet: { top: 12, right: 20, bottom: 12, left: 20 },
                      mobile: { top: 12, right: 16, bottom: 12, left: 16 }
                    };
                  }
                  if (!config.navbarPadding[currentBreakpoint]) {
                    config.navbarPadding[currentBreakpoint] = {
                      top: 16,
                      right: 24,
                      bottom: 16,
                      left: 24
                    };
                  }
                  return '';
                })()}
              {/if}
              <div class="spacing-grid">
                <label>
                  <span>Top</span>
                  <input
                    type="number"
                    value={config.navbarPadding?.[currentBreakpoint]?.top ?? 16}
                    on:input={(e) => {
                      if (config.navbarPadding && config.navbarPadding[currentBreakpoint]) {
                        const padding = config.navbarPadding[currentBreakpoint];
                        if (padding) {
                          padding.top = parseInt(e.currentTarget.value);
                          handleUpdate();
                        }
                      }
                    }}
                    min="0"
                    placeholder="16"
                  />
                </label>
                <label>
                  <span>Right</span>
                  <input
                    type="number"
                    value={config.navbarPadding?.[currentBreakpoint]?.right ?? 24}
                    on:input={(e) => {
                      if (config.navbarPadding && config.navbarPadding[currentBreakpoint]) {
                        const padding = config.navbarPadding[currentBreakpoint];
                        if (padding) {
                          padding.right = parseInt(e.currentTarget.value);
                          handleUpdate();
                        }
                      }
                    }}
                    min="0"
                    placeholder="24"
                  />
                </label>
                <label>
                  <span>Bottom</span>
                  <input
                    type="number"
                    value={config.navbarPadding?.[currentBreakpoint]?.bottom ?? 16}
                    on:input={(e) => {
                      if (config.navbarPadding && config.navbarPadding[currentBreakpoint]) {
                        const padding = config.navbarPadding[currentBreakpoint];
                        if (padding) {
                          padding.bottom = parseInt(e.currentTarget.value);
                          handleUpdate();
                        }
                      }
                    }}
                    min="0"
                    placeholder="16"
                  />
                </label>
                <label>
                  <span>Left</span>
                  <input
                    type="number"
                    value={config.navbarPadding?.[currentBreakpoint]?.left ?? 24}
                    on:input={(e) => {
                      if (config.navbarPadding && config.navbarPadding[currentBreakpoint]) {
                        const padding = config.navbarPadding[currentBreakpoint];
                        if (padding) {
                          padding.left = parseInt(e.currentTarget.value);
                          handleUpdate();
                        }
                      }
                    }}
                    min="0"
                    placeholder="24"
                  />
                </label>
              </div>
              <p class="field-hint">
                Adjust navbar padding for {currentBreakpoint} devices.
              </p>
            </div>
          {:else}
            <p class="tab-info">This widget doesn't have responsive settings.</p>
          {/if}
        {/if}
      </div>
    {:else if activeTab === 'advanced'}
      <div class="advanced-tab">
        {#if component.type === 'yield'}
          <!-- Yield-specific settings -->
          <div class="section yield-settings-section">
            <h4>Page Content Settings</h4>
            <p class="section-description">
              Configure how page content is displayed within this layout.
            </p>

            <ToggleSwitch
              checked={config.showPageTitle ?? false}
              label="Show page title above content"
              description="When enabled, the page title will be displayed above the page content. This is the default setting for all pages using this layout. Individual pages can override this setting."
              onChange={(checked) => {
                config.showPageTitle = checked;
                handleImmediateUpdate();
              }}
            />
          </div>
        {/if}

        <!-- Motion. Above visibility because it is the one people come to this
             tab looking for; visibility is a rule you set once. -->
        <div class="section motion-section">
          <h4>Motion</h4>
          <p class="section-description">
            How this component arrives and how it behaves as the page scrolls.
          </p>
          <MotionEditor {config} componentType={component.type} on:update={handleMotionUpdate} />
        </div>

        <div class="section visibility-section">
          <h4>Visibility Controls</h4>
          <p class="section-description">
            Control who can see this component based on authentication status or user roles.
          </p>

          <div class="form-group">
            <label>
              <span>Show Component</span>
              <select bind:value={config.visibilityRule} on:change={handleImmediateUpdate}>
                <option value="always">Always (Everyone)</option>
                <option value="authenticated">Logged In Users Only</option>
                <option value="unauthenticated">Logged Out Users Only</option>
                <option value="role">Specific Roles Only</option>
              </select>
            </label>
            <small class="help-text">
              Choose when this component should be visible to visitors.
            </small>
          </div>

          {#if config.visibilityRule === 'role'}
            <div class="form-group">
              <label>
                <span>Required Roles</span>
                <input
                  type="text"
                  value={config.requiredRoles?.join(', ') ?? ''}
                  on:input={(e) => {
                    const target = e.target;
                    if (target instanceof HTMLInputElement) {
                      const rolesString = target.value;
                      config.requiredRoles = rolesString
                        .split(',')
                        .map((r) => r.trim())
                        .filter((r) => r.length > 0);
                      handleUpdate();
                    }
                  }}
                  placeholder="admin, editor, moderator"
                />
              </label>
              <small class="help-text">
                Comma-separated list of role names. User must have at least one of these roles to
                see this component.
              </small>
            </div>

            <div class="form-group">
              <label>
                <span>Hide From Roles (Optional)</span>
                <input
                  type="text"
                  value={config.hideFromRoles?.join(', ') ?? ''}
                  on:input={(e) => {
                    const target = e.target;
                    if (target instanceof HTMLInputElement) {
                      const rolesString = target.value;
                      config.hideFromRoles = rolesString
                        .split(',')
                        .map((r) => r.trim())
                        .filter((r) => r.length > 0);
                      handleUpdate();
                    }
                  }}
                  placeholder="banned, restricted"
                />
              </label>
              <small class="help-text">
                Users with any of these roles will NOT see this component, even if they have a
                required role.
              </small>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Child widget properties panels (always shown for container widgets) -->
{#if component.type === 'container' && config.children && config.children.length > 0}
  {@const containerDisplayMode = (() => {
    const display = config.containerDisplay;
    if (!display) return 'flex';
    if (typeof display === 'object' && display !== null) {
      return display[currentBreakpoint] || display.desktop || 'flex';
    }
    return display;
  })()}
  <div class="child-properties-container">
    {#each config.children as child, index (child.id)}
      <div class="child-properties-panel" id="child-panel-{child.id}">
        <div class="child-panel-header">
          <div class="child-panel-title">
            <span class="child-panel-number">#{index + 1}</span>
            <span class="child-panel-type">{child.type}</span>
            {#if child.config.title}
              <span class="child-panel-name">- {child.config.title}</span>
            {:else if child.config.text}
              <span class="child-panel-name">
                - {child.config.text.substring(0, 40)}{child.config.text.length > 40 ? '...' : ''}
              </span>
            {/if}
          </div>
        </div>
        <div class="child-panel-content">
          <svelte:self
            component={child}
            {currentBreakpoint}
            {colorTheme}
            onUpdate={createChildUpdateHandler(index)}
            parentDisplayMode={containerDisplayMode}
          />
        </div>
      </div>
    {/each}
  </div>
{/if}

<!-- Child widget properties panels for dropdown menu items -->
{#if component.type === 'dropdown' && config.children && config.children.length > 0}
  <div class="child-properties-container">
    <div class="child-properties-header">
      <h4>Menu Items</h4>
      <span class="child-count">{config.children.length} item(s)</span>
    </div>
    {#each config.children as child, index (child.id)}
      <div class="child-properties-panel" id="child-panel-{child.id}">
        <div class="child-panel-header">
          <div class="child-panel-title">
            <span class="child-panel-number">#{index + 1}</span>
            <span class="child-panel-type">{child.type}</span>
            {#if child.config?.label}
              <span class="child-panel-name">- {child.config.label}</span>
            {:else if child.config?.text}
              <span class="child-panel-name">
                - {child.config.text.substring(0, 30)}{child.config.text.length > 30 ? '...' : ''}
              </span>
            {:else if child.config?.heading}
              <span class="child-panel-name">
                - {child.config.heading.substring(0, 30)}{child.config.heading.length > 30
                  ? '...'
                  : ''}
              </span>
            {/if}
          </div>
        </div>
        <div class="child-panel-content">
          <svelte:self
            component={child}
            {currentBreakpoint}
            {colorTheme}
            onUpdate={createChildUpdateHandler(index)}
            parentDisplayMode="flex"
          />
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .properties-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-primary);
  }

  .panel-tabs {
    display: flex;
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .tab {
    flex: 1;
    padding: 0.75rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab:hover {
    background: var(--color-bg-secondary);
  }

  .tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .anchor-section {
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .help-text {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .form-group label {
    display: block;
  }

  .form-group label > span {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .form-group input[type='text'],
  .form-group input[type='url'],
  .form-group input[type='number'],
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 0.875rem;
  }

  .form-group input[type='range'] {
    width: 100%;
  }

  .checkbox-label {
    display: flex !important;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .checkbox-label input[type='checkbox'] {
    width: auto;
    cursor: pointer;
  }

  .tab-info {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .breakpoint-info {
    background: var(--color-bg-secondary);
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }

  .breakpoint-info p {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .current-breakpoint {
    font-size: 0.875rem;
    color: var(--color-text-primary);
  }

  .current-breakpoint strong {
    color: var(--color-primary);
    text-transform: capitalize;
  }

  .field-hint {
    margin: 0.5rem 0 0 0;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .field-label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .media-preview {
    position: relative;
    margin-bottom: 1rem;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--color-border-secondary);
  }

  .media-preview img {
    width: 100%;
    height: 200px;
    object-fit: cover;
    display: block;
  }

  .media-preview .btn-remove {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(239, 68, 68, 0.9);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .media-preview .btn-remove:hover {
    background: rgba(220, 38, 38, 1);
  }

  .media-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .media-actions :global(.upload-button) {
    flex: 1;
  }

  .btn-secondary {
    flex: 1;
    padding: 0.5rem 1rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    color: var(--color-text-primary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: var(--color-bg-tertiary);
  }

  .media-browser-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 2rem;
  }

  .media-browser-content {
    background: var(--color-bg-primary);
    border-radius: 12px;
    width: 95vw;
    height: 90vh;
    max-width: 1400px;
    max-height: 900px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .media-browser-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--color-border-secondary);
    flex-shrink: 0;
  }

  .media-browser-header h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .selection-count {
    font-size: 0.875rem;
    color: var(--color-primary);
    font-weight: 600;
    padding: 0.5rem 1rem;
    background: var(--color-bg-secondary);
    border-radius: 6px;
  }

  .modal-close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    padding: 0.5rem;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close-btn:hover {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
  }

  .media-browser-body {
    flex: 1;
    overflow: auto;
    padding: 2rem;
  }

  .media-browser-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid var(--color-border-secondary);
    flex-shrink: 0;
  }

  .btn-cancel {
    padding: 0.75rem 1.5rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel:hover {
    background: var(--color-bg-tertiary);
  }

  .btn-add {
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-add:hover:not(:disabled) {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .btn-add:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Features widget item management */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .section-header > span {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .btn-add-item {
    padding: 0.5rem 1rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-add-item:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .item-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    padding: 1rem;
    cursor: grab;
    transition: all 0.2s ease;
  }

  .item-card:active {
    cursor: grabbing;
  }

  .item-card.dragging {
    opacity: 0.5;
    transform: scale(0.98);
  }

  .item-card.drag-over-before,
  .item-card.drag-over-after {
    position: relative;
  }

  .item-card.drag-over-before::before,
  .item-card.drag-over-after::after {
    content: '';
    position: absolute;
    left: -4px;
    right: -4px;
    height: 3px;
    background: var(--color-primary);
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
    animation: pulse-drop-indicator 1s ease-in-out infinite;
    z-index: 10;
  }

  .item-card.drag-over-before::before {
    top: -8px;
  }

  .item-card.drag-over-after::after {
    bottom: -8px;
  }

  @keyframes pulse-drop-indicator {
    0%,
    100% {
      opacity: 1;
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
    }
    50% {
      opacity: 0.6;
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.8);
    }
  }

  .item-card.collapsed {
    padding-bottom: 1rem;
  }

  .item-card.collapsed .item-header {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-border-secondary);
    gap: 0.75rem;
  }

  .item-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .item-header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .drag-handle {
    padding: 0.25rem;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--color-text-secondary);
    cursor: grab;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .drag-handle:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .item-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .btn-collapse {
    padding: 0.25rem;
    background: transparent;
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-collapse:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .item-card.collapsed .btn-collapse svg {
    transform: rotate(-90deg);
  }

  .btn-remove-item {
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-remove-item:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.5);
    color: rgb(239, 68, 68);
  }

  .item-fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .item-fields label {
    display: block;
  }

  .item-fields label > span {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .item-fields input,
  .item-fields textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 0.875rem;
  }

  .empty-state {
    padding: 2rem;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    background: var(--color-bg-secondary);
    border: 2px dashed var(--color-border-secondary);
    border-radius: 8px;
  }

  .child-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
  }

  .child-type {
    font-weight: 500;
    text-transform: capitalize;
    color: var(--color-text-primary);
  }

  .help-text {
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  /* Content Tab Sections */
  .content-tab {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Style Tab Sections */
  .style-tab {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Responsive Tab */
  .responsive-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section {
    padding: 1rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
  }

  .section + .section {
    margin-top: 1rem;
  }

  .section-description {
    margin: 0 0 1rem 0;
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .visibility-section {
    margin-top: 1.5rem;
    border-top: 1px solid var(--color-border-secondary);
    padding-top: 1.5rem;
  }

  .section h4 {
    margin: 0 0 1rem 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-primary);
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .section .form-group:last-child {
    margin-bottom: 0;
  }

  /* Container children list styles */
  .container-children-list {
    margin-top: 1rem;
  }

  .container-children-list h5 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .container-children-list .child-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    margin-bottom: 0.5rem;
    cursor: move;
    transition: all 0.2s;
  }

  .container-children-list .child-item:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-primary-light);
  }

  .container-children-list .child-item.dragging {
    opacity: 0.5;
    transform: scale(0.98);
  }

  .container-children-list .child-item.drag-over {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
    box-shadow: 0 0 0 2px var(--color-primary-light);
  }

  .drag-handle {
    display: flex;
    align-items: center;
    color: var(--color-text-secondary);
    cursor: grab;
    flex-shrink: 0;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .child-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
    overflow: hidden;
  }

  .child-type {
    font-weight: 600;
    text-transform: capitalize;
    color: var(--color-text-primary);
    flex-shrink: 0;
  }

  .child-title {
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-delete-child {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background: transparent;
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .btn-delete-child:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.5);
    color: rgb(239, 68, 68);
  }

  .empty-children-state {
    padding: 2rem;
    text-align: center;
    background: var(--color-bg-tertiary);
    border: 2px dashed var(--color-border-secondary);
    border-radius: 8px;
    margin-top: 1rem;
  }

  .empty-children-state p {
    margin: 0 0 0.5rem 0;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .empty-children-state span {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  /* Child wrapper for expand/collapse */
  .child-wrapper {
    margin-bottom: 0.5rem;
  }

  .child-wrapper:last-child {
    margin-bottom: 0;
  }

  /* Edit button for child widgets - now a link to scroll to panel */
  .btn-edit-child {
    padding: 0.25rem 0.75rem;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .btn-edit-child:hover {
    background: var(--color-bg-secondary);
    border-color: var(--color-text-secondary);
    transform: translateY(-1px);
  }

  /* Container for all child properties panels */
  .child-properties-container {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-secondary);
  }

  /* Individual child properties panel */
  .child-properties-panel {
    display: flex;
    flex-direction: column;
    background: var(--color-bg-primary);
    border-top: 2px solid var(--color-border-secondary);
    margin-bottom: 1rem;
    transition: all 0.3s ease;
  }

  .child-properties-panel:global(.highlight) {
    animation: pulse 0.5s ease-in-out 3;
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .child-properties-panel:last-child {
    margin-bottom: 0;
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 3px var(--color-primary-light, rgba(59, 130, 246, 0.3));
    }
    50% {
      box-shadow: 0 0 0 6px var(--color-primary-light, rgba(59, 130, 246, 0.5));
    }
  }

  .child-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border-secondary);
    flex-shrink: 0;
  }

  .child-panel-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .child-panel-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: var(--color-text-secondary);
    color: white;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .child-panel-type {
    color: var(--color-text-primary);
    font-weight: 600;
    text-transform: capitalize;
  }

  .child-panel-name {
    color: var(--color-text-secondary);
  }

  .child-panel-content {
    background: var(--color-bg-primary);
  }

  /* Nested properties panel styling */
  .child-panel-content :global(.properties-panel) {
    height: auto;
    border: none;
  }

  .child-panel-content :global(.panel-tabs) {
    background: var(--color-bg-secondary);
  }

  /* Child properties header for dropdown/container */
  .child-properties-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--color-bg-tertiary);
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .child-properties-header h4 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .child-count {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    background: var(--color-bg-secondary);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }
</style>
