<script lang="ts">
  import { DEFAULT_STORE_NAME } from '$lib/branding';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { cartStore } from '../../../lib/stores/cart';
  import Button from '../../../lib/components/Button.svelte';
  import type { PageData } from './$types';
  import { money, t } from '$lib/i18n';

  export let data: PageData;

  $: order = data.order;
  $: orderId = order?.id || '';
  $: orderTotal = order ? $money(order.total) : '';
  $: customerEmail = order?.email || '';
  $: paymentPending = order?.paymentStatus === 'unpaid';

  onMount(() => {
    // Order lookup succeeded (by Stripe session id from the server load) —
    // Stripe only redirects here after payment, so it's safe to clear now.
    if (order) {
      cartStore.clear();
    }
  });

  function continueShopping() {
    window.location.href = '/';
  }

  function viewOrders() {
    // In a real app, this would navigate to order history
    alert('Order history functionality would be implemented here!');
  }
</script>

<svelte:head>
  <title>{$t('orderSuccess.title')} - {$page.data.storeName || DEFAULT_STORE_NAME}</title>
</svelte:head>

{#if order}
  <div class="checkout-success">
    <div class="success-icon">
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    </div>

    <h1>{$t('orderSuccess.confirmed')}</h1>
    <p class="success-message">
      {$t('orderSuccess.thankYou')} <strong>{customerEmail}</strong>
    </p>

    {#if paymentPending}
      <p class="payment-pending-note">{$t('orderSuccess.paymentPending')}</p>
    {/if}

    <div class="order-details">
      <h2>{$t('orderSuccess.details')}</h2>
      <div class="detail-row">
        <span>{$t('orderSuccess.orderNumber')}:</span>
        <span class="order-id">{orderId}</span>
      </div>
      <div class="detail-row">
        <span>{$t('orderSuccess.totalAmount')}:</span>
        <span class="order-total">{orderTotal}</span>
      </div>
    </div>

    <div class="next-steps">
      <h3>{$t('orderSuccess.nextSteps')}</h3>
      <ul>
        <li>{$t('orderSuccess.next.email')}</li>
        <li>{$t('orderSuccess.next.processing')}</li>
        <li>{$t('orderSuccess.next.tracking')}</li>
        <li>{$t('orderSuccess.next.arrival')}</li>
      </ul>
    </div>

    <div class="action-buttons">
      <Button variant="primary" on:click={continueShopping}>{$t('cart.continueShopping')}</Button>
      <Button variant="secondary" on:click={viewOrders}>{$t('orderSuccess.viewOrders')}</Button>
    </div>
  </div>
{:else}
  <div class="checkout-success">
    <h1>{$t('orderSuccess.notFound')}</h1>
    <p class="success-message">{$t('orderSuccess.notFoundHelp')}</p>
    <div class="action-buttons">
      <Button variant="primary" on:click={continueShopping}>{$t('cart.continueShopping')}</Button>
    </div>
  </div>
{/if}

<style>
  .checkout-success {
    max-width: 600px;
    margin: 2rem auto;
    padding: 2rem;
    text-align: center;
    background: var(--color-bg-primary);
    border-radius: 12px;
    box-shadow: 0 4px 20px var(--color-shadow-medium);
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .success-icon {
    margin: 0 auto 1.5rem;
    color: var(--color-success);
  }

  .checkout-success h1 {
    color: var(--color-success);
    margin: 0 0 1rem 0;
    font-size: 2rem;
    transition: color var(--transition-normal);
  }

  .success-message {
    color: var(--color-text-secondary);
    margin-bottom: 2rem;
    font-size: 1.1rem;
    line-height: 1.6;
    transition: color var(--transition-normal);
  }

  .success-message strong {
    color: var(--color-text-primary);
  }

  .payment-pending-note {
    color: var(--color-text-tertiary);
    font-size: 0.9rem;
    margin: -1rem 0 1.5rem 0;
  }

  .order-details {
    background: var(--color-bg-secondary);
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
    text-align: left;
    transition: background-color var(--transition-normal);
  }

  .order-details h2 {
    margin: 0 0 1rem 0;
    color: var(--color-text-primary);
    font-size: 1.2rem;
    transition: color var(--transition-normal);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    color: var(--color-text-secondary);
    transition: color var(--transition-normal);
  }

  .detail-row:last-child {
    margin-bottom: 0;
  }

  .order-id {
    font-family: monospace;
    color: var(--color-primary);
    font-weight: 500;
    transition: color var(--transition-normal);
  }

  .order-total {
    color: var(--color-text-primary);
    font-weight: bold;
    font-size: 1.1rem;
    transition: color var(--transition-normal);
  }

  .next-steps {
    text-align: left;
    margin-bottom: 2rem;
  }

  .next-steps h3 {
    margin: 0 0 1rem 0;
    color: var(--color-text-primary);
    transition: color var(--transition-normal);
  }

  .next-steps ul {
    margin: 0;
    padding-left: 1.5rem;
    color: var(--color-text-secondary);
    transition: color var(--transition-normal);
  }

  .next-steps li {
    margin-bottom: 0.5rem;
    line-height: 1.5;
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  @media (max-width: 768px) {
    .checkout-success {
      margin: 1rem;
      padding: 1.5rem;
    }

    .action-buttons {
      flex-direction: column;
    }

    .action-buttons :global(.btn) {
      width: 100%;
    }
  }
</style>
