<script lang="ts">
  import { DEFAULT_STORE_NAME } from '$lib/branding';
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import { toastStore } from '$lib/stores/toast';
  import Button from '$lib/components/Button.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import UserThemePreferences from '$lib/components/UserThemePreferences.svelte';
  import { t } from '$lib/i18n';
  import { formatRole } from '$lib/utils/roleLabel';
  import type { PageData, ActionData } from './$types';
  import { invalidateAll } from '$app/navigation';

  export let data: PageData;
  export let form: ActionData;

  let isUpdatingProfile = false;
  let isChangingPassword = false;

  // Form values (initialized from user data)
  let name = data.user.name;
  let email = data.user.email;
  let locale = data.user.locale ?? '';

  // Password fields
  let currentPassword = '';
  let newPassword = '';
  let confirmPassword = '';

  // Helper to safely access error fields
  function getError(errors: Record<string, string> | undefined, key: string): string | undefined {
    return errors?.[key];
  }

  // Reset password fields on successful change
  $: if (form?.passwordSuccess) {
    currentPassword = '';
    newPassword = '';
    confirmPassword = '';
    toastStore.success('Password changed successfully');
  }

  // Show success toast for profile update
  $: if (form?.success) {
    toastStore.success('Profile updated successfully');
  }

  // Update form values when data changes
  $: {
    name = data.user.name;
    email = data.user.email;
  }

  function formatDate(timestamp: number | null): string {
    if (!timestamp) return 'Never';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'admin':
        return 'badge-admin';
      case 'platform_engineer':
        return 'badge-engineer';
      case 'user':
        return 'badge-user';
      case 'customer':
        return 'badge-customer';
      default:
        return 'badge-default';
    }
  }
</script>

<svelte:head>
  <title>My Profile - {$page.data.storeName || DEFAULT_STORE_NAME}</title>
</svelte:head>

<div class="profile-container">
  <div class="profile-header">
    <Avatar name={data.user.name} size="large" variant="primary" />
    <div class="header-info">
      <h1>{data.user.name}</h1>
      <p class="email">{data.user.email}</p>
      <span class="role-badge {getRoleBadgeClass(data.user.role)}">
        {formatRole(data.user.role, $t)}
      </span>
    </div>
  </div>

  <div class="profile-content">
    <!-- Profile Information Section -->
    <section class="profile-section">
      <h2>Profile Information</h2>
      <form
        method="POST"
        action="?/updateProfile"
        use:enhance={() => {
          isUpdatingProfile = true;
          return async ({ update }) => {
            await update();
            await invalidateAll();
            isUpdatingProfile = false;
          };
        }}
      >
        {#if getError(form?.errors, 'general')}
          <div class="error-message">{getError(form?.errors, 'general')}</div>
        {/if}

        <div class="form-group">
          <label for="name">Full Name</label>
          <input
            type="text"
            id="name"
            name="name"
            bind:value={name}
            placeholder="Your full name"
            required
          />
          {#if getError(form?.errors, 'name')}
            <span class="field-error">{getError(form?.errors, 'name')}</span>
          {/if}
        </div>

        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            bind:value={email}
            placeholder="your@email.com"
            required
          />
          {#if getError(form?.errors, 'email')}
            <span class="field-error">{getError(form?.errors, 'email')}</span>
          {/if}
        </div>

        <div class="form-group">
          <label for="locale">Admin language</label>
          <select id="locale" name="locale" bind:value={locale}>
            <option value="">Site default</option>
            {#each data.availableLocales as l (l.code)}
              <option value={l.code}>{l.name} ({l.nativeName})</option>
            {/each}
          </select>
        </div>

        <div class="form-actions">
          <Button type="submit" variant="primary" disabled={isUpdatingProfile}>
            {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </section>

    <!-- Account Details Section -->
    <section class="profile-section">
      <h2>Account Details</h2>
      <div class="details-grid">
        <div class="detail-item">
          <span class="label">Account ID</span>
          <span class="value">{data.user.id}</span>
        </div>
        <div class="detail-item">
          <span class="label">Status</span>
          <span class="value status-{data.user.status}">{data.user.status}</span>
        </div>
        <div class="detail-item">
          <span class="label">Member Since</span>
          <span class="value">{formatDate(data.user.created_at)}</span>
        </div>
        <div class="detail-item">
          <span class="label">Last Login</span>
          <span class="value">{formatDate(data.user.last_login_at)}</span>
        </div>
        {#if data.user.expiration_date}
          <div class="detail-item">
            <span class="label">Account Expires</span>
            <span class="value">{formatDate(data.user.expiration_date)}</span>
          </div>
        {/if}
      </div>
    </section>

    <!-- Change Password Section -->
    <section class="profile-section">
      <h2>Change Password</h2>
      <form
        method="POST"
        action="?/changePassword"
        use:enhance={() => {
          isChangingPassword = true;
          return async ({ update }) => {
            await update();
            isChangingPassword = false;
          };
        }}
      >
        {#if getError(form?.passwordErrors, 'general')}
          <div class="error-message">{getError(form?.passwordErrors, 'general')}</div>
        {/if}

        <div class="form-group">
          <label for="currentPassword">Current Password</label>
          <input
            type="password"
            id="currentPassword"
            name="currentPassword"
            bind:value={currentPassword}
            placeholder="Enter your current password"
            autocomplete="current-password"
            required
          />
          {#if getError(form?.passwordErrors, 'currentPassword')}
            <span class="field-error">{getError(form?.passwordErrors, 'currentPassword')}</span>
          {/if}
        </div>

        <div class="form-group">
          <label for="newPassword">New Password</label>
          <input
            type="password"
            id="newPassword"
            name="newPassword"
            bind:value={newPassword}
            placeholder="Enter your new password (min 12 characters)"
            autocomplete="new-password"
            required
            minlength="12"
          />
          {#if getError(form?.passwordErrors, 'newPassword')}
            <span class="field-error">{getError(form?.passwordErrors, 'newPassword')}</span>
          {/if}
          <span class="field-hint">Password must be at least 12 characters long</span>
        </div>

        <div class="form-group">
          <label for="confirmPassword">Confirm New Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            bind:value={confirmPassword}
            placeholder="Confirm your new password"
            autocomplete="new-password"
            required
          />
          {#if getError(form?.passwordErrors, 'confirmPassword')}
            <span class="field-error">{getError(form?.passwordErrors, 'confirmPassword')}</span>
          {/if}
        </div>

        <div class="form-actions">
          <Button type="submit" variant="primary" disabled={isChangingPassword}>
            {isChangingPassword ? 'Changing...' : 'Change Password'}
          </Button>
        </div>
      </form>
    </section>

    <!-- Theme Preferences Section -->
    <section class="profile-section theme-section">
      <UserThemePreferences />
    </section>
  </div>
</div>

<style>
  /* Mobile-first base styles */
  .profile-container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--spacing-md);
  }

  .profile-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
    background: var(--color-bg-secondary);
    border-radius: 12px;
    margin-bottom: var(--spacing-lg);
    border: 1px solid var(--color-border-primary);
  }

  .header-info h1 {
    margin: 0 0 var(--spacing-xs) 0;
    font-size: 1.5rem;
    color: var(--color-text-primary);
  }

  .header-info .email {
    margin: 0 0 var(--spacing-sm) 0;
    color: var(--color-text-secondary);
    word-break: break-word;
  }

  .role-badge {
    display: inline-block;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  /* Role badges using theme colors */
  .badge-admin {
    background: var(--color-bg-danger-light);
    color: var(--color-danger);
  }

  .badge-engineer {
    background: var(--color-bg-info-light);
    color: var(--color-info);
  }

  .badge-user {
    background: var(--color-bg-success-light);
    color: var(--color-success);
  }

  .badge-customer {
    background: rgba(139, 92, 246, 0.1);
    color: var(--color-primary);
  }

  .badge-default {
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
  }

  .profile-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .profile-section {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-primary);
    border-radius: 12px;
    padding: var(--spacing-md);
  }

  .profile-section h2 {
    margin: 0 0 var(--spacing-md) 0;
    font-size: 1.125rem;
    color: var(--color-text-primary);
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid var(--color-border-primary);
  }

  .form-group {
    margin-bottom: var(--spacing-md);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .form-group input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-border-primary);
    border-radius: 8px;
    font-size: 1rem;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
    /* Ensure minimum touch target */
    min-height: 44px;
  }

  .form-group input::placeholder {
    color: var(--color-text-secondary);
    opacity: 0.7;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-bg-info-light);
  }

  .field-error {
    display: block;
    margin-top: var(--spacing-xs);
    color: var(--color-danger);
    font-size: 0.875rem;
  }

  .field-hint {
    display: block;
    margin-top: var(--spacing-xs);
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .error-message {
    background: var(--color-bg-danger-light);
    border: 1px solid var(--color-danger);
    color: var(--color-danger);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: 8px;
    margin-bottom: var(--spacing-md);
  }

  .form-actions {
    margin-top: var(--spacing-md);
  }

  .details-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    background: var(--color-bg-secondary);
    border-radius: 8px;
  }

  .detail-item .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
  }

  .detail-item .value {
    font-weight: 500;
    color: var(--color-text-primary);
    word-break: break-word;
  }

  .status-active {
    color: var(--color-success);
  }

  .status-inactive,
  .status-expired,
  .status-suspended {
    color: var(--color-danger);
  }

  /* Tablet breakpoint (768px+) */
  @media (min-width: 768px) {
    .profile-container {
      padding: var(--spacing-xl);
    }

    .profile-header {
      flex-direction: row;
      text-align: left;
      gap: var(--spacing-lg);
      padding: var(--spacing-xl);
    }

    .header-info h1 {
      font-size: 1.75rem;
    }

    .profile-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-xl);
    }

    /* Profile section spans full width for forms, half for details */
    .profile-section:first-child {
      grid-column: 1 / 2;
    }

    .profile-section:nth-child(2) {
      grid-column: 2 / 3;
    }

    .profile-section:nth-child(3) {
      grid-column: 1 / -1;
    }

    /* Theme section spans full width */
    .profile-section.theme-section {
      grid-column: 1 / -1;
    }

    .profile-section {
      padding: var(--spacing-lg);
    }

    .profile-section h2 {
      font-size: 1.25rem;
      margin-bottom: var(--spacing-lg);
      padding-bottom: var(--spacing-sm);
    }

    .details-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* Desktop breakpoint (968px+) */
  @media (min-width: 968px) {
    .profile-container {
      padding: var(--spacing-2xl);
    }

    .profile-header {
      padding: var(--spacing-2xl);
    }

    .profile-content {
      grid-template-columns: 1fr 1fr;
    }

    /* Rearrange for better desktop layout */
    .profile-section:first-child {
      grid-column: 1 / 2;
      grid-row: 1 / 3;
    }

    .profile-section:nth-child(2) {
      grid-column: 2 / 3;
      grid-row: 1 / 2;
    }

    .profile-section:nth-child(3) {
      grid-column: 2 / 3;
      grid-row: 2 / 3;
    }

    /* Theme section spans full width */
    .profile-section.theme-section {
      grid-column: 1 / -1;
      grid-row: auto;
    }

    .details-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacing-md);
    }
  }

  /* Large desktop (1200px+) */
  @media (min-width: 1200px) {
    .details-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
