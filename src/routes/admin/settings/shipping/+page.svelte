<script lang="ts">
  import { onMount } from 'svelte';
  import { confirmStore } from '$lib/stores/confirm';
  import { toastStore } from '$lib/stores/toast';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
  import type { ShippingOption } from '$lib/types/shipping';

  let shippingOptions: ShippingOption[] = [];
  let loading = true;
  let showModal = false;
  let editingOption: ShippingOption | null = null;

  // Form fields
  let formName = '';
  let formDescription = '';
  let formPrice = 0;
  let formEstimatedDaysMin: number | null = null;
  let formEstimatedDaysMax: number | null = null;
  let formCarrier = '';
  let formFreeShippingThreshold: number | null = null;
  let formIsActive = true;

  onMount(async () => {
    await loadShippingOptions();
  });

  async function loadShippingOptions() {
    try {
      loading = true;
      const response = await fetch('/api/admin/shipping');
      if (!response.ok) {
        throw new Error('Failed to load shipping options');
      }
      shippingOptions = await response.json();
    } catch (error) {
      console.error('Error loading shipping options:', error);
      toastStore.error('Failed to load shipping options');
    } finally {
      loading = false;
    }
  }

  function openCreateModal() {
    editingOption = null;
    formName = '';
    formDescription = '';
    formPrice = 0;
    formEstimatedDaysMin = null;
    formEstimatedDaysMax = null;
    formCarrier = '';
    formFreeShippingThreshold = null;
    formIsActive = true;
    showModal = true;
  }

  function openEditModal(option: ShippingOption) {
    editingOption = option;
    formName = option.name;
    formDescription = option.description || '';
    formPrice = option.price;
    formEstimatedDaysMin = option.estimatedDaysMin;
    formEstimatedDaysMax = option.estimatedDaysMax;
    formCarrier = option.carrier || '';
    formFreeShippingThreshold = option.freeShippingThreshold;
    formIsActive = option.isActive;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingOption = null;
  }

  async function handleSubmit() {
    if (!formName || formPrice < 0) {
      toastStore.error('Please fill in all required fields');
      return;
    }

    try {
      const data = {
        name: formName,
        description: formDescription || undefined,
        price: formPrice,
        estimatedDaysMin: formEstimatedDaysMin || undefined,
        estimatedDaysMax: formEstimatedDaysMax || undefined,
        carrier: formCarrier || undefined,
        freeShippingThreshold: formFreeShippingThreshold || undefined,
        isActive: formIsActive
      };

      if (editingOption) {
        // Update existing
        const response = await fetch('/api/admin/shipping', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingOption.id, ...data })
        });

        if (!response.ok) {
          throw new Error('Failed to update shipping option');
        }

        toastStore.success('Shipping option updated successfully');
      } else {
        // Create new
        const response = await fetch('/api/admin/shipping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          throw new Error('Failed to create shipping option');
        }

        toastStore.success('Shipping option created successfully');
      }

      closeModal();
      await loadShippingOptions();
    } catch (error) {
      console.error('Error saving shipping option:', error);
      toastStore.error('Failed to save shipping option');
    }
  }

  async function handleDelete(option: ShippingOption) {
    const confirmed = await confirmStore.show(`Are you sure you want to delete "${option.name}"?`, {
      title: 'Delete Shipping Option',
      confirmText: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch('/api/admin/shipping', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: option.id })
      });

      if (!response.ok) {
        throw new Error('Failed to delete shipping option');
      }

      toastStore.success('Shipping option deleted successfully');
      await loadShippingOptions();
    } catch (error) {
      console.error('Error deleting shipping option:', error);
      toastStore.error('Failed to delete shipping option');
    }
  }

  function formatDays(min: number | null, max: number | null): string {
    if (!min && !max) return 'N/A';
    if (min === max) return `${min} day${min === 1 ? '' : 's'}`;
    if (min && max) return `${min}-${max} days`;
    if (min) return `${min}+ days`;
    if (max) return `Up to ${max} days`;
    return 'N/A';
  }
</script>

<svelte:head>
  <title>Shipping Settings - Ammoura Admin</title>
</svelte:head>

<div class="shipping-settings-page">
  <div class="page-header">
    <div>
      <h1>Shipping Options</h1>
      <p>Manage global shipping methods available for products</p>
    </div>
    <button class="btn-primary" on:click={openCreateModal}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round" />
      </svg>
      Add Shipping Option
    </button>
  </div>

  {#if loading}
    <div class="loading">Loading shipping options...</div>
  {:else if shippingOptions.length === 0}
    <div class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M20 7h-9M14 17h6M6.9 20h10.2c1.68 0 2.52 0 3.16-.33a3 3 0 0 0 1.31-1.3c.33-.65.33-1.49.33-3.17V8.8c0-1.68 0-2.52-.33-3.16a3 3 0 0 0-1.3-1.31C19.61 4 18.77 4 17.09 4H6.9c-1.68 0-2.52 0-3.16.33a3 3 0 0 0-1.31 1.3C2.1 6.29 2.1 7.13 2.1 8.81v6.38c0 1.68 0 2.52.33 3.16a3 3 0 0 0 1.3 1.32c.65.33 1.49.33 3.17.33Z"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
      <h2>No shipping options yet</h2>
      <p>Create your first shipping option to get started</p>
      <button class="btn-primary" on:click={openCreateModal}>Add Shipping Option</button>
    </div>
  {:else}
    <div class="shipping-list">
      {#each shippingOptions as option}
        <div class="shipping-card">
          <div class="shipping-header">
            <div>
              <h3>{option.name}</h3>
              {#if option.description}
                <p class="description">{option.description}</p>
              {/if}
            </div>
            <span class="status" class:active={option.isActive} class:inactive={!option.isActive}>
              {option.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div class="shipping-details">
            <div class="detail-item">
              <span class="label">Price</span>
              <span class="value">${option.price.toFixed(2)}</span>
            </div>
            <div class="detail-item">
              <span class="label">Delivery Time</span>
              <span class="value"
                >{formatDays(option.estimatedDaysMin, option.estimatedDaysMax)}</span
              >
            </div>
            {#if option.carrier}
              <div class="detail-item">
                <span class="label">Carrier</span>
                <span class="value">{option.carrier}</span>
              </div>
            {/if}
            {#if option.freeShippingThreshold}
              <div class="detail-item">
                <span class="label">Free Shipping</span>
                <span class="value">Orders over ${option.freeShippingThreshold.toFixed(2)}</span>
              </div>
            {/if}
          </div>

          <div class="shipping-actions">
            <button class="btn-secondary" on:click={() => openEditModal(option)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                  stroke-width="2"
                />
              </svg>
              Edit
            </button>
            <button class="btn-danger" on:click={() => handleDelete(option)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showModal}
  <!-- Modal backdrop -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={closeModal}></div>

  <!-- Modal -->
  <div class="modal">
    <div class="modal-header">
      <h2>{editingOption ? 'Edit Shipping Option' : 'Create Shipping Option'}</h2>
      <button class="close-btn" on:click={closeModal}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label for="name">Name *</label>
        <input type="text" id="name" bind:value={formName} required />
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea id="description" bind:value={formDescription} rows="2"></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="price">Price *</label>
          <input type="number" id="price" bind:value={formPrice} min="0" step="0.01" required />
        </div>

        <div class="form-group">
          <label for="carrier">Carrier</label>
          <input
            type="text"
            id="carrier"
            bind:value={formCarrier}
            placeholder="e.g., USPS, FedEx"
          />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="minDays">Min Days</label>
          <input type="number" id="minDays" bind:value={formEstimatedDaysMin} min="0" />
        </div>

        <div class="form-group">
          <label for="maxDays">Max Days</label>
          <input type="number" id="maxDays" bind:value={formEstimatedDaysMax} min="0" />
        </div>
      </div>

      <div class="form-group">
        <label for="threshold">Free Shipping Threshold</label>
        <input
          type="number"
          id="threshold"
          bind:value={formFreeShippingThreshold}
          min="0"
          step="0.01"
          placeholder="Leave empty for no free shipping"
        />
      </div>

      <div class="form-group">
        <ToggleSwitch bind:checked={formIsActive} label="Active" />
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" on:click={closeModal}>Cancel</button>
        <button type="submit" class="btn-primary">
          {editingOption ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  </div>
{/if}

<style>
  .shipping-settings-page {
    width: 100%;
    padding: 2rem 1rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    gap: 1rem;
    flex-wrap: wrap;
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

  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-secondary);
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
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
    color: var(--color-text-secondary);
    margin-bottom: 1.5rem;
  }

  .shipping-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .shipping-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 12px;
    padding: 1.5rem;
    transition: all var(--transition-normal);
  }

  .shipping-card:hover {
    box-shadow: 0 4px 12px var(--color-shadow-medium);
    transform: translateY(-2px);
  }

  .shipping-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
  }

  .shipping-header h3 {
    color: var(--color-text-primary);
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
  }

  .description {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    margin: 0;
  }

  .status {
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .status.active {
    background: var(--color-success-bg);
    color: var(--color-success);
  }

  .status.inactive {
    background: var(--color-error-bg);
    color: var(--color-error);
  }

  .shipping-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding: 1rem;
    background: var(--color-bg-tertiary);
    border-radius: 8px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .label {
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: 600;
  }

  .value {
    color: var(--color-text-primary);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .shipping-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
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
  }

  .btn-primary {
    background: var(--color-secondary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-secondary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3);
  }

  .btn-secondary {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-secondary);
    flex: 1;
  }

  .btn-secondary:hover {
    background: var(--color-bg-accent);
  }

  .btn-danger {
    background: var(--color-error-bg);
    color: var(--color-error);
    flex: 1;
  }

  .btn-danger:hover {
    background: var(--color-error);
    color: white;
  }

  /* Modal */
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
    color: var(--color-text-primary);
  }

  form {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    color: var(--color-text-primary);
    font-weight: 600;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    transition: all var(--transition-normal);
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--color-secondary);
    box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.1);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border-secondary);
  }

  @media (max-width: 768px) {
    .shipping-list {
      grid-template-columns: 1fr;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .modal {
      width: 95%;
    }
  }
</style>
