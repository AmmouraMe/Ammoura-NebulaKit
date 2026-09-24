<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type {
    WidgetConfig,
    Breakpoint,
    ResponsiveValue,
    ColorThemeDefinition
  } from '$lib/types/pages';
  import ThemeColorInput from '../admin/ThemeColorInput.svelte';
  import BreakpointFieldBadge from './BreakpointFieldBadge.svelte';
  import TokenScalePicker from './TokenScalePicker.svelte';
  import { getThemeColors } from '$lib/utils/editor/colorThemes';
  import { setBreakpoint, clearBreakpoint } from '$lib/utils/responsiveField';
  import { SPACE_SCALE } from '$lib/utils/designScales';

  export let config: WidgetConfig;
  export let currentBreakpoint: Breakpoint = 'desktop';
  export let colorTheme: string = 'default';
  export let colorThemes: ColorThemeDefinition[] = [];

  // Compute theme colors from colorThemes array (database-loaded themes) or fallback to static lookup
  $: currentThemeData = colorThemes.find((t) => t.id === colorTheme);
  $: themeColors = currentThemeData?.colors || getThemeColors(colorTheme);

  const dispatch = createEventDispatcher<{ update: WidgetConfig }>();

  // Flex presets for common layouts
  const flexPresets: Array<{
    name: string;
    icon: string;
    config: Partial<WidgetConfig>;
  }> = [
    {
      name: 'Row (Default)',
      icon: '→',
      config: {
        flexDirection: {
          desktop: 'row' as const,
          tablet: 'row' as const,
          mobile: 'column' as const
        },
        flexJustifyContent: { desktop: 'flex-start' as const },
        flexAlignItems: { desktop: 'stretch' as const }
      }
    },
    {
      name: 'Column',
      icon: '↓',
      config: {
        flexDirection: { desktop: 'column' as const },
        flexJustifyContent: { desktop: 'flex-start' as const },
        flexAlignItems: { desktop: 'stretch' as const }
      }
    },
    {
      name: 'Center Everything',
      icon: '⊕',
      config: {
        flexDirection: {
          desktop: 'row' as const,
          tablet: 'row' as const,
          mobile: 'column' as const
        },
        flexJustifyContent: { desktop: 'center' as const },
        flexAlignItems: { desktop: 'center' as const }
      }
    },
    {
      name: 'Space Between',
      icon: '⟷',
      config: {
        flexDirection: {
          desktop: 'row' as const,
          tablet: 'row' as const,
          mobile: 'column' as const
        },
        flexJustifyContent: { desktop: 'space-between' as const },
        flexAlignItems: { desktop: 'center' as const }
      }
    },
    {
      name: 'Space Around',
      icon: '⟺',
      config: {
        flexDirection: {
          desktop: 'row' as const,
          tablet: 'row' as const,
          mobile: 'column' as const
        },
        flexJustifyContent: { desktop: 'space-around' as const },
        flexAlignItems: { desktop: 'center' as const }
      }
    }
  ];

  // Helper to get responsive value
  function getResponsiveValue<T>(value: ResponsiveValue<T> | undefined, fallback: T): T {
    if (!value) return fallback;
    if (typeof value === 'object' && 'desktop' in value) {
      return value[currentBreakpoint] ?? value.desktop;
    }
    return fallback;
  }

  // Helper to set responsive value — writes only the current breakpoint's slot
  // (seeding a desktop base), so tablet/mobile edits are real overrides that can
  // be reset to inherit, rather than copies of every breakpoint.
  function setResponsiveValue<T>(
    current: ResponsiveValue<T> | undefined,
    newValue: T
  ): ResponsiveValue<T> {
    return setBreakpoint(current, currentBreakpoint, newValue);
  }

  // Clear the current breakpoint's override on a field so it inherits again.
  function resetField(key: keyof WidgetConfig): void {
    const current = config[key] as ResponsiveValue<unknown> | undefined;
    updateConfig({ [key]: clearBreakpoint(current, currentBreakpoint) } as Partial<WidgetConfig>);
  }

  // Current values
  $: flexDirection = getResponsiveValue(config.flexDirection, 'row');
  $: flexWrap = getResponsiveValue(config.flexWrap, 'wrap');
  $: flexJustifyContent = getResponsiveValue(config.flexJustifyContent, 'flex-start');
  $: flexAlignItems = getResponsiveValue(config.flexAlignItems, 'stretch');
  $: flexAlignContent = getResponsiveValue(config.flexAlignContent, 'stretch');
  $: flexGap = getResponsiveValue(config.flexGap, 16);
  $: flexGapX = getResponsiveValue(config.flexGapX, flexGap);
  $: flexGapY = getResponsiveValue(config.flexGapY, flexGap);
  $: flexWidth = getResponsiveValue(config.flexWidth, '100%');
  $: flexHeight = getResponsiveValue(config.flexHeight, 'auto');
  $: flexMinHeight = getResponsiveValue(config.flexMinHeight, 'auto');
  $: flexMaxWidth = getResponsiveValue(config.flexMaxWidth, 'none');
  $: flexPadding = getResponsiveValue(config.flexPadding, {
    top: 16,
    right: 16,
    bottom: 16,
    left: 16
  });
  $: flexMargin = getResponsiveValue(config.flexMargin, { top: 0, right: 0, bottom: 0, left: 0 });

  function updateConfig(updates: Partial<WidgetConfig>): void {
    dispatch('update', { ...config, ...updates });
  }

  function applyPreset(preset: (typeof flexPresets)[0]): void {
    updateConfig(preset.config);
  }

  function updateFlexDirection(value: string): void {
    updateConfig({
      flexDirection: setResponsiveValue(
        config.flexDirection,
        value as 'row' | 'column' | 'row-reverse' | 'column-reverse'
      )
    });
  }

  function updateFlexWrap(value: string): void {
    updateConfig({
      flexWrap: setResponsiveValue(config.flexWrap, value as 'nowrap' | 'wrap' | 'wrap-reverse')
    });
  }

  function updateFlexJustifyContent(value: string): void {
    updateConfig({
      flexJustifyContent: setResponsiveValue(
        config.flexJustifyContent,
        value as
          'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'
      )
    });
  }

  function updateFlexAlignItems(value: string): void {
    updateConfig({
      flexAlignItems: setResponsiveValue(
        config.flexAlignItems,
        value as 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'
      )
    });
  }

  function updateFlexAlignContent(value: string): void {
    updateConfig({
      flexAlignContent: setResponsiveValue(
        config.flexAlignContent,
        value as 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'space-between' | 'space-around'
      )
    });
  }

  function updateFlexGap(value: number): void {
    updateConfig({
      flexGap: setResponsiveValue(config.flexGap, value)
    });
  }

  function updateFlexGapX(value: number): void {
    updateConfig({
      flexGapX: setResponsiveValue(config.flexGapX, value)
    });
  }

  function updateFlexGapY(value: number): void {
    updateConfig({
      flexGapY: setResponsiveValue(config.flexGapY, value)
    });
  }

  function updateFlexWidth(value: string): void {
    updateConfig({
      flexWidth: setResponsiveValue(config.flexWidth, value)
    });
  }

  function updateFlexHeight(value: string): void {
    updateConfig({
      flexHeight: setResponsiveValue(config.flexHeight, value)
    });
  }

  function updateFlexMinHeight(value: string): void {
    updateConfig({
      flexMinHeight: setResponsiveValue(config.flexMinHeight, value)
    });
  }

  function updateFlexMaxWidth(value: string): void {
    updateConfig({
      flexMaxWidth: setResponsiveValue(config.flexMaxWidth, value)
    });
  }

  function updateFlexPadding(side: 'top' | 'right' | 'bottom' | 'left', value: number): void {
    const currentPadding =
      typeof flexPadding === 'object' ? flexPadding : { top: 16, right: 16, bottom: 16, left: 16 };
    updateConfig({
      flexPadding: setResponsiveValue(config.flexPadding, {
        ...currentPadding,
        [side]: value
      })
    });
  }

  function updateFlexMargin(side: 'top' | 'right' | 'bottom' | 'left', value: number): void {
    const currentMargin =
      typeof flexMargin === 'object' ? flexMargin : { top: 0, right: 0, bottom: 0, left: 0 };
    updateConfig({
      flexMargin: setResponsiveValue(config.flexMargin, {
        ...currentMargin,
        [side]: value
      })
    });
  }

  // Border update functions
  function updateFlexBorderColor(value: string): void {
    updateConfig({ flexBorderColor: value });
  }

  function updateFlexBorderWidth(value: string): void {
    const numValue = parseInt(value, 10);
    updateConfig({ flexBorderWidth: isNaN(numValue) ? 0 : numValue });
  }

  function updateFlexBorderStyle(value: string): void {
    updateConfig({ flexBorderStyle: value });
  }

  function updateFlexBorderRadius(value: string | number): void {
    const numValue = typeof value === 'number' ? value : parseInt(value, 10);
    updateConfig({ flexBorderRadius: isNaN(numValue) ? 0 : numValue });
  }
</script>

<div class="flex-editor">
  <!-- Which breakpoint edits write to (switch it from the toolbar). Fields
       edited on tablet/mobile become overrides; unset ones inherit desktop. -->
  <div class="bp-context">
    <span class="bp-context-label">Editing</span>
    <span class="bp-context-value">{currentBreakpoint}</span>
    <span class="bp-context-hint">
      {currentBreakpoint === 'desktop'
        ? '· base'
        : `· inherits from ${currentBreakpoint === 'mobile' ? 'tablet → desktop' : 'desktop'}`}
    </span>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Quick Presets</h4>
    <div class="presets-grid">
      {#each flexPresets as preset}
        <button
          type="button"
          class="preset-btn"
          on:click={() => applyPreset(preset)}
          title={preset.name}
        >
          <span class="preset-icon">{preset.icon}</span>
          <span class="preset-name">{preset.name}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="editor-section">
    <h4 class="section-title">
      Flex Direction
      <BreakpointFieldBadge
        value={config.flexDirection}
        breakpoint={currentBreakpoint}
        on:reset={() => resetField('flexDirection')}
      />
    </h4>
    <div class="control-group">
      <select
        class="control-select"
        value={flexDirection}
        on:change={(e) => updateFlexDirection(e.currentTarget.value)}
      >
        <option value="row">Row →</option>
        <option value="column">Column ↓</option>
        <option value="row-reverse">Row Reverse ←</option>
        <option value="column-reverse">Column Reverse ↑</option>
      </select>
    </div>
    <p class="control-hint">Direction items flow in the container</p>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Flex Wrap</h4>
    <div class="control-group">
      <select
        class="control-select"
        value={flexWrap}
        on:change={(e) => updateFlexWrap(e.currentTarget.value)}
      >
        <option value="nowrap">No Wrap (single line)</option>
        <option value="wrap">Wrap (multi-line)</option>
        <option value="wrap-reverse">Wrap Reverse</option>
      </select>
    </div>
    <p class="control-hint">Whether items wrap to multiple lines</p>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Justify Content (Main Axis)</h4>
    <div class="visual-controls">
      {#each ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] as option}
        <button
          type="button"
          class="visual-btn"
          class:active={flexJustifyContent === option}
          on:click={() => updateFlexJustifyContent(option)}
          title={option}
        >
          <div class="visual-preview justify-{option}">
            <div class="visual-item"></div>
            <div class="visual-item"></div>
            <div class="visual-item"></div>
          </div>
          <span class="visual-label">{option.replace('flex-', '').replace('-', ' ')}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Align Items (Cross Axis)</h4>
    <div class="visual-controls">
      {#each ['flex-start', 'center', 'flex-end', 'stretch', 'baseline'] as option}
        <button
          type="button"
          class="visual-btn"
          class:active={flexAlignItems === option}
          on:click={() => updateFlexAlignItems(option)}
          title={option}
        >
          <div class="visual-preview align-{option}">
            <div class="visual-item small"></div>
            <div class="visual-item"></div>
            <div class="visual-item large"></div>
          </div>
          <span class="visual-label">{option.replace('flex-', '').replace('-', ' ')}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Align Content (Multi-line)</h4>
    <div class="control-group">
      <select
        class="control-select"
        value={flexAlignContent}
        on:change={(e) => updateFlexAlignContent(e.currentTarget.value)}
      >
        <option value="flex-start">Start</option>
        <option value="center">Center</option>
        <option value="flex-end">End</option>
        <option value="stretch">Stretch</option>
        <option value="space-between">Space Between</option>
        <option value="space-around">Space Around</option>
      </select>
    </div>
    <p class="control-hint">Alignment of wrapped lines</p>
  </div>

  <div class="editor-section">
    <h4 class="section-title">
      Gap
      <BreakpointFieldBadge
        value={config.flexGap}
        breakpoint={currentBreakpoint}
        on:reset={() => resetField('flexGap')}
      />
    </h4>
    <div class="control-group">
      <label class="control-label">
        <span>All ({flexGap}px)</span>
        <input
          type="range"
          min="0"
          max="100"
          step="4"
          value={flexGap}
          on:input={(e) => updateFlexGap(Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
      <TokenScalePicker scale={SPACE_SCALE} value={flexGap} onPick={updateFlexGap} />
    </div>
    <div class="control-group">
      <label class="control-label">
        <span>Horizontal ({flexGapX}px)</span>
        <input
          type="range"
          min="0"
          max="100"
          step="4"
          value={flexGapX}
          on:input={(e) => updateFlexGapX(Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
    </div>
    <div class="control-group">
      <label class="control-label">
        <span>Vertical ({flexGapY}px)</span>
        <input
          type="range"
          min="0"
          max="100"
          step="4"
          value={flexGapY}
          on:input={(e) => updateFlexGapY(Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
    </div>
    <p class="control-hint">Space between flex items</p>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Size</h4>
    <div class="control-group">
      <label class="control-label">
        <span>Width</span>
        <input
          type="text"
          class="control-input"
          value={flexWidth}
          on:input={(e) => updateFlexWidth(e.currentTarget.value)}
          placeholder="100%, auto, 500px"
        />
      </label>
    </div>
    <div class="control-group">
      <label class="control-label">
        <span>Height</span>
        <input
          type="text"
          class="control-input"
          value={flexHeight}
          on:input={(e) => updateFlexHeight(e.currentTarget.value)}
          placeholder="auto, 100%, 500px"
        />
      </label>
    </div>
    <div class="control-group">
      <label class="control-label">
        <span>Min Height</span>
        <input
          type="text"
          class="control-input"
          value={flexMinHeight}
          on:input={(e) => updateFlexMinHeight(e.currentTarget.value)}
          placeholder="auto, 300px, 50vh"
        />
      </label>
    </div>
    <div class="control-group">
      <label class="control-label">
        <span>Max Width</span>
        <input
          type="text"
          class="control-input"
          value={flexMaxWidth}
          on:input={(e) => updateFlexMaxWidth(e.currentTarget.value)}
          placeholder="none, 1200px, 80vw"
        />
      </label>
    </div>
    <p class="control-hint">Container dimensions (supports px, %, rem, vh, vw)</p>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Padding</h4>
    <div class="spacing-grid">
      <label class="control-label">
        <span>Top ({flexPadding.top}px)</span>
        <input
          type="range"
          min="0"
          max="100"
          step="4"
          value={flexPadding.top}
          on:input={(e) => updateFlexPadding('top', Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
      <label class="control-label">
        <span>Right ({flexPadding.right}px)</span>
        <input
          type="range"
          min="0"
          max="100"
          step="4"
          value={flexPadding.right}
          on:input={(e) => updateFlexPadding('right', Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
      <label class="control-label">
        <span>Bottom ({flexPadding.bottom}px)</span>
        <input
          type="range"
          min="0"
          max="100"
          step="4"
          value={flexPadding.bottom}
          on:input={(e) => updateFlexPadding('bottom', Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
      <label class="control-label">
        <span>Left ({flexPadding.left}px)</span>
        <input
          type="range"
          min="0"
          max="100"
          step="4"
          value={flexPadding.left}
          on:input={(e) => updateFlexPadding('left', Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
    </div>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Margin</h4>
    <div class="spacing-grid">
      <label class="control-label">
        <span>Top ({flexMargin.top}px)</span>
        <input
          type="range"
          min="-50"
          max="100"
          step="4"
          value={flexMargin.top}
          on:input={(e) => updateFlexMargin('top', Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
      <label class="control-label">
        <span>Right ({flexMargin.right}px)</span>
        <input
          type="range"
          min="-50"
          max="100"
          step="4"
          value={flexMargin.right}
          on:input={(e) => updateFlexMargin('right', Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
      <label class="control-label">
        <span>Bottom ({flexMargin.bottom}px)</span>
        <input
          type="range"
          min="-50"
          max="100"
          step="4"
          value={flexMargin.bottom}
          on:input={(e) => updateFlexMargin('bottom', Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
      <label class="control-label">
        <span>Left ({flexMargin.left}px)</span>
        <input
          type="range"
          min="-50"
          max="100"
          step="4"
          value={flexMargin.left}
          on:input={(e) => updateFlexMargin('left', Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
    </div>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Border</h4>
    <div class="form-group">
      <ThemeColorInput
        value={typeof config.flexBorderColor === 'string' ? config.flexBorderColor : ''}
        currentTheme={colorTheme}
        {themeColors}
        label="Border Color"
        defaultValue=""
        onChange={(newValue) => {
          updateFlexBorderColor(typeof newValue === 'string' ? newValue : '');
        }}
      />
    </div>
    <div class="form-row">
      <div class="form-group half">
        <label class="control-label-text" for="flex-border-width">Border Width (px)</label>
        <input
          id="flex-border-width"
          type="number"
          value={config.flexBorderWidth ?? 0}
          on:input={(e) => updateFlexBorderWidth(e.currentTarget.value)}
          min="0"
          placeholder="0"
          class="control-input"
        />
      </div>
      <div class="form-group half">
        <label class="control-label-text" for="flex-border-style">Border Style</label>
        <select
          id="flex-border-style"
          value={config.flexBorderStyle ?? 'solid'}
          on:change={(e) => updateFlexBorderStyle(e.currentTarget.value)}
          class="control-select"
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
          <option value="double">Double</option>
          <option value="none">None</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="control-label-text" for="flex-border-radius">Border Radius (px)</label>
      <input
        id="flex-border-radius"
        type="number"
        value={config.flexBorderRadius ?? 0}
        on:input={(e) => updateFlexBorderRadius(Number(e.currentTarget.value))}
        min="0"
        placeholder="0"
        class="control-input"
      />
      <div class="quick-radius">
        <button type="button" class="quick-btn" on:click={() => updateFlexBorderRadius(0)}>
          0
        </button>
        <button type="button" class="quick-btn" on:click={() => updateFlexBorderRadius(4)}>
          4
        </button>
        <button type="button" class="quick-btn" on:click={() => updateFlexBorderRadius(8)}>
          8
        </button>
        <button type="button" class="quick-btn" on:click={() => updateFlexBorderRadius(16)}>
          16
        </button>
        <button type="button" class="quick-btn" on:click={() => updateFlexBorderRadius(9999)}>
          Full
        </button>
      </div>
    </div>
  </div>

  <div class="breakpoint-indicator">
    <span class="indicator-icon">
      {#if currentBreakpoint === 'mobile'}
        📱
      {:else if currentBreakpoint === 'tablet'}
        📱💻
      {:else}
        🖥️
      {/if}
    </span>
    <span class="indicator-text">Editing: {currentBreakpoint}</span>
  </div>
</div>

<style>
  .flex-editor {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem;
  }

  .editor-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .bp-context {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: 6px;
    font-size: 11px;
    color: var(--color-text-secondary);
  }

  .bp-context-value {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-primary);
  }

  .bp-context-hint {
    opacity: 0.85;
  }

  .presets-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .preset-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-btn:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-primary);
  }

  .preset-icon {
    font-size: 1.5rem;
  }

  .preset-name {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    text-align: center;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .control-select {
    width: 100%;
    padding: 0.5rem;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--color-text-primary);
  }

  .control-hint {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    margin: 0;
  }

  .visual-controls {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .visual-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border-secondary);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .visual-btn:hover {
    border-color: var(--color-primary-light);
  }

  .visual-btn.active {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .visual-preview {
    width: 100%;
    height: 40px;
    background: var(--color-bg-tertiary);
    border-radius: 0.25rem;
    display: flex;
    padding: 0.25rem;
  }

  .visual-preview.justify-flex-start {
    justify-content: flex-start;
  }

  .visual-preview.justify-center {
    justify-content: center;
  }

  .visual-preview.justify-flex-end {
    justify-content: flex-end;
  }

  .visual-preview.justify-space-between {
    justify-content: space-between;
  }

  .visual-preview.justify-space-around {
    justify-content: space-around;
  }

  .visual-preview.justify-space-evenly {
    justify-content: space-evenly;
  }

  .visual-preview.align-flex-start {
    align-items: flex-start;
  }

  .visual-preview.align-center {
    align-items: center;
  }

  .visual-preview.align-flex-end {
    align-items: flex-end;
  }

  .visual-preview.align-stretch {
    align-items: stretch;
  }

  .visual-preview.align-baseline {
    align-items: baseline;
  }

  .visual-item {
    width: 8px;
    height: 16px;
    background: var(--color-primary);
    border-radius: 2px;
  }

  .visual-item.small {
    height: 12px;
  }

  .visual-item.large {
    height: 20px;
  }

  .visual-preview.align-stretch .visual-item {
    height: 100%;
  }

  .visual-label {
    font-size: 0.625rem;
    color: var(--color-text-secondary);
    text-align: center;
    line-height: 1.2;
  }

  .control-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .control-input {
    width: 100%;
    padding: 0.5rem;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--color-text-primary);
  }

  .control-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .control-select {
    width: 100%;
    padding: 0.5rem;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .control-select:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .control-label-text {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 0.25rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .form-row {
    display: flex;
    gap: 0.75rem;
  }

  .form-group.half {
    flex: 1;
  }

  .quick-radius {
    display: flex;
    gap: 0.375rem;
    margin-top: 0.5rem;
  }

  .quick-btn {
    flex: 1;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 0.25rem;
    background: var(--color-bg-secondary);
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .quick-btn:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .control-range {
    width: 100%;
  }

  .spacing-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .breakpoint-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--color-info-light);
    border-left: 3px solid var(--color-info);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--color-text-primary);
  }

  .indicator-icon {
    font-size: 1.25rem;
  }

  .indicator-text {
    font-weight: 500;
  }
</style>
