<script lang="ts">
  import { enhance } from '$app/forms';
  import { toastStore } from '$lib/stores/toast';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: if (form?.success) {
    toastStore.success(form.message || 'Email settings updated successfully!');
  }
  $: if (form?.error) {
    toastStore.error(form.error);
  }

  $: emailSettings = data.settings;
  let isSubmitting = false;
</script>

<svelte:head>
  <title>Email Settings - Ammoura Admin</title>
</svelte:head>

<div class="settings-page">
  <div class="page-header">
    <h1>Email Settings</h1>
    <p>Configure SMTP server and email notifications</p>
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
      <div class="form-section">
        <h3>SMTP Server</h3>

        <div class="form-group">
          <label for="smtpHost">SMTP Host</label>
          <input
            id="smtpHost"
            name="smtpHost"
            type="text"
            value={emailSettings.smtpHost}
            placeholder="smtp.example.com"
          />
        </div>

        <div class="form-group">
          <label for="smtpPort">SMTP Port</label>
          <input
            id="smtpPort"
            name="smtpPort"
            type="number"
            value={emailSettings.smtpPort}
            placeholder="587"
          />
        </div>

        <div class="form-group">
          <label for="smtpUser">Username</label>
          <input
            id="smtpUser"
            name="smtpUser"
            type="text"
            value={emailSettings.smtpUsername}
            placeholder="user@example.com"
            autocomplete="username"
          />
        </div>

        <div class="form-group">
          <label for="smtpPassword">Password</label>
          <input
            id="smtpPassword"
            name="smtpPassword"
            type="password"
            value={emailSettings.smtpPassword}
            autocomplete="current-password"
          />
          <p class="help-text">⚠️ Password is stored securely but handle with care</p>
        </div>

        <div class="form-group">
          <ToggleSwitch
            name="smtpSecure"
            checked={emailSettings.smtpSecure}
            label="Use TLS/SSL"
            description="Enable secure connection (recommended)"
          />
        </div>
      </div>

      <div class="form-section">
        <h3>Email Addresses</h3>

        <div class="form-group">
          <label for="fromEmail">From Email</label>
          <input
            id="fromEmail"
            name="fromEmail"
            type="email"
            value={emailSettings.fromAddress}
            placeholder="noreply@example.com"
          />
          <p class="help-text">Email address used as sender for automated emails</p>
        </div>

        <div class="form-group">
          <label for="fromName">From Name</label>
          <input
            id="fromName"
            name="fromName"
            type="text"
            value={emailSettings.fromName}
            placeholder="My Store"
          />
        </div>
      </div>

      <div class="form-section">
        <h3>Notifications</h3>

        <div class="form-group">
          <ToggleSwitch
            name="sendOrderConfirmation"
            checked={emailSettings.newOrderEnabled}
            label="Send Order Confirmation"
            description="Email customers when they place an order"
          />
        </div>

        <div class="form-group">
          <ToggleSwitch
            name="sendShippingNotification"
            checked={emailSettings.orderStatusEnabled}
            label="Send Shipping Notification"
            description="Email customers when their order ships"
          />
        </div>

        <div class="form-group">
          <ToggleSwitch
            name="sendWelcomeEmail"
            checked={emailSettings.customerWelcomeEnabled}
            label="Send Welcome Email"
            description="Email new customers after registration"
          />
        </div>
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
  input[type='number'],
  input[type='password'] {
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

  .form-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--color-border-secondary);
  }

  .form-section:first-child {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }

  .form-section h3 {
    color: var(--color-text-primary);
    font-size: 1.1rem;
    margin: 0 0 1rem 0;
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

    .form-section {
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .form-section h3 {
      font-size: 1rem;
    }

    .form-group {
      margin-bottom: 1.25rem;
    }

    label {
      font-size: 0.875rem;
    }

    input[type='text'],
    input[type='email'],
    input[type='password'],
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

    .form-section {
      padding: 0.75rem;
    }
  }
</style>
