<script lang="ts">
  import { checkoutStore } from '../stores/checkout';
  import { copyShippingToBilling } from '../stores/checkout';
  import type { BillingAddress } from '../types/checkout';
  import CountrySelect from './CountrySelect.svelte';

  export let errors: Partial<Record<keyof BillingAddress, string>> = {};

  $: formData = $checkoutStore.formData.billingAddress;
  $: sameAsShipping = $checkoutStore.formData.sameAsShipping;

  // Update billing address when sameAsShipping changes
  $: if (sameAsShipping) {
    const shippingAddress = $checkoutStore.formData.shippingAddress;
    const billingAddress = copyShippingToBilling(shippingAddress);
    checkoutStore.updateFormData({ billingAddress });
  }

  function updateField(field: keyof BillingAddress, value: string) {
    const updatedAddress = { ...formData, [field]: value };
    checkoutStore.updateFormData({
      billingAddress: updatedAddress
    });
  }

  function handleSameAsShippingChange(event: Event) {
    const target = event.target as HTMLInputElement;
    checkoutStore.setSameAsShipping(target.checked);
  }
</script>

<div class="billing-address-form">
  <h3>Billing Address</h3>

  <div class="same-address-toggle">
    <label class="checkbox-label">
      <input type="checkbox" checked={sameAsShipping} on:change={handleSameAsShippingChange} />
      <span>Same as shipping address</span>
    </label>
  </div>

  {#if !sameAsShipping}
    <div class="billing-fields">
      <div class="form-row">
        <div class="form-group">
          <label for="billingFirstName">First Name *</label>
          <input
            type="text"
            id="billingFirstName"
            value={formData.firstName}
            on:input={(e) => updateField('firstName', e.currentTarget.value)}
            class:error={errors.firstName}
            disabled={sameAsShipping}
          />
          {#if errors.firstName}
            <span class="error-message">{errors.firstName}</span>
          {/if}
        </div>

        <div class="form-group">
          <label for="billingLastName">Last Name *</label>
          <input
            type="text"
            id="billingLastName"
            value={formData.lastName}
            on:input={(e) => updateField('lastName', e.currentTarget.value)}
            class:error={errors.lastName}
            disabled={sameAsShipping}
          />
          {#if errors.lastName}
            <span class="error-message">{errors.lastName}</span>
          {/if}
        </div>
      </div>

      <div class="form-group">
        <label for="billingAddress">Address *</label>
        <input
          type="text"
          id="billingAddress"
          value={formData.address}
          on:input={(e) => updateField('address', e.currentTarget.value)}
          class:error={errors.address}
          disabled={sameAsShipping}
        />
        {#if errors.address}
          <span class="error-message">{errors.address}</span>
        {/if}
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="billingCity">City *</label>
          <input
            type="text"
            id="billingCity"
            value={formData.city}
            on:input={(e) => updateField('city', e.currentTarget.value)}
            class:error={errors.city}
            disabled={sameAsShipping}
          />
          {#if errors.city}
            <span class="error-message">{errors.city}</span>
          {/if}
        </div>

        <div class="form-group">
          <label for="billingState">State *</label>
          <input
            type="text"
            id="billingState"
            value={formData.state}
            on:input={(e) => updateField('state', e.currentTarget.value)}
            class:error={errors.state}
            disabled={sameAsShipping}
          />
          {#if errors.state}
            <span class="error-message">{errors.state}</span>
          {/if}
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="billingZipCode">ZIP Code *</label>
          <input
            type="text"
            id="billingZipCode"
            value={formData.zipCode}
            on:input={(e) => updateField('zipCode', e.currentTarget.value)}
            class:error={errors.zipCode}
            disabled={sameAsShipping}
          />
          {#if errors.zipCode}
            <span class="error-message">{errors.zipCode}</span>
          {/if}
        </div>

        <div class="form-group">
          <label for="billingCountry">Country *</label>
          <CountrySelect
            id="billingCountry"
            value={formData.country}
            hasError={Boolean(errors.country)}
            disabled={sameAsShipping}
            onChange={(code) => updateField('country', code)}
          />
          {#if errors.country}
            <span class="error-message">{errors.country}</span>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .billing-address-form {
    background: var(--color-bg-primary);
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 10px var(--color-shadow-light);
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .billing-address-form h3 {
    margin: 0 0 1.5rem 0;
    color: var(--color-text-primary);
    transition: color var(--transition-normal);
  }

  .same-address-toggle {
    margin-bottom: 1.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    color: var(--color-text-secondary);
    transition: color var(--transition-normal);
  }

  .checkbox-label input[type='checkbox'] {
    width: auto;
    margin: 0;
  }

  .billing-fields {
    border-top: 1px solid var(--color-border-primary);
    padding-top: 1.5rem;
    transition: border-color var(--transition-normal);
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

  .form-group input:disabled,
  .form-group :global(select:disabled) {
    background: var(--color-bg-tertiary);
    cursor: not-allowed;
    opacity: 0.7;
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
