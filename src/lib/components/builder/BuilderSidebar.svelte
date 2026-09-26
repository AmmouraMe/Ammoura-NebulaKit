<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import {
    GripVertical,
    X,
    Search,
    Layout,
    Type,
    Image,
    Box,
    ShoppingCart,
    ChevronDown,
    ChevronDownSquare,
    Package,
    SunMoon,
    Palette,
    Star
  } from 'lucide-svelte';
  import type { PageComponent, ComponentType, Component } from '$lib/types/pages';
  import { getDefaultConfig as getEditorDefaultConfig } from '$lib/utils/editor/componentDefaults';

  // Extended Component type that may include children_count from server
  interface ComponentWithCount extends Component {
    children_count?: number;
  }

  type BuilderMode = 'page' | 'layout' | 'component' | 'primitive';

  export let mode: BuilderMode = 'page';
  export let pageComponents: PageComponent[];
  export let title: string;
  export let slug: string;
  export let components: ComponentWithCount[] = [];
  // Current component ID (for component mode) - used to prevent adding a component to itself
  export let currentComponentId: number | null = null;
  // Built-in components cannot have their name changed
  export let isBuiltIn = false;
  // Whether to show the page settings section (hidden when embedded in BuilderLeftPanel)
  export let showPageSettings = true;
  // Whether to show the components section header (hidden when embedded in BuilderLeftPanel)
  export let showComponentsHeader = true;

  // Entity labels based on mode
  $: entityLabel = mode === 'page' ? 'Page' : mode === 'layout' ? 'Layout' : 'Component';
  $: entityLabelLower = entityLabel.toLowerCase();

  const dispatch = createEventDispatcher();

  let searchQuery = '';
  let activeCategory: string = 'all';
  let pageSettingsExpanded = true;
  let componentsExpanded = true;

  // Touch drag state for mobile
  let touchDragComponentType: string | null = null;
  let touchDragGhost: HTMLElement | null = null;
  let touchStartPos = { x: 0, y: 0 };
  let touchCurrentPos = { x: 0, y: 0 };
  let isTouchDragging = false;
  const touchDragThreshold = 10;
  let touchStartedOnHandle = false;

  // Note: Auto-scroll for touch drag is handled by BuilderCanvas.svelte
  // The sidebar dispatches touchComponentDragOver events which the canvas handles

  // Component library organized by category
  const componentLibrary = {
    containers: [
      {
        type: 'container',
        name: 'Container',
        icon: Box,
        description: 'Flexible container for grouping elements'
      },
      { type: 'columns', name: 'Columns', icon: Layout, description: 'Multi-column layout' },
      { type: 'spacer', name: 'Spacer', icon: Box, description: 'Vertical spacing' },
      { type: 'divider', name: 'Divider', icon: Box, description: 'Horizontal divider line' }
    ],
    content: [
      { type: 'heading', name: 'Heading', icon: Type, description: 'Text heading (H1-H6)' },
      { type: 'text', name: 'Text', icon: Type, description: 'Paragraph text' },
      { type: 'button', name: 'Button', icon: Box, description: 'Call-to-action button' },
      { type: 'image', name: 'Image', icon: Image, description: 'Single image' },
      { type: 'icon', name: 'Icon', icon: Star, description: 'Decorative Lucide icon' },
      {
        type: 'dropdown',
        name: 'Dropdown',
        icon: ChevronDownSquare,
        description: 'Select dropdown field'
      }
    ],
    theme: [
      {
        type: 'theme_toggle',
        name: 'Theme Toggle',
        icon: SunMoon,
        description: 'Light/dark mode toggle button'
      }
    ],
    sections: [
      { type: 'cta', name: 'Call to Action', icon: Layout, description: 'CTA banner section' },
      { type: 'pricing', name: 'Pricing', icon: Layout, description: 'Pricing section with tiers' }
    ],
    commerce: [
      {
        type: 'single_product',
        name: 'Product',
        icon: ShoppingCart,
        description: 'Single product display'
      },
      {
        type: 'product_list',
        name: 'Product Grid',
        icon: ShoppingCart,
        description: 'Grid of products'
      }
    ]
  };

  const categories = [
    { id: 'all', name: 'All', icon: Box },
    { id: 'containers', name: 'Layout', icon: Layout },
    { id: 'content', name: 'Content', icon: Type },
    { id: 'sections', name: 'Sections', icon: Layout },
    { id: 'theme', name: 'Theme', icon: Palette },
    { id: 'commerce', name: 'Commerce', icon: ShoppingCart },
    { id: 'custom', name: 'Custom', icon: Package }
  ];

  // Built-in component types that shouldn't appear in the custom components list
  // This set is used to filter out GLOBAL components with these types
  // (site-specific custom components can have these types and should still be shown)
  // Note: navbar, footer, hero, features are NOT in this list - they are editable built-in components from database
  const builtInTypes = new Set([
    'container',
    'columns',
    'spacer',
    'divider', // containers
    'heading',
    'text',
    'button',
    'image',
    'icon',
    'dropdown', // content
    'cta', // sections
    'theme_toggle', // theme
    'single_product',
    'product_list' // commerce
  ]);

  // Filter out components that shouldn't appear in the custom components list:
  // 1. Current component being edited (prevent circular references)
  // 2. Empty custom components (those with no children) - but allow navbar/footer/hero/features which store children in config
  // 3. Global primitive components (they're already in the built-in library)
  // 4. GLOBAL components with built-in types (container, etc.) - but NOT site-specific custom components
  //    Site-specific custom components can have any type and should still be shown
  $: availableComponents = components.filter(
    (c) =>
      c.id !== currentComponentId &&
      (c.children_count === undefined ||
        c.children_count > 0 ||
        c.type === 'navbar' ||
        c.type === 'footer' ||
        c.type === 'hero' ||
        c.type === 'features') &&
      !c.is_primitive &&
      // Only filter out built-in types for GLOBAL components
      // Site-specific custom components can have these types and should still be shown
      (!c.is_global || !builtInTypes.has(c.type))
  );

  // Reactive filtered components based on search and category
  $: filteredComponents = (() => {
    // Using any here because componentLibrary has complex union types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allComponents: any[] = [];

    if (activeCategory === 'custom') {
      // Show custom components (excluding current component to prevent self-reference)
      allComponents = availableComponents.map((c) => ({
        type: `component:${c.id}`,
        name: c.name,
        icon: Package,
        description: c.description || 'Custom component',
        componentId: c.id,
        componentType: c.type,
        componentConfig: c.config
      }));
    } else if (activeCategory === 'all') {
      // Show all built-in components
      Object.values(componentLibrary).forEach((category) => {
        allComponents = [...allComponents, ...category];
      });
      // Add custom components to 'all' view (excluding current component)
      availableComponents.forEach((c) => {
        allComponents.push({
          type: `component:${c.id}`,
          name: c.name,
          icon: Package,
          description: c.description || 'Custom component',
          componentId: c.id,
          componentType: c.type,
          componentConfig: c.config
        });
      });
    } else {
      allComponents = componentLibrary[activeCategory as keyof typeof componentLibrary] || [];
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      allComponents = allComponents.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description.toLowerCase().includes(query) ||
          c.type.toLowerCase().includes(query)
      );
    }

    return allComponents;
  })();

  function addComponent(type: string) {
    let componentType: ComponentType;
    let componentConfig: Record<string, unknown>;

    // Check if this is a custom component (format: "component:123")
    if (type.startsWith('component:')) {
      const componentId = parseInt(type.split(':')[1]);
      const customComponent = components.find((c) => c.id === componentId);

      if (!customComponent) {
        console.error('Component not found:', componentId);
        return;
      }

      // Create a component_ref that references this component
      componentType = 'component_ref';
      componentConfig = { componentId: customComponent.id };
    } else {
      // Built-in component type
      componentType = type as ComponentType;
      componentConfig = getDefaultConfig(componentType);
    }

    const newComponent: PageComponent = {
      id: `temp-${Date.now()}`,
      type: componentType,
      config: componentConfig,
      position: pageComponents.length,
      page_id: '',
      created_at: Date.now(),
      updated_at: Date.now()
    };
    dispatch('addComponent', newComponent);
  }

  function getDefaultConfig(type: ComponentType): Record<string, unknown> {
    // For container-based components with complex children structures, use the central defaults
    if (type === 'pricing' || type === 'hero' || type === 'features') {
      return getEditorDefaultConfig(type) as Record<string, unknown>;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaults: Record<ComponentType, any> = {
      // Hero is now a database-based built-in component, added via component_ref
      hero: {},
      text: {
        text: 'Enter your text here',
        alignment: 'left',
        fontSize: { desktop: 16, tablet: 16, mobile: 14 },
        color: 'var(--color-text-primary)'
      },
      image: {
        src: '',
        alt: 'Image',
        imageWidth: '100%',
        borderRadius: 0,
        objectFit: 'cover'
      },
      icon: {
        iconName: 'Star',
        iconSize: 24,
        iconColor: 'theme:text',
        strokeWidth: 2,
        alignment: 'center'
      },
      heading: {
        heading: 'Heading',
        level: 2,
        alignment: 'left',
        color: 'var(--color-text-primary)'
      },
      button: {
        label: 'Click Me',
        url: '#',
        variant: 'primary',
        openInNewTab: false,
        fullWidth: { desktop: false, tablet: false, mobile: false },
        buttonAlign: 'left'
      },
      spacer: {
        space: { desktop: 40, tablet: 30, mobile: 20 }
      },
      columns: {
        columnCount: { desktop: 3, tablet: 2, mobile: 1 },
        columnGap: { desktop: 20, tablet: 16, mobile: 12 },
        columns: []
      },
      divider: {
        thickness: 1,
        color: 'theme:border',
        dividerWidth: '100%',
        dividerSpacing: { desktop: 32, tablet: 24, mobile: 16 }
      },
      scene: {
        sceneVariant: 'stars',
        sceneDensity: 50,
        sceneSpeed: 50,
        scenePointerParallax: true,
        sceneHeight: '420px'
      },
      single_product: {
        productId: '',
        layout: 'card',
        showPrice: true,
        showDescription: true
      },
      product_list: {
        category: '',
        limit: 12,
        sortBy: 'created_at',
        productListColumns: { desktop: 3, tablet: 2, mobile: 1 },
        productGap: { desktop: 24, tablet: 20, mobile: 16 }
      },
      features: {
        title: 'Features',
        subtitle: '',
        features: [
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
        ],
        cardBackground: 'var(--color-bg-primary)',
        cardBorderColor: 'var(--color-border-secondary)',
        cardBorderRadius: 12,
        featuresColumns: { desktop: 3, tablet: 2, mobile: 1 },
        featuresGap: { desktop: 32, tablet: 24, mobile: 16 }
      },
      pricing: {
        title: 'Pricing',
        subtitle: '',
        plans: []
      },
      cta: {
        heading: 'Ready to Get Started?',
        subheading: 'Join thousands of satisfied customers',
        buttonText: 'Get Started',
        buttonUrl: '#',
        backgroundColor: 'var(--color-bg-secondary)',
        textColor: 'var(--color-text-primary)'
      },
      navbar: {
        // Container properties (Container architecture)
        containerPadding: {
          desktop: { top: 16, right: 24, bottom: 16, left: 24 },
          tablet: { top: 12, right: 20, bottom: 12, left: 20 },
          mobile: { top: 12, right: 16, bottom: 12, left: 16 }
        },
        containerMaxWidth: '100%',
        containerBackground: '#ffffff',
        containerBorderRadius: 0,
        // Logo configuration
        logo: { text: 'Store', url: '/', image: '', imageHeight: 40 },
        logoPosition: 'left',
        // Navigation links
        links: [
          { text: 'Home', url: '/' },
          { text: 'Products', url: '/products' },
          { text: 'About', url: '/about' },
          { text: 'Contact', url: '/contact' }
        ],
        linksPosition: 'center',
        // Action buttons
        showSearch: false,
        showCart: true,
        showAuth: true,
        showThemeToggle: true,
        showAccountMenu: true,
        actionsPosition: 'right',
        // Account menu items
        accountMenuItems: [
          { text: 'Profile', url: '/user/profile', icon: '👤' },
          { text: 'Settings', url: '/settings', icon: '⚙️', dividerBefore: true }
        ],
        // Styling (backward compatibility)
        navbarBackground: '#ffffff',
        navbarTextColor: '#000000',
        navbarHoverColor: 'var(--color-primary)',
        navbarBorderColor: '#e5e7eb',
        navbarShadow: false,
        sticky: true,
        navbarHeight: 0,
        // Dropdown styling
        dropdownBackground: '#ffffff',
        dropdownTextColor: '#000000',
        dropdownHoverBackground: '#f3f4f6'
      },
      footer: {
        copyright: '© 2025 Store Name. All rights reserved.',
        footerLinks: [
          { text: 'Privacy Policy', url: '/privacy' },
          { text: 'Terms of Service', url: '/terms' }
        ],
        socialLinks: [],
        footerBackground: '#f9fafb',
        footerTextColor: '#374151'
      },
      yield: {},
      container: {
        containerPadding: {
          desktop: { top: 40, right: 40, bottom: 40, left: 40 },
          tablet: { top: 30, right: 30, bottom: 30, left: 30 },
          mobile: { top: 20, right: 20, bottom: 20, left: 20 }
        },
        containerMargin: {
          desktop: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
          tablet: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
          mobile: { top: 0, right: 0, bottom: 0, left: 0 }
        },
        containerBackground: 'transparent',
        containerBorderRadius: 0,
        containerMaxWidth: '1200px',
        containerGap: { desktop: 16, tablet: 12, mobile: 8 },
        containerJustifyContent: 'flex-start',
        containerAlignItems: 'center',
        containerWrap: 'wrap',
        children: []
      },
      composite: {
        children: []
      },
      dropdown: {
        triggerLabel: 'Menu',
        triggerIcon: '',
        triggerVariant: 'text',
        showChevron: true,
        menuWidth: '200px',
        menuAlign: 'left',
        menuBackground: 'var(--color-bg-primary)',
        menuBorderRadius: 8,
        menuShadow: true,
        menuPadding: { top: 8, right: 8, bottom: 8, left: 8 },
        children: []
      },
      theme_toggle: {
        size: 'medium',
        toggleVariant: 'icon',
        alignment: 'left'
      },
      component_ref: {
        componentId: null // Will be set when adding from component library
      }
    };
    return defaults[type] || {};
  }

  // ========== Touch Drag-and-Drop for Mobile ==========

  function handleDragHandleTouchStart(event: TouchEvent, componentType: string): void {
    if (event.touches.length !== 1) return;

    // On iOS, we should NOT call preventDefault on touchstart as it can cancel the touch sequence
    // Instead, we'll call it on touchmove once we've determined it's a drag
    event.stopPropagation();

    const touch = event.touches[0];
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    touchCurrentPos = { x: touch.clientX, y: touch.clientY };
    touchDragComponentType = componentType;
    isTouchDragging = false;
    touchStartedOnHandle = true;

    // Add global touch listeners for iOS compatibility
    // iOS doesn't bubble touch events well, so we listen globally
    // Use capture phase to ensure we get the events
    document.addEventListener('touchmove', handleGlobalTouchMove, {
      passive: false,
      capture: true
    });
    document.addEventListener('touchend', handleGlobalTouchEnd, { capture: true });
    document.addEventListener('touchcancel', handleGlobalTouchCancel, { capture: true });
  }

  function handleGlobalTouchMove(event: TouchEvent): void {
    // Only process if touch started on drag handle
    if (!touchStartedOnHandle || touchDragComponentType === null) return;
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    touchCurrentPos = { x: touch.clientX, y: touch.clientY };

    // Check if we've moved enough to start dragging
    const dx = touchCurrentPos.x - touchStartPos.x;
    const dy = touchCurrentPos.y - touchStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!isTouchDragging && distance > touchDragThreshold) {
      isTouchDragging = true;
      // Create and show ghost when threshold is passed
      createTouchDragGhost(touchDragComponentType, false);
      // Dispatch event to hide sidebar when drag starts
      dispatch('componentDragStart');
    }

    if (isTouchDragging) {
      // Now we can prevent default since we know it's a drag
      event.preventDefault();
      event.stopPropagation();
      updateTouchDragGhost();

      // Dispatch event for drop zones to listen to
      // Auto-scroll is handled by BuilderCanvas when it receives this event
      window.dispatchEvent(
        new CustomEvent('touchComponentDragOver', {
          detail: {
            componentType: touchDragComponentType,
            clientX: touch.clientX,
            clientY: touch.clientY
          }
        })
      );
    }
  }

  function handleGlobalTouchEnd(event: TouchEvent): void {
    if (!touchStartedOnHandle || touchDragComponentType === null) {
      removeGlobalTouchListeners();
      touchStartedOnHandle = false;
      return;
    }

    if (isTouchDragging) {
      // Find the last touch position
      const touch = event.changedTouches[0];

      // Check if dropped on cancel zone (bottom 80px of screen)
      const cancelZoneHeight = 80;
      const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
      const isOnCancelZone = touch.clientY > windowHeight - cancelZoneHeight;

      if (!isOnCancelZone) {
        // Dispatch drop event for drop zones (only if not cancelled)
        window.dispatchEvent(
          new CustomEvent('touchComponentDrop', {
            detail: {
              componentType: touchDragComponentType,
              clientX: touch.clientX,
              clientY: touch.clientY
            }
          })
        );
      }

      // Dispatch event to restore sidebar
      dispatch('componentDragEnd');
    }

    // Clean up
    removeGlobalTouchListeners();
    cleanupTouchDrag();
  }

  function handleGlobalTouchCancel(): void {
    if (isTouchDragging) {
      dispatch('componentDragEnd');
    }
    removeGlobalTouchListeners();
    cleanupTouchDrag();
  }

  function removeGlobalTouchListeners(): void {
    document.removeEventListener('touchmove', handleGlobalTouchMove, {
      capture: true
    });
    document.removeEventListener('touchend', handleGlobalTouchEnd, {
      capture: true
    });
    document.removeEventListener('touchcancel', handleGlobalTouchCancel, {
      capture: true
    });
  }

  // Legacy handlers for non-iOS browsers (kept for compatibility)
  function handleComponentTouchMove(event: TouchEvent): void {
    handleGlobalTouchMove(event);
  }

  function handleComponentTouchEnd(event: TouchEvent): void {
    handleGlobalTouchEnd(event);
  }

  function handleComponentTouchCancel(): void {
    handleGlobalTouchCancel();
  }

  function createTouchDragGhost(componentType: string, _initiallyHidden = false): void {
    // Clean up any existing ghost first
    if (touchDragGhost && touchDragGhost.parentNode) {
      touchDragGhost.parentNode.removeChild(touchDragGhost);
    }

    // Find the component name for display
    let componentName = componentType;
    let componentIcon = '📦';
    for (const category of Object.values(componentLibrary)) {
      const found = category.find((c) => c.type === componentType);
      if (found) {
        componentName = found.name;
        // Map component types to emojis for the ghost
        const iconMap: Record<string, string> = {
          container: '📦',
          columns: '▦',
          spacer: '↕',
          divider: '—',
          scene: '✦',
          heading: '🔤',
          text: '📝',
          button: '🔘',
          image: '🖼️',
          icon: '⭐',
          dropdown: '▼',
          cta: '📣',
          pricing: '💰',
          single_product: '🛒',
          product_list: '🛍️',
          theme_toggle: '🌓'
        };
        componentIcon = iconMap[componentType] || '📦';
        break;
      }
    }

    // Check for custom components
    if (componentType.startsWith('component:')) {
      componentIcon = '🧩';
    }

    touchDragGhost = document.createElement('div');
    touchDragGhost.className = 'touch-drag-ghost';
    touchDragGhost.innerHTML = `
      <div class="ghost-content">
        <span class="ghost-icon">${componentIcon}</span>
        <span class="ghost-name">${componentName}</span>
      </div>
      <div class="ghost-hint">Drop on canvas or drag here to cancel</div>
    `;
    touchDragGhost.style.cssText = `
      position: fixed;
      z-index: 10000;
      padding: 12px 16px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 12px 32px rgba(59, 130, 246, 0.5), 0 0 0 3px rgba(255,255,255,0.2);
      pointer-events: none;
      transform: translate(-50%, -100%);
      white-space: nowrap;
      border: 2px solid rgba(255,255,255,0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    `;

    // Add styles for inner elements
    const style = document.createElement('style');
    style.id = 'touch-drag-ghost-styles';
    if (!document.getElementById('touch-drag-ghost-styles')) {
      style.textContent = `
        @keyframes ghostAppear {
          from { opacity: 0; transform: translate(-50%, -80%) scale(0.8); }
          to { opacity: 1; transform: translate(-50%, -100%) scale(1); }
        }
        .touch-drag-ghost .ghost-content {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
        }
        .touch-drag-ghost .ghost-icon {
          font-size: 18px;
        }
        .touch-drag-ghost .ghost-hint {
          font-size: 10px;
          opacity: 0.8;
          font-weight: 400;
        }
        .touch-drag-ghost.over-cancel {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
          box-shadow: 0 12px 32px rgba(239, 68, 68, 0.5), 0 0 0 3px rgba(255,255,255,0.2) !important;
        }
        .touch-drag-ghost.over-canvas {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
          box-shadow: 0 12px 32px rgba(34, 197, 94, 0.5), 0 0 0 3px rgba(255,255,255,0.2) !important;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(touchDragGhost);
    updateTouchDragGhost();
  }

  function updateTouchDragGhost(): void {
    if (touchDragGhost) {
      touchDragGhost.style.left = `${touchCurrentPos.x}px`;
      touchDragGhost.style.top = `${touchCurrentPos.y - 30}px`;
    }
  }

  function cleanupTouchDrag(): void {
    if (touchDragGhost && touchDragGhost.parentNode) {
      touchDragGhost.parentNode.removeChild(touchDragGhost);
    }
    touchDragGhost = null;
    touchDragComponentType = null;
    isTouchDragging = false;
    touchStartedOnHandle = false;
  }

  onDestroy(() => {
    removeGlobalTouchListeners();
    cleanupTouchDrag();
  });
</script>

<aside class="builder-sidebar">
  {#if showPageSettings}
    <div class="page-settings-section">
      <button
        class="section-header"
        on:click={() => {
          pageSettingsExpanded = !pageSettingsExpanded;
        }}
      >
        <h4>{entityLabel} Settings</h4>
        <div class="chevron" class:expanded={pageSettingsExpanded}>
          <ChevronDown size={16} />
        </div>
      </button>
      {#if pageSettingsExpanded}
        <div class="section-content">
          <div class="setting-group">
            <label for="page-title" class="setting-label">Title</label>
            <input
              id="page-title"
              type="text"
              class="setting-input"
              class:readonly={isBuiltIn}
              value={title}
              readonly={isBuiltIn}
              on:input={(e) => !isBuiltIn && dispatch('updateTitle', e.currentTarget.value)}
              placeholder="{entityLabel} title"
              title={isBuiltIn ? 'Built-in component names cannot be changed' : ''}
            />
          </div>
          {#if mode === 'page'}
            <div class="setting-group">
              <label for="page-slug" class="setting-label">URL Slug</label>
              <input
                id="page-slug"
                type="text"
                class="setting-input"
                value={slug}
                on:input={(e) => dispatch('updateSlug', e.currentTarget.value)}
                placeholder="/{entityLabelLower}-url"
              />
            </div>
          {/if}
          <button class="btn-properties" on:click={() => dispatch('showPageProperties')}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Properties</span>
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <div class="components-section">
    {#if showComponentsHeader}
      <div class="sidebar-header">
        <button
          class="section-header-inline"
          on:click={() => {
            componentsExpanded = !componentsExpanded;
          }}
        >
          <h3>Components</h3>
          <div class="chevron" class:expanded={componentsExpanded}>
            <ChevronDown size={16} />
          </div>
        </button>
        <button class="btn-close" on:click={() => dispatch('close')} aria-label="Close sidebar">
          <X size={18} />
        </button>
      </div>
    {/if}

    {#if componentsExpanded}
      <div class="search-box">
        <div class="search-icon">
          <Search size={16} />
        </div>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search components..."
          class="search-input"
        />
        {#if searchQuery}
          <button
            class="btn-clear-search"
            on:click={() => {
              searchQuery = '';
            }}
            aria-label="Clear search"
            title="Clear search"
          >
            <X size={14} />
          </button>
        {/if}
      </div>

      <div class="categories">
        {#each categories as category}
          <button
            class="category-btn"
            class:active={activeCategory === category.id}
            on:click={() => {
              activeCategory = category.id;
            }}
            title={category.name}
          >
            <svelte:component this={category.icon} size={16} />
            <span>{category.name}</span>
          </button>
        {/each}
      </div>

      {#if searchQuery || activeCategory !== 'all'}
        <div class="filter-status">
          <span class="result-count"
            >{filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''}</span
          >
          {#if searchQuery || activeCategory !== 'all'}
            <button
              class="btn-clear-filters"
              on:click={() => {
                searchQuery = '';
                activeCategory = 'all';
              }}
            >
              Clear filters
            </button>
          {/if}
        </div>
      {/if}

      <div class="component-list">
        {#if filteredComponents.length === 0}
          <div class="no-results">
            <p>No components found</p>
            {#if searchQuery.trim()}
              <p class="hint">Try a different search term</p>
            {/if}
          </div>
        {:else}
          {#each filteredComponents as componentItem}
            <div
              class="component-item"
              role="listitem"
              on:touchmove={handleComponentTouchMove}
              on:touchend={handleComponentTouchEnd}
              on:touchcancel={handleComponentTouchCancel}
            >
              <button
                class="component-item-content"
                on:click={() => addComponent(componentItem.type)}
              >
                <div class="component-icon">
                  <svelte:component this={componentItem.icon} size={20} />
                </div>
                <div class="component-info">
                  <div class="component-name">{componentItem.name}</div>
                  <div class="component-description">{componentItem.description}</div>
                </div>
              </button>
              <!-- Mobile drag handle (right side) -->
              <div
                class="component-drag-handle"
                role="button"
                tabindex="-1"
                aria-label="Drag {componentItem.name} to canvas"
                draggable="true"
                on:dragstart={(e) => {
                  if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('component-type', componentItem.type);
                    e.dataTransfer.setData('text/plain', componentItem.name);
                  }
                  dispatch('componentDragStart');
                }}
                on:dragend={() => dispatch('componentDragEnd')}
                on:touchstart={(e) => handleDragHandleTouchStart(e, componentItem.type)}
              >
                <GripVertical size={18} />
              </div>
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</aside>

<style>
  .builder-sidebar {
    width: 280px;
    height: 100%;
    background: var(--color-bg-primary);
    border-right: 1px solid var(--color-border-secondary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .page-settings-section {
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .components-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-bottom: 1px solid var(--color-border-secondary);
    overflow: hidden;
  }

  .page-settings-section {
    background: var(--color-bg-secondary);
  }

  .section-header,
  .section-header-inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 1rem;
    background: none;
    /* Inherit, or the global filled-button colour makes this unreadable. */
    color: inherit;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
    text-align: left;
  }

  .section-header:hover,
  .section-header-inline:hover {
    background: var(--color-bg-tertiary);
  }

  .section-header h4,
  .section-header-inline h3 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .chevron {
    display: flex;
    align-items: center;
    color: var(--color-text-secondary);
    transition: transform 0.2s;
    transform: rotate(-90deg);
  }

  .chevron.expanded {
    transform: rotate(0deg);
  }

  .section-content {
    padding: 0 1rem 1rem 1rem;
  }

  .setting-group {
    margin-bottom: 0.75rem;
  }

  .setting-group:last-child {
    margin-bottom: 0;
  }

  .setting-label {
    display: block;
    margin-bottom: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .setting-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    transition: all 0.2s;
    box-sizing: border-box;
  }

  .setting-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .setting-input.readonly {
    opacity: 0.7;
    cursor: not-allowed;
    background: var(--color-bg-tertiary);
  }

  .setting-input.readonly:focus {
    border-color: var(--color-border-secondary);
  }

  .btn-properties {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    margin-top: 0.75rem;
    padding: 0.625rem 1rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-properties:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .btn-properties:active {
    transform: translateY(0);
  }

  .btn-properties svg {
    flex-shrink: 0;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .section-header-inline {
    flex: 1;
    padding: 1rem;
  }

  .btn-close {
    display: none;
    padding: 0.25rem;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .btn-close:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border-secondary);
    position: relative;
  }

  .search-icon {
    display: flex;
    align-items: center;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-primary);
    background: var(--color-bg-primary);
  }

  .btn-clear-search {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .btn-clear-search:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .categories {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .category-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    background: transparent;
    border: 1px solid var(--color-border-secondary);
    border-radius: 999px;
    color: var(--color-text-primary);
    font-size: 0.6875rem;
    font-weight: 500;
    line-height: 1.2;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .category-btn:hover:not(.active) {
    background: var(--color-bg-secondary);
    border-color: var(--color-text-secondary);
  }

  .category-btn.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .filter-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .result-count {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .btn-clear-filters {
    padding: 0.25rem 0.5rem;
    background: none;
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-clear-filters:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border-color: var(--color-text-secondary);
  }

  .component-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.5rem;
    scrollbar-width: thin;
  }

  .component-list::-webkit-scrollbar {
    width: 6px;
  }

  .component-list::-webkit-scrollbar-track {
    background: var(--color-bg-secondary);
  }

  .component-list::-webkit-scrollbar-thumb {
    background: var(--color-border-secondary);
    border-radius: 3px;
  }

  .component-list::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-secondary);
  }

  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    color: var(--color-text-secondary);
  }

  .no-results p {
    margin: 0;
    font-size: 0.875rem;
  }

  .no-results .hint {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .component-item {
    display: flex;
    align-items: center;
    gap: 0;
    width: 100%;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    margin-bottom: 0.5rem;
    transition: all 0.2s;
    overflow: hidden;
  }

  .component-item:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-primary);
  }

  .component-drag-handle {
    display: none; /* Hidden on desktop, shown on mobile */
    align-items: center;
    justify-content: center;
    width: 44px;
    min-width: 44px;
    height: 100%;
    min-height: 60px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    cursor: grab;
    border-left: 1px solid var(--color-border-secondary);
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .component-drag-handle:active {
    cursor: grabbing;
    background: var(--color-primary);
    color: white;
  }

  .component-item-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    padding: 0.75rem;
    background: transparent;
    /* Inherit, or the global filled-button colour makes this unreadable. */
    color: inherit;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .component-item-content:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  .component-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--color-bg-primary);
    border-radius: 6px;
    color: var(--color-primary);
    flex-shrink: 0;
  }

  .component-info {
    flex: 1;
    min-width: 0;
  }

  .component-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-primary);
    margin-bottom: 0.25rem;
  }

  .component-description {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .builder-sidebar {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 10;
      box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
    }

    .btn-close {
      display: block;
    }
  }

  /* Touch-friendly styles for mobile */
  @media (hover: none) and (pointer: coarse) {
    .component-item {
      min-height: 64px;
      /* Allow vertical scrolling - drag only on handle */
      touch-action: pan-y;
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
    }

    .component-drag-handle {
      display: flex;
      touch-action: none; /* Disable touch actions on drag handle */
    }

    .component-item-content {
      padding: 0.875rem 1rem;
    }

    .component-item-content:active {
      background: rgba(0, 0, 0, 0.05);
    }

    .component-icon {
      width: 40px;
      height: 40px;
      min-width: 40px;
    }

    .component-name {
      font-size: 1rem;
    }

    .component-description {
      font-size: 0.8125rem;
    }

    .category-btn {
      min-height: 44px;
      padding: 0.75rem;
    }
  }
</style>
