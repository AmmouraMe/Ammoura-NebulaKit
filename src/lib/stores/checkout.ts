import { writable, type Writable } from 'svelte/store';
import type { CheckoutFormData, CheckoutValidationErrors } from '../types/checkout';
import type { AvailableShippingOption } from '../types/shipping';
import { validateCheckoutForm } from '../utils/checkoutValidation';
import {
  groupCartItemsByShipping,
  calculateTotalShippingCost,
  validateShippingSelections,
  type ShippingGroup
} from '../utils/shippingGroups';
import type { CartItem } from '../types';

type SubmitOrderItem = Pick<CartItem, 'id' | 'name' | 'price' | 'quantity' | 'image'> &
  Partial<Pick<CartItem, 'equipmentValues' | 'variantId' | 'customizations' | 'fieldValues'>>;

// Initial form data
const initialFormData: CheckoutFormData = {
  shippingAddress: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US'
  },
  billingAddress: {
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US'
  },
  paymentMethod: {
    type: 'credit-card',
    cardNumber: '',
    cardHolderName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: ''
  },
  sameAsShipping: true,
  selectedShippingOptionId: null,
  selectedShippingOptions: {}
};

// Checkout state
interface CheckoutState {
  formData: CheckoutFormData;
  currentStep: number;
  isSubmitting: boolean;
  validationErrors: CheckoutValidationErrors;
  availableShippingOptions: AvailableShippingOption[];
  loadingShippingOptions: boolean;
  shippingGroups: ShippingGroup[];
  shippingGroupsLoaded: boolean;
}

const checkoutState: Writable<CheckoutState> = writable({
  formData: { ...initialFormData },
  currentStep: 1,
  isSubmitting: false,
  validationErrors: {},
  availableShippingOptions: [],
  loadingShippingOptions: false,
  shippingGroups: [],
  shippingGroupsLoaded: false
});

// Store functions
function updateFormData(data: Partial<CheckoutFormData>): void {
  checkoutState.update((state) => ({
    ...state,
    formData: { ...state.formData, ...data }
  }));
}

function setSameAsShipping(same: boolean): void {
  checkoutState.update((state) => ({
    ...state,
    formData: { ...state.formData, sameAsShipping: same }
  }));
}

function validateForm(): CheckoutValidationErrors {
  let errors: CheckoutValidationErrors = {};

  checkoutState.update((state) => {
    const validationErrors = validateCheckoutForm(state.formData);
    errors = validationErrors;
    return { ...state, validationErrors };
  });

  return errors;
}

async function submitOrder(
  cartItems: SubmitOrderItem[],
  subtotal: number,
  shippingCost: number,
  tax: number,
  total: number
): Promise<{ success: boolean; url?: string; error?: string }> {
  checkoutState.update((state) => ({ ...state, isSubmitting: true }));

  try {
    // Validate the form first
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      checkoutState.update((state) => ({ ...state, isSubmitting: false }));
      return { success: false, error: 'Please fix the validation errors' };
    }

    // Get current state synchronously
    let currentState: CheckoutState = {
      formData: { ...initialFormData },
      currentStep: 1,
      isSubmitting: false,
      validationErrors: {},
      availableShippingOptions: [],
      loadingShippingOptions: false,
      shippingGroups: [],
      shippingGroupsLoaded: false
    };

    const unsubscribe = checkoutState.subscribe((state) => {
      currentState = state;
    });
    unsubscribe();

    // Prepare order data
    // Validate shipping options for all groups
    const shippingErrors = validateShippingSelections(
      currentState.shippingGroups,
      currentState.formData.selectedShippingOptions
    );

    if (Object.keys(shippingErrors).length > 0) {
      checkoutState.update((state) => ({
        ...state,
        isSubmitting: false,
        validationErrors: {
          ...state.validationErrors,
          shippingOptions: shippingErrors
        }
      }));
      return { success: false, error: 'Please select shipping options for all groups' };
    }

    // Build shipping details from groups
    const shippingDetails = {
      groups: currentState.shippingGroups
        .filter((group) => !group.isFree)
        .map((group) => {
          const selectedOptionId = currentState.formData.selectedShippingOptions[group.id];
          const selectedOption = group.shippingOptions.find((opt) => opt.id === selectedOptionId);

          return {
            id: group.id,
            shippingOptionId: selectedOptionId || '',
            shippingOptionName: selectedOption?.name || '',
            shippingCost: selectedOption?.price || 0,
            products: group.products.map((product) => ({
              id: product.id,
              name: product.name,
              quantity: product.quantity
            }))
          };
        })
    };

    const orderData = {
      items: cartItems.map((item) => ({
        product_id: item.id,
        variant_id: item.variantId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        equipment_values: item.equipmentValues || [],
        customizations: (item.customizations || []).map((c) => ({
          zoneId: c.zoneId,
          zoneName: c.zoneName,
          // The design itself. The fields under it describe its first image
          // element in the older single-upload terms, which is what the
          // legacy order columns still hold.
          elements: c.elements ?? [],
          designId: c.designId ?? null,
          designRevision: c.designRevision ?? 1,
          imageUrl: c.imageDataUrl,
          mediaId: c.mediaId ?? null,
          originalFilename: c.originalFilename,
          offsetXPercent: c.offsetXPercent,
          offsetYPercent: c.offsetYPercent,
          scale: c.scale,
          rotation: c.rotation ?? 0
        })),
        field_values: (item.fieldValues || []).map((f) => ({
          fieldId: f.fieldId,
          fieldName: f.fieldName,
          fieldType: f.fieldType,
          value: f.value,
          priceModifier: f.priceModifier
        }))
      })),
      subtotal,
      shipping_cost: shippingCost,
      tax,
      total,
      shipping_address: currentState.formData.shippingAddress,
      billing_address: currentState.formData.sameAsShipping
        ? copyShippingToBilling(currentState.formData.shippingAddress)
        : currentState.formData.billingAddress,
      shipping_details: shippingDetails
    };

    // Create the order (unpaid) and a Stripe Checkout Session for it
    const response = await fetch('/api/checkout/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    const result = (await response.json()) as {
      success: boolean;
      url?: string;
      orderId?: string;
      error?: string;
    };

    if (!response.ok || !result.success || !result.url) {
      checkoutState.update((state) => ({ ...state, isSubmitting: false }));
      return { success: false, error: result.error || 'Failed to start checkout' };
    }

    checkoutState.update((state) => ({
      ...state,
      isSubmitting: false
    }));

    return { success: true, url: result.url };
  } catch (error) {
    checkoutState.update((state) => ({
      ...state,
      isSubmitting: false
    }));

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process order'
    };
  }
}

function reset(): void {
  checkoutState.set({
    formData: { ...initialFormData },
    currentStep: 1,
    isSubmitting: false,
    validationErrors: {},
    availableShippingOptions: [],
    loadingShippingOptions: false,
    shippingGroups: [],
    shippingGroupsLoaded: false
  });
}

function getCurrentStep(): number {
  let currentStep = 1;
  checkoutState.subscribe((state) => {
    currentStep = state.currentStep;
  })();
  return currentStep;
}

function setCurrentStep(step: number): void {
  checkoutState.update((state) => ({ ...state, currentStep: step }));
}

function setSelectedShippingOption(optionId: string | null): void {
  checkoutState.update((state) => ({
    ...state,
    formData: { ...state.formData, selectedShippingOptionId: optionId }
  }));
}

async function loadShippingOptions(
  cartItems: Array<{ id: string; type: 'physical' | 'digital' | 'service'; category?: string }>
): Promise<void> {
  checkoutState.update((state) => ({ ...state, loadingShippingOptions: true }));

  try {
    const response = await fetch('/api/checkout/shipping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartItems })
    });

    if (!response.ok) {
      throw new Error('Failed to load shipping options');
    }

    const data = (await response.json()) as {
      options: AvailableShippingOption[];
      hasPhysicalProducts: boolean;
    };

    checkoutState.update((state) => ({
      ...state,
      availableShippingOptions: data.options,
      loadingShippingOptions: false
    }));
  } catch (error) {
    console.error('Failed to load shipping options:', error);
    checkoutState.update((state) => ({
      ...state,
      availableShippingOptions: [],
      loadingShippingOptions: false
    }));
  }
}

async function loadShippingGroups(cartItems: CartItem[]): Promise<void> {
  checkoutState.update((state) => ({ ...state, loadingShippingOptions: true }));

  try {
    // Fetch shipping options for all products
    const response = await fetch('/api/checkout/shipping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartItems })
    });

    if (!response.ok) {
      throw new Error('Failed to load shipping options');
    }

    const data = (await response.json()) as {
      options: AvailableShippingOption[];
      hasPhysicalProducts: boolean;
      productOptions?: Record<string, AvailableShippingOption[]>;
    };

    // Create a map of product ID to shipping options
    const productShippingMap = new Map<string, AvailableShippingOption[]>();

    // If we have product-specific options from API, use them
    if (data.productOptions) {
      for (const [productId, options] of Object.entries(data.productOptions)) {
        productShippingMap.set(productId, options);
      }
    } else {
      // Fallback: use the same options for all physical products
      for (const item of cartItems) {
        if (item.type === 'physical') {
          productShippingMap.set(item.id, data.options);
        }
      }
    }

    // Group cart items by shared shipping options
    const groups = groupCartItemsByShipping(cartItems, productShippingMap);

    checkoutState.update((state) => ({
      ...state,
      shippingGroups: groups,
      shippingGroupsLoaded: true,
      loadingShippingOptions: false
    }));
  } catch (error) {
    console.error('Failed to load shipping groups:', error);
    checkoutState.update((state) => ({
      ...state,
      shippingGroups: [],
      shippingGroupsLoaded: false,
      loadingShippingOptions: false
    }));
  }
}

function setShippingOptionForGroup(groupId: string, optionId: string): void {
  checkoutState.update((state) => ({
    ...state,
    formData: {
      ...state.formData,
      selectedShippingOptions: {
        ...state.formData.selectedShippingOptions,
        [groupId]: optionId
      }
    }
  }));
}

function getTotalShippingCost(): number {
  let cost = 0;
  checkoutState.subscribe((state) => {
    cost = calculateTotalShippingCost(state.shippingGroups, state.formData.selectedShippingOptions);
  })();
  return cost;
}

// Export the store
export const checkoutStore = {
  subscribe: checkoutState.subscribe,
  updateFormData,
  setSameAsShipping,
  validateForm,
  submitOrder,
  reset,
  getCurrentStep,
  setCurrentStep,
  setSelectedShippingOption,
  loadShippingOptions,
  loadShippingGroups,
  setShippingOptionForGroup,
  getTotalShippingCost
};

// Helper function to copy shipping address to billing address
export function copyShippingToBilling(
  shippingAddress: CheckoutFormData['shippingAddress']
): CheckoutFormData['billingAddress'] {
  return {
    firstName: shippingAddress.firstName,
    lastName: shippingAddress.lastName,
    address: shippingAddress.address,
    city: shippingAddress.city,
    state: shippingAddress.state,
    zipCode: shippingAddress.zipCode,
    country: shippingAddress.country
  };
}
