<script lang="ts">
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  export let data: PageData;

  let filterStatus = 'all';
  let searchTerm = '';

  $: activeTab = data.activeTab;

  function switchTab(tab: string) {
    goto(`/admin/users?tab=${tab}`);
  }

  $: filteredUsers = data.users.filter((user) => {
    const matchesSearch =
      searchTerm === '' ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

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
</script>

<svelte:head>
  <title>Users - Ammoura Admin</title>
</svelte:head>

<div class="users-page">
  <div class="page-header">
    <div class="header-content">
      <h1>Users</h1>
      <p class="subtitle">View and manage customer accounts</p>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button
      class="tab"
      class:active={activeTab === 'customers'}
      on:click={() => switchTab('customers')}
    >
      Customers
      <span class="tab-count">{data.purchasingCustomersCount}</span>
    </button>
    <button class="tab" class:active={activeTab === 'all'} on:click={() => switchTab('all')}>
      All
      <span class="tab-count">{data.customersCount}</span>
    </button>
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
          <th>Status</th>
          <th>Last Login</th>
          {#if activeTab === 'customers'}
            <th>Orders</th>
          {/if}
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
              <span class="status-badge {getStatusBadgeClass(user.status)}">
                {user.status}
                {#if !user.isActive}
                  <span class="warning-icon" title="Account is not active">⚠️</span>
                {/if}
              </span>
            </td>
            <td>
              <span title={formatDateTime(user.last_login_at)}>
                {formatDate(user.last_login_at)}
              </span>
            </td>
            {#if activeTab === 'customers'}
              <td>
                {#if user.hasPurchased}
                  <span class="has-orders-badge">✓ Has Orders</span>
                {:else}
                  <span class="no-orders-text">No orders</span>
                {/if}
              </td>
            {/if}
            <td>
              <div class="action-buttons">
                <button
                  class="btn-icon"
                  on:click={() => goto(`/admin/users/${user.id}`)}
                  title="View details"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-width="2"></path>
                    <circle cx="12" cy="12" r="3" stroke-width="2"></circle>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan={activeTab === 'customers' ? 6 : 5} class="no-results">
              <p>
                {#if activeTab === 'customers'}
                  No customers with purchases found matching your filters.
                {:else}
                  No customers found matching your filters.
                {/if}
              </p>
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
    margin-bottom: 1.5rem;
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

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    border-bottom: 2px solid var(--color-border);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab:hover {
    color: var(--color-text);
    background: var(--color-background-hover);
  }

  .tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  .tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.5rem;
    background: var(--color-background-secondary);
    border-radius: 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .tab.active .tab-count {
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    color: var(--color-primary);
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

  .has-orders-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.75rem;
    background: color-mix(in srgb, var(--color-success) 15%, transparent);
    color: var(--color-success-hover);
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .no-orders-text {
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
