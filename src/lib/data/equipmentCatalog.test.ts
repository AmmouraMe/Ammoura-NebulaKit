import { describe, it, expect } from 'vitest';
import {
  EQUIPMENT_CATALOG,
  KIND_DEFAULTS,
  KIND_LABELS,
  getCatalogModel,
  searchCatalog,
  catalogKinds,
  cloneCapabilities
} from './equipmentCatalog';

describe('equipment catalog', () => {
  it('has unique ids', () => {
    const ids = EQUIPMENT_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers a wide range of kinds', () => {
    expect(catalogKinds().length).toBeGreaterThanOrEqual(15);
  });

  it('gives every model a usable shape for its kind', () => {
    for (const entry of EQUIPMENT_CATALOG) {
      const c = entry.capabilities;
      expect(KIND_LABELS[c.kind], entry.id).toBeTruthy();
      expect(c.substrates.length, entry.id).toBeGreaterThan(0);
      const hasMeasure =
        !!c.maxAreaIn || !!c.maxMediaWidthIn || !!c.buildVolumeIn || (c.sizes?.length ?? 0) > 0;
      expect(hasMeasure, `${entry.id} has no area, width, volume or sizes`).toBe(true);
      for (const size of c.sizes ?? []) {
        expect(size.widthIn).toBeGreaterThan(0);
        if (size.artworkWidthIn) expect(size.artworkWidthIn).toBeGreaterThan(size.widthIn);
      }
    }
  });

  it('has a default for every kind', () => {
    for (const kind of Object.keys(KIND_LABELS)) {
      expect(KIND_DEFAULTS[kind as keyof typeof KIND_DEFAULTS].kind).toBe(kind);
    }
  });

  it('finds models by id', () => {
    expect(getCatalogModel('epson-surecolor-f2100')?.make).toBe('Epson');
    expect(getCatalogModel('nope')).toBeNull();
    expect(getCatalogModel(null)).toBeNull();
  });

  it('searches make, model and kind, every word must match', () => {
    expect(searchCatalog('cricut maker').map((e) => e.id)).toContain('cricut-maker-3');
    expect(searchCatalog('button').every((e) => e.capabilities.kind === 'button-press')).toBe(true);
    expect(searchCatalog('', 'heat-press').length).toBeGreaterThan(3);
    expect(searchCatalog('zzz-not-a-printer')).toEqual([]);
  });

  it('clones deeply', () => {
    const model = getCatalogModel('abm-model-1')!;
    const copy = cloneCapabilities(model.capabilities);
    copy.sizes!.pop();
    expect(model.capabilities.sizes!.length).toBeGreaterThan(copy.sizes!.length);
  });
});
