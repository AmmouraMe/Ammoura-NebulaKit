<script lang="ts">
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { confirmStore } from '$lib/stores/confirm';
  import { toastStore } from '$lib/stores/toast';
  import type { PageData } from './$types';

  export let data: PageData;

  let isEditingRole = false;
  let isEditingStatus = false;
  let selectedRole = data.user.role;
  let selectedStatus = data.user.status;

  function formatDate(timestamp: number | null): string {
    if (!timestamp) return 'Never';
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  function formatDateTime(timestamp: number | null): string {
    if (!timestamp) return 'Never';
    return new Date(timestamp * 1000).toLocaleString();
  }

  function getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'platform_engineer':
        return 'role-badge-engineer';
      case 'admin':
        return 'role-badge-admin';
      case 'user':
        return 'role-badge-user';
      default:
        return 'role-badge-customer';
    }
  }

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'active':
        return 'status-badge-active';
      case 'inactive':
        return 'status-badge-inactive';
      case 'expired':
        return 'status-badge-expired';
      case 'suspended':
        return 'status-badge-suspended';
      default:
        return '';
    }
  }

  function getSeverityBadgeClass(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'severity-critical';
      case 'error':
        return 'severity-error';
      case 'warning':
        return 'severity-warning';
      default:
        return 'severity-info';
    }
  }

  async function handleDelete() {
    const confirmed = await confirmStore.show(
      `Are you sure you want to delete user "${data.user.name}"? This action cannot be undone.`,
      {
        title: 'Delete User',
        confirmText: 'Delete',
        variant: 'danger'
      }
    );
    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    const response = await fetch(`?/delete`, {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      goto('/admin/users');
    } else {
      toastStore.error('Failed to delete user');
    }
  }

  function getAccountExpirationStatus(): { text: string; class: string } | null {
    if (!data.user.expiration_date) {
      return null;
    }

    const now = Date.now() / 1000;
    const expirationDate = data.user.expiration_date;
    const gracePeriod = data.user.grace_period_days * 86400; // days to seconds

    if (now > expirationDate + gracePeriod) {
      return { text: 'Expired', class: 'expired' };
    } else if (now > expirationDate) {
      const daysRemaining = Math.ceil((expirationDate + gracePeriod - now) / 86400);
      return {
        text: `Grace period (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining)`,
        class: 'grace-period'
      };
    } else {
      const daysUntilExpiration = Math.ceil((expirationDate - now) / 86400);
      if (daysUntilExpiration <= 7) {
        return {
          text: `Expires in ${daysUntilExpiration} day${daysUntilExpiration === 1 ? '' : 's'}`,
          class: 'expiring-soon'
        };
      }
    }

    return null;
  }

  $: expirationStatus = getAccountExpirationStatus();
</script>

<svelte:head>
  <title>{data.user.name} - User Details - Ammoura Admin</title>
</svelte:head>

<div class="user-detail-page">
  <div class="page-header">
    <button class="btn-back" on:click={() => goto('/admin/settings/admin-users')}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back to Admin Users
    </button>
    <div class="header-content">
      <div class="header-title-row">
        <h1>{data.user.name}</h1>
        {#if data.currentUser.canWrite && !data.user.isSystemUser && data.user.id !== data.currentUser.id}
          <a href="/admin/settings/admin-users/{data.user.id}/edit" class="btn-edit">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit User
          </a>
        {/if}
      </div>
      <div class="header-badges">
        <span class="role-badge {getRoleBadgeClass(data.user.role)}">
          {data.user.role.replace('_', ' ')}
        </span>
        <span class="status-badge {getStatusBadgeClass(data.user.status)}">
          {data.user.status}
        </span>
        {#if data.user.id === data.currentUser.id}
          <span class="current-user-badge" title="This is your account"> ✨ Hey it's me! </span>
        {:else if data.user.isSystemUser}
          <span class="system-user-badge" title="This is a system user and cannot be edited">
            🔒 System User
          </span>
        {/if}
        {#if expirationStatus}
          <span class="expiration-badge {expirationStatus.class}">
            {expirationStatus.text}
          </span>
        {/if}
      </div>
    </div>
  </div>

  <div class="content-grid">
    <!-- User Information Card -->
    <div class="card">
      <h2>User Information</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">User ID</span>
          <span class="value mono">{data.user.id}</span>
        </div>
        <div class="info-item">
          <span class="label">Email</span>
          <span class="value">{data.user.email}</span>
        </div>
        <div class="info-item">
          <span class="label">Name</span>
          <span class="value">{data.user.name}</span>
        </div>
        <div class="info-item">
          <span class="label">Account Status</span>
          <span class="value">
            {data.user.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div class="info-item">
          <span class="label">Created</span>
          <span class="value">{formatDateTime(data.user.created_at)}</span>
        </div>
        <div class="info-item">
          <span class="label">Last Updated</span>
          <span class="value">{formatDateTime(data.user.updated_at)}</span>
        </div>
        <div class="info-item">
          <span class="label">Last Login</span>
          <span class="value">{formatDateTime(data.user.last_login_at)}</span>
        </div>
        {#if data.user.last_login_ip}
          <div class="info-item">
            <span class="label">Last Login IP</span>
            <span class="value mono">{data.user.last_login_ip}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Role Management Card -->
    {#if data.currentUser.canManageRoles}
      <div class="card">
        <h2>Role Management</h2>
        {#if data.user.id === data.currentUser.id}
          <div class="info-item">
            <span class="label">Current Role</span>
            <span class="value">
              <span class="role-badge {getRoleBadgeClass(data.user.role)}">
                {data.user.role.replace('_', ' ')}
              </span>
            </span>
          </div>
          <div class="system-user-notice">
            <strong>✨ Hey it's me!</strong> You cannot change your own role.
          </div>
        {:else if data.user.isSystemUser}
          <div class="info-item">
            <span class="label">Current Role</span>
            <span class="value">
              <span class="role-badge {getRoleBadgeClass(data.user.role)}">
                {data.user.role.replace('_', ' ')}
              </span>
            </span>
          </div>
          <div class="system-user-notice">
            <strong>System User:</strong> Role cannot be changed for system users.
          </div>
        {:else if isEditingRole}
          <form method="POST" action="?/updateRole" use:enhance>
            <div class="form-group">
              <label for="role">Role</label>
              <select id="role" name="role" bind:value={selectedRole}>
                <option value="customer">Customer</option>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="platform_engineer">Platform Engineer</option>
              </select>
            </div>
            <div class="button-group">
              <button type="submit" class="btn-primary">Save</button>
              <button
                type="button"
                class="btn-secondary"
                on:click={() => {
                  isEditingRole = false;
                  selectedRole = data.user.role;
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        {:else}
          <div class="info-item">
            <span class="label">Current Role</span>
            <span class="value">
              <span class="role-badge {getRoleBadgeClass(data.user.role)}">
                {data.user.role.replace('_', ' ')}
              </span>
            </span>
          </div>
          <button class="btn-secondary" on:click={() => (isEditingRole = true)}>
            Change Role
          </button>
        {/if}
      </div>
    {/if}

    <!-- Status Management Card -->
    {#if data.currentUser.canWrite}
      <div class="card">
        <h2>Status Management</h2>
        {#if data.user.id === data.currentUser.id}
          <div class="info-item">
            <span class="label">Current Status</span>
            <span class="value">
              <span class="status-badge {getStatusBadgeClass(data.user.status)}">
                {data.user.status}
              </span>
            </span>
          </div>
          <div class="system-user-notice">
            <strong>✨ Hey it's me!</strong> You cannot change your own status.
          </div>
        {:else if data.user.isSystemUser}
          <div class="info-item">
            <span class="label">Current Status</span>
            <span class="value">
              <span class="status-badge {getStatusBadgeClass(data.user.status)}">
                {data.user.status}
              </span>
            </span>
          </div>
          <div class="system-user-notice">
            <strong>System User:</strong> Status cannot be changed for system users.
          </div>
        {:else if isEditingStatus}
          <form method="POST" action="?/updateStatus" use:enhance>
            <div class="form-group">
              <label for="status">Status</label>
              <select id="status" name="status" bind:value={selectedStatus}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div class="button-group">
              <button type="submit" class="btn-primary">Save</button>
              <button
                type="button"
                class="btn-secondary"
                on:click={() => {
                  isEditingStatus = false;
                  selectedStatus = data.user.status;
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        {:else}
          <div class="info-item">
            <span class="label">Current Status</span>
            <span class="value">
              <span class="status-badge {getStatusBadgeClass(data.user.status)}">
                {data.user.status}
              </span>
            </span>
          </div>
          <button class="btn-secondary" on:click={() => (isEditingStatus = true)}>
            Change Status
          </button>
        {/if}
      </div>
    {/if}

    <!-- Expiration Settings Card -->
    <div class="card">
      <h2>Expiration Settings</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Expiration Date</span>
          <span class="value">
            {data.user.expiration_date ? formatDate(data.user.expiration_date) : 'No expiration'}
          </span>
        </div>
        <div class="info-item">
          <span class="label">Grace Period</span>
          <span class="value">{data.user.grace_period_days} days</span>
        </div>
      </div>
    </div>

    <!-- Permissions Card -->
    <div class="card">
      <h2>Permissions</h2>
      {#if data.user.isSystemUser}
        <div class="system-user-notice">
          <strong>System User:</strong> This user has all permissions and they cannot be modified.
        </div>
        <div class="permissions-list" style="margin-top: 1rem;">
          {#each data.user.permissions as permission}
            <span class="permission-badge">{permission}</span>
          {/each}
        </div>
      {:else if data.user.permissions.length > 0}
        <div class="permissions-list">
          {#each data.user.permissions as permission}
            <span class="permission-badge">{permission}</span>
          {/each}
        </div>
      {:else}
        <p class="empty-message">No custom permissions assigned</p>
      {/if}
    </div>

    <!-- Activity Log Card -->
    <div class="card activity-log-card">
      <h2>Recent Activity</h2>
      {#if data.activityLogs.length > 0}
        <div class="activity-log">
          {#each data.activityLogs as log}
            <div class="activity-item">
              <div class="activity-header">
                <span class="activity-action">{log.action}</span>
                <span class="severity-badge {getSeverityBadgeClass(log.severity)}">
                  {log.severity}
                </span>
              </div>
              {#if log.description}
                <p class="activity-description">{log.description}</p>
              {/if}
              <div class="activity-meta">
                <span class="activity-entity">
                  {log.entity_type}
                  {#if log.entity_name}
                    - {log.entity_name}
                  {/if}
                </span>
                <span class="activity-time">{formatDateTime(log.created_at)}</span>
              </div>
              {#if log.ip_address}
                <div class="activity-ip mono">{log.ip_address}</div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-message">No activity recorded</p>
      {/if}
    </div>
  </div>

  <!-- Danger Zone -->
  {#if data.currentUser.canDelete && data.user.id !== data.currentUser.id && !data.user.isSystemUser}
    <div class="card danger-zone">
      <h2>Danger Zone</h2>
      <p>Permanently delete this user account. This action cannot be undone.</p>
      <button class="btn-danger" on:click={handleDelete}>Delete User</button>
    </div>
  {/if}
</div>

<style>
  .user-detail-page {
    width: 100%;
    padding: 2rem;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: transparent;
    border: 1px solid var(--color-border-primary);
    border-radius: 6px;
    color: var(--color-text-primary);
    cursor: pointer;
    margin-bottom: 1rem;
    transition: all var(--transition-fast);
  }

  .btn-back:hover {
    background: var(--color-bg-tertiary);
  }

  .header-title-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .header-content h1 {
    margin: 0;
    font-size: 2rem;
  }

  .btn-edit {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-primary, #0066cc);
    color: white;
    border-radius: 6px;
    text-decoration: none;
    font-size: 0.875rem;
    transition: all var(--transition-fast);
  }

  .btn-edit:hover {
    background: var(--color-primary-hover, #0052a3);
  }

  .btn-edit svg {
    width: 16px;
    height: 16px;
  }

  .header-badges {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .content-grid {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }

  .card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .card h2 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    color: var(--color-text-primary);
  }

  .info-grid {
    display: grid;
    gap: 1rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .value {
    font-size: 1rem;
    color: var(--color-text-primary);
  }

  .mono {
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
  }

  .role-badge,
  .status-badge,
  .expiration-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .role-badge-engineer {
    background: var(--color-warning);
    color: var(--color-text-inverse);
  }

  .role-badge-admin {
    background: var(--color-primary);
    color: var(--color-text-inverse);
  }

  .role-badge-user {
    background: var(--color-success);
    color: var(--color-text-inverse);
  }

  .role-badge-customer {
    background: var(--color-secondary);
    color: var(--color-text-inverse);
  }

  .status-badge-active {
    background: var(--color-success);
    color: var(--color-text-inverse);
    opacity: 0.9;
  }

  .status-badge-inactive {
    background: var(--color-secondary);
    color: var(--color-text-inverse);
    opacity: 0.8;
  }

  .status-badge-expired {
    background: var(--color-danger);
    color: var(--color-text-inverse);
  }

  .status-badge-suspended {
    background: var(--color-warning);
    color: var(--color-text-inverse);
  }

  .expiration-badge {
    font-size: 0.875rem;
  }

  .expiration-badge.expired {
    background: var(--color-danger);
    color: var(--color-text-inverse);
  }

  .expiration-badge.grace-period {
    background: var(--color-warning);
    color: var(--color-text-inverse);
  }

  .expiration-badge.expiring-soon {
    background: var(--color-warning);
    color: var(--color-text-inverse);
    opacity: 0.9;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border-primary);
    border-radius: 6px;
    font-size: 1rem;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
  }

  .button-group {
    display: flex;
    gap: 0.5rem;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-primary {
    background: var(--color-primary);
    color: var(--color-text-inverse);
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-secondary {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-primary);
  }

  .btn-secondary:hover {
    background: var(--color-bg-accent);
  }

  .btn-danger {
    background: var(--color-danger);
    color: var(--color-text-inverse);
  }

  .btn-danger:hover {
    background: var(--color-danger-hover);
  }

  .system-user-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.75rem;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .current-user-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.75rem;
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    border: 1px solid var(--color-primary);
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-primary);
  }

  .system-user-notice {
    padding: 1rem;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 6px;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    margin-top: 1rem;
  }

  .system-user-notice strong {
    color: var(--color-text-primary);
  }

  .permissions-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .permission-badge {
    padding: 0.25rem 0.75rem;
    background: var(--color-bg-tertiary);
    border-radius: 12px;
    font-size: 0.875rem;
    color: var(--color-text-primary);
    border: 1px solid var(--color-border-secondary);
  }

  .activity-log-card {
    grid-column: 1 / -1;
  }

  .activity-log {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .activity-item {
    padding: 1rem;
    background: var(--color-bg-tertiary);
    border-radius: 6px;
    border-left: 3px solid var(--color-primary);
  }

  .activity-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .activity-action {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .severity-badge {
    padding: 0.125rem 0.5rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }

  .severity-info {
    background: var(--color-primary);
    color: var(--color-text-inverse);
    opacity: 0.9;
  }

  .severity-warning {
    background: var(--color-warning);
    color: var(--color-text-inverse);
  }

  .severity-error {
    background: var(--color-danger);
    color: var(--color-text-inverse);
    opacity: 0.9;
  }

  .severity-critical {
    background: var(--color-danger);
    color: var(--color-text-inverse);
  }

  .activity-description {
    margin: 0 0 0.5rem 0;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .activity-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .activity-entity {
    text-transform: capitalize;
  }

  .activity-ip {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .empty-message {
    color: var(--color-text-tertiary);
    font-style: italic;
  }

  .danger-zone {
    margin-top: 2rem;
    border-color: var(--color-danger);
  }

  .danger-zone h2 {
    color: var(--color-danger);
  }

  .danger-zone p {
    margin: 0 0 1rem 0;
    color: var(--color-text-secondary);
  }

  @media (max-width: 768px) {
    .user-detail-page {
      padding: 1rem;
    }

    .content-grid {
      grid-template-columns: 1fr;
    }

    .header-content h1 {
      font-size: 1.5rem;
    }
  }
</style>
