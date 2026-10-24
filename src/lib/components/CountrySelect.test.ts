import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CountrySelect from './CountrySelect.svelte';
import { COUNTRIES, COMMON_COUNTRY_CODES } from '$lib/data/countries';
import { RESTRICTED_COUNTRY_CODES } from '$lib/data/restrictedRegions';

function options(container: HTMLElement) {
  return Array.from(container.querySelectorAll('option'));
}

describe('CountrySelect', () => {
  it('offers every country we serve, plus the common ones repeated at the top', () => {
    const { container } = render(CountrySelect, { props: { id: 'c', value: 'US' } });
    expect(options(container)).toHaveLength(
      COUNTRIES.length - RESTRICTED_COUNTRY_CODES.length + COMMON_COUNTRY_CODES.length
    );
  });

  it('does not offer the countries under US sanctions', () => {
    const { container } = render(CountrySelect, { props: { id: 'c', value: 'US' } });
    const values = options(container).map((o) => o.value);
    for (const code of RESTRICTED_COUNTRY_CODES) expect(values).not.toContain(code);
  });

  it('never offers "Other", which took money for an order nobody could ship', () => {
    const { container } = render(CountrySelect, { props: { id: 'c', value: 'US' } });
    const values = options(container).map((o) => o.value);
    expect(values).not.toContain('Other');
    for (const value of values) expect(value).toMatch(/^[A-Z]{2}$/);
  });

  it('reaches the countries the old six-option list left out', () => {
    const { container } = render(CountrySelect, { props: { id: 'c', value: 'US' } });
    const values = options(container).map((o) => o.value);
    for (const code of ['JP', 'BR', 'IN', 'NG', 'NZ', 'ZA', 'MX']) {
      expect(values).toContain(code);
    }
  });

  it('shows the selected code', () => {
    const { container } = render(CountrySelect, { props: { id: 'c', value: 'JP' } });
    expect(container.querySelector('select')?.value).toBe('JP');
  });

  it('hands the chosen code back as a code', async () => {
    const onChange = vi.fn();
    const { container } = render(CountrySelect, {
      props: { id: 'c', value: 'US', onChange }
    });
    const select = container.querySelector('select') as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: 'BR' } });
    expect(onChange).toHaveBeenCalledWith('BR');
  });

  it('can be disabled', () => {
    const { container } = render(CountrySelect, {
      props: { id: 'c', value: 'US', disabled: true }
    });
    expect(container.querySelector('select')?.disabled).toBe(true);
  });

  it('marks an error so the form styling reaches it', () => {
    const { container } = render(CountrySelect, {
      props: { id: 'c', value: 'US', hasError: true }
    });
    expect(container.querySelector('select')?.classList.contains('error')).toBe(true);
  });
});
