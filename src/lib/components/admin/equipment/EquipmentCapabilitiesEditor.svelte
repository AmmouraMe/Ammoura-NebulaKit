<script lang="ts">
  /**
   * Correct a machine's capabilities: its real platen or bed, what it prints on,
   * and — for button makers and mug presses — which sizes this shop owns. Sizes
   * offered are the catalog model's, plus any the owner adds by hand.
   */
  import { createEventDispatcher } from 'svelte';
  import { toastStore } from '$lib/stores/toast';
  import {
    getCatalogModel,
    cloneCapabilities,
    KIND_LABELS,
    KIND_DEFAULTS
  } from '$lib/data/equipmentCatalog';
  import type { Equipment } from '$lib/types/equipment';
  import type {
    EquipmentCapabilities,
    EquipmentKind,
    EquipmentSize,
    Substrate
  } from '$lib/types/equipmentCapabilities';

  export let equipment: Equipment;

  const dispatch = createEventDispatcher<{ close: void; saved: void }>();

  const SUBSTRATE_LABELS: Record<Substrate, string> = {
    cotton: 'Cotton',
    polyester: 'Polyester',
    blend: 'Blends',
    'dark-garment': 'Dark garments',
    hat: 'Hats',
    paper: 'Paper',
    cardstock: 'Cardstock',
    sticker: 'Sticker stock',
    vinyl: 'Vinyl',
    htv: 'Heat-transfer vinyl',
    'transfer-film': 'Transfer film',
    mug: 'Mugs',
    tumbler: 'Tumblers',
    'hard-surface': 'Hard surfaces',
    acrylic: 'Acrylic',
    wood: 'Wood',
    leather: 'Leather',
    glass: 'Glass',
    metal: 'Metal',
    fabric: 'Fabric',
    button: 'Buttons',
    filament: 'Filament',
    resin: 'Resin'
  };
  const allKinds = Object.keys(KIND_LABELS) as EquipmentKind[];
  const allSubstrates = Object.keys(SUBSTRATE_LABELS) as Substrate[];

  let caps: EquipmentCapabilities = cloneCapabilities(
    equipment.capabilities ?? KIND_DEFAULTS[equipment.kind ?? 'other']
  );
  const catalogSizes = getCatalogModel(equipment.catalogModelId)?.capabilities.sizes ?? [];

  // Every size on offer: the catalog's, then any custom ones already owned.
  let offeredSizes: EquipmentSize[] = [
    ...catalogSizes,
    ...(caps.sizes ?? []).filter((s) => !catalogSizes.some((c) => c.id === s.id))
  ];
  let owned = new Set((caps.sizes ?? []).map((s) => s.id));
  let usesSizes = offeredSizes.length > 0;

  let areaW = caps.maxAreaIn?.widthIn ?? null;
  let areaH = caps.maxAreaIn?.heightIn ?? null;
  let mediaW = caps.maxMediaWidthIn ?? null;
  let objectH = caps.maxObjectHeightIn ?? null;
  let dpi = caps.maxDpi ?? null;
  let colors = caps.maxColors ?? null;
  let substrates = new Set(caps.substrates);

  // New custom size
  let newLabel = '';
  let newShape: EquipmentSize['shape'] = 'round';
  let newW: number | null = null;
  let newH: number | null = null;
  let newArtW: number | null = null;
  let newArtH: number | null = null;
  let saving = false;

  function changeKind(kind: EquipmentKind): void {
    // A new kind starts from that kind's defaults; the owner's numbers are kept where they apply.
    const base = cloneCapabilities(KIND_DEFAULTS[kind]);
    caps = { ...base, kind };
    substrates = new Set(base.substrates);
    if (base.sizes && offeredSizes.length === 0) {
      offeredSizes = base.sizes;
      owned = new Set(base.sizes.map((s) => s.id));
    }
    usesSizes = offeredSizes.length > 0 || !!base.sizes;
  }

  function asKind(value: string): EquipmentKind {
    return value in KIND_LABELS ? (value as EquipmentKind) : 'other';
  }

  function toggle<T>(set: Set<T>, value: T): Set<T> {
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return new Set(set);
  }

  function addSize(): void {
    const w = Number(newW);
    const h = newShape === 'round' ? w : Number(newH);
    if (!newLabel.trim() || !(w > 0) || !(h > 0)) {
      toastStore.error('A size needs a label and its finished width and height');
      return;
    }
    const id = `${newShape}-${w}${newShape === 'round' ? '' : `x${h}`}`;
    if (offeredSizes.some((s) => s.id === id)) {
      owned = new Set(owned.add(id));
      return;
    }
    const size: EquipmentSize = {
      id,
      label: newLabel.trim(),
      shape: newShape,
      widthIn: w,
      heightIn: h
    };
    const aw = Number(newArtW);
    if (aw > 0) {
      size.artworkWidthIn = aw;
      size.artworkHeightIn = newShape === 'round' ? aw : Number(newArtH) || aw;
    }
    offeredSizes = [...offeredSizes, size];
    owned = new Set(owned.add(id));
    usesSizes = true;
    newLabel = '';
    newW = newH = newArtW = newArtH = null;
  }

  function positive(n: number | null): number | undefined {
    return n !== null && Number(n) > 0 ? Number(n) : undefined;
  }

  async function save(): Promise<void> {
    if (saving) return;
    const next: EquipmentCapabilities = {
      ...caps,
      substrates: allSubstrates.filter((s) => substrates.has(s))
    };
    const w = positive(areaW);
    const h = positive(areaH);
    if (w && h) next.maxAreaIn = { widthIn: w, heightIn: h };
    else delete next.maxAreaIn;
    for (const [key, value] of [
      ['maxMediaWidthIn', positive(mediaW)],
      ['maxObjectHeightIn', positive(objectH)],
      ['maxDpi', positive(dpi)],
      ['maxColors', positive(colors)]
    ] as const) {
      if (value) next[key] = value;
      else delete next[key];
    }
    if (usesSizes) {
      next.sizes = offeredSizes.filter((s) => owned.has(s.id));
      if (next.sizes.length === 0) {
        toastStore.error('Tick at least one size you own');
        return;
      }
    } else {
      delete next.sizes;
    }

    saving = true;
    try {
      const res = await fetch('/api/admin/equipment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: equipment.id, capabilities: next })
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.success('Capabilities saved');
      dispatch('saved');
    } catch {
      toastStore.error('Failed to save capabilities');
    } finally {
      saving = false;
    }
  }

  $: kind = caps.kind;
  $: showsArea = !['button-press', 'mug-press', '3d-printer'].includes(kind);
  $: showsMedia = [
    'dtf-printer',
    'sublimation-printer',
    'eco-solvent-printer',
    'photo-printer',
    'label-printer',
    'vinyl-cutter'
  ].includes(kind);
  $: showsDpi = kind.endsWith('-printer') && kind !== '3d-printer';
  $: showsColors = ['embroidery-machine', 'screen-printing-press', '3d-printer'].includes(kind);
  $: showsObjectHeight = ['uv-printer', 'laser-engraver'].includes(kind);
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && dispatch('close')} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="overlay" on:click={() => dispatch('close')}>
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="dialog" on:click|stopPropagation role="dialog" aria-label="Capabilities">
    <h2>Capabilities — {equipment.name}</h2>
    <p class="hint">
      What this machine can do. Products linked to it are checked against these numbers.
    </p>

    <label class="field">
      <span>Kind</span>
      <select value={kind} on:change={(e) => changeKind(asKind(e.currentTarget.value))}>
        {#each allKinds as k}
          <option value={k}>{KIND_LABELS[k]}</option>
        {/each}
      </select>
    </label>

    <div class="grid">
      {#if showsArea}
        <label class="field">
          <span>Largest area, width (in)</span>
          <input type="number" min="0" step="0.1" bind:value={areaW} />
        </label>
        <label class="field">
          <span>Largest area, height (in)</span>
          <input type="number" min="0" step="0.1" bind:value={areaH} />
        </label>
      {/if}
      {#if showsMedia}
        <label class="field">
          <span>Media / roll width (in)</span>
          <input type="number" min="0" step="0.1" bind:value={mediaW} />
        </label>
      {/if}
      {#if showsObjectHeight}
        <label class="field">
          <span>Tallest object (in)</span>
          <input type="number" min="0" step="0.1" bind:value={objectH} />
        </label>
      {/if}
      {#if showsDpi}
        <label class="field">
          <span>Resolution (dpi)</span>
          <input type="number" min="0" step="1" bind:value={dpi} />
        </label>
      {/if}
      {#if showsColors}
        <label class="field">
          <span
            >{kind === 'embroidery-machine'
              ? 'Needles'
              : kind === '3d-printer'
                ? 'Filaments'
                : 'Colours / stations'}</span
          >
          <input type="number" min="0" step="1" bind:value={colors} />
        </label>
      {/if}
    </div>

    {#if showsDpi || kind === 'screen-printing-press'}
      <label class="check">
        <input type="checkbox" bind:checked={caps.whiteInk} />
        Prints white (needed for colour on dark garments)
      </label>
    {/if}
    {#if kind === 'eco-solvent-printer' || kind === 'label-printer'}
      <label class="check">
        <input type="checkbox" bind:checked={caps.cuts} />
        Also cuts (print-and-cut)
      </label>
    {/if}

    <fieldset>
      <legend>Prints / works on</legend>
      <div class="checks">
        {#each allSubstrates as s}
          <label class="check">
            <input
              type="checkbox"
              checked={substrates.has(s)}
              on:change={() => (substrates = toggle(substrates, s))}
            />
            {SUBSTRATE_LABELS[s]}
          </label>
        {/each}
      </div>
    </fieldset>

    {#if usesSizes || kind === 'button-press' || kind === 'mug-press'}
      <fieldset>
        <legend>Sizes you own</legend>
        <div class="checks">
          {#each offeredSizes as size (size.id)}
            <label class="check">
              <input
                type="checkbox"
                checked={owned.has(size.id)}
                on:change={() => (owned = toggle(owned, size.id))}
              />
              {size.label}
            </label>
          {/each}
        </div>
        <div class="add-size">
          <input
            type="text"
            bind:value={newLabel}
            placeholder={`Label, e.g. 1¼" round`}
            aria-label="Size label"
          />
          <select bind:value={newShape} aria-label="Shape">
            <option value="round">Round</option>
            <option value="oval">Oval</option>
            <option value="square">Square</option>
            <option value="rectangle">Rectangle</option>
            <option value="heart">Heart</option>
            <option value="cylinder">Cylinder</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.001"
            bind:value={newW}
            placeholder={newShape === 'round' ? 'Diameter' : 'Width'}
            aria-label="Finished width in inches"
          />
          {#if newShape !== 'round'}
            <input
              type="number"
              min="0"
              step="0.001"
              bind:value={newH}
              placeholder="Height"
              aria-label="Finished height in inches"
            />
          {/if}
          <input
            type="number"
            min="0"
            step="0.001"
            bind:value={newArtW}
            placeholder="Art size"
            aria-label="Artwork width in inches"
          />
          {#if newShape !== 'round'}
            <input
              type="number"
              min="0"
              step="0.001"
              bind:value={newArtH}
              placeholder="Art height"
              aria-label="Artwork height in inches"
            />
          {/if}
          <button type="button" class="btn" on:click={addSize}>Add size</button>
        </div>
      </fieldset>
    {/if}

    <div class="actions">
      <button type="button" class="btn" on:click={() => dispatch('close')}>Cancel</button>
      <button type="button" class="btn btn-primary" disabled={saving} on:click={save}>
        {saving ? 'Saving…' : 'Save'}
      </button>
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
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    gap: 0 1rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.9rem;
    font-size: 0.85rem;
    font-weight: 500;
  }
  input[type='text'],
  input[type='number'],
  select {
    padding: 0.45rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    min-width: 0;
  }
  fieldset {
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    padding: 0.75rem;
    margin: 0.75rem 0 0;
  }
  legend {
    font-size: 0.85rem;
    font-weight: 500;
    padding: 0 0.25rem;
  }
  .checks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    gap: 0.35rem;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.25rem;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .add-size {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.75rem;
  }
  .add-size input[type='text'] {
    flex: 1 1 10rem;
  }
  .add-size input[type='number'] {
    width: 6.5rem;
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
  .check input[type='checkbox'] {
    width: 1.1rem;
    height: 1.1rem;
    min-width: 1.1rem;
    min-height: 1.1rem;
    padding: 0;
    margin: 0;
    flex: none;
  }
</style>
