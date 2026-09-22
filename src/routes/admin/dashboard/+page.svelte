<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import type { PageData } from './$types';
  import MediaPicker from '$lib/components/MediaPicker.svelte';

  export let data: PageData;

  // Get hasAIChat from parent layout data
  $: hasAIChat = $page.data?.hasAIChat || false;

  // Get all data from server (real data from database)
  $: metrics = data.metrics;
  $: recentOrders = data.recentOrders || [];
  $: topProducts = data.topProducts || [];
  $: lowStockProducts = data.lowStockProducts || [];

  let aiChatInput = '';
  let isMediaPickerOpen = false;
  let selectedMedia: Array<{
    id: string;
    url: string;
    filename: string;
    type: 'image' | 'video';
    mimeType: string;
    size: number;
  }> = [];

  const siteStatus = {
    server: 'operational',
    database: 'operational',
    payment: 'operational'
  };

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'operational':
      case 'completed':
      case 'delivered':
        return 'var(--color-success)';
      case 'processing':
      case 'shipped':
        return 'var(--color-warning)';
      case 'pending':
        return 'var(--color-secondary)';
      case 'cancelled':
        return 'var(--color-danger)';
      default:
        return 'var(--color-text-secondary)';
    }
  }

  function getStatusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function handleMediaSelect(
    event: CustomEvent<
      Array<{
        id: string;
        url: string;
        filename: string;
        type: 'image' | 'video';
        mimeType: string;
        size: number;
      }>
    >
  ) {
    selectedMedia = [...selectedMedia, ...event.detail];
  }

  function removeMedia(index: number) {
    selectedMedia = selectedMedia.filter((_, i) => i !== index);
  }

  function openMediaPicker() {
    isMediaPickerOpen = true;
  }

  function handleAIChatSubmit(event: Event): void {
    event.preventDefault();
    if (aiChatInput.trim() || selectedMedia.length > 0) {
      // Store the input and media in sessionStorage to pass to AI chat page
      sessionStorage.setItem('aiChatInitialMessage', aiChatInput.trim());
      if (selectedMedia.length > 0) {
        sessionStorage.setItem('aiChatInitialMedia', JSON.stringify(selectedMedia));
      }
      goto('/admin/ai-chat');
    } else {
      goto('/admin/ai-chat');
    }
  }
</script>

<svelte:head>
  <title>Dashboard - Ammoura Admin</title>
</svelte:head>

<div class="dashboard">
  <div class="dashboard-header">
    <h1>Dashboard</h1>
    <p>Welcome to your admin dashboard</p>
  </div>

  <!-- AI Chat Quick Access -->
  {#if hasAIChat}
    <div class="ai-chat-hero">
      <div class="ai-chat-container">
        <div class="ai-chat-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
        </div>
        <div class="ai-chat-content">
          <h2>AI Assistant</h2>
          <form on:submit={handleAIChatSubmit}>
            {#if selectedMedia.length > 0}
              <div class="selected-files-dashboard">
                {#each selectedMedia as media, i}
                  <div class="file-chip-dashboard">
                    {#if media.type === 'image'}
                      <img src={media.url} alt={media.filename} class="file-preview-dashboard" />
                    {:else}
                      <div class="file-icon-dashboard">🎥</div>
                    {/if}
                    <span class="file-name-dashboard">{media.filename}</span>
                    <button
                      type="button"
                      class="remove-file-dashboard"
                      on:click={() => removeMedia(i)}
                      aria-label="Remove media"
                    >
                      ✕
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
            <div class="ai-chat-input-wrapper" on:click|stopPropagation role="none">
              <button
                type="button"
                class="attach-btn-dashboard"
                on:click={openMediaPicker}
                aria-label="Select media"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    ry="2"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></rect>
                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="1.5"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></circle>
                  <path
                    d="M21 15l-5-5L5 21"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
              </button>
              <input
                type="text"
                bind:value={aiChatInput}
                placeholder="Describe a product to create, ask for help, or get insights..."
                class="ai-chat-input"
                on:click|stopPropagation
              />
              <button type="submit" class="ai-chat-submit" aria-label="Send message">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </svg>
              </button>
            </div>
          </form>
          <div class="ai-chat-suggestions">
            <span class="suggestion-label">Try:</span>
            <button
              type="button"
              class="suggestion-tag"
              on:click|stopPropagation={() => {
                aiChatInput = 'Create a wireless Bluetooth speaker';
                handleAIChatSubmit(new Event('submit'));
              }}
            >
              Create a product
            </button>
            <button
              type="button"
              class="suggestion-tag"
              on:click|stopPropagation={() => {
                aiChatInput = 'Show me sales insights';
                handleAIChatSubmit(new Event('submit'));
              }}
            >
              Get insights
            </button>
            <button
              type="button"
              class="suggestion-tag"
              on:click|stopPropagation={() => {
                aiChatInput = 'How do I add a new category?';
                handleAIChatSubmit(new Event('submit'));
              }}
            >
              Ask for help
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Metrics Grid -->
  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-icon" style="background: var(--color-bg-warning-light);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)">
          <path
            d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
            stroke-width="2"
            stroke-linecap="round"
          ></path>
        </svg>
      </div>
      <div class="metric-content">
        <div class="metric-value">{formatCurrency(metrics.totalRevenue)}</div>
        <div class="metric-label">Total Revenue</div>
        <div class="metric-subtext">
          Today: {formatCurrency(metrics.revenueToday)} · Month: {formatCurrency(
            metrics.revenueThisMonth
          )}
        </div>
      </div>
    </div>

    <div class="metric-card">
      <div class="metric-icon" style="background: var(--color-bg-success-light);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)">
          <path
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            stroke-width="2"
          ></path>
        </svg>
      </div>
      <div class="metric-content">
        <div class="metric-value">{metrics.totalOrders}</div>
        <div class="metric-label">Total Orders</div>
        <div class="metric-subtext">
          Pending: {metrics.pendingOrders} · Processing: {metrics.processingOrders}
        </div>
      </div>
    </div>

    <a href="/admin/products" class="metric-card metric-card-link">
      <div class="metric-icon" style="background: var(--color-bg-danger-light);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)">
          <path
            d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
            stroke-width="2"
          ></path>
        </svg>
      </div>
      <div class="metric-content">
        <div class="metric-value">{metrics.totalProducts}</div>
        <div class="metric-label">Total Products</div>
        <div class="metric-subtext">Out of stock: {metrics.outOfStockProducts}</div>
      </div>
    </a>

    <div class="metric-card">
      <div class="metric-icon" style="background: var(--color-bg-info-light);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)">
          <path
            d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            stroke-width="2"
            stroke-linecap="round"
          ></path>
        </svg>
      </div>
      <div class="metric-content">
        <div class="metric-value">{metrics.totalCustomers}</div>
        <div class="metric-label">Total Customers</div>
        <div class="metric-subtext">New this month: {metrics.newCustomersThisMonth}</div>
      </div>
    </div>
  </div>

  <!-- Recent Orders & Site Status -->
  <div class="dashboard-grid">
    <!-- Recent Orders -->
    <div class="dashboard-card">
      <h2>Recent Orders</h2>
      <div class="table-container">
        {#if recentOrders.length > 0}
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {#each recentOrders as order}
                <tr>
                  <td class="order-id">{order.id.substring(0, 8)}</td>
                  <td>
                    <div class="customer-cell">
                      <div class="customer-name">{order.customer_name}</div>
                      <div class="customer-email">{order.customer_email}</div>
                    </div>
                  </td>
                  <td class="amount">{formatCurrency(order.total)}</td>
                  <td>
                    <span class="status-badge" style="color: {getStatusColor(order.status)}">
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td class="date-cell">{formatDate(order.created_at)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="empty-state">
            <p>No orders yet</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Site Status -->
    <div class="dashboard-card">
      <h2>Site Status</h2>
      <div class="status-list">
        <div class="status-item">
          <div class="status-info">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" stroke-width="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" stroke-width="2"></rect>
              <path d="M6 6h.01M6 18h.01" stroke-width="2" stroke-linecap="round"></path>
            </svg>
            <span>Server Status</span>
          </div>
          <div class="status-indicator" style="background: {getStatusColor(siteStatus.server)}">
            {siteStatus.server}
          </div>
        </div>

        <div class="status-item">
          <div class="status-info">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M20 14.66V20a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h5.34M18 2h4v4M14 10l7.5-7.5"
                stroke-width="2"
                stroke-linecap="round"
              ></path>
            </svg>
            <span>Database Status</span>
          </div>
          <div class="status-indicator" style="background: {getStatusColor(siteStatus.database)}">
            {siteStatus.database}
          </div>
        </div>

        <div class="status-item">
          <div class="status-info">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke-width="2"></rect>
              <path d="M1 10h22" stroke-width="2"></path>
            </svg>
            <span>Payment Gateway</span>
          </div>
          <div class="status-indicator" style="background: {getStatusColor(siteStatus.payment)}">
            {siteStatus.payment}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Top Products and Low Stock -->
  <div class="dashboard-grid">
    <!-- Top Products -->
    <div class="dashboard-card">
      <h2>Top Selling Products</h2>
      {#if topProducts.length > 0}
        <div class="product-list">
          {#each topProducts as product}
            <div class="product-item">
              {#if product.image && product.image.trim() !== ''}
                <img src={product.image} alt={product.name} class="product-thumb" />
              {:else}
                <div class="product-thumb product-thumb-placeholder">
                  <span>📦</span>
                </div>
              {/if}
              <div class="product-info">
                <div class="product-name">{product.name}</div>
                <div class="product-stats">
                  {product.total_quantity} sold · {formatCurrency(product.total_revenue)}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <p>No sales data available</p>
        </div>
      {/if}
    </div>

    <!-- Low Stock Alerts -->
    <div class="dashboard-card">
      <h2>Low Stock Alerts</h2>
      {#if lowStockProducts.length > 0}
        <div class="product-list">
          {#each lowStockProducts as product}
            <div class="product-item">
              {#if product.image && product.image.trim() !== ''}
                <img src={product.image} alt={product.name} class="product-thumb" />
              {:else}
                <div class="product-thumb product-thumb-placeholder">
                  <span>📦</span>
                </div>
              {/if}
              <div class="product-info">
                <div class="product-name">{product.name}</div>
                <div class="product-stats">
                  <span class="stock-warning">{product.stock} remaining</span> · {product.category}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <p>All products are well stocked</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="dashboard-card">
    <h2>Quick Actions</h2>
    <div class="quick-actions">
      <a href="/admin/products" class="action-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"></path>
        </svg>
        Add Product
      </a>
      <a href="/admin/content" class="action-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
            stroke-width="2"
            stroke-linecap="round"
          ></path>
        </svg>
        Create Page
      </a>
      <a href="/admin/settings/theme" class="action-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0a4 4 0 004-4v-4a2 2 0 012-2h4a2 2 0 012 2v4a4 4 0 01-4 4"
            stroke-width="2"
            stroke-linecap="round"
          ></path>
        </svg>
        Theme Colors
      </a>
      <a href="/admin/settings" class="action-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="M12 15a3 3 0 100-6 3 3 0 000 6z"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></path>
          <path
            d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></path>
        </svg>
        Site Settings
      </a>
    </div>
  </div>
</div>

<MediaPicker bind:isOpen={isMediaPickerOpen} on:select={handleMediaSelect} />

<style>
  .dashboard {
    width: 100%;
  }

  .dashboard-header {
    margin-bottom: 2rem;
  }

  /* AI Chat Hero Section */
  .ai-chat-hero {
    margin-bottom: 2.5rem;
  }

  .ai-chat-container {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-primary) 15%, var(--color-bg-primary)),
      color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-primary))
    );
    border: 2px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 8px 24px var(--color-shadow-medium);
    display: flex;
    align-items: center;
    gap: 1.5rem;
    transition:
      background-color var(--transition-normal),
      border-color var(--transition-normal);
  }

  .ai-chat-icon {
    width: 64px;
    height: 64px;
    background: var(--color-primary);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 40%, transparent);
  }

  .ai-chat-icon svg {
    color: white;
  }

  .ai-chat-content {
    flex: 1;
    min-width: 0;
  }

  .ai-chat-content h2 {
    color: var(--color-text-primary);
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    transition: color var(--transition-normal);
  }

  .ai-chat-content form {
    margin-bottom: 0.75rem;
  }

  .selected-files-dashboard {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .file-chip-dashboard {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    font-size: 0.875rem;
    max-width: 250px;
  }

  .file-preview-dashboard {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .file-icon-dashboard {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .file-name-dashboard {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-primary);
  }

  .remove-file-dashboard {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--color-text-tertiary);
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all var(--transition-normal);
    font-size: 1.125rem;
  }

  .remove-file-dashboard:hover {
    color: var(--color-danger);
    background: var(--color-bg-danger-light);
  }

  .ai-chat-input-wrapper {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    background: var(--color-bg-primary);
    border: 2px solid var(--color-border-secondary);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    transition:
      background-color var(--transition-normal),
      border-color var(--transition-normal);
  }

  .ai-chat-input-wrapper:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
  }

  .attach-btn-dashboard {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-normal);
  }

  .attach-btn-dashboard svg {
    display: block;
    flex-shrink: 0;
  }

  .attach-btn-dashboard svg path,
  .attach-btn-dashboard svg rect,
  .attach-btn-dashboard svg circle {
    stroke: currentColor;
  }

  .attach-btn-dashboard:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .ai-chat-input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--color-text-primary);
    font-size: 1rem;
    outline: none;
    font-family: inherit;
    transition: color var(--transition-normal);
  }

  .ai-chat-input::placeholder {
    color: var(--color-text-tertiary);
    transition: color var(--transition-normal);
  }

  .ai-chat-submit {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: none;
    background: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background-color var(--transition-normal),
      transform var(--transition-normal);
  }

  .ai-chat-submit:hover {
    background: var(--color-primary-hover);
    transform: scale(1.05);
  }

  .ai-chat-submit svg {
    display: block;
    flex-shrink: 0;
  }

  .ai-chat-submit svg path {
    stroke: white;
  }

  .ai-chat-suggestions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .suggestion-label {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    font-weight: 500;
    transition: color var(--transition-normal);
  }

  .suggestion-tag {
    padding: 0.375rem 0.875rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 20px;
    font-size: 0.8125rem;
    color: var(--color-text-primary);
    cursor: pointer;
    transition:
      background-color var(--transition-normal),
      border-color var(--transition-normal),
      color var(--transition-normal),
      transform var(--transition-normal);
  }

  .suggestion-tag:hover {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
    transform: translateY(-1px);
  }

  .dashboard-header h1 {
    color: var(--color-text-primary);
    font-size: 2rem;
    margin: 0 0 0.5rem 0;
    transition: color var(--transition-normal);
  }

  .dashboard-header p {
    color: var(--color-text-secondary);
    margin: 0;
    transition: color var(--transition-normal);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .metric-card {
    background: var(--color-bg-primary);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 2px 8px var(--color-shadow-light);
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal),
      transform var(--transition-normal);
  }

  .metric-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--color-shadow-medium);
  }

  .metric-card-link {
    text-decoration: none;
    cursor: pointer;
  }

  .metric-card-link:hover {
    background: var(--color-bg-secondary);
  }

  .metric-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .metric-content {
    flex: 1;
  }

  .metric-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text-primary);
    transition: color var(--transition-normal);
  }

  .metric-label {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    margin-top: 0.25rem;
    transition: color var(--transition-normal);
  }

  .metric-subtext {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
    margin-top: 0.5rem;
    transition: color var(--transition-normal);
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .dashboard-card {
    background: var(--color-bg-primary);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 8px var(--color-shadow-light);
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .dashboard-card h2 {
    color: var(--color-text-primary);
    font-size: 1.25rem;
    margin: 0 0 1.5rem 0;
    transition: color var(--transition-normal);
  }

  .table-container {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    border-bottom: 2px solid var(--color-border-secondary);
    transition: border-color var(--transition-normal);
  }

  th {
    text-align: left;
    padding: 0.75rem 0.5rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    transition: color var(--transition-normal);
  }

  td {
    padding: 0.875rem 0.5rem;
    color: var(--color-text-primary);
    border-bottom: 1px solid var(--color-border-secondary);
    transition:
      color var(--transition-normal),
      border-color var(--transition-normal);
  }

  .order-id {
    font-weight: 600;
    color: var(--color-primary);
    transition: color var(--transition-normal);
  }

  .amount {
    font-weight: 600;
  }

  .status-badge {
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .customer-cell {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .customer-name {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .customer-email {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .date-cell {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--color-text-tertiary);
  }

  .empty-state p {
    margin: 0;
  }

  .product-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .product-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: var(--color-bg-tertiary);
    border-radius: 8px;
    transition: background-color var(--transition-normal);
  }

  .product-item:hover {
    background: var(--color-bg-secondary);
  }

  .product-thumb {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .product-thumb-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    color: var(--color-text-tertiary);
  }

  .product-thumb-placeholder span {
    font-size: 1.5rem;
  }

  .product-info {
    flex: 1;
    min-width: 0;
  }

  .product-name {
    font-weight: 500;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .product-stats {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    margin-top: 0.25rem;
  }

  .stock-warning {
    color: var(--color-danger);
    font-weight: 600;
  }

  .status-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--color-bg-tertiary);
    border-radius: 8px;
    transition: background-color var(--transition-normal);
  }

  .status-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--color-text-primary);
    transition: color var(--transition-normal);
  }

  .status-info span {
    font-weight: 500;
  }

  .status-indicator {
    padding: 0.375rem 0.875rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: white;
    text-transform: capitalize;
  }

  .quick-actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border-radius: 8px;
    text-decoration: none;
    font-weight: 500;
    transition:
      background-color var(--transition-normal),
      transform var(--transition-normal);
  }

  .action-btn:hover {
    background: var(--color-primary-hover);
    transform: translateY(-2px);
  }

  /* Mobile-first responsive design */
  @media (max-width: 768px) {
    .dashboard {
      max-width: 100%;
    }

    .dashboard-header {
      margin-bottom: 1.5rem;
    }

    .dashboard-header h1 {
      font-size: 1.5rem;
    }

    .dashboard-header p {
      font-size: 0.875rem;
    }

    .ai-chat-hero {
      margin-bottom: 1.5rem;
    }

    .ai-chat-container {
      flex-direction: column;
      padding: 1.25rem;
      text-align: center;
      gap: 1rem;
    }

    .ai-chat-icon {
      width: 52px;
      height: 52px;
    }

    .ai-chat-icon svg {
      width: 26px;
      height: 26px;
    }

    .ai-chat-content h2 {
      font-size: 1.125rem;
      margin-bottom: 0.75rem;
    }

    .ai-chat-input-wrapper {
      flex-direction: column;
      gap: 0.625rem;
      padding: 0.75rem;
    }

    .ai-chat-input {
      font-size: 0.9375rem;
      padding: 0.625rem;
    }

    .ai-chat-submit {
      width: 100%;
      height: 42px;
    }

    .ai-chat-suggestions {
      justify-content: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .suggestion-label {
      width: 100%;
      text-align: center;
      margin-bottom: 0.25rem;
      font-size: 0.75rem;
    }

    .suggestion-tag {
      font-size: 0.75rem;
      padding: 0.5rem 0.75rem;
    }

    .metrics-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .metric-card {
      padding: 1rem;
    }

    .metric-icon {
      width: 48px;
      height: 48px;
    }

    .metric-value {
      font-size: 1.5rem;
    }

    .metric-label {
      font-size: 0.8125rem;
    }

    .metric-subtext {
      font-size: 0.6875rem;
    }

    .dashboard-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .dashboard-card {
      padding: 1rem;
    }

    .dashboard-card h2 {
      font-size: 1rem;
    }

    .dashboard-card table {
      font-size: 0.875rem;
    }

    .dashboard-card th {
      font-size: 0.8125rem;
      padding: 0.625rem 0.5rem;
    }

    .dashboard-card td {
      font-size: 0.875rem;
      padding: 0.75rem 0.5rem;
    }

    .customer-name {
      font-size: 0.875rem;
    }

    .customer-email {
      font-size: 0.75rem;
    }

    .status-badge {
      font-size: 0.6875rem;
      padding: 0.25rem 0.5rem;
    }

    .status-item {
      padding: 0.75rem;
    }

    .status-info span {
      font-size: 0.875rem;
    }

    .status-indicator {
      font-size: 0.75rem;
      padding: 0.375rem 0.75rem;
    }

    .quick-actions {
      flex-direction: column;
      gap: 0.75rem;
    }

    .action-btn {
      width: 100%;
      justify-content: center;
      padding: 0.75rem 1.25rem;
      font-size: 0.9375rem;
    }
  }

  @media (max-width: 480px) {
    .dashboard-header h1 {
      font-size: 1.25rem;
    }

    .ai-chat-container {
      padding: 1rem;
    }

    .ai-chat-icon {
      width: 48px;
      height: 48px;
    }

    .ai-chat-content h2 {
      font-size: 1rem;
    }

    .metrics-grid {
      gap: 0.875rem;
    }

    .metric-card {
      padding: 0.875rem;
    }

    .metric-icon {
      width: 44px;
      height: 44px;
    }

    .metric-value {
      font-size: 1.375rem;
    }

    .dashboard-card {
      padding: 0.875rem;
    }

    .dashboard-card h2 {
      font-size: 0.9375rem;
    }

    .table-container {
      overflow-x: auto;
    }
  }

  @media (min-width: 769px) and (max-width: 1024px) {
    .ai-chat-input-wrapper {
      flex-wrap: wrap;
    }

    .ai-chat-input {
      min-width: 300px;
    }
  }
</style>
