<script lang="ts">
  import { goto } from '$app/navigation';
  import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';

  // Form state
  let formData = {
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    role: 'customer' as 'admin' | 'user' | 'customer',
    status: 'active' as 'active' | 'inactive' | 'suspended',
    expiration_date: '',
    grace_period_days: 0,
    permissions: [] as string[]
  };

  let errors: Record<string, string> = {};
  let isSubmitting = false;
  let showPassword = false;
  let showConfirmPassword = false;

  // Available permissions
  const availablePermissions = [
    { id: 'orders:read', label: 'View Orders', category: 'Orders' },
    { id: 'orders:write', label: 'Create/Edit Orders', category: 'Orders' },
    { id: 'orders:delete', label: 'Delete Orders', category: 'Orders' },
    { id: 'orders:refund', label: 'Process Refunds', category: 'Orders' },
    { id: 'products:read', label: 'View Products', category: 'Products' },
    { id: 'products:write', label: 'Create/Edit Products', category: 'Products' },
    { id: 'products:delete', label: 'Delete Products', category: 'Products' },
    { id: 'reports:read', label: 'View Reports', category: 'Reports' },
    { id: 'reports:export', label: 'Export Reports', category: 'Reports' },
    { id: 'settings:read', label: 'View Settings', category: 'Settings' },
    { id: 'settings:write', label: 'Modify Settings', category: 'Settings' },
    { id: 'users:read', label: 'View Users', category: 'Users' },
    { id: 'users:write', label: 'Create/Edit Users', category: 'Users' },
    { id: 'users:delete', label: 'Delete Users', category: 'Users' },
    { id: 'users:roles', label: 'Manage User Roles', category: 'Users' },
    { id: 'pages:read', label: 'View Pages', category: 'Pages' },
    { id: 'pages:write', label: 'Create/Edit Pages', category: 'Pages' },
    { id: 'pages:publish', label: 'Publish Pages', category: 'Pages' },
    { id: 'logs:read', label: 'View Logs', category: 'Logs' }
  ];

  // Group permissions by category
  const permissionsByCategory = availablePermissions.reduce(
    (acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    },
    {} as Record<string, typeof availablePermissions>
  );

  function validateForm(): boolean {
    errors = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!formData.name) {
      errors.name = 'Name is required';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (formData.expiration_date && formData.grace_period_days < 0) {
      errors.grace_period_days = 'Grace period cannot be negative';
    }

    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    isSubmitting = true;

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          password: formData.password,
          role: formData.role,
          status: formData.status,
          permissions: formData.permissions,
          expiration_date: formData.expiration_date || null,
          grace_period_days: formData.grace_period_days
        })
      });

      const result = (await response.json()) as { success: boolean; error?: string };

      if (result.success) {
        goto('/admin/users');
      } else {
        errors.submit = result.error || 'Failed to create user';
      }
    } catch (error) {
      console.error('Error creating user:', error);
      errors.submit = 'An unexpected error occurred';
    } finally {
      isSubmitting = false;
    }
  }

  function togglePermission(permissionId: string): void {
    if (formData.permissions.includes(permissionId)) {
      formData.permissions = formData.permissions.filter((p) => p !== permissionId);
    } else {
      formData.permissions = [...formData.permissions, permissionId];
    }
  }
</script>

<svelte:head>
  <title>Create User - Ammoura Admin</title>
</svelte:head>

<div class="create-user-page">
  <div class="page-header">
    <div class="header-content">
      <div class="header-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke-width="2"></path>
          <circle cx="12" cy="7" r="4" stroke-width="2"></circle>
          <path d="M12 11v10M7 16h10" stroke-width="2" stroke-linecap="round"></path>
        </svg>
      </div>
      <div>
        <h1>Create New User</h1>
        <p>Add a new user account to the system</p>
      </div>
    </div>
    <a href="/admin/users" class="back-link">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M19 12H5M12 19l-7-7 7-7"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>
      </svg>
      Back to Users
    </a>
  </div>

  <form on:submit={handleSubmit} class="user-form">
    {#if errors.submit}
      <div class="error-banner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" stroke-width="2"></circle>
          <path d="M12 8v4M12 16h.01" stroke-width="2" stroke-linecap="round"></path>
        </svg>
        {errors.submit}
      </div>
    {/if}

    <!-- Basic Information -->
    <div class="form-section">
      <h2>Basic Information</h2>

      <div class="form-group">
        <label for="email">
          Email <span class="required">*</span>
        </label>
        <input
          id="email"
          type="email"
          bind:value={formData.email}
          class:error={errors.email}
          required
        />
        {#if errors.email}
          <span class="error-message">{errors.email}</span>
        {/if}
      </div>

      <div class="form-group">
        <label for="name">
          Full Name <span class="required">*</span>
        </label>
        <input
          id="name"
          type="text"
          bind:value={formData.name}
          class:error={errors.name}
          required
        />
        {#if errors.name}
          <span class="error-message">{errors.name}</span>
        {/if}
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="password">
            Password <span class="required">*</span>
          </label>
          <div class="password-field">
            {#if showPassword}
              <input
                id="password"
                type="text"
                bind:value={formData.password}
                class:error={errors.password}
                required
              />
            {:else}
              <input
                id="password"
                type="password"
                bind:value={formData.password}
                class:error={errors.password}
                required
              />
            {/if}
            <button
              type="button"
              class="toggle-password"
              on:click={() => (showPassword = !showPassword)}
            >
              {#if showPassword}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <circle cx="12" cy="12" r="3" stroke-width="2"></circle>
                </svg>
              {:else}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
              {/if}
            </button>
          </div>
          {#if errors.password}
            <span class="error-message">{errors.password}</span>
          {/if}
        </div>

        <div class="form-group">
          <label for="confirmPassword">
            Confirm Password <span class="required">*</span>
          </label>
          <div class="password-field">
            {#if showConfirmPassword}
              <input
                id="confirmPassword"
                type="text"
                bind:value={formData.confirmPassword}
                class:error={errors.confirmPassword}
                required
              />
            {:else}
              <input
                id="confirmPassword"
                type="password"
                bind:value={formData.confirmPassword}
                class:error={errors.confirmPassword}
                required
              />
            {/if}
            <button
              type="button"
              class="toggle-password"
              on:click={() => (showConfirmPassword = !showConfirmPassword)}
            >
              {#if showConfirmPassword}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <circle cx="12" cy="12" r="3" stroke-width="2"></circle>
                </svg>
              {:else}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
              {/if}
            </button>
          </div>
          {#if errors.confirmPassword}
            <span class="error-message">{errors.confirmPassword}</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Role & Status -->
    <div class="form-section">
      <h2>Role & Status</h2>

      <div class="form-row">
        <div class="form-group">
          <label for="role">Role</label>
          <select id="role" bind:value={formData.role}>
            <option value="customer">Customer</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <p class="help-text">Determines the user's base permissions</p>
        </div>

        <div class="form-group">
          <label for="status">Status</label>
          <select id="status" bind:value={formData.status}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          <p class="help-text">Current account status</p>
        </div>
      </div>
    </div>

    <!-- Expiration Settings -->
    <div class="form-section">
      <h2>Expiration Settings</h2>

      <div class="form-row">
        <div class="form-group">
          <label for="expiration_date">Expiration Date (Optional)</label>
          <input id="expiration_date" type="date" bind:value={formData.expiration_date} />
          <p class="help-text">Leave empty for no expiration</p>
        </div>

        <div class="form-group">
          <label for="grace_period_days">Grace Period (Days)</label>
          <input
            id="grace_period_days"
            type="number"
            min="0"
            bind:value={formData.grace_period_days}
            class:error={errors.grace_period_days}
          />
          <p class="help-text">Days after expiration before auto-deactivation</p>
          {#if errors.grace_period_days}
            <span class="error-message">{errors.grace_period_days}</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Custom Permissions -->
    <div class="form-section">
      <h2>Custom Permissions</h2>
      <p class="section-description">
        Select specific permissions for this user. Admin roles have default permissions that can be
        customized here.
      </p>

      <div class="permissions-grid">
        {#each Object.entries(permissionsByCategory) as [category, perms]}
          <div class="permission-category">
            <h3>{category}</h3>
            {#each perms as permission}
              <div class="permission-item">
                <span class="permission-label">{permission.label}</span>
                <ToggleSwitch
                  checked={formData.permissions.includes(permission.id)}
                  on:change={() => togglePermission(permission.id)}
                />
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>

    <!-- Form Actions -->
    <div class="form-actions">
      <button
        type="button"
        class="btn-secondary"
        on:click={() => goto('/admin/settings/admin-users')}
      >
        Cancel
      </button>
      <button type="submit" class="btn-primary" disabled={isSubmitting}>
        {#if isSubmitting}
          Creating...
        {:else}
          Create User
        {/if}
      </button>
    </div>
  </form>
</div>

<style>
  .create-user-page {
    width: 100%;
    padding: 2rem 1rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid var(--color-border-secondary);
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
    border-radius: 16px;
    color: white;
    box-shadow: 0 4px 12px var(--color-primary-alpha);
  }

  h1 {
    color: var(--color-text-primary);
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 0.25rem 0;
    letter-spacing: -0.5px;
  }

  .page-header p {
    color: var(--color-text-secondary);
    margin: 0;
    font-size: 1rem;
  }

  .back-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    text-decoration: none;
    border-radius: 8px;
    font-weight: 500;
    transition: all var(--transition-normal);
  }

  .back-link:hover {
    background: var(--color-bg-hover);
    transform: translateX(-4px);
  }

  .user-form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: color-mix(in srgb, var(--color-danger) 15%, transparent);
    color: var(--color-danger-hover);
    border-radius: 8px;
    border: 1px solid var(--color-danger);
  }

  .form-section {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .form-section h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: var(--color-text-primary);
  }

  .section-description {
    color: var(--color-text-secondary);
    margin: -0.5rem 0 1rem 0;
    font-size: 0.9rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 500;
    color: var(--color-text-primary);
    font-size: 0.9rem;
  }

  .required {
    color: var(--color-danger);
  }

  input[type='text'],
  input[type='email'],
  input[type='password'],
  input[type='number'],
  input[type='date'],
  select {
    padding: 0.75rem;
    border: 1px solid var(--color-border-primary);
    border-radius: 8px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 1rem;
    transition: all var(--transition-normal);
  }

  input:focus,
  select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-alpha);
  }

  input.error {
    border-color: var(--color-danger);
  }

  .password-field {
    position: relative;
  }

  .toggle-password {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
  }

  .toggle-password:hover {
    color: var(--color-text-primary);
  }

  .help-text {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .error-message {
    color: var(--color-danger);
    font-size: 0.85rem;
  }

  .permissions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .permission-category h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.75rem 0;
    color: var(--color-text-primary);
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--color-border-primary);
  }

  .permission-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0;
  }

  .permission-label {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    flex: 1;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border-primary);
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-normal);
    border: none;
    font-size: 1rem;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .btn-secondary:hover {
    background: var(--color-bg-hover);
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .permissions-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
