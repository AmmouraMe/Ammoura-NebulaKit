import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));

import Page from './+page.svelte';

const deadRelay = {
  id: 'relay-1',
  orderId: 'order-1',
  providerType: 'printful',
  status: 'dead_lettered',
  attempts: 8,
  maxAttempts: 8,
  nextAttemptAt: null,
  lastAttemptAt: 2000,
  failureKind: 'permanent',
  lastError: 'Shipping country "Other" is not a country',
  lastResponse: null,
  externalOrderId: null,
  createdAt: 1000,
  orderTotal: 42.5,
  customerEmail: 'john@example.com',
  shippingAddress: {
    firstName: 'John',
    lastName: 'Doe',
    phone: '',
    address: '1 Old Road',
    city: 'Leeds',
    state: '',
    zipCode: 'LS1 1AA',
    country: 'Other'
  }
};

function renderPage(relays: unknown[]) {
  return render(Page, {
    props: {
      data: { relays, recentlyFulfilled: [], untrackedOrders: [] },
      form: null
    } as never
  });
}

describe('/admin/orders/fulfillment page', () => {
  it('opens an address editor on a dead-lettered order, prefilled from the order', async () => {
    const { getByText, container } = renderPage([deadRelay]);

    await fireEvent.click(getByText('Edit address'));

    const form = container.querySelector('form[action="?/updateAddress"]');
    expect(form).not.toBeNull();
    expect((form!.querySelector('input[name="address"]') as HTMLInputElement).value).toBe(
      '1 Old Road'
    );
    expect(form!.querySelector('select[name="country"]')).not.toBeNull();
    expect(form!.textContent).toContain('Stored as “Other”');
  });

  it('offers no address editor on a relay still retrying', () => {
    const { queryByText } = renderPage([
      { ...deadRelay, status: 'pending', shippingAddress: null }
    ]);

    expect(queryByText('Edit address')).toBeNull();
  });
});
