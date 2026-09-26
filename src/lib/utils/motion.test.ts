import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  AMBIENT_NAMES,
  MOTION_CLASS,
  MOTION_PRESETS,
  motionFromState,
  motionInputFromConfig,
  motionStyle,
  parallaxOffset,
  resolveAmbient,
  resolveMotion,
  resolveScrollEffect,
  scrollProgress,
  type MotionPreset
} from './motion';

const motionCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../styles/motion.css'),
  'utf-8'
);

describe('resolveMotion', () => {
  it('is null without a preset, so an untouched component has no motion', () => {
    expect(resolveMotion(undefined)).toBeNull();
    expect(resolveMotion({})).toBeNull();
  });

  it('rejects a preset it does not know rather than emitting a broken from-state', () => {
    expect(resolveMotion({ preset: 'explode' as MotionPreset })).toBeNull();
  });

  it('fills every field so callers never re-apply defaults', () => {
    const resolved = resolveMotion({ preset: 'fade' });
    expect(resolved).toMatchObject({
      preset: 'fade',
      trigger: 'scroll',
      duration: 600,
      delay: 0,
      distance: 24,
      once: true,
      stagger: 0
    });
    expect(resolved?.easing).toBe('ease-out');
  });

  it('clamps values that would make a page feel broken', () => {
    const resolved = resolveMotion({
      preset: 'fade',
      duration: 999999,
      delay: -100,
      distance: 5000,
      threshold: 4,
      stagger: -5
    });
    expect(resolved?.duration).toBe(4000);
    expect(resolved?.delay).toBe(0);
    expect(resolved?.distance).toBe(400);
    expect(resolved?.threshold).toBe(1);
    expect(resolved?.stagger).toBe(0);
  });

  it('survives the nulls and strings that come back out of a JSON column', () => {
    const resolved = resolveMotion({
      preset: 'fade',
      duration: null as unknown as number,
      delay: '250' as unknown as number,
      distance: NaN
    });
    expect(resolved?.duration).toBe(600);
    expect(resolved?.delay).toBe(0);
    expect(resolved?.distance).toBe(24);
  });

  it('translates the spring easing into a real curve', () => {
    expect(resolveMotion({ preset: 'fade', easing: 'spring' })?.easing).toMatch(/^cubic-bezier/);
  });

  it('only accepts load as an alternative trigger', () => {
    expect(resolveMotion({ preset: 'fade', trigger: 'load' })?.trigger).toBe('load');
    expect(resolveMotion({ preset: 'fade', trigger: 'hover' as 'load' })?.trigger).toBe('scroll');
  });

  it('treats once as opt-out, not opt-in', () => {
    expect(resolveMotion({ preset: 'fade' })?.once).toBe(true);
    expect(resolveMotion({ preset: 'fade', once: false })?.once).toBe(false);
  });
});

describe('motionFromState', () => {
  it('starts every preset invisible, which is what there is to reveal', () => {
    for (const preset of MOTION_PRESETS) {
      expect(motionFromState(preset, 24).opacity).toBe(0);
    }
  });

  it('only ever animates opacity, transform and filter', () => {
    // The three properties a browser can animate off the main thread. Anything
    // else in a from-state would mean a reveal causing layout on every frame.
    for (const preset of MOTION_PRESETS) {
      expect(Object.keys(motionFromState(preset, 24)).sort()).toEqual([
        'filter',
        'opacity',
        'transform'
      ]);
    }
  });

  it('names the direction the element comes FROM', () => {
    expect(motionFromState('fade-up', 40).transform).toBe('translate3d(0, 40px, 0)');
    expect(motionFromState('fade-down', 40).transform).toBe('translate3d(0, -40px, 0)');
    expect(motionFromState('fade-left', 40).transform).toBe('translate3d(-40px, 0, 0)');
    expect(motionFromState('fade-right', 40).transform).toBe('translate3d(40px, 0, 0)');
  });

  it('zooms in from smaller and out from larger', () => {
    expect(motionFromState('zoom-in', 24).transform).toBe('scale(0.92)');
    expect(motionFromState('zoom-out', 24).transform).toBe('scale(1.08)');
  });

  it('carries its own perspective on rise, since the parent cannot be asked for one', () => {
    expect(motionFromState('rise', 30).transform).toContain('perspective(');
  });

  it('blur-in is the only preset that touches filter', () => {
    for (const preset of MOTION_PRESETS) {
      const { filter } = motionFromState(preset, 24);
      expect(filter).toBe(preset === 'blur-in' ? 'blur(12px)' : 'none');
    }
  });
});

describe('resolveAmbient', () => {
  it('is null without a name, and for a name it does not know', () => {
    expect(resolveAmbient(undefined)).toBeNull();
    expect(resolveAmbient({})).toBeNull();
    expect(resolveAmbient({ name: 'wobble' as 'float' })).toBeNull();
  });

  it('loops forever unless given a count', () => {
    expect(resolveAmbient({ name: 'float' })?.iterations).toBe('infinite');
    expect(resolveAmbient({ name: 'float', iterations: 3 })?.iterations).toBe(3);
    expect(resolveAmbient({ name: 'float', iterations: 0 })?.iterations).toBe('infinite');
  });

  it('alternates every preset except spin, which would otherwise be a pendulum', () => {
    for (const name of AMBIENT_NAMES) {
      const resolved = resolveAmbient({ name });
      expect(resolved?.direction).toBe(name === 'spin' ? 'normal' : 'alternate');
    }
  });

  it('gives spin a linear curve, because eased rotation reads as a stutter', () => {
    expect(resolveAmbient({ name: 'spin' })?.easing).toBe('linear');
    expect(resolveAmbient({ name: 'float' })?.easing).toBe('ease-in-out');
  });

  it('still lets an author override spin back to an eased curve', () => {
    expect(resolveAmbient({ name: 'spin', easing: 'ease-in-out' })?.easing).toBe('ease-in-out');
  });

  it('refuses a duration short enough to pin a CPU core', () => {
    expect(resolveAmbient({ name: 'float', duration: 1 })?.duration).toBe(200);
  });

  it('has a keyframe block in motion.css for every name it accepts', () => {
    for (const name of AMBIENT_NAMES) {
      expect(motionCss).toContain(`@keyframes ammoura-${name}`);
    }
  });
});

describe('resolveScrollEffect', () => {
  it('is null when there is nothing to track', () => {
    expect(resolveScrollEffect(undefined)).toBeNull();
    expect(resolveScrollEffect({})).toBeNull();
    expect(resolveScrollEffect({ parallax: 0 })).toBeNull();
  });

  it('turns progress on implicitly, because parallax is computed from it', () => {
    expect(resolveScrollEffect({ parallax: 20 })).toEqual({ parallax: 20, progress: true });
  });

  it('allows progress on its own, for CSS that reads the variable directly', () => {
    expect(resolveScrollEffect({ progress: true })).toEqual({ parallax: 0, progress: true });
  });

  it('clamps parallax before the element visibly detaches from the page', () => {
    expect(resolveScrollEffect({ parallax: 400 })?.parallax).toBe(50);
    expect(resolveScrollEffect({ parallax: -400 })?.parallax).toBe(-50);
  });
});

describe('scrollProgress', () => {
  const viewport = 800;

  it('is 0 the moment before the element appears at the bottom', () => {
    expect(scrollProgress(viewport, 200, viewport)).toBe(0);
  });

  it('is 1 the moment after the element leaves the top', () => {
    expect(scrollProgress(-200, 200, viewport)).toBe(1);
  });

  it('is 0.5 when the element is centred', () => {
    // top = (viewport - height) / 2 puts a 200px element in the middle of an 800px screen
    expect(scrollProgress(300, 200, viewport)).toBeCloseTo(0.5, 5);
  });

  it('keeps moving through an element taller than the screen', () => {
    // The span is viewport + height, so a 2000px section on an 800px screen still
    // advances the whole way instead of saturating for its entire middle.
    const tall = 2000;
    const mid = scrollProgress(-tall / 2 + viewport / 2, tall, viewport);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(scrollProgress(viewport, tall, viewport)).toBe(0);
    expect(scrollProgress(-tall, tall, viewport)).toBe(1);
  });

  it('never leaves 0..1, however far past the element the page is scrolled', () => {
    expect(scrollProgress(99999, 100, viewport)).toBe(0);
    expect(scrollProgress(-99999, 100, viewport)).toBe(1);
  });

  it('is 0 rather than NaN when there is no viewport to travel through', () => {
    expect(scrollProgress(0, 0, 0)).toBe(0);
  });
});

describe('parallaxOffset', () => {
  it('is zero at mid-travel, so an element sits where layout put it', () => {
    expect(parallaxOffset(0.5, 30, 800)).toBe(0);
  });

  it('is symmetric about the centre', () => {
    expect(parallaxOffset(0, 20, 800)).toBe(-parallaxOffset(1, 20, 800));
  });

  it('reads strength as a percentage of the viewport height', () => {
    // progress 1, 25% of an 800px viewport, half the travel each side of centre
    expect(parallaxOffset(1, 25, 800)).toBeCloseTo(100, 5);
  });

  it('reverses with a negative strength', () => {
    expect(parallaxOffset(1, -25, 800)).toBeCloseTo(-100, 5);
  });

  it('agrees with the calc() in motion.css', () => {
    // The CSS does the same sum in the browser; if either side is edited alone
    // the parallax silently stops matching what the tests describe.
    expect(motionCss).toContain(
      'calc((var(--scroll-progress, 0.5) - 0.5) * var(--scroll-parallax, 0) * 1vh)'
    );
  });
});

describe('motionStyle', () => {
  it('returns an empty className when nothing is configured, so callers can test it', () => {
    const result = motionStyle({});
    expect(result.className).toBe('');
    expect(result.style).toBe('');
    expect(result.hasReveal).toBe(false);
    expect(result.hasScroll).toBe(false);
  });

  it('emits the shared class once anything is configured', () => {
    expect(motionStyle({ motion: { preset: 'fade' } }).className).toBe(MOTION_CLASS);
    expect(MOTION_CLASS).toBe('motion');
  });

  it('emits the from-state and the timing a reveal needs', () => {
    const { style, hasReveal } = motionStyle({
      motion: { preset: 'fade-up', duration: 400, delay: 100, distance: 32 }
    });
    expect(hasReveal).toBe(true);
    expect(style).toContain('--motion-from-opacity: 0');
    expect(style).toContain('--motion-from-transform: translate3d(0, 32px, 0)');
    expect(style).toContain('--motion-duration: 400ms');
    expect(style).toContain('--motion-delay: 100ms');
  });

  it('adds the stagger offset to the reveal delay', () => {
    const { style } = motionStyle({ motion: { preset: 'fade', delay: 50 }, delayOffset: 120 });
    expect(style).toContain('--motion-delay: 170ms');
  });

  it('still clamps the delay after the offset is added', () => {
    const { style } = motionStyle({ motion: { preset: 'fade', delay: 4000 }, delayOffset: 4000 });
    expect(style).toContain('--motion-delay: 5000ms');
  });

  it('holds an ambient loop until the reveal it shares an element with has landed', () => {
    // Both want `transform`, and an animation beats a transition — starting the
    // loop at once would swallow the reveal instead of following it.
    const { style } = motionStyle({
      motion: { preset: 'fade-up', delay: 200, duration: 600 },
      ambient: { name: 'float', delay: 100 }
    });
    expect(style).toContain('--motion-ambient-delay: 900ms');
  });

  it('starts an ambient loop at its own delay when there is no reveal', () => {
    const { style } = motionStyle({ ambient: { name: 'float', delay: 100 } });
    expect(style).toContain('--motion-ambient-delay: 100ms');
  });

  it('prefixes the keyframe name so a tenant stylesheet cannot shadow it', () => {
    expect(motionStyle({ ambient: { name: 'drift' } }).style).toContain(
      '--motion-ambient-name: ammoura-drift'
    );
  });

  it('seeds scroll progress at mid-travel so the first paint has no parallax jump', () => {
    const { style, hasScroll } = motionStyle({ scrollEffect: { parallax: 20 } });
    expect(hasScroll).toBe(true);
    expect(style).toContain('--scroll-progress: 0.5');
    expect(style).toContain('--scroll-parallax: 20');
  });

  it('combines all three without either flag lying about the other', () => {
    const result = motionStyle({
      motion: { preset: 'zoom-in' },
      ambient: { name: 'breathe' },
      scrollEffect: { parallax: 10 }
    });
    expect(result.hasReveal).toBe(true);
    expect(result.hasScroll).toBe(true);
    expect(result.style).toContain('--motion-from-transform: scale(0.92)');
    expect(result.style).toContain('--motion-ambient-name: ammoura-breathe');
    expect(result.style).toContain('--scroll-parallax: 10');
  });

  it('produces a style string a `style=` attribute can take verbatim', () => {
    const { style } = motionStyle({ motion: { preset: 'fade' } });
    expect(style.endsWith(';')).toBe(false);
    expect(style.split('; ').every((d) => /^--[a-z-]+: .+$/.test(d))).toBe(true);
  });
});

describe('motionInputFromConfig', () => {
  it('picks up exactly the three motion keys off a component config', () => {
    const config = {
      motion: { preset: 'fade' as const },
      ambient: { name: 'float' as const },
      scrollEffect: { parallax: 5 }
    };
    expect(motionInputFromConfig(config, 40)).toEqual({ ...config, delayOffset: 40 });
  });

  it('defaults the offset, so a non-staggering caller can omit it', () => {
    expect(motionInputFromConfig({}).delayOffset).toBe(0);
  });
});

describe('the engine gate', () => {
  /** motion.css with comments, @keyframes blocks and @media blocks removed. */
  const topLevelSelectors = (): string[] => {
    const withoutComments = motionCss.replace(/\/\*[\s\S]*?\*\//g, '');
    // Drop every at-rule together with its braced body, so only the plain rules
    // that style a real element on a normal page are left to check.
    const withoutAtRules = withoutComments.replace(
      /@[a-z-]+[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g,
      ''
    );
    return [...withoutAtRules.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim());
  };

  it('guards every unconditional rule in motion.css', () => {
    // The whole safety argument rests on this: outside an @media block, motion.css
    // must be inert without the attribute. A rule that escapes the gate can strand
    // content at opacity 0 for a visitor whose browser never set it.
    const selectors = topLevelSelectors();
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector.startsWith(":root[data-motion-engine='on']")).toBe(true);
    }
  });

  it('never leaves an element hidden under prefers-reduced-motion', () => {
    const reduced = motionCss.slice(motionCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('opacity: 1 !important');
    expect(reduced).toContain('transform: none !important');
    expect(reduced).toContain('animation-name: none !important');
  });

  it('applies the from-state only in the pending state, never on .motion itself', () => {
    // `.motion { opacity: var(--motion-from-opacity) }` would hide an element the
    // instant the class was added, before any state had been decided.
    for (const selector of topLevelSelectors()) {
      if (selector.endsWith('.motion')) {
        const body = motionCss.slice(motionCss.indexOf(selector) + selector.length);
        expect(body.slice(0, body.indexOf('}'))).not.toContain('--motion-from-');
      }
    }
  });
});
