/**
 * Capabilities arrive from the admin page as JSON. Keep only fields the fit
 * checks understand, with sane values, so a hand-made request cannot store
 * anything the storefront would later trust.
 */

import type {
  EquipmentCapabilities,
  EquipmentKind,
  EquipmentSize,
  Substrate
} from '$lib/types/equipmentCapabilities';
import { KIND_LABELS } from '$lib/data/equipmentCatalog';

const SUBSTRATES: Substrate[] = [
  'cotton',
  'polyester',
  'blend',
  'dark-garment',
  'hat',
  'paper',
  'cardstock',
  'sticker',
  'vinyl',
  'htv',
  'transfer-film',
  'mug',
  'tumbler',
  'hard-surface',
  'acrylic',
  'wood',
  'leather',
  'glass',
  'metal',
  'fabric',
  'button',
  'filament',
  'resin'
];
const SHAPES: EquipmentSize['shape'][] = [
  'round',
  'oval',
  'square',
  'rectangle',
  'heart',
  'cylinder'
];
const LASERS = ['co2', 'diode', 'fiber', 'infrared'] as const;
/** Larger than any real machine (a 1968" vinyl cut length is ~50 m); rejects nonsense. */
const MAX_INCHES = 5000;

function isKind(value: unknown): value is EquipmentKind {
  return typeof value === 'string' && value in KIND_LABELS;
}

function inches(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(n) && n > 0 && n <= MAX_INCHES ? Math.round(n * 1000) / 1000 : undefined;
}

function count(value: unknown, max: number): number | undefined {
  const n = typeof value === 'number' ? value : Number.NaN;
  return Number.isInteger(n) && n > 0 && n <= max ? n : undefined;
}

function rect(value: unknown): { widthIn: number; heightIn: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const widthIn = inches(v.widthIn);
  const heightIn = inches(v.heightIn);
  return widthIn && heightIn ? { widthIn, heightIn } : undefined;
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

function size(value: unknown): EquipmentSize | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const id = text(v.id, 40);
  const label = text(v.label, 60);
  const widthIn = inches(v.widthIn);
  const heightIn = inches(v.heightIn);
  const shape = SHAPES.includes(v.shape as EquipmentSize['shape'])
    ? (v.shape as EquipmentSize['shape'])
    : null;
  if (!id || !/^[a-z0-9.-]+$/.test(id) || !label || !widthIn || !heightIn || !shape) return null;
  const out: EquipmentSize = { id, label, shape, widthIn, heightIn };
  const aw = inches(v.artworkWidthIn);
  const ah = inches(v.artworkHeightIn);
  if (aw && ah) {
    out.artworkWidthIn = aw;
    out.artworkHeightIn = ah;
  }
  return out;
}

export function sanitizeCapabilities(input: unknown): EquipmentCapabilities | null {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  if (!isKind(v.kind)) return null;

  const out: EquipmentCapabilities = {
    kind: v.kind,
    substrates: Array.isArray(v.substrates)
      ? [...new Set(v.substrates.filter((s): s is Substrate => SUBSTRATES.includes(s)))]
      : []
  };

  const maxAreaIn = rect(v.maxAreaIn);
  if (maxAreaIn) out.maxAreaIn = maxAreaIn;
  const maxMediaWidthIn = inches(v.maxMediaWidthIn);
  if (maxMediaWidthIn) out.maxMediaWidthIn = maxMediaWidthIn;
  if (v.buildVolumeIn && typeof v.buildVolumeIn === 'object') {
    const b = v.buildVolumeIn as Record<string, unknown>;
    const [w, d, h] = [inches(b.widthIn), inches(b.depthIn), inches(b.heightIn)];
    if (w && d && h) out.buildVolumeIn = { widthIn: w, depthIn: d, heightIn: h };
  }
  const maxObjectHeightIn = inches(v.maxObjectHeightIn);
  if (maxObjectHeightIn) out.maxObjectHeightIn = maxObjectHeightIn;
  const maxDpi = count(v.maxDpi, 20000);
  if (maxDpi) out.maxDpi = maxDpi;
  if (Array.isArray(v.inks)) {
    const inks = v.inks.map((i) => text(i, 12)).filter((i): i is string => !!i);
    if (inks.length) out.inks = inks.slice(0, 16);
  }
  if (typeof v.whiteInk === 'boolean') out.whiteInk = v.whiteInk;
  const maxColors = count(v.maxColors, 64);
  if (maxColors) out.maxColors = maxColors;
  if (typeof v.cuts === 'boolean') out.cuts = v.cuts;
  if (LASERS.includes(v.laser as (typeof LASERS)[number])) {
    out.laser = v.laser as (typeof LASERS)[number];
  }
  const laserWatts = count(v.laserWatts, 10000);
  if (laserWatts) out.laserWatts = laserWatts;
  if (Array.isArray(v.sizes)) {
    const seen = new Set<string>();
    const sizes = v.sizes
      .map(size)
      .filter((s): s is EquipmentSize => !!s && !seen.has(s.id) && !!seen.add(s.id));
    if (sizes.length) out.sizes = sizes.slice(0, 50);
  }
  if (Array.isArray(v.needs)) {
    const needs = [...new Set(v.needs.filter(isKind))];
    if (needs.length) out.needs = needs;
  }
  return out;
}
