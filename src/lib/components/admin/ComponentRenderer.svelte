<script lang="ts">
  import type {
    PageComponent,
    Breakpoint,
    ComponentConfig,
    ColorTheme,
    ComponentType
  } from '$lib/types/pages';
  import type { SiteContext, UserInfo } from '$lib/utils/templateSubstitution';
  import { substituteTemplate, createUserContext } from '$lib/utils/templateSubstitution';
  import {
    applyThemeColors,
    generateThemeStyles,
    resolveThemeColor
  } from '$lib/utils/editor/colorThemes';
  import { getDefaultConfig } from '$lib/utils/editor/componentDefaults';
  import ContainerDropZone from '$lib/components/builder/ContainerDropZone.svelte';
  // Built-in components - using actual components for WYSIWYG fidelity
  import HeroComponent from '$lib/components/builtin/Hero.svelte';
  import NavBarComponent from '$lib/components/builtin/NavBar.svelte';
  import FooterComponent from '$lib/components/builtin/Footer.svelte';
  import TextComponent from '$lib/components/builtin/Text.svelte';
  import HeadingComponent from '$lib/components/builtin/Heading.svelte';
  import ButtonComponent from '$lib/components/builtin/Button.svelte';
  import IconComponent from '$lib/components/builtin/Icon.svelte';
  import SpacerComponent from '$lib/components/builtin/Spacer.svelte';
  import DividerComponent from '$lib/components/builtin/Divider.svelte';
  import SceneComponent from '$lib/components/builtin/Scene.svelte';
  import PricingComponent from '$lib/components/builtin/Pricing.svelte';

  export let component: PageComponent;
  export let currentBreakpoint: Breakpoint;
  export let colorTheme: ColorTheme = 'default';
  export let onUpdate: ((config: ComponentConfig) => void) | undefined = undefined;
  export let isEditable = false; // Whether we're in edit mode (builder)
  export let siteContext: SiteContext | undefined = undefined; // Site context for template substitution
  export let user: UserInfo | null | undefined = undefined; // User context for template substitution
  // Callback for when a child component is selected (for containers)
  export let onSelectComponent: ((component: PageComponent) => void) | undefined = undefined;

  // Helper to substitute templates if site context is available
  $: userContext = createUserContext(user);
  const sub = (text: string): string =>
    siteContext ? substituteTemplate(text, { site: siteContext, user: userContext }) : text;

  $: themeColors = applyThemeColors(colorTheme, component.config.themeOverrides);

  // Track if a drag is happening over the dropdown
  let isDropdownDragOver = false;
  let dropdownDragCounter = 0; // Counter to handle nested drag events

  // Track if dropdown is expanded (clicked open) in edit mode
  // Defaults to closed for accurate frontend preview
  let isDropdownExpanded = false;

  // Toggle dropdown expanded state when clicking the trigger in edit mode
  function toggleDropdownExpanded(event?: MouseEvent | TouchEvent): void {
    if (isEditable) {
      // Stop propagation to prevent parent click handler from opening properties panel
      event?.stopPropagation();
      isDropdownExpanded = !isDropdownExpanded;
    }
  }

  // Handle drag enter on dropdown container
  function handleDropdownDragEnter(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    dropdownDragCounter++;
    isDropdownDragOver = true;
  }

  // Handle drag over on dropdown container - keeps it open
  function handleDropdownDragOver(e: DragEvent): void {
    e.preventDefault();
    if (!isDropdownDragOver) {
      isDropdownDragOver = true;
    }
  }

  // Handle drag leave on dropdown container
  function handleDropdownDragLeave(e: DragEvent): void {
    // Only close if we're actually leaving the container, not moving between children
    const relatedTarget = e.relatedTarget as Node | null;
    const container = e.currentTarget as HTMLElement;
    if (relatedTarget && container.contains(relatedTarget)) {
      // Moving within the container, don't decrement
      return;
    }
    dropdownDragCounter--;
    if (dropdownDragCounter <= 0) {
      dropdownDragCounter = 0;
      isDropdownDragOver = false;
    }
  }

  // Handle drag end/drop on dropdown container
  function handleDropdownDragEnd(): void {
    dropdownDragCounter = 0;
    isDropdownDragOver = false;
  }

  function getResponsiveValue<T>(value: T | { mobile?: T; tablet?: T; desktop: T }): T {
    if (typeof value === 'object' && value !== null && 'desktop' in value) {
      if (currentBreakpoint === 'mobile' && value.mobile !== undefined) {
        return value.mobile;
      }
      if (currentBreakpoint === 'tablet' && value.tablet !== undefined) {
        return value.tablet;
      }
      return value.desktop;
    }
    return value as T;
  }

  function getBreakpointValue<T>(
    value: T | { mobile?: T; tablet?: T; desktop?: T } | undefined,
    breakpoint: Breakpoint
  ): T | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const responsive = value as { mobile?: T; tablet?: T; desktop?: T };
      return responsive[breakpoint] ?? responsive.desktop ?? undefined;
    }
    return value as T;
  }

  // For featuresLimit, we want to return undefined if the breakpoint isn't explicitly set
  function getResponsiveLimitValue(
    value: { mobile?: number; tablet?: number; desktop?: number } | number | undefined
  ): number | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value !== null) {
      if (currentBreakpoint === 'mobile') {
        return value.mobile;
      }
      if (currentBreakpoint === 'tablet') {
        return value.tablet;
      }
      return value.desktop;
    }
    return undefined;
  }

  // Helper to format grid template columns/rows
  function formatGridTemplate(
    value: string | number | undefined | null,
    defaultValue: string
  ): string {
    if (!value) return defaultValue;

    // Convert to string if it's a number
    const stringValue = String(value);

    // If it's a simple number (like "3"), convert to repeat syntax
    if (/^\d+$/.test(stringValue)) {
      return `repeat(${stringValue}, 1fr)`;
    }

    // If it already contains CSS units or keywords, use as-is
    return stringValue;
  }

  // Recursively find a container by ID in the component tree
  function findContainerInTree(
    components: PageComponent[],
    containerId: string
  ): { container: PageComponent; path: string[] } | null {
    for (const comp of components) {
      if (comp.id === containerId) {
        return { container: comp, path: [comp.id] };
      }
      if (comp.config.children && Array.isArray(comp.config.children)) {
        const found = findContainerInTree(comp.config.children, containerId);
        if (found) {
          return { container: found.container, path: [comp.id, ...found.path] };
        }
      }
    }
    return null;
  }

  // Recursively update a container's children at a given path
  function updateContainerChildren(
    components: PageComponent[],
    containerId: string,
    newChildren: PageComponent[]
  ): PageComponent[] {
    return components.map((comp) => {
      if (comp.id === containerId) {
        return { ...comp, config: { ...comp.config, children: newChildren } };
      }
      if (comp.config.children && Array.isArray(comp.config.children)) {
        return {
          ...comp,
          config: {
            ...comp.config,
            children: updateContainerChildren(comp.config.children, containerId, newChildren)
          }
        };
      }
      return comp;
    });
  }

  // Handle dropping a new component into a container
  function handleContainerDrop(
    event: CustomEvent<{ containerId: string; componentType: string; insertIndex: number }>
  ) {
    const { containerId, componentType: rawComponentType, insertIndex } = event.detail;

    // Determine the actual component type and config
    let actualType: ComponentType;
    let componentConfig: ComponentConfig;

    // Check if this is a custom component reference (format: "component:123")
    if (rawComponentType.startsWith('component:')) {
      const componentId = parseInt(rawComponentType.split(':')[1]);
      actualType = 'component_ref';
      componentConfig = { componentId };
    } else {
      actualType = rawComponentType as ComponentType;
      componentConfig = getDefaultConfig(actualType);
    }

    const newChild: PageComponent = {
      id: `temp-${Date.now()}`,
      type: actualType,
      config: componentConfig,
      position: insertIndex,
      page_id: component.page_id,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    // Check if the drop target is this component directly
    if (containerId === component.id) {
      // Update this component's children directly
      const updatedChildren = [...(component.config.children || [])];
      updatedChildren.splice(insertIndex, 0, newChild);

      // Update positions for all children to match their array index
      const childrenWithUpdatedPositions = updatedChildren.map((child, index) => ({
        ...child,
        position: index
      }));

      console.log('[ContainerDrop] Direct container drop:', {
        containerId,
        insertIndex,
        childrenBefore: (component.config.children || []).map((c: PageComponent) => ({
          id: c.id,
          position: c.position
        })),
        childrenAfter: childrenWithUpdatedPositions.map((c) => ({ id: c.id, position: c.position }))
      });

      if (onUpdate) {
        onUpdate({ ...component.config, children: childrenWithUpdatedPositions });
      } else {
        console.warn('[ContainerDrop] No onUpdate callback available!');
      }
    } else {
      // The drop target is a nested container - find it and update
      const currentChildren = component.config.children || [];
      const found = findContainerInTree(currentChildren, containerId);

      if (found) {
        const targetContainer = found.container;
        const targetChildren = [...(targetContainer.config.children || [])];
        targetChildren.splice(insertIndex, 0, newChild);

        // Update positions for all children to match their array index
        const childrenWithUpdatedPositions = targetChildren.map((child, index) => ({
          ...child,
          position: index
        }));

        // Update the tree with the new children
        const updatedChildren = updateContainerChildren(
          currentChildren,
          containerId,
          childrenWithUpdatedPositions
        );

        if (onUpdate) {
          onUpdate({ ...component.config, children: updatedChildren });
        } else {
          console.warn('[ContainerDrop] No onUpdate callback available!');
        }
      } else {
        console.warn(`[ContainerDrop] Could not find container with id: ${containerId}`);
      }
    }
  }

  // Handle clicking on a child component to select it
  function handleChildClick(event: CustomEvent<{ childId: string }>) {
    const { childId } = event.detail;
    // Find the child component and trigger selection
    const childComponent = (component.config.children || []).find(
      (child: PageComponent) => child.id === childId
    );
    if (childComponent && onSelectComponent) {
      onSelectComponent(childComponent);
    }
  }

  // Handle deleting a child component from a container
  function handleContainerDelete(event: CustomEvent<{ childId: string; index: number }>) {
    const { index } = event.detail;

    // Get the current children and remove the one at the specified index
    const currentChildren = [...(component.config.children || [])];
    currentChildren.splice(index, 1);

    // Update positions for all remaining children
    const childrenWithUpdatedPositions = currentChildren.map((child, idx) => ({
      ...child,
      position: idx
    }));

    if (onUpdate) {
      onUpdate({ ...component.config, children: childrenWithUpdatedPositions });
    }
  }

  // Handle reordering components within a container
  function handleContainerReorder(
    event: CustomEvent<{ containerId: string; fromIndex: number; toIndex: number }>
  ) {
    const { containerId, fromIndex, toIndex } = event.detail;

    // Check if the reorder target is this component directly
    if (containerId === component.id) {
      const updatedChildren = [...(component.config.children || [])];
      const [movedComponent] = updatedChildren.splice(fromIndex, 1);
      updatedChildren.splice(toIndex, 0, movedComponent);

      // Update positions for all children to match their array index
      const childrenWithUpdatedPositions = updatedChildren.map((child, index) => ({
        ...child,
        position: index
      }));

      if (onUpdate) {
        onUpdate({ ...component.config, children: childrenWithUpdatedPositions });
      }
    } else {
      // The reorder target is a nested container - find it and update
      const currentChildren = component.config.children || [];
      const found = findContainerInTree(currentChildren, containerId);

      if (found) {
        const targetContainer = found.container;
        const targetChildren = [...(targetContainer.config.children || [])];
        const [movedComponent] = targetChildren.splice(fromIndex, 1);
        targetChildren.splice(toIndex, 0, movedComponent);

        // Update positions for all children to match their array index
        const childrenWithUpdatedPositions = targetChildren.map((child, index) => ({
          ...child,
          position: index
        }));

        // Update the tree with the new children
        const updatedChildren = updateContainerChildren(
          currentChildren,
          containerId,
          childrenWithUpdatedPositions
        );

        if (onUpdate) {
          onUpdate({ ...component.config, children: updatedChildren });
        }
      } else {
        console.warn(`[ContainerReorder] Could not find container with id: ${containerId}`);
      }
    }
  }

  // Create an onUpdate handler for a nested child component
  // This ensures that updates to nested children are properly propagated up the tree
  function createChildUpdateHandler(childId: string): (config: ComponentConfig) => void {
    const _parentId = component.id;
    const _parentType = component.type;
    const parentOnUpdate = onUpdate;

    return (newChildConfig: ComponentConfig) => {
      if (!parentOnUpdate) {
        console.warn('[createChildUpdateHandler] No onUpdate callback available!');
        return;
      }

      const currentChildren = component.config.children || [];

      const updatedChildren = currentChildren.map((child: PageComponent) =>
        child.id === childId ? { ...child, config: newChildConfig } : child
      );

      parentOnUpdate({ ...component.config, children: updatedChildren });
    };
  }

  function getStyleString(comp: PageComponent): string {
    const styles = comp.config.styles;
    if (!styles) return '';

    let styleStr = '';

    if (styles.padding) {
      const padding = getResponsiveValue(styles.padding);
      if (padding) {
        styleStr += `padding: ${padding.top || 0}px ${padding.right || 0}px ${padding.bottom || 0}px ${padding.left || 0}px;`;
      }
    }

    if (styles.margin) {
      const margin = getResponsiveValue(styles.margin);
      if (margin) {
        styleStr += `margin: ${margin.top || 0}px ${margin.right || 0}px ${margin.bottom || 0}px ${margin.left || 0}px;`;
      }
    }

    if (styles.textAlign) {
      styleStr += `text-align: ${getResponsiveValue(styles.textAlign)};`;
    }

    if (styles.width) {
      styleStr += `width: ${getResponsiveValue(styles.width)};`;
    }

    if (styles.height) {
      styleStr += `height: ${getResponsiveValue(styles.height)};`;
    }

    return styleStr;
  }

  // Generate position styles from config.position
  function getPositionStyleString(comp: PageComponent): string {
    const positionConfig = comp.config.position;
    if (!positionConfig) return '';

    // Handle legacy format where position might be a string
    if (typeof positionConfig === 'string') {
      if (positionConfig === 'static') return '';
      return `position: ${positionConfig};`;
    }

    // Get position values for current breakpoint, falling back to desktop
    const position = positionConfig[currentBreakpoint] || positionConfig.desktop;
    if (!position) return '';

    const posType = position.type;
    if (!posType || posType === 'static') return '';

    const styles: string[] = [`position: ${posType}`];
    if (position.top) styles.push(`top: ${position.top}`);
    if (position.right) styles.push(`right: ${position.right}`);
    if (position.bottom) styles.push(`bottom: ${position.bottom}`);
    if (position.left) styles.push(`left: ${position.left}`);
    if (position.zIndex !== undefined) styles.push(`z-index: ${position.zIndex}`);

    return styles.join('; ') + ';';
  }

  // Generate child layout styles for components inside containers
  function getChildLayoutStyles(childConfig: ComponentConfig): string {
    let styles = '';

    // Flex properties
    const flexGrow = getBreakpointValue(childConfig.layoutFlexGrow, currentBreakpoint);
    const flexShrink = getBreakpointValue(childConfig.layoutFlexShrink, currentBreakpoint);
    const flexBasis = getBreakpointValue(childConfig.layoutFlexBasis, currentBreakpoint);
    const alignSelf = getBreakpointValue(childConfig.layoutAlignSelf, currentBreakpoint);

    if (flexGrow !== undefined) styles += `flex-grow: ${flexGrow};`;
    if (flexShrink !== undefined) styles += `flex-shrink: ${flexShrink};`;
    if (flexBasis !== undefined && flexBasis !== 'auto') styles += `flex-basis: ${flexBasis};`;
    if (alignSelf !== undefined && alignSelf !== 'auto') styles += `align-self: ${alignSelf};`;

    // Grid properties
    const gridColumn = getBreakpointValue(childConfig.layoutGridColumn, currentBreakpoint);
    const gridRow = getBreakpointValue(childConfig.layoutGridRow, currentBreakpoint);
    const placeSelf = getBreakpointValue(childConfig.layoutPlaceSelf, currentBreakpoint);
    const justifySelf = getBreakpointValue(childConfig.layoutJustifySelf, currentBreakpoint);

    if (gridColumn !== undefined && gridColumn !== 'auto') styles += `grid-column: ${gridColumn};`;
    if (gridRow !== undefined && gridRow !== 'auto') styles += `grid-row: ${gridRow};`;
    if (placeSelf !== undefined && placeSelf !== 'auto') styles += `place-self: ${placeSelf};`;
    if (justifySelf !== undefined && justifySelf !== 'stretch')
      styles += `justify-self: ${justifySelf};`;

    // Order (works in both flex and grid)
    const order = getBreakpointValue(childConfig.layoutOrder, currentBreakpoint);
    if (order !== undefined && order !== 0) styles += `order: ${order};`;

    // Size constraints
    const width = getBreakpointValue(childConfig.layoutWidth, currentBreakpoint);
    const height = getBreakpointValue(childConfig.layoutHeight, currentBreakpoint);
    const minWidth = getBreakpointValue(childConfig.layoutMinWidth, currentBreakpoint);
    const maxWidth = getBreakpointValue(childConfig.layoutMaxWidth, currentBreakpoint);
    const minHeight = getBreakpointValue(childConfig.layoutMinHeight, currentBreakpoint);
    const maxHeight = getBreakpointValue(childConfig.layoutMaxHeight, currentBreakpoint);

    if (width !== undefined && width !== 'auto') styles += `width: ${width};`;
    if (height !== undefined && height !== 'auto') styles += `height: ${height};`;
    if (minWidth !== undefined && minWidth !== 'auto') styles += `min-width: ${minWidth};`;
    if (maxWidth !== undefined && maxWidth !== 'none') styles += `max-width: ${maxWidth};`;
    if (minHeight !== undefined && minHeight !== 'auto') styles += `min-height: ${minHeight};`;
    if (maxHeight !== undefined && maxHeight !== 'none') styles += `max-height: ${maxHeight};`;

    return styles;
  }

  // Declare reactive variables
  let styleString: string;
  let positionStyleString: string;
  let _columnsLayout: number;
  let columnsGap: number;
  let columnsCount: number;
  let productListColumns: number;
  let featuresColumns: number;
  let featuresGap: number;
  let featuresLimit: number | undefined;

  // Make all reactive computations depend on both component.config AND currentBreakpoint
  $: {
    // Explicitly read currentBreakpoint to establish reactive dependency
    // This ensures the block re-runs whenever currentBreakpoint changes
    const _bp = currentBreakpoint;

    styleString = getStyleString(component);
    positionStyleString = getPositionStyleString(component);
    const _columnsLayout = getResponsiveValue(component.config.columns || { desktop: 2 });
    columnsGap = getResponsiveValue(component.config.gap || { desktop: 20 });
    columnsCount = getResponsiveValue(component.config.columnCount || { desktop: 2 });
    productListColumns = getResponsiveValue(
      component.config.columns || { desktop: 3, tablet: 2, mobile: 1 }
    );
    featuresColumns = getResponsiveValue(
      component.config.featuresColumns || { desktop: 3, tablet: 2, mobile: 1 }
    );
    featuresGap = getResponsiveValue(
      component.config.featuresGap || { desktop: 32, tablet: 24, mobile: 16 }
    );
    featuresLimit = getResponsiveLimitValue(component.config.featuresLimit);
  }
</script>

<div
  class="widget-renderer"
  style="{positionStyleString} {styleString} {generateThemeStyles(themeColors)}"
>
  {#if component.type === 'text'}
    <TextComponent config={component.config} {colorTheme} {siteContext} {user} />
  {:else if component.type === 'heading'}
    <HeadingComponent config={component.config} {colorTheme} {siteContext} {user} {isEditable} />
  {:else if component.type === 'image'}
    <div class="image-widget">
      {#if component.config.src}
        <img
          src={component.config.src}
          alt={component.config.alt || ''}
          style="width: {component.config.imageWidth || '100%'}; height: {component.config
            .imageHeight || 'auto'}; object-fit: {component.config.objectFit || 'cover'};"
        />
      {:else}
        <div class="image-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" stroke-width="2" stroke-linecap="round" />
          </svg>
          <span>No image selected</span>
        </div>
      {/if}
    </div>
  {:else if component.type === 'icon'}
    <IconComponent config={component.config} {colorTheme} />
  {:else if component.type === 'hero'}
    <!-- 
      Hero Component - Uses actual built-in component for WYSIWYG fidelity
      The Hero component handles both container-based (new) and legacy formats
      In edit mode (isEditable=true), it enables inline editing and drag-drop
    -->
    <HeroComponent
      config={component.config}
      {colorTheme}
      {siteContext}
      {user}
      {isEditable}
      {onUpdate}
      {onSelectComponent}
      {currentBreakpoint}
      componentId={component.id}
      pageId={component.page_id}
    >
      <svelte:fragment slot="child" let:child>
        <svelte:self
          component={child}
          {currentBreakpoint}
          {colorTheme}
          onUpdate={createChildUpdateHandler(child.id)}
          {isEditable}
          {siteContext}
          {user}
          {onSelectComponent}
        />
      </svelte:fragment>
    </HeroComponent>
  {:else if component.type === 'button'}
    <ButtonComponent config={component.config} {colorTheme} {siteContext} {user} {isEditable} />
  {:else if component.type === 'dropdown'}
    {@const triggerLabel = component.config.triggerLabel || component.config.label || 'Menu'}
    {@const triggerIcon = component.config.triggerIcon || ''}
    {@const showChevron = component.config.showChevron !== false}
    {@const triggerVariant = component.config.triggerVariant || 'text'}
    {@const menuWidth = component.config.menuWidth || '200px'}
    {@const menuAlign = component.config.menuAlign || 'left'}
    {@const menuBackground = component.config.menuBackground || 'var(--color-bg-primary)'}
    {@const menuBorderRadius = component.config.menuBorderRadius || 8}
    {@const menuPadding = component.config.menuPadding || { top: 8, right: 8, bottom: 8, left: 8 }}
    {@const dropdownChildren = component.config.children || []}
    <div
      class="dropdown-widget-container"
      class:drag-over={isDropdownDragOver}
      class:edit-mode={isEditable}
      role="region"
      aria-label="Dropdown component drop zone"
      on:dragenter={handleDropdownDragEnter}
      on:dragover={handleDropdownDragOver}
      on:dragleave={handleDropdownDragLeave}
      on:dragend={handleDropdownDragEnd}
      on:drop={handleDropdownDragEnd}
    >
      <!-- Trigger preview - clickable in edit mode to toggle dropdown -->
      <button
        type="button"
        class="dropdown-trigger-preview variant-{triggerVariant}"
        class:expanded={isDropdownExpanded}
        on:click={(e) => toggleDropdownExpanded(e)}
        on:touchend|stopPropagation={(e) => {
          e.preventDefault();
          toggleDropdownExpanded(e);
        }}
        aria-expanded={isDropdownExpanded}
        aria-haspopup="true"
      >
        {#if triggerIcon}
          <span class="trigger-icon">
            {#if triggerIcon === 'user'}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle
                  cx="12"
                  cy="7"
                  r="4"
                /></svg
              >
            {:else}
              {triggerIcon}
            {/if}
          </span>
        {/if}
        {#if triggerVariant !== 'icon'}
          <span class="trigger-label">{sub(triggerLabel)}</span>
        {/if}
        {#if showChevron}
          <span class="trigger-chevron" class:rotated={isDropdownExpanded}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg
            >
          </span>
        {/if}
      </button>
      <!-- Menu container: visible when expanded in edit mode or when dragging over -->
      {#if (isEditable && isDropdownExpanded) || isDropdownDragOver}
        <div
          class="dropdown-menu-preview align-{menuAlign}"
          class:drag-target={isDropdownDragOver}
          style="
            min-width: {typeof menuWidth === 'number' ? `${menuWidth}px` : menuWidth};
            background: {menuBackground};
            border-radius: {menuBorderRadius}px;
            padding: {menuPadding.top}px {menuPadding.right}px {menuPadding.bottom}px {menuPadding.left}px;
          "
        >
          {#if isEditable}
            <ContainerDropZone
              containerId={component.id}
              children={dropdownChildren}
              isActive={false}
              allowedTypes={['button', 'text', 'heading', 'divider', 'image']}
              displayMode="flex"
              showLayoutHints={true}
              label="Dropdown Menu"
              containerStyles="flex-direction: column; gap: 4px;"
              on:drop={handleContainerDrop}
              on:reorder={handleContainerReorder}
              on:childClick={handleChildClick}
              on:delete={handleContainerDelete}
            >
              <svelte:fragment slot="child" let:child>
                <div class="dropdown-item-wrapper">
                  <svelte:self
                    component={child}
                    {currentBreakpoint}
                    {colorTheme}
                    onUpdate={createChildUpdateHandler(child.id)}
                    {isEditable}
                    {siteContext}
                    {user}
                    {onSelectComponent}
                  />
                </div>
              </svelte:fragment>
            </ContainerDropZone>
          {:else if dropdownChildren.length > 0}
            {#each dropdownChildren as child}
              <div class="dropdown-item">
                <svelte:self
                  component={child}
                  {currentBreakpoint}
                  {colorTheme}
                  onUpdate={createChildUpdateHandler(child.id)}
                  {isEditable}
                  {siteContext}
                  {user}
                  {onSelectComponent}
                />
              </div>
            {/each}
          {:else}
            <div class="dropdown-placeholder">
              <p>📋 Drop menu items here</p>
              <span>Buttons, links, text, dividers</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {:else if component.type === 'spacer'}
    <SpacerComponent config={component.config} />
  {:else if component.type === 'scene'}
    <!-- The real component, not a still of it: a backdrop chosen against a
         placeholder rectangle is a backdrop chosen blind. It pauses itself when
         it scrolls out of the canvas, so an unattended builder tab is not
         painting a starfield nobody is looking at. -->
    <SceneComponent config={component.config} {colorTheme} />
  {:else if component.type === 'theme_toggle'}
    {@const toggleSize = component.config.size || 'medium'}
    {@const toggleVariant = component.config.toggleVariant || 'icon'}
    {@const toggleAlignment = component.config.alignment || 'left'}
    {@const alignmentStyle =
      toggleAlignment === 'center'
        ? 'center'
        : toggleAlignment === 'right'
          ? 'flex-end'
          : 'flex-start'}
    {@const iconSize = toggleSize === 'small' ? 16 : toggleSize === 'large' ? 24 : 20}
    <div class="theme-toggle-widget" style="justify-content: {alignmentStyle}">
      <button
        class="theme-toggle theme-toggle-{toggleSize} theme-toggle-{toggleVariant}"
        aria-label="Toggle theme"
        title="Toggle light/dark mode"
        disabled
      >
        <!-- Sun/Moon icon preview -->
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
        {#if toggleVariant === 'icon-label' || toggleVariant === 'button'}
          <span class="theme-toggle-label">Light Mode</span>
        {/if}
      </button>
    </div>
  {:else if component.type === 'divider'}
    <DividerComponent config={component.config} {colorTheme} />
  {:else if component.type === 'columns'}
    <div
      class="columns-widget"
      style="
        display: grid;
        grid-template-columns: repeat({columnsCount}, 1fr);
        gap: {columnsGap}px;
        align-items: {component.config.verticalAlign || 'stretch'};
      "
    >
      {#if component.config.children && component.config.children.length > 0}
        {#each component.config.children as child}
          <div class="column">
            <svelte:self
              component={child}
              {currentBreakpoint}
              {colorTheme}
              {onUpdate}
              {isEditable}
              {siteContext}
              {user}
              {onSelectComponent}
            />
          </div>
        {/each}
      {:else}
        {#each Array(columnsCount) as _, i}
          <div class="column-placeholder">
            <span>Column {i + 1}</span>
          </div>
        {/each}
      {/if}
    </div>
  {:else if component.type === 'single_product'}
    <div class="product-widget layout-{component.config.layout || 'card'}">
      {#if component.config.productId}
        <div class="product-preview">
          <div class="product-image-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
                stroke-width="2"
              />
            </svg>
          </div>
          <div class="product-info">
            <h3>Product #{component.config.productId}</h3>
            {#if component.config.showPrice}
              <p class="product-price">$0.00</p>
            {/if}
            {#if component.config.showDescription}
              <p class="product-description">Product description will appear here</p>
            {/if}
          </div>
        </div>
      {:else}
        <div class="widget-placeholder">
          <span>Select a product to display</span>
        </div>
      {/if}
    </div>
  {:else if component.type === 'product_list'}
    <div
      class="product-list-widget"
      style="
        display: grid;
        grid-template-columns: repeat({productListColumns}, 1fr);
        gap: 1rem;
      "
    >
      {#each Array(Math.min(component.config.limit || 6, 6)) as _, i}
        <div class="product-card">
          <div class="product-image-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
                stroke-width="2"
              />
            </svg>
          </div>
          <h4>Product {i + 1}</h4>
          <p class="product-price">$0.00</p>
        </div>
      {/each}
    </div>
  {:else if component.type === 'features'}
    <!-- Features with container-based architecture (new) or legacy format -->
    {@const featuresChildrenRaw = component.config.children}
    {@const hasFeaturesChildren =
      featuresChildrenRaw && Array.isArray(featuresChildrenRaw) && featuresChildrenRaw.length > 0}
    {@const featuresDisplay =
      getBreakpointValue(component.config.containerDisplay, currentBreakpoint) || 'block'}
    {@const featuresPadding = getBreakpointValue(
      component.config.containerPadding,
      currentBreakpoint
    ) || { top: 0, right: 0, bottom: 0, left: 0 }}
    {@const featuresBackground = component.config.containerBackground || 'transparent'}
    {@const featuresFlexDirection =
      getBreakpointValue(component.config.containerFlexDirection, currentBreakpoint) || 'row'}
    {@const featuresGapValue =
      getBreakpointValue(component.config.containerGap, currentBreakpoint) || 16}
    {@const featuresGridCols = getBreakpointValue(
      component.config.containerGridCols,
      currentBreakpoint
    )}
    {@const featuresAlignItems = component.config.containerAlignItems || 'stretch'}
    {@const featuresJustifyContent = component.config.containerJustifyContent || 'flex-start'}
    {@const featuresWrap = component.config.containerWrap || 'nowrap'}
    {#if hasFeaturesChildren || isEditable}
      <!-- New container-based features with children -->
      <section
        class="features-container-based"
        style="
          background: {resolveThemeColor(featuresBackground, colorTheme, 'transparent', true)};
          max-width: {component.config.containerMaxWidth || '100%'};
          width: 100%;
          box-sizing: border-box;
          padding: {featuresPadding.top || 0}px {featuresPadding.right ||
          0}px {featuresPadding.bottom || 0}px {featuresPadding.left || 0}px;
        "
      >
        {#if isEditable}
          <!-- Use ContainerDropZone for editable features -->
          <ContainerDropZone
            containerId={component.id}
            children={featuresChildrenRaw || []}
            isActive={false}
            allowedTypes={[]}
            displayMode={featuresDisplay === 'grid' ? 'grid' : 'flex'}
            showLayoutHints={true}
            label="Features Section"
            containerStyles={featuresDisplay === 'flex'
              ? `
                display: flex;
                flex-direction: ${featuresFlexDirection};
                justify-content: ${featuresJustifyContent};
                align-items: ${featuresAlignItems};
                flex-wrap: ${featuresWrap};
                gap: ${featuresGapValue}px;
              `
              : featuresDisplay === 'grid'
                ? `
                display: grid;
                grid-template-columns: ${formatGridTemplate(featuresGridCols, 'repeat(3, 1fr)')};
                gap: ${featuresGapValue}px;
              `
                : `
                display: ${featuresDisplay};
              `}
            on:drop={handleContainerDrop}
            on:reorder={handleContainerReorder}
            on:childClick={handleChildClick}
            on:delete={handleContainerDelete}
          >
            <svelte:fragment slot="child" let:child>
              <svelte:self
                component={child}
                {currentBreakpoint}
                {colorTheme}
                onUpdate={createChildUpdateHandler(child.id)}
                {isEditable}
                {siteContext}
                {user}
                {onSelectComponent}
              />
            </svelte:fragment>
          </ContainerDropZone>
        {:else}
          <!-- Non-editable: render children directly -->
          <div
            class="features-content-wrapper"
            style="
              display: {featuresDisplay};
              {featuresDisplay === 'flex'
              ? `
                flex-direction: ${featuresFlexDirection};
                justify-content: ${featuresJustifyContent};
                align-items: ${featuresAlignItems};
                flex-wrap: ${featuresWrap};
              `
              : featuresDisplay === 'grid'
                ? `grid-template-columns: ${formatGridTemplate(featuresGridCols, 'repeat(3, 1fr)')};`
                : ''}
              gap: {featuresGapValue}px;
              padding: {featuresPadding.top || 0}px {featuresPadding.right ||
              0}px {featuresPadding.bottom || 0}px {featuresPadding.left || 0}px;
            "
          >
            {#each featuresChildrenRaw || [] as child (child.id)}
              <svelte:self
                component={child}
                {currentBreakpoint}
                {colorTheme}
                onUpdate={createChildUpdateHandler(child.id)}
                {isEditable}
                {siteContext}
                {user}
                {onSelectComponent}
              />
            {/each}
          </div>
        {/if}
      </section>
    {:else}
      <!-- Legacy features format with config.features array -->
      {@const cardBg = resolveThemeColor(
        component.config.cardBackground,
        colorTheme,
        themeColors.surface,
        true
      )}
      {@const cardBorder = resolveThemeColor(
        component.config.cardBorderColor,
        colorTheme,
        themeColors.border,
        true
      )}
      <div class="features-preview">
        <h3>{sub(component.config.title || 'Features')}</h3>
        {#if component.config.subtitle}
          <p class="features-subtitle">{sub(component.config.subtitle)}</p>
        {/if}
        {#if component.config.features && component.config.features.length > 0}
          <div
            class="features-grid"
            style="grid-template-columns: repeat({featuresColumns}, 1fr); gap: {featuresGap}px;"
          >
            {#each featuresLimit && featuresLimit > 0 ? component.config.features.slice(0, featuresLimit) : component.config.features as feature}
              <div
                class="feature-card"
                style="background: {cardBg}; border: {component.config.cardBorderWidth ??
                  1}px solid {cardBorder}; border-radius: {component.config.cardBorderRadius !==
                undefined
                  ? component.config.cardBorderRadius
                  : 12}px;"
              >
                <div class="feature-icon">{feature.icon}</div>
                <h4>{sub(feature.title)}</h4>
                <p>{sub(feature.description)}</p>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-message">
            No features added yet. Use the properties panel to add features.
          </p>
        {/if}
      </div>
    {/if}
  {:else if component.type === 'pricing'}
    <!-- 
      Pricing Component - Uses Container-based architecture with children
      Similar to Hero, NavBar, and Footer - renders children via slots
    -->
    <PricingComponent
      config={component.config}
      {colorTheme}
      {siteContext}
      {user}
      {isEditable}
      {onUpdate}
      {onSelectComponent}
      {currentBreakpoint}
      componentId={component.id}
      pageId={component.page_id}
    >
      <svelte:fragment slot="child" let:child>
        <svelte:self
          component={child}
          {currentBreakpoint}
          {colorTheme}
          onUpdate={createChildUpdateHandler(child.id)}
          {isEditable}
          {siteContext}
          {user}
          {onSelectComponent}
        />
      </svelte:fragment>
    </PricingComponent>
  {:else if component.type === 'cta'}
    {@const ctaBgColor = resolveThemeColor(
      component.config.backgroundColor,
      colorTheme,
      `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`,
      true
    )}
    <div
      class="cta-preview"
      style="background: {ctaBgColor ||
        `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`};"
    >
      <h3>{sub(component.config.title || 'Call to Action')}</h3>
      {#if component.config.subtitle}
        <p>{sub(component.config.subtitle)}</p>
      {/if}
      <div class="cta-buttons">
        <button class="btn-primary">{sub(component.config.primaryCtaText || 'Get Started')}</button>
        {#if component.config.secondaryCtaText}
          <button class="btn-secondary">{sub(component.config.secondaryCtaText)}</button>
        {/if}
      </div>
    </div>
  {:else if component.type === 'navbar'}
    <!-- Navbar with container-based architecture (new) or legacy format -->
    {@const navChildrenRaw = component.config.children}
    {@const hasNavChildren =
      navChildrenRaw && Array.isArray(navChildrenRaw) && navChildrenRaw.length > 0}
    {@const navDisplay =
      getBreakpointValue(component.config.containerDisplay, currentBreakpoint) || 'flex'}
    {@const navFlexDirection =
      getBreakpointValue(component.config.containerFlexDirection, currentBreakpoint) || 'row'}
    {@const navGap = getBreakpointValue(component.config.containerGap, currentBreakpoint) || 16}
    {@const navPadding = getBreakpointValue(component.config.containerPadding, currentBreakpoint)}
    {@const navBackground =
      component.config.containerBackground || component.config.navbarBackground || 'transparent'}
    {@const rawConfig = component.config}
    {@const isSticky = 'positionType' in rawConfig && rawConfig['positionType'] === 'sticky'}
    {#if hasNavChildren || isEditable}
      <!-- New container-based navbar with children (or editable empty navbar) -->
      <nav
        class="navbar-container-based"
        style="
          background: {resolveThemeColor(navBackground, colorTheme, 'transparent', true)};
          max-width: {component.config.containerMaxWidth || '100%'};
          width: 100%;
          box-sizing: border-box;
          {isSticky ? 'position: sticky; top: 0; z-index: 100;' : ''}
        "
      >
        {#if isEditable}
          <!-- Use ContainerDropZone for editable navbar -->
          <ContainerDropZone
            containerId={component.id}
            children={navChildrenRaw || []}
            isActive={false}
            allowedTypes={[]}
            displayMode={navDisplay === 'grid' ? 'grid' : 'flex'}
            showLayoutHints={true}
            label="Navigation Bar"
            containerStyles="
              flex-direction: {navFlexDirection};
              justify-content: {component.config.containerJustifyContent || 'space-between'};
              align-items: {component.config.containerAlignItems || 'center'};
              flex-wrap: {component.config.containerWrap || 'nowrap'};
              gap: {navGap}px;
              padding: {navPadding
              ? `${navPadding.top || 16}px ${navPadding.right || 24}px ${navPadding.bottom || 16}px ${navPadding.left || 24}px`
              : '16px 24px'};
            "
            on:drop={handleContainerDrop}
            on:reorder={handleContainerReorder}
            on:childClick={handleChildClick}
            on:delete={handleContainerDelete}
          >
            <svelte:fragment slot="child" let:child>
              <svelte:self
                component={child}
                {currentBreakpoint}
                {colorTheme}
                onUpdate={createChildUpdateHandler(child.id)}
                {isEditable}
                {siteContext}
                {user}
                {onSelectComponent}
              />
            </svelte:fragment>
          </ContainerDropZone>
        {:else}
          <!-- Non-editable: render children directly -->
          <!-- Note: Children have their own container configurations (display, flex, etc.) -->
          <!-- The wrapper just provides basic styling; children control their own layout -->
          <div
            class="navbar-content-wrapper"
            style="
              padding: {navPadding
              ? `${navPadding.top || 0}px ${navPadding.right || 0}px ${navPadding.bottom || 0}px ${navPadding.left || 0}px`
              : '0'};
            "
          >
            {#each navChildrenRaw || [] as child (child.id)}
              <svelte:self
                component={child}
                {currentBreakpoint}
                {colorTheme}
                onUpdate={createChildUpdateHandler(child.id)}
                {isEditable}
                {siteContext}
                {user}
                {onSelectComponent}
              />
            {/each}
          </div>
        {/if}
      </nav>
    {:else}
      <!-- Legacy navbar format - using actual NavBar component for WYSIWYG fidelity -->
      <NavBarComponent
        config={component.config}
        {siteContext}
        user={user ?? undefined}
        {isEditable}
      />
    {/if}
  {:else if component.type === 'footer'}
    <!-- Footer with container-based architecture (new) or legacy format -->
    {@const footerChildrenRaw = component.config.children}
    {@const hasFooterChildren =
      footerChildrenRaw && Array.isArray(footerChildrenRaw) && footerChildrenRaw.length > 0}
    {@const footerDisplay =
      getBreakpointValue(component.config.containerDisplay, currentBreakpoint) || 'flex'}
    {@const footerFlexDirection =
      getBreakpointValue(component.config.containerFlexDirection, currentBreakpoint) || 'column'}
    {@const footerGap = getBreakpointValue(component.config.containerGap, currentBreakpoint) || 32}
    {@const footerPadding = getBreakpointValue(
      component.config.containerPadding,
      currentBreakpoint
    )}
    {@const footerBackground =
      component.config.containerBackground || component.config.footerBackground || 'theme:surface'}
    {#if hasFooterChildren || isEditable}
      <!-- New container-based footer with children (or editable empty footer) -->
      <footer
        class="footer-container-based"
        style="
          background: {resolveThemeColor(footerBackground, colorTheme, '#f9fafb', true)};
          max-width: {component.config.containerMaxWidth || '100%'};
          width: 100%;
          box-sizing: border-box;
          border-top: 1px solid {resolveThemeColor(
          component.config.footerBorderColor || 'theme:border',
          colorTheme,
          '#e5e7eb',
          true
        )};
        "
      >
        {#if isEditable}
          <!-- Use ContainerDropZone for editable footer -->
          <ContainerDropZone
            containerId={component.id}
            children={footerChildrenRaw || []}
            isActive={false}
            allowedTypes={[]}
            displayMode={footerDisplay === 'grid' ? 'grid' : 'flex'}
            showLayoutHints={true}
            label="Footer"
            containerStyles="
              flex-direction: {footerFlexDirection};
              justify-content: {component.config.containerJustifyContent || 'center'};
              align-items: {component.config.containerAlignItems || 'stretch'};
              flex-wrap: {component.config.containerWrap || 'wrap'};
              gap: {footerGap}px;
              padding: {footerPadding
              ? `${footerPadding.top || 48}px ${footerPadding.right || 24}px ${footerPadding.bottom || 48}px ${footerPadding.left || 24}px`
              : '48px 24px'};
            "
            on:drop={handleContainerDrop}
            on:reorder={handleContainerReorder}
            on:childClick={handleChildClick}
            on:delete={handleContainerDelete}
          >
            <svelte:fragment slot="child" let:child>
              <svelte:self
                component={child}
                {currentBreakpoint}
                {colorTheme}
                onUpdate={createChildUpdateHandler(child.id)}
                {isEditable}
                {siteContext}
                {user}
                {onSelectComponent}
              />
            </svelte:fragment>
          </ContainerDropZone>
        {:else}
          <!-- Non-editable: render children directly -->
          <div
            class="footer-content-wrapper"
            style="
              display: {footerDisplay};
              flex-direction: {footerFlexDirection};
              justify-content: {component.config.containerJustifyContent || 'center'};
              align-items: {component.config.containerAlignItems || 'stretch'};
              flex-wrap: {component.config.containerWrap || 'wrap'};
              gap: {footerGap}px;
              padding: {footerPadding
              ? `${footerPadding.top || 48}px ${footerPadding.right || 24}px ${footerPadding.bottom || 48}px ${footerPadding.left || 24}px`
              : '48px 24px'};
            "
          >
            {#each footerChildrenRaw || [] as child (child.id)}
              <svelte:self
                component={child}
                {currentBreakpoint}
                {colorTheme}
                onUpdate={createChildUpdateHandler(child.id)}
                {isEditable}
                {siteContext}
                {user}
                {onSelectComponent}
              />
            {/each}
          </div>
        {/if}
      </footer>
    {:else}
      <!-- Legacy footer format - using actual Footer component for WYSIWYG fidelity -->
      <FooterComponent
        config={component.config}
        {siteContext}
        user={user ?? undefined}
        {isEditable}
      />
    {/if}
  {:else if component.type === 'yield'}
    <div class="yield-preview">
      <div class="yield-placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></path>
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke-width="2" stroke-linecap="round"></path>
        </svg>
        <p>Page Content Area</p>
        <span>Page widgets will be rendered here</span>
      </div>
    </div>
  {:else if component.type === 'container'}
    {@const containerDisplay =
      getBreakpointValue(component.config.containerDisplay, currentBreakpoint) || 'flex'}
    {@const flexDirection =
      getBreakpointValue(component.config.containerFlexDirection, currentBreakpoint) || 'row'}
    {@const containerWidth =
      getBreakpointValue(component.config.containerWidth, currentBreakpoint) || 'auto'}
    {@const containerMinHeight =
      getBreakpointValue(component.config.containerMinHeight, currentBreakpoint) || 'auto'}
    {@const containerMaxHeight =
      getBreakpointValue(component.config.containerMaxHeight, currentBreakpoint) || 'none'}
    {@const containerGap =
      getBreakpointValue(component.config.containerGap, currentBreakpoint) || 16}
    {@const containerOpacity =
      getBreakpointValue(component.config.containerOpacity, currentBreakpoint) || 1}
    {@const containerOverflow = getBreakpointValue(
      component.config.containerOverflow,
      currentBreakpoint
    )}
    {@const containerZIndex = getBreakpointValue(
      component.config.containerZIndex,
      currentBreakpoint
    )}
    {@const containerGridCols = getBreakpointValue(
      component.config.containerGridCols,
      currentBreakpoint
    )}
    {@const containerGridRows = getBreakpointValue(
      component.config.containerGridRows,
      currentBreakpoint
    )}
    {@const containerGridAutoFlow = getBreakpointValue(
      component.config.containerGridAutoFlow,
      currentBreakpoint
    )}
    {@const containerPlaceItems = getBreakpointValue(
      component.config.containerPlaceItems,
      currentBreakpoint
    )}
    {@const containerPlaceContent = getBreakpointValue(
      component.config.containerPlaceContent,
      currentBreakpoint
    )}
    {@const containerPadding = getBreakpointValue(
      component.config.containerPadding,
      currentBreakpoint
    ) || { top: 0, right: 0, bottom: 0, left: 0 }}
    {@const containerMargin = getBreakpointValue(
      component.config.containerMargin,
      currentBreakpoint
    ) || { top: 0, right: 0, bottom: 0, left: 0 }}
    {@const borderWidth =
      getBreakpointValue(component.config.containerBorderWidth, currentBreakpoint) ?? 0}
    {@const borderStyle = component.config.containerBorderStyle || 'solid'}
    {@const borderColor =
      component.config.containerBorderColor && borderWidth > 0
        ? resolveThemeColor(
            component.config.containerBorderColor,
            colorTheme,
            themeColors.border,
            true
          )
        : 'transparent'}
    <div
      class="container-component"
      style="
        {isEditable
        ? 'display: block;'
        : `display: ${containerDisplay};
        ${
          containerDisplay === 'flex'
            ? `
            flex-direction: ${flexDirection};
            justify-content: ${component.config.containerJustifyContent || 'flex-start'};
            align-items: ${component.config.containerAlignItems || 'stretch'};
            align-content: ${component.config.containerAlignContent || 'normal'};
            flex-wrap: ${component.config.containerWrap || 'nowrap'};
          `
            : containerDisplay === 'grid'
              ? `
            grid-template-columns: ${formatGridTemplate(containerGridCols, 'repeat(3, 1fr)')};
            ${containerGridRows && containerGridRows !== 'auto' ? `grid-template-rows: ${formatGridTemplate(containerGridRows, 'auto')};` : ''}
            ${containerGridAutoFlow ? `grid-auto-flow: ${containerGridAutoFlow};` : ''}
            ${containerPlaceItems ? `place-items: ${containerPlaceItems};` : ''}
            ${containerPlaceContent ? `place-content: ${containerPlaceContent};` : ''}
          `
              : ''
        }
        gap: ${containerGap}px;`}
        width: {containerWidth};
        max-width: {component.config.containerMaxWidth || '1200px'};
        min-height: {containerMinHeight};
        max-height: {containerMaxHeight};
        padding: {containerPadding.top || 0}px {containerPadding.right ||
        0}px {containerPadding.bottom || 0}px {containerPadding.left || 0}px;
        margin: {containerMargin.top || 0}px auto {containerMargin.bottom || 0}px;
        background: {resolveThemeColor(
        component.config.containerBackground,
        colorTheme,
        'transparent',
        true
      )};
        {component.config.containerBackgroundImage
        ? `background-image: url(${component.config.containerBackgroundImage});`
        : ''}
        {component.config.containerBackgroundSize
        ? `background-size: ${getBreakpointValue(component.config.containerBackgroundSize, currentBreakpoint)};`
        : ''}
        {component.config.containerBackgroundPosition
        ? `background-position: ${getBreakpointValue(component.config.containerBackgroundPosition, currentBreakpoint)};`
        : ''}
        {component.config.containerBackgroundRepeat
        ? `background-repeat: ${getBreakpointValue(component.config.containerBackgroundRepeat, currentBreakpoint)};`
        : ''}
        border-radius: {component.config.containerBorderRadius ??
        component.config.cardBorderRadius ??
        0}px;
        border: {borderWidth}px {borderStyle} {borderColor};
        opacity: {containerOpacity};
        {containerOverflow
        ? `overflow: ${typeof containerOverflow === 'object' ? `${containerOverflow.x || 'visible'} ${containerOverflow.y || 'visible'}` : containerOverflow};`
        : ''}
        {containerZIndex !== undefined ? `z-index: ${containerZIndex};` : ''}
        {component.config.containerCursor
        ? `cursor: ${getBreakpointValue(component.config.containerCursor, currentBreakpoint)};`
        : ''}
        {component.config.containerPointerEvents
        ? `pointer-events: ${getBreakpointValue(component.config.containerPointerEvents, currentBreakpoint)};`
        : ''}
        box-sizing: border-box;
      "
    >
      {#if isEditable}
        <ContainerDropZone
          containerId={component.id}
          children={component.config.children || []}
          isActive={false}
          allowedTypes={[]}
          displayMode={containerDisplay}
          showLayoutHints={true}
          containerStyles={containerDisplay === 'flex'
            ? `
              flex-direction: ${flexDirection};
              justify-content: ${component.config.containerJustifyContent || 'flex-start'};
              align-items: ${component.config.containerAlignItems || 'stretch'};
              flex-wrap: ${component.config.containerWrap || 'nowrap'};
              gap: ${containerGap}px;
            `
            : containerDisplay === 'grid'
              ? `
              grid-template-columns: ${formatGridTemplate(containerGridCols, 'repeat(3, 1fr)')};
              ${containerGridRows && containerGridRows !== 'auto' ? `grid-template-rows: ${formatGridTemplate(containerGridRows, 'auto')};` : ''}
              ${containerGridAutoFlow ? `grid-auto-flow: ${containerGridAutoFlow};` : ''}
              ${containerPlaceItems ? `place-items: ${containerPlaceItems};` : ''}
              ${containerPlaceContent ? `place-content: ${containerPlaceContent};` : ''}
              gap: ${containerGap}px;
            `
              : `gap: ${containerGap}px;`}
          on:drop={handleContainerDrop}
          on:reorder={handleContainerReorder}
          on:childClick={handleChildClick}
          on:delete={handleContainerDelete}
        >
          <svelte:fragment slot="child" let:child>
            <div class="container-child-wrapper" style={getChildLayoutStyles(child.config)}>
              <svelte:self
                component={child}
                {currentBreakpoint}
                {colorTheme}
                onUpdate={createChildUpdateHandler(child.id)}
                {isEditable}
                {siteContext}
                {user}
                {onSelectComponent}
              />
            </div>
          </svelte:fragment>
        </ContainerDropZone>
      {:else if component.config.children && component.config.children.length > 0}
        {#each component.config.children as child}
          <div class="container-child" style={getChildLayoutStyles(child.config)}>
            <svelte:self
              component={child}
              {currentBreakpoint}
              {colorTheme}
              onUpdate={createChildUpdateHandler(child.id)}
              {isEditable}
              {siteContext}
              {user}
              {onSelectComponent}
            />
          </div>
        {/each}
      {:else}
        <div class="layout-placeholder">
          <p>📦 Container</p>
          <span>Drop widgets here</span>
        </div>
      {/if}
    </div>
  {:else if component.type === 'component_ref'}
    {#await import('./ComponentRefRenderer.svelte')}
      <div class="component-ref-loading">Loading component...</div>
    {:then { default: ComponentRefRenderer }}
      <ComponentRefRenderer
        componentId={component.config.componentId}
        {currentBreakpoint}
        {colorTheme}
        {isEditable}
        {siteContext}
        {user}
      />
    {:catch error}
      <div class="component-ref-error">
        Failed to load component: {error.message}
      </div>
    {/await}
  {:else if component.type === 'composite'}
    <!-- Composite components render their children as a simple flex container -->
    <div
      class="composite-component"
      style="
        display: flex;
        flex-direction: column;
        width: 100%;
      "
    >
      {#if component.config.children && component.config.children.length > 0}
        {#each component.config.children as child}
          <div class="composite-child">
            <svelte:self
              component={child}
              {currentBreakpoint}
              {colorTheme}
              onUpdate={createChildUpdateHandler(child.id)}
              {isEditable}
              {siteContext}
              {user}
              {onSelectComponent}
            />
          </div>
        {/each}
      {:else}
        <div class="composite-placeholder">
          <p>📦 Composite Component</p>
          <span>This component has no children configured</span>
        </div>
      {/if}
    </div>
  {:else}
    <div class="unknown-widget">
      <span>Unknown widget type: {component.type}</span>
    </div>
  {/if}
</div>

<style>
  .widget-renderer {
    min-height: 20px;
    /* Use display: contents so this wrapper doesn't interfere with parent flex/grid layouts */
    /* The widget-renderer acts as a transparent wrapper - its children participate directly in the parent's layout */
    display: contents;
  }

  /* Navbar container-based - ensures proper responsive sizing */
  .navbar-container-based {
    overflow: hidden; /* Prevent navbar content from overflowing */
  }

  /* Container child wrapper - ensures children act as independent flex/grid items */
  .container-child {
    /* Use display: contents so this wrapper doesn't interfere with parent flex/grid layouts */
    /* The container-child acts as a transparent wrapper - its children participate directly in the parent's layout */
    display: contents;
  }

  /* Container child wrapper in edit mode - same behavior as container-child */
  .container-child-wrapper {
    position: relative;
    /* flex/grid properties are applied inline via getChildLayoutStyles() */
    /* Ensure wrapper fills its cell */
    width: 100%;
    min-width: 0;
    min-height: 0;
  }

  /* Text Widget */
  .text-widget {
    padding: 1rem;
    line-height: 1.6;
  }

  .text-widget p {
    margin: 0;
    color: inherit;
  }

  /* Image Widget */
  .image-widget {
    position: relative;
  }

  .image-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    background: var(--color-bg-tertiary, #f5f5f5);
    color: var(--color-text-secondary);
    border-radius: 8px;
  }

  .image-placeholder svg {
    opacity: 0.5;
    margin-bottom: 0.5rem;
  }

  /* Hero styling is now in the Hero.svelte component for WYSIWYG fidelity */

  /* Button Widget */
  .button-widget {
    padding: 1rem;
  }

  .btn {
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn:hover {
    opacity: 0.9;
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .btn-label {
    line-height: 1;
  }

  .btn-small {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  }

  .btn-medium {
    padding: 0.5rem 1rem;
    font-size: 1rem;
  }

  .btn-large {
    padding: 0.75rem 1.5rem;
    font-size: 1.125rem;
  }

  .btn-primary {
    background: var(--color-primary, #3b82f6);
    color: white;
  }

  .btn-secondary {
    background: var(--color-secondary, #6b7280);
    color: white;
  }

  .btn-outline {
    background: transparent;
    border: 2px solid var(--color-primary, #3b82f6);
    color: var(--color-primary, #3b82f6);
  }

  .btn-text {
    background: transparent;
    color: var(--color-primary, #3b82f6);
  }

  /* Spacer Widget */
  .spacer-widget {
    background: repeating-linear-gradient(
      90deg,
      transparent,
      transparent 10px,
      rgba(0, 0, 0, 0.05) 10px,
      rgba(0, 0, 0, 0.05) 20px
    );
  }

  /* Theme Toggle Widget */
  .theme-toggle-widget {
    display: flex;
    width: 100%;
    padding: 0.5rem 0;
  }

  .theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: 1px solid var(--color-border-primary, #e5e7eb);
    border-radius: 0.375rem;
    background-color: var(--color-bg-primary, #ffffff);
    color: var(--color-text-primary, #111827);
    cursor: not-allowed;
    opacity: 0.7;
  }

  .theme-toggle-small {
    width: 2rem;
    height: 2rem;
    padding: 0;
  }

  .theme-toggle-medium {
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
  }

  .theme-toggle-large {
    width: 3rem;
    height: 3rem;
    padding: 0;
  }

  .theme-toggle-icon-label,
  .theme-toggle-button {
    width: auto;
    padding: 0.5rem 1rem;
  }

  .theme-toggle-small.theme-toggle-icon-label,
  .theme-toggle-small.theme-toggle-button {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  }

  .theme-toggle-large.theme-toggle-icon-label,
  .theme-toggle-large.theme-toggle-button {
    padding: 0.75rem 1.25rem;
    font-size: 1rem;
  }

  .theme-toggle-label {
    font-weight: 500;
    line-height: 1;
  }

  .theme-toggle-icon {
    padding: 0;
  }

  .theme-toggle-button {
    background-color: var(--color-primary, #3b82f6);
    color: white;
    border-color: var(--color-primary, #3b82f6);
  }

  /* Divider Widget */
  .divider-widget {
    width: 100%;
  }

  /* Container Widget */
  .container-component {
    min-height: 60px;
    width: 100%;
    box-sizing: border-box;
    position: relative;
  }

  .container-component > .layout-placeholder {
    flex: 1;
    min-width: 200px;
  }

  /* Columns Widget */
  .columns-widget {
    padding: 1rem;
  }

  .column-placeholder {
    padding: 2rem 1rem;
    background: var(--color-bg-tertiary, #f5f5f5);
    border: 2px dashed var(--color-border-secondary);
    border-radius: 8px;
    text-align: center;
    color: var(--color-text-secondary);
  }

  /* Product Widgets */
  .product-widget {
    padding: 1rem;
  }

  .product-preview {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: var(--color-bg-secondary, #f5f5f5);
    border-radius: 8px;
  }

  .product-image-placeholder {
    width: 120px;
    height: 120px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary, #e5e5e5);
    border-radius: 6px;
    color: var(--color-text-secondary);
  }

  .product-info h3 {
    margin: 0 0 0.5rem 0;
    padding: 0;
    font-size: 1.125rem;
  }

  .product-price {
    font-weight: 600;
    color: var(--color-primary, #3b82f6);
    margin: 0.5rem 0;
  }

  .product-description {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .product-list-widget {
    padding: 1rem;
  }

  .product-card {
    padding: 1rem;
    background: var(--color-bg-secondary, #f5f5f5);
    border-radius: 8px;
    text-align: center;
  }

  .product-card .product-image-placeholder {
    width: 100%;
    height: 150px;
    margin-bottom: 0.75rem;
  }

  .product-card h4 {
    margin: 0 0 0.5rem 0;
    padding: 0;
    font-size: 1rem;
  }

  .product-card .product-price {
    margin: 0;
  }

  /* Placeholders */
  .widget-placeholder,
  .unknown-widget {
    padding: 2rem 1rem;
    background: var(--color-bg-tertiary, #f5f5f5);
    border: 2px dashed var(--color-border-secondary);
    border-radius: 8px;
    text-align: center;
    color: var(--color-text-secondary);
  }

  /* Features Preview */
  .features-preview {
    padding: 2rem;
    background: var(--color-bg-secondary);
  }

  .features-preview h3 {
    text-align: center;
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
  }

  .features-subtitle {
    text-align: center;
    margin: 0 0 2rem 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .features-grid {
    display: grid;
    margin-top: 2rem;
  }

  .feature-card {
    padding: 1.5rem;
    text-align: center;
  }

  .feature-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .feature-card h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
  }

  .feature-card p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .empty-message {
    text-align: center;
    padding: 2rem;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    background: var(--color-bg-tertiary);
    border: 2px dashed var(--color-border-secondary);
    border-radius: 8px;
    margin-top: 1rem;
  }

  /* CTA Preview */
  .cta-preview {
    padding: 2rem;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    text-align: center;
    color: white;
  }

  .cta-preview h3 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
  }

  .cta-preview p {
    margin: 0 0 1.5rem 0;
    opacity: 0.9;
  }

  .cta-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .cta-buttons button {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    border: none;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-primary {
    background: white;
    color: var(--color-primary);
  }

  .btn-secondary {
    background: transparent;
    color: white;
    border: 2px solid white !important;
  }

  /* Footer Container-based Architecture */
  .footer-container-based {
    width: 100%;
    box-sizing: border-box;
  }

  .footer-content-wrapper {
    width: 100%;
    box-sizing: border-box;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* Yield Preview */
  .yield-preview {
    background: var(--color-bg-secondary);
    border: 2px dashed var(--color-border-secondary);
    border-radius: 8px;
    padding: 3rem 2rem;
    min-height: 200px;
  }

  .yield-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    text-align: center;
    color: var(--color-text-secondary);
  }

  .yield-placeholder svg {
    opacity: 0.5;
  }

  .yield-placeholder p {
    margin: 0;
    font-weight: 600;
    font-size: 1.125rem;
    color: var(--color-text-primary);
  }

  .yield-placeholder span {
    font-size: 0.875rem;
    font-style: italic;
  }

  /* Layout Widget Previews */
  .container-preview,
  .row-preview {
    width: 100%;
    box-sizing: border-box;
    min-height: 100px;
  }

  .layout-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem;
    text-align: center;
    color: var(--color-text-secondary);
    border: 2px dashed var(--color-border-secondary);
    border-radius: 4px;
    background: var(--color-bg-tertiary);
  }

  .layout-placeholder p {
    margin: 0;
    font-weight: 600;
    font-size: 1rem;
    color: var(--color-text-primary);
  }

  .layout-placeholder span {
    font-size: 0.875rem;
    font-style: italic;
  }

  .component-ref-loading,
  .component-ref-error {
    padding: 1rem;
    text-align: center;
    border: 2px dashed var(--color-border-secondary);
    border-radius: 4px;
    background: var(--color-bg-secondary);
  }

  .component-ref-error {
    color: var(--color-error);
    border-color: var(--color-error);
  }

  /* Composite Component */
  .composite-component {
    width: 100%;
    min-height: 50px;
  }

  .composite-child {
    width: 100%;
  }

  .composite-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    color: var(--color-text-secondary);
    background: var(--color-bg-tertiary);
    border: 2px dashed var(--color-border-secondary);
    border-radius: 8px;
  }

  .composite-placeholder p {
    margin: 0 0 0.5rem 0;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .composite-placeholder span {
    font-size: 0.875rem;
    font-style: italic;
  }

  /* Dropdown Menu Widget */
  .dropdown-widget-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .dropdown-widget-container.drag-over {
    background: rgba(59, 130, 246, 0.05);
    outline: 2px dashed var(--color-primary, #3b82f6);
    outline-offset: 2px;
  }

  .dropdown-trigger-preview {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    width: fit-content;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .dropdown-trigger-preview.variant-button {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .dropdown-trigger-preview.variant-icon {
    padding: 0.5rem;
    border-radius: 50%;
  }

  .dropdown-trigger-preview .trigger-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dropdown-trigger-preview .trigger-label {
    font-weight: 500;
  }

  .dropdown-trigger-preview .trigger-chevron {
    display: flex;
    align-items: center;
    opacity: 0.7;
    transition: transform 0.2s ease;
  }

  .dropdown-trigger-preview .trigger-chevron.rotated {
    transform: rotate(180deg);
  }

  .dropdown-trigger-preview:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-border-primary);
  }

  .dropdown-trigger-preview.expanded {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }

  .dropdown-trigger-preview.variant-button:hover {
    filter: brightness(1.05);
    background: var(--color-primary);
  }

  .dropdown-menu-preview {
    border: 1px solid var(--color-border-secondary);
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    min-height: 60px;
    animation: fadeIn 0.2s ease-out;
  }

  .dropdown-menu-preview.drag-target {
    border-color: var(--color-primary, #3b82f6);
    box-shadow:
      0 0 0 3px rgba(59, 130, 246, 0.2),
      0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dropdown-menu-preview.align-left {
    align-self: flex-start;
  }

  .dropdown-menu-preview.align-right {
    align-self: flex-end;
  }

  .dropdown-menu-preview.align-center {
    align-self: center;
  }

  .dropdown-item-wrapper {
    width: 100%;
  }

  .dropdown-item {
    width: 100%;
  }

  .dropdown-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 1.5rem;
    text-align: center;
    color: var(--color-text-secondary);
    border: 2px dashed var(--color-border-secondary);
    border-radius: 4px;
    background: var(--color-bg-tertiary);
  }

  .dropdown-placeholder p {
    margin: 0;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--color-text-primary);
  }

  .dropdown-placeholder span {
    font-size: 0.75rem;
    font-style: italic;
  }
</style>
