<script lang="ts">
  /**
   * MotionBox — the one element that carries a component's motion.
   *
   * Every component on the public frontend is already rendered inside exactly
   * one wrapper div: `.component-container` in PageWithLayout for a top-level
   * component, `.child-wrapper` in FrontendComponentRenderer for a nested one.
   * This replaces those divs rather than adding another, so motion costs no
   * extra DOM, and it is the reason the whole system needed three edits in two
   * files instead of a wrapper around each of the twenty-odd builtin types.
   *
   * With no motion configured it renders the same div it replaced, with the same
   * class and the same style string. That is deliberate: motion has to be
   * something a page can be entirely free of.
   */
  import { motion as motionAction } from '$lib/actions/motion';
  import {
    motionStyle,
    resolveMotion,
    type AmbientConfig,
    type MotionConfig,
    type ScrollEffectConfig
  } from '$lib/utils/motion';

  export let motion: MotionConfig | undefined = undefined;
  export let ambient: AmbientConfig | undefined = undefined;
  export let scrollEffect: ScrollEffectConfig | undefined = undefined;

  /** Extra reveal delay in ms. A container passes `index * stagger` here. */
  export let delayOffset = 0;

  /** Layout styles from the caller. Motion's own variables are appended. */
  export let style = '';

  /** `class` is a reserved word, so it comes in renamed and goes out as itself. */
  let className = '';
  export { className as class };

  /** Passed through for the `data-component-type` hook the frontend already uses. */
  export let componentType: string | undefined = undefined;

  $: resolved = resolveMotion(motion);
  $: emitted = motionStyle({ motion, ambient, scrollEffect, delayOffset });

  /** Join two style strings without producing `;;` or a leading separator. */
  $: mergedStyle = [style.trim().replace(/;$/, ''), emitted.style].filter(Boolean).join('; ');

  $: actionParams = {
    hasReveal: emitted.hasReveal,
    hasScroll: emitted.hasScroll,
    trigger: resolved?.trigger,
    threshold: resolved?.threshold,
    once: resolved?.once
  };
</script>

<div
  class="{className} {emitted.className}"
  style={mergedStyle}
  data-motion={emitted.hasReveal ? 'pending' : undefined}
  data-component-type={componentType}
  use:motionAction={actionParams}
>
  <slot />
</div>
