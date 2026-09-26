<script lang="ts">
  import { enhance } from '$app/forms';
  import { toastStore } from '$lib/stores/toast';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
  import type { PageData, ActionData } from './$types';
  import type { OAuthProvider } from '$lib/types/oauth';
  import IconPicker from '$lib/components/admin/IconPicker.svelte';
  import IconDisplay from '$lib/components/admin/IconDisplay.svelte';

  export let data: PageData;
  export let form: ActionData;

  type ProviderConfig = {
    id: string;
    site_id: string;
    provider: OAuthProvider;
    enabled: number;
    client_id: string;
    tenant: string | null;
    display_name: string;
    icon: string;
    sort_order: number;
  };

  let selectedProvider: ProviderConfig | null = null;
  let showAddModal = false;
  let showEditModal = false;

  // Form data for new provider
  let newProvider: OAuthProvider | null = null;
  let newClientId = '';
  let newClientSecret = '';
  let newTenant = '';
  let newIcon = '';
  let newSortOrder = 0;
  let newEnabled = true;

  // Form data for editing
  let editClientId = '';
  let editClientSecret = '';
  let editTenant = '';
  let editIcon = '';

  // Drag and drop state
  let draggedIndex: number | null = null;
  let dragOverIndex: number | null = null;
  let localProviders: ProviderConfig[] = [];

  $: if (form?.success) {
    toastStore.success(form.message || 'Success');
    closeModals();
  }

  $: if (form?.error) {
    toastStore.error(form.error);
  }

  $: enabledProviders = new Set(
    data.providers.filter((p) => p.enabled === 1).map((p) => p.provider)
  );
  $: disabledProviders = data.providers.filter((p) => p.enabled === 0);
  $: disabledProviderSet = new Set(disabledProviders.map((p) => p.provider));
  $: envProviders = data.envProviders || [];
  $: envProviderSet = new Set(envProviders.map((p: { provider: OAuthProvider }) => p.provider));
  $: availableToAdd = data.availableProviders.filter(
    (p) => !enabledProviders.has(p) && !disabledProviderSet.has(p) && !envProviderSet.has(p)
  );
  $: localProviders = [...data.providers]
    .filter((p) => p.enabled === 1)
    .sort((a, b) => a.sort_order - b.sort_order);

  function openAddModal() {
    showAddModal = true;
    newProvider = null;
    newClientId = '';
    newClientSecret = '';
    newTenant = '';
    newIcon = '';
    newSortOrder = data.providers.length;
    newEnabled = true;
  }

  function openEditModal(provider: ProviderConfig) {
    selectedProvider = provider;
    editClientId = provider.client_id;
    editClientSecret = '';
    editTenant = provider.tenant || '';
    editIcon = provider.icon;
    showEditModal = true;
  }

  async function handleDisable(provider: ProviderConfig) {
    const formData = new FormData();
    formData.append('provider', provider.provider);

    try {
      const response = await fetch('?/disable', {
        method: 'POST',
        body: formData
      });

      const result = (await response.json()) as {
        type: string;
        data?: { error?: string; message?: string };
      };

      if (result.type === 'success') {
        toastStore.success('Provider disabled successfully');
        window.location.reload();
      } else if (result.type === 'failure') {
        toastStore.error(result.data?.error || 'Failed to disable provider');
      }
    } catch (err) {
      console.error('Failed to disable provider:', err);
      toastStore.error('Failed to disable provider');
    }
  }

  function closeModals() {
    showAddModal = false;
    showEditModal = false;
    selectedProvider = null;
  }

  function selectNewProvider(provider: OAuthProvider) {
    newProvider = provider;
    const defaults = data.providerDefaults[provider];
    newIcon = defaults.icon;
    newClientId = '';
    newTenant = '';
  }

  async function handleReEnableProvider(disabledProvider: ProviderConfig) {
    const formData = new FormData();
    formData.append('provider', disabledProvider.provider);
    formData.append('enabled', 'true');

    try {
      const response = await fetch('?/update', {
        method: 'POST',
        body: formData
      });

      const result = (await response.json()) as {
        type: string;
        data?: { error?: string; message?: string };
      };

      if (result.type === 'success') {
        toastStore.success('Provider re-enabled successfully');
        window.location.reload();
      } else if (result.type === 'failure') {
        toastStore.error(result.data?.error || 'Failed to re-enable provider');
      }
    } catch (err) {
      console.error('Failed to re-enable provider:', err);
      toastStore.error('Failed to re-enable provider');
    }
  }

  // Drag and drop handlers
  function handleDragStart(event: DragEvent, index: number) {
    draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', '');
    }
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = null;
  }

  function handleDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      draggedIndex = null;
      dragOverIndex = null;
      return;
    }

    // Reorder the array
    const newProviders = [...localProviders];
    const [draggedItem] = newProviders.splice(draggedIndex, 1);
    newProviders.splice(dropIndex, 0, draggedItem);

    // Update local state immediately for responsive UI
    localProviders = newProviders;

    // Reset drag state
    draggedIndex = null;
    dragOverIndex = null;

    // Save to server
    saveProviderOrder(newProviders);
  }

  function handleDragEnd() {
    draggedIndex = null;
    dragOverIndex = null;
  }

  async function saveProviderOrder(providers: ProviderConfig[]) {
    const orders = providers.map((p, index) => ({
      provider: p.provider,
      sort_order: index
    }));

    const formData = new FormData();
    formData.append('orders', JSON.stringify(orders));

    try {
      const response = await fetch('?/reorder', {
        method: 'POST',
        body: formData
      });

      const result = (await response.json()) as { type: string; data?: { error?: string } };

      if (result.type === 'success') {
        toastStore.success('Provider order updated successfully');
      } else if (result.type === 'failure') {
        toastStore.error(result.data?.error || 'Failed to update order');
        // Reload page to restore correct order
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to save provider order:', err);
      toastStore.error('Failed to update provider order');
      // Reload page to restore correct order
      window.location.reload();
    }
  }
</script>

<svelte:head>
  <title>SSO Providers - Ammoura Admin</title>
</svelte:head>

<div class="sso-settings-page">
  <div class="page-header">
    <div>
      <h1>SSO Providers</h1>
      <p>Configure OAuth providers for single sign-on authentication</p>
    </div>
    {#if availableToAdd.length > 0 || disabledProviders.length > 0}
      <button class="btn-primary" on:click={openAddModal}>
        <span>➕</span>
        Add Provider
      </button>
    {/if}
  </div>

  {#if localProviders.length === 0 && envProviders.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🔐</div>
      <h2>No SSO Providers Enabled</h2>
      <p>Add OAuth providers to enable single sign-on for your users.</p>
      {#if availableToAdd.length > 0 || disabledProviders.length > 0}
        <button class="btn-primary" on:click={openAddModal}>Add Provider</button>
      {/if}
    </div>
  {:else}
    {#if envProviders.length > 0}
      <div class="env-providers-section">
        <div class="section-header">
          <h2>Environment Variable Providers</h2>
          <p>These providers are configured via environment variables and are always active.</p>
        </div>
        <div class="providers-list">
          {#each envProviders as provider (provider.provider)}
            <div class="provider-card env-provider">
              <div class="provider-content">
                <span class="provider-icon">
                  <IconDisplay iconName={provider.icon} size={28} fallbackEmoji={provider.icon} />
                </span>
                <span class="provider-name">{provider.display_name}</span>
                <span class="env-badge" title="Configured via environment variables">ENV</span>
                <span class="client-id-preview">{provider.client_id}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if localProviders.length > 0}
      <div class="providers-list">
        {#each localProviders as provider, index (provider.provider)}
          <div
            class="provider-card"
            class:disabled={provider.enabled === 0}
            class:dragging={draggedIndex === index}
            class:drag-over={dragOverIndex === index}
            draggable="true"
            on:dragstart={(e) => handleDragStart(e, index)}
            on:dragover={(e) => handleDragOver(e, index)}
            on:dragleave={handleDragLeave}
            on:drop={(e) => handleDrop(e, index)}
            on:dragend={handleDragEnd}
            role="button"
            tabindex="0"
          >
            <div class="drag-handle" title="Drag to reorder">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M7 4a1 1 0 100 2 1 1 0 000-2zM13 4a1 1 0 100 2 1 1 0 000-2zM7 9a1 1 0 100 2 1 1 0 000-2zM13 9a1 1 0 100 2 1 1 0 000-2zM7 14a1 1 0 100 2 1 1 0 000-2zM13 14a1 1 0 100 2 1 1 0 000-2z"
                  fill="currentColor"
                />
              </svg>
            </div>

            <div class="provider-content">
              <span class="provider-icon">
                <IconDisplay iconName={provider.icon} size={28} fallbackEmoji={provider.icon} />
              </span>
              <span class="provider-name">{provider.display_name}</span>

              <div class="provider-actions">
                <button
                  class="icon-btn"
                  on:click={() => openEditModal(provider)}
                  title="Settings"
                  aria-label="Edit {provider.display_name} settings"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"></path>
                    <path
                      d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
                    ></path>
                  </svg>
                </button>
                <button
                  class="icon-btn danger"
                  on:click={() => handleDisable(provider)}
                  title="Disable provider"
                  aria-label="Disable {provider.display_name}"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<!-- Add Provider Modal -->
{#if showAddModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click={closeModals}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Add SSO Provider</h2>
        <button class="modal-close" on:click={closeModals}>×</button>
      </div>

      <form method="POST" action="?/create" use:enhance>
        <div class="form-section">
          <h3>Select Provider</h3>
          <div class="provider-selector">
            {#each availableToAdd as provider}
              <button
                type="button"
                class="provider-option"
                class:selected={newProvider === provider}
                on:click={() => selectNewProvider(provider)}
              >
                <span class="option-icon">
                  <IconDisplay
                    iconName={data.providerDefaults[provider].icon}
                    size={32}
                    fallbackEmoji={data.providerDefaults[provider].icon}
                  />
                </span>
                <span class="option-name">{data.providerDefaults[provider].name}</span>
              </button>
            {/each}
            {#if disabledProviders.length > 0}
              <div class="disabled-separator">
                <span>Disabled Providers (Click to Re-enable)</span>
              </div>
              {#each disabledProviders as disabledProvider}
                <button
                  type="button"
                  class="provider-option disabled-provider"
                  on:click={() => handleReEnableProvider(disabledProvider)}
                >
                  <span class="option-icon">
                    <IconDisplay
                      iconName={disabledProvider.icon}
                      size={32}
                      fallbackEmoji={disabledProvider.icon}
                    />
                  </span>
                  <span class="option-name">{disabledProvider.display_name}</span>
                  <span class="disabled-badge">Disabled</span>
                </button>
              {/each}
            {/if}
          </div>
        </div>

        {#if newProvider}
          <input type="hidden" name="provider" value={newProvider} />

          <div class="form-section">
            <h3>Configuration</h3>

            <div class="form-group">
              <label for="client_id">
                Client ID <span class="required">*</span>
              </label>
              <input
                id="client_id"
                name="client_id"
                type="text"
                bind:value={newClientId}
                required
                placeholder="Enter OAuth client ID"
              />
            </div>

            <div class="form-group">
              <label for="client_secret">
                Client Secret <span class="required">*</span>
              </label>
              <input
                id="client_secret"
                name="client_secret"
                type="password"
                bind:value={newClientSecret}
                required
                placeholder="Enter OAuth client secret"
              />
            </div>

            {#if newProvider === 'microsoft'}
              <div class="form-group">
                <label for="tenant">Tenant (optional)</label>
                <input
                  id="tenant"
                  name="tenant"
                  type="text"
                  bind:value={newTenant}
                  placeholder="common, organizations, or tenant ID"
                />
                <span class="help-text">Leave empty for 'common' tenant</span>
              </div>
            {/if}

            <div class="form-group">
              <label for="icon">Icon (optional)</label>
              <IconPicker bind:value={newIcon} providerName={newProvider || ''} />
              <input type="hidden" name="icon" value={newIcon} />
            </div>

            <div class="form-group">
              <label for="sort_order">Sort Order</label>
              <input
                id="sort_order"
                name="sort_order"
                type="number"
                bind:value={newSortOrder}
                min="0"
              />
            </div>

            <div class="form-group">
              <input type="hidden" name="enabled" value={newEnabled ? 'true' : 'false'} />
              <ToggleSwitch bind:checked={newEnabled} label="Enable this provider" />
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" on:click={closeModals}>Cancel</button>
            <button type="submit" class="btn-primary">Add Provider</button>
          </div>
        {/if}
      </form>
    </div>
  </div>
{/if}

<!-- Edit Provider Modal -->
{#if showEditModal && selectedProvider}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click={closeModals}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Edit {selectedProvider.display_name}</h2>
        <button class="modal-close" on:click={closeModals}>×</button>
      </div>

      <form method="POST" action="?/update" use:enhance>
        <input type="hidden" name="provider" value={selectedProvider.provider} />

        <div class="form-section">
          <div class="form-group">
            <label for="edit_client_id">
              Client ID <span class="required">*</span>
            </label>
            <input
              id="edit_client_id"
              name="client_id"
              type="text"
              bind:value={editClientId}
              required
            />
          </div>

          <div class="form-group">
            <label for="edit_client_secret">
              Client Secret
              <span class="help-text">(leave empty to keep current)</span>
            </label>
            <input
              id="edit_client_secret"
              name="client_secret"
              type="password"
              bind:value={editClientSecret}
              placeholder="Enter new secret to update"
            />
          </div>

          {#if selectedProvider.provider === 'microsoft'}
            <div class="form-group">
              <label for="edit_tenant">Tenant (optional)</label>
              <input id="edit_tenant" name="tenant" type="text" bind:value={editTenant} />
            </div>
          {/if}

          <div class="form-group">
            <label for="edit_icon">Icon (optional)</label>
            <IconPicker bind:value={editIcon} providerName={selectedProvider.provider} />
            <input type="hidden" name="icon" value={editIcon} />
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" on:click={closeModals}>Cancel</button>
          <button type="submit" class="btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .sso-settings-page {
    padding: 2rem;
    width: 100%;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .page-header h1 {
    margin: 0 0 0.5rem 0;
    color: var(--color-text-primary);
  }

  .page-header p {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: var(--color-bg-secondary);
    border-radius: 12px;
    border: 2px dashed var(--color-border-secondary);
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-state h2 {
    margin: 0 0 0.5rem 0;
    color: var(--color-text-primary);
  }

  .empty-state p {
    margin: 0 0 1.5rem 0;
    color: var(--color-text-secondary);
  }

  .providers-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 800px;
  }

  .provider-card {
    position: relative;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 12px;
    padding: 1.5rem;
    padding-left: 3.5rem;
    transition: all 0.2s;
    cursor: grab;
  }

  .provider-card:active {
    cursor: grabbing;
  }

  .provider-card.disabled {
    opacity: 0.6;
  }

  .provider-card:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .provider-card.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }

  .provider-card.drag-over {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
    transform: translateY(-2px);
  }

  .drag-handle {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-secondary);
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .drag-handle:hover {
    color: var(--color-primary);
  }

  .provider-card:active .drag-handle {
    cursor: grabbing;
  }

  .provider-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
  }

  .provider-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .provider-name {
    flex: 1;
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .provider-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }

  .icon-btn {
    background: none;
    border: none;
    padding: 0.5rem;
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-text-secondary);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-primary);
  }

  .icon-btn.danger:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  /* Buttons */
  .btn-primary,
  .btn-secondary {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-secondary {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-secondary);
    flex: 1;
  }

  .btn-secondary:hover {
    background: var(--color-bg-primary);
    border-color: var(--color-primary);
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: var(--color-bg-primary);
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .modal-header h2 {
    margin: 0;
    color: var(--color-text-primary);
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: var(--color-text-secondary);
    line-height: 1;
    padding: 0;
    width: 2rem;
    height: 2rem;
  }

  .modal-close:hover {
    color: var(--color-text-primary);
  }

  .form-section {
    padding: 1.5rem;
  }

  .form-section h3 {
    margin: 0 0 1rem 0;
    color: var(--color-text-primary);
    font-size: 1rem;
  }

  .provider-selector {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.75rem;
  }

  .provider-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border-secondary);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .provider-option:hover {
    border-color: var(--color-primary);
    background: var(--color-bg-tertiary);
  }

  .provider-option.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .option-icon {
    font-size: 2rem;
  }

  .option-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .disabled-separator {
    grid-column: 1 / -1;
    padding: 0.75rem 0;
    margin-top: 0.5rem;
    border-top: 1px solid var(--color-border-secondary);
  }

  .disabled-separator span {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .provider-option.disabled-provider {
    position: relative;
    opacity: 0.7;
  }

  .provider-option.disabled-provider:hover {
    opacity: 1;
  }

  .disabled-badge {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    font-size: 0.7rem;
    padding: 0.15rem 0.35rem;
    background: rgba(239, 68, 68, 0.9);
    color: white;
    border-radius: 4px;
    font-weight: 600;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--color-text-primary);
    font-weight: 500;
    font-size: 0.9rem;
  }

  .form-group input[type='text'],
  .form-group input[type='password'],
  .form-group input[type='number'] {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-size: 0.9rem;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .required {
    color: #ef4444;
  }

  .help-text {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--color-border-secondary);
  }

  .modal-actions button {
    flex: 1;
  }

  @media (max-width: 768px) {
    .sso-settings-page {
      padding: 1rem;
    }

    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .providers-list {
      width: 100%;
    }

    .provider-selector {
      grid-template-columns: repeat(2, 1fr);
    }

    .provider-card {
      padding-left: 3rem;
    }

    .drag-handle {
      left: 0.5rem;
    }
  }

  .env-providers-section {
    margin-bottom: 2rem;
  }

  .env-providers-section .section-header {
    margin-bottom: 1rem;
  }

  .env-providers-section .section-header h2 {
    margin: 0 0 0.25rem 0;
    font-size: 1.1rem;
    color: var(--color-text-primary);
  }

  .env-providers-section .section-header p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .provider-card.env-provider {
    padding-left: 1.5rem;
    cursor: default;
    border-left: 3px solid var(--color-success);
  }

  .provider-card.env-provider:hover {
    cursor: default;
  }

  .env-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.15rem 0.5rem;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 15%, transparent);
    border-radius: 4px;
    text-transform: uppercase;
  }

  .client-id-preview {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    font-family: monospace;
    margin-left: auto;
  }
</style>
