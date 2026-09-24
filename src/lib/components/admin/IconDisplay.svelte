<script lang="ts">
  import type { ComponentType, SvelteComponent } from 'svelte';
  import * as icons from 'lucide-svelte';

  export let iconName: string;
  export let size: number = 24;
  export let fallbackEmoji: string = '🔒';

  // Get all available icons
  const allIcons = Object.entries(icons)
    .filter(([name]) => !name.includes('Lucide'))
    .map(([name, component]) => ({ name, component: component as ComponentType<SvelteComponent> }));

  // Find the icon component
  $: IconComponent = allIcons.find((i) => i.name === iconName)?.component as
    ComponentType<SvelteComponent> | undefined;

  // Check if iconName is an emoji (simple check: single character or 2-4 chars for multi-byte emojis)
  $: isEmoji = !IconComponent && iconName && iconName.length <= 4;
</script>

{#if IconComponent}
  <svelte:component this={IconComponent} {size} />
{:else if isEmoji}
  <span class="emoji-fallback" style="font-size: {size}px">{iconName}</span>
{:else}
  <span class="emoji-fallback" style="font-size: {size}px">{fallbackEmoji}</span>
{/if}

<style>
  .emoji-fallback {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }
</style>
