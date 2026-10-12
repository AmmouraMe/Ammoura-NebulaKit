import { describe, it, expect } from 'vitest';
import { sanitizeCapabilities } from './sanitizeCapabilities';
import { EQUIPMENT_CATALOG } from '$lib/data/equipmentCatalog';

describe('sanitizeCapabilities', () => {
  it('passes every catalog entry through unchanged', () => {
    for (const entry of EQUIPMENT_CATALOG) {
      expect(sanitizeCapabilities(entry.capabilities), entry.id).toEqual(entry.capabilities);
    }
  });

  it('rejects a missing or unknown kind', () => {
    expect(sanitizeCapabilities(null)).toBeNull();
    expect(sanitizeCapabilities({ substrates: [] })).toBeNull();
    expect(sanitizeCapabilities({ kind: 'toaster', substrates: [] })).toBeNull();
  });

  it('drops unknown keys, bad numbers and unknown substrates', () => {
    const out = sanitizeCapabilities({
      kind: 'heat-press',
      substrates: ['cotton', 'plutonium', 'cotton'],
      maxAreaIn: { widthIn: 15, heightIn: -2 },
      maxDpi: 1e9,
      evil: '<script>',
      maxColors: 2.5
    });
    expect(out).toEqual({ kind: 'heat-press', substrates: ['cotton'] });
  });

  it('keeps valid sizes, drops broken and duplicate ones', () => {
    const out = sanitizeCapabilities({
      kind: 'button-press',
      substrates: ['button'],
      sizes: [
        { id: 'round-1', label: '1"', shape: 'round', widthIn: 1, heightIn: 1 },
        { id: 'round-1', label: 'dupe', shape: 'round', widthIn: 1, heightIn: 1 },
        { id: 'BAD ID', label: 'x', shape: 'round', widthIn: 1, heightIn: 1 },
        { id: 'tri', label: 'x', shape: 'triangle', widthIn: 1, heightIn: 1 }
      ]
    });
    expect(out?.sizes).toEqual([
      { id: 'round-1', label: '1"', shape: 'round', widthIn: 1, heightIn: 1 }
    ]);
  });
});
