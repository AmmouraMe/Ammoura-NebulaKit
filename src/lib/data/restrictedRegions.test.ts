import { describe, it, expect } from 'vitest';
import {
  isRestrictedAddress,
  isRestrictedCountry,
  isRestrictedLocation,
  RESTRICTED_COUNTRY_CODES
} from './restrictedRegions';
import { isCountryCode } from './countries';

describe('restricted regions', () => {
  it('names only real country codes', () => {
    for (const code of RESTRICTED_COUNTRY_CODES) expect(isCountryCode(code)).toBe(true);
  });

  it('blocks whole countries, in any case', () => {
    expect(isRestrictedCountry('KP')).toBe(true);
    expect(isRestrictedCountry('cu')).toBe(true);
    expect(isRestrictedCountry('US')).toBe(false);
    expect(isRestrictedCountry(null)).toBe(false);
  });

  it('reads Cloudflare short region codes and full ones', () => {
    expect(isRestrictedLocation('UA', '43')).toBe(true);
    expect(isRestrictedLocation('UA', 'UA-09')).toBe(true);
    expect(isRestrictedLocation('UA', '30')).toBe(false);
    expect(isRestrictedLocation('UA', null)).toBe(false);
    // A region code means nothing without its own country.
    expect(isRestrictedLocation('US', '43')).toBe(false);
  });

  it('finds an occupied region in an address state field by name', () => {
    expect(isRestrictedAddress('UA', 'Crimea')).toBe(true);
    expect(isRestrictedAddress('UA', 'Donetsk Oblast')).toBe(true);
    expect(isRestrictedAddress('UA', 'Luganskaya')).toBe(true);
    expect(isRestrictedAddress('UA', 'Севастополь')).toBe(true);
    expect(isRestrictedAddress('UA', 'UA-14')).toBe(true);
    expect(isRestrictedAddress('UA', 'Kyiv')).toBe(false);
    expect(isRestrictedAddress('UA', '')).toBe(false);
  });

  it('does not read other countries’ states as occupied regions', () => {
    expect(isRestrictedAddress('US', 'Crimea')).toBe(false);
    expect(isRestrictedAddress('IR', '')).toBe(true);
  });
});
