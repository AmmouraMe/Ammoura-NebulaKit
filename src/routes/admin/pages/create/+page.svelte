<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { toastStore } from '$lib/stores/toast';
  import PageEditor from '$lib/components/admin/PageEditor.svelte';
  import type { PageComponent } from '$lib/types/pages';

  // Get URL params for pre-filling
  $: initialTitle = $page.url.searchParams.get('title') || '';
  $: initialSlug = $page.url.searchParams.get('slug') || '';

  async function handleSaveDraft(data: {
    title: string;
    slug: string;
    colorTheme: string | undefined;
    components: PageComponent[];
  }) {
    return handleSave({ ...data, status: 'draft' });
  }

  async function handlePublish(data: {
    title: string;
    slug: string;
    colorTheme: string | undefined;
    components: PageComponent[];
  }) {
    return handleSave({ ...data, status: 'published' });
  }

  async function handleSave(data: {
    title: string;
    slug: string;
    status: 'draft' | 'published';
    colorTheme: string | undefined;
    components: PageComponent[];
  }) {
    try {
      // First, create the page
      const pageResponse = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          slug: data.slug,
          status: data.status,
          colorTheme: data.colorTheme
        })
      });

      if (!pageResponse.ok) {
        const error = await pageResponse.text();
        throw new Error(error || 'Failed to create page');
      }

      const page = (await pageResponse.json()) as { id: string };

      // Then, create all widgets
      for (const widget of data.components) {
        const widgetResponse = await fetch(`/api/pages/${page.id}/widgets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: widget.type,
            config: widget.config,
            position: widget.position
          })
        });

        if (!widgetResponse.ok) {
          console.error('Failed to create widget:', widget.type);
          // Continue creating other widgets even if one fails
        }
      }

      toastStore.success('Page created successfully');
      goto('/admin/pages');
    } catch (error) {
      console.error('Error creating page:', error);
      toastStore.error(error instanceof Error ? error.message : 'Failed to create page');
    }
  }

  function handleCancel() {
    // Navigate to home page since there's no published page yet
    goto('/');
  }
</script>

<svelte:head>
  <title>Create Page - Ammoura Admin</title>
</svelte:head>

<PageEditor
  pageId={null}
  {initialTitle}
  {initialSlug}
  initialStatus="draft"
  initialComponents={[]}
  onSave={handleSave}
  onSaveDraft={handleSaveDraft}
  onPublish={handlePublish}
  onCancel={handleCancel}
/>
