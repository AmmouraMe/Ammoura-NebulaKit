<!--
  One country picker, used by checkout's shipping and billing addresses and by
  the store's own address settings. The value is an ISO 3166-1 alpha-2 code,
  because that is what Printful, Stripe and the orders table all read.

  Every country is listed. A short list with "Other" on the end used to take a
  customer's money and then strand the order: "Other" is not a country, so the
  fulfilment relay could never place it and dead-lettered it permanently.
-->
<script lang="ts">
  import { COUNTRIES, COMMON_COUNTRIES } from '$lib/data/countries';

  export let id: string;
  export let name: string | undefined = undefined;
  export let value: string;
  export let disabled = false;
  export let hasError = false;
  export let onChange: ((code: string) => void) | undefined = undefined;
</script>

<select
  {id}
  {name}
  {value}
  {disabled}
  class:error={hasError}
  on:change={(e) => onChange?.(e.currentTarget.value)}
>
  <optgroup label="Common">
    {#each COMMON_COUNTRIES as country (country.code)}
      <option value={country.code}>{country.name}</option>
    {/each}
  </optgroup>
  <optgroup label="All countries">
    {#each COUNTRIES as country (country.code)}
      <option value={country.code}>{country.name}</option>
    {/each}
  </optgroup>
</select>
