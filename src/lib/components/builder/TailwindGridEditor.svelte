<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WidgetConfig, Breakpoint, ResponsiveValue } from '$lib/types/pages';

  export let config: WidgetConfig;
  export let currentBreakpoint: Breakpoint = 'desktop';

  const dispatch = createEventDispatcher<{ update: WidgetConfig }>();

  // Grid presets for common layouts
  const gridPresets = [
    {
      name: '2 Columns',
      icon: '▯▯',
      config: {
        gridColumns: { desktop: 2, tablet: 2, mobile: 1 },
        gridGap: { desktop: 16 }
      }
    },
    {
      name: '3 Columns',
      icon: '▯▯▯',
      config: {
        gridColumns: { desktop: 3, tablet: 2, mobile: 1 },
        gridGap: { desktop: 16 }
      }
    },
    {
      name: '4 Columns',
      icon: '▯▯▯▯',
      config: {
        gridColumns: { desktop: 4, tablet: 2, mobile: 1 },
        gridGap: { desktop: 16 }
      }
    },
    {
      name: 'Sidebar Left',
      icon: '▮▯▯',
      config: {
        gridColumns: { desktop: '200px 1fr 1fr', tablet: '1fr', mobile: '1fr' },
        gridGap: { desktop: 16 }
      }
    },
    {
      name: 'Sidebar Right',
      icon: '▯▯▮',
      config: {
        gridColumns: { desktop: '1fr 1fr 200px', tablet: '1fr', mobile: '1fr' },
        gridGap: { desktop: 16 }
      }
    },
    {
      name: 'Holy Grail',
      icon: '▮▯▮',
      config: {
        gridColumns: { desktop: '200px 1fr 200px', tablet: '1fr', mobile: '1fr' },
        gridGap: { desktop: 16 }
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

  // Helper to set responsive value
  function setResponsiveValue<T>(
    current: ResponsiveValue<T> | undefined,
    newValue: T
  ): ResponsiveValue<T> {
    if (!current || typeof current !== 'object') {
      return { desktop: newValue, tablet: newValue, mobile: newValue };
    }
    return { ...current, [currentBreakpoint]: newValue };
  }

  // Current values
  $: gridColumns = getResponsiveValue(config.gridColumns, 3);
  $: gridRows = getResponsiveValue(config.gridRows, 'auto');
  $: gridAutoFlow = getResponsiveValue(config.gridAutoFlow, 'row');
  $: gridAutoColumns = getResponsiveValue(config.gridAutoColumns, 'auto');
  $: gridAutoRows = getResponsiveValue(config.gridAutoRows, 'auto');
  $: gridColumnGap = getResponsiveValue(config.gridColumnGap, 16);
  $: gridRowGap = getResponsiveValue(config.gridRowGap, 16);
  $: gridJustifyItems = getResponsiveValue(config.gridJustifyItems, 'stretch');
  $: gridAlignItems = getResponsiveValue(config.gridAlignItems, 'stretch');
  $: gridJustifyContent = getResponsiveValue(config.gridJustifyContent, 'start');
  $: gridAlignContent = getResponsiveValue(config.gridAlignContent, 'start');

  // Parse gridColumns to determine if it's a number or template
  $: isColumnTemplate = typeof gridColumns === 'string';
  $: columnCount = isColumnTemplate ? gridColumns : Number(gridColumns);

  function updateConfig(updates: Partial<WidgetConfig>): void {
    dispatch('update', { ...config, ...updates });
  }

  function applyPreset(preset: (typeof gridPresets)[0]): void {
    updateConfig(preset.config);
  }

  function updateGridColumns(value: number | string): void {
    updateConfig({
      gridColumns: setResponsiveValue(config.gridColumns, value)
    });
  }

  function updateGridRows(value: number | string): void {
    updateConfig({
      gridRows: setResponsiveValue(config.gridRows, value)
    });
  }

  function updateGridAutoFlow(value: string): void {
    updateConfig({
      gridAutoFlow: setResponsiveValue(
        config.gridAutoFlow,
        value as 'row' | 'column' | 'dense' | 'row dense' | 'column dense'
      )
    });
  }

  function updateGridAutoColumns(value: string): void {
    updateConfig({
      gridAutoColumns: setResponsiveValue(config.gridAutoColumns, value)
    });
  }

  function updateGridAutoRows(value: string): void {
    updateConfig({
      gridAutoRows: setResponsiveValue(config.gridAutoRows, value)
    });
  }

  function updateGridColumnGap(value: number): void {
    updateConfig({
      gridColumnGap: setResponsiveValue(config.gridColumnGap, value)
    });
  }

  function updateGridRowGap(value: number): void {
    updateConfig({
      gridRowGap: setResponsiveValue(config.gridRowGap, value)
    });
  }

  function updateGridJustifyItems(value: string): void {
    updateConfig({
      gridJustifyItems: setResponsiveValue(
        config.gridJustifyItems,
        value as 'start' | 'center' | 'end' | 'stretch'
      )
    });
  }

  function updateGridAlignItems(value: string): void {
    updateConfig({
      gridAlignItems: setResponsiveValue(
        config.gridAlignItems,
        value as 'start' | 'center' | 'end' | 'stretch'
      )
    });
  }

  function updateGridJustifyContent(value: string): void {
    updateConfig({
      gridJustifyContent: setResponsiveValue(
        config.gridJustifyContent,
        value as
          'start' | 'center' | 'end' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'
      )
    });
  }

  function updateGridAlignContent(value: string): void {
    updateConfig({
      gridAlignContent: setResponsiveValue(
        config.gridAlignContent,
        value as
          'start' | 'center' | 'end' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'
      )
    });
  }

  // Toggle between template and column count
  function toggleColumnMode(): void {
    if (isColumnTemplate) {
      // Convert to number
      updateGridColumns(3);
    } else {
      // Convert to template
      updateGridColumns(`repeat(${columnCount}, 1fr)`);
    }
  }
</script>

<div class="grid-editor">
  <div class="editor-section">
    <h4 class="section-title">Quick Presets</h4>
    <div class="presets-grid">
      {#each gridPresets as preset}
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
    <h4 class="section-title">Grid Template Columns</h4>
    <div class="control-group">
      <div class="mode-toggle">
        <button
          type="button"
          class="mode-btn"
          class:active={!isColumnTemplate}
          on:click={toggleColumnMode}
        >
          Count
        </button>
        <button
          type="button"
          class="mode-btn"
          class:active={isColumnTemplate}
          on:click={toggleColumnMode}
        >
          Template
        </button>
      </div>

      {#if isColumnTemplate}
        <input
          type="text"
          class="control-input"
          value={columnCount}
          on:input={(e) => updateGridColumns(e.currentTarget.value)}
          placeholder="e.g., 1fr 2fr 1fr or repeat(3, 1fr)"
        />
        <p class="control-hint">CSS Grid template (e.g., "1fr 2fr 1fr", "200px 1fr")</p>
      {:else}
        <div class="slider-control">
          <input
            type="range"
            min="1"
            max="12"
            step="1"
            value={columnCount}
            on:input={(e) => updateGridColumns(Number(e.currentTarget.value))}
            class="control-range"
          />
          <span class="slider-value">{columnCount} columns</span>
        </div>
      {/if}
    </div>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Grid Template Rows</h4>
    <div class="control-group">
      <input
        type="text"
        class="control-input"
        value={gridRows}
        on:input={(e) => updateGridRows(e.currentTarget.value || 'auto')}
        placeholder="auto or repeat(3, 100px)"
      />
      <p class="control-hint">CSS Grid row template (default: auto)</p>
    </div>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Grid Auto Flow</h4>
    <div class="control-group">
      <select
        class="control-select"
        value={gridAutoFlow}
        on:change={(e) => updateGridAutoFlow(e.currentTarget.value)}
      >
        <option value="row">Row (horizontal)</option>
        <option value="column">Column (vertical)</option>
        <option value="dense">Dense (fill gaps)</option>
        <option value="row dense">Row Dense</option>
        <option value="column dense">Column Dense</option>
      </select>
    </div>
    <p class="control-hint">How auto-placed items flow</p>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Grid Auto Sizing</h4>
    <div class="control-group">
      <label class="control-label">
        <span>Auto Columns</span>
        <input
          type="text"
          class="control-input"
          value={gridAutoColumns}
          on:input={(e) => updateGridAutoColumns(e.currentTarget.value || 'auto')}
          placeholder="auto, min-content, 1fr, 200px"
        />
      </label>
      <p class="control-hint">Size of auto-generated columns</p>
    </div>
    <div class="control-group">
      <label class="control-label">
        <span>Auto Rows</span>
        <input
          type="text"
          class="control-input"
          value={gridAutoRows}
          on:input={(e) => updateGridAutoRows(e.currentTarget.value || 'auto')}
          placeholder="auto, min-content, 100px"
        />
      </label>
      <p class="control-hint">Size of auto-generated rows</p>
    </div>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Gap</h4>
    <div class="control-group">
      <label class="control-label">
        <span>Column Gap ({gridColumnGap}px)</span>
        <input
          type="range"
          min="0"
          max="100"
          step="4"
          value={gridColumnGap}
          on:input={(e) => updateGridColumnGap(Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
    </div>
    <div class="control-group">
      <label class="control-label">
        <span>Row Gap ({gridRowGap}px)</span>
        <input
          type="range"
          min="0"
          max="100"
          step="4"
          value={gridRowGap}
          on:input={(e) => updateGridRowGap(Number(e.currentTarget.value))}
          class="control-range"
        />
      </label>
    </div>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Justify Items (Horizontal)</h4>
    <div class="visual-controls">
      {#each ['start', 'center', 'end', 'stretch'] as option}
        <button
          type="button"
          class="visual-btn"
          class:active={gridJustifyItems === option}
          on:click={() => updateGridJustifyItems(option)}
          title={option}
        >
          <div class="grid-visual justify-items-{option}">
            <div class="grid-item"></div>
          </div>
          <span class="visual-label">{option}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Align Items (Vertical)</h4>
    <div class="visual-controls">
      {#each ['start', 'center', 'end', 'stretch'] as option}
        <button
          type="button"
          class="visual-btn"
          class:active={gridAlignItems === option}
          on:click={() => updateGridAlignItems(option)}
          title={option}
        >
          <div class="grid-visual align-items-{option}">
            <div class="grid-item"></div>
          </div>
          <span class="visual-label">{option}</span>
        </button>
      {/each}
    </div>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Justify Content</h4>
    <div class="control-group">
      <select
        class="control-select"
        value={gridJustifyContent}
        on:change={(e) => updateGridJustifyContent(e.currentTarget.value)}
      >
        <option value="start">Start</option>
        <option value="center">Center</option>
        <option value="end">End</option>
        <option value="stretch">Stretch</option>
        <option value="space-between">Space Between</option>
        <option value="space-around">Space Around</option>
        <option value="space-evenly">Space Evenly</option>
      </select>
    </div>
    <p class="control-hint">Alignment of grid within container (horizontal)</p>
  </div>

  <div class="editor-section">
    <h4 class="section-title">Align Content</h4>
    <div class="control-group">
      <select
        class="control-select"
        value={gridAlignContent}
        on:change={(e) => updateGridAlignContent(e.currentTarget.value)}
      >
        <option value="start">Start</option>
        <option value="center">Center</option>
        <option value="end">End</option>
        <option value="stretch">Stretch</option>
        <option value="space-between">Space Between</option>
        <option value="space-around">Space Around</option>
        <option value="space-evenly">Space Evenly</option>
      </select>
    </div>
    <p class="control-hint">Alignment of grid within container (vertical)</p>
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
  .grid-editor {
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
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
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

  .mode-toggle {
    display: flex;
    gap: 0;
    border: 1px solid var(--color-border-secondary);
    border-radius: 0.375rem;
    overflow: hidden;
  }

  .mode-btn {
    flex: 1;
    padding: 0.5rem;
    background: var(--color-bg-secondary);
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .mode-btn:not(:last-child) {
    border-right: 1px solid var(--color-border-secondary);
  }

  .mode-btn.active {
    background: var(--color-primary);
    color: white;
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

  .slider-control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .control-range {
    flex: 1;
  }

  .slider-value {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    min-width: 80px;
    text-align: right;
  }

  .visual-controls {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
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

  .grid-visual {
    width: 100%;
    height: 40px;
    background: var(--color-bg-tertiary);
    border-radius: 0.25rem;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    padding: 0.25rem;
  }

  .grid-item {
    background: var(--color-primary);
    border-radius: 2px;
  }

  .grid-visual.justify-items-start .grid-item {
    justify-self: start;
    width: 50%;
  }

  .grid-visual.justify-items-center .grid-item {
    justify-self: center;
    width: 50%;
  }

  .grid-visual.justify-items-end .grid-item {
    justify-self: end;
    width: 50%;
  }

  .grid-visual.justify-items-stretch .grid-item {
    justify-self: stretch;
  }

  .grid-visual.align-items-start .grid-item {
    align-self: start;
    height: 50%;
  }

  .grid-visual.align-items-center .grid-item {
    align-self: center;
    height: 50%;
  }

  .grid-visual.align-items-end .grid-item {
    align-self: end;
    height: 50%;
  }

  .grid-visual.align-items-stretch .grid-item {
    align-self: stretch;
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
