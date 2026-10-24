<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import ProductCard from '$lib/components/ProductCard.svelte';
  import type { WidgetConfig } from '$lib/types/pages';
  import type { Product } from '$lib/types';

  export let config: WidgetConfig;

  let products: Product[] = [];
  let loading = true;
  let error = false;

  $: category = config.category || '';
  $: limit = config.limit || 6;
  $: sortBy = config.sortBy || 'created_at';
  $: sortOrder = config.sortOrder || 'desc';

  onMount(async () => {
    try {
      // Build query params
      const params = new URLSearchParams();
      if (category) {
        params.set('category', category);
      }
      params.set('limit', limit.toString());
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('pricing', 'shopper');

      const response = await fetch(`/api/products?${params}`);
      if (response.ok) {
        const data = (await response.json()) as Product[];
        products = data;
      } else {
        error = true;
      }
    } catch (err) {
      console.error('Error loading products:', err);
      error = true;
    } finally {
      loading = false;
    }
  });
</script>

<div class="product-list-widget" id={config.anchorName || undefined}>
  {#if loading}
    <div class="loading">{$t('products.loading')}</div>
  {:else if error}
    <div class="error">{$t('products.loadFailed')}</div>
  {:else if products.length === 0}
    <div class="empty">{$t('products.none')}</div>
  {:else}
    <div class="product-grid">
      {#each products as product}
        <ProductCard {product} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .product-list-widget {
    padding: 1rem 0;
  }

  .product-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .loading,
  .error,
  .empty {
    padding: 2rem;
    text-align: center;
    color: var(--color-text-secondary);
    background: var(--color-bg-secondary);
    border-radius: 8px;
    transition:
      color var(--transition-normal),
      background-color var(--transition-normal);
  }

  .error {
    color: var(--color-danger);
  }

  @media (max-width: 768px) {
    .product-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
