<script lang="ts">
  /**
   * Add a machine from the built-in catalog: search make and model, pick it,
   * tick the sizes you own (button dies, mug sizes), and it is created with its
   * capabilities filled in. A machine that is not listed starts from its kind's
   * defaults instead.
   */
  import { createEventDispatcher } from 'svelte';
  import { toastStore } from '$lib/stores/toast';
  import {
    searchCatalog,
    catalogKinds,
    cloneCapabilities,
    KIND_LABELS,
    KIND_DEFAULTS
  } from '$lib/data/equipmentCatalog';
  import { describeCapabilities } from '$lib/utils/equipmentFit';
  import type {
    EquipmentCatalogModel,
    EquipmentKind,
    EquipmentSize
  } from '$lib/types/equipmentCapabilities';

  const dispatch = createEventDispatcher<{ close: void; created: void }>();

  let query = '';
  let kindFilter: EquipmentKind | '' = '';
  let chosen: EquipmentCatalogModel | null = null;
  let name = '';
  let ownedSizes = new Set<string>();
  let saving = false;

  const kinds = catalogKinds();
  const allKinds = Object.keys(KIND_LABELS) as EquipmentKind[];
  let customKind: EquipmentKind = 'dtg-printer';

  $: results = searchCatalog(query, kindFilter);
  $: sizes = chosen?.capabilities.sizes ?? [];

  function choose(model: EquipmentCatalogModel): void {
    chosen = model;
    name = `${model.make} ${model.model}`.replace(/\s*\(.*\)$/, '');
    // A one-size machine owns its size; a die-based one asks.
    ownedSizes = new Set(
      (model.capabilities.sizes ?? []).length === 1 ? [model.capabilities.sizes![0].id] : []
    );
  }

  function chooseCustom(): void {
    chosen = {
      id: '',
      make: '',
      model: '',
      capabilities: cloneCapabilities(KIND_DEFAULTS[customKind])
    };
    name = KIND_LABELS[customKind];
    ownedSizes = new Set((chosen.capabilities.sizes ?? []).map((s) => s.id));
  }

  function toggleSize(size: EquipmentSize): void {
    if (ownedSizes.has(size.id)) ownedSizes.delete(size.id);
    else ownedSizes.add(size.id);
    ownedSizes = ownedSizes;
  }

  async function create(): Promise<void> {
    if (!chosen || saving) return;
    if (!name.trim()) {
      toastStore.error('Give the machine a name');
      return;
    }
    if (sizes.length > 0 && ownedSizes.size === 0) {
      toastStore.error('Tick at least one size you own');
      return;
    }
    const capabilities = cloneCapabilities(chosen.capabilities);
    if (capabilities.sizes) {
      capabilities.sizes = capabilities.sizes.filter((s) => ownedSizes.has(s.id));
    }

    saving = true;
    try {
      const res = await fetch('/api/admin/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          make: chosen.make || null,
          model: chosen.model || null,
          catalogModelId: chosen.id || null,
          capabilities
        })
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.success(`${name.trim()} added`);
      dispatch('created');
    } catch {
      toastStore.error('Failed to add equipment');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && dispatch('close')} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="overlay" on:click={() => dispatch('close')}>
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="dialog" on:click|stopPropagation role="dialog" aria-label="Add equipment">
    {#if !chosen}
      <h2>Add equipment</h2>
      <p class="hint">Find your printer, press or machine. Its capabilities fill in for you.</p>
      <div class="search-row">
        <!-- svelte-ignore a11y-autofocus -->
        <input
          type="search"
          bind:value={query}
          placeholder="Search make or model — e.g. Epson, Cricut, button"
          aria-label="Search equipment"
          autofocus
        />
        <select bind:value={kindFilter} aria-label="Filter by kind">
          <option value="">All kinds</option>
          {#each kinds as kind}
            <option value={kind}>{KIND_LABELS[kind]}</option>
          {/each}
        </select>
      </div>

      <ul class="results">
        {#each results as model (model.id)}
          <li>
            <button type="button" class="result" on:click={() => choose(model)}>
              <span class="result-name">{model.make} {model.model}</span>
              <span class="kind">{KIND_LABELS[model.capabilities.kind]}</span>
              {#if model.summary}<span class="summary">{model.summary}</span>{/if}
              <span class="chips">
                {#each describeCapabilities(model.capabilities).slice(0, 4) as chip}
                  <span class="chip">{chip}</span>
                {/each}
              </span>
            </button>
          </li>
        {:else}
          <li class="empty">Nothing matches. Add it as your own machine below.</li>
        {/each}
      </ul>

      <div class="custom-row">
        <span>Not listed?</span>
        <select bind:value={customKind} aria-label="Kind of machine">
          {#each allKinds as kind}
            <option value={kind}>{KIND_LABELS[kind]}</option>
          {/each}
        </select>
        <button type="button" class="btn" on:click={chooseCustom}>Start from this kind</button>
      </div>

      <div class="actions">
        <button type="button" class="btn" on:click={() => dispatch('close')}>Cancel</button>
      </div>
    {:else}
      <h2>
        {chosen.make ? `${chosen.make} ${chosen.model}` : KIND_LABELS[chosen.capabilities.kind]}
      </h2>
      <p class="hint">
        {KIND_LABELS[chosen.capabilities.kind]}
        {#if chosen.id}
          · published figures; correct them later under Capabilities if yours differs.
        {:else}
          · typical figures for this kind; set your machine's real ones under Capabilities.
        {/if}
      </p>

      <label class="field">
        <span>Name in your shop</span>
        <input type="text" bind:value={name} placeholder="e.g. Front-room DTG" />
      </label>

      {#if sizes.length > 0}
        <fieldset class="sizes">
          <legend>Which sizes do you have?</legend>
          {#each sizes as size (size.id)}
            <label class="size">
              <input
                type="checkbox"
                checked={ownedSizes.has(size.id)}
                on:change={() => toggleSize(size)}
              />
              {size.label}
              {#if size.artworkWidthIn}
                <small
                  >art {size.artworkWidthIn}"{size.shape === 'round'
                    ? ''
                    : ` × ${size.artworkHeightIn}"`}</small
                >
              {/if}
            </label>
          {/each}
        </fieldset>
      {:else}
        <div class="chips">
          {#each describeCapabilities(chosen.capabilities) as chip}
            <span class="chip">{chip}</span>
          {/each}
        </div>
      {/if}

      <div class="actions">
        <button type="button" class="btn" on:click={() => (chosen = null)}>Back</button>
        <button type="button" class="btn btn-primary" disabled={saving} on:click={create}>
          {saving ? 'Adding…' : 'Add to my shop'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  .dialog {
    background: var(--color-bg-secondary);
    border-radius: 12px;
    padding: 1.5rem;
    width: 100%;
    max-width: 680px;
    max-height: 88vh;
    overflow-y: auto;
  }
  h2 {
    margin: 0 0 0.25rem;
    font-size: 1.3rem;
    line-height: 1.3;
  }
  .hint {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    margin: 0 0 1rem;
  }
  .search-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .search-row input {
    flex: 1 1 16rem;
  }
  input[type='search'],
  input[type='text'],
  select {
    padding: 0.5rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 0.9rem;
  }
  .results {
    list-style: none;
    margin: 1rem 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-height: 50vh;
    overflow-y: auto;
  }
  .result {
    width: 100%;
    text-align: left;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.2rem 0.75rem;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    cursor: pointer;
    font: inherit;
  }
  .result:hover,
  .result:focus-visible {
    border-color: var(--color-primary);
  }
  .result-name {
    font-weight: 600;
  }
  .kind {
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    justify-self: end;
  }
  .summary {
    grid-column: 1 / -1;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
  }
  .chips {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-top: 0.15rem;
  }
  .chip {
    font-size: 0.72rem;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    background: var(--color-primary-alpha);
    color: var(--color-primary);
  }
  .empty {
    color: var(--color-text-secondary);
    font-style: italic;
    padding: 0.5rem 0;
  }
  .custom-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .sizes {
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    padding: 0.75rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.4rem;
  }
  .sizes legend {
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0 0.25rem;
  }
  .size {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.25rem;
    font-size: 0.875rem;
    cursor: pointer;
  }
  .size small {
    color: var(--color-text-tertiary);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.25rem;
  }
  .btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: 0.875rem;
  }
  .btn-primary {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  /* app.css makes every checkbox a 44px touch target; in a dense list the whole
     label is the target instead, so the box itself can be its normal size. */
  .size input[type='checkbox'] {
    width: 1.1rem;
    height: 1.1rem;
    min-width: 1.1rem;
    min-height: 1.1rem;
    padding: 0;
    margin: 0;
    flex: none;
  }
</style>
