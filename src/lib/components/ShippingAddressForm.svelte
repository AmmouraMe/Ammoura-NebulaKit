<script lang="ts">
  import { checkoutStore } from '../stores/checkout';
  import type { ShippingAddress } from '../types/checkout';
  import CountrySelect from './CountrySelect.svelte';

  export let errors: Partial<Record<keyof ShippingAddress, string>> = {};

  $: formData = $checkoutStore.formData.shippingAddress;

  function updateField(field: keyof ShippingAddress, value: string) {
    const updatedAddress = { ...formData, [field]: value };
    checkoutStore.updateFormData({
      shippingAddress: updatedAddress
    });
  }
</script>

<div class="shipping-address-form">
  <h3>Shipping Address</h3>

  <div class="form-row">
    <div class="form-group">
      <label for="firstName">First Name *</label>
      <input
        type="text"
        id="firstName"
        value={formData.firstName}
        on:input={(e) => updateField('firstName', e.currentTarget.value)}
        class:error={errors.firstName}
      />
      {#if errors.firstName}
        <span class="error-message">{errors.firstName}</span>
      {/if}
    </div>

    <div class="form-group">
      <label for="lastName">Last Name *</label>
      <input
        type="text"
        id="lastName"
        value={formData.lastName}
        on:input={(e) => updateField('lastName', e.currentTarget.value)}
        class:error={errors.lastName}
      />
      {#if errors.lastName}
        <span class="error-message">{errors.lastName}</span>
      {/if}
    </div>
  </div>

  <div class="form-group">
    <label for="email">Email *</label>
    <input
      type="email"
      id="email"
      value={formData.email}
      on:input={(e) => updateField('email', e.currentTarget.value)}
      class:error={errors.email}
    />
    {#if errors.email}
      <span class="error-message">{errors.email}</span>
    {/if}
  </div>

  <div class="form-group">
    <label for="phone">Phone *</label>
    <input
      type="tel"
      id="phone"
      value={formData.phone}
      on:input={(e) => updateField('phone', e.currentTarget.value)}
      class:error={errors.phone}
    />
    {#if errors.phone}
      <span class="error-message">{errors.phone}</span>
    {/if}
  </div>

  <div class="form-group">
    <label for="address">Address *</label>
    <input
      type="text"
      id="address"
      value={formData.address}
      on:input={(e) => updateField('address', e.currentTarget.value)}
      class:error={errors.address}
    />
    {#if errors.address}
      <span class="error-message">{errors.address}</span>
    {/if}
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="city">City *</label>
      <input
        type="text"
        id="city"
        value={formData.city}
        on:input={(e) => updateField('city', e.currentTarget.value)}
        class:error={errors.city}
      />
      {#if errors.city}
        <span class="error-message">{errors.city}</span>
      {/if}
    </div>

    <div class="form-group">
      <label for="state">State *</label>
      <input
        type="text"
        id="state"
        value={formData.state}
        on:input={(e) => updateField('state', e.currentTarget.value)}
        class:error={errors.state}
      />
      {#if errors.state}
        <span class="error-message">{errors.state}</span>
      {/if}
    </div>
  </div>

  <div class="form-row">
    <div class="form-group">
      <label for="zipCode">ZIP Code *</label>
      <input
        type="text"
        id="zipCode"
        value={formData.zipCode}
        on:input={(e) => updateField('zipCode', e.currentTarget.value)}
        class:error={errors.zipCode}
      />
      {#if errors.zipCode}
        <span class="error-message">{errors.zipCode}</span>
      {/if}
    </div>

    <div class="form-group">
      <label for="country">Country *</label>
      <CountrySelect
        id="country"
        value={formData.country}
        hasError={Boolean(errors.country)}
        onChange={(code) => updateField('country', code)}
      />
      {#if errors.country}
        <span class="error-message">{errors.country}</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .shipping-address-form {
    background: var(--color-bg-primary);
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 10px var(--color-shadow-light);
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .shipping-address-form h3 {
    margin: 0 0 1.5rem 0;
    color: var(--color-text-primary);
    transition: color var(--transition-normal);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--color-text-secondary);
    font-weight: 500;
    transition: color var(--transition-normal);
  }

  .form-group input,
  .form-group :global(select) {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 4px;
    font-size: 1rem;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    transition:
      border-color var(--transition-normal),
      background-color var(--transition-normal),
      color var(--transition-normal);
  }

  .form-group input:focus,
  .form-group :global(select:focus) {
    outline: none;
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  .form-group input.error,
  .form-group :global(select.error) {
    border-color: var(--color-danger);
  }

  .error-message {
    display: block;
    color: var(--color-danger);
    font-size: 0.875rem;
    margin-top: 0.25rem;
    transition: color var(--transition-normal);
  }

  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
