<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';

  export let data: PageData;

  let filterAction = '';
  let filterEntityType = '';
  let filterSeverity = '';
  let searchTerm = '';

  // Mobile-first: track if filters are visible
  let showFilters = false;

  $: filteredLogs = data.logs.filter((log) => {
    const matchesSearch =
      searchTerm === '' ||
      (log.description && log.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.entity_name && log.entity_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = filterAction === '' || log.action === filterAction;
    const matchesEntityType = filterEntityType === '' || log.entity_type === filterEntityType;
    const matchesSeverity = filterSeverity === '' || log.severity === filterSeverity;
    return matchesSearch && matchesAction && matchesEntityType && matchesSeverity;
  });

  // Get unique actions and entity types for filters
  $: uniqueActions = [...new Set(data.logs.map((log) => log.action))].sort();
  $: uniqueEntityTypes = [...new Set(data.logs.map((log) => log.entity_type))].sort();

  function getSeverityClass(severity: string): string {
    switch (severity) {
      case 'info':
        return 'severity-info';
      case 'warning':
        return 'severity-warning';
      case 'error':
        return 'severity-error';
      case 'critical':
        return 'severity-critical';
      default:
        return '';
    }
  }

  function getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'critical':
        return '🚨';
      default:
        return '📝';
    }
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString();
  }

  function formatDateShort(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  function viewUserDetails(userId: string | null) {
    if (userId) {
      goto(`/admin/users/${userId}`);
    }
  }

  function viewEntityDetails(entityType: string, entityId: string | null) {
    if (!entityId) return;

    switch (entityType) {
      case 'user':
        goto(`/admin/users/${entityId}`);
        break;
      case 'product':
        goto(`/admin/products/${entityId}/edit`);
        break;
      case 'order':
        // goto(`/admin/orders/${entityId}`);
        break;
      case 'page':
        goto(`/admin/pages/${entityId}/edit`);
        break;
      default:
        break;
    }
  }

  async function exportLogs() {
    if (!data.currentUser.canExport) {
      alert('You do not have permission to export logs');
      return;
    }

    // Create CSV from filtered logs
    const headers = [
      'Timestamp',
      'User ID',
      'Action',
      'Entity Type',
      'Entity ID',
      'Entity Name',
      'Description',
      'Severity',
      'IP Address'
    ];

    const rows = filteredLogs.map((log) => [
      formatDate(log.created_at),
      log.user_id || 'System',
      log.action,
      log.entity_type,
      log.entity_id || '',
      log.entity_name || '',
      log.description || '',
      log.severity,
      log.ip_address || ''
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>Activity Logs - Ammoura Admin</title>
</svelte:head>

<div class="activity-logs-page">
  <div class="page-header">
    <div class="header-content">
      <h1>Activity Logs</h1>
      <p class="subtitle">Monitor all system activities and user actions</p>
    </div>
    <div class="header-actions">
      {#if data.currentUser.canExport}
        <button class="btn-secondary" on:click={exportLogs}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
          Export CSV
        </button>
      {/if}
      <button class="btn-mobile-filter" on:click={() => (showFilters = !showFilters)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></path>
        </svg>
        Filters
      </button>
    </div>
  </div>

  <div class="filters-section" class:show-mobile={showFilters}>
    <div class="search-box">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="11" cy="11" r="8" stroke-width="2"></circle>
        <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"></path>
      </svg>
      <input type="text" bind:value={searchTerm} placeholder="Search by action, description..." />
    </div>

    <div class="filter-grid">
      <div class="filter-group">
        <label for="filter-action">Action:</label>
        <select id="filter-action" bind:value={filterAction}>
          <option value="">All Actions</option>
          {#each uniqueActions as action}
            <option value={action}>{action}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-entity">Entity:</label>
        <select id="filter-entity" bind:value={filterEntityType}>
          <option value="">All Entities</option>
          {#each uniqueEntityTypes as entityType}
            <option value={entityType}>{entityType}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="filter-severity">Severity:</label>
        <select id="filter-severity" bind:value={filterSeverity}>
          <option value="">All Severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
      </div>
    </div>

    <div class="results-count">
      {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''}
    </div>
  </div>

  <!-- Mobile-first: Card view for mobile, table for desktop -->
  <div class="logs-container">
    <!-- Mobile Card View -->
    <div class="logs-mobile">
      {#each filteredLogs as log (log.id)}
        <div class="log-card" class:clickable={log.user_id || log.entity_id}>
          <div class="log-card-header">
            <span class="severity-badge {getSeverityClass(log.severity)}">
              <span class="severity-icon">{getSeverityIcon(log.severity)}</span>
              {log.severity}
            </span>
            <span class="log-time">{formatDateShort(log.created_at)}</span>
          </div>

          <div class="log-card-body">
            <div class="log-action">{log.action}</div>
            {#if log.description}
              <div class="log-description">{log.description}</div>
            {/if}

            <div class="log-details">
              {#if log.user_id}
                <div class="log-detail">
                  <span class="label">User:</span>
                  <button class="link-button" on:click={() => viewUserDetails(log.user_id)}>
                    {log.user_id}
                  </button>
                </div>
              {:else}
                <div class="log-detail">
                  <span class="label">User:</span>
                  <span class="system-tag">System</span>
                </div>
              {/if}

              {#if log.entity_name || log.entity_id}
                <div class="log-detail">
                  <span class="label">Entity:</span>
                  <button
                    class="link-button"
                    on:click={() => viewEntityDetails(log.entity_type, log.entity_id)}
                  >
                    {log.entity_name || log.entity_id}
                  </button>
                  <span class="entity-type">({log.entity_type})</span>
                </div>
              {/if}

              {#if log.ip_address}
                <div class="log-detail">
                  <span class="label">IP:</span>
                  <span>{log.ip_address}</span>
                </div>
              {/if}
            </div>

            {#if log.metadata}
              <details class="log-metadata">
                <summary>View Metadata</summary>
                <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
              </details>
            {/if}
          </div>
        </div>
      {:else}
        <div class="no-results">
          <p>No activity logs found matching your filters.</p>
        </div>
      {/each}
    </div>

    <!-- Desktop Table View -->
    <div class="logs-desktop">
      <table class="logs-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Severity</th>
            <th>Action</th>
            <th>User</th>
            <th>Entity</th>
            <th>Description</th>
            <th>IP</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredLogs as log (log.id)}
            <tr>
              <td>
                <span title={formatDate(log.created_at)}>
                  {formatDateShort(log.created_at)}
                </span>
              </td>
              <td>
                <span class="severity-badge {getSeverityClass(log.severity)}">
                  <span class="severity-icon">{getSeverityIcon(log.severity)}</span>
                  {log.severity}
                </span>
              </td>
              <td><code>{log.action}</code></td>
              <td>
                {#if log.user_id}
                  <button class="link-button" on:click={() => viewUserDetails(log.user_id)}>
                    {log.user_id}
                  </button>
                {:else}
                  <span class="system-tag">System</span>
                {/if}
              </td>
              <td>
                {#if log.entity_name || log.entity_id}
                  <button
                    class="link-button"
                    on:click={() => viewEntityDetails(log.entity_type, log.entity_id)}
                  >
                    {log.entity_name || log.entity_id}
                  </button>
                  <br />
                  <span class="entity-type">({log.entity_type})</span>
                {/if}
              </td>
              <td>{log.description || '-'}</td>
              <td>{log.ip_address || '-'}</td>
            </tr>
          {:else}
            <tr>
              <td colspan="7" class="no-results">
                <p>No activity logs found matching your filters.</p>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<style>
  .activity-logs-page {
    padding: 1rem;
    width: 100%;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .header-content h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
    color: var(--color-text-primary);
  }

  .subtitle {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border: 2px solid var(--color-border-secondary);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-primary);
  }

  .btn-mobile-filter {
    display: none;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  .filters-section {
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border-secondary);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
  }

  .search-box svg {
    position: absolute;
    left: 1rem;
    color: var(--color-text-secondary);
  }

  .search-box input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 3rem;
    font-size: 1rem;
  }

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .filter-group label {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--color-text-primary);
  }

  .filter-group select {
    font-size: 0.875rem;
    /* Inherits all other styling from global app.css */
  }

  .results-count {
    padding: 0.5rem 1rem;
    background: var(--color-background-secondary);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    font-weight: 500;
    text-align: center;
  }

  /* Mobile Card View */
  .logs-mobile {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .log-card {
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border-secondary);
    border-radius: 0.5rem;
    padding: 1rem;
    transition: box-shadow 0.2s;
  }

  .log-card.clickable:hover {
    box-shadow: 0 2px 8px var(--color-shadow-medium);
  }

  .log-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .log-time {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .log-card-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .log-action {
    font-family: monospace;
    font-weight: 600;
    color: var(--color-text-primary);
    font-size: 0.9375rem;
  }

  .log-description {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }

  .log-details {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-border-secondary);
  }

  .log-detail {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    flex-wrap: wrap;
  }

  .log-detail .label {
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .entity-type {
    color: var(--color-text-secondary);
    font-size: 0.75rem;
  }

  .severity-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .severity-icon {
    font-size: 0.875rem;
  }

  .severity-info {
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    color: var(--color-primary);
  }

  .severity-warning {
    background: color-mix(in srgb, var(--color-warning) 15%, transparent);
    color: var(--color-warning-hover);
  }

  .severity-error {
    background: color-mix(in srgb, var(--color-danger) 15%, transparent);
    color: var(--color-danger-hover);
  }

  .severity-critical {
    background: color-mix(in srgb, var(--color-danger) 25%, transparent);
    color: var(--color-danger-hover);
    font-weight: 700;
  }

  .system-tag {
    padding: 0.125rem 0.5rem;
    background: var(--color-background-secondary);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .link-button {
    background: none;
    border: none;
    color: var(--color-primary);
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    font-size: inherit;
    font-family: inherit;
  }

  .link-button:hover {
    color: var(--color-primary-dark);
  }

  .log-metadata {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-border-secondary);
  }

  .log-metadata summary {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0.25rem 0;
  }

  .log-metadata summary:hover {
    color: var(--color-primary);
  }

  .log-metadata pre {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: var(--color-bg-tertiary);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    overflow-x: auto;
    color: var(--color-text-primary);
  }

  /* Desktop Table View */
  .logs-desktop {
    display: none;
    background: var(--color-bg-secondary);
    border-radius: 0.5rem;
    border: 2px solid var(--color-border-secondary);
    overflow: hidden;
  }

  .logs-table {
    width: 100%;
    border-collapse: collapse;
  }

  .logs-table th {
    text-align: left;
    padding: 1rem;
    background: var(--color-bg-tertiary);
    font-weight: 600;
    color: var(--color-text-primary);
    border-bottom: 2px solid var(--color-border-secondary);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .logs-table td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--color-border-secondary);
    color: var(--color-text-primary);
    font-size: 0.875rem;
  }

  .logs-table tbody tr:hover {
    background: var(--color-bg-tertiary);
  }

  .logs-table code {
    font-family: monospace;
    background: var(--color-background-secondary);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.8125rem;
  }

  .no-results {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--color-text-secondary);
  }

  /* Tablet and Desktop: Show table view */
  @media (min-width: 768px) {
    .activity-logs-page {
      padding: 2rem;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .header-content h1 {
      font-size: 2rem;
    }

    .logs-mobile {
      display: none;
    }

    .logs-desktop {
      display: block;
    }

    .filters-section {
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
  }

  /* Mobile: Show filter toggle button and hide filters by default */
  @media (max-width: 767px) {
    .btn-mobile-filter {
      display: inline-flex;
    }

    .filters-section {
      display: none;
    }

    .filters-section.show-mobile {
      display: block;
    }
  }
</style>
