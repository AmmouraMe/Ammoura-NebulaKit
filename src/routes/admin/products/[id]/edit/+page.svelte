<script lang="ts">
  import ProductForm from '$lib/components/admin/ProductForm.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<svelte:head>
  <title>Edit Product - Ammoura Admin</title>
</svelte:head>

<div class="edit-product-page">
  <div class="page-header">
    <div class="header-content">
      <div class="header-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
            stroke-width="2"
          ></path>
        </svg>
      </div>
      <div>
        <h1>Edit Product</h1>
        <p>Update product information</p>
      </div>
    </div>
    <a href="/admin/products" class="back-link">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M19 12H5M12 19l-7-7 7-7"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>
      </svg>
      Back to Products
    </a>
  </div>

  <ProductForm
    isEditing={true}
    product={data.product}
    revisions={data.revisions || []}
    initialCurrentRevisionId={data.currentRevisionId}
    initialCurrentRevisionIsPublished={data.currentRevisionIsPublished}
  />
</div>

<style>
  .edit-product-page {
    width: 100%;
    padding: 2rem 1rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid var(--color-border-secondary);
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: linear-gradient(
      135deg,
      var(--color-secondary) 0%,
      var(--color-secondary-hover) 100%
    );
    border-radius: 16px;
    color: white;
    box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3);
  }

  h1 {
    color: var(--color-text-primary);
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 0.25rem 0;
    transition: color var(--transition-normal);
    letter-spacing: -0.5px;
  }

  .page-header p {
    color: var(--color-text-secondary);
    margin: 0;
    font-size: 1rem;
  }

  .back-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    text-decoration: none;
    border-radius: 8px;
    font-weight: 500;
    font-size: 0.875rem;
    transition: all var(--transition-normal);
    border: 1px solid var(--color-border-secondary);
  }

  .back-link:hover {
    background: var(--color-bg-accent);
    transform: translateX(-4px);
    box-shadow: 0 2px 8px var(--color-shadow-light);
  }

  @media (max-width: 768px) {
    .edit-product-page {
      padding: 1rem;
    }

    .page-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .header-icon {
      width: 48px;
      height: 48px;
    }

    .header-icon svg {
      width: 24px;
      height: 24px;
    }

    h1 {
      font-size: 1.75rem;
    }

    .back-link {
      width: 100%;
      justify-content: center;
    }
  }
</style>
