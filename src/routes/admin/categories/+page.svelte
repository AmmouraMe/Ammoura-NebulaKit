<script lang="ts">
  import { onMount } from 'svelte';
  import { toastStore } from '$lib/stores/toast';
  import type { ShippingOption } from '$lib/types/shipping';

  let categories: string[] = [];
  let categoryShipping: Map<string, { options: string[]; default: string | null }> = new Map();
  let allShippingOptions: ShippingOption[] = [];
  let loading = true;
  let selectedCategory: string | null = null;
  let selectedShippingOptions: Set<string> = new Set();
  let defaultShippingOption: string | null = null;
  let showModal = false;

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    try {
      loading = true;

      // Load all categories
      const categoriesResponse = await fetch('/api/admin/categories');
      if (categoriesResponse.ok) {
        categories = await categoriesResponse.json();
      }

      // Load all shipping options
      const shippingResponse = await fetch('/api/admin/shipping');
      if (shippingResponse.ok) {
        allShippingOptions = await shippingResponse.json();
      }

      // Load category shipping assignments
      for (const category of categories) {
        const response = await fetch(
          `/api/admin/categories/${encodeURIComponent(category)}/shipping`
        );
        if (response.ok) {
          const data = (await response.json()) as Array<{
            shippingOptionId: string;
            isDefault: boolean;
          }>;
          categoryShipping.set(category, {
            options: data.map((d) => d.shippingOptionId),
            default: data.find((d) => d.isDefault)?.shippingOptionId || null
          });
        }
      }

      categoryShipping = new Map(categoryShipping);
    } catch (error) {
      console.error('Error loading data:', error);
      toastStore.error('Failed to load categories');
    } finally {
      loading = false;
    }
  }

  function openEditModal(category: string) {
    selectedCategory = category;
    const existing = categoryShipping.get(category);
    selectedShippingOptions = new Set(existing?.options || []);
    defaultShippingOption = existing?.default || null;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedCategory = null;
    selectedShippingOptions = new Set();
    defaultShippingOption = null;
  }

  function toggleShippingOption(optionId: string) {
    if (selectedShippingOptions.has(optionId)) {
      selectedShippingOptions.delete(optionId);
      if (defaultShippingOption === optionId) {
        defaultShippingOption = null;
      }
    } else {
      selectedShippingOptions.add(optionId);
    }
    selectedShippingOptions = new Set(selectedShippingOptions);
  }

  async function saveShipping() {
    if (!selectedCategory) return;

    try {
      const assignments = Array.from(selectedShippingOptions).map((optionId) => ({
        shippingOptionId: optionId,
        isDefault: optionId === defaultShippingOption
      }));

      const response = await fetch(
        `/api/admin/categories/${encodeURIComponent(selectedCategory)}/shipping`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save shipping options');
      }

      toastStore.success('Category shipping options updated');
      closeModal();
      await loadData();
    } catch (error) {
      console.error('Error saving shipping:', error);
      toastStore.error('Failed to save shipping options');
    }
  }

  function getShippingOptionName(id: string): string {
    return allShippingOptions.find((opt) => opt.id === id)?.name || id;
  }
</script>

<svelte:head>
  <title>Category Shipping - Ammoura Admin</title>
</svelte:head>

<div class="category-shipping-page">
  <div class="page-header">
    <div>
      <h1>Category Shipping Options</h1>
      <p>Manage default shipping options for product categories</p>
    </div>
  </div>

  {#if loading}
    <div class="loading">Loading categories...</div>
  {:else if categories.length === 0}
    <div class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M4 7h16M4 7v13a2 2 0 002 2h12a2 2 0 002-2V7M4 7l2-3h12l2 3M10 11v6M14 11v6"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
      <h2>No categories found</h2>
      <p>Categories are automatically created when you add products. Create some products first.</p>
      <a href="/admin/products/add" class="btn-primary">Add Product</a>
    </div>
  {:else}
    <div class="category-list">
      {#each categories as category}
        {@const shipping = categoryShipping.get(category)}
        <div class="category-card">
          <div class="category-header">
            <h3>{category}</h3>
            <span class="shipping-count">
              {shipping?.options.length || 0} shipping {shipping?.options.length === 1
                ? 'option'
                : 'options'}
            </span>
          </div>

          {#if shipping && shipping.options.length > 0}
            <div class="shipping-list">
              {#each shipping.options as optionId}
                <div class="shipping-item">
                  <span class="shipping-name">{getShippingOptionName(optionId)}</span>
                  {#if shipping.default === optionId}
                    <span class="default-badge">Default</span>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="no-shipping">
              No shipping options assigned. Products will need individual assignments.
            </p>
          {/if}

          <button class="btn-secondary" on:click={() => openEditModal(category)}>
            Configure Shipping
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showModal && selectedCategory}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={closeModal}></div>

  <div class="modal">
    <div class="modal-header">
      <h2>Configure Shipping for "{selectedCategory}"</h2>
      <button class="close-btn" on:click={closeModal}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <div class="modal-content">
      <p class="helper-text">
        Select shipping options that will be inherited by all products in this category (unless
        overridden at the product level).
      </p>

      <div class="shipping-options">
        {#each allShippingOptions as option}
          <div class="shipping-option" class:selected={selectedShippingOptions.has(option.id)}>
            <label class="shipping-checkbox">
              <input
                type="checkbox"
                checked={selectedShippingOptions.has(option.id)}
                on:change={() => toggleShippingOption(option.id)}
              />
              <span class="shipping-name">
                {option.name} (${option.price.toFixed(2)})
              </span>
            </label>

            {#if selectedShippingOptions.has(option.id)}
              <label class="default-radio">
                <input
                  type="radio"
                  name="default-shipping"
                  checked={defaultShippingOption === option.id}
                  on:change={() => (defaultShippingOption = option.id)}
                />
                <span>Default</span>
              </label>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-secondary" on:click={closeModal}>Cancel</button>
      <button class="btn-primary" on:click={saveShipping}>Save</button>
    </div>
  </div>
{/if}

<style>
  .category-shipping-page {
    width: 100%;
    padding: 2rem 1rem;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  h1 {
    color: var(--color-text-primary);
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .page-header p {
    color: var(--color-text-secondary);
    margin: 0;
  }

  .loading,
  .empty-state {
    text-align: center;
    padding: 3rem 2rem;
    color: var(--color-text-secondary);
  }

  .empty-state {
    background: var(--color-bg-secondary);
    border-radius: 12px;
    border: 2px dashed var(--color-border-secondary);
  }

  .empty-state svg {
    color: var(--color-text-tertiary);
    margin-bottom: 1rem;
  }

  .empty-state h2 {
    color: var(--color-text-primary);
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .empty-state p {
    margin-bottom: 1.5rem;
  }

  .category-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .category-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 12px;
    padding: 1.5rem;
    transition: all var(--transition-normal);
  }

  .category-card:hover {
    box-shadow: 0 4px 12px var(--color-shadow-medium);
  }

  .category-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .category-header h3 {
    color: var(--color-text-primary);
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .shipping-count {
    color: var(--color-text-tertiary);
    font-size: 0.875rem;
  }

  .shipping-list {
    margin-bottom: 1rem;
  }

  .shipping-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--color-bg-tertiary);
    border-radius: 6px;
    margin-bottom: 0.5rem;
  }

  .shipping-name {
    color: var(--color-text-primary);
    font-size: 0.875rem;
    flex: 1;
  }

  .default-badge {
    padding: 0.125rem 0.5rem;
    background: var(--color-primary-alpha);
    color: var(--color-primary);
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .no-shipping {
    color: var(--color-text-tertiary);
    font-size: 0.875rem;
    font-style: italic;
    margin-bottom: 1rem;
  }

  .btn-primary,
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all var(--transition-normal);
    border: none;
    text-decoration: none;
  }

  .btn-primary {
    background: var(--color-secondary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-secondary-hover);
  }

  .btn-secondary {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-secondary);
    width: 100%;
    justify-content: center;
  }

  .btn-secondary:hover {
    background: var(--color-bg-accent);
  }

  /* Modal styles */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--color-bg-primary);
    border-radius: 16px;
    box-shadow: 0 20px 60px var(--color-shadow-heavy);
    z-index: 101;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .modal-header h2 {
    color: var(--color-text-primary);
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: all var(--transition-normal);
  }

  .close-btn:hover {
    background: var(--color-bg-secondary);
  }

  .modal-content {
    padding: 1.5rem;
  }

  .helper-text {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }

  .shipping-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .shipping-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    border-radius: 6px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    transition: all 0.2s ease;
  }

  .shipping-option.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-alpha);
  }

  .shipping-checkbox {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    flex: 1;
  }

  .shipping-checkbox input[type='checkbox'] {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
  }

  .default-radio {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .default-radio input[type='radio'] {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding: 1.5rem;
    border-top: 1px solid var(--color-border-secondary);
  }

  @media (max-width: 768px) {
    .category-list {
      grid-template-columns: 1fr;
    }

    .modal {
      width: 95%;
    }
  }
</style>
