<script lang="ts">
  /**
   * PageWithLayout - Renders a page within its layout
   *
   * Note: The root layout (+layout.svelte) already handles navbar and footer rendering globally.
   * This component focuses on:
   * 1. Rendering page content at the yield position in the layout
   * 2. Rendering any additional layout components (spacers, dividers, etc.) around the page content
   *
   * Layout components of type 'component_ref' that reference navbar/footer are skipped here
   * because they're already rendered by the root layout.
   */
  import type { PageComponent, LayoutWidget } from '$lib/types/pages';
  import type { SiteContext } from '$lib/utils/templateSubstitution';
  import FrontendComponentRenderer from '$lib/components/FrontendComponentRenderer.svelte';
  import MotionBox from '$lib/components/MotionBox.svelte';
  import { buildComponentTree } from '$lib/utils/componentTree';

  // User type for visibility filtering
  interface UserInfo {
    id?: number | string;
    email?: string;
    name?: string;
    role?: string;
    roles?: string[];
  }

  export let layoutComponents: LayoutWidget[] = [];
  export let pageComponents: PageComponent[] = [];
  export let pageTitle: string;
  export let colorTheme: string = 'vibrant';
  export let siteContext: SiteContext | undefined = undefined;
  // Page-level override for showing title (from pageProperties.showPageTitle)
  // undefined means use layout setting, true/false is an explicit override
  export let pageShowPageTitle: boolean | undefined = undefined;
  export let user: UserInfo | null | undefined = undefined; // For visibility filtering

  // Sort layout components by position
  $: sortedLayoutComponents = [...layoutComponents].sort((a, b) => a.position - b.position);

  // Build component tree (nesting children into parent configs) and sort by position
  $: sortedPageComponents = buildComponentTree(pageComponents);

  // Check if there's a yield component in the layout
  $: _hasYield = sortedLayoutComponents.some((c) => c.type === 'yield');

  // Find the yield component to get its showPageTitle config
  $: yieldComponent = sortedLayoutComponents.find((c) => c.type === 'yield');
  // Get the layout's showPageTitle setting from yield config (default: false)
  $: layoutShowPageTitle = yieldComponent?.config?.showPageTitle ?? false;

  // Compute effective showPageTitle:
  // 1. If page has explicit setting, use it
  // 2. Otherwise, use layout yield setting
  // 3. Default is false (don't show title)
  $: showPageTitle = pageShowPageTitle !== undefined ? pageShowPageTitle : layoutShowPageTitle;

  // Filter out component_ref types (navbar/footer are handled by root layout)
  // and only keep layout components we can render or the yield placeholder
  $: renderableLayoutComponents = sortedLayoutComponents.filter(
    (c) => c.type !== 'component_ref' && c.type !== 'navbar' && c.type !== 'footer'
  );
</script>

<div class="page-with-layout">
  {#if renderableLayoutComponents.length > 0}
    <!-- Render layout components (excluding navbar/footer which are handled by root layout) -->
    {#each renderableLayoutComponents as layoutComponent (layoutComponent.id)}
      <div class="layout-component" data-component-type={layoutComponent.type}>
        {#if layoutComponent.type === 'yield'}
          <!-- Yield component: render page content here -->
          <div class="page-content-area">
            {#if showPageTitle}
              <h1 class="page-title">{pageTitle}</h1>
            {/if}
            {#if sortedPageComponents.length > 0}
              <div class="page-components">
                {#each sortedPageComponents as component (component.id)}
                  <MotionBox
                    class="component-container"
                    componentType={component.type}
                    motion={component.config?.motion}
                    ambient={component.config?.ambient}
                    scrollEffect={component.config?.scrollEffect}
                  >
                    <FrontendComponentRenderer
                      type={component.type}
                      config={component.config}
                      {colorTheme}
                      {siteContext}
                      {user}
                    />
                  </MotionBox>
                {/each}
              </div>
            {:else}
              <slot />
            {/if}
          </div>
        {:else}
          <!-- Other layout components (spacer, divider, etc.) -->
          <FrontendComponentRenderer
            type={layoutComponent.type}
            config={layoutComponent.config}
            {colorTheme}
            {siteContext}
            {user}
          />
        {/if}
      </div>
    {/each}
  {:else}
    <!-- No layout: render page content directly -->
    <div class="page-content-area no-layout">
      {#if showPageTitle}
        <h1 class="page-title">{pageTitle}</h1>
      {/if}
      {#if sortedPageComponents.length > 0}
        <div class="page-components">
          {#each sortedPageComponents as component (component.id)}
            <MotionBox
              class="component-container"
              componentType={component.type}
              motion={component.config?.motion}
              ambient={component.config?.ambient}
              scrollEffect={component.config?.scrollEffect}
            >
              <FrontendComponentRenderer
                type={component.type}
                config={component.config}
                {colorTheme}
                {siteContext}
                {user}
              />
            </MotionBox>
          {/each}
        </div>
      {:else}
        <slot />
      {/if}
    </div>
  {/if}
</div>

<style>
  .page-with-layout {
    width: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .layout-component {
    width: 100%;
  }

  .page-content-area {
    flex: 1;
    width: 100%;
    margin: 0 auto;
    padding: 2rem;
  }

  .page-content-area.no-layout {
    background: var(--theme-background, var(--color-bg-primary));
  }

  .page-title {
    color: var(--color-text-primary);
    font-size: 2.5rem;
    margin: 0 0 2rem 0;
    transition: color var(--transition-normal);
  }

  .page-components {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* `:global` because .component-container is now emitted by MotionBox, and a
     scoped rule is only kept for elements Svelte can see in this file's markup. */
  :global(.component-container) {
    width: 100%;
  }

  @media (max-width: 768px) {
    .page-content-area {
      padding: 1rem;
    }

    .page-title {
      font-size: 2rem;
    }
  }
</style>
