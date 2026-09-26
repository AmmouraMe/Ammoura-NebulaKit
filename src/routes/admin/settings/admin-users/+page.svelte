<script lang="ts">
  import { goto } from '$app/navigation';
  import { invalidateAll } from '$app/navigation';
  import { confirmStore } from '$lib/stores/confirm';
  import { toastStore } from '$lib/stores/toast';
  import type { PageData } from './$types';

  export let data: PageData;

  // Configuration
  const EXPIRATION_WARNING_DAYS = 7;
  const EXPIRATION_WARNING_THRESHOLD = EXPIRATION_WARNING_DAYS * 86400; // 7 days in seconds

  let filterRole = 'all';
  let filterStatus = 'all';
  let searchTerm = '';

  $: filteredUsers = data.users.filter((user) => {
    const matchesSearch =
      searchTerm === '' ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

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

  function formatDate(timestamp: number | null): string {
    if (!timestamp) return 'Never';
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  function formatDateTime(timestamp: number | null): string {
    if (!timestamp) return 'Never';
    return new Date(timestamp * 1000).toLocaleString();
  }

  async function deleteUser(userId: string, userName: string) {
    const confirmed = await confirmStore.show(
      `Are you sure you want to delete user "${userName}"? This action cannot be undone.`,
      {
        title: 'Delete User',
        confirmText: 'Delete',
        variant: 'danger'
      }
    );
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Invalidate and reload data without full page refresh
        await invalidateAll();
      } else {
        const result = (await response.json()) as { error?: string };
        toastStore.error(`Failed to delete user: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      toastStore.error(`Error deleting user: ${error}`);
    }
  }
</script>

<svelte:head>
  <title>Admin Users - Ammoura Admin</title>
</svelte:head>

<div class="users-page">
  <div class="page-header">
    <div class="header-content">
      <h1>Admin Users</h1>
      <p class="subtitle">Manage admin accounts, roles, and permissions</p>
    </div>
    {#if data.currentUser.canWrite}
      <button class="btn-primary" on:click={() => goto('/admin/settings/admin-users/create')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"></path>
        </svg>
        Add Admin User
      </button>
    {/if}
  </div>

  <div class="filters-section">
    <div class="search-box">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="11" cy="11" r="8" stroke-width="2"></circle>
        <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"></path>
      </svg>
      <input type="text" bind:value={searchTerm} placeholder="Search by name or email..." />
    </div>

    <div class="filter-group">
      <label for="filter-role">Role:</label>
      <select id="filter-role" bind:value={filterRole}>
        <option value="all">All Roles</option>
        <option value="platform_engineer">Platform Engineer</option>
        <option value="admin">Admin</option>
        <option value="user">User</option>
        <option value="customer">Customer</option>
      </select>
    </div>

    <div class="filter-group">
      <label for="filter-status">Status:</label>
      <select id="filter-status" bind:value={filterStatus}>
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="expired">Expired</option>
        <option value="suspended">Suspended</option>
      </select>
    </div>

    <div class="results-count">
      {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
    </div>
  </div>

  <div class="users-table-container">
    <table class="users-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Expiration</th>
          <th>Last Login</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredUsers as user (user.id)}
          <tr class:inactive-row={!user.isActive}>
            <td>
              <div class="user-name-cell">
                <div class="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
                <span class="user-name">{user.name}</span>
              </div>
            </td>
            <td>{user.email}</td>
            <td>
              <span class="role-badge {getRoleBadgeClass(user.role)}">
                {user.role.replace('_', ' ')}
              </span>
            </td>
            <td>
              <span class="status-badge {getStatusBadgeClass(user.status)}">
                {user.status}
                {#if !user.isActive}
                  <span class="warning-icon" title="Account is not active">⚠️</span>
                {/if}
              </span>
            </td>
            <td>
              {#if user.expiration_date}
                <span
                  class:expiring-soon={user.expiration_date <
                    Date.now() / 1000 + EXPIRATION_WARNING_THRESHOLD}
                >
                  {formatDate(user.expiration_date)}
                </span>
              {:else}
                <span class="no-expiration">No expiration</span>
              {/if}
            </td>
            <td>
              <span title={formatDateTime(user.last_login_at)}>
                {formatDate(user.last_login_at)}
              </span>
            </td>
            <td>
              <div class="action-buttons">
                <button
                  class="btn-icon"
                  on:click={() => goto(`/admin/settings/admin-users/${user.id}`)}
                  title="View details"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="2"></path>
                    <circle cx="12" cy="12" r="3" stroke-width="2"></circle>
                  </svg>
                </button>
                {#if user.id === data.currentUser.id}
                  <span class="current-user-badge" title="This is your account">
                    ✨ Hey it's me!
                  </span>
                {:else if user.isSystemUser}
                  <span class="system-user-badge" title="System user - Cannot be edited">
                    🔒 System User
                  </span>
                {:else}
                  {#if data.currentUser.canWrite}
                    <button
                      class="btn-icon"
                      on:click={() => goto(`/admin/settings/admin-users/${user.id}/edit`)}
                      title="Edit user"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"
                          stroke-width="2"
                          stroke-linecap="round"
                        ></path>
                        <path
                          d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        ></path>
                      </svg>
                    </button>
                  {/if}
                  {#if data.currentUser.canDelete}
                    <button
                      class="btn-icon btn-danger"
                      on:click={() => deleteUser(user.id, user.name)}
                      title="Delete user"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        ></path>
                      </svg>
                    </button>
                  {/if}
                {/if}
              </div>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="7" class="no-results">
              <p>No users found matching your filters.</p>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .users-page {
    padding: 2rem;
    width: 100%;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 2rem;
  }

  .header-content h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    color: var(--color-text);
  }

  .subtitle {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn-primary:hover {
    background: var(--color-primary-dark);
  }

  .filters-section {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .search-box {
    flex: 1;
    min-width: 250px;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-box svg {
    position: absolute;
    left: 1rem;
    color: var(--color-text-secondary);
  }

  .search-box input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 3rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    font-size: 1rem;
    background: var(--color-background);
    color: var(--color-text);
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-group label {
    font-weight: 500;
    color: var(--color-text);
  }

  .filter-group select {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    background: var(--color-background);
    color: var(--color-text);
    cursor: pointer;
  }

  .results-count {
    margin-left: auto;
    padding: 0.5rem 1rem;
    background: var(--color-background-secondary);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .users-table-container {
    background: var(--color-background);
    border-radius: 0.5rem;
    border: 1px solid var(--color-border);
    overflow: hidden;
  }

  .users-table {
    width: 100%;
    border-collapse: collapse;
  }

  .users-table th {
    text-align: left;
    padding: 1rem;
    background: var(--color-background-secondary);
    font-weight: 600;
    color: var(--color-text);
    border-bottom: 2px solid var(--color-border);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .users-table td {
    padding: 1rem;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text);
  }

  .users-table tbody tr:hover {
    background: var(--color-background-hover);
  }

  .users-table tbody tr.inactive-row {
    opacity: 0.6;
  }

  .user-name-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1rem;
  }

  .user-name {
    font-weight: 500;
  }

  .role-badge,
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .role-badge-engineer {
    background: var(--color-engineer-gradient-end);
    color: white;
  }

  .role-badge-admin {
    background: var(--color-primary);
    color: white;
  }

  .role-badge-user {
    background: var(--color-success);
    color: white;
  }

  .role-badge-customer {
    background: var(--color-secondary);
    color: white;
  }

  .status-badge-active {
    background: color-mix(in srgb, var(--color-success) 15%, transparent);
    color: var(--color-success-hover);
  }

  .status-badge-inactive {
    background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
    color: var(--color-secondary-hover);
  }

  .status-badge-expired {
    background: color-mix(in srgb, var(--color-danger) 15%, transparent);
    color: var(--color-danger-hover);
  }

  .status-badge-suspended {
    background: color-mix(in srgb, var(--color-warning) 15%, transparent);
    color: var(--color-warning-hover);
  }

  .warning-icon {
    font-size: 0.875rem;
  }

  .expiring-soon {
    color: var(--color-danger-hover);
    font-weight: 600;
  }

  .no-expiration {
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .btn-icon {
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    background: var(--color-background);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text);
  }

  .btn-icon:hover {
    background: var(--color-background-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .btn-icon.btn-danger:hover {
    background: color-mix(in srgb, var(--color-danger) 15%, transparent);
    border-color: var(--color-danger-hover);
    color: var(--color-danger-hover);
  }

  .system-user-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .current-user-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    border: 1px solid var(--color-primary);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-primary);
    white-space: nowrap;
  }

  .no-results {
    text-align: center;
    padding: 3rem 1rem !important;
    color: var(--color-text-secondary);
  }

  @media (max-width: 768px) {
    .users-page {
      padding: 1rem;
    }

    .page-header {
      flex-direction: column;
    }

    .filters-section {
      flex-direction: column;
      align-items: stretch;
    }

    .search-box {
      min-width: 100%;
    }

    .results-count {
      margin-left: 0;
    }

    .users-table-container {
      overflow-x: auto;
    }

    .users-table {
      min-width: 900px;
    }
  }
</style>
