<script lang="ts">
  import { enhance } from '$app/forms';
  import { toastStore } from '$lib/stores/toast';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: if (form?.success) {
    toastStore.success(form.message || 'Tax settings updated successfully!');
  }
  $: if (form?.error) {
    toastStore.error(form.error);
  }

  $: taxSettings = data.settings;
  let isSubmitting = false;
</script>

<svelte:head>
  <title>Tax Settings - Hermes Admin</title>
</svelte:head>

<div class="settings-page">
  <div class="page-header">
    <h1>Tax Settings</h1>
    <p>Configure tax calculations and display options</p>
    <p class="page-note">
      Checkout charges what is set here. With calculations off, this store adds no tax to an order.
      Per-product tax classes are not applied yet — every taxed line uses the default rate below.
    </p>
  </div>

  <div class="settings-card">
    <form
      method="POST"
      use:enhance={() => {
        isSubmitting = true;
        return async ({ update }) => {
          await update();
          isSubmitting = false;
        };
      }}
    >
      <div class="form-group">
        <ToggleSwitch
          name="calculationsEnabled"
          checked={taxSettings.calculationsEnabled}
          label="Enable Tax Calculations"
          description="Automatically calculate taxes at checkout"
        />
      </div>

      <div class="form-group">
        <ToggleSwitch
          name="pricesIncludeTax"
          checked={taxSettings.pricesIncludeTax}
          label="Prices Include Tax"
          description="Product prices already include tax"
        />
      </div>

      <div class="form-group">
        <ToggleSwitch
          name="displayPricesWithTax"
          checked={taxSettings.displayPricesWithTax}
          label="Display Prices With Tax"
          description="Show tax-inclusive prices to customers"
        />
      </div>

      <div class="form-group">
        <label for="defaultRate">Default Tax Rate (%)</label>
        <input
          id="defaultRate"
          name="defaultRate"
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={taxSettings.defaultRate}
        />
        <p class="help-text">Applied when specific tax rates aren't configured</p>
      </div>

      <button type="submit" class="save-btn" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  </div>
</div>

<style>
  .settings-page {
    width: 100%;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  h1 {
    color: var(--color-text-primary);
    font-size: 2rem;
    margin: 0 0 0.5rem 0;
    transition: color var(--transition-normal);
  }

  .page-header p {
    color: var(--color-text-secondary);
    margin: 0;
    transition: color var(--transition-normal);
  }

  .page-note {
    margin-top: 0.5rem !important;
    font-size: 0.875rem;
    max-width: 60ch;
  }

  .settings-card {
    background: var(--color-bg-primary);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px var(--color-shadow-light);
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    transition: color var(--transition-normal);
  }

  input[type='number'] {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid var(--color-border-secondary);
    border-radius: 6px;
    font-size: 1rem;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font-family: inherit;
    transition:
      border-color var(--transition-normal),
      background-color var(--transition-normal),
      color var(--transition-normal);
  }

  input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .help-text {
    font-size: 0.875rem;
    color: var(--color-text-tertiary);
    margin: 0.25rem 0 0 0;
  }

  .save-btn {
    width: 100%;
    padding: 0.875rem;
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border: none;
    border-radius: 8px;
    font-weight: 500;
    font-size: 1rem;
    cursor: pointer;
    transition:
      background-color var(--transition-normal),
      transform var(--transition-normal);
  }

  .save-btn:hover:not(:disabled) {
    background: var(--color-primary-hover);
    transform: translateY(-2px);
  }

  .save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Mobile-first responsive design */
  @media (max-width: 768px) {
    .settings-page {
      max-width: 100%;
    }

    .page-header {
      margin-bottom: 1.5rem;
    }

    h1 {
      font-size: 1.5rem;
    }

    .page-header p {
      font-size: 0.875rem;
    }

    .settings-card {
      padding: 1rem;
      border-radius: 8px;
    }

    .form-group {
      margin-bottom: 1.25rem;
    }

    label {
      font-size: 0.875rem;
    }

    input[type='number'] {
      padding: 0.625rem;
      font-size: 0.9375rem;
    }

    .help-text {
      font-size: 0.75rem;
    }

    .save-btn {
      padding: 0.75rem;
      font-size: 0.9375rem;
    }
  }

  @media (max-width: 480px) {
    .settings-card {
      padding: 0.875rem;
    }

    h1 {
      font-size: 1.25rem;
    }
  }
</style>
