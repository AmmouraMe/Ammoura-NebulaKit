import { describe, it, expect } from 'vitest';
import {
  blobAt,
  blobCount,
  cappedDpr,
  clamp,
  driftStar,
  gridLines,
  makeBlob,
  makeStar,
  scaleFactor,
  SCENE_VARIANTS,
  seedFrom,
  seededRandom,
  starAt,
  starCount,
  type SceneView,
  type Star
} from './scene';

const view = (over: Partial<SceneView> = {}): SceneView => ({
  width: 1000,
  height: 600,
  dpr: 2,
  offsetX: 0,
  offsetY: 0,
  ...over
});

describe('scaleFactor', () => {
  it('puts the designed value in the middle of the slider', () => {
    expect(scaleFactor(50)).toBe(1);
  });

  it('spans nothing to double', () => {
    expect(scaleFactor(0)).toBe(0);
    expect(scaleFactor(100)).toBe(2);
  });

  it('clamps rather than letting a stored value out of range through', () => {
    expect(scaleFactor(-40)).toBe(0);
    expect(scaleFactor(400)).toBe(2);
  });
});

describe('cappedDpr', () => {
  it('never allocates more backing store than the cap, however dense the screen', () => {
    expect(cappedDpr(3, true)).toBe(2);
    expect(cappedDpr(4, false)).toBe(2.5);
  });

  it('never goes below 1, which would render blurry on an ordinary screen', () => {
    expect(cappedDpr(0.5, false)).toBe(1);
  });

  it('survives a browser that reports no ratio at all', () => {
    expect(cappedDpr(0, false)).toBe(1);
    expect(cappedDpr(NaN, false)).toBeGreaterThanOrEqual(1);
  });
});

describe('seededRandom', () => {
  it('gives the same sequence for the same seed, so the sky never changes', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('gives different sequences for different seeds, so two scenes differ', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });

  it('stays inside 0..1', () => {
    const rand = seededRandom(7);
    for (let i = 0; i < 500; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('seedFrom', () => {
  it('is stable for one id across calls, which is the whole point', () => {
    expect(seedFrom('component-abc')).toBe(seedFrom('component-abc'));
  });

  it('separates two ids, so two scenes on a page are not the same sky', () => {
    expect(seedFrom('component-a')).not.toBe(seedFrom('component-b'));
  });

  it('never returns 0, which mulberry32 would turn into a degenerate stream', () => {
    expect(seedFrom(undefined)).toBeGreaterThan(0);
    expect(seedFrom('')).toBeGreaterThan(0);
  });
});

describe('starCount', () => {
  it('holds visual density steady across screen sizes', () => {
    // A fixed count would be a crowd on a phone and a sprinkle on a desktop.
    const phone = starCount(390, 800, true);
    const desktop = starCount(1440, 900, false);
    expect(phone).toBeGreaterThan(0);
    expect(desktop).toBeGreaterThan(phone);
  });

  it('caps, so a large monitor does not pay for thousands of them', () => {
    expect(starCount(5120, 2880, false)).toBeLessThanOrEqual(260);
  });

  it('gives a phone a thinner field than a desktop of the same area', () => {
    expect(starCount(800, 800, true)).toBeLessThan(starCount(800, 800, false));
  });

  it('answers the density dial', () => {
    expect(starCount(1440, 900, false, 100)).toBeGreaterThan(starCount(1440, 900, false, 50));
    expect(starCount(1440, 900, false, 0)).toBe(0);
  });

  it('is never negative for a zero-sized box', () => {
    expect(starCount(0, 0, false)).toBe(0);
  });
});

describe('driftStar', () => {
  const star = (over: Partial<Star> = {}): Star => ({
    x: 0.5,
    y: 0.5,
    depth: 0.5,
    color: 0,
    phase: 0,
    twinkle: 0.01,
    vx: 0,
    vy: 0,
    ...over
  });

  it('wraps off the right edge rather than letting the field empty', () => {
    const s = star({ x: 0.999, vx: 0.01 });
    driftStar(s);
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThan(1);
  });

  it('wraps off the left edge too', () => {
    const s = star({ x: 0.001, vx: -0.01 });
    driftStar(s);
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThan(1);
  });

  it('keeps every star in the field over a long run', () => {
    const rand = seededRandom(3);
    const field = Array.from({ length: 50 }, () => makeStar(rand, 3));
    for (let i = 0; i < 5000; i++) for (const s of field) driftStar(s, 100);
    for (const s of field) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThan(1);
    }
  });

  it('holds completely still at speed 0', () => {
    const s = star({ vx: 0.01, vy: 0.01 });
    driftStar(s, 0);
    expect(s.x).toBe(0.5);
    expect(s.y).toBe(0.5);
  });
});

describe('starAt', () => {
  const rand = seededRandom(11);
  const near = makeStar(rand, 3);
  near.depth = 1;
  const far = makeStar(rand, 3);
  far.depth = 0;

  it('draws nearer stars larger', () => {
    expect(starAt(near, view(), 0).size).toBeGreaterThan(starAt(far, view(), 0).size);
  });

  it('parallaxes nearer stars further, which is what sells depth', () => {
    const pushed = view({ offsetX: 100 });
    const nearShift = starAt(near, pushed, 0).x - starAt(near, view(), 0).x;
    const farShift = starAt(far, pushed, 0).x - starAt(far, view(), 0).x;
    expect(nearShift).toBeGreaterThan(farShift);
  });

  it('still moves the furthest stars a little, so no layer looks stuck to the glass', () => {
    const pushed = view({ offsetX: 100 });
    expect(starAt(far, pushed, 0).x - starAt(far, view(), 0).x).toBeGreaterThan(0);
  });

  it('keeps alpha inside 0..1 across a whole twinkle cycle', () => {
    for (let tick = 0; tick < 2000; tick += 7) {
      const { alpha } = starAt(near, view(), tick);
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1);
    }
  });

  it('never draws a star smaller than a visible dot', () => {
    expect(starAt(far, view({ dpr: 1 }), 0).size).toBeGreaterThanOrEqual(0.6);
  });
});

describe('aurora', () => {
  it('stays few and large — many and small is fog, not aurora', () => {
    expect(blobCount(0)).toBeLessThanOrEqual(6);
    expect(blobCount(100)).toBeLessThanOrEqual(6);
    expect(blobCount(50)).toBeGreaterThanOrEqual(2);
  });

  it('gives each blob a path that does not close, so the loop is never visible', () => {
    const rand = seededRandom(5);
    const blob = makeBlob(rand, 0, 3);
    // Incommensurable rates: if fx === fy the path is an ellipse traced forever.
    expect(blob.fx).not.toBe(blob.fy);
  });

  it('moves the blob over time', () => {
    const blob = makeBlob(seededRandom(5), 0, 3);
    const start = blobAt(blob, view(), 0);
    const later = blobAt(blob, view(), 20000);
    expect(start.x === later.x && start.y === later.y).toBe(false);
  });

  it('sizes the radius from the smaller side, so a wide box does not overflow', () => {
    const blob = makeBlob(seededRandom(5), 0, 3);
    const wide = blobAt(blob, view({ width: 4000, height: 600 }), 0);
    expect(wide.radius).toBeLessThanOrEqual(600);
  });

  it('holds still at speed 0', () => {
    const blob = makeBlob(seededRandom(5), 0, 3);
    expect(blobAt(blob, view(), 0, 0)).toEqual(blobAt(blob, view(), 99999, 0));
  });
});

describe('gridLines', () => {
  it('converges every vertical on one vanishing point', () => {
    const lines = gridLines(view(), 0).filter((l) => l.y1 !== l.y2);
    const apexes = new Set(lines.map((l) => `${l.x1},${l.y1}`));
    expect(apexes.size).toBe(1);
  });

  it('bunches the horizontals towards the horizon rather than spacing them evenly', () => {
    // Even spacing is the giveaway that turns a perspective grid into a ladder.
    const horizontals = gridLines(view(), 0)
      .filter((l) => l.y1 === l.y2)
      .map((l) => l.y1)
      .sort((a, b) => a - b);
    const firstGap = horizontals[1] - horizontals[0];
    const lastGap = horizontals[horizontals.length - 1] - horizontals[horizontals.length - 2];
    expect(lastGap).toBeGreaterThan(firstGap * 2);
  });

  it('never emits a line that would be drawn invisible', () => {
    for (const line of gridLines(view(), 0.5)) expect(line.alpha).toBeGreaterThan(0);
  });

  it('travels with the offset without changing how many lines exist', () => {
    // The illusion of endless travel is one number moving, not lines being born.
    const a = gridLines(view(), 0.1).filter((l) => l.y1 === l.y2).length;
    const b = gridLines(view(), 0.9).filter((l) => l.y1 === l.y2).length;
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
  });

  it('wraps a whole-number offset back to the start', () => {
    expect(gridLines(view(), 3)).toEqual(gridLines(view(), 0));
  });

  it('stays within sane counts at both ends of the density dial', () => {
    expect(gridLines(view(), 0, 0).length).toBeGreaterThan(0);
    expect(gridLines(view(), 0, 100).length).toBeLessThan(200);
  });
});

describe('clamp', () => {
  it('bounds on both sides and passes the middle through', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe('SCENE_VARIANTS', () => {
  it('lists exactly the three the component can draw', () => {
    expect([...SCENE_VARIANTS]).toEqual(['stars', 'aurora', 'grid']);
  });
});
