<script lang="ts">
  import { DEFAULT_STORE_NAME } from '$lib/branding';
  import PageWithLayout from '$lib/components/PageWithLayout.svelte';
  import DefaultContentEntry from '$lib/components/DefaultContentEntry.svelte';
  import DefaultContentListing from '$lib/components/DefaultContentListing.svelte';
  import { browser } from '$app/environment';
  import { page as pageStore } from '$app/stores';
  import { themeStore } from '$lib/stores/theme';
  import type { PageData } from './$types';

  export let data: PageData;

  // Use reactive declarations to ensure data updates on client-side navigation
  $: ({ page, components, layoutComponents, isPreview, isAdmin: _isAdmin } = data);

  // Determine if we need default CMS rendering (no page builder template assigned)
  $: hasPageBuilderContent = components && components.length > 0;
  $: needsDefaultEntry = !hasPageBuilderContent && data.contentEntry;
  $: needsDefaultListing = !hasPageBuilderContent && data.contentEntries;

  // Get the site context from the parent layout data for template substitution
  $: siteContext = $pageStore.data.siteContext;

  // Get theme IDs from parent layout
  $: systemLightThemeId = $pageStore.data.systemLightThemeId || 'vibrant';
  $: systemDarkThemeId = $pageStore.data.systemDarkThemeId || 'midnight';

  // Get the system's preferred color scheme
  function getSystemTheme(): 'light' | 'dark' {
    if (!browser) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Derive the applied theme mode from the theme preference (reactive to theme store changes)
  // When preference is 'system', use the OS preference
  $: appliedThemeMode =
    $themeStore === 'system' ? getSystemTheme() : ($themeStore as 'light' | 'dark');

  // If no colorTheme is specified, use the site's current theme (reactive)
  $: colorTheme =
    data.colorTheme || (appliedThemeMode === 'dark' ? systemDarkThemeId : systemLightThemeId);
</script>

<svelte:head>
  <title>{page.title} - {data.storeName || DEFAULT_STORE_NAME}</title>
</svelte:head>

{#if isPreview && page.status === 'draft'}
  <div class="preview-banner">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      ></path>
      <circle cx="12" cy="12" r="3" stroke-width="2"></circle>
    </svg>
    <span>Preview Mode - This is a draft page</span>
  </div>
{/if}

<PageWithLayout
  {layoutComponents}
  pageComponents={components}
  pageTitle={page.title}
  {colorTheme}
  {siteContext}
  user={data.currentUser}
  pageShowPageTitle={data.pageShowPageTitle}
>
  {#if needsDefaultEntry && data.contentEntry && data.contentType}
    <DefaultContentEntry entry={data.contentEntry} contentType={data.contentType} />
  {:else if needsDefaultListing && data.contentEntries && data.contentType}
    <DefaultContentListing entries={data.contentEntries} contentType={data.contentType} />
  {/if}
</PageWithLayout>

<style>
  .preview-banner {
    position: sticky;
    top: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--color-warning);
    color: white;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
</style>
