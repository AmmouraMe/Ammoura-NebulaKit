/**
 * motion — the builder's motion vocabulary.
 *
 * Sibling of `responsiveStyle()`: a component's motion props are serialized into
 * scoped `--motion-*` custom properties that the global `.motion` class
 * (src/lib/styles/motion.css) turns into real CSS. Same reason as F1's
 * responsive work — the values have to live in the database as plain JSON that
 * the builder can edit, and the browser has to be able to apply them without a
 * per-component stylesheet.
 *
 * Three independent things live here, and a component may use any combination:
 *
 * 1. **Reveal** (`MotionConfig`) — a one-shot entrance. The element starts in a
 *    preset "from" state and settles into its natural state when it is scrolled
 *    into view, or immediately on load.
 * 2. **Ambient** (`AmbientConfig`) — a looping keyframe animation that never
 *    ends: a float, a slow drift, a sheen across a wordmark.
 * 3. **Scroll** (`ScrollEffectConfig`) — motion tied to scroll position rather
 *    than to a clock: parallax, and a raw `--scroll-progress` (0..1) that other
 *    CSS on the element can read.
 *
 * ## Why nothing here hides anything by default
 *
 * The "from" state of a reveal is only applied under
 * `:root[data-motion-engine='on']`, an attribute set by a small inline script in
 * app.html. It is set only when scripting is available AND the visitor has not
 * asked for reduced motion. So:
 *
 * - **No JavaScript** — the attribute is never set, nothing is ever hidden, the
 *   page reads exactly as its markup.
 * - **Reduced motion** — same. Content is shown at rest, not hidden and not
 *   faded in. Reduced motion means *less movement*, never *less page*; a
 *   reveal that leaves `opacity: 0` behind is a blank site, and on iOS Reduce
 *   Motion is common enough that this is a real audience, not an edge case.
 * - **JavaScript, motion allowed** — the from-state is in the very first paint,
 *   so there is no flash of settled content before the reveal begins.
 *
 * Pure functions only: no DOM, no globals. The action in
 * `$lib/actions/motion.ts` does the observing; this module only produces
 * numbers and CSS strings, which is what makes it testable.
 */

/** The global class that consumes the emitted `--motion-*` vars. */
export const MOTION_CLASS = 'motion';

/** Set on `<html>` by app.html when motion may run at all. */
export const MOTION_ENGINE_ATTR = 'data-motion-engine';

/** Per-element reveal state: absent | 'pending' | 'in'. */
export const MOTION_STATE_ATTR = 'data-motion';

// --- reveal -----------------------------------------------------------------

/**
 * Directional names describe where the element comes FROM, not where it goes:
 * `fade-up` starts below its resting place and rises into it.
 */
export type MotionPreset =
  | 'fade'
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'blur-in'
  | 'rise';

export const MOTION_PRESETS = [
  'fade',
  'fade-up',
  'fade-down',
  'fade-left',
  'fade-right',
  'zoom-in',
  'zoom-out',
  'blur-in',
  'rise'
] as const;

export type MotionEasing = 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';

/** Named easings, including one that is not a CSS keyword. */
const EASING_CURVES: Record<MotionEasing, string> = {
  ease: 'ease',
  linear: 'linear',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
  // A gentle overshoot. Deliberately mild: a big bounce reads as a toy, and it
  // also overshoots the element's own box, which clips inside a container.
  spring: 'cubic-bezier(0.34, 1.32, 0.52, 1)'
};

export type MotionTrigger = 'scroll' | 'load';

export interface MotionConfig {
  /** Which entrance. Omitted or 'none' means no reveal at all. */
  preset?: MotionPreset;
  /** 'scroll' (default) waits until the element enters the viewport. */
  trigger?: MotionTrigger;
  /** Milliseconds the settle takes. */
  duration?: number;
  /** Milliseconds to wait before starting. */
  delay?: number;
  easing?: MotionEasing;
  /** Travel for the directional presets, in px. */
  distance?: number;
  /**
   * How much of the element must be showing before a scroll reveal fires, 0..1.
   * Small values suit tall sections, which never reach 50% on a phone.
   */
  threshold?: number;
  /** false replays the reveal every time the element re-enters. Default true. */
  once?: boolean;
  /** Milliseconds added per child index, for a container revealing its children. */
  stagger?: number;
}

/** Resolved reveal — every field present, every value in range. */
export interface ResolvedMotion {
  preset: MotionPreset;
  trigger: MotionTrigger;
  duration: number;
  delay: number;
  easing: string;
  distance: number;
  threshold: number;
  once: boolean;
  stagger: number;
}

export const MOTION_DEFAULTS = {
  preset: 'fade-up' as MotionPreset,
  trigger: 'scroll' as MotionTrigger,
  duration: 600,
  delay: 0,
  easing: 'ease-out' as MotionEasing,
  distance: 24,
  threshold: 0.15,
  once: true,
  stagger: 0
};

/** Hard ceilings. A 30-second fade is a bug report, not a design choice. */
const LIMITS = {
  duration: { min: 0, max: 4000 },
  delay: { min: 0, max: 5000 },
  distance: { min: 0, max: 400 },
  threshold: { min: 0, max: 1 },
  stagger: { min: 0, max: 1000 }
};

const clampTo = (value: number, { min, max }: { min: number; max: number }): number =>
  value < min ? min : value > max ? max : value;

/** A finite number, or the fallback. Guards against JSON holding null/"" /NaN. */
const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function resolveMotion(config: MotionConfig | undefined): ResolvedMotion | null {
  if (!config || !config.preset) return null;
  if (!(MOTION_PRESETS as readonly string[]).includes(config.preset)) return null;

  const easing =
    config.easing && EASING_CURVES[config.easing] ? config.easing : MOTION_DEFAULTS.easing;

  return {
    preset: config.preset,
    trigger: config.trigger === 'load' ? 'load' : 'scroll',
    duration: clampTo(num(config.duration, MOTION_DEFAULTS.duration), LIMITS.duration),
    delay: clampTo(num(config.delay, MOTION_DEFAULTS.delay), LIMITS.delay),
    easing: EASING_CURVES[easing],
    distance: clampTo(num(config.distance, MOTION_DEFAULTS.distance), LIMITS.distance),
    threshold: clampTo(num(config.threshold, MOTION_DEFAULTS.threshold), LIMITS.threshold),
    once: config.once !== false,
    stagger: clampTo(num(config.stagger, MOTION_DEFAULTS.stagger), LIMITS.stagger)
  };
}

/** The three properties a reveal animates, in their starting state. */
export interface MotionFromState {
  opacity: number;
  transform: string;
  filter: string;
}

const REST: MotionFromState = { opacity: 1, transform: 'none', filter: 'none' };

/**
 * The from-state for a preset.
 *
 * `translate3d` rather than `translate` throughout, and never a bare `top`/`left`:
 * transform and opacity are the only two properties a browser can animate without
 * touching layout, which is the whole reason these are the only two (plus filter,
 * for `blur-in`) that the vocabulary offers.
 */
export function motionFromState(preset: MotionPreset, distance: number): MotionFromState {
  const d = distance;
  switch (preset) {
    case 'fade':
      return { ...REST, opacity: 0 };
    case 'fade-up':
      return { opacity: 0, transform: `translate3d(0, ${d}px, 0)`, filter: 'none' };
    case 'fade-down':
      return { opacity: 0, transform: `translate3d(0, ${-d}px, 0)`, filter: 'none' };
    case 'fade-left':
      return { opacity: 0, transform: `translate3d(${-d}px, 0, 0)`, filter: 'none' };
    case 'fade-right':
      return { opacity: 0, transform: `translate3d(${d}px, 0, 0)`, filter: 'none' };
    case 'zoom-in':
      return { opacity: 0, transform: 'scale(0.92)', filter: 'none' };
    case 'zoom-out':
      return { opacity: 0, transform: 'scale(1.08)', filter: 'none' };
    case 'blur-in':
      return { opacity: 0, transform: 'none', filter: 'blur(12px)' };
    case 'rise':
      // A short lift off the page rather than a slide across it. The perspective
      // has to sit in the same transform as the rotate: a `perspective` property
      // on the parent would need the parent to opt in, and the parent here is a
      // generic wrapper that knows nothing about its child.
      return {
        opacity: 0,
        transform: `perspective(900px) rotateX(7deg) translate3d(0, ${d}px, 0)`,
        filter: 'none'
      };
    default:
      return REST;
  }
}

// --- ambient ----------------------------------------------------------------

export type AmbientName = 'float' | 'drift' | 'pulse' | 'breathe' | 'sheen' | 'spin' | 'twinkle';

export const AMBIENT_NAMES = [
  'float',
  'drift',
  'pulse',
  'breathe',
  'sheen',
  'spin',
  'twinkle'
] as const;

export interface AmbientConfig {
  name?: AmbientName;
  /** Milliseconds for one cycle. */
  duration?: number;
  delay?: number;
  easing?: MotionEasing;
  /** How far the movement travels, in px, for the presets that translate. */
  distance?: number;
  /** 0 or omitted means forever. */
  iterations?: number;
}

export interface ResolvedAmbient {
  name: AmbientName;
  duration: number;
  delay: number;
  easing: string;
  distance: number;
  iterations: number | 'infinite';
  direction: 'alternate' | 'normal';
}

/**
 * Presets are written one-way — rest to displaced — and played back by
 * `animation-direction: alternate`. Half the keyframes, and no jump at the loop
 * point, which is what makes a hand-written 0/50/100 float look mechanical.
 *
 * `spin` is the exception: a rotation that reverses is a pendulum. It runs one
 * way, and linearly, because eased rotation reads as a stutter.
 */
const ONE_WAY_AMBIENTS: ReadonlySet<AmbientName> = new Set<AmbientName>(['spin']);

const AMBIENT_DEFAULTS = {
  duration: 6000,
  delay: 0,
  easing: 'ease-in-out' as MotionEasing,
  distance: 10
};

const AMBIENT_LIMITS = {
  // A one-frame loop pins a core at 100%; a ten-minute loop is not motion.
  duration: { min: 200, max: 120000 },
  delay: { min: 0, max: 10000 },
  distance: { min: 0, max: 200 }
};

export function resolveAmbient(config: AmbientConfig | undefined): ResolvedAmbient | null {
  if (!config || !config.name) return null;
  if (!(AMBIENT_NAMES as readonly string[]).includes(config.name)) return null;

  const oneWay = ONE_WAY_AMBIENTS.has(config.name);
  const fallbackEasing: MotionEasing = oneWay ? 'linear' : AMBIENT_DEFAULTS.easing;
  const easing = config.easing && EASING_CURVES[config.easing] ? config.easing : fallbackEasing;
  const iterations = num(config.iterations, 0);

  return {
    name: config.name,
    duration: clampTo(num(config.duration, AMBIENT_DEFAULTS.duration), AMBIENT_LIMITS.duration),
    delay: clampTo(num(config.delay, AMBIENT_DEFAULTS.delay), AMBIENT_LIMITS.delay),
    easing: EASING_CURVES[easing],
    distance: clampTo(num(config.distance, AMBIENT_DEFAULTS.distance), AMBIENT_LIMITS.distance),
    iterations: iterations > 0 ? Math.floor(iterations) : 'infinite',
    direction: oneWay ? 'normal' : 'alternate'
  };
}

// --- scroll-linked ----------------------------------------------------------

export interface ScrollEffectConfig {
  /**
   * How far the element drifts against the scroll, as a percentage of the
   * viewport height. Positive lags behind the scroll (the classic "distant
   * background"), negative runs ahead of it. 0 or omitted disables parallax.
   */
  parallax?: number;
  /**
   * Publish `--scroll-progress` (0..1) on the element for other CSS to read.
   * Always on when parallax is set, since parallax is computed from it.
   */
  progress?: boolean;
}

export interface ResolvedScrollEffect {
  parallax: number;
  progress: boolean;
}

/** Beyond about a third of the viewport the element visibly detaches from the page. */
const PARALLAX_LIMIT = { min: -50, max: 50 };

export function resolveScrollEffect(
  config: ScrollEffectConfig | undefined
): ResolvedScrollEffect | null {
  if (!config) return null;
  const parallax = clampTo(num(config.parallax, 0), PARALLAX_LIMIT);
  const progress = config.progress === true || parallax !== 0;
  if (!progress && parallax === 0) return null;
  return { parallax, progress };
}

/**
 * How far an element has travelled through the viewport, 0..1.
 *
 * 0 is "the top edge of the element has just reached the bottom of the
 * viewport"; 1 is "its bottom edge has just left the top". The span is
 * therefore `viewportHeight + elementHeight`, not the viewport alone — an
 * element taller than the screen otherwise saturates at 1 for its whole middle
 * and the parallax stops dead while it is the only thing on screen.
 */
export function scrollProgress(
  elementTop: number,
  elementHeight: number,
  viewportHeight: number
): number {
  const span = viewportHeight + elementHeight;
  if (span <= 0) return 0;
  const travelled = viewportHeight - elementTop;
  return clampTo(travelled / span, { min: 0, max: 1 });
}

/**
 * Parallax offset in px for a given progress.
 *
 * Centred on 0.5 so the element sits exactly where the page laid it out when it
 * is in the middle of the screen. Anchoring at 0 instead would mean every
 * parallaxed element is drawn away from its own position for most of its life,
 * and a designer placing something would never get what they placed.
 */
export function parallaxOffset(progress: number, strength: number, viewportHeight: number): number {
  return (progress - 0.5) * (strength / 100) * viewportHeight;
}

// --- serialization ----------------------------------------------------------

export interface MotionStyleResult {
  /** '' when nothing is configured, so callers can use it as a truthiness test. */
  className: string;
  /** `--motion-*` declarations, `; `-joined, no trailing `;`. */
  style: string;
  /** True when a reveal needs the action to observe it. */
  hasReveal: boolean;
  /** True when scroll position has to be tracked. */
  hasScroll: boolean;
}

const EMPTY: MotionStyleResult = { className: '', style: '', hasReveal: false, hasScroll: false };

export interface MotionStyleInput {
  motion?: MotionConfig;
  ambient?: AmbientConfig;
  scrollEffect?: ScrollEffectConfig;
  /** Extra delay in ms, added to the reveal delay. Containers use it to stagger. */
  delayOffset?: number;
}

/**
 * Serialize motion props into the `.motion` class plus a scoped-var style string.
 *
 * Mirrors `responsiveStyle()` on purpose, including the "className is returned so
 * the caller spreads it" shape — a component should never have to know which
 * global class backs which utility.
 */
export function motionStyle(input: MotionStyleInput): MotionStyleResult {
  const reveal = resolveMotion(input.motion);
  const ambient = resolveAmbient(input.ambient);
  const scroll = resolveScrollEffect(input.scrollEffect);

  if (!reveal && !ambient && !scroll) return EMPTY;

  const declarations: string[] = [];

  if (reveal) {
    const from = motionFromState(reveal.preset, reveal.distance);
    const delay = clampTo(reveal.delay + num(input.delayOffset, 0), LIMITS.delay);
    declarations.push(
      `--motion-from-opacity: ${from.opacity}`,
      `--motion-from-transform: ${from.transform}`,
      `--motion-from-filter: ${from.filter}`,
      `--motion-duration: ${reveal.duration}ms`,
      `--motion-delay: ${delay}ms`,
      `--motion-easing: ${reveal.easing}`
    );
  }

  if (ambient) {
    // An ambient loop and a reveal usually both want `transform`, and an
    // animation beats a transition, so a float starting at once would swallow
    // the reveal it is meant to follow. Push the loop past the reveal's own
    // finish line instead of trying to share the property.
    const revealTotal = reveal ? reveal.delay + reveal.duration : 0;
    const ambientDelay = ambient.delay + revealTotal + num(input.delayOffset, 0);
    declarations.push(
      `--motion-ambient-name: ammoura-${ambient.name}`,
      `--motion-ambient-duration: ${ambient.duration}ms`,
      `--motion-ambient-delay: ${ambientDelay}ms`,
      `--motion-ambient-easing: ${ambient.easing}`,
      `--motion-ambient-distance: ${ambient.distance}px`,
      `--motion-ambient-iterations: ${ambient.iterations}`,
      `--motion-ambient-direction: ${ambient.direction}`
    );
  }

  if (scroll) {
    // Seeded so the first paint is correct before the action has measured
    // anything: mid-travel means zero parallax offset, i.e. where layout put it.
    declarations.push('--scroll-progress: 0.5', `--scroll-parallax: ${scroll.parallax}`);
  }

  return {
    className: MOTION_CLASS,
    style: declarations.join('; '),
    hasReveal: reveal !== null,
    hasScroll: scroll !== null
  };
}

/**
 * Pull the motion props off a component config.
 *
 * Kept here rather than in the renderer so that `ComponentConfig`'s loose
 * `Record`-ish shape is narrowed in exactly one place.
 */
export function motionInputFromConfig(
  config: {
    motion?: MotionConfig;
    ambient?: AmbientConfig;
    scrollEffect?: ScrollEffectConfig;
  },
  delayOffset = 0
): MotionStyleInput {
  return {
    motion: config.motion,
    ambient: config.ambient,
    scrollEffect: config.scrollEffect,
    delayOffset
  };
}

/** Re-exported for the builder's editors, which need the raw list. */
export const MOTION_EASINGS = Object.keys(EASING_CURVES) as MotionEasing[];
