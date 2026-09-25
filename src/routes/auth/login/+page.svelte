<script lang="ts">
  import { DEFAULT_STORE_NAME } from '$lib/branding';
  import { t } from '$lib/i18n';
  import { authStore } from '$lib/stores/auth';
  import { goto, invalidateAll } from '$app/navigation';
  import { toastStore } from '$lib/stores/toast';
  import Button from '$lib/components/Button.svelte';
  import { page } from '$app/stores';
  import type { PageData } from './$types';
  import IconDisplay from '$lib/components/admin/IconDisplay.svelte';
  import DevLoginPanel from '$lib/components/dev/DevLoginPanel.svelte';

  export let data: PageData;

  let email = '';
  let password = '';
  let isLoading = false;
  let error = '';

  // Check for OAuth error in URL
  $: if ($page.url.searchParams.get('error')) {
    const errorType = $page.url.searchParams.get('error');
    const provider = $page.url.searchParams.get('provider');

    switch (errorType) {
      case 'oauth_denied':
        error = `${provider} sign-in was cancelled. Please try again.`;
        break;
      case 'oauth_failed':
        error = `${provider} sign-in failed. Please try again or use email/password.`;
        break;
      case 'no_email':
        error = `${provider} did not provide an email address. Please use a different method.`;
        break;
      case 'email_unverified':
        error = `${provider} has not verified that email address, so it cannot be linked to an existing account. Verify it with ${provider}, or sign in with your password.`;
        break;
      case 'account_inactive':
        error = 'Your account is inactive. Please contact support.';
        break;
      case 'provider_not_configured':
        error = `${provider} sign-in is not set up on this site yet. Use email and password, or ask an administrator to add the credentials.`;
        break;
      case 'unknown_provider':
        error = 'That sign-in method is not available.';
        break;
      default:
        error = 'Authentication failed. Please try again.';
    }
  }

  // Get SSO providers from server data
  $: oauthProviders = data.ssoProviders || [];

  async function handleLogin() {
    error = '';

    // Basic validation
    if (!email || !password) {
      error = 'Please enter both email and password';
      return;
    }

    isLoading = true;

    try {
      const success = await authStore.login(email, password);

      if (success) {
        toastStore.success('Login successful!');
        // Invalidate all data to refresh server state (including currentUser), then redirect
        await invalidateAll();
        goto('/admin/dashboard');
      } else {
        error = 'Invalid email or password';
        toastStore.error('Login failed. Please check your credentials.');
      }
    } catch {
      error = 'An error occurred during login';
      toastStore.error('An error occurred. Please try again.');
    } finally {
      isLoading = false;
    }
  }

  function handleOAuthLogin(provider: string) {
    window.location.href = `/api/auth/oauth/${provider}`;
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleLogin();
    }
  }
</script>

<svelte:head>
  <title>{$t('auth.login')} - {data.storeName || DEFAULT_STORE_NAME}</title>
  <meta name="description" content="Login to {data.storeName || DEFAULT_STORE_NAME} Platform" />
</svelte:head>

<div class="login-container">
  <div class="login-card">
    <div class="login-header">
      <h1>{$t('auth.login')}</h1>
      <p>{$t('auth.loginSubtitle')}</p>
    </div>

    <!-- SSO Provider Buttons -->
    {#if oauthProviders.length > 0}
      <div class="sso-section">
        <p class="sso-title">{$t('auth.signInWith')}</p>
        <div class="sso-providers">
          {#each oauthProviders as provider}
            {#if provider.enabled}
              <button
                type="button"
                class="sso-button"
                on:click={() => handleOAuthLogin(provider.id)}
                disabled={isLoading}
                title={`${$t('auth.signInWith')} ${provider.name}`}
              >
                <span class="sso-icon">
                  <IconDisplay iconName={provider.icon} size={20} fallbackEmoji={provider.icon} />
                </span>
                <span class="sso-name">{provider.name}</span>
              </button>
            {/if}
          {/each}
        </div>
      </div>

      <div class="divider">
        <span>{$t('auth.orContinueWithEmail')}</span>
      </div>
    {/if}

    <form on:submit|preventDefault={handleLogin}>
      <div class="form-group">
        <label for="email">{$t('auth.email')}</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          on:keypress={handleKeyPress}
          placeholder={$t('auth.emailPlaceholder')}
          disabled={isLoading}
          required
        />
      </div>

      <div class="form-group">
        <label for="password">{$t('auth.password')}</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          on:keypress={handleKeyPress}
          placeholder={$t('auth.passwordPlaceholder')}
          disabled={isLoading}
          required
        />
      </div>

      {#if error}
        <div class="error-message">
          {error}
        </div>
      {/if}

      <div class="form-actions">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? $t('auth.signingIn') : $t('auth.signIn')}
        </Button>
      </div>
    </form>

    <DevLoginPanel />
  </div>
</div>

<style>
  .login-container {
    min-height: calc(100vh - 200px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .login-card {
    width: 100%;
    max-width: 420px;
    background: var(--color-bg-primary);
    border-radius: 12px;
    box-shadow: 0 4px 20px var(--color-shadow-medium);
    padding: 2.5rem;
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .login-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .login-header h1 {
    color: var(--color-primary);
    font-size: 2rem;
    margin: 0 0 0.5rem 0;
    transition: color var(--transition-normal);
  }

  .login-header p {
    color: var(--color-text-secondary);
    margin: 0;
    transition: color var(--transition-normal);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    color: var(--color-text-primary);
    font-weight: 600;
    font-size: 0.9rem;
    transition: color var(--transition-normal);
  }

  input {
    padding: 0.75rem;
    border: 2px solid var(--color-border-secondary);
    border-radius: 6px;
    font-size: 1rem;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    transition:
      border-color var(--transition-normal),
      background-color var(--transition-normal),
      color var(--transition-normal);
  }

  input:focus {
    outline: none;
    border-color: var(--color-border-focus);
  }

  input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-message {
    padding: 0.75rem;
    background: rgba(220, 38, 38, 0.1);
    border: 1px solid var(--color-danger);
    border-radius: 6px;
    color: var(--color-danger);
    font-size: 0.9rem;
  }

  .form-actions {
    margin-top: 0.5rem;
  }

  /* SSO Styles */
  .sso-section {
    margin-bottom: 1.5rem;
  }

  .sso-title {
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    margin: 0 0 1rem 0;
    font-weight: 500;
  }

  .sso-providers {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .sso-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border-secondary);
    border-radius: 6px;
    color: var(--color-text-primary);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color var(--transition-normal),
      border-color var(--transition-normal),
      transform var(--transition-fast);
  }

  .sso-button:hover:not(:disabled) {
    background: var(--color-bg-accent);
    border-color: var(--color-primary);
    transform: translateY(-2px);
  }

  .sso-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .sso-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .sso-icon {
    font-size: 1.2rem;
    line-height: 1;
  }

  .sso-name {
    font-size: 0.85rem;
  }

  .divider {
    position: relative;
    text-align: center;
    margin: 1.5rem 0;
  }

  .divider::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: var(--color-border-secondary);
  }

  .divider span {
    position: relative;
    display: inline-block;
    padding: 0 1rem;
    background: var(--color-bg-primary);
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .login-container {
      padding: 1rem;
      min-height: calc(100vh - 150px);
    }

    .login-card {
      padding: 1.5rem;
      max-width: 100%;
    }

    .login-header h1 {
      font-size: 1.5rem;
    }

    .sso-providers {
      grid-template-columns: 1fr;
    }

    .sso-button {
      padding: 0.8rem;
    }

    .sso-name {
      font-size: 0.9rem;
    }
  }

  @media (max-width: 480px) {
    .login-card {
      padding: 1.25rem;
    }

    .login-header {
      margin-bottom: 1.5rem;
    }

    .login-header h1 {
      font-size: 1.4rem;
    }

    .login-header p {
      font-size: 0.9rem;
    }

    input {
      padding: 0.65rem;
      font-size: 0.95rem;
    }

    label {
      font-size: 0.85rem;
    }
  }
</style>
