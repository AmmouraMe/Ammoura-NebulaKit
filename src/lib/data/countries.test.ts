import { describe, it, expect } from 'vitest';
import {
  COUNTRIES,
  COMMON_COUNTRIES,
  COMMON_COUNTRY_CODES,
  countryName,
  isCountryCode,
  isPostalCode,
  POSTCODE_FREE_COUNTRY_CODES,
  postalCodeRequired,
  regionRequired,
  REGION_REQUIRED_COUNTRY_CODES,
  toCountryCode
} from './countries';

describe('countries', () => {
  it('covers the world, not six options', () => {
    expect(COUNTRIES.length).toBeGreaterThan(240);
  });

  it('has no duplicate code and no duplicate name', () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c.name)).size).toBe(COUNTRIES.length);
  });

  it('holds uppercase two-letter codes and non-empty names', () => {
    for (const country of COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('is sorted by name', () => {
    const names = COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('excludes deprecated aliases that would duplicate a live country', () => {
    for (const dead of ['UK', 'AN', 'ZR', 'BU', 'SU', 'YU', 'TP', 'DD']) {
      expect(isCountryCode(dead)).toBe(false);
    }
  });

  it('resolves every common code', () => {
    expect(COMMON_COUNTRIES.map((c) => c.code)).toEqual([...COMMON_COUNTRY_CODES]);
  });

  describe('toCountryCode', () => {
    it('passes a code through, in any case', () => {
      expect(toCountryCode('US')).toBe('US');
      expect(toCountryCode('de')).toBe('DE');
      expect(toCountryCode(' gb ')).toBe('GB');
    });

    it('accepts the names older orders stored', () => {
      expect(toCountryCode('United States')).toBe('US');
      expect(toCountryCode('Canada')).toBe('CA');
      expect(toCountryCode('United Kingdom')).toBe('GB');
      expect(toCountryCode('Australia')).toBe('AU');
      expect(toCountryCode('Germany')).toBe('DE');
      expect(toCountryCode('France')).toBe('FR');
    });

    it('accepts common spellings that are not the CLDR name', () => {
      expect(toCountryCode('USA')).toBe('US');
      expect(toCountryCode('Czech Republic')).toBe('CZ');
      expect(toCountryCode('Turkey')).toBe('TR');
      expect(toCountryCode('Ivory Coast')).toBe('CI');
      expect(toCountryCode('South Korea')).toBe('KR');
    });

    it('refuses "Other", the value the old form offered', () => {
      expect(toCountryCode('Other')).toBeNull();
    });

    it('refuses blanks and nonsense', () => {
      expect(toCountryCode('')).toBeNull();
      expect(toCountryCode('   ')).toBeNull();
      expect(toCountryCode('Freedonia')).toBeNull();
      expect(toCountryCode('ZZ')).toBeNull();
    });
  });

  describe('countryName', () => {
    it('names a code', () => {
      expect(countryName('US')).toBe('United States');
      expect(countryName('jp')).toBe('Japan');
    });

    it('shows an unknown value rather than losing it', () => {
      expect(countryName('Other')).toBe('Other');
    });
  });

  it('lists only real countries as having no postal code or needing a region', () => {
    for (const code of [...POSTCODE_FREE_COUNTRY_CODES, ...REGION_REQUIRED_COUNTRY_CODES]) {
      expect(isCountryCode(code)).toBe(true);
    }
  });

  it('knows where a postal code or a region is required, by code or by name', () => {
    expect(postalCodeRequired('United States')).toBe(true);
    expect(postalCodeRequired('HK')).toBe(false);
    expect(regionRequired('Canada')).toBe(true);
    expect(regionRequired('GB')).toBe(false);
  });

  it('checks US and Canadian postal codes by their shape, others loosely', () => {
    expect(isPostalCode('10001', 'US')).toBe(true);
    expect(isPostalCode('SW1A 1AA', 'US')).toBe(false);
    expect(isPostalCode('K1A 0B1', 'CA')).toBe(true);
    expect(isPostalCode('SW1A 1AA', 'GB')).toBe(true);
    expect(isPostalCode('75008', 'FR')).toBe(true);
    expect(isPostalCode('1', 'DE')).toBe(false);
  });
});
