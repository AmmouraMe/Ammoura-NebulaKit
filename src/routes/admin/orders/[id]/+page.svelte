<script lang="ts">
  import { goto } from '$app/navigation';
  import type { DesignElement, Placement } from '$lib/utils/designElements';
  import { fontNameFor, inkNameFor } from '$lib/utils/designText';
  import { countryName } from '$lib/data/countries';

  interface OrderItemArtwork {
    zoneName: string;
    /** The design as placed, in inches on the product. */
    elements: DesignElement[];
    designId: string | null;
    designRevision: number;
    imageUrl: string;
    originalFilename: string | null;
    offsetXPercent: number;
    offsetYPercent: number;
    scale: number;
  }

  /**
   * Where a piece sits, in the words a printer works in.
   *
   * Orders taken before the studio measured things have no inches on them —
   * say so rather than printing a confident `0.00 × 0.00`.
   */
  function placementText(place: Placement): string {
    if (!(place.widthIn > 0)) return 'placed against the print area (pre-2026 order)';
    const at = `at ${place.xIn.toFixed(2)}, ${place.yIn.toFixed(2)}″`;
    const size = `${place.widthIn.toFixed(2)} × ${place.heightIn.toFixed(2)}″`;
    const spin = place.rotation ? `, rotated ${Math.round(place.rotation)}°` : '';
    return `${size} ${at}${spin}`;
  }

  interface OrderItemFieldValue {
    fieldName: string;
    fieldType: string;
    value: string;
    priceModifier: number;
  }

  interface OrderItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    customizations?: OrderItemArtwork[];
    fieldValues?: OrderItemFieldValue[];
  }

  interface ShippingGroup {
    id: string;
    shippingOptionId: string;
    shippingOptionName: string;
    shippingCost: number;
    products: Array<{
      id: string;
      name: string;
      quantity: number;
    }>;
  }

  interface Order {
    id: string;
    status: string;
    payment_status: string;
    subtotal: number;
    shipping_cost: number;
    tax: number;
    total: number;
    created_at: string;
    updated_at: string;
    shipping_address: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    billing_address: {
      firstName: string;
      lastName: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    payment_method: {
      type: string;
      cardNumber?: string;
      cardHolderName?: string;
      expiryMonth?: string;
      expiryYear?: string;
    };
    shipping_details: {
      groups: ShippingGroup[];
    } | null;
    items: OrderItem[];
  }

  export let data: { order: Order };

  $: order = data.order;

  let isUpdatingStatus = false;
  let statusMessage = '';

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return '#FFA500';
      case 'processing':
        return '#3B82F6';
      case 'shipped':
        return '#8B5CF6';
      case 'delivered':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  }

  async function handleStatusChange(newStatus: string): Promise<void> {
    isUpdatingStatus = true;
    statusMessage = '';

    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        statusMessage = 'Status updated successfully';
        // Reload page to get updated data
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        statusMessage = 'Failed to update status';
      }
    } catch (error) {
      console.error('Error updating status:', error);
      statusMessage = 'Error updating status';
    } finally {
      isUpdatingStatus = false;
      setTimeout(() => {
        statusMessage = '';
      }, 3000);
    }
  }
</script>

<svelte:head>
  <title>Order {order.id.substring(0, 8)} - Admin Dashboard</title>
</svelte:head>

<div class="order-details-container">
  <div class="order-header">
    <button class="btn-back" on:click={() => goto('/admin/orders')}>← Back to Orders</button>
    <h1>Order Details</h1>
  </div>

  <div class="order-content">
    <!-- Order Summary Card -->
    <div class="card">
      <h2>Order Summary</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Order ID:</span>
          <span class="value monospace">{order.id}</span>
        </div>
        <div class="info-item">
          <span class="label">Status:</span>
          <span class="status-badge" style="background-color: {getStatusColor(order.status)}">
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
        </div>
        <div class="info-item">
          <span class="label">Order Date:</span>
          <span class="value">{formatDate(order.created_at)}</span>
        </div>
        <div class="info-item">
          <span class="label">Last Updated:</span>
          <span class="value">{formatDate(order.updated_at)}</span>
        </div>
      </div>

      <!-- Status Update -->
      <div class="status-update-section">
        <h3>Update Status</h3>
        {#if statusMessage}
          <div class="status-message">{statusMessage}</div>
        {/if}
        <div class="status-buttons">
          <button
            class="btn-status"
            class:active={order.status === 'pending'}
            disabled={isUpdatingStatus || order.status === 'pending'}
            on:click={() => handleStatusChange('pending')}
          >
            Pending
          </button>
          <button
            class="btn-status"
            class:active={order.status === 'processing'}
            disabled={isUpdatingStatus || order.status === 'processing'}
            on:click={() => handleStatusChange('processing')}
          >
            Processing
          </button>
          <button
            class="btn-status"
            class:active={order.status === 'shipped'}
            disabled={isUpdatingStatus || order.status === 'shipped'}
            on:click={() => handleStatusChange('shipped')}
          >
            Shipped
          </button>
          <button
            class="btn-status"
            class:active={order.status === 'delivered'}
            disabled={isUpdatingStatus || order.status === 'delivered'}
            on:click={() => handleStatusChange('delivered')}
          >
            Delivered
          </button>
          <button
            class="btn-status danger"
            class:active={order.status === 'cancelled'}
            disabled={isUpdatingStatus || order.status === 'cancelled'}
            on:click={() => handleStatusChange('cancelled')}
          >
            Cancelled
          </button>
        </div>
      </div>
    </div>

    <!-- Order Items Card -->
    <div class="card">
      <h2>Order Items</h2>
      <div class="items-list">
        {#each order.items as item}
          <div class="item">
            <img src={item.image} alt={item.name} class="item-image" />
            <div class="item-details">
              <h3>{item.name}</h3>
              <p>Quantity: {item.quantity}</p>
              <p class="item-price">${item.price.toFixed(2)} each</p>
            </div>
            <div class="item-total">
              ${(item.price * item.quantity).toFixed(2)}
            </div>
          </div>
          {#if item.customizations?.length || item.fieldValues?.length}
            <div class="item-design">
              {#if item.customizations?.length}
                <div class="design-artwork">
                  <span class="design-label">Customer artwork</span>
                  <div class="artwork-list">
                    {#each item.customizations as art}
                      <div class="artwork">
                        <div class="artwork-head">
                          <strong>{art.zoneName}</strong>
                          {#if art.designRevision > 1}
                            <span class="design-revision">revision {art.designRevision}</span>
                          {/if}
                        </div>
                        <ul class="element-list">
                          {#each art.elements as el (el.id)}
                            <li class="element-row">
                              {#if el.kind === 'image'}
                                <img src={el.src} alt="" class="artwork-thumb" />
                                <div class="artwork-meta">
                                  <strong>{el.name || 'Artwork'}</strong>
                                  <span>{placementText(el.place)}</span>
                                  {#if el.naturalWidth}
                                    <span
                                      >{el.naturalWidth}×{el.naturalHeight}px{el.flipped
                                        ? ' · mirrored'
                                        : ''}</span
                                    >
                                  {/if}
                                  <a
                                    href={el.src}
                                    download={el.name || `${art.zoneName}.png`}
                                    class="artwork-download">Download</a
                                  >
                                </div>
                              {:else}
                                <span class="text-swatch" style="background:{el.color}"></span>
                                <div class="artwork-meta">
                                  <strong>“{el.text}”</strong>
                                  <span>{placementText(el.place)}</span>
                                  <span
                                    >{fontNameFor(el.font)} · {inkNameFor(el.color)}{el.flipped
                                      ? ' · mirrored'
                                      : ''}</span
                                  >
                                </div>
                              {/if}
                            </li>
                          {/each}
                        </ul>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
              {#if item.fieldValues?.length}
                <div class="design-fields">
                  <span class="design-label">Personalization</span>
                  <ul>
                    {#each item.fieldValues as field}
                      <li><strong>{field.fieldName}:</strong> {field.value}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
      <div class="order-totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${order.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Shipping:</span>
          <span>${order.shipping_cost.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Tax:</span>
          <span>${order.tax.toFixed(2)}</span>
        </div>
        <div class="total-row final">
          <span>Total:</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <!-- Shipping Details -->
    {#if order.shipping_details && order.shipping_details.groups.length > 0}
      <div class="card">
        <h2>Shipping Details</h2>
        <p class="section-description">
          This order contains {order.shipping_details.groups.length}
          {order.shipping_details.groups.length === 1 ? 'package' : 'packages'} with different shipping
          options.
        </p>

        <div class="shipping-groups">
          {#each order.shipping_details.groups as group, index}
            <div class="shipping-group">
              <div class="group-header">
                <h3>Package {index + 1}</h3>
                <div class="shipping-option-badge">
                  <span class="shipping-icon">📦</span>
                  <div class="shipping-option-info">
                    <span class="option-name">{group.shippingOptionName}</span>
                    <span class="option-cost">${group.shippingCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div class="group-products">
                <h4>Products in this package:</h4>
                <ul class="product-list">
                  {#each group.products as product}
                    <li class="product-item">
                      <span class="product-name">{product.name}</span>
                      <span class="product-quantity">× {product.quantity}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            </div>
          {/each}
        </div>

        <div class="shipping-summary">
          <div class="summary-row">
            <span>Total Packages:</span>
            <span class="summary-value">{order.shipping_details.groups.length}</span>
          </div>
          <div class="summary-row">
            <span>Total Shipping Cost:</span>
            <span class="summary-value">${order.shipping_cost.toFixed(2)}</span>
          </div>
        </div>
      </div>
    {:else}
      <div class="card">
        <h2>Shipping Details</h2>
        <p class="no-shipping-info">
          No detailed shipping information available for this order. This order may have been placed
          before shipping tracking was implemented.
        </p>
      </div>
    {/if}

    <!-- Customer Information -->
    <div class="card">
      <h2>Customer Information</h2>
      <div class="customer-grid">
        <div class="customer-section">
          <h3>Shipping Address</h3>
          <p>
            {order.shipping_address.firstName}
            {order.shipping_address.lastName}
          </p>
          <p>{order.shipping_address.email}</p>
          <p>{order.shipping_address.phone}</p>
          <p>{order.shipping_address.address}</p>
          <p>
            {order.shipping_address.city}, {order.shipping_address.state}
            {order.shipping_address.zipCode}
          </p>
          <p>{countryName(order.shipping_address.country)}</p>
        </div>
        <div class="customer-section">
          <h3>Billing Address</h3>
          <p>
            {order.billing_address.firstName}
            {order.billing_address.lastName}
          </p>
          <p>{order.billing_address.address}</p>
          <p>
            {order.billing_address.city}, {order.billing_address.state}
            {order.billing_address.zipCode}
          </p>
          <p>{countryName(order.billing_address.country)}</p>
        </div>
      </div>
    </div>

    <!-- Payment Information -->
    <div class="card">
      <h2>Payment Information</h2>
      <div class="payment-info">
        <div class="info-item">
          <span class="label">Payment Type:</span>
          <span class="value">{order.payment_method.type}</span>
        </div>
        <div class="info-item">
          <span class="label">Payment Status:</span>
          <span class="value">{order.payment_status}</span>
        </div>
        {#if order.payment_method.cardNumber}
          <div class="info-item">
            <span class="label">Card Number:</span>
            <span class="value monospace">{order.payment_method.cardNumber}</span>
          </div>
        {/if}
        {#if order.payment_method.cardHolderName}
          <div class="info-item">
            <span class="label">Cardholder:</span>
            <span class="value">{order.payment_method.cardHolderName}</span>
          </div>
        {/if}
        {#if order.payment_method.expiryMonth && order.payment_method.expiryYear}
          <div class="info-item">
            <span class="label">Expiry:</span>
            <span class="value"
              >{order.payment_method.expiryMonth}/{order.payment_method.expiryYear}</span
            >
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .order-details-container {
    padding: 2rem;
    width: 100%;
  }

  .order-header {
    margin-bottom: 2rem;
  }

  .btn-back {
    background: none;
    border: none;
    color: var(--color-primary);
    font-size: 1rem;
    cursor: pointer;
    margin-bottom: 1rem;
    padding: 0;
    transition: color 0.2s;
  }

  .btn-back:hover {
    color: var(--color-primary-hover);
    text-decoration: underline;
  }

  .order-header h1 {
    margin: 0;
    color: var(--color-text-primary);
  }

  .order-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .card {
    background: var(--color-bg-primary);
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 10px var(--color-shadow-light);
  }

  .card h2 {
    margin: 0 0 1rem 0;
    color: var(--color-text-primary);
    font-size: 1.25rem;
  }

  .card h3 {
    margin: 1rem 0 0.5rem 0;
    color: var(--color-text-primary);
    font-size: 1rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .label {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .value {
    color: var(--color-text-primary);
  }

  .monospace {
    font-family: monospace;
    font-size: 0.875rem;
  }

  .status-badge {
    display: inline-block;
    padding: 0.375rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: fit-content;
  }

  .status-update-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-border-primary);
  }

  .status-message {
    padding: 0.75rem;
    background: var(--color-success);
    color: white;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .status-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .btn-status {
    padding: 0.5rem 1rem;
    border: 2px solid var(--color-border-primary);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }

  .btn-status:hover:not(:disabled) {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: white;
  }

  .btn-status.active {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: white;
  }

  .btn-status.danger:hover:not(:disabled) {
    border-color: var(--color-danger);
    background: var(--color-danger);
  }

  .btn-status:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .items-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .item {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--color-border-primary);
    border-radius: 4px;
  }

  .item-image {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .item-details {
    flex: 1;
  }

  .item-details h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
  }

  .item-details p {
    margin: 0.25rem 0;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  .item-price {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .item-total {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
  }

  .item-design {
    margin: -0.5rem 0 0.5rem 0;
    padding: 0.75rem 1rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-secondary);
    border-radius: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
  }

  .design-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }

  .artwork-list {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .artwork {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .artwork-head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .design-revision {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .element-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .element-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  /* The ink, at the size a swatch needs to be recognisable next to a thumbnail
     of the same height. */
  .text-swatch {
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    border: 1px solid var(--color-border-primary);
    border-radius: 6px;
  }

  .artwork-thumb {
    width: 64px;
    height: 64px;
    object-fit: contain;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border-primary);
    border-radius: 6px;
  }

  .artwork-meta {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .artwork-download {
    color: var(--color-primary);
    font-weight: 500;
    text-decoration: none;
  }

  .artwork-download:hover {
    text-decoration: underline;
  }

  .design-fields ul {
    margin: 0;
    padding-left: 1rem;
    font-size: 0.9rem;
    color: var(--color-text-primary);
  }

  .order-totals {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 2px solid var(--color-border-primary);
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    color: var(--color-text-secondary);
  }

  .total-row.final {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text-primary);
    border-top: 1px solid var(--color-border-primary);
    padding-top: 1rem;
    margin-top: 0.5rem;
  }

  .customer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
  }

  .customer-section p {
    margin: 0.25rem 0;
    color: var(--color-text-secondary);
  }

  .payment-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .section-description {
    color: var(--color-text-secondary);
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
  }

  .shipping-groups {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .shipping-group {
    border: 2px solid var(--color-border-primary);
    border-radius: 8px;
    padding: 1.5rem;
    background: var(--color-bg-secondary);
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border-primary);
  }

  .group-header h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 1.125rem;
  }

  .shipping-option-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--color-primary);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 6px;
  }

  .shipping-icon {
    font-size: 1.25rem;
  }

  .shipping-option-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .option-name {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .option-cost {
    font-size: 0.75rem;
    opacity: 0.9;
  }

  .group-products {
    margin-top: 1rem;
  }

  .group-products h4 {
    margin: 0 0 0.75rem 0;
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .product-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .product-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: var(--color-bg-primary);
    border-radius: 4px;
    border: 1px solid var(--color-border-primary);
  }

  .product-name {
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .product-quantity {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    background: var(--color-bg-secondary);
    border-radius: 4px;
  }

  .shipping-summary {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 2px solid var(--color-border-primary);
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    color: var(--color-text-secondary);
  }

  .summary-value {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .no-shipping-info {
    color: var(--color-text-secondary);
    font-style: italic;
    text-align: center;
    padding: 2rem;
  }

  @media (max-width: 768px) {
    .order-details-container {
      padding: 1rem;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .item {
      flex-direction: column;
    }

    .item-image {
      width: 100%;
      height: 200px;
    }

    .customer-grid {
      grid-template-columns: 1fr;
    }

    .payment-info {
      grid-template-columns: 1fr;
    }

    .status-buttons {
      flex-direction: column;
    }

    .btn-status {
      width: 100%;
    }

    .group-header {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }

    .shipping-option-badge {
      width: 100%;
      justify-content: center;
    }
  }
</style>
