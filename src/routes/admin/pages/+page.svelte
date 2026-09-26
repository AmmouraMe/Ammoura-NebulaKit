<script lang="ts">
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { confirmStore } from '$lib/stores/confirm';
  import { toastStore } from '$lib/stores/toast';
  import type { PageData } from './$types';
  import type { EnrichedPage } from '$lib/server/db/pages';
  import { LEGAL_BUILTIN_PAGE_SLUGS } from '$lib/utils/editor/pageDefaults';

  export let data: PageData;

  /**
   * The built-in Privacy Policy and Terms of Service ship with generic
   * boilerplate. It names the store, but it is a starting point, and the store
   * owner — not the platform — is responsible for what it says. Say so here so
   * nobody mistakes the placeholder for a policy someone wrote for them.
   */
  function isLegalBuiltin(slug: string): boolean {
    return LEGAL_BUILTIN_PAGE_SLUGS.includes(slug);
  }

  let isDeleting = false;

  function handleCreate(): void {
    goto('/admin/builder');
  }

  function handleEdit(pageId: string): void {
    goto(`/admin/builder/${pageId}`);
  }

  async function handleDelete(pageId: string, pageTitle: string): Promise<void> {
    const confirmed = await confirmStore.show(`Delete page "${pageTitle}"?`, {
      title: 'Delete Page',
      confirmText: 'Delete',
      variant: 'danger'
    });
    if (confirmed) {
      const form = document.getElementById(`delete-page-${pageId}`) as HTMLFormElement;
      if (form) form.requestSubmit();
    }
  }

  function formatDate(timestamp: number): string {
    const normalizedTs = normalizeTimestamp(timestamp);
    return new Date(normalizedTs).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Convert timestamp to milliseconds if needed (Unix timestamps are in seconds)
  function normalizeTimestamp(timestamp: number): number {
    // If timestamp is less than 1e12, it's likely in seconds (Unix epoch)
    // Timestamps after year 2001 in milliseconds would be > 1e12
    return timestamp < 1e12 ? timestamp * 1000 : timestamp;
  }

  function formatRelativeTime(timestamp: number): string {
    const normalizedTs = normalizeTimestamp(timestamp);
    const now = Date.now();
    const diff = now - normalizedTs;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 30) {
      return formatDate(timestamp);
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }

  // Status helpers for enriched pages
  function isPagePublished(page: EnrichedPage): boolean {
    return !!page.published_at || page.status === 'published';
  }

  function hasUnpublishedDraft(page: EnrichedPage): boolean {
    return page.has_unpublished_changes || (!isPagePublished(page) && !!page.draft_at);
  }

  // Normalize slug to ensure proper URL construction
  // The database may store slugs with or without leading slash
  function getPageUrl(slug: string): string {
    // Remove leading slash if present, then add single leading slash
    const normalizedSlug = slug.startsWith('/') ? slug.slice(1) : slug;
    return `/${normalizedSlug}`;
  }

  function getPageStatusInfo(page: EnrichedPage): {
    primary: 'published' | 'draft' | 'new';
    hasChanges: boolean;
  } {
    const published = isPagePublished(page);
    const hasDraft = hasUnpublishedDraft(page);

    if (published && hasDraft) {
      return { primary: 'published', hasChanges: true };
    } else if (published) {
      return { primary: 'published', hasChanges: false };
    } else if (hasDraft) {
      return { primary: 'draft', hasChanges: false };
    } else {
      return { primary: 'new', hasChanges: false };
    }
  }
</script>

<svelte:head>
  <title>Pages - Ammoura Admin</title>
</svelte:head>

<div class="pages-container">
  <div class="page-header">
    <div>
      <h1>Pages</h1>
      <p class="page-description">Create and manage your site pages with the Builder</p>
    </div>
    <button class="btn btn-primary" on:click={handleCreate}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"></path>
      </svg>
      Create Page
    </button>
  </div>

  <!-- Your Pages Section -->
  <section class="pages-section custom-section">
    <div class="section-header">
      <h2>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></path>
          <path d="M14 2v6h6" stroke-width="2" stroke-linecap="round"></path>
        </svg>
        Your Pages
      </h2>
      <p class="section-description">Pages you've created for your site.</p>
    </div>

    {#if data.pages.length === 0}
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
            <path d="M14 2v6h6M12 11v6M9 14h6" stroke-width="1.5" stroke-linecap="round"></path>
          </svg>
        </div>
        <h3>No custom pages yet</h3>
        <p>Create your first page to get started with the Builder</p>
        <button class="btn btn-primary" on:click={handleCreate}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"></path>
          </svg>
          Create Your First Page
        </button>
      </div>
    {:else}
      <div class="pages-grid">
        {#each data.pages as page (page.id)}
          {@const statusInfo = getPageStatusInfo(page)}
          {@const isPublished = isPagePublished(page)}
          <div class="page-card" class:has-pending-changes={statusInfo.hasChanges}>
            <div class="page-card-header">
              <div class="page-icon" class:has-changes={statusInfo.hasChanges}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke-width="2" stroke-linecap="round"
                  ></path>
                </svg>
                {#if statusInfo.hasChanges}
                  <span class="change-indicator" title="Unpublished changes"></span>
                {/if}
              </div>
              <div class="page-info">
                <h3>{page.title}</h3>
                <span class="page-slug">{getPageUrl(page.slug)}</span>
              </div>
              <div class="status-badges">
                {#if statusInfo.primary === 'published'}
                  <span class="status-badge status-published">Published</span>
                {/if}
                {#if statusInfo.hasChanges}
                  <span class="status-badge status-pending" title="Draft has unpublished changes">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                        stroke-width="2"
                        stroke-linecap="round"
                      ></path>
                    </svg>
                    Pending
                  </span>
                {:else if statusInfo.primary === 'draft'}
                  <span class="status-badge status-draft">Draft</span>
                {/if}
              </div>
            </div>

            <!-- Pending changes banner -->
            {#if statusInfo.hasChanges}
              <div class="pending-changes-banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" stroke-width="2"></circle>
                  <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round"
                  ></line>
                  <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" stroke-linecap="round"
                  ></line>
                </svg>
                <span>This page has unpublished changes</span>
              </div>
            {/if}

            <div class="page-meta">
              <div class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" stroke-width="2"></circle>
                  <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"></path>
                </svg>
                <span>Updated {formatRelativeTime(page.updated_at)}</span>
              </div>
              {#if page.published_at && statusInfo.hasChanges}
                <div class="meta-item published-info">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M22 11.08V12a10 10 0 11-5.93-9.14"
                      stroke-width="2"
                      stroke-linecap="round"
                    ></path>
                    <path
                      d="M22 4L12 14.01l-3-3"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>
                  </svg>
                  <span>Published {formatRelativeTime(page.published_at)}</span>
                </div>
              {:else if page.draft_at && !isPublished}
                <div class="meta-item draft-info">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                      stroke-width="2"
                      stroke-linecap="round"
                    ></path>
                    <path
                      d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                      stroke-width="2"
                      stroke-linecap="round"
                    ></path>
                  </svg>
                  <span>Draft saved {formatRelativeTime(page.draft_at)}</span>
                </div>
              {:else}
                <div class="meta-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-width="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6" stroke-width="2" stroke-linecap="round"
                    ></line>
                    <line x1="8" y1="2" x2="8" y2="6" stroke-width="2" stroke-linecap="round"
                    ></line>
                    <line x1="3" y1="10" x2="21" y2="10" stroke-width="2"></line>
                  </svg>
                  <span>Created {formatDate(page.created_at)}</span>
                </div>
              {/if}
            </div>

            <div class="page-actions">
              <button class="btn btn-secondary" on:click={() => handleEdit(page.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <path
                    d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                Edit
              </button>
              {#if isPublished}
                <a
                  href={getPageUrl(page.slug)}
                  target="_blank"
                  class="btn btn-outline"
                  title="View published version"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>
                    <polyline
                      points="15,3 21,3 21,9"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></polyline>
                    <line
                      x1="10"
                      y1="14"
                      x2="21"
                      y2="3"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></line>
                  </svg>
                  View
                </a>
              {/if}
              {#if statusInfo.hasChanges || !isPublished}
                <a
                  href="{getPageUrl(page.slug)}?preview"
                  target="_blank"
                  class="btn btn-preview"
                  title="Preview draft version"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>
                    <circle cx="12" cy="12" r="3" stroke-width="2"></circle>
                  </svg>
                  Preview
                </a>
              {/if}
              <form
                id="delete-page-{page.id}"
                method="POST"
                action="?/delete"
                use:enhance={() => {
                  isDeleting = true;
                  return async ({ result, update }) => {
                    if (result.type === 'failure' && result.data && 'error' in result.data) {
                      toastStore.error(String(result.data.error) || 'Failed to delete page');
                    } else if (result.type === 'failure') {
                      toastStore.error('Failed to delete page');
                    }
                    await update();
                    isDeleting = false;
                  };
                }}
              >
                <input type="hidden" name="pageId" value={page.id} />
                <button
                  type="button"
                  class="btn btn-danger"
                  disabled={isDeleting}
                  on:click={() => handleDelete(page.id, page.title)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>
                  </svg>
                  Delete
                </button>
              </form>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Built-in Pages Section -->
  {#if data.builtInPages && data.builtInPages.length > 0}
    <section class="pages-section builtin-section">
      <div class="section-header">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
            <polyline
              points="9,22 9,12 15,12 15,22"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></polyline>
          </svg>
          Built-in Pages
        </h2>
        <p class="section-description">
          System pages that come with your site. These can be customized but not deleted.
        </p>
      </div>
      <div class="pages-grid">
        {#each data.builtInPages as page (page.id)}
          {@const statusInfo = getPageStatusInfo(page)}
          {@const isPublished = isPagePublished(page)}
          <div class="page-card builtin-card" class:has-pending-changes={statusInfo.hasChanges}>
            <div class="page-card-header">
              <div class="page-icon builtin-icon" class:has-changes={statusInfo.hasChanges}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <polyline
                    points="9,22 9,12 15,12 15,22"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></polyline>
                </svg>
                {#if statusInfo.hasChanges}
                  <span class="change-indicator" title="Unpublished changes"></span>
                {/if}
              </div>
              <div class="page-info">
                <h3>{page.title}</h3>
                <span class="page-slug">{getPageUrl(page.slug)}</span>
              </div>
              <div class="status-badges">
                {#if statusInfo.primary === 'published'}
                  <span class="status-badge status-published">Published</span>
                {/if}
                {#if statusInfo.hasChanges}
                  <span class="status-badge status-pending" title="Draft has unpublished changes">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                        stroke-width="2"
                        stroke-linecap="round"
                      ></path>
                    </svg>
                    Pending
                  </span>
                {:else if statusInfo.primary === 'draft'}
                  <span class="status-badge status-draft">Draft</span>
                {/if}
              </div>
            </div>

            <!-- Pending changes banner -->
            {#if statusInfo.hasChanges}
              <div class="pending-changes-banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" stroke-width="2"></circle>
                  <line x1="12" y1="8" x2="12" y2="12" stroke-width="2" stroke-linecap="round"
                  ></line>
                  <line x1="12" y1="16" x2="12.01" y2="16" stroke-width="2" stroke-linecap="round"
                  ></line>
                </svg>
                <span>This page has unpublished changes</span>
              </div>
            {/if}

            <!-- Legal boilerplate notice -->
            {#if isLegalBuiltin(page.slug)}
              <div class="legal-notice-banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <line x1="12" y1="9" x2="12" y2="13" stroke-width="2" stroke-linecap="round"
                  ></line>
                  <line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2" stroke-linecap="round"
                  ></line>
                </svg>
                <span>
                  Starting template — you are responsible for this policy. Review it, edit it to
                  match how your store actually works, and add your contact details.
                </span>
              </div>
            {/if}

            <div class="page-meta">
              <div class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" stroke-width="2"></circle>
                  <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"></path>
                </svg>
                <span>Updated {formatRelativeTime(page.updated_at)}</span>
              </div>
              <div class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                <span>System Page</span>
              </div>
            </div>

            <div class="page-actions">
              <button class="btn btn-secondary" on:click={() => handleEdit(page.id)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <path
                    d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                Edit
              </button>
              {#if isPublished}
                <a
                  href={getPageUrl(page.slug)}
                  target="_blank"
                  class="btn btn-outline"
                  title="View published version"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>
                    <polyline
                      points="15,3 21,3 21,9"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></polyline>
                    <line
                      x1="10"
                      y1="14"
                      x2="21"
                      y2="3"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></line>
                  </svg>
                  View
                </a>
              {/if}
              {#if statusInfo.hasChanges || !isPublished}
                <a
                  href="{getPageUrl(page.slug)}?preview"
                  target="_blank"
                  class="btn btn-preview"
                  title="Preview draft version"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>
                    <circle cx="12" cy="12" r="3" stroke-width="2"></circle>
                  </svg>
                  Preview
                </a>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  /* Mobile-first styles */
  .pages-container {
    width: 100%;
  }

  .page-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .page-header h1 {
    color: var(--color-text-primary);
    font-size: 1.5rem;
    margin: 0 0 0.5rem 0;
    transition: color var(--transition-normal);
  }

  .page-description {
    color: var(--color-text-secondary);
    margin: 0;
    font-size: 0.875rem;
    transition: color var(--transition-normal);
  }

  /* Button styles */
  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border: none;
    border-radius: 8px;
    font-weight: 500;
    font-size: 0.9375rem;
    text-decoration: none;
    cursor: pointer;
    width: 100%;
    transition:
      background-color var(--transition-normal),
      transform var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .btn-primary {
    background: var(--color-primary);
    color: var(--color-text-inverse);
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-secondary {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-secondary);
    width: auto;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
  }

  .btn-secondary:hover {
    background: var(--color-bg-tertiary);
    transform: none;
    box-shadow: none;
  }

  .btn-outline {
    background: transparent;
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-secondary);
    width: auto;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
  }

  .btn-outline:hover {
    background: var(--color-bg-secondary);
    transform: none;
    box-shadow: none;
  }

  .btn-danger {
    background: var(--color-error);
    color: white;
    width: auto;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
  }

  .btn-danger:hover {
    background: var(--color-error-dark);
    transform: none;
    box-shadow: none;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Section styles */
  .pages-section {
    margin-bottom: 2rem;
  }

  .section-header {
    margin-bottom: 1rem;
  }

  .section-header h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text-primary);
    font-size: 1.25rem;
    margin: 0 0 0.25rem 0;
    transition: color var(--transition-normal);
  }

  .section-header h2 svg {
    color: var(--color-text-secondary);
  }

  .section-description {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    margin: 0;
    transition: color var(--transition-normal);
  }

  .builtin-section {
    margin-bottom: 2.5rem;
  }

  .builtin-section .section-header h2 svg {
    color: var(--color-primary);
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    background: var(--color-bg-primary);
    border-radius: 12px;
    border: 2px dashed var(--color-border-secondary);
  }

  .empty-state-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
    border-radius: 20px;
    margin-bottom: 1.5rem;
    box-shadow: 0 8px 24px rgba(var(--color-primary-rgb, 99, 102, 241), 0.3);
  }

  .empty-state-icon svg {
    color: white;
    width: 40px;
    height: 40px;
  }

  .empty-state h3 {
    color: var(--color-text-primary);
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    transition: color var(--transition-normal);
  }

  .empty-state p {
    color: var(--color-text-secondary);
    margin: 0 0 1.5rem 0;
    font-size: 0.875rem;
    transition: color var(--transition-normal);
  }

  .empty-state .btn {
    display: inline-flex;
    width: auto;
  }

  /* Grid layout */
  .pages-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  /* Page card */
  .page-card {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    transition:
      background-color var(--transition-normal),
      border-color var(--transition-normal),
      box-shadow var(--transition-normal),
      transform var(--transition-normal);
  }

  .page-card:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
    border-color: var(--color-primary);
  }

  .builtin-card {
    border-left: 3px solid var(--color-primary);
  }

  .builtin-card:hover {
    border-left-color: var(--color-primary);
  }

  .page-card-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .page-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    min-width: 44px;
    background: var(--color-bg-secondary);
    border-radius: 10px;
    color: var(--color-text-secondary);
    transition: all var(--transition-normal);
  }

  .page-card:hover .page-icon {
    background: var(--color-primary);
    color: white;
  }

  .builtin-icon {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
    color: white;
  }

  .page-card:hover .builtin-icon {
    background: linear-gradient(135deg, var(--color-primary-hover) 0%, var(--color-primary) 100%);
  }

  .page-info {
    flex: 1;
    min-width: 0;
  }

  .page-info h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .page-slug {
    display: inline-block;
    font-size: 0.8125rem;
    color: var(--color-text-tertiary);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    background: var(--color-bg-secondary);
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
  }

  .status-badge {
    padding: 0.25rem 0.625rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    white-space: nowrap;
  }

  .status-published {
    background: rgba(34, 197, 94, 0.15);
    color: #16a34a;
  }

  .status-draft {
    background: rgba(245, 158, 11, 0.15);
    color: #d97706;
  }

  .status-pending {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(59, 130, 246, 0.15);
    color: #2563eb;
    animation: pulse-pending 2s infinite;
  }

  .status-pending svg {
    animation: spin-slow 3s linear infinite;
  }

  @keyframes pulse-pending {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  @keyframes spin-slow {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .status-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  /* Pending changes styling */
  .page-card.has-pending-changes {
    border-color: rgba(59, 130, 246, 0.4);
    background: linear-gradient(135deg, var(--color-bg-primary) 0%, rgba(59, 130, 246, 0.03) 100%);
  }

  .page-card.has-pending-changes:hover {
    border-color: #2563eb;
  }

  .page-icon {
    position: relative;
  }

  .page-icon.has-changes::after {
    content: '';
    position: absolute;
    top: -4px;
    right: -4px;
    width: 12px;
    height: 12px;
    background: #2563eb;
    border-radius: 50%;
    border: 2px solid var(--color-bg-primary);
    animation: pulse-dot 2s infinite;
  }

  @keyframes pulse-dot {
    0%,
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
    }
    50% {
      transform: scale(1.1);
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0);
    }
  }

  .change-indicator {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 12px;
    height: 12px;
    background: #2563eb;
    border-radius: 50%;
    border: 2px solid var(--color-bg-primary);
  }

  .pending-changes-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 8px;
    font-size: 0.8125rem;
    color: #2563eb;
    font-weight: 500;
  }

  .pending-changes-banner svg {
    flex-shrink: 0;
  }

  .legal-notice-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    background: rgba(217, 119, 6, 0.1);
    border: 1px solid rgba(217, 119, 6, 0.25);
    border-radius: 8px;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: #b45309;
    font-weight: 500;
  }

  .legal-notice-banner svg {
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  /* Preview button */
  .btn-preview {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
    border: 1px solid rgba(59, 130, 246, 0.3);
    width: auto;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
  }

  .btn-preview:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: #2563eb;
    transform: none;
    box-shadow: none;
  }

  /* Published info styling */
  .meta-item.published-info svg {
    color: #16a34a;
  }

  .meta-item.draft-info svg {
    color: #d97706;
  }

  .page-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0.75rem 0;
    border-top: 1px solid var(--color-border-secondary);
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
  }

  .meta-item svg {
    color: var(--color-text-tertiary);
  }

  .page-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: auto;
  }

  .page-actions form {
    display: contents;
  }

  /* Tablet and up */
  @media (min-width: 768px) {
    .page-header {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .page-header h1 {
      font-size: 2rem;
    }

    .page-description {
      font-size: 1rem;
    }

    .btn-primary {
      width: auto;
      padding: 0.875rem 1.5rem;
      font-size: 1rem;
    }

    .section-header h2 {
      font-size: 1.5rem;
    }

    .section-description {
      font-size: 1rem;
    }

    .empty-state {
      padding: 4rem 2rem;
    }

    .empty-state-icon {
      width: 96px;
      height: 96px;
      border-radius: 24px;
    }

    .empty-state-icon svg {
      width: 48px;
      height: 48px;
    }

    .empty-state h3 {
      font-size: 1.5rem;
    }

    .empty-state p {
      font-size: 1rem;
      margin-bottom: 2rem;
    }

    .pages-grid {
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1.5rem;
    }

    .page-card {
      padding: 1.5rem;
    }

    .page-icon {
      width: 52px;
      height: 52px;
      min-width: 52px;
    }

    .page-info h3 {
      font-size: 1.125rem;
    }

    .page-actions {
      gap: 0.75rem;
    }
  }

  /* Large screens */
  @media (min-width: 1200px) {
    .pages-grid {
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    }
  }
</style>
