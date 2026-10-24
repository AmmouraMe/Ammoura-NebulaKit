<!--
  One line under the navbar telling a shopper their prices were lowered for
  their country (regional pricing; see $lib/server/regional-pricing). Shown
  only when the owner left the notice on and this shopper actually gets less.
-->
<script lang="ts">
  import { t } from '$lib/i18n';
  import type { ShopperPricingSummary } from '$lib/utils/regionalPricing';

  export let pricing: ShopperPricingSummary | null | undefined;

  $: percent = pricing ? Math.round((1 - pricing.multiplier) * 100) : 0;
  $: visible = !!pricing && pricing.showNotice && percent > 0 && !!pricing.countryName;
</script>

{#if visible && pricing}
  <p class="regional-pricing-notice" role="status">
    {$t(pricing.scope === 'all' ? 'pricing.regionalNoticeAll' : 'pricing.regionalNoticeDigital', {
      country: pricing.countryName ?? '',
      percent: String(percent)
    })}
  </p>
{/if}

<style>
  .regional-pricing-notice {
    margin: 0;
    padding: 0.45rem 1rem;
    text-align: center;
    font-size: 0.85rem;
    background: var(--color-primary-alpha, rgba(59, 130, 246, 0.1));
    color: var(--color-text-primary);
  }
</style>
