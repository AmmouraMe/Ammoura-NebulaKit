<script lang="ts">
  import { enhance } from '$app/forms';
  import { toastStore } from '$lib/stores/toast';
  import { money } from '$lib/i18n';
  import { COUNTRIES } from '$lib/data/countries';
  import { isRestrictedCountry } from '$lib/data/restrictedRegions';
  import { PRICE_LEVEL_INDEX, PRICE_LEVEL_INDEX_UPDATED } from '$lib/data/priceLevelIndex';
  import { priceMultiplier, regionalPrice } from '$lib/utils/regionalPricing';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  let enabled = data.settings.enabled;
  let scope = data.settings.scope;
  /** Percentages in the form; fractions in storage. */
  let strength = Math.round(data.settings.strength * 100);
  let maxDiscount = Math.round(data.settings.maxDiscount * 100);
  let showNotice = data.settings.showNotice;
  /** country → percent off, as the owner typed it. */
  let overridePercent: Record<string, number> = Object.fromEntries(
    Object.entries(data.settings.overrides).map(([c, m]) => [c, Math.round((1 - m) * 100)])
  );
  let samplePrice = 20;
  let search = '';
  let isSubmitting = false;

  $: if (form?.success) toastStore.success('Regional pricing saved');
  $: if (form?.error) toastStore.error(form.error);

  $: overrides = Object.fromEntries(
    Object.entries(overridePercent)
      .filter(([, p]) => typeof p === 'number' && Number.isFinite(p))
      .map(([c, p]) => [c, Math.round((1 - Math.min(90, Math.max(0, p)) / 100) * 100) / 100])
  );

  // What every country gets with the settings as they stand in the form, so
  // the owner sees the effect before saving.
  $: preview = {
    enabled: true,
    strength: strength / 100,
    maxDiscount: maxDiscount / 100,
    overrides,
    showNotice,
    scope
  };
  $: rows = COUNTRIES.filter((c) => !isRestrictedCountry(c.code))
    .map((c) => {
      const level = PRICE_LEVEL_INDEX[c.code]?.[0] ?? null;
      const m = priceMultiplier(preview, c.code);
      return { ...c, level, m, off: Math.round((1 - m) * 100) };
    })
    .sort((a, b) => b.off - a.off || a.name.localeCompare(b.name));
  $: shown = search.trim()
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          r.code === search.trim().toUpperCase()
      )
    : rows;
  $: discounted = rows.filter((r) => r.off > 0).length;
  $: yours = data.yourCountry ? rows.find((r) => r.code === data.yourCountry) : null;

  function setOverride(code: string, value: string): void {
    if (value === '') {
      const { [code]: _removed, ...rest } = overridePercent;
      overridePercent = rest;
    } else {
      overridePercent = { ...overridePercent, [code]: Number(value) };
    }
  }
</script>

<svelte:head>
  <title>Regional Pricing - Admin</title>
</svelte:head>

<div class="settings-page">
  <div class="page-header">
    <h1>Regional pricing</h1>
    <p>
      Lower your prices for shoppers in countries where money buys more. A price that is fair in the
      US can be a week's wages elsewhere; this meets those shoppers part of the way, using the World
      Bank's price levels for each country.
    </p>
  </div>

  <form
    method="POST"
    class="settings-card"
    use:enhance={() => {
      isSubmitting = true;
      return async ({ update }) => {
        await update({ reset: false });
        isSubmitting = false;
      };
    }}
  >
    <input type="hidden" name="overrides" value={JSON.stringify(overrides)} />

    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" name="enabled" bind:checked={enabled} />
        <span>Use regional pricing</span>
      </label>
      <p class="help-text">
        Prices only ever go down. Shoppers in the US, in countries dearer than the US, and anywhere
        we cannot place pay your normal price.
      </p>
    </div>

    <fieldset class="form-group" disabled={!enabled}>
      <legend>Which products</legend>
      <label class="radio-label">
        <input type="radio" name="scope" value="digital" bind:group={scope} />
        <span>Digital products only <em>(recommended)</em></span>
      </label>
      <label class="radio-label">
        <input type="radio" name="scope" value="all" bind:group={scope} />
        <span>Everything, including physical products</span>
      </label>
      <p class="help-text">
        A download costs you nothing to sell again, so a lower price is still profit. A printed
        product costs you the same wherever the buyer lives — check the largest discount below
        against your cost before choosing everything.
      </p>
    </fieldset>

    <div class="sliders" class:off={!enabled}>
      <label class="slider">
        <span>How much of the gap to pass on: <strong>{strength}%</strong></span>
        <input
          type="range"
          name="strength"
          min="0"
          max="100"
          step="5"
          bind:value={strength}
          disabled={!enabled}
        />
        <small>
          At 50%, a country where things cost 40% of US prices gets 30% off — half the 60% gap.
        </small>
      </label>
      <label class="slider">
        <span>Largest discount any country gets: <strong>{maxDiscount}%</strong></span>
        <input
          type="range"
          name="maxDiscount"
          min="0"
          max="90"
          step="5"
          bind:value={maxDiscount}
          disabled={!enabled}
        />
        <small>Your floor. No price goes below {100 - maxDiscount}% of your normal price.</small>
      </label>
    </div>

    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" name="showNotice" bind:checked={showNotice} disabled={!enabled} />
        <span>Tell shoppers their price was adjusted</span>
      </label>
      <p class="help-text">
        A line under your menu, such as "Digital products are 40% off for India." Prices are also
        shown with your normal price struck through.
      </p>
    </div>

    <div class="notes">
      <h2>How a discount is decided at checkout</h2>
      <ul>
        <li>
          Shoppers see prices for the country their connection comes from. At checkout, that
          country, the billing address and the shipping address are compared, and the smallest
          discount of the three is charged — so a VPN or a borrowed address alone does not buy one.
        </li>
        <li>Each order's Stripe payment notes the country and discount it was priced at.</li>
      </ul>
    </div>

    <button type="submit" class="save-btn" disabled={isSubmitting}>
      {isSubmitting ? 'Saving…' : 'Save Changes'}
    </button>
  </form>

  <section class="settings-card">
    <div class="preview-head">
      <div>
        <h2>Preview by country</h2>
        <p class="help-text">
          {#if enabled}
            With these settings, {discounted} countries get a lower price.
          {:else}
            Regional pricing is off; this is what shoppers would get with it on.
          {/if}
          {#if yours}
            You are browsing from {yours.name}: {yours.off > 0
              ? `${yours.off}% off`
              : 'full price'}.
          {/if}
          Type a number in <em>Your % off</em> to set a country by hand; leave it blank to use the index.
        </p>
      </div>
      <div class="preview-controls">
        <label>
          <span>Example price</span>
          <input type="number" min="0" step="0.01" bind:value={samplePrice} />
        </label>
        <label>
          <span>Find a country</span>
          <input type="search" bind:value={search} placeholder="e.g. India or IN" />
        </label>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Country</th>
            <th class="num">Prices vs US</th>
            <th class="num">Discount</th>
            <th class="num">Example</th>
            <th class="num">Your % off</th>
          </tr>
        </thead>
        <tbody>
          {#each shown as row (row.code)}
            <tr class:manual={row.code in overridePercent}>
              <td>{row.name}</td>
              <td class="num">{row.level === null ? '—' : `${Math.round(row.level * 100)}%`}</td>
              <td class="num">{row.off > 0 ? `${row.off}%` : '—'}</td>
              <td class="num">{$money(regionalPrice(samplePrice || 0, row.m))}</td>
              <td class="num">
                <input
                  class="override"
                  type="number"
                  min="0"
                  max="90"
                  step="5"
                  placeholder="auto"
                  value={overridePercent[row.code] ?? ''}
                  on:change={(e) => setOverride(row.code, e.currentTarget.value)}
                  aria-label="Your discount for {row.name}"
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="help-text source">
      Price levels: World Bank PPP conversion factor ÷ exchange rate, updated {PRICE_LEVEL_INDEX_UPDATED}.
      Countries under US sanctions are not listed; they cannot buy at all.
    </p>
  </section>
</div>

<style>
  .settings-page {
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .page-header p {
    color: var(--color-text-secondary);
    margin: 0;
    max-width: 680px;
  }
  h1 {
    color: var(--color-text-primary);
    font-size: 2rem;
    margin: 0 0 0.5rem 0;
  }
  h2 {
    color: var(--color-text-primary);
    font-size: 1.05rem;
    margin: 0 0 0.5rem 0;
  }
  .settings-card {
    min-width: 0;
    background: var(--color-bg-primary);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px var(--color-shadow-light);
  }
  .form-group {
    margin: 0 0 1.25rem;
    border: none;
    padding: 0;
  }
  fieldset:disabled,
  .sliders.off {
    opacity: 0.6;
  }
  legend {
    font-weight: 500;
    color: var(--color-text-primary);
    margin-bottom: 0.4rem;
  }
  .checkbox-label,
  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--color-text-primary);
    font-weight: 500;
    cursor: pointer;
    min-height: 2.25rem;
  }
  .radio-label {
    font-weight: 400;
  }
  .radio-label em {
    color: var(--color-text-secondary);
    font-style: normal;
  }
  /* app.css makes every checkbox a 44px touch target; the label is the target here. */
  .checkbox-label input,
  .radio-label input {
    width: 1.1rem;
    height: 1.1rem;
    min-width: 1.1rem;
    min-height: 1.1rem;
    margin: 0;
    padding: 0;
    flex: none;
  }
  .help-text {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    line-height: 1.6;
    margin: 0.5rem 0 0 0;
    max-width: 680px;
  }
  .sliders {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1.25rem;
    margin-bottom: 1.25rem;
  }
  .slider {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    color: var(--color-text-primary);
    font-size: 0.9rem;
  }
  .slider small {
    color: var(--color-text-secondary);
    font-size: 0.8rem;
  }
  .notes {
    border-top: 1px solid var(--color-border);
    padding-top: 1.25rem;
    margin-bottom: 1.25rem;
  }
  .notes ul {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    line-height: 1.6;
    margin: 0;
    padding-left: 1.1rem;
    max-width: 680px;
  }
  .notes li {
    margin-bottom: 0.4rem;
  }
  .save-btn {
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0.7rem 1.4rem;
    font-size: 0.95rem;
    cursor: pointer;
  }
  .save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .preview-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .preview-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: flex-end;
  }
  .preview-controls label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
  }
  .preview-controls input {
    width: 11rem;
    max-width: 100%;
  }
  .preview-controls label {
    flex: 1 1 9rem;
    min-width: 0;
  }
  .table-wrap {
    max-height: 28rem;
    overflow: auto;
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  th,
  td {
    padding: 0.4rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-primary);
  }
  th {
    position: sticky;
    top: 0;
    background: var(--color-bg-secondary);
    font-weight: 600;
    font-size: 0.8rem;
  }
  .num {
    text-align: right;
    white-space: nowrap;
  }
  tr.manual td:first-child::after {
    content: ' · set by you';
    color: var(--color-primary);
    font-size: 0.75rem;
  }
  .override {
    width: 5rem;
    min-width: 0;
    padding: 0.2rem 0.35rem;
    text-align: right;
  }
  .source {
    font-size: 0.75rem;
  }
</style>
