<script lang="ts">
  import { enhance } from '$app/forms';
  import { toastStore } from '$lib/stores/toast';
  import CountrySelect from '$lib/components/CountrySelect.svelte';
  import { toCountryCode } from '$lib/data/countries';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  let busyKey: string | null = null;
  let expanded: Record<string, boolean> = {};
  let editingAddress: Record<string, boolean> = {};

  $: relays = data.relays;
  $: recentlyFulfilled = data.recentlyFulfilled;
  $: untrackedOrders = data.untrackedOrders;
  $: stuckCount = relays.length + untrackedOrders.length;

  // Actions report through the toast store, the same as the rest of admin.
  $: if (form?.message) {
    if (form.success) {
      toastStore.success(form.message);
    } else {
      toastStore.error(form.message);
    }
  }

  function formatDate(seconds: number | null): string {
    if (!seconds) return '—';
    return new Date(seconds * 1000).toLocaleString();
  }

  function formatMoney(total: number | null): string {
    if (total === null) return '—';
    return `$${total.toFixed(2)}`;
  }

  function statusLabel(status: string, failureKind: string | null): string {
    if (status === 'dead_lettered') {
      return failureKind === 'permanent' ? 'Needs a fix' : 'Gave up';
    }
    if (status === 'succeeded') return 'Fulfilled';
    return 'Retrying';
  }

  function toggle(id: string): void {
    expanded = { ...expanded, [id]: !expanded[id] };
  }

  function toggleAddress(id: string): void {
    editingAddress = { ...editingAddress, [id]: !editingAddress[id] };
  }

  function submitting(key: string) {
    busyKey = key;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      busyKey = null;
    };
  }

  // Close the editor once its address is saved; a failed save keeps it open.
  function savingAddress(relayId: string) {
    busyKey = `address-${relayId}`;
    return async ({
      result,
      update
    }: {
      result: { type: string };
      update: (opts?: { reset?: boolean }) => Promise<void>;
    }) => {
      await update({ reset: false });
      if (result.type === 'success') {
        editingAddress = { ...editingAddress, [relayId]: false };
      }
      busyKey = null;
    };
  }
</script>

<svelte:head>
  <title>Fulfillment | Admin</title>
</svelte:head>

<div class="fulfillment-page">
  <div class="page-header">
    <div>
      <h1>Fulfillment</h1>
      <p>Paid orders and whether the print provider actually has them.</p>
    </div>
    <div class="summary" class:clear={stuckCount === 0}>
      {#if stuckCount === 0}
        <span class="summary-count">All clear</span>
        <span class="summary-label">every paid order has reached its provider</span>
      {:else}
        <span class="summary-count">{stuckCount}</span>
        <span class="summary-label">{stuckCount === 1 ? 'order' : 'orders'} not yet fulfilled</span>
      {/if}
    </div>
  </div>

  {#if untrackedOrders.length > 0}
    <section class="panel warning">
      <h2>Paid, never sent</h2>
      <p class="panel-note">
        These orders have print-fulfilled items but no relay record at all — they were paid before
        the relay was tracked, or something wrote the order without relaying it. Send them now.
      </p>
      <ul class="untracked-list">
        {#each untrackedOrders as order (order.id)}
          <li>
            <div class="untracked-order">
              <a href="/admin/orders/{order.id}">Order {order.id}</a>
              <span class="muted">{formatMoney(order.total)} · {formatDate(order.createdAt)}</span>
            </div>
            <form
              method="POST"
              action="?/relayOrder"
              use:enhance={() => submitting(`untracked-${order.id}`)}
            >
              <input type="hidden" name="orderId" value={order.id} />
              <button
                class="retry-btn"
                type="submit"
                disabled={busyKey === `untracked-${order.id}`}
              >
                {busyKey === `untracked-${order.id}` ? 'Sending…' : 'Send to Printful'}
              </button>
            </form>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="panel">
    <h2>In flight and failed</h2>
    {#if relays.length === 0}
      <p class="empty">Nothing is waiting. Every relay has either succeeded or not been needed.</p>
    {:else}
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Next try</th>
              <th>Last error</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each relays as relay (relay.id)}
              <tr class:dead={relay.status === 'dead_lettered'}>
                <td>
                  <a href="/admin/orders/{relay.orderId}">{relay.orderId}</a>
                  <div class="muted">
                    {formatMoney(relay.orderTotal)}
                    {#if relay.customerEmail}· {relay.customerEmail}{/if}
                  </div>
                </td>
                <td>
                  <span class="badge {relay.status}">
                    {statusLabel(relay.status, relay.failureKind)}
                  </span>
                </td>
                <td>{relay.attempts} / {relay.maxAttempts}</td>
                <td>{relay.status === 'pending' ? formatDate(relay.nextAttemptAt) : '—'}</td>
                <td class="error-cell">
                  <span class="error-text">{relay.lastError ?? 'No error recorded yet.'}</span>
                  {#if relay.lastResponse}
                    <button class="link-btn" type="button" on:click={() => toggle(relay.id)}>
                      {expanded[relay.id] ? 'Hide' : 'Show'} provider response
                    </button>
                    {#if expanded[relay.id]}
                      <pre>{relay.lastResponse}</pre>
                    {/if}
                  {/if}
                </td>
                <td>
                  <form
                    method="POST"
                    action="?/retry"
                    use:enhance={() => submitting(`relay-${relay.id}`)}
                  >
                    <input type="hidden" name="relayId" value={relay.id} />
                    <input type="hidden" name="orderId" value={relay.orderId} />
                    <button
                      class="retry-btn"
                      type="submit"
                      disabled={busyKey === `relay-${relay.id}`}
                    >
                      {busyKey === `relay-${relay.id}` ? 'Retrying…' : 'Retry now'}
                    </button>
                  </form>
                  {#if relay.shippingAddress}
                    <button class="link-btn" type="button" on:click={() => toggleAddress(relay.id)}>
                      {editingAddress[relay.id] ? 'Cancel' : 'Edit address'}
                    </button>
                  {/if}
                </td>
              </tr>
              {#if relay.shippingAddress && editingAddress[relay.id]}
                {@const addr = relay.shippingAddress}
                <tr class="address-row">
                  <td colspan="6">
                    <form
                      class="address-form"
                      method="POST"
                      action="?/updateAddress"
                      use:enhance={() => savingAddress(relay.id)}
                    >
                      <input type="hidden" name="relayId" value={relay.id} />
                      <input type="hidden" name="orderId" value={relay.orderId} />
                      <p class="panel-note">
                        Shipping address on order {relay.orderId}. Saving does not send it — press
                        Retry now afterwards.
                      </p>
                      <div class="address-grid">
                        <label>
                          First name
                          <input name="firstName" value={addr.firstName} />
                        </label>
                        <label>
                          Last name
                          <input name="lastName" value={addr.lastName} />
                        </label>
                        <label class="wide">
                          Street address
                          <input name="address" value={addr.address} required />
                        </label>
                        <label>
                          City
                          <input name="city" value={addr.city} required />
                        </label>
                        <label>
                          State / region
                          <input name="state" value={addr.state} />
                        </label>
                        <label>
                          Postal code
                          <input name="zipCode" value={addr.zipCode} required />
                        </label>
                        <label for="country-{relay.id}">
                          Country
                          <CountrySelect
                            id="country-{relay.id}"
                            name="country"
                            value={toCountryCode(addr.country) ?? ''}
                          />
                          {#if addr.country && !toCountryCode(addr.country)}
                            <span class="muted"
                              >Stored as “{addr.country}”, which is not a country.</span
                            >
                          {/if}
                        </label>
                        <label>
                          Phone
                          <input name="phone" value={addr.phone} />
                        </label>
                      </div>
                      <button
                        class="retry-btn"
                        type="submit"
                        disabled={busyKey === `address-${relay.id}`}
                      >
                        {busyKey === `address-${relay.id}` ? 'Saving…' : 'Save address'}
                      </button>
                    </form>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  {#if recentlyFulfilled.length > 0}
    <section class="panel">
      <h2>Recently fulfilled</h2>
      <ul class="fulfilled-list">
        {#each recentlyFulfilled as relay (relay.id)}
          <li>
            <a href="/admin/orders/{relay.orderId}">Order {relay.orderId}</a>
            <span class="muted">
              Printful order {relay.externalOrderId ?? '—'} · {relay.attempts}
              {relay.attempts === 1 ? 'attempt' : 'attempts'} · {formatDate(relay.lastAttemptAt)}
            </span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .fulfillment-page {
    width: 100%;
    padding: 2rem 1rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid var(--color-border-secondary);
    flex-wrap: wrap;
    gap: 1rem;
  }

  h1 {
    color: var(--color-text-primary);
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 0.25rem 0;
    letter-spacing: -0.5px;
  }

  .page-header p {
    color: var(--color-text-secondary);
    margin: 0;
    font-size: 1rem;
  }

  .summary {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
  }

  .summary-count {
    font-size: 1.75rem;
    font-weight: 700;
    color: #b91c1c;
  }

  .summary.clear .summary-count {
    font-size: 1.25rem;
    color: #15803d;
  }

  .summary-label {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .panel {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: 10px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .panel.warning {
    border-color: #f59e0b;
  }

  .panel h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: var(--color-text-primary);
  }

  .panel-note {
    margin: 0 0 1rem 0;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }

  .empty {
    color: var(--color-text-secondary);
    margin: 0;
  }

  .table-scroll {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    color: var(--color-text-secondary);
    font-weight: 600;
    border-bottom: 1px solid var(--color-border-primary);
    white-space: nowrap;
  }

  td {
    padding: 0.75rem;
    vertical-align: top;
    border-bottom: 1px solid var(--color-border-secondary);
    color: var(--color-text-primary);
  }

  tr.dead td {
    background: rgba(185, 28, 28, 0.06);
  }

  .badge {
    display: inline-block;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .badge.pending {
    background: #fef3c7;
    color: #92400e;
  }

  .badge.dead_lettered {
    background: #fee2e2;
    color: #991b1b;
  }

  .badge.succeeded {
    background: #dcfce7;
    color: #166534;
  }

  .error-cell {
    max-width: 26rem;
  }

  .error-text {
    display: block;
    word-break: break-word;
  }

  pre {
    margin: 0.5rem 0 0 0;
    padding: 0.5rem;
    background: var(--color-bg-tertiary);
    border-radius: 6px;
    font-size: 0.75rem;
    max-height: 12rem;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .muted {
    color: var(--color-text-secondary);
    font-size: 0.8rem;
  }

  .link-btn {
    background: none;
    border: none;
    padding: 0;
    margin-top: 0.35rem;
    color: var(--color-primary);
    font-size: 0.8rem;
    cursor: pointer;
    text-decoration: underline;
  }

  .retry-btn {
    padding: 0.45rem 0.9rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .retry-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .address-row td {
    background: var(--color-bg-tertiary);
  }

  .address-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .address-grid label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .address-grid label.wide {
    grid-column: 1 / -1;
  }

  .address-grid input,
  .address-grid :global(select) {
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--color-border-primary);
    border-radius: 6px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-size: 0.9rem;
    font-weight: 400;
  }

  .untracked-list,
  .fulfilled-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .untracked-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .untracked-order {
    display: flex;
    flex-direction: column;
  }

  .fulfilled-list li {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    flex-wrap: wrap;
  }

  a {
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 600;
  }

  a:hover {
    text-decoration: underline;
  }

  @media (max-width: 640px) {
    h1 {
      font-size: 1.85rem;
    }

    .page-header {
      align-items: flex-start;
    }
  }
</style>
