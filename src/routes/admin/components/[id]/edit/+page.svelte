<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';

  export let data: PageData;
  export let form: ActionData;

  // Type assertion for form data (this route is deprecated, use /admin/builder/component instead)
  const formData = form as
    { error?: string; name?: string; description?: string; success?: boolean } | null | undefined;

  const widgetTypeLabels: Record<string, string> = {
    hero: 'Hero',
    text: 'Text',
    image: 'Image',
    video: 'Video',
    products: 'Products',
    html: 'HTML',
    navbar: 'Navigation Bar',
    footer: 'Footer',
    yield: 'Yield'
  };

  let configText = JSON.stringify(data.component.config, null, 2);

  function formatConfig(): void {
    try {
      const parsed = JSON.parse(configText);
      configText = JSON.stringify(parsed, null, 2);
    } catch (_err) {
      // Invalid JSON, keep as is
    }
  }
</script>

<div class="edit-component-page">
  <div class="header">
    <a href="/admin/components" class="back-link">← Back to Components</a>
    <h1>Edit Component</h1>
  </div>

  <form method="POST" use:enhance>
    <div class="form-group">
      <label for="name">Component Name *</label>
      <input
        type="text"
        id="name"
        name="name"
        required
        value={formData?.name || data.component.name}
        placeholder="My Custom Component"
      />
    </div>

    <div class="form-group">
      <label for="description">Description</label>
      <textarea
        id="description"
        name="description"
        rows="3"
        value={formData?.description || data.component.description || ''}
        placeholder="Optional description of this component"
      />
    </div>

    <div class="form-group">
      <div class="widget-type-label">Widget Type</div>
      <div class="widget-type-display">
        {widgetTypeLabels[data.component.type] || data.component.type}
      </div>
      <p class="help-text">Widget type cannot be changed after creation</p>
    </div>

    <div class="form-group">
      <label for="config">Configuration (JSON) *</label>
      <textarea
        id="config"
        name="config"
        rows="15"
        required
        bind:value={configText}
        on:blur={formatConfig}
        class="code-editor"
      />
      <p class="help-text">
        Enter the widget configuration as JSON. It will be auto-formatted on blur.
      </p>
    </div>

    {#if form?.error}
      <div class="error-message">{form.error}</div>
    {/if}

    {#if form?.success}
      <div class="success-message">Component updated successfully!</div>
    {/if}

    <div class="form-actions">
      <a href="/admin/components" class="btn btn-secondary">Cancel</a>
      <button type="submit" class="btn btn-primary">Save Changes</button>
    </div>
  </form>
</div>

<style>
  .edit-component-page {
    padding: 2rem;
    width: 100%;
  }

  .header {
    margin-bottom: 2rem;
  }

  .back-link {
    color: var(--primary-color);
    text-decoration: none;
    display: inline-block;
    margin-bottom: 1rem;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .header h1 {
    margin: 0;
    font-size: 2rem;
  }

  form {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 2rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label,
  .widget-type-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group input[type='text'],
  .form-group textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 1rem;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .widget-type-display {
    padding: 0.5rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    color: var(--text-secondary);
  }

  .code-editor {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 0.875rem;
  }

  .help-text {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .error-message {
    background: #fee;
    color: #c00;
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .success-message {
    background: #efe;
    color: #060;
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    text-decoration: none;
    display: inline-block;
    text-align: center;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--primary-color);
    color: white;
  }

  .btn-primary:hover {
    background: var(--primary-hover);
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover {
    background: var(--bg-secondary);
  }
</style>
