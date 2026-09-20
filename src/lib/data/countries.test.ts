import { describe, it, expect } from 'vitest';
import {
  COUNTRIES,
  COMMON_COUNTRIES,
  COMMON_COUNTRY_CODES,
  countryName,
  isCountryCode,
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
});
