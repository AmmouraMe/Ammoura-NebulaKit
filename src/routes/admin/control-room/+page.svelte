<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { SubmitFunction } from '@sveltejs/kit';
  import type { PageData } from './$types';
  import { toastStore } from '$lib/stores/toast';
  import { confirmStore } from '$lib/stores/confirm';

  export let data: PageData;

  let busy = '';
  let showForm = false;

  /** Show the action's answer as a toast and refresh the list. */
  const answer =
    (label: string): SubmitFunction =>
    () => {
      busy = label;
      return async ({ result, update }) => {
        busy = '';
        if (result.type === 'success' && result.data?.success)
          toastStore.success(String(result.data.success));
        else if (result.type === 'failure' && result.data?.error)
          toastStore.error(String(result.data.error));
        if (result.type === 'success' && label === 'register') showForm = false;
        await update({ reset: result.type === 'success' });
        await invalidateAll();
      };
    };

  const confirmRemove =
    (name: string): SubmitFunction =>
    async (input) => {
      const ok = await confirmStore.show(
        `Stop listing ${name}? The site keeps running; only this list forgets it.`
      );
      if (!ok) return input.cancel();
      return answer('remove')(input);
    };

  function when(iso: string | null): string {
    if (!iso) return 'never';
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  const versions = (packages: Record<string, string>) =>
    Object.entries(packages).map(
      ([name, version]) => `${name.replace('@nebulakit/', '')} ${version}`
    );
</script>

<svelte:head>
  <title>Control Room - Admin</title>
</svelte:head>

<div class="room">
  <header class="head">
    <div>
      <h1>Control Room</h1>
      <p class="sub">
        The client sites Ammoura runs. Each one is its own NebulaKit site. This page reaches it only
        through its API.
      </p>
    </div>
    <div class="head-actions">
      <form method="POST" action="?/syncAll" use:enhance={answer('syncAll')}>
        <button class="btn" disabled={busy !== '' || data.sites.length === 0}>
          {busy === 'syncAll' ? 'Checking…' : 'Check all sites'}
        </button>
      </form>
      <button class="btn primary" on:click={() => (showForm = !showForm)}>
        {showForm ? 'Cancel' : 'Add a site'}
      </button>
    </div>
  </header>

  {#if !data.configured}
    <p class="notice">
      <code>ENCRYPTION_KEY</code> is not set, so this page cannot store site keys. Set it first.
    </p>
  {/if}

  {#if showForm}
    <form class="card form" method="POST" action="?/register" use:enhance={answer('register')}>
      <p class="hint">
        Create the site with <code>bun scripts/orchestrator.ts create</code>, or have its owner make
        an orchestrator key. Ammoura calls the site once before it saves anything.
      </p>
      <label>Name <input name="name" placeholder="Acme Prints" required /></label>
      <label>Short name <input name="slug" placeholder="acme" required /></label>
      <label
        >Site address <input name="baseUrl" placeholder="https://acme.example" required /></label
      >
      <label>Repository <input name="repo" placeholder="Path or URL of the site’s repo" /></label>
      <label
        >Orchestrator key <input name="apiKey" type="password" autocomplete="off" required /></label
      >
      <button class="btn primary" disabled={busy !== ''}>
        {busy === 'register' ? 'Checking the site…' : 'Add site'}
      </button>
    </form>
  {/if}

  {#if data.sites.length === 0}
    <p class="empty">No client sites yet.</p>
  {:else}
    <ul class="list">
      {#each data.sites as site (site.id)}
        <li class="card site">
          <div class="top">
            <div class="who">
              <h2>{site.name}</h2>
              <a href={site.baseUrl} target="_blank" rel="noopener">{site.baseUrl}</a>
            </div>
            <span class="status status-{site.status}">{site.status}</span>
          </div>

          <dl>
            <div>
              <dt>Template</dt>
              <dd>{site.templateVersion ?? '—'}</dd>
            </div>
            <div>
              <dt>Packages</dt>
              <dd>{versions(site.packages).join(' · ') || '—'}</dd>
            </div>
            <div>
              <dt>Feature updates</dt>
              <dd>
                {site.updates.autoApplyFeatures
                  ? 'Takes every one'
                  : site.updates.optedIn.length
                    ? `Opted in: ${site.updates.optedIn.length}`
                    : 'Offered, not taken'}
              </dd>
            </div>
            <div>
              <dt>Last answered</dt>
              <dd>{when(site.lastSeenAt)}</dd>
            </div>
          </dl>

          {#if data.pending[site.id]?.length}
            <ul class="pending">
              {#each data.pending[site.id] as item (item.releaseId)}
                <li class:forced={item.decision === 'apply'}>
                  <strong>{item.releaseId}</strong>
                  <span>{item.decision === 'apply' ? 'to roll out' : 'offered to the owner'}</span>
                </li>
              {/each}
            </ul>
          {/if}

          {#if site.lastError}
            <p class="error">{site.lastError}</p>
          {/if}

          <div class="row">
            <form method="POST" action="?/sync" use:enhance={answer('sync')}>
              <input type="hidden" name="id" value={site.id} />
              <button class="btn" disabled={busy !== ''}>Check now</button>
            </form>
            <form method="POST" action="?/remove" use:enhance={confirmRemove(site.name)}>
              <input type="hidden" name="id" value={site.id} />
              <button class="btn danger" disabled={busy !== ''}>Stop listing</button>
            </form>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <section class="releases">
    <h2>Releases</h2>
    <p class="sub">
      A security release goes to every site, whatever its owner chose. A feature release is only
      offered, and each owner opts in. Rolling one out merges it into the site's repo and runs the
      site's tests: <code>bun scripts/orchestrator.ts rollout</code>.
    </p>
    <form class="card form" method="POST" action="?/recordRelease" use:enhance={answer('release')}>
      <label>Package <input name="package" placeholder="@nebulakit/security" required /></label>
      <label>Version <input name="version" placeholder="0.1.1" required /></label>
      <label>
        Channel
        <select name="channel">
          <option value="security">Security (forced)</option>
          <option value="feature">Feature (offered)</option>
        </select>
      </label>
      <label>Git ref <input name="ref" placeholder="release/security-0.1.1" required /></label>
      <label>Notes <input name="notes" placeholder="What changed" /></label>
      <button class="btn primary" disabled={busy !== ''}>Record release</button>
    </form>
    {#if data.releases.length}
      <ul class="list releases-list">
        {#each data.releases as release (release.id)}
          <li class="card site">
            <div class="top">
              <div class="who">
                <h2>{release.id}</h2>
                <span class="sub">{release.notes ?? release.ref}</span>
              </div>
              <span class="status" class:status-unreachable={release.channel === 'security'}
                >{release.channel}</span
              >
            </div>
            <form method="POST" action="?/removeRelease" use:enhance={answer('removeRelease')}>
              <input type="hidden" name="id" value={release.id} />
              <button class="btn" disabled={busy !== ''}>Remove from list</button>
            </form>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .room {
    padding: 1.5rem;
    max-width: 72rem;
    margin: 0 auto;
    min-width: 0;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }
  h1 {
    margin: 0 0 0.25rem;
    font-size: 1.75rem;
    color: var(--color-text-primary);
  }
  .sub,
  .hint {
    margin: 0;
    color: var(--color-text-secondary);
    line-height: 1.5;
    max-width: 40rem;
  }
  .head-actions,
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 0.5rem;
    padding: 1rem;
  }
  .form {
    display: grid;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }
  input {
    min-width: 0;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 0.375rem;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font: inherit;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  }
  .site {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
  }
  .top {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .who {
    min-width: 0;
  }
  h2 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--color-text-primary);
  }
  .who a {
    font-size: 0.85rem;
    color: var(--color-primary);
    overflow-wrap: anywhere;
  }
  dl {
    display: grid;
    gap: 0.5rem;
    margin: 0;
  }
  dt {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
  }
  dd {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
  }
  .status {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
  .status-healthy {
    color: var(--color-success, #15803d);
  }
  .status-unreachable {
    color: var(--color-error, #b91c1c);
  }
  .error,
  .notice {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-error, #b91c1c);
    overflow-wrap: anywhere;
  }
  .empty {
    color: var(--color-text-secondary);
  }
  .pending {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
    font-size: 0.85rem;
  }
  .pending li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: space-between;
    color: var(--color-text-secondary);
  }
  .pending li.forced strong {
    color: var(--color-error, #b91c1c);
  }
  .releases {
    margin-top: 2rem;
    display: grid;
    gap: 1rem;
  }
  select {
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 0.375rem;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font: inherit;
  }
  .btn {
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--color-border-secondary);
    border-radius: 0.375rem;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    font: inherit;
    cursor: pointer;
  }
  .btn.primary {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }
  .btn.danger {
    color: var(--color-error, #b91c1c);
  }
  .btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
