<script lang="ts">
  /**
   * The products a machine makes, from the machine's side: link one or more
   * products, each at one of the machine's sizes (a 1¼" button die makes the
   * 1¼" pins). Products whose names point at an owned size are offered as
   * suggestions, so a shop with twenty pin listings links them in one go.
   */
  import { createEventDispatcher, onMount } from 'svelte';
  import { toastStore } from '$lib/stores/toast';
  import { confirmStore } from '$lib/stores/confirm';
  import { checkProductFit, guessSizeFromName, inferProductFamily } from '$lib/utils/equipmentFit';
  import type { Equipment, ProductEquipmentLink } from '$lib/types/equipment';

  export let equipment: Equipment;
  export let products: { id: string; name: string; templateType: string | null }[];

  const dispatch = createEventDispatcher<{ close: void }>();

  let links: ProductEquipmentLink[] = [];
  let loading = true;
  let busy = false;
  let addProductId = '';
  let addSizeId = '';

  $: sizes = equipment.capabilities?.sizes ?? [];
  $: linkedIds = new Set(links.map((l) => l.productId));
  $: unlinked = products.filter((p) => !linkedIds.has(p.id));
  $: productById = new Map(products.map((p) => [p.id, p]));
  $: suggestions = sizes.length
    ? unlinked
        .map((p) => ({ product: p, size: guessSizeFromName(p.name, sizes) }))
        .filter((s) => s.size && fits(s.product.id, s.size.id) !== 'error')
    : [];

  function fits(productId: string, sizeId: string | null): 'ok' | 'warning' | 'error' | null {
    const product = productById.get(productId);
    if (!equipment.capabilities || !product) return null;
    return checkProductFit(equipment.capabilities, {
      family: inferProductFamily(product.templateType, product.name),
      printAreas: [],
      sizeId
    }).level;
  }

  function fitMessage(productId: string, sizeId: string | null): string {
    const product = productById.get(productId);
    if (!equipment.capabilities || !product) return '';
    return checkProductFit(equipment.capabilities, {
      family: inferProductFamily(product.templateType, product.name),
      printAreas: [],
      sizeId
    })
      .issues.map((i) => i.message)
      .join(' ');
  }

  async function load(): Promise<void> {
    try {
      const res = await fetch(
        `/api/admin/product-equipment?equipmentId=${encodeURIComponent(equipment.id)}`
      );
      if (!res.ok) throw new Error();
      links = ((await res.json()) as { links: ProductEquipmentLink[] }).links;
    } catch {
      toastStore.error('Failed to load linked products');
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function onPickProduct(): void {
    const product = productById.get(addProductId);
    addSizeId = guessSizeFromName(product?.name, sizes)?.id ?? '';
  }

  async function link(productId: string, sizeId: string | null): Promise<boolean> {
    const res = await fetch('/api/admin/product-equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, equipmentId: equipment.id, sizeId })
    });
    return res.ok;
  }

  async function addOne(): Promise<void> {
    if (!addProductId || busy) return;
    if (sizes.length && !addSizeId) {
      toastStore.error('Choose the size this product is made at');
      return;
    }
    busy = true;
    if (await link(addProductId, addSizeId || null)) {
      toastStore.success('Product linked');
      addProductId = '';
      addSizeId = '';
      await load();
    } else {
      toastStore.error('Failed to link product');
    }
    busy = false;
  }

  async function linkSuggestions(): Promise<void> {
    if (busy) return;
    busy = true;
    let done = 0;
    for (const s of suggestions) {
      if (await link(s.product.id, s.size!.id)) done++;
    }
    toastStore.success(`Linked ${done} product${done === 1 ? '' : 's'}`);
    await load();
    busy = false;
  }

  async function changeSize(l: ProductEquipmentLink, sizeId: string): Promise<void> {
    const res = await fetch('/api/admin/product-equipment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: l.productId,
        equipmentId: equipment.id,
        sizeId: sizeId || null
      })
    });
    if (res.ok) {
      links = links.map((x) => (x.id === l.id ? { ...x, sizeId: sizeId || null } : x));
    } else {
      toastStore.error('Failed to change size');
    }
  }

  async function unlink(l: ProductEquipmentLink): Promise<void> {
    const ok = await confirmStore.show(`Unlink "${l.productName}" from ${equipment.name}?`, {
      title: 'Unlink product',
      confirmText: 'Unlink',
      variant: 'danger'
    });
    if (!ok) return;
    const res = await fetch('/api/admin/product-equipment', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: l.productId, equipmentId: equipment.id })
    });
    if (res.ok) await load();
    else toastStore.error('Failed to unlink product');
  }
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && dispatch('close')} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="overlay" on:click={() => dispatch('close')}>
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="dialog" on:click|stopPropagation role="dialog" aria-label="Linked products">
    <h2>Products made on {equipment.name}</h2>
    <p class="hint">
      {#if sizes.length}
        Link each product to the size it is made at.
      {:else}
        Link the products this machine makes; each is checked against what it can do.
      {/if}
    </p>

    {#if loading}
      <p class="muted">Loading…</p>
    {:else}
      {#if links.length === 0}
        <p class="muted">No products linked yet.</p>
      {:else}
        <ul class="links">
          {#each links as l (l.id)}
            {@const level = fits(l.productId, l.sizeId)}
            <li>
              <span class="name">
                {l.productName}
                {#if level && level !== 'ok'}
                  <span class="fit {level}" title={fitMessage(l.productId, l.sizeId)}>
                    {level === 'error' ? 'Does not fit' : 'Check'}
                  </span>
                {/if}
              </span>
              {#if sizes.length}
                <select
                  value={l.sizeId ?? ''}
                  on:change={(e) => changeSize(l, e.currentTarget.value)}
                  aria-label="Size for {l.productName}"
                >
                  <option value="">Choose size…</option>
                  {#each sizes as size (size.id)}
                    <option value={size.id}>{size.label}</option>
                  {/each}
                </select>
              {/if}
              <button type="button" class="icon-btn" on:click={() => unlink(l)} title="Unlink">
                ✕
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      {#if suggestions.length > 0}
        <div class="suggest">
          <div>
            <strong>Suggested:</strong>
            {#each suggestions as s, i (s.product.id)}{i ? ', ' : ' '}{s.product.name}
              <span class="muted">({s.size?.label})</span>{/each}
          </div>
          <button type="button" class="btn" disabled={busy} on:click={linkSuggestions}>
            Link {suggestions.length}
          </button>
        </div>
      {/if}

      {#if unlinked.length > 0}
        <div class="add">
          <select bind:value={addProductId} on:change={onPickProduct} aria-label="Product">
            <option value="">Link a product…</option>
            {#each unlinked as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
          {#if sizes.length}
            <select bind:value={addSizeId} aria-label="Size">
              <option value="">Size…</option>
              {#each sizes as size (size.id)}
                <option value={size.id}>{size.label}</option>
              {/each}
            </select>
          {/if}
          <button
            type="button"
            class="btn btn-primary"
            disabled={!addProductId || busy}
            on:click={addOne}>Link</button
          >
        </div>
        {#if addProductId && fits(addProductId, addSizeId || null) === 'error'}
          <p class="warn">{fitMessage(addProductId, addSizeId || null)}</p>
        {/if}
      {:else if products.length === 0}
        <p class="muted">This shop has no products yet.</p>
      {/if}
    {/if}

    <div class="actions">
      <button type="button" class="btn" on:click={() => dispatch('close')}>Done</button>
    </div>
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
    max-width: 620px;
    max-height: 88vh;
    overflow-y: auto;
  }
  h2 {
    margin: 0 0 0.25rem;
    font-size: 1.3rem;
    line-height: 1.3;
  }
  .hint,
  .muted {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }
  .hint {
    margin: 0 0 1rem;
  }
  .links {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .links li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    background: var(--color-bg-tertiary);
  }
  .name {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.9rem;
    overflow-wrap: anywhere;
  }
  .links select {
    flex: 0 0 auto;
    width: 9.5rem;
  }
  .fit {
    font-size: 0.7rem;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    margin-left: 0.35rem;
    cursor: help;
  }
  .fit.warning {
    background: var(--color-warning-alpha, rgba(234, 179, 8, 0.15));
    color: var(--color-warning, #b45309);
  }
  .fit.error {
    background: var(--color-danger-alpha, rgba(220, 38, 38, 0.12));
    color: var(--color-danger);
  }
  select {
    padding: 0.4rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 0.85rem;
    min-width: 0;
  }
  .suggest {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.65rem 0.75rem;
    border: 1px dashed var(--color-primary);
    border-radius: 8px;
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }
  .add {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .add select {
    width: auto;
    flex: 0 1 9.5rem;
  }
  .add select:first-child {
    flex: 1 1 14rem;
  }
  .warn {
    color: var(--color-danger);
    font-size: 0.8rem;
    margin: 0.4rem 0 0;
  }
  .icon-btn {
    border: none;
    background: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.2rem 0.4rem;
  }
  .icon-btn:hover {
    color: var(--color-danger);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
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
    white-space: nowrap;
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
</style>
