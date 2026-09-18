/**
 * The maths behind the `scene` builtin — an ambient, generative backdrop.
 *
 * This is the thing a hand-built site has and a builder normally does not: a
 * background that is alive rather than a flat colour or a photograph. Three
 * variants, sharing one loop and one canvas:
 *
 * - **stars**  — a field of points that twinkle, drift and parallax by depth
 * - **aurora** — soft coloured blobs moving slowly behind everything
 * - **grid**   — a perspective grid receding to a horizon
 *
 * The starfield is ported from the one proved on customperfections.com
 * (`site/src/lib/landing-scene.ts` in that project), which is where the depth
 * model and the wrapping came from. Its constants survived real phones; they are
 * kept rather than re-guessed, and the comments say which ones earned their
 * value.
 *
 * Pure functions only: no DOM, no canvas, no globals. `Scene.svelte` measures,
 * passes numbers in, and draws what comes back. A generative background that can
 * only be checked by looking at it is a background nobody checks.
 */

/** Clamp, used everywhere below. */
export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export type SceneVariant = 'stars' | 'aurora' | 'grid';

export const SCENE_VARIANTS = ['stars', 'aurora', 'grid'] as const;

/**
 * What the scene is being drawn into, and how far it has been pushed.
 *
 * Sizes are in device pixels — the canvas backing store — not CSS pixels, so
 * everything below is already at the resolution it will be drawn at.
 */
export interface SceneView {
  width: number;
  height: number;
  dpr: number;
  /** Pointer parallax, in device pixels. */
  offsetX: number;
  offsetY: number;
}

/**
 * The builder's 0..100 dials, normalised.
 *
 * The panel offers "density" and "speed" as plain percentages because that is
 * what someone choosing a backdrop wants to say. Everything that follows works
 * in real units, so the conversion happens once, here.
 */
export interface SceneSettings {
  density: number;
  speed: number;
}

export const SCENE_DEFAULTS = { density: 50, speed: 50 };

/** 0..100 -> 0..2, where 50 is 1. Keeps the middle of the slider the design. */
export const scaleFactor = (dial: number): number => clamp(dial, 0, 100) / 50;

// --- device pixel ratio -----------------------------------------------------

/**
 * How much backing store to allocate.
 *
 * A full-bleed backdrop on a 3x phone at native resolution is a lot of pixels to
 * repaint sixty times a second for something nobody is looking at directly. The
 * cap costs nothing visually — the content is soft points and gradients, not
 * text — and is the difference between a warm phone and a cold one.
 */
export const cappedDpr = (dpr: number, mobile: boolean): number =>
  clamp(dpr || 1, 1, mobile ? 2 : 2.5);

// --- stars ------------------------------------------------------------------

/**
 * One ambient star. `depth` (0 far .. 1 near) drives size, brightness and how
 * much it parallaxes — nearer stars are bigger, brighter and move more, which is
 * what sells depth. A field that all moves together just slides.
 */
export interface Star {
  /** Position in field units, 0..1 on each axis. */
  x: number;
  y: number;
  depth: number;
  /** Index into the scene's colour list, so colours can change without respawning. */
  color: number;
  /** Twinkle phase and rate. */
  phase: number;
  twinkle: number;
  /** Drift per frame, in field units. */
  vx: number;
  vy: number;
}

/** A star's screen position and brightness for one frame. */
export interface StarPoint {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

export function makeStar(rand: () => number, colorCount: number): Star {
  return {
    x: rand(),
    y: rand(),
    depth: rand(),
    color: colorCount > 0 ? Math.floor(rand() * colorCount) % colorCount : 0,
    phase: rand() * Math.PI * 2,
    twinkle: 0.006 + rand() * 0.018,
    // Field units per frame. At 60fps this is about one screen-width every four
    // minutes: movement you notice only if you stare, which is the point.
    vx: (rand() * 2 - 1) * 0.00005,
    vy: (rand() * 2 - 1) * 0.00005
  };
}

/**
 * How many stars a viewport gets.
 *
 * Capped as well as scaled: a 2K monitor should not pay for four thousand of
 * them, and a phone gets a thinner field again because it is drawing on a
 * smaller battery. The area divisor is what keeps the *visual* density constant
 * across screen sizes — a fixed count would be a crowd on a phone and a sprinkle
 * on a desktop.
 */
export function starCount(width: number, height: number, mobile: boolean, density = 50): number {
  const factor = scaleFactor(density);
  const cap = (mobile ? 110 : 260) * factor;
  const natural = (width * height) / (mobile ? 8000 : 5200);
  return Math.max(0, Math.floor(Math.min(cap, natural * factor)));
}

/** Drift, wrapping at the field edges so the field never empties on one side. */
export function driftStar(star: Star, speed = 50): void {
  const factor = scaleFactor(speed);
  star.x += star.vx * factor;
  if (star.x < 0) star.x += 1;
  else if (star.x > 1) star.x -= 1;
  star.y += star.vy * factor;
  if (star.y < 0) star.y += 1;
  else if (star.y > 1) star.y -= 1;
}

/**
 * Where a star sits and how bright it is this frame.
 *
 * The pointer offset scales with depth and deliberately does not wrap — it is
 * small and springs back. `0.3 +` rather than bare depth so that even the
 * furthest stars move a little; a layer that is perfectly still reads as a
 * texture stuck to the glass.
 */
export function starAt(star: Star, view: SceneView, tick: number): StarPoint {
  return {
    x: star.x * view.width + view.offsetX * (0.3 + star.depth),
    y: star.y * view.height + view.offsetY * (0.3 + star.depth),
    size: Math.max(0.6, (0.5 + star.depth * 1.7) * view.dpr * 1.3),
    alpha: Math.min(
      1,
      (0.32 + star.depth * 0.68) * (0.55 + 0.45 * Math.sin(star.phase + tick * star.twinkle))
    )
  };
}

// --- aurora -----------------------------------------------------------------

/**
 * One soft blob of colour. Aurora is three or four of these, large, very
 * transparent, drifting on independent Lissajous paths so the composite never
 * repeats in any period an eye would notice.
 */
export interface Blob {
  color: number;
  /** Centre of the path, in field units. */
  cx: number;
  cy: number;
  /** How far it wanders from that centre, in field units. */
  rx: number;
  ry: number;
  /** Angular rates; deliberately incommensurable so the path does not close. */
  fx: number;
  fy: number;
  phase: number;
  /** Radius as a fraction of the smaller viewport dimension. */
  size: number;
}

export function makeBlob(rand: () => number, index: number, colorCount: number): Blob {
  return {
    color: colorCount > 0 ? index % colorCount : 0,
    cx: 0.2 + rand() * 0.6,
    cy: 0.2 + rand() * 0.6,
    rx: 0.1 + rand() * 0.2,
    ry: 0.1 + rand() * 0.2,
    // Rates near each other but not in ratio: a path that closes is a loop you
    // can see, and the whole effect depends on never quite repeating.
    fx: 0.00007 + rand() * 0.00009,
    fy: 0.00005 + rand() * 0.00011,
    phase: rand() * Math.PI * 2,
    size: 0.35 + rand() * 0.35
  };
}

/** How many blobs. Few and large — many and small is fog, not aurora. */
export function blobCount(density = 50): number {
  return clamp(Math.round(2 + scaleFactor(density) * 2), 2, 6);
}

export interface BlobPoint {
  x: number;
  y: number;
  radius: number;
}

export function blobAt(blob: Blob, view: SceneView, tick: number, speed = 50): BlobPoint {
  const t = tick * scaleFactor(speed);
  const minSide = Math.min(view.width, view.height);
  return {
    x: (blob.cx + Math.sin(t * blob.fx + blob.phase) * blob.rx) * view.width + view.offsetX * 0.5,
    y: (blob.cy + Math.cos(t * blob.fy + blob.phase) * blob.ry) * view.height + view.offsetY * 0.5,
    radius: blob.size * minSide
  };
}

// --- grid -------------------------------------------------------------------

export interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

/**
 * A perspective grid receding to a horizon at the top of the box.
 *
 * Verticals converge on a vanishing point; horizontals are spaced by a power
 * curve so they bunch towards the horizon the way real perspective does. Even
 * spacing is the giveaway that turns a perspective grid into a ladder.
 *
 * The whole thing scrolls by `offset` (0..1, one cell), so the caller animates a
 * single number and the grid appears to travel forever without any line ever
 * being created or destroyed.
 */
export function gridLines(view: SceneView, offset: number, density = 50): GridLine[] {
  const factor = scaleFactor(density);
  const columns = clamp(Math.round(10 * factor), 4, 40);
  const rows = clamp(Math.round(12 * factor), 4, 40);
  const horizon = view.height * 0.32;
  const vanishX = view.width / 2 + view.offsetX * 0.4;
  const lines: GridLine[] = [];

  for (let i = 0; i <= columns; i++) {
    const x = (i / columns) * view.width * 2 - view.width * 0.5;
    lines.push({
      x1: vanishX,
      y1: horizon,
      x2: x + view.offsetX,
      y2: view.height,
      // Fading the outermost verticals stops the grid ending in a hard edge at
      // the sides of the box, which reads as a texture rather than a space.
      alpha: 1 - Math.abs(i / columns - 0.5) * 1.2
    });
  }

  const wrapped = offset - Math.floor(offset);
  for (let i = 0; i < rows; i++) {
    // Power curve: t near 0 is the horizon, near 1 is the viewer.
    const t = (i + wrapped) / rows;
    const y = horizon + Math.pow(t, 2.4) * (view.height - horizon);
    lines.push({
      x1: 0,
      y1: y,
      x2: view.width,
      y2: y,
      // Nearest rows brightest; the ones about to reach the horizon fade out so
      // no line ever pops into existence at the vanishing point.
      alpha: Math.min(1, t * 1.6)
    });
  }

  return lines.filter((line) => line.alpha > 0);
}

// --- seeded randomness ------------------------------------------------------

/**
 * A small deterministic PRNG (mulberry32).
 *
 * The scene must look the same on the server-rendered page, in the builder
 * preview and after a reload, or a tenant places content against a backdrop
 * that is different every time they look at it. `Math.random` cannot do that.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable seed from a component id, so each scene differs but never changes. */
export function seedFrom(id: string | undefined): number {
  if (!id) return 1;
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}
