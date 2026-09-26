<script lang="ts">
  import DatabaseNavigator from '$lib/components/admin/DatabaseNavigator.svelte';
</script>

<svelte:head>
  <title>Database Navigator - Ammoura Admin</title>
</svelte:head>

<div class="database-page">
  <div class="page-header">
    <div class="header-content">
      <h1>Database Navigator</h1>
      <p class="subtitle">
        Complete database schema explorer for platform engineers. View tables, columns, indexes, and
        foreign key relationships.
      </p>
    </div>
    <div class="user-badge">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>
      </svg>
      <span>Platform Engineer Access</span>
    </div>
  </div>

  <DatabaseNavigator />
</div>

<style>
  .database-page {
    min-height: 100vh;
    background: var(--color-bg-primary);
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 2rem 1.5rem 1rem;
    width: 100%;
    border-bottom: 1px solid var(--color-border-secondary);
    margin-bottom: 0;
  }

  .header-content h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 0.5rem 0;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--color-text-secondary);
    max-width: 600px;
    margin: 0;
    line-height: 1.5;
  }

  .user-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: linear-gradient(
      135deg,
      var(--color-engineer-gradient-start) 0%,
      var(--color-engineer-gradient-end) 100%
    );
    color: var(--color-engineer-text);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    box-shadow: 0 4px 6px var(--color-shadow-medium);
  }

  .user-badge svg {
    color: var(--color-engineer-text);
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 1rem;
    }

    .header-content h1 {
      font-size: 1.5rem;
    }

    .user-badge {
      align-self: flex-start;
    }
  }
</style>
