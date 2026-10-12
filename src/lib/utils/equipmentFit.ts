/**
 * Does this machine make that product? Pure checks over a machine's
 * capabilities and a product's print areas, shared by the admin equipment page
 * and the product editor.
 *
 * Errors mean the machine cannot make the product as authored (the print area
 * is bigger than the platen, it does not print on mugs). Warnings mean it can,
 * with a caveat the owner should know (no white ink, so light garments only).
 */

import type {
  EquipmentCapabilities,
  EquipmentKind,
  EquipmentSize,
  Substrate
} from '$lib/types/equipmentCapabilities';
import { KIND_LABELS } from '$lib/data/equipmentCatalog';

export type ProductFamily =
  'garment' | 'hat' | 'mug' | 'paper' | 'sticker' | 'button' | 'hard-good' | '3d' | 'unknown';

export interface PrintAreaSpec {
  name: string;
  widthIn: number;
  heightIn: number;
  requiredDpi?: number;
}

export interface ProductFitInput {
  family: ProductFamily;
  printAreas: PrintAreaSpec[];
  /** The size this product is made at, for size-based machines (button dies, mugs). */
  sizeId?: string | null;
}

export interface FitIssue {
  level: 'warning' | 'error';
  code:
    | 'too-large'
    | 'too-wide'
    | 'low-dpi'
    | 'wrong-substrate'
    | 'light-only'
    | 'size-missing'
    | 'size-not-owned';
  message: string;
}

export interface FitResult {
  level: 'ok' | 'warning' | 'error';
  issues: FitIssue[];
}

// --- Product family --------------------------------------------------------

const TEMPLATE_FAMILY: Record<string, ProductFamily> = {
  tee: 'garment',
  tshirt: 'garment',
  hoodie: 'garment',
  sweatshirt: 'garment',
  tote: 'garment',
  hat: 'hat',
  mug: 'mug',
  poster: 'paper',
  print: 'paper',
  card: 'paper',
  sticker: 'sticker',
  button: 'button'
};

const NAME_PATTERNS: [RegExp, ProductFamily][] = [
  [/\b(button|pin-?back|pins?|badges?)\b/i, 'button'],
  [/\b(mugs?|tumblers?|cups?)\b/i, 'mug'],
  [/\b(hats?|caps?|beanies?|snapbacks?|truckers?)\b/i, 'hat'],
  [/\b(stickers?|decals?|labels?)\b/i, 'sticker'],
  [
    /\b(t-?shirts?|tees?|shirts?|hoodies?|sweatshirts?|crewnecks?|tanks?|totes?|onesies?|jerseys?)\b/i,
    'garment'
  ],
  [/\b(posters?|prints?|cards?|postcards?|zines?|flyers?)\b/i, 'paper'],
  [/\b(coasters?|keychains?|ornaments?|plaques?|signs?|phone cases?)\b/i, 'hard-good'],
  [/\b(figurines?|miniatures?|3d)\b/i, '3d']
];

/**
 * What kind of thing a product is: from its template when it has one, else a
 * guess from its name ("1¼" Pin" is a button). 'unknown' skips the substrate check.
 */
export function inferProductFamily(
  templateType: string | null | undefined,
  name: string | null | undefined
): ProductFamily {
  if (templateType && TEMPLATE_FAMILY[templateType.toLowerCase()]) {
    return TEMPLATE_FAMILY[templateType.toLowerCase()];
  }
  for (const [pattern, family] of NAME_PATTERNS) {
    if (name && pattern.test(name)) return family;
  }
  return 'unknown';
}

const FAMILY_SUBSTRATES: Record<ProductFamily, Substrate[]> = {
  garment: ['cotton', 'polyester', 'blend', 'dark-garment', 'fabric'],
  hat: ['hat'],
  mug: ['mug', 'tumbler'],
  paper: ['paper', 'cardstock'],
  sticker: ['sticker', 'vinyl'],
  button: ['button'],
  'hard-good': ['hard-surface', 'acrylic', 'wood', 'leather', 'glass', 'metal'],
  '3d': ['filament', 'resin'],
  unknown: []
};

const FAMILY_LABELS: Record<ProductFamily, string> = {
  garment: 'garments',
  hat: 'hats',
  mug: 'mugs',
  paper: 'paper',
  sticker: 'stickers',
  button: 'buttons',
  'hard-good': 'hard goods',
  '3d': '3D prints',
  unknown: 'this product'
};

/**
 * What a machine's output ends up on. A DTF printer prints film, but the film is
 * pressed onto garments, so for fit purposes it makes garments; a vinyl cutter's
 * heat-transfer vinyl the same.
 */
export function effectiveSubstrates(capabilities: EquipmentCapabilities): Set<Substrate> {
  const out = new Set(capabilities.substrates);
  if (out.has('transfer-film') || out.has('htv')) {
    for (const s of FAMILY_SUBSTRATES.garment) out.add(s);
    out.add('hat');
  }
  return out;
}

// --- Fit -------------------------------------------------------------------

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function fitsRect(w: number, h: number, maxW: number, maxH: number): boolean {
  return (w <= maxW && h <= maxH) || (w <= maxH && h <= maxW);
}

function checkArea(capabilities: EquipmentCapabilities, area: PrintAreaSpec): FitIssue[] {
  const issues: FitIssue[] = [];
  const dims = `${fmt(area.widthIn)}" × ${fmt(area.heightIn)}"`;
  const { maxAreaIn, maxMediaWidthIn } = capabilities;

  if (maxAreaIn) {
    if (!fitsRect(area.widthIn, area.heightIn, maxAreaIn.widthIn, maxAreaIn.heightIn)) {
      issues.push({
        level: 'error',
        code: 'too-large',
        message: `${area.name} is ${dims}; this machine's largest area is ${fmt(maxAreaIn.widthIn)}" × ${fmt(maxAreaIn.heightIn)}".`
      });
    }
  } else if (maxMediaWidthIn) {
    if (Math.min(area.widthIn, area.heightIn) > maxMediaWidthIn) {
      issues.push({
        level: 'error',
        code: 'too-wide',
        message: `${area.name} is ${dims}; this machine takes media up to ${fmt(maxMediaWidthIn)}" wide.`
      });
    }
  }

  if (area.requiredDpi && capabilities.maxDpi && capabilities.maxDpi < area.requiredDpi) {
    issues.push({
      level: 'warning',
      code: 'low-dpi',
      message: `${area.name} asks for ${area.requiredDpi} dpi; this machine prints at up to ${capabilities.maxDpi} dpi.`
    });
  }
  return issues;
}

const PRINTS_COLOUR_ON_GARMENTS: EquipmentKind[] = ['dtg-printer', 'sublimation-printer'];

/** Check one machine against one product. */
export function checkProductFit(
  capabilities: EquipmentCapabilities,
  product: ProductFitInput
): FitResult {
  const issues: FitIssue[] = [];
  const kindLabel = KIND_LABELS[capabilities.kind] ?? 'This machine';

  // What it is made of.
  if (product.family !== 'unknown' && capabilities.kind !== 'other') {
    const wanted = FAMILY_SUBSTRATES[product.family];
    const has = effectiveSubstrates(capabilities);
    if (!wanted.some((s) => has.has(s))) {
      issues.push({
        level: 'error',
        code: 'wrong-substrate',
        message: `A ${kindLabel.toLowerCase()} does not make ${FAMILY_LABELS[product.family]}.`
      });
    } else if (
      product.family === 'garment' &&
      PRINTS_COLOUR_ON_GARMENTS.includes(capabilities.kind) &&
      !capabilities.whiteInk
    ) {
      issues.push({
        level: 'warning',
        code: 'light-only',
        message:
          capabilities.kind === 'sublimation-printer'
            ? 'Sublimation only works on white or light polyester.'
            : 'No white ink — light-coloured garments only.'
      });
    }
  }

  // Size-based machines: the product is made at one of the sizes the owner has.
  if (capabilities.sizes && capabilities.sizes.length > 0) {
    if (!product.sizeId) {
      issues.push({
        level: 'warning',
        code: 'size-missing',
        message: 'Choose which size this product is made at.'
      });
    } else if (!capabilities.sizes.some((s) => s.id === product.sizeId)) {
      issues.push({
        level: 'error',
        code: 'size-not-owned',
        message: 'That size is not one this machine has.'
      });
    }
  } else {
    for (const area of product.printAreas) issues.push(...checkArea(capabilities, area));
  }

  const level = issues.some((i) => i.level === 'error')
    ? 'error'
    : issues.length > 0
      ? 'warning'
      : 'ok';
  return { level, issues };
}

// --- Sizes -----------------------------------------------------------------

const FRACTIONS: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75 };

/**
 * Pick the owned size a product name points at — "1.25 inch pin", "2¼" Button",
 * "11oz mug". Null when nothing in the name matches.
 */
export function guessSizeFromName(
  name: string | null | undefined,
  sizes: EquipmentSize[] | undefined
): EquipmentSize | null {
  if (!name || !sizes || sizes.length === 0) return null;

  const oz = name.match(/(\d+)\s*-?\s*oz\b/i);
  if (oz) {
    const hit = sizes.find((s) => s.id === `mug-${oz[1]}oz`);
    if (hit) return hit;
  }

  const numbers: number[] = [];
  // "1 1/4" first, or its leading "1" would win.
  for (const match of name.matchAll(/(\d+)[\s-]+(\d)\/(\d)/g)) {
    numbers.push(Number(match[1]) + Number(match[2]) / Number(match[3]));
  }
  for (const match of name.matchAll(/(\d+(?:\.\d+)?)\s*([¼½¾])?/g)) {
    numbers.push(Number(match[1]) + (match[2] ? FRACTIONS[match[2]] : 0));
  }
  for (const n of numbers) {
    const hit = sizes.find((s) => s.widthIn === n || s.heightIn === n);
    if (hit) return hit;
  }
  return null;
}

// --- Whole shop ------------------------------------------------------------

export interface ShopMachine {
  name: string;
  isActive: boolean;
  capabilities: EquipmentCapabilities | null;
}

/** Kinds that satisfy a need: a mug press or hat press does a heat press's job for its product. */
const SATISFIES: Partial<Record<EquipmentKind, EquipmentKind[]>> = {
  'heat-press': ['heat-press', 'mug-press', 'hat-press']
};

/**
 * Machines whose output needs another machine the shop does not have — a DTF
 * printer with no heat press makes transfers, not shirts.
 */
export function workflowGaps(machines: ShopMachine[]): string[] {
  const active = machines.filter((mc) => mc.isActive && mc.capabilities);
  const kinds = new Set(active.map((mc) => mc.capabilities!.kind));
  const gaps: string[] = [];
  for (const mc of active) {
    for (const need of mc.capabilities!.needs ?? []) {
      const ok = (SATISFIES[need] ?? [need]).some((k) => kinds.has(k));
      if (!ok) {
        gaps.push(
          `${mc.name} needs a ${KIND_LABELS[need].toLowerCase()} to turn its prints into finished products.`
        );
      }
    }
  }
  return gaps;
}

/** Order machines best fit first, for the product editor's suggestions. */
export function rankMachines<T extends { capabilities: EquipmentCapabilities | null }>(
  machines: T[],
  product: ProductFitInput
): { machine: T; fit: FitResult | null }[] {
  const order = { ok: 0, warning: 1, error: 2 };
  return machines
    .map((machine) => ({
      machine,
      fit: machine.capabilities ? checkProductFit(machine.capabilities, product) : null
    }))
    .sort((a, b) => (a.fit ? order[a.fit.level] : 1) - (b.fit ? order[b.fit.level] : 1));
}

/** Short human summary of what a machine does, for cards and pickers. */
export function describeCapabilities(capabilities: EquipmentCapabilities): string[] {
  const out: string[] = [];
  const c = capabilities;
  if (c.maxAreaIn) out.push(`${fmt(c.maxAreaIn.widthIn)}" × ${fmt(c.maxAreaIn.heightIn)}" max`);
  else if (c.maxMediaWidthIn) out.push(`${fmt(c.maxMediaWidthIn)}" wide media`);
  if (c.buildVolumeIn) {
    const v = c.buildVolumeIn;
    out.push(`${fmt(v.widthIn)}" × ${fmt(v.depthIn)}" × ${fmt(v.heightIn)}" build`);
  }
  if (c.maxObjectHeightIn) out.push(`objects to ${fmt(c.maxObjectHeightIn)}" tall`);
  if (c.maxDpi) out.push(`${c.maxDpi} dpi`);
  if (c.whiteInk) out.push('white ink');
  if (c.maxColors && c.kind !== '3d-printer') {
    out.push(
      c.kind === 'embroidery-machine'
        ? `${c.maxColors} needle${c.maxColors === 1 ? '' : 's'}`
        : `${c.maxColors} colour${c.maxColors === 1 ? '' : 's'}`
    );
  }
  if (c.maxColors && c.kind === '3d-printer') out.push(`up to ${c.maxColors} filaments`);
  if (c.laser) out.push(`${c.laserWatts ? `${c.laserWatts} W ` : ''}${c.laser} laser`);
  if (c.cuts && c.kind !== 'vinyl-cutter' && c.kind !== 'laser-engraver') out.push('cuts');
  if (c.sizes && c.sizes.length > 0) out.push(c.sizes.map((s) => s.label).join(', '));
  return out;
}
