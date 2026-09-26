<script lang="ts">
  import { enhance } from '$app/forms';
  import { toastStore } from '$lib/stores/toast';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  let enabled = data.settings.enabled;
  let isSubmitting = false;

  $: if (form?.success) {
    toastStore.success(form.enabled ? 'Your site is now hidden' : 'Your site is live');
  }
  $: if (form?.error) {
    toastStore.error(form.error);
  }
</script>

<svelte:head>
  <title>Visibility - Admin</title>
</svelte:head>

<div class="settings-page">
  <div class="page-header">
    <h1>Visibility</h1>
    <p>
      Whether the public sees your site or a holding page. Point your domain here whenever you like
      — visitors get something finished-looking while you build behind it.
    </p>
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
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="comingSoonEnabled" bind:checked={enabled} />
          <span>Show a coming-soon page instead of my site</span>
        </label>
        <p class="help-text">
          Visitors see your holding page at every address on the site. You will not — signed in as
          an admin you always see the real thing, so you can keep working.
        </p>
      </div>

      <div class="notes">
        <h2>What stays reachable</h2>
        <ul>
          <li>Your admin, your sign-in pages and the API. You are never locked out.</li>
          <li>
            Your privacy policy and terms. Every OAuth provider, app store and payment processor
            fetches those as an anonymous visitor before approving you, and a policy nobody can read
            is not a policy.
          </li>
          <li>Images, fonts and stylesheets, so the holding page can be built from them.</li>
        </ul>
        <p class="help-text">
          Pages are served with a "not available yet" status, so search engines do not index the
          holding page as your storefront.
        </p>
      </div>

      <button type="submit" class="save-btn" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  </div>

  {#if data.holdingPage}
    <div class="settings-card">
      <h2>Your holding page</h2>
      <p class="help-text">
        It is an ordinary page — open it in the builder and write what you want on it. It starts
        with your site's name, one line, and a way to reach you.
      </p>
      <a class="edit-link" href="/admin/builder/{data.holdingPage.id}">Edit in the builder</a>
      <a class="preview-link" href={data.holdingPageSlug} target="_blank" rel="noopener">
        Preview it
      </a>
    </div>
  {:else}
    <div class="settings-card">
      <h2>Your holding page</h2>
      <p class="help-text">
        One will be created for you the first time you turn this on, and you can edit it like any
        other page afterwards.
      </p>
    </div>
  {/if}
</div>

<style>
  .settings-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .page-header {
    margin-bottom: 0.5rem;
  }

  h1 {
    color: var(--color-text-primary);
    font-size: 2rem;
    margin: 0 0 0.5rem 0;
  }

  h2 {
    color: var(--color-text-primary);
    font-size: 1.05rem;
    margin: 0 0 0.5rem 0;
  }

  .page-header p {
    color: var(--color-text-secondary);
    margin: 0;
    max-width: 640px;
  }

  .settings-card {
    background: var(--color-bg-primary);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px var(--color-shadow-light);
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--color-text-primary);
    font-weight: 500;
    cursor: pointer;
  }

  .checkbox-label input {
    width: auto;
  }

  .help-text {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    line-height: 1.6;
    margin: 0.5rem 0 0 0;
    max-width: 640px;
  }

  .notes {
    border-top: 1px solid var(--color-border);
    padding-top: 1.25rem;
    margin-bottom: 1.25rem;
  }

  .notes ul {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
    line-height: 1.6;
    margin: 0;
    padding-left: 1.1rem;
    max-width: 640px;
  }

  .notes li {
    margin-bottom: 0.4rem;
  }

  .save-btn {
    background: var(--color-primary);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0.7rem 1.4rem;
    font-size: 0.95rem;
    cursor: pointer;
  }

  .save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .edit-link,
  .preview-link {
    display: inline-block;
    margin-top: 0.75rem;
    margin-right: 1rem;
    color: var(--color-primary);
    font-size: 0.9rem;
  }
</style>
