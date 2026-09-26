import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tick as svelteTick } from 'svelte';
import Scene from './Scene.svelte';

/**
 * jsdom has no canvas, so the 2d context is stubbed. The component is only
 * measurement and drawing, and what is worth pinning is *what it asks the
 * context to do* — that it draws at all, that reduced motion draws once and
 * stops, and that an off-screen scene stops costing anything.
 */
function stubContext() {
  const calls = { arc: 0, stroke: 0, gradient: 0, clear: 0 };
  const ctx = {
    clearRect: () => calls.clear++,
    beginPath: () => {},
    arc: () => calls.arc++,
    fill: () => {},
    stroke: () => calls.stroke++,
    moveTo: () => {},
    lineTo: () => {},
    fillRect: () => {},
    createRadialGradient: () => {
      calls.gradient++;
      return { addColorStop: () => {} };
    },
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never;
  return calls;
}

/** A box with real dimensions; jsdom reports 0 for everything by default. */
function stubLayout(width = 800, height = 600) {
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({})
  })) as never;
}

let observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];

beforeEach(() => {
  observers = [];
  stubLayout();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observers.push(cb);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Scene', () => {
  it('draws a starfield by default', async () => {
    const calls = stubContext();
    render(Scene, { props: { config: { id: 'a' } } });
    await svelteTick();
    expect(calls.arc).toBeGreaterThan(0);
  });

  it('draws gradients for aurora rather than points', async () => {
    const calls = stubContext();
    render(Scene, { props: { config: { id: 'a', sceneVariant: 'aurora' } } });
    await svelteTick();
    expect(calls.gradient).toBeGreaterThan(0);
    expect(calls.arc).toBe(0);
  });

  it('draws lines for the grid', async () => {
    const calls = stubContext();
    render(Scene, { props: { config: { id: 'a', sceneVariant: 'grid' } } });
    await svelteTick();
    expect(calls.stroke).toBeGreaterThan(0);
  });

  it('still draws under reduced motion — it holds still, it does not go blank', async () => {
    // The whole reduced-motion policy in one test: a starfield that becomes an
    // empty rectangle is not an accommodation, it is a missing component.
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    );
    const calls = stubContext();
    render(Scene, { props: { config: { id: 'a' } } });
    await svelteTick();
    expect(calls.arc).toBeGreaterThan(0);
  });

  it('never starts an animation loop under reduced motion', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }))
    );
    stubContext();
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    render(Scene, { props: { config: { id: 'a' } } });
    await svelteTick();
    expect(raf).not.toHaveBeenCalled();
  });

  it('gives the same sky for the same component id', async () => {
    // A tenant places a headline over a backdrop; it has to be that backdrop on
    // the next render, not the next one along.
    const first = stubContext();
    render(Scene, { props: { config: { id: 'stable-id' } } });
    await svelteTick();
    const firstArcs = first.arc;

    const second = stubContext();
    render(Scene, { props: { config: { id: 'stable-id' } } });
    await svelteTick();
    expect(second.arc).toBe(firstArcs);
  });

  it('marks the canvas as decoration, not content', async () => {
    stubContext();
    const { container } = render(Scene, { props: { config: { id: 'a' } } });
    expect(container.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('never intercepts a click meant for what is over it', () => {
    // Read from source rather than from the document: the rule is in a scoped
    // <style> that the test renderer does not attach, so asserting on the page
    // would only ever prove that jsdom has no CSS.
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'Scene.svelte'),
      'utf-8'
    );
    const canvasRule = source.slice(source.indexOf('\n  canvas {'));
    expect(canvasRule.slice(0, canvasRule.indexOf('}'))).toContain('pointer-events: none');
  });

  it('stops drawing when it scrolls off screen', async () => {
    const calls = stubContext();
    render(Scene, { props: { config: { id: 'a' } } });
    await svelteTick();
    const drawn = calls.clear;

    // The IntersectionObserver the component registered, told it has left.
    for (const cb of observers) cb([{ isIntersecting: false }]);
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.clear).toBeLessThanOrEqual(drawn + 1);
  });

  it('honours the density dial', async () => {
    const sparse = stubContext();
    render(Scene, { props: { config: { id: 'a', sceneDensity: 10 } } });
    await svelteTick();

    const dense = stubContext();
    render(Scene, { props: { config: { id: 'a', sceneDensity: 100 } } });
    await svelteTick();
    expect(dense.arc).toBeGreaterThan(sparse.arc);
  });
});
