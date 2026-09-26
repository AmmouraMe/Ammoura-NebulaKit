<script lang="ts">
  import { DEFAULT_STORE_NAME } from '$lib/branding';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { cartStore } from '../../lib/stores/cart.ts';
  import Button from '../../lib/components/Button.svelte';
  import { calculateTotalStock } from '$lib/utils/stock';
  import { money, t } from '$lib/i18n';

  $: totalItems = cartStore.getTotalItems($cartStore);
  $: totalPrice = cartStore.getTotalPrice($cartStore);

  function updateQuantity(productId: string, quantity: number, variantId?: string) {
    cartStore.updateQuantity(productId, quantity, variantId);
  }

  function removeItem(productId: string, variantId?: string) {
    cartStore.removeItem(productId, variantId);
  }

  function clearCart() {
    cartStore.clear();
  }

  function checkout() {
    goto('/checkout');
  }
</script>

<svelte:head>
  <title>{$t('cart.title')} - {$page.data.storeName || DEFAULT_STORE_NAME}</title>
</svelte:head>

<div class="cart-header">
  <h1>{$t('cart.title')}</h1>
  <a href="/" class="continue-shopping">← {$t('cart.continueShopping')}</a>
</div>

{#if $cartStore.length === 0}
  <div class="empty-cart">
    <h2>{$t('cart.empty')}</h2>
    <p>{$t('cart.emptyPrompt')}</p>
    <Button variant="primary" on:click={() => (window.location.href = '/')}
      >{$t('cart.browseProducts')}</Button
    >
  </div>
{:else}
  <div class="cart-content">
    <div class="cart-items">
      {#each $cartStore as item}
        {@const totalStock = calculateTotalStock(item.fulfillmentOptions, item.stock)}
        <div class="cart-item">
          <img src={item.image} alt={item.name} />
          <div class="item-details">
            <h3>{item.name}</h3>
            {#if item.variantLabel}
              <p class="item-variant">{item.variantLabel}</p>
            {/if}
            <p class="item-price">{$money(item.price)}</p>
            <p class="item-category">{item.category}</p>

            <!-- Confirm what was actually designed. Without this the shopper
                 reaches payment with no evidence their artwork or their
                 personalization choices survived. -->
            {#if item.customizations?.length}
              <div class="item-designs">
                {#each item.customizations as design (design.zoneId)}
                  <figure class="design-chip">
                    <img
                      src={design.imageDataUrl}
                      alt="Your design for {design.zoneName}"
                      style="transform: rotate({design.rotation ?? 0}deg);"
                    />
                    <figcaption>
                      {design.zoneName}
                      {#if design.naturalWidth}
                        <span class="design-meta">
                          {design.naturalWidth}×{design.naturalHeight}px
                        </span>
                      {/if}
                    </figcaption>
                  </figure>
                {/each}
              </div>
            {/if}

            {#if item.fieldValues?.length}
              <ul class="item-personalization">
                {#each item.fieldValues as field (field.fieldId)}
                  <li>
                    <span class="field-name">{field.fieldName}:</span>
                    {#if field.fieldType === 'color'}
                      <span class="field-swatch" style="background:{field.value}"></span>
                    {/if}
                    <span class="field-value">{field.value}</span>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
          <div class="item-controls">
            <div class="quantity-controls">
              <button
                on:click={() => updateQuantity(item.id, item.quantity - 1, item.variantId)}
                disabled={item.quantity <= 1}
              >
                -
              </button>
              <span class="quantity">{item.quantity}</span>
              <button
                on:click={() => updateQuantity(item.id, item.quantity + 1, item.variantId)}
                disabled={item.quantity >= totalStock}
              >
                +
              </button>
            </div>
            <p class="item-total">{$money(item.price * item.quantity)}</p>
            <Button variant="danger" on:click={() => removeItem(item.id, item.variantId)}
              >{$t('common.remove')}</Button
            >
          </div>
        </div>
      {/each}
    </div>

    <div class="cart-summary">
      <div class="summary-content">
        <h3>{$t('cart.orderSummary')}</h3>
        <div class="summary-row">
          <span>{$t('cart.totalItems')}:</span>
          <span>{totalItems}</span>
        </div>
        <div class="summary-row total">
          <span>{$t('cart.totalPrice')}:</span>
          <span>{$money(totalPrice)}</span>
        </div>
        <div class="cart-actions">
          <Button variant="secondary" on:click={clearCart}>{$t('cart.clear')}</Button>
          <Button variant="primary" on:click={checkout}>{$t('cart.proceedToCheckout')}</Button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .cart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .cart-header h1 {
    color: var(--color-text-primary);
    margin: 0;
    transition: color var(--transition-normal);
  }

  .continue-shopping {
    color: var(--color-primary);
    text-decoration: none;
    font-size: 1rem;
    transition: color var(--transition-fast);
  }

  .continue-shopping:hover {
    color: var(--color-primary-hover);
    text-decoration: underline;
  }

  .empty-cart {
    text-align: center;
    background: var(--color-bg-primary);
    padding: 3rem;
    border-radius: 8px;
    box-shadow: 0 2px 10px var(--color-shadow-light);
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .empty-cart h2 {
    color: var(--color-text-secondary);
    margin-bottom: 1rem;
    transition: color var(--transition-normal);
  }

  .empty-cart p {
    color: var(--color-text-tertiary);
    margin-bottom: 2rem;
    transition: color var(--transition-normal);
  }

  .cart-content {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 2rem;
  }

  .cart-items {
    background: var(--color-bg-primary);
    border-radius: 8px;
    box-shadow: 0 2px 10px var(--color-shadow-light);
    padding: 1.5rem;
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .cart-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--color-border-primary);
  }

  .cart-item:last-child {
    border-bottom: none;
  }

  .cart-item img {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 4px;
  }

  .item-details h3 {
    margin: 0 0 0.5rem 0;
    color: var(--color-text-primary);
    transition: color var(--transition-normal);
  }

  .item-variant {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    margin: 0 0 0.25rem 0;
  }

  .item-price {
    font-weight: bold;
    color: var(--color-primary);
    margin: 0 0 0.25rem 0;
    transition: color var(--transition-normal);
  }

  .item-category {
    font-size: 0.8rem;
    color: var(--color-text-tertiary);
    margin: 0;
    text-transform: uppercase;
    transition: color var(--transition-normal);
  }

  .item-designs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.5rem 0 0;
  }

  .design-chip {
    margin: 0;
    width: 64px;
  }

  .design-chip img {
    width: 64px;
    height: 64px;
    object-fit: contain;
    border-radius: var(--radius-sm, 4px);
    border: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
  }

  .design-chip figcaption {
    font-size: 0.6875rem;
    color: var(--color-text-tertiary);
    text-align: center;
    margin-top: 0.125rem;
    line-height: 1.2;
  }

  .design-meta {
    display: block;
    font-variant-numeric: tabular-nums;
  }

  .item-personalization {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .item-personalization .field-name {
    font-weight: 600;
  }

  .field-swatch {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 2px;
    border: 1px solid var(--color-border);
    vertical-align: -1px;
    margin-right: 0.25rem;
  }

  .item-controls {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }

  .quantity-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .quantity-controls button {
    width: 28px;
    height: 28px;
    border: 1px solid var(--color-border-secondary);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background-color var(--transition-normal),
      border-color var(--transition-normal);
  }

  .quantity-controls button:hover:not(:disabled) {
    background: var(--color-bg-accent);
  }

  .quantity-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .quantity {
    min-width: 30px;
    text-align: center;
    font-weight: bold;
    color: var(--color-text-primary);
    transition: color var(--transition-normal);
  }

  .item-total {
    font-weight: bold;
    color: var(--color-text-primary);
    margin: 0;
    transition: color var(--transition-normal);
  }

  .cart-summary {
    background: var(--color-bg-primary);
    border-radius: 8px;
    box-shadow: 0 2px 10px var(--color-shadow-light);
    padding: 1.5rem;
    height: fit-content;
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .summary-content h3 {
    margin: 0 0 1rem 0;
    color: var(--color-text-primary);
    transition: color var(--transition-normal);
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    color: var(--color-text-secondary);
    transition: color var(--transition-normal);
  }

  .summary-row.total {
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--color-text-primary);
    border-top: 1px solid var(--color-border-primary);
    padding-top: 0.5rem;
    margin-top: 1rem;
    transition:
      color var(--transition-normal),
      border-color var(--transition-normal);
  }

  .cart-actions {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 2rem;
  }

  @media (max-width: 768px) {
    .cart-header {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }

    .cart-content {
      grid-template-columns: 1fr;
    }

    .cart-item {
      grid-template-columns: auto 1fr;
      grid-template-rows: auto auto;
    }

    .item-controls {
      grid-column: 1 / -1;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      margin-top: 1rem;
    }
  }
</style>
