<script lang="ts">
  import Button from './Button.svelte';
  import { cartStore, cartItems } from '../stores/cart.ts';
  import type { Product } from '../types/index.js';
  import { onMount } from 'svelte';
  import { calculateTotalStock } from '../utils/stock.js';
  import { money, t } from '$lib/i18n';

  export let product: Product;

  $: quantity = cartStore.getItemQuantity($cartItems, product.id);
  $: totalStock = calculateTotalStock(product.fulfillmentOptions, product.stock);
  $: hasImage = product.image && product.image.trim() !== '';

  let isImageLoaded = false;
  let imageError = false;
  let imgElement: HTMLImageElement | undefined;

  function addToCart() {
    cartStore.addItem(product, 1);
  }

  function incrementQuantity() {
    cartStore.updateQuantity(product.id, quantity + 1);
  }

  function decrementQuantity() {
    cartStore.updateQuantity(product.id, quantity - 1);
  }

  function handleImageLoad() {
    isImageLoaded = true;
    imageError = false;
  }

  function handleImageError() {
    imageError = true;
    isImageLoaded = true;
  }

  // Check if image is already loaded (cached)
  onMount(() => {
    if (hasImage && imgElement && imgElement.complete) {
      if (imgElement.naturalHeight !== 0) {
        handleImageLoad();
      } else {
        handleImageError();
      }
    }
  });
</script>

<div class="product-card">
  <div class="image-container">
    {#if !hasImage}
      <div class="image-placeholder">
        <span>📦</span>
        <p>{$t('product.noImage')}</p>
      </div>
    {:else}
      {#if !isImageLoaded}
        <div class="image-skeleton"></div>
      {/if}
      {#if imageError}
        <div class="image-placeholder">
          <span>📦</span>
          <p>{$t('product.imageUnavailable')}</p>
        </div>
      {:else}
        <img
          bind:this={imgElement}
          src={product.image}
          alt={product.name}
          class:loaded={isImageLoaded}
          on:load={handleImageLoad}
          on:error={handleImageError}
        />
      {/if}
    {/if}
    <div class="image-overlay">
      <Button variant="primary" on:click={() => (window.location.href = `/product/${product.id}`)}>
        Quick View
      </Button>
    </div>
  </div>

  <div class="product-info">
    <div class="product-header">
      <span class="category-badge">{product.category}</span>
      {#if totalStock < 10 && totalStock > 0}
        <span class="low-stock-badge">Only {totalStock} left!</span>
      {/if}
    </div>

    <h3>{product.name}</h3>
    <p class="description">{product.description}</p>

    <div class="product-footer">
      <div class="price-container">
        <span class="price">
          {$money(product.price)}
          {#if product.regularPrice && product.regularPrice > product.price}
            <s class="regular-price">{$money(product.regularPrice)}</s>
          {/if}
        </span>
        <span class="stock-info">
          {#if totalStock === 0}
            <span class="out-of-stock">Out of Stock</span>
          {:else}
            <span class="in-stock">✓ In Stock</span>
          {/if}
        </span>
      </div>

      <div class="actions">
        {#if quantity === 0}
          <Button variant="primary" on:click={addToCart} disabled={totalStock === 0}>
            {totalStock === 0 ? $t('product.outOfStock') : $t('product.addToCart')}
          </Button>
        {:else}
          <div class="quantity-controls">
            <button
              class="quantity-btn"
              on:click={decrementQuantity}
              aria-label={$t('product.decreaseQuantity')}
            >
              −
            </button>
            <span class="quantity-display" aria-live="polite">{quantity}</span>
            <button
              class="quantity-btn"
              on:click={incrementQuantity}
              disabled={quantity >= totalStock}
              aria-label={$t('product.increaseQuantity')}
            >
              +
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .product-card {
    background: var(--color-bg-primary);
    border-radius: 16px;
    box-shadow: 0 2px 8px var(--color-shadow-light);
    overflow: hidden;
    transition: all var(--transition-normal);
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    border: 1px solid var(--color-border-secondary);
  }

  .product-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 12px 32px var(--color-shadow-dark);
    border-color: var(--color-primary);
  }

  .image-container {
    position: relative;
    width: 100%;
    height: 260px;
    overflow: hidden;
    background: var(--color-bg-tertiary);
  }

  .image-skeleton {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      var(--color-bg-tertiary) 0%,
      var(--color-bg-accent) 50%,
      var(--color-bg-tertiary) 100%
    );
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
  }

  @keyframes skeleton-loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition:
      transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
      opacity 0.3s ease;
    opacity: 0;
  }

  img.loaded {
    opacity: 1;
  }

  .image-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    color: var(--color-text-tertiary);
  }

  .image-placeholder span {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }

  .image-placeholder p {
    margin: 0;
    font-size: 0.875rem;
  }

  .product-card:hover img {
    transform: scale(1.1);
  }

  .image-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity var(--transition-normal);
  }

  .product-card:hover .image-overlay {
    opacity: 1;
  }

  .product-info {
    padding: 1.5rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .product-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .category-badge {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.75rem;
    background: var(--color-bg-accent);
    border-radius: 6px;
  }

  .low-stock-badge {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-warning);
    padding: 0.25rem 0.75rem;
    background: color-mix(in srgb, var(--color-warning) 10%, transparent);
    border-radius: 6px;
  }

  h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.3;
    transition: color var(--transition-normal);
  }

  .description {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
    flex: 1;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: color var(--transition-normal);
  }

  .product-footer {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .price-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .price {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-primary);
    transition: color var(--transition-normal);
  }

  .stock-info {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .in-stock {
    color: var(--color-success);
  }

  .out-of-stock {
    color: var(--color-danger);
    font-weight: 600;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .quantity-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: var(--color-bg-secondary);
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid var(--color-border-secondary);
  }

  .quantity-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary);
    color: var(--color-text-inverse);
    border: none;
    border-radius: 6px;
    font-size: 1.25rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .quantity-btn:hover:not(:disabled) {
    background: var(--color-primary-hover);
    transform: scale(1.1);
  }

  .quantity-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .quantity-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .quantity-display {
    flex: 1;
    text-align: center;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-primary);
    min-width: 40px;
  }

  @media (max-width: 768px) {
    .image-container {
      height: 220px;
    }

    .product-info {
      padding: 1.25rem;
    }

    h3 {
      font-size: 1.125rem;
    }

    .price {
      font-size: 1.5rem;
    }
  }

  .regular-price {
    margin-left: 0.35rem;
    font-size: 0.8em;
    font-weight: 400;
    color: var(--color-text-tertiary);
  }
</style>
