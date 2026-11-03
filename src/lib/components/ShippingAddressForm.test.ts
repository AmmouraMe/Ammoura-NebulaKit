import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ShippingAddressForm from './ShippingAddressForm.svelte';
import { checkoutStore } from '$lib/stores/checkout';

function setCountry(country: string) {
  const shippingAddress = get(checkoutStore).formData.shippingAddress;
  checkoutStore.updateFormData({ shippingAddress: { ...shippingAddress, country } });
}

function labelFor(container: HTMLElement, id: string): string {
  return container.querySelector(`label[for="${id}"]`)?.textContent?.trim() ?? '';
}

describe('ShippingAddressForm', () => {
  beforeEach(() => setCountry('US'));

  it('asks a US customer for a state and a ZIP code, both required', () => {
    const { container } = render(ShippingAddressForm);
    expect(labelFor(container, 'state')).toBe('State *');
    expect(labelFor(container, 'zipCode')).toBe('ZIP code *');
  });

  it('asks a UK customer for a postcode, and makes the region optional', () => {
    setCountry('GB');
    const { container } = render(ShippingAddressForm);
    expect(labelFor(container, 'state')).toBe('State / region');
    expect(labelFor(container, 'zipCode')).toBe('Postal code *');
  });

  it('marks nothing required for a Hong Kong address', () => {
    setCountry('HK');
    const { container } = render(ShippingAddressForm);
    expect(labelFor(container, 'zipCode')).toBe('Postal code');
  });
});
