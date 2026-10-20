/**
 * What a piece of production equipment can physically do.
 *
 * Kept apart from `equipment.ts` because the catalog (`$lib/data/equipmentCatalog`)
 * and the fit checks (`$lib/utils/equipmentFit`) run in the browser too, and
 * neither needs the DB row shapes.
 *
 * Every measurement is in inches, matching the design studio's `Placement` and
 * `DesignArea`, so a product's print area and a machine's bed compare directly.
 */

/** The family a machine belongs to. Drives which capability fields matter. */
export type EquipmentKind =
  | 'dtg-printer'
  | 'dtf-printer'
  | 'sublimation-printer'
  | 'uv-printer'
  | 'eco-solvent-printer'
  | 'photo-printer'
  | 'white-toner-printer'
  | 'label-printer'
  | 'vinyl-cutter'
  | 'laser-engraver'
  | 'embroidery-machine'
  | 'heat-press'
  | 'mug-press'
  | 'hat-press'
  | 'button-press'
  | 'screen-printing-press'
  | '3d-printer'
  | 'other';

/** What the machine prints, cuts, presses or builds on. */
export type Substrate =
  | 'cotton'
  | 'polyester'
  | 'blend'
  | 'dark-garment'
  | 'hat'
  | 'paper'
  | 'cardstock'
  | 'sticker'
  | 'vinyl'
  | 'htv'
  | 'transfer-film'
  | 'mug'
  | 'tumbler'
  | 'hard-surface'
  | 'acrylic'
  | 'wood'
  | 'leather'
  | 'glass'
  | 'metal'
  | 'fabric'
  | 'button'
  | 'filament'
  | 'resin';

/** A fixed size the machine makes — a button die, a mug size, a press platen. */
export interface EquipmentSize {
  /** Stable key, e.g. `round-1.25` — what `product_equipment.size_id` stores. */
  id: string;
  label: string;
  shape: 'round' | 'oval' | 'square' | 'rectangle' | 'heart' | 'cylinder';
  /** Finished size. */
  widthIn: number;
  heightIn: number;
  /**
   * Artwork size including wrap/bleed, when it differs from the finished size —
   * a 1.25" button needs a ~1.625" printed circle to wrap the shell.
   */
  artworkWidthIn?: number;
  artworkHeightIn?: number;
}

export interface EquipmentCapabilities {
  kind: EquipmentKind;
  /** Largest printable / cuttable / pressable area. Omitted when sizes govern instead. */
  maxAreaIn?: { widthIn: number; heightIn: number };
  /** Roll or sheet width for roll-fed machines; length is effectively unlimited. */
  maxMediaWidthIn?: number;
  /** Build volume, 3D printers only. */
  buildVolumeIn?: { widthIn: number; depthIn: number; heightIn: number };
  /** Max object height on a flatbed (UV, laser). */
  maxObjectHeightIn?: number;
  /** Native print resolution (dpi); for fit checks against a print area's required DPI. */
  maxDpi?: number;
  /** Ink or toner channels, e.g. ['C','M','Y','K','W']. */
  inks?: string[];
  /** Prints white — what lets a printer put colour on a dark garment or clear film. */
  whiteInk?: boolean;
  /** Embroidery needles / screen stations — the number of colours in one run. */
  maxColors?: number;
  /** Also cuts (print-and-cut machines). */
  cuts?: boolean;
  /** Laser source, laser engravers only. */
  laser?: 'co2' | 'diode' | 'fiber' | 'infrared';
  laserWatts?: number;
  substrates: Substrate[];
  /** Fixed sizes. In the catalog: every size the model can take. On a site's machine: the ones it owns. */
  sizes?: EquipmentSize[];
  /**
   * Other kinds this machine's output needs before it is a product — a DTF print
   * is a film until a heat press puts it on a shirt.
   */
  needs?: EquipmentKind[];
}

export interface EquipmentCatalogModel {
  /** Stable key, e.g. `epson-surecolor-f2270`. Stored as `equipment.catalog_model_id`. */
  id: string;
  make: string;
  model: string;
  capabilities: EquipmentCapabilities;
  /** One line on what it is good for. */
  summary?: string;
}
