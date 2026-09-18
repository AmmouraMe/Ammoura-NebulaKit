<script lang="ts">
  /**
   * Scene — a generative ambient backdrop, as a builder component.
   *
   * The maths lives in `$lib/utils/scene.ts` and is tested there; this file is
   * only measurement and drawing. Three variants share one canvas and one loop.
   *
   * ## What it will not do
   *
   * A backdrop is the one component on a page that nobody came to look at, so it
   * has to be the one that costs the least:
   *
   * - **It stops when it is not on screen.** An IntersectionObserver pauses the
   *   loop, so a scene at the bottom of a long page is not repainting while you
   *   read the top of it.
   * - **It stops when the tab is hidden.** `requestAnimationFrame` mostly
   *   handles this, but not in every browser and not for a backgrounded window
   *   that keeps a visible sliver, so `visibilitychange` says so explicitly.
   * - **It draws one frame under reduced motion**, and then stops for good. Not
   *   a blank box — the starfield is still a starfield, it simply holds still.
   *   Reduced motion means less movement, never less page.
   * - **It caps its own resolution.** See `cappedDpr`.
   *
   * ## Why it is seeded
   *
   * `Math.random` would give a different sky on every render, including between
   * the builder preview and the published page. A tenant placing a headline over
   * a backdrop has to be placing it over *that* backdrop. The seed comes from
   * the component's own id, so two scenes on one page still differ.
   */
  import { onMount } from 'svelte';
  import type { ComponentConfig } from '$lib/types/pages';
  import { resolveThemeColor } from '$lib/utils/editor/colorThemes';
  import { BREAKPOINTS } from '$lib/styles/breakpoints';
  import {
    blobAt,
    blobCount,
    cappedDpr,
    driftStar,
    gridLines,
    makeBlob,
    makeStar,
    scaleFactor,
    SCENE_DEFAULTS,
    seedFrom,
    seededRandom,
    starAt,
    starCount,
    type Blob,
    type SceneVariant,
    type SceneView,
    type Star
  } from '$lib/utils/scene';

  export let config: ComponentConfig = {};
  export let colorTheme: string = 'vibrant';

  $: variant = (config.sceneVariant ?? 'stars') as SceneVariant;
  $: density = config.sceneDensity ?? SCENE_DEFAULTS.density;
  $: speed = config.sceneSpeed ?? SCENE_DEFAULTS.speed;
  $: pointerParallax = config.scenePointerParallax !== false;

  /**
   * Colours come through the theme resolver like every other colour in the
   * builder, so a scene restyles with the site instead of pinning hexes into a
   * page that later changes palette.
   *
   * The default list is theme references ONLY. It used to end in a literal
   * `#ffffff`, which looks like a sensible "starlight" until the site is on a
   * light theme — white stars on a near-white background are no stars at all.
   * A hardcoded hex in a default is a hex that will eventually be invisible
   * against a palette nobody has chosen yet.
   */
  $: colors = (
    config.sceneColors?.length
      ? config.sceneColors
      : ['theme:primary', 'theme:accent', 'theme:secondary']
  ).map((c) => resolveThemeColor(c, colorTheme, '#ffffff', true));

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // The seed, not a generator: every respawn makes its own stream from this,
    // so a resize gives back the same sky rather than the next one along.
    const seed = seedFrom(config.id ?? config.anchorName);
    let stars: Star[] = [];
    let blobs: Blob[] = [];
    let view: SceneView = { width: 0, height: 0, dpr: 1, offsetX: 0, offsetY: 0 };
    let tick = 0;
    let frame = 0;
    let onScreen = true;
    let visible = true;

    /** Pointer parallax target and the eased value chasing it. */
    let targetX = 0;
    let targetY = 0;

    function measure(): void {
      const rect = host.getBoundingClientRect();
      const mobile = rect.width <= BREAKPOINTS.md;
      const dpr = cappedDpr(window.devicePixelRatio, mobile);
      view = {
        width: Math.max(1, Math.round(rect.width * dpr)),
        height: Math.max(1, Math.round(rect.height * dpr)),
        dpr,
        offsetX: view.offsetX,
        offsetY: view.offsetY
      };
      canvas.width = view.width;
      canvas.height = view.height;

      // Respawned on resize rather than rescaled: a field stretched from a phone
      // to a desktop has phone density spread thin, which is visibly wrong.
      const rand = seededRandom(seed);
      if (variant === 'stars') {
        const count = starCount(rect.width, rect.height, mobile, density);
        stars = Array.from({ length: count }, () => makeStar(rand, colors.length));
      } else if (variant === 'aurora') {
        const count = blobCount(density);
        blobs = Array.from({ length: count }, (_, i) => makeBlob(rand, i, colors.length));
      }
    }

    function drawStars(): void {
      for (const star of stars) {
        if (!reduced) driftStar(star, speed);
        const point = starAt(star, view, tick);
        ctx!.globalAlpha = point.alpha;
        ctx!.fillStyle = colors[star.color % colors.length];
        ctx!.beginPath();
        ctx!.arc(point.x, point.y, point.size, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function drawAurora(): void {
      // `lighter` is what makes overlapping blobs brighten into a third colour
      // instead of the nearest one simply covering the others.
      ctx!.globalCompositeOperation = 'lighter';
      for (const blob of blobs) {
        const point = blobAt(blob, view, tick, speed);
        const gradient = ctx!.createRadialGradient(
          point.x,
          point.y,
          0,
          point.x,
          point.y,
          point.radius
        );
        gradient.addColorStop(0, colors[blob.color % colors.length]);
        gradient.addColorStop(1, 'transparent');
        ctx!.globalAlpha = 0.22;
        ctx!.fillStyle = gradient;
        ctx!.fillRect(0, 0, view.width, view.height);
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = 'source-over';
    }

    function drawGrid(): void {
      const offset = reduced ? 0 : (tick * 0.0006 * scaleFactor(speed)) % 1;
      ctx!.lineWidth = Math.max(1, view.dpr * 0.75);
      ctx!.strokeStyle = colors[0];
      for (const line of gridLines(view, offset, density)) {
        ctx!.globalAlpha = line.alpha * 0.4;
        ctx!.beginPath();
        ctx!.moveTo(line.x1, line.y1);
        ctx!.lineTo(line.x2, line.y2);
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
    }

    function draw(): void {
      ctx!.clearRect(0, 0, view.width, view.height);
      if (variant === 'stars') drawStars();
      else if (variant === 'aurora') drawAurora();
      else drawGrid();
    }

    function loop(): void {
      frame = 0;
      if (!onScreen || !visible) return;
      tick += 1;
      // Ease toward the pointer rather than tracking it: raw tracking makes the
      // whole backdrop twitch with the mouse, which is distracting in a way a
      // lag of a few frames is not.
      view.offsetX += (targetX - view.offsetX) * 0.06;
      view.offsetY += (targetY - view.offsetY) * 0.06;
      draw();
      frame = requestAnimationFrame(loop);
    }

    function start(): void {
      if (reduced || frame) return;
      frame = requestAnimationFrame(loop);
    }

    function stop(): void {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    function onPointerMove(event: PointerEvent): void {
      if (!pointerParallax || reduced) return;
      const rect = host.getBoundingClientRect();
      // Up to ~3% of the box in each direction. Enough to feel like depth,
      // small enough that it is never mistaken for the page moving.
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * view.width * 0.06;
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * view.height * 0.06;
    }

    const resizeObserver = new ResizeObserver(() => {
      measure();
      draw();
    });
    resizeObserver.observe(host);

    const visibility = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 }
    );
    visibility.observe(host);

    function onVisibilityChange(): void {
      visible = document.visibilityState === 'visible';
      if (visible) start();
      else stop();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    if (pointerParallax && !reduced) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
    }

    measure();
    draw();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pointermove', onPointerMove);
    };
  });
</script>

<div
  class="scene"
  bind:this={host}
  style="min-height: {config.sceneHeight ?? '320px'}; background: {config.backgroundColor
    ? resolveThemeColor(config.backgroundColor, colorTheme, 'transparent', true)
    : 'transparent'};"
>
  <!-- aria-hidden and no alt: this is decoration. Announcing "canvas" to a
       screen reader tells nobody anything they can use. -->
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  <slot />
</div>

<style>
  .scene {
    position: relative;
    width: 100%;
    /* NOT overflow: hidden. The scene centres its content, so content taller
       than the box overflows in BOTH directions — the clip then cuts the top
       half off and puts it somewhere nobody can scroll to. The canvas is
       absolutely positioned and sized to this box, so it cannot paint outside
       it anyway: the clip was buying nothing and costing the heading. Content
       that does not fit now scrolls, which is a failure anyone can recover
       from. (Same bug, same fix, as the ammoura.me teaser hero.) */
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    /* Never steals a click, a drag or a text selection from what is over it. */
    pointer-events: none;
  }
</style>
