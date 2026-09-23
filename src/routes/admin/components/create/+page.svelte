<script lang="ts">
  import type { ActionData } from './$types';
  import { enhance } from '$app/forms';

  export let form: ActionData;

  // Type assertion for form data (this route is deprecated, use /admin/builder/component instead)
  const formData = form as
    { error?: string; name?: string; description?: string; widgetType?: string } | null | undefined;

  const widgetTypes = [
    { value: 'hero', label: 'Hero' },
    { value: 'text', label: 'Text' },
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' },
    { value: 'products', label: 'Products' },
    { value: 'html', label: 'HTML' },
    { value: 'navbar', label: 'Navigation Bar' },
    { value: 'footer', label: 'Footer' }
  ];

  const defaultConfigs: Record<string, string> = {
    hero: JSON.stringify(
      {
        title: 'Welcome',
        subtitle: 'Your subtitle here',
        backgroundImage: '',
        ctaText: 'Learn More',
        ctaLink: '#'
      },
      null,
      2
    ),
    text: JSON.stringify(
      {
        content: '<p>Your text content here</p>'
      },
      null,
      2
    ),
    image: JSON.stringify(
      {
        src: '',
        alt: 'Image description',
        caption: ''
      },
      null,
      2
    ),
    video: JSON.stringify(
      {
        src: '',
        poster: '',
        caption: ''
      },
      null,
      2
    ),
    products: JSON.stringify(
      {
        limit: 8,
        category: ''
      },
      null,
      2
    ),
    html: JSON.stringify(
      {
        content: '<div></div>'
      },
      null,
      2
    ),
    navbar: JSON.stringify(
      {
        logo: { type: 'text', text: 'Brand', image: '' },
        links: [
          { text: 'Home', url: '/' },
          { text: 'Shop', url: '/shop' },
          { text: 'About', url: '/about' }
        ],
        showSearch: true,
        showCart: true,
        showAuth: true,
        sticky: true,
        backgroundColor: '#ffffff',
        textColor: '#000000'
      },
      null,
      2
    ),
    footer: JSON.stringify(
      {
        links: [
          { text: 'About', url: '/about' },
          { text: 'Contact', url: '/contact' },
          { text: 'Privacy', url: '/privacy' }
        ],
        socialLinks: {
          facebook: '',
          twitter: '',
          instagram: '',
          linkedin: ''
        },
        copyright: '© 2024 Your Company',
        backgroundColor: '#1a1a1a',
        textColor: '#ffffff'
      },
      null,
      2
    )
  };

  let selectedType = 'hero';
  let configText = defaultConfigs[selectedType];

  function handleTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    selectedType = target.value;
    configText = defaultConfigs[selectedType] || '{}';
  }

  function formatConfig(): void {
    try {
      const parsed = JSON.parse(configText);
      configText = JSON.stringify(parsed, null, 2);
    } catch (_err) {
      // Invalid JSON, keep as is
    }
  }
</script>

<div class="create-component-page">
  <div class="header">
    <a href="/admin/components" class="back-link">← Back to Components</a>
    <h1>Create Component</h1>
  </div>

  <form method="POST" use:enhance>
    <div class="form-group">
      <label for="name">Component Name *</label>
      <input
        type="text"
        id="name"
        name="name"
        required
        value={formData?.name || ''}
        placeholder="My Custom Component"
      />
    </div>

    <div class="form-group">
      <label for="description">Description</label>
      <textarea
        id="description"
        name="description"
        rows="3"
        value={formData?.description || ''}
        placeholder="Optional description of this component"
      />
    </div>

    <div class="form-group">
      <label for="widget_type">Widget Type *</label>
      <select
        id="widget_type"
        name="widget_type"
        required
        value={formData?.widgetType || selectedType}
        on:change={handleTypeChange}
      >
        {#each widgetTypes as type}
          <option value={type.value}>{type.label}</option>
        {/each}
      </select>
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

    <div class="form-actions">
      <a href="/admin/components" class="btn btn-secondary">Cancel</a>
      <button type="submit" class="btn btn-primary">Create Component</button>
    </div>
  </form>
</div>

<style>
  .create-component-page {
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

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group input[type='text'],
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 1rem;
    background: var(--bg-primary);
    color: var(--text-primary);
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
