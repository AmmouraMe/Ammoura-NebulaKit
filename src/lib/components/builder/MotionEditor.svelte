<script lang="ts">
  /**
   * MotionEditor — the builder's controls for reveal, ambient and scroll motion.
   *
   * Kept out of UniversalStyleEditor rather than added to it: motion is three
   * related but independent groups with their own conditional fields, and
   * folding that into a file already near 700 lines would bury it.
   *
   * ## Why there is a preview tile
   *
   * Every field here describes something you cannot see from its value. "600ms,
   * ease-out, 24px" is four facts and no picture, and the canvas behind the
   * panel will not replay a scroll reveal while you are editing it — by the time
   * you have scrolled to look, the reveal has already happened. So the tile
   * replays on demand, using the same `.motion` class and the same emitted
   * variables the real page uses. It is the preview being the real thing, not a
   * drawing of it.
   */
  import { createEventDispatcher } from 'svelte';
  import type { ComponentConfig } from '$lib/types/pages';
  import {
    AMBIENT_NAMES,
    MOTION_DEFAULTS,
    MOTION_EASINGS,
    MOTION_PRESETS,
    motionStyle,
    type AmbientName,
    type MotionEasing,
    type MotionPreset
  } from '$lib/utils/motion';
  import { isContainerType } from '$lib/utils/mobileCollapse';

  export let config: ComponentConfig;
  /** The component's type, so stagger only appears where there are children. */
  export let componentType: string = '';

  const dispatch = createEventDispatcher<{ update: ComponentConfig }>();

  function update(): void {
    dispatch('update', config);
  }

  /** Presets whose from-state travels, so the distance field means something. */
  const TRAVELLING: ReadonlySet<MotionPreset> = new Set<MotionPreset>([
    'fade-up',
    'fade-down',
    'fade-left',
    'fade-right',
    'rise'
  ]);

  /** Ambient presets that read --motion-ambient-distance. */
  const AMBIENT_TRAVELS: ReadonlySet<AmbientName> = new Set<AmbientName>([
    'float',
    'drift',
    'breathe'
  ]);

  const PRESET_LABEL: Record<MotionPreset, string> = {
    fade: 'Fade',
    'fade-up': 'Up',
    'fade-down': 'Down',
    'fade-left': 'Left',
    'fade-right': 'Right',
    'zoom-in': 'Zoom in',
    'zoom-out': 'Zoom out',
    'blur-in': 'Blur',
    rise: 'Rise'
  };

  const AMBIENT_LABEL: Record<AmbientName, string> = {
    float: 'Float',
    drift: 'Drift',
    pulse: 'Pulse',
    breathe: 'Breathe',
    sheen: 'Sheen',
    spin: 'Spin',
    twinkle: 'Twinkle'
  };

  /** The ambient presets that need something of the element to act on. */
  const AMBIENT_NOTE: Partial<Record<AmbientName, string>> = {
    sheen: 'Needs a gradient background on this component to travel across.',
    spin: 'Runs one way and never eases — it is a rotation, not a rock.'
  };

  $: preset = config.motion?.preset;
  $: ambientName = config.ambient?.name;
  $: canStagger = isContainerType(componentType) || Boolean(config.children?.length);

  function setPreset(next: MotionPreset | null): void {
    if (next === null) {
      delete config.motion;
    } else {
      // Only the preset is written. Everything else stays absent so that
      // resolveMotion()'s defaults remain the single definition of them — a
      // config that spells out every default is a config that cannot follow a
      // change to one.
      config.motion = { ...config.motion, preset: next };
    }
    config = config;
    update();
  }

  function setMotion<K extends keyof NonNullable<ComponentConfig['motion']>>(
    key: K,
    value: NonNullable<ComponentConfig['motion']>[K]
  ): void {
    if (!config.motion) return;
    config.motion = { ...config.motion, [key]: value };
    config = config;
    update();
  }

  function setAmbient(next: AmbientName | null): void {
    if (next === null) delete config.ambient;
    else config.ambient = { ...config.ambient, name: next };
    config = config;
    update();
  }

  function setAmbientField<K extends keyof NonNullable<ComponentConfig['ambient']>>(
    key: K,
    value: NonNullable<ComponentConfig['ambient']>[K]
  ): void {
    if (!config.ambient) return;
    config.ambient = { ...config.ambient, [key]: value };
    config = config;
    update();
  }

  function setParallax(value: number): void {
    if (value === 0) delete config.scrollEffect;
    else config.scrollEffect = { ...config.scrollEffect, parallax: value };
    config = config;
    update();
  }

  function onTriggerChange(event: Event): void {
    const value = (event.currentTarget as HTMLSelectElement).value;
    setMotion('trigger', value === 'load' ? 'load' : 'scroll');
  }

  function onEasingChange(event: Event): void {
    setMotion('easing', (event.currentTarget as HTMLSelectElement).value as MotionEasing);
  }

  /** A whole number from an input, or the fallback when it has been cleared. */
  const intOr = (raw: string, fallback: number): number => {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  };

  // --- preview ---------------------------------------------------------------

  /**
   * The tile runs the real thing: the same class, the same variables, the same
   * two states. `previewKey` forces a fresh element on each replay, because a
   * transition only runs between two painted states and re-setting an attribute
   * on the same node inside one frame is not two states.
   */
  let previewKey = 0;
  let previewState: 'pending' | 'in' = 'in';

  $: previewStyle = motionStyle({
    motion: config.motion,
    ambient: config.ambient
    // Parallax is deliberately left out: it is driven by page scroll, and a tile
    // that drifts while you are not scrolling would be showing you a lie.
  });

  function replay(): void {
    previewKey += 1;
    previewState = 'pending';
    requestAnimationFrame(() => requestAnimationFrame(() => (previewState = 'in')));
  }
</script>

<div class="motion-editor">
  <div class="section">
    <h4>Entrance</h4>
    <p class="hint">
      Plays once, when the component scrolls into view. Nothing here runs for a visitor who has
      asked for reduced motion — they see the component at rest, not hidden.
    </p>
    <div class="preset-grid">
      <button
        type="button"
        class="preset"
        class:active={!preset}
        aria-label="No entrance"
        on:click={() => setPreset(null)}
      >
        None
      </button>
      {#each MOTION_PRESETS as option (option)}
        <button
          type="button"
          class="preset"
          class:active={preset === option}
          on:click={() => setPreset(option)}
        >
          {PRESET_LABEL[option]}
        </button>
      {/each}
    </div>
  </div>

  {#if preset}
    <div class="section">
      <div class="preview-row">
        {#key previewKey}
          <div
            class="preview-tile {previewStyle.className}"
            style={previewStyle.style}
            data-motion={previewState}
          >
            Aa
          </div>
        {/key}
        <button type="button" class="replay" on:click={replay}>Replay</button>
        <span class="hint inline"> The real classes and variables, not a drawing of them. </span>
      </div>
    </div>

    <div class="section">
      <div class="field-row">
        <div class="form-group">
          <label for="motion-trigger">Starts</label>
          <select
            id="motion-trigger"
            value={config.motion?.trigger ?? MOTION_DEFAULTS.trigger}
            on:change={onTriggerChange}
          >
            <option value="scroll">When scrolled into view</option>
            <option value="load">As soon as the page loads</option>
          </select>
        </div>
        <div class="form-group">
          <label for="motion-easing">Easing</label>
          <select
            id="motion-easing"
            value={config.motion?.easing ?? MOTION_DEFAULTS.easing}
            on:change={onEasingChange}
          >
            {#each MOTION_EASINGS as easing (easing)}
              <option value={easing}>{easing}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="field-row">
        <div class="form-group">
          <label for="motion-duration">Duration (ms)</label>
          <input
            id="motion-duration"
            type="number"
            min="0"
            max="4000"
            step="50"
            value={config.motion?.duration ?? MOTION_DEFAULTS.duration}
            on:input={(e) =>
              setMotion('duration', intOr(e.currentTarget.value, MOTION_DEFAULTS.duration))}
          />
        </div>
        <div class="form-group">
          <label for="motion-delay">Delay (ms)</label>
          <input
            id="motion-delay"
            type="number"
            min="0"
            max="5000"
            step="50"
            value={config.motion?.delay ?? MOTION_DEFAULTS.delay}
            on:input={(e) =>
              setMotion('delay', intOr(e.currentTarget.value, MOTION_DEFAULTS.delay))}
          />
        </div>
      </div>

      {#if TRAVELLING.has(preset)}
        <div class="form-group">
          <label for="motion-distance">Travel (px)</label>
          <input
            id="motion-distance"
            type="range"
            min="0"
            max="160"
            step="4"
            value={config.motion?.distance ?? MOTION_DEFAULTS.distance}
            on:input={(e) =>
              setMotion('distance', intOr(e.currentTarget.value, MOTION_DEFAULTS.distance))}
          />
          <span class="value">{config.motion?.distance ?? MOTION_DEFAULTS.distance}px</span>
        </div>
      {/if}

      {#if config.motion?.trigger !== 'load'}
        <div class="form-group">
          <label for="motion-threshold">
            How much must show first
            <span class="value">
              {Math.round((config.motion?.threshold ?? MOTION_DEFAULTS.threshold) * 100)}%
            </span>
          </label>
          <input
            id="motion-threshold"
            type="range"
            min="0"
            max="100"
            step="5"
            value={Math.round((config.motion?.threshold ?? MOTION_DEFAULTS.threshold) * 100)}
            on:input={(e) => setMotion('threshold', intOr(e.currentTarget.value, 15) / 100)}
          />
          <small class="hint">
            Keep this low for a tall section — on a phone it may never reach half showing.
          </small>
        </div>

        <label class="checkbox">
          <input
            type="checkbox"
            checked={config.motion?.once !== false}
            on:change={(e) => setMotion('once', e.currentTarget.checked)}
          />
          Only the first time
        </label>
      {/if}

      {#if canStagger}
        <div class="form-group">
          <label for="motion-stagger">
            Stagger children (ms)
            <span class="value">{config.motion?.stagger ?? 0}</span>
          </label>
          <input
            id="motion-stagger"
            type="range"
            min="0"
            max="400"
            step="10"
            value={config.motion?.stagger ?? 0}
            on:input={(e) => setMotion('stagger', intOr(e.currentTarget.value, 0))}
          />
          <small class="hint">
            Added to each child's own delay, once per position — the third card waits twice as long
            as the second. The children need an entrance of their own for it to show.
          </small>
        </div>
      {/if}
    </div>
  {/if}

  <div class="section">
    <h4>Ambient</h4>
    <p class="hint">A loop that never ends. Starts after the entrance has finished.</p>
    <div class="preset-grid">
      <button
        type="button"
        class="preset"
        class:active={!ambientName}
        aria-label="No ambient loop"
        on:click={() => setAmbient(null)}
      >
        None
      </button>
      {#each AMBIENT_NAMES as option (option)}
        <button
          type="button"
          class="preset"
          class:active={ambientName === option}
          on:click={() => setAmbient(option)}
        >
          {AMBIENT_LABEL[option]}
        </button>
      {/each}
    </div>

    {#if ambientName}
      {#if AMBIENT_NOTE[ambientName]}
        <small class="hint">{AMBIENT_NOTE[ambientName]}</small>
      {/if}
      <div class="field-row">
        <div class="form-group">
          <label for="ambient-duration">Cycle (ms)</label>
          <input
            id="ambient-duration"
            type="number"
            min="200"
            max="120000"
            step="200"
            value={config.ambient?.duration ?? 6000}
            on:input={(e) => setAmbientField('duration', intOr(e.currentTarget.value, 6000))}
          />
        </div>
        {#if AMBIENT_TRAVELS.has(ambientName)}
          <div class="form-group">
            <label for="ambient-distance">Amount (px)</label>
            <input
              id="ambient-distance"
              type="number"
              min="0"
              max="200"
              step="2"
              value={config.ambient?.distance ?? 10}
              on:input={(e) => setAmbientField('distance', intOr(e.currentTarget.value, 10))}
            />
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="section">
    <h4>Parallax</h4>
    <p class="hint">
      Drifts against the page as it scrolls. Positive lags behind — the classic distant background.
      Negative runs ahead of the scroll.
    </p>
    <div class="form-group">
      <label for="scroll-parallax">Drift</label>
      <input
        id="scroll-parallax"
        type="range"
        min="-50"
        max="50"
        step="1"
        value={config.scrollEffect?.parallax ?? 0}
        on:input={(e) => setParallax(intOr(e.currentTarget.value, 0))}
      />
      <span class="value">
        {config.scrollEffect?.parallax ?? 0}
        {#if config.scrollEffect?.parallax}
          · {(config.scrollEffect.parallax ?? 0) > 0 ? 'behind' : 'ahead of'} the page
        {:else}
          · off
        {/if}
      </span>
    </div>
  </div>
</div>

<style>
  .motion-editor {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 12px 0;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section h4 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-secondary);
  }

  .hint {
    margin: 0;
    font-size: 11px;
    line-height: 1.5;
    color: var(--color-text-secondary);
    opacity: 0.85;
  }

  .hint.inline {
    flex: 1;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 6px;
  }

  .preset {
    padding: 7px 4px;
    font-size: 11px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm, 6px);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    cursor: pointer;
    transition:
      border-color var(--motion-fast),
      background var(--motion-fast);
  }

  .preset:hover {
    border-color: var(--color-primary);
  }

  .preset.active {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fff;
  }

  .preview-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .preview-tile {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    flex: 0 0 auto;
    border-radius: var(--radius-sm, 6px);
    background: var(--color-primary);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
  }

  .replay {
    padding: 6px 12px;
    font-size: 11px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm, 6px);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-group label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: var(--color-text-secondary);
  }

  .value {
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    color: var(--color-text-secondary);
    opacity: 0.8;
  }

  .checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--color-text-primary);
  }

  .checkbox input {
    width: auto;
  }

  input[type='number'],
  select {
    width: 100%;
    padding: 6px 8px;
    font-size: 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm, 6px);
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  input[type='range'] {
    width: 100%;
  }
</style>
