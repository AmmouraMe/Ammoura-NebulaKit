/**
 * The Svelte action half of the motion system.
 *
 * `$lib/utils/motion.ts` decides what the CSS should say; this file is the only
 * part that touches the DOM. It does two jobs:
 *
 * 1. **Reveal** — flip `data-motion` from `pending` to `in` at the right moment,
 *    either immediately (`trigger: 'load'`) or when the element scrolls into
 *    view (`trigger: 'scroll'`).
 * 2. **Scroll progress** — keep `--scroll-progress` on the element up to date
 *    with how far it has travelled through the viewport, which is what
 *    motion.css's parallax rule reads.
 *
 * ## Why this is not one observer per element
 *
 * A storefront page can easily carry a hundred revealed components. A hundred
 * IntersectionObservers, or a hundred scroll listeners each calling
 * `getBoundingClientRect`, is how a page that looks nice on a desktop becomes
 * unusable on a phone. So:
 *
 * - IntersectionObservers are **shared per threshold**. Threshold is the only
 *   part of the options that varies, so in practice a page has one or two.
 * - Scroll tracking is **one listener and one rAF loop for the whole page**,
 *   and it only measures elements that are currently on screen — membership of
 *   that set is itself decided by an observer rather than by measuring.
 *
 * Everything is inert until `:root[data-motion-engine='on']` is present. That
 * attribute is set by the inline script in app.html and withheld when the
 * visitor prefers reduced motion, so the checks here are the same gate the CSS
 * uses, not a second policy.
 */

import type { ActionReturn } from 'svelte/action';
import { MOTION_ENGINE_ATTR, MOTION_STATE_ATTR, scrollProgress } from '$lib/utils/motion';

export interface MotionActionParams {
  /** The element carries a reveal that has to be triggered. */
  hasReveal?: boolean;
  /** The element needs `--scroll-progress` kept current. */
  hasScroll?: boolean;
  trigger?: 'scroll' | 'load';
  threshold?: number;
  once?: boolean;
}

/** True when motion may run at all. False during SSR and under reduced motion. */
function engineOn(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute(MOTION_ENGINE_ATTR) === 'on';
}

/**
 * app.html opens every page with `html.no-transitions`, which kills all
 * transitions and animations until the theme has settled and Svelte has
 * hydrated. A reveal that fires inside that window does not animate — it snaps —
 * and an element that was already on screen at load is exactly the one most
 * likely to hit it.
 *
 * So a reveal waits for that class to go. The MutationObserver is shared and
 * set up once; `settled` short-circuits every call after the first frame, which
 * is all of them on a normal page load.
 */
let settled = false;
const settleWaiters: Array<() => void> = [];

function whenTransitionsAllowed(run: () => void): void {
  if (settled || typeof document === 'undefined') {
    run();
    return;
  }
  if (!document.documentElement.classList.contains('no-transitions')) {
    settled = true;
    run();
    return;
  }

  settleWaiters.push(run);
  if (settleWaiters.length > 1) return;

  const release = () => {
    if (settled) return;
    settled = true;
    observer.disconnect();
    clearTimeout(failsafe);
    for (const waiter of settleWaiters.splice(0)) waiter();
  };

  const observer = new MutationObserver(() => {
    if (!document.documentElement.classList.contains('no-transitions')) release();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // If hydration never completes, the reveals must still resolve. A stuck page
  // showing its content is a bad page; a stuck page showing nothing is no page.
  const failsafe = setTimeout(release, 2000);
}

// --- shared reveal observers ------------------------------------------------

/**
 * One observer per threshold, and the per-node behaviour hung off the node
 * itself rather than off a map keyed by node — a WeakMap would leak nothing but
 * still needs tidying on destroy, and there is nothing here a dataset attribute
 * cannot carry.
 */
const revealObservers = new Map<number, IntersectionObserver>();

/** Nodes whose reveal must not replay, so the observer can drop them on entry. */
const revealOnce = new WeakSet<Element>();

function revealObserver(threshold: number): IntersectionObserver {
  const existing = revealObservers.get(threshold);
  if (existing) return existing;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const node = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          whenTransitionsAllowed(() => node.setAttribute(MOTION_STATE_ATTR, 'in'));
          if (revealOnce.has(node)) observer.unobserve(node);
        } else if (!revealOnce.has(node)) {
          // Replayable reveals return to their starting state once they are
          // fully clear of the viewport, never while a corner is still showing.
          node.setAttribute(MOTION_STATE_ATTR, 'pending');
        }
      }
    },
    { threshold }
  );

  revealObservers.set(threshold, observer);
  return observer;
}

/**
 * Wait for the browser to have painted the pending state before settling.
 *
 * A transition only runs between two painted states. An element that Svelte
 * created client-side has not been painted at all when the action runs, so
 * setting `in` in the same frame means the browser never sees `pending` and the
 * reveal simply appears. Two frames is the reliable minimum: the first lets the
 * element be laid out and painted, the second is where the change happens.
 * (Server-rendered elements are already painted and would be fine with one, but
 * there is no way to tell the two apart from here, and one extra frame is 16ms.)
 */
function afterPaint(callback: () => void): number {
  return requestAnimationFrame(() => requestAnimationFrame(callback));
}

// --- shared scroll tracking -------------------------------------------------

/** Elements currently on screen that want `--scroll-progress`. */
const scrollTracked = new Set<HTMLElement>();

/** Every element that asked for scroll tracking, on screen or not. */
let scrollVisibility: IntersectionObserver | null = null;

let scrollFrame = 0;
let scrollListening = false;

function measure(): void {
  scrollFrame = 0;
  const viewportHeight = window.innerHeight;
  for (const node of scrollTracked) {
    const rect = node.getBoundingClientRect();
    const progress = scrollProgress(rect.top, rect.height, viewportHeight);
    // Four decimals: enough that a slow parallax moves smoothly, short enough
    // that the style string being rewritten every frame stays cheap.
    node.style.setProperty('--scroll-progress', progress.toFixed(4));
  }
}

function requestMeasure(): void {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(measure);
}

function startScrollListening(): void {
  if (scrollListening) return;
  scrollListening = true;
  window.addEventListener('scroll', requestMeasure, { passive: true });
  window.addEventListener('resize', requestMeasure, { passive: true });
}

function stopScrollListening(): void {
  if (!scrollListening) return;
  scrollListening = false;
  window.removeEventListener('scroll', requestMeasure);
  window.removeEventListener('resize', requestMeasure);
  if (scrollFrame) {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  }
}

/**
 * Add/remove elements from the measured set as they enter and leave the screen.
 *
 * `rootMargin` deliberately overshoots the viewport: an element must already be
 * in the set, with a current progress value, before its first pixel is visible,
 * or a parallaxed element visibly jumps into place as it appears.
 */
function scrollVisibilityObserver(): IntersectionObserver {
  if (scrollVisibility) return scrollVisibility;
  scrollVisibility = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const node = entry.target as HTMLElement;
        if (entry.isIntersecting) scrollTracked.add(node);
        else scrollTracked.delete(node);
      }
      if (scrollTracked.size > 0) {
        startScrollListening();
        requestMeasure();
      } else {
        stopScrollListening();
      }
    },
    { rootMargin: '25% 0px 25% 0px', threshold: 0 }
  );
  return scrollVisibility;
}

// --- the action -------------------------------------------------------------

/**
 * Attach reveal and/or scroll-progress behaviour to an element.
 *
 * The element is expected to already carry the `.motion` class, the emitted
 * `--motion-*` variables, and — for a reveal — `data-motion="pending"` straight
 * from the server. This action never adds the pending state itself: doing it on
 * mount would mean the settled content is painted first and then snatched away,
 * which is the flicker the whole design is arranged to avoid.
 */
export function motion(
  node: HTMLElement,
  params: MotionActionParams = {}
): ActionReturn<MotionActionParams> {
  let current = params;
  let revealFrame = 0;
  let observedThreshold: number | null = null;
  let observingScroll = false;

  function teardown(): void {
    if (revealFrame) {
      cancelAnimationFrame(revealFrame);
      revealFrame = 0;
    }
    if (observedThreshold !== null) {
      revealObservers.get(observedThreshold)?.unobserve(node);
      revealOnce.delete(node);
      observedThreshold = null;
    }
    if (observingScroll) {
      scrollVisibility?.unobserve(node);
      scrollTracked.delete(node);
      observingScroll = false;
      if (scrollTracked.size === 0) stopScrollListening();
    }
  }

  function setup(next: MotionActionParams): void {
    current = next;
    if (!engineOn()) {
      // Reduced motion, or no scripting policy at all. Leave the element exactly
      // as the server rendered it — the CSS is gated on the same attribute, so
      // `pending` in the markup means nothing and content stays visible.
      return;
    }

    if (next.hasReveal) {
      if (next.trigger === 'load') {
        revealFrame = afterPaint(() => {
          revealFrame = 0;
          whenTransitionsAllowed(() => node.setAttribute(MOTION_STATE_ATTR, 'in'));
        });
      } else {
        const threshold = next.threshold ?? 0.15;
        if (next.once !== false) revealOnce.add(node);
        else revealOnce.delete(node);
        observedThreshold = threshold;
        // Same reason as afterPaint: an observer fires its first callback almost
        // immediately, and for a client-created element that would be before the
        // pending state has ever been painted.
        revealFrame = afterPaint(() => {
          revealFrame = 0;
          revealObserver(threshold).observe(node);
        });
      }
    }

    if (next.hasScroll) {
      observingScroll = true;
      scrollVisibilityObserver().observe(node);
    }
  }

  setup(params);

  return {
    update(next: MotionActionParams) {
      // Cheap identity check: these params come from a reactive statement that
      // rebuilds the object on every render, so comparing by value is what stops
      // an unrelated prop change from restarting every reveal on the page.
      if (
        next.hasReveal === current.hasReveal &&
        next.hasScroll === current.hasScroll &&
        next.trigger === current.trigger &&
        next.threshold === current.threshold &&
        next.once === current.once
      ) {
        current = next;
        return;
      }
      teardown();
      setup(next);
    },
    destroy: teardown
  };
}
