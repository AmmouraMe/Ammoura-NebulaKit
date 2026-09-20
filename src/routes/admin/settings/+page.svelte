<script lang="ts">
  import { enhance } from '$app/forms';
  import { toastStore } from '$lib/stores/toast';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
  import CountrySelect from '$lib/components/CountrySelect.svelte';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  // Reactive statements to handle form responses
  $: if (form?.success) {
    toastStore.success(form.message || 'Settings saved successfully!');
  }
  $: if (form?.error) {
    toastStore.error(form.error);
  }

  // Initialize form data from server
  $: generalSettings = data.settings.general;
  $: addressSettings = data.settings.address;

  let isSubmitting = false;
</script>

<svelte:head>
  <title>Settings - Hermes Admin</title>
</svelte:head>

<div class="settings-page">
  <div class="page-header">
    <h1>Site Settings</h1>
    <p>Manage your site configuration</p>
  </div>

  <div class="settings-content">
    <!-- General Settings -->
    <div class="settings-section">
      <h2>General Settings</h2>
      <div class="settings-card">
        <form
          method="POST"
          action="?/updateGeneral"
          use:enhance={() => {
            isSubmitting = true;
            return async ({ update }) => {
              await update();
              isSubmitting = false;
            };
          }}
        >
          <div class="form-group">
            <label for="storeName">Site Title</label>
            <input
              id="storeName"
              name="storeName"
              type="text"
              value={generalSettings.storeName}
              required
            />
          </div>

          <div class="form-group">
            <label for="tagline">Site Tagline</label>
            <input id="tagline" name="tagline" type="text" value={generalSettings.tagline} />
          </div>

          <div class="form-group">
            <label for="description">Site Description</label>
            <textarea
              id="description"
              name="description"
              rows="3"
              value={generalSettings.description}
            ></textarea>
          </div>

          <div class="form-group">
            <label for="storeEmail">Store Email</label>
            <input
              id="storeEmail"
              name="storeEmail"
              type="email"
              value={generalSettings.storeEmail}
              required
            />
          </div>

          <div class="form-group">
            <label for="supportEmail">Support Email</label>
            <input
              id="supportEmail"
              name="supportEmail"
              type="email"
              value={generalSettings.supportEmail}
            />
          </div>

          <div class="form-group">
            <label for="contactPhone">Contact Phone</label>
            <input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              value={generalSettings.contactPhone}
            />
          </div>

          <div class="form-group">
            <label for="currency">Currency</label>
            <select id="currency" name="currency" value={generalSettings.currency}>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="AUD">AUD - Australian Dollar</option>
              <option value="JPY">JPY - Japanese Yen</option>
            </select>
          </div>

          <div class="form-group">
            <label for="timezone">Timezone</label>
            <select id="timezone" name="timezone" value={generalSettings.timezone}>
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time (US)</option>
              <option value="America/Chicago">Central Time (US)</option>
              <option value="America/Denver">Mountain Time (US)</option>
              <option value="America/Los_Angeles">Pacific Time (US)</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
              <option value="Australia/Sydney">Sydney</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="weightUnit">Weight Unit</label>
              <select id="weightUnit" name="weightUnit" value={generalSettings.weightUnit}>
                <option value="lb">Pounds (lb)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="oz">Ounces (oz)</option>
                <option value="g">Grams (g)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="dimensionUnit">Dimension Unit</label>
              <select id="dimensionUnit" name="dimensionUnit" value={generalSettings.dimensionUnit}>
                <option value="in">Inches (in)</option>
                <option value="cm">Centimeters (cm)</option>
                <option value="ft">Feet (ft)</option>
                <option value="m">Meters (m)</option>
              </select>
            </div>
          </div>

          <div class="form-section">
            <h3>Store Address</h3>

            <div class="form-group">
              <label for="street">Street Address</label>
              <input id="street" name="street" type="text" value={addressSettings.street} />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="city">City</label>
                <input id="city" name="city" type="text" value={addressSettings.city} />
              </div>

              <div class="form-group">
                <label for="state">State/Province</label>
                <input id="state" name="state" type="text" value={addressSettings.state} />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="postcode">Postal Code</label>
                <input id="postcode" name="postcode" type="text" value={addressSettings.postcode} />
              </div>

              <div class="form-group">
                <label for="country">Country</label>
                <CountrySelect id="country" name="country" value={addressSettings.country} />
              </div>
            </div>

            <div class="form-group">
              <ToggleSwitch
                name="geolocationEnabled"
                checked={addressSettings.geolocationEnabled}
                label="Enable Geolocation"
                description="Allow customers to use their location for shipping estimates"
              />
            </div>
          </div>

          <button type="submit" class="save-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>

    <!-- Shipping Settings -->
    <div class="settings-section">
      <h2>Shipping Methods</h2>
      <div class="settings-card">
        <p class="info-message">
          Configure shipping options in the
          <a href="/admin/settings/shipping">Shipping Options</a> page.
        </p>
        <div class="quick-nav">
          <a href="/admin/settings/shipping" class="nav-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
            </svg>
            Manage Shipping Options
          </a>
        </div>
      </div>
    </div>
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

  .settings-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .settings-section {
    width: 100%;
  }

  .settings-section > h2 {
    color: var(--color-text-primary);
    font-size: 1.5rem;
    margin: 0 0 1rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--color-border-secondary);
    transition: color var(--transition-normal);
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

  input[type='text'],
  input[type='email'],
  input[type='tel'],
  textarea,
  select,
  .form-group :global(select) {
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

  textarea {
    resize: vertical;
    min-height: 80px;
  }

  input:focus,
  textarea:focus,
  select:focus,
  .form-group :global(select:focus) {
    outline: none;
    border-color: var(--color-primary);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--color-border-secondary);
  }

  .form-section h3 {
    color: var(--color-text-primary);
    font-size: 1.1rem;
    margin: 0 0 1rem 0;
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

  .info-message {
    padding: 1rem;
    background: var(--color-bg-tertiary);
    border-radius: 8px;
    color: var(--color-text-secondary);
    margin-bottom: 1rem;
    transition:
      background-color var(--transition-normal),
      color var(--transition-normal);
  }

  .info-message a {
    color: var(--color-primary);
    text-decoration: underline;
    transition: color var(--transition-normal);
  }

  .quick-nav {
    display: flex;
    gap: 1rem;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border-radius: 8px;
    text-decoration: none;
    font-weight: 500;
    transition:
      background-color var(--transition-normal),
      transform var(--transition-normal);
  }

  .nav-btn:hover {
    background: var(--color-primary-hover);
    transform: translateY(-2px);
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

    .settings-content {
      gap: 1.5rem;
    }

    .settings-section h2 {
      font-size: 1.25rem;
    }

    .settings-card {
      padding: 1rem;
      border-radius: 8px;
    }

    .form-group {
      margin-bottom: 1.25rem;
    }

    .form-row {
      grid-template-columns: 1fr;
      gap: 0.875rem;
    }

    .form-section {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
    }

    .form-section h3 {
      font-size: 1rem;
    }

    label {
      font-size: 0.875rem;
    }

    input,
    textarea,
    select,
    .form-group :global(select) {
      padding: 0.625rem;
      font-size: 0.9375rem;
    }

    .save-btn {
      padding: 0.75rem;
      font-size: 0.9375rem;
    }

    .quick-nav {
      flex-direction: column;
    }

    .nav-btn {
      width: 100%;
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    h1 {
      font-size: 1.25rem;
    }

    .settings-section h2 {
      font-size: 1.125rem;
    }

    .settings-card {
      padding: 0.875rem;
    }
  }
</style>
