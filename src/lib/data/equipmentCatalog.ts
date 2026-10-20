/**
 * Built-in catalog of production equipment a store owner might run locally —
 * printers, cutters, presses, engravers, embroidery machines, button makers.
 *
 * An owner picks their make and model and gets its capabilities pre-filled, so
 * the platform can check a product against the machine that will make it (does
 * the print area fit the platen? does a dark shirt need white ink?) without the
 * owner typing in a spec sheet.
 *
 * Figures are the manufacturers' published nominal maximums, rounded to the
 * inch fraction an owner would recognise. They are a starting point: every
 * value is copied onto the site's own machine when it is added, and the owner
 * can correct it there. A model that is missing is added with kind 'other' or
 * from the nearest kind's defaults (`KIND_DEFAULTS`).
 */

import type {
  EquipmentCapabilities,
  EquipmentCatalogModel,
  EquipmentKind,
  EquipmentSize
} from '$lib/types/equipmentCapabilities';

// --- Sizes ---------------------------------------------------------------

function round(diameterIn: number, label: string, artworkIn?: number): EquipmentSize {
  return {
    id: `round-${diameterIn}`,
    label,
    shape: 'round',
    widthIn: diameterIn,
    heightIn: diameterIn,
    ...(artworkIn ? { artworkWidthIn: artworkIn, artworkHeightIn: artworkIn } : {})
  };
}

/**
 * Pin-back button dies. Artwork sizes are the printed circle that wraps the
 * shell — the common industry cut sizes; check them against the template that
 * came with the die.
 */
export const BUTTON_SIZES = {
  r1: round(1, '1" round', 1.313),
  r125: round(1.25, '1¼" round', 1.625),
  r15: round(1.5, '1½" round', 1.837),
  r175: round(1.75, '1¾" round', 2.125),
  r2: round(2, '2" round', 2.375),
  r225: round(2.25, '2¼" round', 2.625),
  r25: round(2.5, '2½" round', 2.875),
  r3: round(3, '3" round', 3.5),
  r35: round(3.5, '3½" round', 4),
  r6: round(6, '6" round', 6.75),
  rect: {
    id: 'rect-1.5x2.5',
    label: '1½" × 2½" rectangle',
    shape: 'rectangle',
    widthIn: 1.5,
    heightIn: 2.5,
    artworkWidthIn: 1.875,
    artworkHeightIn: 2.875
  },
  oval: {
    id: 'oval-1.75x2.75',
    label: '1¾" × 2¾" oval',
    shape: 'oval',
    widthIn: 1.75,
    heightIn: 2.75,
    artworkWidthIn: 2.125,
    artworkHeightIn: 3.125
  }
} satisfies Record<string, EquipmentSize>;

const B = BUTTON_SIZES;

function mug(oz: number, wrapW: number, wrapH: number): EquipmentSize {
  return {
    id: `mug-${oz}oz`,
    label: `${oz} oz mug`,
    shape: 'cylinder',
    widthIn: wrapW,
    heightIn: wrapH
  };
}

export const MUG_SIZES = {
  oz11: mug(11, 9.5, 3.5),
  oz15: mug(15, 9.5, 4),
  oz16: mug(16, 9.75, 4.25)
} satisfies Record<string, EquipmentSize>;

// --- Kind metadata -------------------------------------------------------

export const KIND_LABELS: Record<EquipmentKind, string> = {
  'dtg-printer': 'DTG printer',
  'dtf-printer': 'DTF printer',
  'sublimation-printer': 'Sublimation printer',
  'uv-printer': 'UV flatbed printer',
  'eco-solvent-printer': 'Eco-solvent / print-and-cut',
  'photo-printer': 'Photo / fine-art printer',
  'white-toner-printer': 'White-toner laser printer',
  'label-printer': 'Label / sticker printer',
  'vinyl-cutter': 'Vinyl cutter',
  'laser-engraver': 'Laser engraver / cutter',
  'embroidery-machine': 'Embroidery machine',
  'heat-press': 'Heat press',
  'mug-press': 'Mug / tumbler press',
  'hat-press': 'Hat press',
  'button-press': 'Button maker',
  'screen-printing-press': 'Screen-printing press',
  '3d-printer': '3D printer',
  other: 'Other equipment'
};

/** The rule-of-thumb starting point for a machine that is not in the catalog. */
export const KIND_DEFAULTS: Record<EquipmentKind, EquipmentCapabilities> = {
  'dtg-printer': {
    kind: 'dtg-printer',
    maxAreaIn: { widthIn: 16, heightIn: 20 },
    maxDpi: 1200,
    whiteInk: true,
    substrates: ['cotton', 'blend', 'dark-garment']
  },
  'dtf-printer': {
    kind: 'dtf-printer',
    maxMediaWidthIn: 13,
    maxDpi: 1440,
    whiteInk: true,
    substrates: ['transfer-film'],
    needs: ['heat-press']
  },
  'sublimation-printer': {
    kind: 'sublimation-printer',
    maxAreaIn: { widthIn: 8.5, heightIn: 14 },
    maxDpi: 4800,
    whiteInk: false,
    substrates: ['polyester', 'mug', 'tumbler', 'hard-surface'],
    needs: ['heat-press']
  },
  'uv-printer': {
    kind: 'uv-printer',
    maxAreaIn: { widthIn: 12, heightIn: 16 },
    maxObjectHeightIn: 4,
    maxDpi: 1440,
    whiteInk: true,
    substrates: ['acrylic', 'wood', 'leather', 'glass', 'metal', 'hard-surface', 'paper']
  },
  'eco-solvent-printer': {
    kind: 'eco-solvent-printer',
    maxMediaWidthIn: 30,
    maxDpi: 1440,
    cuts: true,
    substrates: ['vinyl', 'sticker', 'htv', 'paper']
  },
  'photo-printer': {
    kind: 'photo-printer',
    maxAreaIn: { widthIn: 13, heightIn: 19 },
    maxDpi: 5760,
    substrates: ['paper', 'cardstock']
  },
  'white-toner-printer': {
    kind: 'white-toner-printer',
    maxAreaIn: { widthIn: 8.5, heightIn: 14 },
    maxDpi: 1200,
    whiteInk: true,
    substrates: ['transfer-film', 'paper'],
    needs: ['heat-press']
  },
  'label-printer': {
    kind: 'label-printer',
    maxMediaWidthIn: 4,
    maxDpi: 300,
    substrates: ['sticker', 'paper']
  },
  'vinyl-cutter': {
    kind: 'vinyl-cutter',
    maxMediaWidthIn: 12,
    cuts: true,
    substrates: ['vinyl', 'htv', 'cardstock', 'sticker']
  },
  'laser-engraver': {
    kind: 'laser-engraver',
    maxAreaIn: { widthIn: 16, heightIn: 12 },
    laser: 'co2',
    cuts: true,
    substrates: ['wood', 'acrylic', 'leather', 'glass', 'paper', 'cardstock', 'fabric']
  },
  'embroidery-machine': {
    kind: 'embroidery-machine',
    maxAreaIn: { widthIn: 5, heightIn: 7 },
    maxColors: 1,
    substrates: ['cotton', 'polyester', 'blend', 'dark-garment', 'hat', 'fabric']
  },
  'heat-press': {
    kind: 'heat-press',
    maxAreaIn: { widthIn: 15, heightIn: 15 },
    substrates: ['cotton', 'polyester', 'blend', 'dark-garment', 'fabric', 'hard-surface']
  },
  'mug-press': {
    kind: 'mug-press',
    substrates: ['mug', 'tumbler'],
    sizes: [MUG_SIZES.oz11, MUG_SIZES.oz15]
  },
  'hat-press': {
    kind: 'hat-press',
    maxAreaIn: { widthIn: 6, heightIn: 3.5 },
    substrates: ['hat']
  },
  'button-press': {
    kind: 'button-press',
    substrates: ['button'],
    sizes: [B.r225]
  },
  'screen-printing-press': {
    kind: 'screen-printing-press',
    maxAreaIn: { widthIn: 14, heightIn: 16 },
    maxColors: 4,
    whiteInk: true,
    substrates: ['cotton', 'polyester', 'blend', 'dark-garment', 'paper', 'fabric']
  },
  '3d-printer': {
    kind: '3d-printer',
    buildVolumeIn: { widthIn: 8.7, depthIn: 8.7, heightIn: 9.8 },
    substrates: ['filament']
  },
  other: { kind: 'other', substrates: [] }
};

// --- Catalog -------------------------------------------------------------

function m(
  id: string,
  make: string,
  model: string,
  capabilities: EquipmentCapabilities,
  summary?: string
): EquipmentCatalogModel {
  return { id, make, model, capabilities, ...(summary ? { summary } : {}) };
}

const CMYK = ['C', 'M', 'Y', 'K'];
const CMYKW = ['C', 'M', 'Y', 'K', 'W'];
const GARMENTS: EquipmentCapabilities['substrates'] = ['cotton', 'blend', 'dark-garment'];
const ALL_GARMENTS: EquipmentCapabilities['substrates'] = [
  'cotton',
  'polyester',
  'blend',
  'dark-garment',
  'fabric'
];
const SUB_BLANKS: EquipmentCapabilities['substrates'] = [
  'polyester',
  'mug',
  'tumbler',
  'hard-surface'
];
const LASER_CO2: EquipmentCapabilities['substrates'] = [
  'wood',
  'acrylic',
  'leather',
  'glass',
  'paper',
  'cardstock',
  'fabric'
];
const LASER_DIODE: EquipmentCapabilities['substrates'] = [
  'wood',
  'leather',
  'paper',
  'cardstock',
  'fabric',
  'metal'
];
const CUTTER: EquipmentCapabilities['substrates'] = ['vinyl', 'htv', 'cardstock', 'sticker'];
const FLATBED_UV: EquipmentCapabilities['substrates'] = [
  'acrylic',
  'wood',
  'leather',
  'glass',
  'metal',
  'hard-surface',
  'paper'
];
const PRESS: EquipmentCapabilities['substrates'] = [...ALL_GARMENTS, 'hard-surface'];

const area = (widthIn: number, heightIn: number) => ({ widthIn, heightIn });

export const EQUIPMENT_CATALOG: EquipmentCatalogModel[] = [
  // DTG
  m(
    'epson-surecolor-f2100',
    'Epson',
    'SureColor F2100',
    {
      kind: 'dtg-printer',
      maxAreaIn: area(16, 20),
      maxDpi: 1200,
      inks: CMYKW,
      whiteInk: true,
      substrates: GARMENTS
    },
    'Direct-to-garment on cotton, light and dark.'
  ),
  m(
    'epson-surecolor-f2270',
    'Epson',
    'SureColor F2270',
    {
      kind: 'dtg-printer',
      maxAreaIn: area(16, 20),
      maxDpi: 1200,
      inks: CMYKW,
      whiteInk: true,
      substrates: [...GARMENTS, 'transfer-film']
    },
    'Hybrid DTG and DTF — prints on garments or on film for a heat press.'
  ),
  m('brother-gtx', 'Brother', 'GTX', {
    kind: 'dtg-printer',
    maxAreaIn: area(16, 21),
    maxDpi: 1200,
    inks: CMYKW,
    whiteInk: true,
    substrates: GARMENTS
  }),
  m('brother-gtx-pro', 'Brother', 'GTXpro', {
    kind: 'dtg-printer',
    maxAreaIn: area(16, 21),
    maxDpi: 1200,
    inks: CMYKW,
    whiteInk: true,
    substrates: GARMENTS
  }),
  m('ricoh-ri-1000', 'Ricoh', 'Ri 1000', {
    kind: 'dtg-printer',
    maxAreaIn: area(16, 20),
    maxDpi: 1200,
    inks: CMYKW,
    whiteInk: true,
    substrates: GARMENTS
  }),
  m(
    'ricoh-ri-100',
    'Ricoh',
    'Ri 100',
    {
      kind: 'dtg-printer',
      maxAreaIn: area(8.3, 11.7),
      maxDpi: 1200,
      inks: CMYK,
      whiteInk: false,
      substrates: ['cotton', 'blend']
    },
    'Compact DTG for light garments, totes and pockets.'
  ),
  m('kornit-atlas-max', 'Kornit', 'Atlas MAX', {
    kind: 'dtg-printer',
    maxAreaIn: area(19.7, 27.6),
    maxDpi: 1200,
    inks: [...CMYKW, 'R', 'G'],
    whiteInk: true,
    substrates: [...GARMENTS, 'polyester']
  }),

  // DTF
  m(
    'procolored-f13-pro',
    'Procolored',
    'F13 Pro (A3+)',
    {
      kind: 'dtf-printer',
      maxMediaWidthIn: 13,
      maxDpi: 1440,
      inks: CMYKW,
      whiteInk: true,
      substrates: ['transfer-film'],
      needs: ['heat-press']
    },
    'Desktop DTF on 13" roll film; press the transfers onto almost any fabric.'
  ),
  m('procolored-vf13-pro', 'Procolored', 'VF13 Pro', {
    kind: 'dtf-printer',
    maxMediaWidthIn: 13,
    maxDpi: 1440,
    inks: CMYKW,
    whiteInk: true,
    substrates: ['transfer-film'],
    needs: ['heat-press']
  }),
  m('epson-surecolor-g6070', 'Epson', 'SureColor G6070', {
    kind: 'dtf-printer',
    maxMediaWidthIn: 24,
    maxDpi: 1200,
    inks: CMYKW,
    whiteInk: true,
    substrates: ['transfer-film'],
    needs: ['heat-press']
  }),
  m('mimaki-txf150-75', 'Mimaki', 'TxF150-75', {
    kind: 'dtf-printer',
    maxMediaWidthIn: 31.5,
    maxDpi: 1440,
    inks: CMYKW,
    whiteInk: true,
    substrates: ['transfer-film'],
    needs: ['heat-press']
  }),
  m('prestige-xl2', 'Prestige', 'XL2', {
    kind: 'dtf-printer',
    maxMediaWidthIn: 24,
    maxDpi: 1440,
    inks: CMYKW,
    whiteInk: true,
    substrates: ['transfer-film'],
    needs: ['heat-press']
  }),

  // Sublimation
  m(
    'sawgrass-sg500',
    'Sawgrass',
    'SG500',
    {
      kind: 'sublimation-printer',
      maxAreaIn: area(8.5, 14),
      maxDpi: 600,
      inks: CMYK,
      substrates: SUB_BLANKS,
      needs: ['heat-press']
    },
    'Letter/legal sublimation — mugs, polyester tees, coasters.'
  ),
  m('sawgrass-sg1000', 'Sawgrass', 'SG1000', {
    kind: 'sublimation-printer',
    maxAreaIn: area(13, 19),
    maxDpi: 600,
    inks: CMYK,
    substrates: SUB_BLANKS,
    needs: ['heat-press']
  }),
  m('epson-surecolor-f170', 'Epson', 'SureColor F170', {
    kind: 'sublimation-printer',
    maxAreaIn: area(8.5, 14),
    maxDpi: 4800,
    inks: CMYK,
    substrates: SUB_BLANKS,
    needs: ['heat-press']
  }),
  m('epson-surecolor-f570', 'Epson', 'SureColor F570 (24")', {
    kind: 'sublimation-printer',
    maxMediaWidthIn: 24,
    maxDpi: 2400,
    inks: CMYK,
    substrates: SUB_BLANKS,
    needs: ['heat-press']
  }),
  m('epson-surecolor-f6370', 'Epson', 'SureColor F6370 (44")', {
    kind: 'sublimation-printer',
    maxMediaWidthIn: 44,
    maxDpi: 1200,
    inks: CMYK,
    substrates: [...SUB_BLANKS, 'fabric'],
    needs: ['heat-press']
  }),
  m('epson-ecotank-et-15000-sub', 'Epson', 'EcoTank ET-15000 (sublimation conversion)', {
    kind: 'sublimation-printer',
    maxAreaIn: area(13, 19),
    maxDpi: 4800,
    inks: CMYK,
    substrates: SUB_BLANKS,
    needs: ['heat-press']
  }),

  // UV flatbed
  m(
    'roland-versauv-lef2-200',
    'Roland',
    'VersaUV LEF2-200',
    {
      kind: 'uv-printer',
      maxAreaIn: area(20, 13),
      maxObjectHeightIn: 3.9,
      maxDpi: 1440,
      inks: [...CMYKW, 'Gloss'],
      whiteInk: true,
      substrates: FLATBED_UV
    },
    'Prints straight onto objects — phone cases, acrylic, pens, award plaques.'
  ),
  m('roland-versauv-lef2-300', 'Roland', 'VersaUV LEF2-300', {
    kind: 'uv-printer',
    maxAreaIn: area(30, 21),
    maxObjectHeightIn: 3.9,
    maxDpi: 1440,
    inks: [...CMYKW, 'Gloss'],
    whiteInk: true,
    substrates: FLATBED_UV
  }),
  m('mimaki-ujf-3042-mkii', 'Mimaki', 'UJF-3042 MkII', {
    kind: 'uv-printer',
    maxAreaIn: area(11.8, 16.5),
    maxObjectHeightIn: 5.9,
    maxDpi: 1200,
    inks: [...CMYKW, 'Gloss'],
    whiteInk: true,
    substrates: FLATBED_UV
  }),
  m('eufymake-e1', 'eufyMake', 'E1', {
    kind: 'uv-printer',
    maxAreaIn: area(13, 16.5),
    maxObjectHeightIn: 2.6,
    maxDpi: 1440,
    inks: [...CMYKW, 'Gloss'],
    whiteInk: true,
    substrates: FLATBED_UV
  }),

  // Eco-solvent / print-and-cut
  m(
    'roland-bn-20a',
    'Roland',
    'BN-20A',
    {
      kind: 'eco-solvent-printer',
      maxMediaWidthIn: 20,
      maxDpi: 1440,
      inks: [...CMYK, 'W', 'Metallic'],
      whiteInk: true,
      cuts: true,
      substrates: ['vinyl', 'sticker', 'htv', 'paper']
    },
    'Desktop print-and-cut — stickers, decals, printable heat-transfer vinyl.'
  ),
  m('roland-truevis-vg3-540', 'Roland', 'TrueVIS VG3-540', {
    kind: 'eco-solvent-printer',
    maxMediaWidthIn: 54,
    maxDpi: 1200,
    inks: [...CMYK, 'Lc', 'Lm', 'Lk', 'Or'],
    cuts: true,
    substrates: ['vinyl', 'sticker', 'htv', 'paper']
  }),
  m('roland-truevis-vg3-640', 'Roland', 'TrueVIS VG3-640', {
    kind: 'eco-solvent-printer',
    maxMediaWidthIn: 64,
    maxDpi: 1200,
    inks: [...CMYK, 'Lc', 'Lm', 'Lk', 'Or'],
    cuts: true,
    substrates: ['vinyl', 'sticker', 'htv', 'paper']
  }),
  m('mimaki-cjv150-75', 'Mimaki', 'CJV150-75', {
    kind: 'eco-solvent-printer',
    maxMediaWidthIn: 31.5,
    maxDpi: 1440,
    inks: CMYK,
    cuts: true,
    substrates: ['vinyl', 'sticker', 'htv', 'paper']
  }),

  // Photo / fine-art / sticker sheets
  m('epson-surecolor-p700', 'Epson', 'SureColor P700', {
    kind: 'photo-printer',
    maxMediaWidthIn: 13,
    maxAreaIn: area(13, 19),
    maxDpi: 5760,
    substrates: ['paper', 'cardstock', 'sticker']
  }),
  m('epson-surecolor-p900', 'Epson', 'SureColor P900', {
    kind: 'photo-printer',
    maxMediaWidthIn: 17,
    maxAreaIn: area(17, 22),
    maxDpi: 5760,
    substrates: ['paper', 'cardstock', 'sticker']
  }),
  m('canon-imageprograf-pro-1000', 'Canon', 'imagePROGRAF PRO-1000', {
    kind: 'photo-printer',
    maxAreaIn: area(17, 22),
    maxDpi: 2400,
    substrates: ['paper', 'cardstock', 'sticker']
  }),
  m('epson-ecotank-photo-et-8550', 'Epson', 'EcoTank Photo ET-8550', {
    kind: 'photo-printer',
    maxAreaIn: area(13, 19),
    maxDpi: 5760,
    substrates: ['paper', 'cardstock', 'sticker']
  }),
  m('canon-pixma-pro-200', 'Canon', 'PIXMA PRO-200', {
    kind: 'photo-printer',
    maxAreaIn: area(13, 19),
    maxDpi: 4800,
    substrates: ['paper', 'cardstock', 'sticker']
  }),

  // White toner
  m(
    'oki-pro9541wt',
    'OKI',
    'Pro9541WT',
    {
      kind: 'white-toner-printer',
      maxAreaIn: area(13, 19),
      maxDpi: 1200,
      inks: CMYKW,
      whiteInk: true,
      substrates: ['transfer-film', 'paper'],
      needs: ['heat-press']
    },
    'White-toner transfers for dark garments and hard goods.'
  ),
  m('oki-c711wt', 'OKI', 'C711WT', {
    kind: 'white-toner-printer',
    maxAreaIn: area(8.5, 14),
    maxDpi: 1200,
    inks: ['C', 'M', 'Y', 'W'],
    whiteInk: true,
    substrates: ['transfer-film', 'paper'],
    needs: ['heat-press']
  }),

  // Labels / stickers
  m('primera-lx500', 'Primera', 'LX500 Color Label Printer', {
    kind: 'label-printer',
    maxMediaWidthIn: 5,
    maxDpi: 4800,
    inks: CMYK,
    substrates: ['sticker', 'paper']
  }),
  m('brother-ql-820nwb', 'Brother', 'QL-820NWB', {
    kind: 'label-printer',
    maxMediaWidthIn: 2.4,
    maxDpi: 300,
    inks: ['K', 'R'],
    substrates: ['sticker', 'paper']
  }),

  // Vinyl cutters
  m(
    'cricut-maker-3',
    'Cricut',
    'Maker 3',
    {
      kind: 'vinyl-cutter',
      maxMediaWidthIn: 13,
      maxAreaIn: area(12, 24),
      cuts: true,
      substrates: [...CUTTER, 'fabric', 'leather', 'wood']
    },
    'Cuts vinyl, iron-on, cardstock and fabric; Smart Materials up to 12 ft long without a mat.'
  ),
  m('cricut-explore-3', 'Cricut', 'Explore 3', {
    kind: 'vinyl-cutter',
    maxMediaWidthIn: 13,
    maxAreaIn: area(12, 24),
    cuts: true,
    substrates: CUTTER
  }),
  m('cricut-joy-xtra', 'Cricut', 'Joy Xtra', {
    kind: 'vinyl-cutter',
    maxMediaWidthIn: 9.5,
    maxAreaIn: area(8.5, 12),
    cuts: true,
    substrates: CUTTER
  }),
  m('cricut-joy', 'Cricut', 'Joy', {
    kind: 'vinyl-cutter',
    maxMediaWidthIn: 5.5,
    maxAreaIn: area(4.5, 12),
    cuts: true,
    substrates: CUTTER
  }),
  m('cricut-venture', 'Cricut', 'Venture', {
    kind: 'vinyl-cutter',
    maxMediaWidthIn: 25,
    maxAreaIn: area(24, 28),
    cuts: true,
    substrates: CUTTER
  }),
  m('silhouette-cameo-5', 'Silhouette', 'Cameo 5', {
    kind: 'vinyl-cutter',
    maxMediaWidthIn: 12,
    maxAreaIn: area(12, 24),
    cuts: true,
    substrates: CUTTER
  }),
  m('silhouette-cameo-5-plus', 'Silhouette', 'Cameo 5 Plus', {
    kind: 'vinyl-cutter',
    maxMediaWidthIn: 15,
    maxAreaIn: area(15, 24),
    cuts: true,
    substrates: CUTTER
  }),
  m('silhouette-cameo-pro-mk-ii', 'Silhouette', 'Cameo Pro MK II', {
    kind: 'vinyl-cutter',
    maxMediaWidthIn: 24,
    maxAreaIn: area(24, 24),
    cuts: true,
    substrates: CUTTER
  }),
  m('roland-camm-1-gs2-24', 'Roland', 'CAMM-1 GS2-24', {
    kind: 'vinyl-cutter',
    maxMediaWidthIn: 27,
    maxAreaIn: area(22.9, 984),
    cuts: true,
    substrates: CUTTER
  }),
  m('graphtec-ce8000-60', 'Graphtec', 'CE8000-60', {
    kind: 'vinyl-cutter',
    maxMediaWidthIn: 26.5,
    maxAreaIn: area(23.9, 1968),
    cuts: true,
    substrates: CUTTER
  }),
  m('graphtec-ce8000-130', 'Graphtec', 'CE8000-130', {
    kind: 'vinyl-cutter',
    maxMediaWidthIn: 53,
    maxAreaIn: area(50, 1968),
    cuts: true,
    substrates: CUTTER
  }),
  m('siser-romeo', 'Siser', 'Romeo', {
    kind: 'vinyl-cutter',
    maxMediaWidthIn: 24,
    maxAreaIn: area(24, 600),
    cuts: true,
    substrates: CUTTER
  }),

  // Laser
  m(
    'glowforge-pro',
    'Glowforge',
    'Pro',
    {
      kind: 'laser-engraver',
      maxAreaIn: area(19.5, 11),
      maxObjectHeightIn: 2,
      laser: 'co2',
      laserWatts: 45,
      cuts: true,
      substrates: LASER_CO2
    },
    'CO2 laser; the passthrough slot takes boards longer than the bed.'
  ),
  m('glowforge-plus', 'Glowforge', 'Plus', {
    kind: 'laser-engraver',
    maxAreaIn: area(19.5, 11),
    maxObjectHeightIn: 2,
    laser: 'co2',
    laserWatts: 40,
    cuts: true,
    substrates: LASER_CO2
  }),
  m('glowforge-aura', 'Glowforge', 'Aura', {
    kind: 'laser-engraver',
    maxAreaIn: area(12, 20),
    laser: 'diode',
    laserWatts: 6,
    cuts: true,
    substrates: LASER_DIODE
  }),
  m('xtool-p2', 'xTool', 'P2', {
    kind: 'laser-engraver',
    maxAreaIn: area(26, 14),
    laser: 'co2',
    laserWatts: 55,
    cuts: true,
    substrates: LASER_CO2
  }),
  m('xtool-s1', 'xTool', 'S1', {
    kind: 'laser-engraver',
    maxAreaIn: area(19.6, 12.5),
    laser: 'diode',
    laserWatts: 20,
    cuts: true,
    substrates: LASER_DIODE
  }),
  m(
    'xtool-f1',
    'xTool',
    'F1',
    {
      kind: 'laser-engraver',
      maxAreaIn: area(4.5, 4.5),
      laser: 'infrared',
      laserWatts: 2,
      substrates: ['metal', 'wood', 'leather', 'acrylic']
    },
    'Portable galvo engraver for small items — tags, jewellery, keychains.'
  ),
  m('xtool-f2-ultra', 'xTool', 'F2 Ultra', {
    kind: 'laser-engraver',
    maxAreaIn: area(8.3, 8.3),
    laser: 'fiber',
    laserWatts: 60,
    substrates: ['metal', 'wood', 'leather', 'acrylic']
  }),
  m('epilog-fusion-pro-32', 'Epilog', 'Fusion Pro 32', {
    kind: 'laser-engraver',
    maxAreaIn: area(32, 20),
    maxObjectHeightIn: 12.25,
    laser: 'co2',
    laserWatts: 60,
    cuts: true,
    substrates: LASER_CO2
  }),
  m('epilog-zing-16', 'Epilog', 'Zing 16', {
    kind: 'laser-engraver',
    maxAreaIn: area(16, 12),
    maxObjectHeightIn: 6.5,
    laser: 'co2',
    laserWatts: 40,
    cuts: true,
    substrates: LASER_CO2
  }),
  m('thunder-laser-nova-35', 'Thunder Laser', 'Nova 35', {
    kind: 'laser-engraver',
    maxAreaIn: area(35, 24),
    laser: 'co2',
    laserWatts: 80,
    cuts: true,
    substrates: LASER_CO2
  }),

  // Embroidery
  m('brother-pe800', 'Brother', 'PE800', {
    kind: 'embroidery-machine',
    maxAreaIn: area(5, 7),
    maxColors: 1,
    substrates: ['cotton', 'polyester', 'blend', 'dark-garment', 'fabric']
  }),
  m('brother-se700', 'Brother', 'SE700', {
    kind: 'embroidery-machine',
    maxAreaIn: area(4, 4),
    maxColors: 1,
    substrates: ['cotton', 'polyester', 'blend', 'dark-garment', 'fabric']
  }),
  m(
    'brother-pr1055x',
    'Brother',
    'PR1055X',
    {
      kind: 'embroidery-machine',
      maxAreaIn: area(14, 8),
      maxColors: 10,
      substrates: [...ALL_GARMENTS, 'hat', 'leather']
    },
    '10-needle multi-colour embroidery, with a cap frame for hats.'
  ),
  m('janome-mb-7', 'Janome', 'MB-7', {
    kind: 'embroidery-machine',
    maxAreaIn: area(9.4, 7.9),
    maxColors: 7,
    substrates: [...ALL_GARMENTS, 'hat']
  }),
  m('ricoma-em-1010', 'Ricoma', 'EM-1010', {
    kind: 'embroidery-machine',
    maxAreaIn: area(14, 19.5),
    maxColors: 10,
    substrates: [...ALL_GARMENTS, 'hat', 'leather']
  }),

  // Heat presses
  m('hotronix-fusion-iq-16x20', 'Hotronix', 'Fusion IQ 16×20', {
    kind: 'heat-press',
    maxAreaIn: area(16, 20),
    substrates: PRESS
  }),
  m('hotronix-auto-clam-16x20', 'Hotronix', 'Auto Clam 16×20', {
    kind: 'heat-press',
    maxAreaIn: area(16, 20),
    substrates: PRESS
  }),
  m('geo-knight-dk20s', 'Geo Knight', 'DK20S', {
    kind: 'heat-press',
    maxAreaIn: area(16, 20),
    substrates: PRESS
  }),
  m('powerpress-15x15', 'PowerPress', 'Clamshell 15×15', {
    kind: 'heat-press',
    maxAreaIn: area(15, 15),
    substrates: PRESS
  }),
  m('cricut-easypress-3-9x9', 'Cricut', 'EasyPress 3 (9×9)', {
    kind: 'heat-press',
    maxAreaIn: area(9, 9),
    substrates: PRESS
  }),
  m('cricut-easypress-3-12x10', 'Cricut', 'EasyPress 3 (12×10)', {
    kind: 'heat-press',
    maxAreaIn: area(12, 10),
    substrates: PRESS
  }),
  m('cricut-easypress-mini', 'Cricut', 'EasyPress Mini', {
    kind: 'heat-press',
    maxAreaIn: area(3, 2),
    substrates: [...PRESS, 'hat']
  }),

  // Mug / hat presses
  m('cricut-mug-press', 'Cricut', 'Mug Press', {
    kind: 'mug-press',
    substrates: ['mug'],
    sizes: [MUG_SIZES.oz11, MUG_SIZES.oz15, MUG_SIZES.oz16]
  }),
  m('hotronix-mug-press', 'Hotronix', 'Mug Press', {
    kind: 'mug-press',
    substrates: ['mug', 'tumbler'],
    sizes: [MUG_SIZES.oz11, MUG_SIZES.oz15]
  }),
  m('cricut-hat-press', 'Cricut', 'Hat Press', {
    kind: 'hat-press',
    maxAreaIn: area(6, 3.5),
    substrates: ['hat']
  }),
  m('hotronix-cap-heat-press', 'Hotronix', 'Cap Heat Press', {
    kind: 'hat-press',
    maxAreaIn: area(6, 3.5),
    substrates: ['hat']
  }),

  // Button makers
  m(
    'abm-model-1',
    'American Button Machines',
    'Model 1 (interchangeable dies)',
    {
      kind: 'button-press',
      substrates: ['button'],
      sizes: [B.r1, B.r125, B.r15, B.r175, B.r225, B.r3, B.r35, B.rect, B.oval]
    },
    'One press, a die per size — tick the dies you own.'
  ),
  m('abm-pro-model-1', 'American Button Machines', 'Pro Model 1 (interchangeable dies)', {
    kind: 'button-press',
    substrates: ['button'],
    sizes: [B.r1, B.r125, B.r15, B.r175, B.r2, B.r225, B.r25, B.r3, B.r35, B.r6, B.rect, B.oval]
  }),
  m('badge-a-minit-pro', 'Badge-A-Minit', 'Pro Press (interchangeable dies)', {
    kind: 'button-press',
    substrates: ['button'],
    sizes: [B.r1, B.r15, B.r225, B.r3, B.r35]
  }),
  m('badge-a-minit-starter', 'Badge-A-Minit', 'Starter Kit (2¼")', {
    kind: 'button-press',
    substrates: ['button'],
    sizes: [B.r225]
  }),
  m(
    'tecre-press',
    'Tecre',
    'Button press (one size per model)',
    {
      kind: 'button-press',
      substrates: ['button'],
      sizes: [B.r1, B.r125, B.r15, B.r175, B.r2, B.r225, B.r3, B.r35]
    },
    'Each Tecre model is a single size — tick the models you have.'
  ),
  m('people-power-press', 'People Power Press', 'Button press', {
    kind: 'button-press',
    substrates: ['button'],
    sizes: [B.r1, B.r125, B.r15, B.r225]
  }),

  // Screen printing
  m('riley-hopkins-150', 'Riley Hopkins', '150 (1 colour, 1 station)', {
    kind: 'screen-printing-press',
    maxAreaIn: area(14, 16),
    maxColors: 1,
    whiteInk: true,
    substrates: [...ALL_GARMENTS, 'paper']
  }),
  m('riley-hopkins-250', 'Riley Hopkins', '250 (4 colour, 4 station)', {
    kind: 'screen-printing-press',
    maxAreaIn: area(14, 16),
    maxColors: 4,
    whiteInk: true,
    substrates: [...ALL_GARMENTS, 'paper']
  }),
  m('vastex-v-1000-4x4', 'Vastex', 'V-1000 (4 colour)', {
    kind: 'screen-printing-press',
    maxAreaIn: area(16, 18),
    maxColors: 4,
    whiteInk: true,
    substrates: [...ALL_GARMENTS, 'paper']
  }),
  m('vastex-v-1000-6x6', 'Vastex', 'V-1000 (6 colour)', {
    kind: 'screen-printing-press',
    maxAreaIn: area(16, 18),
    maxColors: 6,
    whiteInk: true,
    substrates: [...ALL_GARMENTS, 'paper']
  }),

  // 3D printers
  m('bambu-lab-x1-carbon', 'Bambu Lab', 'X1 Carbon', {
    kind: '3d-printer',
    buildVolumeIn: { widthIn: 10.1, depthIn: 10.1, heightIn: 10.1 },
    maxColors: 16,
    substrates: ['filament']
  }),
  m('bambu-lab-p1s', 'Bambu Lab', 'P1S', {
    kind: '3d-printer',
    buildVolumeIn: { widthIn: 10.1, depthIn: 10.1, heightIn: 10.1 },
    maxColors: 16,
    substrates: ['filament']
  }),
  m('bambu-lab-a1', 'Bambu Lab', 'A1', {
    kind: '3d-printer',
    buildVolumeIn: { widthIn: 10.1, depthIn: 10.1, heightIn: 10.1 },
    maxColors: 4,
    substrates: ['filament']
  }),
  m('bambu-lab-a1-mini', 'Bambu Lab', 'A1 mini', {
    kind: '3d-printer',
    buildVolumeIn: { widthIn: 7.1, depthIn: 7.1, heightIn: 7.1 },
    maxColors: 4,
    substrates: ['filament']
  }),
  m('prusa-core-one', 'Prusa', 'CORE One', {
    kind: '3d-printer',
    buildVolumeIn: { widthIn: 9.8, depthIn: 8.3, heightIn: 10.6 },
    substrates: ['filament']
  }),
  m('prusa-mk4s', 'Prusa', 'MK4S', {
    kind: '3d-printer',
    buildVolumeIn: { widthIn: 9.8, depthIn: 8.3, heightIn: 8.7 },
    substrates: ['filament']
  }),
  m('prusa-xl', 'Prusa', 'XL', {
    kind: '3d-printer',
    buildVolumeIn: { widthIn: 14.2, depthIn: 14.2, heightIn: 14.2 },
    maxColors: 5,
    substrates: ['filament']
  }),
  m('creality-ender-3-v3', 'Creality', 'Ender-3 V3', {
    kind: '3d-printer',
    buildVolumeIn: { widthIn: 8.7, depthIn: 8.7, heightIn: 9.8 },
    substrates: ['filament']
  }),
  m('formlabs-form-4', 'Formlabs', 'Form 4', {
    kind: '3d-printer',
    buildVolumeIn: { widthIn: 7.9, depthIn: 4.9, heightIn: 8.3 },
    substrates: ['resin']
  }),
  m('elegoo-saturn-4-ultra', 'Elegoo', 'Saturn 4 Ultra', {
    kind: '3d-printer',
    buildVolumeIn: { widthIn: 8.6, depthIn: 4.8, heightIn: 8.7 },
    substrates: ['resin']
  })
];

const BY_ID = new Map(EQUIPMENT_CATALOG.map((model) => [model.id, model]));

export function getCatalogModel(id: string | null | undefined): EquipmentCatalogModel | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/** Case-insensitive search over make, model, kind label and summary. */
export function searchCatalog(query: string, kind?: EquipmentKind | ''): EquipmentCatalogModel[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return EQUIPMENT_CATALOG.filter((entry) => {
    if (kind && entry.capabilities.kind !== kind) return false;
    if (words.length === 0) return true;
    const haystack = [
      entry.make,
      entry.model,
      KIND_LABELS[entry.capabilities.kind],
      entry.summary ?? ''
    ]
      .join(' ')
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** Kinds that appear in the catalog, in label order — for a filter dropdown. */
export function catalogKinds(): EquipmentKind[] {
  const kinds = new Set(EQUIPMENT_CATALOG.map((entry) => entry.capabilities.kind));
  return [...kinds].sort((a, b) => KIND_LABELS[a].localeCompare(KIND_LABELS[b]));
}

/** A deep copy, so a site's machine can be edited without touching the catalog. */
export function cloneCapabilities(capabilities: EquipmentCapabilities): EquipmentCapabilities {
  return structuredClone(capabilities);
}
