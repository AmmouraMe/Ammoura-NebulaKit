<script lang="ts">
  import { DEFAULT_STORE_NAME } from '$lib/branding';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { cartStore } from '../../lib/stores/cart';
  import { checkoutStore } from '../../lib/stores/checkout';
  import { money, t } from '$lib/i18n';
  import ShippingAddressForm from '../../lib/components/ShippingAddressForm.svelte';
  import BillingAddressForm from '../../lib/components/BillingAddressForm.svelte';
  import ShippingOptionsSelector from '../../lib/components/ShippingOptionsSelector.svelte';
  import ShippingGroupsSelector from '../../lib/components/ShippingGroupsSelector.svelte';
  import Button from '../../lib/components/Button.svelte';
  import type { CheckoutValidationErrors } from '../../lib/types/checkout';
  import type { AvailableShippingOption } from '../../lib/types/shipping';
  import {
    validateShippingSelections,
    calculateTotalShippingCost
  } from '../../lib/utils/shippingGroups';
  import { calculateOrderTax, calculateOrderTotal } from '$lib/checkout-pricing';
  import type { PageData } from './$types';

  export let data: PageData;

  let currentStep = 1;
  let isSubmitting = false;
  let validationErrors: CheckoutValidationErrors = {};
  let errorMessage = '';

  $: cartItems = $cartStore;
  $: subtotal = cartStore.getTotalPrice(cartItems);
  $: hasPhysicalProducts = cartItems.some((item) => item.type === 'physical');

  $: checkoutState = $checkoutStore;
  $: currentStep = checkoutState.currentStep;
  $: validationErrors = checkoutState.validationErrors;
  $: isSubmitting = checkoutState.isSubmitting;
  $: shippingGroups = checkoutState.shippingGroups;
  $: shippingGroupsLoaded = checkoutState.shippingGroupsLoaded;
  $: selectedShippingOptions = checkoutState.formData.selectedShippingOptions;

  // Selected shipping option object from available options
  $: selectedShippingOption =
    checkoutState.availableShippingOptions?.find(
      (opt) => opt.id === checkoutState.formData.selectedShippingOptionId
    ) || null;

  // Compute shipping cost - use groups if available, otherwise fall back to single option
  // This is now reactive to changes in shippingGroups and selectedShippingOptions
  $: shippingCost = hasPhysicalProducts
    ? shippingGroupsLoaded && shippingGroups.length > 0
      ? calculateTotalShippingCost(shippingGroups, selectedShippingOptions)
      : (selectedShippingOption?.price ?? 0)
    : 0;

  // Determine if shipping cost is known (selected) or pending selection
  // Show -- if we're before step 2 OR if we have non-free groups without selections
  $: shippingCostKnown = (() => {
    if (!hasPhysicalProducts) return true; // No physical products = no shipping
    if (currentStep < 2) return false; // Before shipping step

    // Check if all non-free groups have selections
    if (shippingGroupsLoaded && shippingGroups.length > 0) {
      const nonFreeGroups = shippingGroups.filter((g) => !g.isFree);
      if (nonFreeGroups.length === 0) return true; // All free shipping
      // Check if all non-free groups have selections
      return nonFreeGroups.every((g) => selectedShippingOptions[g.id]);
    }

    return false; // Shipping not yet determined
  })();

  // The site's own tax rule, loaded server-side and charged with the same
  // functions the API reprices with — see $lib/checkout-pricing.
  $: taxRule = data.taxRule;
  $: tax = calculateOrderTax(subtotal, taxRule);
  $: total = calculateOrderTotal(subtotal, shippingCost, tax, taxRule);

  // Reload shipping groups when cart items change
  $: if (cartItems.length > 0 && hasPhysicalProducts) {
    checkoutStore.loadShippingGroups(cartItems);
  }

  onMount(async () => {
    // Redirect to cart if empty
    if (cartItems.length === 0) {
      goto('/cart');
      return;
    }

    // Load shipping groups if cart has physical products
    if (hasPhysicalProducts) {
      await checkoutStore.loadShippingGroups(cartItems);
    }
  });

  function nextStep() {
    // Validate current step using existing validation utility
    const errors = checkoutStore.validateForm();

    if (currentStep === 1) {
      // Shipping address validated in step 1
      if (!errors.shippingAddress || Object.keys(errors.shippingAddress).length === 0) {
        checkoutStore.setCurrentStep(2);
        return;
      }
    } else if (currentStep === 2) {
      // Shipping options selection step
      // If using shipping groups, validate all groups have selections
      if (hasPhysicalProducts && shippingGroupsLoaded) {
        const shippingErrors = validateShippingSelections(shippingGroups, selectedShippingOptions);
        if (Object.keys(shippingErrors).length > 0) {
          errorMessage = 'Please select a shipping option for all groups to continue';
          setTimeout(() => (errorMessage = ''), 3000);
          return;
        }
      } else if (hasPhysicalProducts && !checkoutState.formData.selectedShippingOptionId) {
        // Fallback to single option validation
        errorMessage = 'Please select a shipping option to continue';
        setTimeout(() => (errorMessage = ''), 3000);
        return;
      }
      checkoutStore.setCurrentStep(3);
      return;
    } else if (currentStep === 3) {
      // Billing step
      if (!errors.billingAddress || Object.keys(errors.billingAddress).length === 0) {
        checkoutStore.setCurrentStep(4);
        return;
      }
    }

    errorMessage = 'Please fix the errors before proceeding';
    setTimeout(() => (errorMessage = ''), 3000);
  }

  function previousStep() {
    if (currentStep > 1) {
      checkoutStore.setCurrentStep(currentStep - 1);
    }
  }

  async function submitOrder() {
    // Validate all forms
    const errors = checkoutStore.validateForm();

    if (Object.keys(errors).length > 0) {
      errorMessage = 'Please fix all errors before submitting';
      setTimeout(() => (errorMessage = ''), 3000);
      return;
    }

    const result = await checkoutStore.submitOrder(cartItems, subtotal, shippingCost, tax, total);

    if (result.success && result.url) {
      // Leave the cart as-is until Stripe confirms payment — the success
      // page clears it once the customer is actually redirected back paid.
      window.location.href = result.url;
    } else {
      errorMessage = result.error || 'Failed to process order';
      setTimeout(() => (errorMessage = ''), 5000);
    }
  }

  function handleShippingSelection(event: CustomEvent<AvailableShippingOption>) {
    checkoutStore.setSelectedShippingOption(event.detail.id);
  }

  function handleGroupShippingSelection(
    event: CustomEvent<{ groupId: string; option: AvailableShippingOption }>
  ) {
    checkoutStore.setShippingOptionForGroup(event.detail.groupId, event.detail.option.id);
  }
</script>

<svelte:head>
  <title>{$t('checkout.title')} - {$page.data.storeName || DEFAULT_STORE_NAME}</title>
</svelte:head>

<div class="checkout-container">
  <div class="checkout-header">
    <h1>{$t('checkout.title')}</h1>
    <a href="/cart" class="back-to-cart">← {$t('checkout.backToCart')}</a>
  </div>

  {#if cartItems.length === 0}
    <div class="empty-cart-message">
      <h2>{$t('cart.empty')}</h2>
      <p>{$t('checkout.emptyPrompt')}</p>
      <Button variant="primary" on:click={() => goto('/')}>{$t('cart.continueShopping')}</Button>
    </div>
  {:else}
    <div class="checkout-content">
      <div class="checkout-main">
        <!-- Progress Steps -->
        <div class="checkout-steps">
          <div class="step" class:active={currentStep === 1} class:completed={currentStep > 1}>
            <div class="step-number">1</div>
            <div class="step-label">{$t('checkout.step.shippingAddress')}</div>
          </div>
          <div class="step-connector" class:completed={currentStep > 1}></div>
          <div class="step" class:active={currentStep === 2} class:completed={currentStep > 2}>
            <div class="step-number">2</div>
            <div class="step-label">{$t('checkout.step.shippingMethod')}</div>
          </div>
          <div class="step-connector" class:completed={currentStep > 2}></div>
          <div class="step" class:active={currentStep === 3} class:completed={currentStep > 3}>
            <div class="step-number">3</div>
            <div class="step-label">{$t('checkout.step.billing')}</div>
          </div>
          <div class="step-connector" class:completed={currentStep > 3}></div>
          <div class="step" class:active={currentStep === 4}>
            <div class="step-number">4</div>
            <div class="step-label">{$t('checkout.step.payment')}</div>
          </div>
        </div>

        <!-- Error Message -->
        {#if errorMessage}
          <div class="error-message">
            {errorMessage}
          </div>
        {/if}

        <!-- Step Content -->
        <div class="step-content">
          {#if currentStep === 1}
            <ShippingAddressForm errors={validationErrors.shippingAddress || {}} />
          {:else if currentStep === 2}
            {#if shippingGroupsLoaded}
              <ShippingGroupsSelector
                {shippingGroups}
                selectedOptions={selectedShippingOptions}
                errors={validationErrors.shippingOptions || {}}
                loading={checkoutState.loadingShippingOptions}
                on:groupSelectionChange={handleGroupShippingSelection}
              />
            {:else}
              <ShippingOptionsSelector
                shippingOptions={checkoutState.availableShippingOptions}
                selectedOptionId={checkoutState.formData.selectedShippingOptionId}
                loading={checkoutState.loadingShippingOptions}
                error={validationErrors.shippingOption}
                on:selectionChange={handleShippingSelection}
              />
            {/if}
          {:else if currentStep === 3}
            <BillingAddressForm errors={validationErrors.billingAddress || {}} />
          {:else if currentStep === 4}
            <div class="stripe-redirect-notice">
              <h3>{$t('checkout.step.payment')}</h3>
              <p>{$t('checkout.stripeNotice')}</p>
            </div>
          {/if}
        </div>

        <!-- Navigation Buttons -->
        <div class="step-navigation">
          {#if currentStep > 1}
            <Button variant="secondary" on:click={previousStep}>{$t('checkout.previous')}</Button>
          {/if}

          {#if currentStep < 4}
            <Button variant="primary" on:click={nextStep}>{$t('common.continue')}</Button>
          {:else}
            <Button variant="primary" on:click={submitOrder} disabled={isSubmitting}>
              {isSubmitting ? $t('checkout.processing') : $t('checkout.placeOrder')}
            </Button>
          {/if}
        </div>
      </div>

      <!-- Order Summary -->
      <div class="order-summary">
        <h3>{$t('cart.orderSummary')}</h3>
        <div class="summary-items">
          {#each cartItems as item}
            <div class="summary-item">
              <img src={item.image} alt={item.name} />
              <div class="item-info">
                <h4>{item.name}</h4>
                <p>{$t('checkout.quantity')}: {item.quantity}</p>
                {#if item.equipmentValues && item.equipmentValues.length > 0}
                  <div class="item-equipment-values">
                    {#each item.equipmentValues as ev}
                      <span class="equipment-value">{ev.fieldName}: {ev.value}</span>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="item-price">
                {$money(item.price * item.quantity)}
              </div>
            </div>
          {/each}
        </div>

        <div class="summary-totals">
          <div class="total-row">
            <span>{$t('cart.subtotal')}:</span>
            <span>{$money(subtotal)}</span>
          </div>
          {#if shippingGroupsLoaded && shippingGroups.length > 0}
            <!-- Show shipping cost breakdown by group -->
            {#each shippingGroups as group}
              {@const selectedOptionId = selectedShippingOptions[group.id]}
              {@const selectedOption = group.shippingOptions.find(
                (opt) => opt.id === selectedOptionId
              )}
              <div class="total-row shipping-group-row">
                <span>
                  {#if group.isFree}
                    {$t('checkout.shippingFreeLabel')}
                  {:else if group.products.length === 1}
                    {$t('checkout.shipping')} - {group.products[0].name}
                  {:else}
                    {$t('checkout.shipping')} - {$t('cart.itemCount', {
                      count: group.products.length
                    })}
                  {/if}
                </span>
                <span>
                  {#if group.isFree || selectedOption?.isFreeShipping || selectedOption?.price === 0}
                    {$t('checkout.free')}
                  {:else if selectedOption}
                    {$money(selectedOption.price)}
                  {:else}
                    --
                  {/if}
                </span>
              </div>
            {/each}
            <div class="total-row">
              <span>{$t('checkout.totalShipping')}:</span>
              <span>
                {#if !shippingCostKnown}
                  --
                {:else if shippingCost === 0}
                  {$t('checkout.free')}
                {:else}
                  {$money(shippingCost)}
                {/if}
              </span>
            </div>
          {:else}
            <!-- Single shipping cost display -->
            <div class="total-row">
              <span>{$t('checkout.shipping')}:</span>
              <span>
                {#if !shippingCostKnown}
                  --
                {:else if shippingCost === 0}
                  {$t('checkout.free')}
                {:else}
                  {$money(shippingCost)}
                {/if}
              </span>
            </div>
          {/if}
          {#if tax > 0}
            <div class="total-row">
              <span
                >{taxRule.pricesIncludeTax ? $t('checkout.taxIncluded') : $t('checkout.tax')}:</span
              >
              <span>{$money(tax)}</span>
            </div>
          {/if}
          <div class="total-row final-total">
            <span>{$t('checkout.total')}:</span>
            <span>{$money(total)}</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .checkout-container {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 0 1rem;
  }

  .checkout-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .checkout-header h1 {
    color: var(--color-text-primary);
    margin: 0;
    transition: color var(--transition-normal);
  }

  .back-to-cart {
    color: var(--color-primary);
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  .back-to-cart:hover {
    color: var(--color-primary-hover);
    text-decoration: underline;
  }

  .empty-cart-message {
    text-align: center;
    background: var(--color-bg-primary);
    padding: 3rem;
    border-radius: 8px;
    box-shadow: 0 2px 10px var(--color-shadow-light);
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .empty-cart-message h2 {
    color: var(--color-text-secondary);
    margin-bottom: 1rem;
    transition: color var(--transition-normal);
  }

  .empty-cart-message p {
    color: var(--color-text-tertiary);
    margin-bottom: 2rem;
    transition: color var(--transition-normal);
  }

  .checkout-content {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 2rem;
  }

  .checkout-main {
    background: var(--color-bg-primary);
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 10px var(--color-shadow-light);
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .checkout-steps {
    display: flex;
    align-items: center;
    margin-bottom: 2rem;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .step-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--color-bg-tertiary);
    color: var(--color-text-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    transition:
      background-color var(--transition-normal),
      color var(--transition-normal);
  }

  .step.active .step-number {
    background: var(--color-primary);
    color: var(--color-text-inverse);
  }

  .step.completed .step-number {
    background: var(--color-success);
    color: var(--color-text-inverse);
  }

  .step-label {
    color: var(--color-text-secondary);
    font-weight: 500;
    transition: color var(--transition-normal);
    white-space: nowrap;
  }

  .step.active .step-label {
    color: var(--color-text-primary);
  }

  .step-connector {
    flex: 1;
    height: 2px;
    background: var(--color-border-primary);
    margin: 0 1rem;
    transition: background-color var(--transition-normal);
    min-width: 20px;
  }

  .step-connector.completed {
    background: var(--color-success);
  }

  .error-message {
    background: var(--color-danger);
    color: var(--color-text-inverse);
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    text-align: center;
    transition:
      background-color var(--transition-normal),
      color var(--transition-normal);
    word-wrap: break-word;
  }

  .step-content {
    margin-bottom: 2rem;
  }

  .stripe-redirect-notice {
    padding: 1.5rem;
    background: var(--color-bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--color-border-primary);
  }

  .stripe-redirect-notice h3 {
    margin: 0 0 0.5rem 0;
    color: var(--color-text-primary);
  }

  .stripe-redirect-notice p {
    margin: 0;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .step-navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .order-summary {
    background: var(--color-bg-primary);
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 10px var(--color-shadow-light);
    height: fit-content;
    transition:
      background-color var(--transition-normal),
      box-shadow var(--transition-normal);
  }

  .order-summary h3 {
    margin: 0 0 1rem 0;
    color: var(--color-text-primary);
    transition: color var(--transition-normal);
  }

  .summary-items {
    margin-bottom: 1rem;
  }

  .summary-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--color-border-primary);
    transition: border-color var(--transition-normal);
  }

  .summary-item:last-child {
    border-bottom: none;
  }

  .summary-item img {
    width: 50px;
    height: 50px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .item-info {
    flex: 1;
    min-width: 0;
  }

  .item-info h4 {
    margin: 0 0 0.25rem 0;
    color: var(--color-text-primary);
    font-size: 0.9rem;
    transition: color var(--transition-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-info p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 0.8rem;
    transition: color var(--transition-normal);
  }

  .item-equipment-values {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin-top: 0.25rem;
  }

  .equipment-value {
    color: var(--color-text-tertiary);
    font-size: 0.75rem;
  }

  .item-price {
    color: var(--color-text-primary);
    font-weight: 500;
    transition: color var(--transition-normal);
    white-space: nowrap;
  }

  .summary-totals {
    border-top: 2px solid var(--color-border-primary);
    padding-top: 1rem;
    transition: border-color var(--transition-normal);
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    color: var(--color-text-secondary);
    transition: color var(--transition-normal);
  }

  .total-row.shipping-group-row {
    font-size: 0.875rem;
    padding-left: 0.5rem;
    color: var(--color-text-tertiary);
  }

  .total-row.final-total {
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--color-text-primary);
    border-top: 1px solid var(--color-border-primary);
    padding-top: 0.5rem;
    margin-top: 0.5rem;
    transition:
      color var(--transition-normal),
      border-color var(--transition-normal);
  }

  @media (max-width: 768px) {
    .checkout-container {
      padding: 0 0.5rem;
      margin: 1rem auto;
    }

    .checkout-header {
      flex-direction: column;
      gap: 0.5rem;
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .checkout-header h1 {
      font-size: 1.5rem;
    }

    .checkout-content {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .checkout-main {
      padding: 1.25rem;
    }

    .checkout-steps {
      margin-bottom: 1.5rem;
    }

    .step-label {
      font-size: 0.85rem;
    }

    .step-number {
      width: 28px;
      height: 28px;
      font-size: 0.85rem;
    }

    .step-connector {
      margin: 0 0.5rem;
      min-width: 10px;
    }

    .step-navigation {
      flex-direction: column-reverse;
      gap: 0.75rem;
    }

    .step-navigation :global(button) {
      width: 100%;
    }

    .order-summary {
      padding: 1rem;
    }

    .order-summary h3 {
      font-size: 1.1rem;
    }

    .summary-item {
      padding: 0.5rem 0;
    }

    .summary-item img {
      width: 40px;
      height: 40px;
    }

    .item-info h4 {
      font-size: 0.85rem;
    }

    .item-info p {
      font-size: 0.75rem;
    }

    .item-price {
      font-size: 0.9rem;
    }
  }

  @media (max-width: 480px) {
    .checkout-main {
      padding: 1rem;
    }

    .step-label {
      display: none;
    }

    .step {
      justify-content: center;
    }

    .step-connector {
      margin: 0 0.25rem;
    }
  }
</style>
