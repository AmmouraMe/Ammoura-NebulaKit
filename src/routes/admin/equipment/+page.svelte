<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { toastStore } from '$lib/stores/toast';
  import { confirmStore } from '$lib/stores/confirm';
  import type { Equipment, EquipmentField, EquipmentFieldType } from '$lib/types/equipment';
  import type { MediaRequirements } from '$lib/types/customization';
  import EquipmentCatalogPicker from '$lib/components/admin/equipment/EquipmentCatalogPicker.svelte';
  import EquipmentCapabilitiesEditor from '$lib/components/admin/equipment/EquipmentCapabilitiesEditor.svelte';
  import EquipmentProductLinks from '$lib/components/admin/equipment/EquipmentProductLinks.svelte';
  import { KIND_LABELS } from '$lib/data/equipmentCatalog';
  import { describeCapabilities, workflowGaps } from '$lib/utils/equipmentFit';

  export let data: {
    equipment: Equipment[];
    products: { id: string; name: string; templateType: string | null }[];
  };
  let equipment: Equipment[] = data.equipment;
  $: equipment = data.equipment;
  $: gaps = workflowGaps(equipment);

  // Catalog, capabilities and product-link dialogs
  let showCatalog = false;
  let capabilitiesFor: Equipment | null = null;
  let linksFor: Equipment | null = null;

  // Equipment modal state
  let showEquipmentModal = false;
  let editingEquipment: Equipment | null = null;
  let formName = '';
  let formDescription = '';
  let formIsActive = true;
  let isSubmitting = false;

  // Fields modal state
  let showFieldsModal = false;
  let selectedEquipment: Equipment | null = null;
  let equipmentFields: EquipmentField[] = [];
  let loadingFields = false;

  // Field form state
  let showFieldForm = false;
  let editingField: EquipmentField | null = null;
  let fieldName = '';
  let fieldType: EquipmentFieldType = 'text';
  let fieldOptions = '';
  let fieldPlaceholder = '';
  let fieldRequired = false;
  let fieldMaxLength: number | null = null;
  let fieldMinValue: number | null = null;
  let fieldMaxValue: number | null = null;
  let fieldDefaultValue = '';
  let fieldSortOrder = 0;

  // Media requirements state (for image/audio/video field types)
  let mediaMaxFileSize: number | null = null;
  let mediaAllowedMimeTypes = '';
  let mediaMinWidth: number | null = null;
  let mediaMinHeight: number | null = null;
  let mediaMaxWidth: number | null = null;
  let mediaMaxHeight: number | null = null;
  let mediaMinDuration: number | null = null;
  let mediaMaxDuration: number | null = null;
  let mediaMinBitrate: number | null = null;
  let mediaMinResolution: number | null = null;
  let mediaMinFrameRate: number | null = null;

  $: isMediaType = fieldType === 'image' || fieldType === 'audio' || fieldType === 'video';

  function buildMediaRequirements(): MediaRequirements | undefined {
    if (!isMediaType) return undefined;
    const reqs: MediaRequirements = {};
    if (mediaMaxFileSize) reqs.maxFileSize = mediaMaxFileSize;
    if (mediaAllowedMimeTypes.trim()) {
      reqs.allowedMimeTypes = mediaAllowedMimeTypes
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (fieldType === 'image') {
      if (mediaMinWidth) reqs.minWidth = mediaMinWidth;
      if (mediaMinHeight) reqs.minHeight = mediaMinHeight;
      if (mediaMaxWidth) reqs.maxWidth = mediaMaxWidth;
      if (mediaMaxHeight) reqs.maxHeight = mediaMaxHeight;
    }
    if (fieldType === 'audio' || fieldType === 'video') {
      if (mediaMinDuration) reqs.minDuration = mediaMinDuration;
      if (mediaMaxDuration) reqs.maxDuration = mediaMaxDuration;
    }
    if (fieldType === 'audio') {
      if (mediaMinBitrate) reqs.minBitrate = mediaMinBitrate;
    }
    if (fieldType === 'video') {
      if (mediaMinResolution) reqs.minResolution = mediaMinResolution;
      if (mediaMinFrameRate) reqs.minFrameRate = mediaMinFrameRate;
    }
    return Object.keys(reqs).length > 0 ? reqs : undefined;
  }

  function resetMediaRequirements(): void {
    mediaMaxFileSize = null;
    mediaAllowedMimeTypes = '';
    mediaMinWidth = null;
    mediaMinHeight = null;
    mediaMaxWidth = null;
    mediaMaxHeight = null;
    mediaMinDuration = null;
    mediaMaxDuration = null;
    mediaMinBitrate = null;
    mediaMinResolution = null;
    mediaMinFrameRate = null;
  }

  function loadMediaRequirements(reqs: MediaRequirements | null): void {
    resetMediaRequirements();
    if (!reqs) return;
    mediaMaxFileSize = reqs.maxFileSize ?? null;
    mediaAllowedMimeTypes = reqs.allowedMimeTypes?.join(', ') ?? '';
    mediaMinWidth = reqs.minWidth ?? null;
    mediaMinHeight = reqs.minHeight ?? null;
    mediaMaxWidth = reqs.maxWidth ?? null;
    mediaMaxHeight = reqs.maxHeight ?? null;
    mediaMinDuration = reqs.minDuration ?? null;
    mediaMaxDuration = reqs.maxDuration ?? null;
    mediaMinBitrate = reqs.minBitrate ?? null;
    mediaMinResolution = reqs.minResolution ?? null;
    mediaMinFrameRate = reqs.minFrameRate ?? null;
  }

  const fieldTypeOptions: { value: EquipmentFieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Textarea' },
    { value: 'select', label: 'Select / Dropdown' },
    { value: 'color', label: 'Color Picker' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'image', label: 'Image Upload' },
    { value: 'audio', label: 'Audio Upload' },
    { value: 'video', label: 'Video Upload' }
  ];

  // --- Equipment CRUD ---

  function handleAddEquipment(): void {
    editingEquipment = null;
    formName = '';
    formDescription = '';
    formIsActive = true;
    showEquipmentModal = true;
  }

  function handleEditEquipment(eq: Equipment): void {
    editingEquipment = eq;
    formName = eq.name;
    formDescription = eq.description || '';
    formIsActive = eq.isActive;
    showEquipmentModal = true;
  }

  async function handleDeleteEquipment(eq: Equipment): Promise<void> {
    const confirmed = await confirmStore.show(
      `Delete equipment "${eq.name}"? This will also remove all its field definitions and product associations.`,
      { title: 'Delete Equipment', confirmText: 'Delete', variant: 'danger' }
    );
    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/equipment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eq.id })
      });
      if (!response.ok) throw new Error('Failed to delete');
      toastStore.success(`Equipment "${eq.name}" deleted`);
      await invalidateAll();
    } catch {
      toastStore.error('Failed to delete equipment');
    }
  }

  async function handleSubmitEquipment(): Promise<void> {
    if (isSubmitting) return;
    if (!formName.trim()) {
      toastStore.error('Equipment name is required');
      return;
    }

    isSubmitting = true;
    try {
      const body = {
        ...(editingEquipment ? { id: editingEquipment.id } : {}),
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        isActive: formIsActive
      };

      const response = await fetch('/api/admin/equipment', {
        method: editingEquipment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error('Failed to save');
      toastStore.success(
        editingEquipment ? `Equipment "${formName}" updated` : `Equipment "${formName}" created`
      );
      showEquipmentModal = false;
      await invalidateAll();
    } catch {
      toastStore.error('Failed to save equipment');
    } finally {
      isSubmitting = false;
    }
  }

  // --- Equipment Fields ---

  async function handleManageFields(eq: Equipment): Promise<void> {
    selectedEquipment = eq;
    showFieldsModal = true;
    await loadFields(eq.id);
  }

  async function loadFields(equipmentId: string): Promise<void> {
    loadingFields = true;
    try {
      const response = await fetch(
        `/api/admin/equipment?equipmentId=${encodeURIComponent(equipmentId)}`
      );
      if (!response.ok) throw new Error('Failed to load');
      equipmentFields = await response.json();
    } catch {
      toastStore.error('Failed to load equipment fields');
      equipmentFields = [];
    } finally {
      loadingFields = false;
    }
  }

  function handleAddField(): void {
    editingField = null;
    fieldName = '';
    fieldType = 'text';
    fieldOptions = '';
    fieldPlaceholder = '';
    fieldRequired = false;
    fieldMaxLength = null;
    fieldMinValue = null;
    fieldMaxValue = null;
    fieldDefaultValue = '';
    fieldSortOrder = equipmentFields.length;
    resetMediaRequirements();
    showFieldForm = true;
  }

  function handleEditField(field: EquipmentField): void {
    editingField = field;
    fieldName = field.name;
    fieldType = field.fieldType;
    fieldOptions = field.options.join(', ');
    fieldPlaceholder = field.placeholder || '';
    fieldRequired = field.required;
    fieldMaxLength = field.maxLength;
    fieldMinValue = field.minValue;
    fieldMaxValue = field.maxValue;
    fieldDefaultValue = field.defaultValue || '';
    fieldSortOrder = field.sortOrder;
    loadMediaRequirements(field.mediaRequirements);
    showFieldForm = true;
  }

  async function handleDeleteField(field: EquipmentField): Promise<void> {
    const confirmed = await confirmStore.show(`Delete field "${field.name}"?`, {
      title: 'Delete Field',
      confirmText: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      const response = await fetch('/api/admin/equipment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: field.id, isField: true })
      });
      if (!response.ok) throw new Error('Failed to delete');
      toastStore.success(`Field "${field.name}" deleted`);
      if (selectedEquipment) await loadFields(selectedEquipment.id);
    } catch {
      toastStore.error('Failed to delete field');
    }
  }

  async function handleSubmitField(): Promise<void> {
    if (isSubmitting) return;
    if (!fieldName.trim()) {
      toastStore.error('Field name is required');
      return;
    }
    if (!selectedEquipment) return;

    isSubmitting = true;
    try {
      const options =
        fieldType === 'select'
          ? fieldOptions
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : [];

      const body = {
        ...(editingField ? { id: editingField.id, isField: true } : {}),
        equipmentId: selectedEquipment.id,
        name: fieldName.trim(),
        fieldType: fieldType,
        options,
        placeholder: fieldPlaceholder.trim() || undefined,
        required: fieldRequired,
        maxLength: fieldMaxLength,
        minValue: fieldMinValue,
        maxValue: fieldMaxValue,
        defaultValue: fieldDefaultValue.trim() || undefined,
        sortOrder: fieldSortOrder,
        mediaRequirements: buildMediaRequirements() ?? null
      };

      const response = await fetch('/api/admin/equipment', {
        method: editingField ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error('Failed to save');
      toastStore.success(
        editingField ? `Field "${fieldName}" updated` : `Field "${fieldName}" created`
      );
      showFieldForm = false;
      await loadFields(selectedEquipment.id);
    } catch {
      toastStore.error('Failed to save field');
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="equipment-page">
  <div class="page-header">
    <h1>Equipment</h1>
    <p class="subtitle">
      The printers, presses and machines you make products with. Pick yours from the catalog and its
      capabilities fill in; link it to the products it makes and each one is checked against what
      the machine can do. A machine can also ask customers for details at checkout.
    </p>
    <div class="header-actions">
      <button class="btn btn-primary" on:click={() => (showCatalog = true)}>
        + Add from catalog
      </button>
      <button class="btn" on:click={handleAddEquipment}>+ Custom equipment</button>
    </div>
  </div>

  {#if gaps.length > 0}
    <div class="gaps" role="status">
      {#each gaps as gap}
        <p>{gap}</p>
      {/each}
    </div>
  {/if}

  {#if equipment.length === 0}
    <div class="empty-state">
      <p>
        No equipment yet. Add the printers, presses and button makers you use, and link them to the
        products they make.
      </p>
    </div>
  {:else}
    <div class="equipment-list">
      {#each equipment as eq (eq.id)}
        <div class="equipment-card" class:inactive={!eq.isActive}>
          <div class="card-header">
            <h3>{eq.name}</h3>
            {#if eq.kind}
              <span class="badge kind">{KIND_LABELS[eq.kind]}</span>
            {/if}
            <span class="badge" class:active={eq.isActive} class:inactive={!eq.isActive}>
              {eq.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {#if eq.make || eq.model}
            <p class="make-model">{[eq.make, eq.model].filter(Boolean).join(' ')}</p>
          {/if}
          {#if eq.description}
            <p class="description">{eq.description}</p>
          {/if}
          {#if eq.capabilities}
            <div class="chips">
              {#each describeCapabilities(eq.capabilities) as chip}
                <span class="chip">{chip}</span>
              {/each}
            </div>
          {/if}
          <div class="card-actions">
            <button class="btn btn-sm" on:click={() => (linksFor = eq)}>Products</button>
            <button class="btn btn-sm" on:click={() => (capabilitiesFor = eq)}>Capabilities</button>
            <button class="btn btn-sm" on:click={() => handleManageFields(eq)}>
              Manage Fields
            </button>
            <button class="btn btn-sm" on:click={() => handleEditEquipment(eq)}>Edit</button>
            <button class="btn btn-sm btn-danger" on:click={() => handleDeleteEquipment(eq)}>
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showCatalog}
  <EquipmentCatalogPicker
    on:close={() => (showCatalog = false)}
    on:created={async () => {
      showCatalog = false;
      await invalidateAll();
    }}
  />
{/if}

{#if capabilitiesFor}
  <EquipmentCapabilitiesEditor
    equipment={capabilitiesFor}
    on:close={() => (capabilitiesFor = null)}
    on:saved={async () => {
      capabilitiesFor = null;
      await invalidateAll();
    }}
  />
{/if}

{#if linksFor}
  <EquipmentProductLinks
    equipment={linksFor}
    products={data.products}
    on:close={() => (linksFor = null)}
  />
{/if}

<!-- Equipment Add/Edit Modal -->
{#if showEquipmentModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click={() => (showEquipmentModal = false)}>
    <div class="modal" on:click|stopPropagation>
      <h2>{editingEquipment ? 'Edit Equipment' : 'Add Equipment'}</h2>
      <form on:submit|preventDefault={handleSubmitEquipment}>
        <div class="form-group">
          <label for="eq-name">Name</label>
          <input
            id="eq-name"
            type="text"
            bind:value={formName}
            placeholder="e.g., Laser Engraver"
            required
          />
        </div>
        <div class="form-group">
          <label for="eq-desc">Description</label>
          <textarea
            id="eq-desc"
            bind:value={formDescription}
            placeholder="Optional description of this equipment"
            rows="3"
          />
        </div>
        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" bind:checked={formIsActive} />
            Active
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" on:click={() => (showEquipmentModal = false)}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : editingEquipment ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Equipment Fields Modal -->
{#if showFieldsModal && selectedEquipment}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click={() => (showFieldsModal = false)}>
    <div class="modal modal-wide" on:click|stopPropagation>
      <h2>Fields for "{selectedEquipment.name}"</h2>
      <p class="modal-subtitle">
        Define what information customers must provide when ordering a product that uses this
        equipment.
      </p>

      {#if loadingFields}
        <p>Loading fields...</p>
      {:else if showFieldForm}
        <!-- Field Add/Edit Form -->
        <form on:submit|preventDefault={handleSubmitField}>
          <div class="form-row">
            <div class="form-group">
              <label for="field-name">Field Name</label>
              <input
                id="field-name"
                type="text"
                bind:value={fieldName}
                placeholder="e.g., Material Type"
                required
              />
            </div>
            <div class="form-group">
              <label for="field-type">Type</label>
              <select id="field-type" bind:value={fieldType}>
                {#each fieldTypeOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>
          </div>

          {#if fieldType === 'select'}
            <div class="form-group">
              <label for="field-options">Options (comma-separated)</label>
              <input
                id="field-options"
                type="text"
                bind:value={fieldOptions}
                placeholder="Option 1, Option 2, Option 3"
              />
            </div>
          {/if}

          <div class="form-row">
            <div class="form-group">
              <label for="field-placeholder">Placeholder</label>
              <input
                id="field-placeholder"
                type="text"
                bind:value={fieldPlaceholder}
                placeholder="Hint text for the field"
              />
            </div>
            <div class="form-group">
              <label for="field-default">Default Value</label>
              <input
                id="field-default"
                type="text"
                bind:value={fieldDefaultValue}
                placeholder="Default value"
              />
            </div>
          </div>

          {#if fieldType === 'text' || fieldType === 'textarea'}
            <div class="form-group">
              <label for="field-maxlen">Max Length</label>
              <input id="field-maxlen" type="number" bind:value={fieldMaxLength} min="1" />
            </div>
          {/if}

          {#if fieldType === 'number'}
            <div class="form-row">
              <div class="form-group">
                <label for="field-min">Min Value</label>
                <input id="field-min" type="number" bind:value={fieldMinValue} step="any" />
              </div>
              <div class="form-group">
                <label for="field-max">Max Value</label>
                <input id="field-max" type="number" bind:value={fieldMaxValue} step="any" />
              </div>
            </div>
          {/if}

          {#if isMediaType}
            <fieldset class="media-requirements-fieldset">
              <legend>Media Requirements</legend>
              <div class="form-group">
                <label for="media-max-size">Max File Size (bytes)</label>
                <input
                  id="media-max-size"
                  type="number"
                  bind:value={mediaMaxFileSize}
                  min="0"
                  placeholder="e.g., 10485760 (10 MB)"
                />
              </div>
              <div class="form-group">
                <label for="media-mimes">Allowed MIME Types (comma-separated)</label>
                <input
                  id="media-mimes"
                  type="text"
                  bind:value={mediaAllowedMimeTypes}
                  placeholder={fieldType === 'image'
                    ? 'image/png, image/jpeg'
                    : fieldType === 'audio'
                      ? 'audio/mpeg, audio/wav'
                      : 'video/mp4, video/webm'}
                />
              </div>

              {#if fieldType === 'image'}
                <div class="form-row">
                  <div class="form-group">
                    <label for="media-min-w">Min Width (px)</label>
                    <input id="media-min-w" type="number" bind:value={mediaMinWidth} min="1" />
                  </div>
                  <div class="form-group">
                    <label for="media-min-h">Min Height (px)</label>
                    <input id="media-min-h" type="number" bind:value={mediaMinHeight} min="1" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label for="media-max-w">Max Width (px)</label>
                    <input id="media-max-w" type="number" bind:value={mediaMaxWidth} min="1" />
                  </div>
                  <div class="form-group">
                    <label for="media-max-h">Max Height (px)</label>
                    <input id="media-max-h" type="number" bind:value={mediaMaxHeight} min="1" />
                  </div>
                </div>
              {/if}

              {#if fieldType === 'audio' || fieldType === 'video'}
                <div class="form-row">
                  <div class="form-group">
                    <label for="media-min-dur">Min Duration (sec)</label>
                    <input
                      id="media-min-dur"
                      type="number"
                      bind:value={mediaMinDuration}
                      min="0"
                      step="any"
                    />
                  </div>
                  <div class="form-group">
                    <label for="media-max-dur">Max Duration (sec)</label>
                    <input
                      id="media-max-dur"
                      type="number"
                      bind:value={mediaMaxDuration}
                      min="0"
                      step="any"
                    />
                  </div>
                </div>
              {/if}

              {#if fieldType === 'audio'}
                <div class="form-group">
                  <label for="media-bitrate">Min Bitrate (kbps)</label>
                  <input id="media-bitrate" type="number" bind:value={mediaMinBitrate} min="0" />
                </div>
              {/if}

              {#if fieldType === 'video'}
                <div class="form-row">
                  <div class="form-group">
                    <label for="media-resolution">Min Resolution (e.g., 720)</label>
                    <input
                      id="media-resolution"
                      type="number"
                      bind:value={mediaMinResolution}
                      min="1"
                    />
                  </div>
                  <div class="form-group">
                    <label for="media-fps">Min Frame Rate (fps)</label>
                    <input id="media-fps" type="number" bind:value={mediaMinFrameRate} min="1" />
                  </div>
                </div>
              {/if}
            </fieldset>
          {/if}

          <div class="form-row">
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" bind:checked={fieldRequired} />
                Required
              </label>
            </div>
            <div class="form-group">
              <label for="field-sort">Sort Order</label>
              <input id="field-sort" type="number" bind:value={fieldSortOrder} min="0" />
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn" on:click={() => (showFieldForm = false)}>
              Back to Fields
            </button>
            <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingField ? 'Update Field' : 'Add Field'}
            </button>
          </div>
        </form>
      {:else}
        <!-- Fields List -->
        <button class="btn btn-primary btn-sm" on:click={handleAddField}>+ Add Field</button>

        {#if equipmentFields.length === 0}
          <p class="empty-fields">
            No fields defined. Add fields to specify what information customers must provide.
          </p>
        {:else}
          <table class="fields-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Name</th>
                <th>Type</th>
                <th>Required</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each equipmentFields as field (field.id)}
                <tr>
                  <td>{field.sortOrder}</td>
                  <td>{field.name}</td>
                  <td
                    >{fieldTypeOptions.find((o) => o.value === field.fieldType)?.label ||
                      field.fieldType}</td
                  >
                  <td>{field.required ? 'Yes' : 'No'}</td>
                  <td>
                    <button class="btn btn-xs" on:click={() => handleEditField(field)}>Edit</button>
                    <button class="btn btn-xs btn-danger" on:click={() => handleDeleteField(field)}>
                      Delete
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}

        <div class="modal-actions">
          <button class="btn" on:click={() => (showFieldsModal = false)}>Close</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .equipment-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  .page-header h1 {
    margin: 0 0 0.5rem;
  }

  .subtitle {
    color: var(--color-text-secondary);
    margin: 0 0 1rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--color-text-secondary);
    background: var(--color-bg-secondary);
    border-radius: 8px;
  }

  .equipment-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .equipment-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .equipment-card.inactive {
    opacity: 0.6;
  }

  .card-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .card-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .badge {
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .badge.active {
    background: var(--color-primary-alpha);
    color: var(--color-primary);
  }

  .badge.inactive {
    background: var(--color-text-tertiary-alpha);
    color: var(--color-text-secondary);
  }

  .description {
    color: var(--color-text-secondary);
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
  }

  .card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .gaps {
    border: 1px solid var(--color-warning, #b45309);
    background: var(--color-warning-alpha, rgba(234, 179, 8, 0.1));
    border-radius: 8px;
    padding: 0.5rem 1rem;
    margin-bottom: 1.25rem;
    font-size: 0.875rem;
  }

  .gaps p {
    margin: 0.35rem 0;
  }

  .badge.kind {
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
  }

  .make-model {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    margin: 0 0 0.5rem;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0 0 0.75rem;
  }

  .chip {
    font-size: 0.72rem;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: var(--color-primary-alpha);
    color: var(--color-primary);
  }

  /* Buttons */
  .btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: 0.875rem;
  }

  .btn:hover {
    background: var(--color-bg-accent);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-danger {
    color: var(--color-danger);
    border-color: var(--color-danger);
  }

  .btn-danger:hover {
    background: var(--color-danger);
    color: white;
  }

  .btn-sm {
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
  }

  .btn-xs {
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--color-bg-secondary);
    border-radius: 12px;
    padding: 1.5rem;
    width: 90%;
    max-width: 500px;
    max-height: 85vh;
    overflow-y: auto;
  }

  .modal-wide {
    max-width: 700px;
  }

  .modal h2 {
    margin: 0 0 0.5rem;
  }

  .modal-subtitle {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    margin: 0 0 1rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }

  /* Forms */
  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
  }

  .form-group input[type='text'],
  .form-group input[type='number'],
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    font-size: 0.875rem;
    box-sizing: border-box;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  /* Fields Table */
  .fields-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
    font-size: 0.875rem;
  }

  .fields-table th,
  .fields-table td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border-secondary);
  }

  .fields-table th {
    font-weight: 600;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    text-transform: uppercase;
  }

  .empty-fields {
    color: var(--color-text-secondary);
    text-align: center;
    padding: 1.5rem 0;
  }

  /* Media requirements fieldset */
  .media-requirements-fieldset {
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    padding: 1rem;
    margin: 0.5rem 0 1rem;
  }

  .media-requirements-fieldset legend {
    font-weight: 600;
    font-size: 0.875rem;
    padding: 0 0.5rem;
    color: var(--color-text-secondary);
  }
</style>
