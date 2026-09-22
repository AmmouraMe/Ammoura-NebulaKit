<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { toastStore } from '$lib/stores/toast';
  import type { FulfillmentProvider, ProviderType } from '$lib/types';

  export let data;
  let providers: FulfillmentProvider[] = data.providers;

  // Watch for data updates
  $: providers = data.providers;

  let showAddModal = false;
  let showEditModal = false;
  let showDeleteConfirm = false;
  let selectedProvider: FulfillmentProvider | null = null;
  let isSubmitting = false;

  // Form fields
  let formName = '';
  let formDescription = '';
  let formProviderType: ProviderType = 'manual';
  let formIsActive = true;

  const providerTypeOptions: { value: ProviderType; label: string; description: string }[] = [
    {
      value: 'manual',
      label: 'Manual / Self-Fulfilled',
      description: 'You manage stock, shipping, and pricing yourself.'
    },
    {
      value: 'printful',
      label: 'Printful',
      description: 'Print-on-demand. Printful manages stock, printing, and shipping.'
    }
  ];

  function getProviderTypeLabel(type: ProviderType): string {
    return providerTypeOptions.find((o) => o.value === type)?.label || type;
  }

  function handleAddClick() {
    formName = '';
    formDescription = '';
    formProviderType = 'manual';
    formIsActive = true;
    showAddModal = true;
  }

  function handleEditClick(provider: FulfillmentProvider) {
    selectedProvider = provider;
    formName = provider.name;
    formDescription = provider.description || '';
    formProviderType = provider.providerType;
    formIsActive = provider.isActive;
    showEditModal = true;
  }

  function handleDeleteClick(provider: FulfillmentProvider) {
    selectedProvider = provider;
    showDeleteConfirm = true;
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    if (!formName.trim()) {
      toastStore.error('Provider name is required');
      return;
    }

    isSubmitting = true;

    try {
      const providerData = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        providerType: formProviderType,
        isActive: formIsActive
      };

      if (showEditModal && selectedProvider) {
        const response = await fetch('/api/admin/providers', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ id: selectedProvider.id, ...providerData })
        });

        if (!response.ok) {
          throw new Error('Failed to update provider');
        }

        toastStore.success(`Provider "${formName}" updated successfully`);
      } else {
        const response = await fetch('/api/admin/providers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(providerData)
        });

        if (!response.ok) {
          throw new Error('Failed to create provider');
        }

        toastStore.success(`Provider "${formName}" created successfully`);
      }

      closeModals();
      await invalidateAll();
    } catch (error) {
      console.error('Error saving provider:', error);
      toastStore.error('Failed to save provider');
    } finally {
      isSubmitting = false;
    }
  }

  async function confirmDelete() {
    if (!selectedProvider || isSubmitting) return;

    isSubmitting = true;

    try {
      const response = await fetch('/api/admin/providers', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: selectedProvider.id })
      });

      if (!response.ok) {
        throw new Error('Failed to delete provider');
      }

      toastStore.success(`Provider "${selectedProvider.name}" deleted successfully`);
      closeModals();
      await invalidateAll();
    } catch (error) {
      console.error('Error deleting provider:', error);
      toastStore.error('Failed to delete provider');
    } finally {
      isSubmitting = false;
    }
  }

  function closeModals() {
    showAddModal = false;
    showEditModal = false;
    showDeleteConfirm = false;
    selectedProvider = null;
  }
</script>

<svelte:head>
  <title>Fulfillment Providers - Ammoura Admin</title>
</svelte:head>

<div class="providers-page">
  <div class="page-header">
    <div>
      <h1>Fulfillment Providers</h1>
      <p>Manage fulfillment options for products</p>
    </div>
    <button class="add-btn" on:click={handleAddClick}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"></path>
      </svg>
      Add Provider
    </button>
  </div>

  {#if providers.length === 0}
    <div class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
          stroke-width="2"
        ></path>
      </svg>
      <h2>No Providers Found</h2>
      <p>Get started by adding your first fulfillment provider</p>
    </div>
  {:else}
    <div class="providers-list">
      {#each providers as provider}
        <div class="provider-card">
          <div class="provider-info">
            <div class="provider-header">
              <h3>{provider.name}</h3>
              <span class="badge type-badge {provider.providerType}"
                >{getProviderTypeLabel(provider.providerType)}</span
              >
              {#if provider.isDefault}
                <span class="badge default">Default</span>
              {/if}
              {#if !provider.isActive}
                <span class="badge inactive">Inactive</span>
              {/if}
            </div>
            {#if provider.description}
              <p class="description">{provider.description}</p>
            {/if}
          </div>
          <div class="provider-actions">
            <button class="edit-btn" on:click={() => handleEditClick(provider)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
            {#if !provider.isDefault}
              <button class="delete-btn" on:click={() => handleDeleteClick(provider)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
                Delete
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add/Edit Modal -->
{#if showAddModal || showEditModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={closeModals}></div>
  <div class="modal">
    <div class="modal-header">
      <h2>{showEditModal ? 'Edit Provider' : 'Add Provider'}</h2>
      <button class="close-btn" on:click={closeModals}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round"></path>
        </svg>
      </button>
    </div>
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label for="provider-type">Provider Type *</label>
        <select id="provider-type" bind:value={formProviderType}>
          {#each providerTypeOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        <p class="field-hint">
          {providerTypeOptions.find((o) => o.value === formProviderType)?.description || ''}
        </p>
      </div>

      <div class="form-group">
        <label for="provider-name">Name *</label>
        <input
          type="text"
          id="provider-name"
          bind:value={formName}
          placeholder="Enter provider name"
          required
        />
      </div>

      <div class="form-group">
        <label for="provider-description">Description</label>
        <textarea
          id="provider-description"
          bind:value={formDescription}
          placeholder="Enter provider description (optional)"
          rows="3"
        ></textarea>
      </div>

      <div class="form-group checkbox-group">
        <label>
          <input type="checkbox" bind:checked={formIsActive} />
          <span>Active</span>
        </label>
      </div>

      <div class="modal-actions">
        <button type="button" class="cancel-btn" on:click={closeModals}>Cancel</button>
        <button type="submit" class="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : showEditModal ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && selectedProvider}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={closeModals}></div>
  <div class="modal confirm-modal">
    <div class="modal-header">
      <h2>Delete Provider</h2>
      <button class="close-btn" on:click={closeModals}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round"></path>
        </svg>
      </button>
    </div>
    <p>Are you sure you want to delete the provider "{selectedProvider.name}"?</p>
    <p class="warning">This action cannot be undone.</p>
    <div class="modal-actions">
      <button type="button" class="cancel-btn" on:click={closeModals}>Cancel</button>
      <button
        type="button"
        class="delete-confirm-btn"
        on:click={confirmDelete}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  </div>
{/if}

<style>
  .providers-page {
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

  h1 {
    color: var(--color-text-primary);
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 0.25rem 0;
    letter-spacing: -0.5px;
  }

  .page-header p {
    color: var(--color-text-secondary);
    margin: 0;
    font-size: 1rem;
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-btn:hover {
    background: var(--color-primary-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--color-primary-alpha);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .empty-state svg {
    color: var(--color-text-tertiary);
    margin-bottom: 1.5rem;
  }

  .empty-state h2 {
    color: var(--color-text-primary);
    font-size: 1.5rem;
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    color: var(--color-text-secondary);
    margin: 0;
  }

  .providers-list {
    display: grid;
    gap: 1rem;
  }

  .provider-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    transition: all 0.2s;
  }

  .provider-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px var(--color-shadow-light);
  }

  .provider-info {
    flex: 1;
  }

  .provider-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .provider-card h3 {
    color: var(--color-text-primary);
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge.default {
    background: var(--color-primary-alpha);
    color: var(--color-primary);
  }

  .badge.inactive {
    background: var(--color-text-tertiary-alpha);
    color: var(--color-text-secondary);
  }

  .badge.type-badge {
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border-secondary);
  }

  .badge.type-badge.printful {
    background: #e8f5e9;
    color: #2e7d32;
    border-color: #a5d6a7;
  }

  .description {
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .provider-actions {
    display: flex;
    gap: 0.5rem;
  }

  .edit-btn,
  .delete-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .edit-btn {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .edit-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .delete-btn {
    background: var(--color-bg-tertiary);
    color: var(--color-error);
  }

  .delete-btn:hover {
    border-color: var(--color-error);
    background: var(--color-error-alpha);
  }

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--color-bg-primary);
    border-radius: 12px;
    box-shadow: 0 10px 40px var(--color-shadow-medium);
    z-index: 1001;
    max-width: 500px;
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
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .close-btn:hover {
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
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .form-group input[type='text'],
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 1rem;
    transition: all 0.2s;
  }

  .form-group input[type='text']:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-alpha);
  }

  .field-hint {
    margin: 0.25rem 0 0 0;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .checkbox-group input[type='checkbox'] {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border-secondary);
  }

  .cancel-btn,
  .submit-btn,
  .delete-confirm-btn {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-btn {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-secondary);
    color: var(--color-text-primary);
  }

  .cancel-btn:hover {
    border-color: var(--color-text-secondary);
  }

  .submit-btn {
    background: var(--color-primary);
    border: none;
    color: white;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .delete-confirm-btn {
    background: var(--color-error);
    border: none;
    color: white;
  }

  .delete-confirm-btn:hover:not(:disabled) {
    background: var(--color-error-hover);
  }

  .delete-confirm-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .confirm-modal p {
    padding: 1.5rem;
    color: var(--color-text-primary);
    margin: 0;
    line-height: 1.5;
  }

  .warning {
    color: var(--color-error);
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .provider-card {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .provider-actions {
      width: 100%;
      justify-content: flex-end;
    }
  }
</style>
