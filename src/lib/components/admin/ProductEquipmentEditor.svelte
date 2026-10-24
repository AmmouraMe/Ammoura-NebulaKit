<script lang="ts">
  /**
   * The machines a product is made on, from the product's side. Each of the
   * shop's machines is checked against this product — its print areas, what it
   * is made of, the size it is made at — and listed best fit first, so the owner
   * sees at once which printer or press can make it and why another cannot.
   */
  import { onMount } from 'svelte';
  import { toastStore } from '$lib/stores/toast';
  import { confirmStore } from '$lib/stores/confirm';
  import { KIND_LABELS } from '$lib/data/equipmentCatalog';
  import {
    checkProductFit,
    guessSizeFromName,
    inferProductFamily,
    rankMachines,
    type FitResult,
    type ProductFitInput
  } from '$lib/utils/equipmentFit';
  import type { Equipment, ProductEquipmentLink } from '$lib/types/equipment';

  export let productId: string;

  interface ProductFitInfo {
    productName: string;
    templateType: string | null;
    printAreas: { name: string; widthIn: number; heightIn: number; requiredDpi: number }[];
  }

  let allEquipment: Equipment[] = [];
  let links: ProductEquipmentLink[] = [];
  let product: ProductFitInfo | null = null;
  let loading = true;
  let busy = false;

  $: linkedIds = new Set(links.map((l) => l.equipmentId));
  $: baseInput = product
    ? {
        family: inferProductFamily(product.templateType, product.productName),
        printAreas: product.printAreas
      }
    : { family: 'unknown' as const, printAreas: [] };
  $: available = rankMachines(
    allEquipment.filter((eq) => eq.isActive && !linkedIds.has(eq.id)),
    baseInput
  );

  function fitFor(
    capabilities: Equipment['capabilities'],
    sizeId: string | null
  ): FitResult | null {
    if (!capabilities) return null;
    const input: ProductFitInput = { ...baseInput, sizeId };
    return checkProductFit(capabilities, input);
  }

  async function loadData(): Promise<void> {
    try {
      const [allRes, prodRes] = await Promise.all([
        fetch('/api/admin/equipment'),
        fetch(`/api/admin/product-equipment?productId=${encodeURIComponent(productId)}`)
      ]);
      if (allRes.ok) {
        allEquipment = await allRes.json();
      }
      if (prodRes.ok) {
        const body = (await prodRes.json()) as {
          links: ProductEquipmentLink[];
          product: ProductFitInfo;
        };
        links = body.links;
        product = body.product;
      }
    } catch (err) {
      console.error('Failed to load equipment data:', err);
    } finally {
      loading = false;
    }
  }

  onMount(loadData);

  async function addEquipment(eq: Equipment): Promise<void> {
    if (busy) return;
    busy = true;
    // A size machine gets the size the product's name points at, if any.
    const sizeId = guessSizeFromName(product?.productName, eq.capabilities?.sizes)?.id ?? null;
    try {
      const res = await fetch('/api/admin/product-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, equipmentId: eq.id, sizeId })
      });
      if (res.ok) {
        toastStore.success(`${eq.name} linked`);
        await loadData();
      } else {
        toastStore.error('Failed to add equipment');
      }
    } catch (err) {
      console.error('Failed to add equipment:', err);
      toastStore.error('Failed to add equipment');
    } finally {
      busy = false;
    }
  }

  async function changeSize(link: ProductEquipmentLink, sizeId: string): Promise<void> {
    const res = await fetch('/api/admin/product-equipment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, equipmentId: link.equipmentId, sizeId: sizeId || null })
    });
    if (res.ok) {
      links = links.map((l) => (l.id === link.id ? { ...l, sizeId: sizeId || null } : l));
    } else {
      toastStore.error('Failed to change size');
    }
  }

  async function removeEquipment(equipmentId: string, equipmentName: string): Promise<void> {
    const confirmed = await confirmStore.show(`Remove "${equipmentName}" from this product?`, {
      title: 'Remove Equipment',
      confirmText: 'Remove',
      cancelText: 'Keep',
      variant: 'danger'
    });

    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/product-equipment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, equipmentId })
      });

      if (res.ok) {
        toastStore.success('Equipment removed from product');
        await loadData();
      } else {
        toastStore.error('Failed to remove equipment');
      }
    } catch (err) {
      console.error('Failed to remove equipment:', err);
      toastStore.error('Failed to remove equipment');
    }
  }
</script>

<div class="equipment-editor">
  <h3>Made on</h3>
  <p class="section-description">
    The printers, presses and machines that make this product. Each is checked against its print
    areas and what it is made of. Machines that ask customers for details add those fields at
    checkout.
  </p>

  {#if loading}
    <p class="loading">Loading equipment...</p>
  {:else}
    {#if links.length > 0}
      <div class="assigned-equipment">
        {#each links as link (link.id)}
          {@const fit = fitFor(link.capabilities, link.sizeId)}
          <div class="equipment-card">
            <div class="equipment-card-info">
              <strong>
                {link.equipmentName}
                {#if !link.equipmentIsActive}<span class="muted">(inactive)</span>{/if}
              </strong>
              {#if link.capabilities?.sizes?.length}
                <select
                  value={link.sizeId ?? ''}
                  on:change={(e) => changeSize(link, e.currentTarget.value)}
                  aria-label="Size for {link.equipmentName}"
                >
                  <option value="">Choose size…</option>
                  {#each link.capabilities.sizes as size (size.id)}
                    <option value={size.id}>{size.label}</option>
                  {/each}
                </select>
              {/if}
              {#if fit}
                {#each fit.issues as issue}
                  <span class="issue {issue.level}">{issue.message}</span>
                {:else}
                  <span class="issue ok">Fits</span>
                {/each}
              {/if}
            </div>
            <button
              type="button"
              class="remove-btn"
              on:click={() => removeEquipment(link.equipmentId, link.equipmentName)}
              title="Remove equipment"
            >
              ✕
            </button>
          </div>
        {/each}
      </div>
    {:else}
      <p class="no-equipment">Not linked to any equipment.</p>
    {/if}

    {#if available.length > 0}
      <div class="available-equipment">
        <h4>Your other equipment</h4>
        {#each available as { machine: eq, fit } (eq.id)}
          <div class="equipment-card available" class:poor={fit?.level === 'error'}>
            <div class="equipment-card-info">
              <strong>
                {eq.name}
                {#if eq.kind}<span class="muted">· {KIND_LABELS[eq.kind]}</span>{/if}
              </strong>
              {#if fit && fit.level === 'ok'}
                <span class="issue ok">Fits this product</span>
              {:else if fit}
                <span class="issue {fit.level}">{fit.issues[0]?.message}</span>
              {:else if eq.description}
                <span class="equipment-desc">{eq.description}</span>
              {/if}
            </div>
            <button type="button" class="add-btn" disabled={busy} on:click={() => addEquipment(eq)}>
              + Add
            </button>
          </div>
        {/each}
      </div>
    {:else if allEquipment.length === 0}
      <p class="no-equipment">
        No equipment yet.
        <a href="/admin/equipment">Add your printers and presses</a> first.
      </p>
    {/if}
  {/if}
</div>

<style>
  .equipment-editor {
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    padding: 1.25rem;
    background: var(--color-bg-tertiary);
  }

  .equipment-editor h3 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
  }

  .section-description {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    margin: 0 0 1rem;
  }

  .loading {
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .assigned-equipment,
  .available-equipment {
    margin-bottom: 1rem;
  }

  .available-equipment h4 {
    font-size: 0.9rem;
    margin: 0 0 0.5rem;
    color: var(--color-text-secondary);
  }

  .equipment-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    margin-bottom: 0.5rem;
    background: var(--color-bg-secondary);
  }

  .equipment-card.available {
    border-style: dashed;
  }

  .equipment-card.poor {
    opacity: 0.7;
  }

  .equipment-card-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    min-width: 0;
  }

  .equipment-card-info strong {
    font-size: 0.9rem;
  }

  .equipment-card-info select {
    padding: 0.3rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 0.8rem;
  }

  .muted,
  .equipment-desc {
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    font-weight: 400;
  }

  .issue {
    font-size: 0.78rem;
  }

  .issue.ok {
    color: var(--color-success, #15803d);
  }

  .issue.warning {
    color: var(--color-warning, #b45309);
  }

  .issue.error {
    color: var(--color-danger);
  }

  .remove-btn {
    flex-shrink: 0;
    background: var(--color-danger);
    color: #fff;
    border: none;
    border-radius: 4px;
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-btn:hover {
    opacity: 0.9;
  }

  .add-btn {
    flex-shrink: 0;
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .add-btn:hover {
    opacity: 0.9;
  }

  .add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .no-equipment {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    font-style: italic;
  }

  .no-equipment a {
    color: var(--color-primary);
  }
</style>
