import { describe, it, expect } from 'vitest';
import {
  inferProductFamily,
  checkProductFit,
  guessSizeFromName,
  workflowGaps,
  rankMachines,
  describeCapabilities,
  effectiveSubstrates
} from './equipmentFit';
import { getCatalogModel, BUTTON_SIZES, MUG_SIZES } from '$lib/data/equipmentCatalog';

const caps = (id: string) => getCatalogModel(id)!.capabilities;
const tee = { name: 'Front Print', widthIn: 12, heightIn: 16, requiredDpi: 150 };

describe('inferProductFamily', () => {
  it('prefers the template type', () => {
    expect(inferProductFamily('mug', 'Cool Shirt')).toBe('mug');
  });
  it('guesses from the name', () => {
    expect(inferProductFamily(null, '1¼" Pin')).toBe('button');
    expect(inferProductFamily(null, 'Tour Hoodie')).toBe('garment');
    expect(inferProductFamily(null, 'Holographic Sticker Pack')).toBe('sticker');
    expect(inferProductFamily(null, 'Dad Hat')).toBe('hat');
    expect(inferProductFamily(undefined, 'Album download')).toBe('unknown');
  });
});

describe('checkProductFit', () => {
  it('passes a tee front on a 16x20 DTG', () => {
    expect(
      checkProductFit(caps('epson-surecolor-f2100'), { family: 'garment', printAreas: [tee] })
    ).toEqual({ level: 'ok', issues: [] });
  });

  it('fails a print area bigger than the platen, even rotated', () => {
    const fit = checkProductFit(caps('cricut-easypress-3-9x9'), {
      family: 'garment',
      printAreas: [tee]
    });
    expect(fit.level).toBe('error');
    expect(fit.issues[0].code).toBe('too-large');
  });

  it('accepts a print area that only fits rotated', () => {
    const fit = checkProductFit(caps('glowforge-pro'), {
      family: 'hard-good',
      printAreas: [{ name: 'Face', widthIn: 10, heightIn: 18 }]
    });
    expect(fit.level).toBe('ok');
  });

  it('checks roll width, not length, on roll-fed machines', () => {
    const ok = checkProductFit(caps('procolored-f13-pro'), {
      family: 'garment',
      printAreas: [{ name: 'Back', widthIn: 12, heightIn: 40 }]
    });
    expect(ok.level).toBe('ok');
    const wide = checkProductFit(caps('procolored-f13-pro'), {
      family: 'garment',
      printAreas: [{ name: 'All-Over', widthIn: 40, heightIn: 30 }]
    });
    expect(wide.issues[0].code).toBe('too-wide');
  });

  it('rejects the wrong substrate', () => {
    const fit = checkProductFit(caps('cricut-mug-press'), { family: 'garment', printAreas: [] });
    expect(fit.issues[0].code).toBe('wrong-substrate');
  });

  it('treats DTF film and HTV as making garments', () => {
    expect(effectiveSubstrates(caps('procolored-f13-pro')).has('cotton')).toBe(true);
    expect(effectiveSubstrates(caps('cricut-maker-3')).has('cotton')).toBe(true);
  });

  it('warns light-only for DTG without white and for sublimation', () => {
    expect(
      checkProductFit(caps('ricoh-ri-100'), { family: 'garment', printAreas: [] }).issues[0].code
    ).toBe('light-only');
    expect(
      checkProductFit(caps('sawgrass-sg500'), { family: 'garment', printAreas: [] }).issues[0]
        .message
    ).toMatch(/polyester/);
  });

  it('warns on DPI below what the print area asks for', () => {
    const fit = checkProductFit(caps('sawgrass-sg500'), {
      family: 'mug',
      printAreas: [{ name: 'Wrap', widthIn: 8, heightIn: 3.5, requiredDpi: 1200 }]
    });
    expect(fit.issues.map((i) => i.code)).toContain('low-dpi');
  });

  it('asks for a size on size-based machines and checks it is owned', () => {
    const press = {
      kind: 'button-press' as const,
      substrates: ['button' as const],
      sizes: [BUTTON_SIZES.r125]
    };
    expect(checkProductFit(press, { family: 'button', printAreas: [] }).issues[0].code).toBe(
      'size-missing'
    );
    expect(
      checkProductFit(press, { family: 'button', printAreas: [], sizeId: 'round-1.25' }).level
    ).toBe('ok');
    expect(
      checkProductFit(press, { family: 'button', printAreas: [], sizeId: 'round-3' }).issues[0].code
    ).toBe('size-not-owned');
  });

  it('skips the substrate check for unknown products', () => {
    expect(checkProductFit(caps('xtool-f1'), { family: 'unknown', printAreas: [] }).level).toBe(
      'ok'
    );
  });
});

describe('guessSizeFromName', () => {
  const sizes = [BUTTON_SIZES.r1, BUTTON_SIZES.r125, BUTTON_SIZES.r225];
  it('reads decimals, unicode fractions and slash fractions', () => {
    expect(guessSizeFromName('1.25 inch pin', sizes)?.id).toBe('round-1.25');
    expect(guessSizeFromName('2¼" Button', sizes)?.id).toBe('round-2.25');
    expect(guessSizeFromName('1 1/4" badge', sizes)?.id).toBe('round-1.25');
    expect(guessSizeFromName('1" pin', sizes)?.id).toBe('round-1');
  });
  it('reads mug ounces', () => {
    expect(guessSizeFromName('Logo Mug 15oz', [MUG_SIZES.oz11, MUG_SIZES.oz15])?.id).toBe(
      'mug-15oz'
    );
  });
  it('returns null when nothing matches', () => {
    expect(guessSizeFromName('Big pin', sizes)).toBeNull();
    expect(guessSizeFromName('3" pin', sizes)).toBeNull();
    expect(guessSizeFromName('anything', [])).toBeNull();
  });
});

describe('workflowGaps', () => {
  it('flags a DTF printer without a heat press', () => {
    const gaps = workflowGaps([
      { name: 'Procolored', isActive: true, capabilities: caps('procolored-f13-pro') }
    ]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatch(/heat press/);
  });
  it('is satisfied by a heat press, mug press or hat press, and ignores inactive machines', () => {
    expect(
      workflowGaps([
        { name: 'SG500', isActive: true, capabilities: caps('sawgrass-sg500') },
        { name: 'Mug', isActive: true, capabilities: caps('cricut-mug-press') }
      ])
    ).toEqual([]);
    expect(
      workflowGaps([
        { name: 'SG500', isActive: false, capabilities: caps('sawgrass-sg500') },
        { name: 'Legacy', isActive: true, capabilities: null }
      ])
    ).toEqual([]);
  });
});

describe('rankMachines', () => {
  it('puts fitting machines first', () => {
    const ranked = rankMachines(
      [
        { id: 'mug', capabilities: caps('cricut-mug-press') },
        { id: 'legacy', capabilities: null },
        { id: 'dtg', capabilities: caps('epson-surecolor-f2100') }
      ],
      { family: 'garment', printAreas: [tee] }
    );
    expect(ranked.map((r) => r.machine.id)).toEqual(['dtg', 'legacy', 'mug']);
    expect(ranked[1].fit).toBeNull();
  });
});

describe('describeCapabilities', () => {
  it('summarises the useful facts', () => {
    expect(describeCapabilities(caps('epson-surecolor-f2100'))).toEqual([
      '16" × 20" max',
      '1200 dpi',
      'white ink'
    ]);
    expect(describeCapabilities(caps('brother-pr1055x'))).toContain('10 needles');
    expect(describeCapabilities(caps('xtool-p2'))).toContain('55 W co2 laser');
    expect(describeCapabilities(caps('badge-a-minit-starter'))).toContain('2¼" round');
  });
});
