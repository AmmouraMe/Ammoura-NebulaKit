<script lang="ts">
  import type { WidgetConfig, SpacingConfig } from '$lib/types/pages';
  import type { SiteContext, UserInfo } from '$lib/utils/templateSubstitution';
  import { substituteTemplate, createUserContext } from '$lib/utils/templateSubstitution';
  import { resolveThemeColor } from '$lib/utils/editor/colorThemes';
  import IconDisplay from '$lib/components/admin/IconDisplay.svelte';

  export let config: WidgetConfig;
  export let siteContext: SiteContext | undefined = undefined;
  export let user: UserInfo | null | undefined = undefined;
  export let colorTheme: string = 'vibrant';
  // When true, prevents navigation for links (used in builder preview)
  export let isEditable = false;

  $: rawLabel = config.label || 'Button';
  $: userContext = createUserContext(user);
  $: label = siteContext
    ? substituteTemplate(rawLabel, { site: siteContext, user: userContext })
    : rawLabel;
  /**
   * The URL is substituted as well as the label.
   *
   * `${site.email}` and `${site.name}` are documented placeholders, and a link
   * is exactly where you want the first of them — `mailto:${site.email}` is the
   * obvious "contact us" button. Only the label was substituted before, so that
   * button shipped with a literal `${site.email}` in its href: a broken link,
   * and on a holding page it is the only link there is.
   */
  $: rawUrl = config.url || '#';
  $: url =
    siteContext && rawUrl.includes('${')
      ? substituteTemplate(rawUrl, { site: siteContext, user: userContext })
      : rawUrl;
  $: variant = config.variant || 'primary';
  $: size = config.size || 'medium';
  $: fullWidth = config.fullWidth || false;
  $: alignment = config.buttonAlign || config.alignment || 'left';
  $: icon = config.icon || '';
  $: iconAfter = config.iconAfter || '';
  $: iconSize = size === 'small' ? 14 : size === 'large' ? 20 : 16;

  // Custom styling props
  $: customBgColor = config.backgroundColor
    ? resolveThemeColor(config.backgroundColor, colorTheme, '', true)
    : '';
  $: customTextColor = config.textColor
    ? resolveThemeColor(config.textColor, colorTheme, '', true)
    : '';
  $: customBorderColor = config.borderColor
    ? resolveThemeColor(config.borderColor, colorTheme, '', true)
    : '';
  $: customBorderRadius = config.borderRadius;
  $: customFontSize = getResponsiveValue(config.fontSize);
  $: customPadding = getResponsiveValue(config.padding) as SpacingConfig | undefined;

  // Helper to get responsive value (desktop by default for SSR)
  function getResponsiveValue<T>(
    value: T | { mobile?: T; tablet?: T; desktop: T } | undefined
  ): T | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'object' && value !== null && 'desktop' in value) {
      return (value as { desktop: T }).desktop;
    }
    return value as T;
  }

  // Prevents link navigation when in edit mode (builder preview)
  function handleLinkClick(event: MouseEvent): void {
    if (isEditable) {
      event.preventDefault();
    }
  }

  // Helper to check if a color value is effectively transparent
  function isTransparent(color: string): boolean {
    if (!color) return true;
    const lower = color.toLowerCase().trim();
    return (
      lower === 'transparent' ||
      lower === 'rgba(0, 0, 0, 0)' ||
      lower === 'rgba(0,0,0,0)' ||
      lower === 'hsla(0, 0%, 0%, 0)' ||
      lower === 'hsla(0,0%,0%,0)'
    );
  }

  // Build inline style string for custom styles
  $: customStyle = (() => {
    const styles: string[] = [];
    // Don't add background-color when it's transparent (let CSS handle it)
    if (customBgColor && !isTransparent(customBgColor)) {
      styles.push(`background-color: ${customBgColor}`);
    }
    if (customTextColor) styles.push(`color: ${customTextColor}`);
    if (customBorderColor) styles.push(`border: 1px solid ${customBorderColor}`);
    if (customBorderRadius !== undefined) styles.push(`border-radius: ${customBorderRadius}px`);
    if (customFontSize) styles.push(`font-size: ${customFontSize}px`);
    if (customPadding) {
      styles.push(
        `padding: ${customPadding.top || 0}px ${customPadding.right || 0}px ${customPadding.bottom || 0}px ${customPadding.left || 0}px`
      );
    }
    return styles.join('; ');
  })();

  // Check if we have custom styles (to override variant styling)
  // Transparent backgrounds don't count as custom styles
  $: hasCustomStyles =
    (customBgColor && !isTransparent(customBgColor)) || customTextColor || customBorderColor;
</script>

<div class="button-widget" id={config.anchorName || undefined} style="text-align: {alignment}">
  <a
    href={url}
    class="btn btn-{variant} btn-{size}"
    class:btn-full={fullWidth}
    class:has-icon={icon}
    class:custom-styled={hasCustomStyles}
    style={customStyle}
    on:click={handleLinkClick}
  >
    {#if icon}
      <span class="btn-icon">
        <IconDisplay iconName={icon} size={iconSize} />
      </span>
    {/if}
    <span class="btn-label"
      >{label}{#if iconAfter}&nbsp;{iconAfter}{/if}</span
    >
  </a>
</div>

<style>
  .button-widget {
    padding: 0.5rem 0;
    /* Don't stretch button widget when parent is centered */
    width: fit-content;
    max-width: 100%;
    /* Center the button when in a block container */
    margin-left: auto;
    margin-right: auto;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 500;
    transition: all 0.2s;
    border: none;
    cursor: pointer;
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .btn-label {
    line-height: 1;
  }

  /* Only apply variant colors when not custom styled */
  .btn-primary:not(.custom-styled) {
    background: var(--color-primary, #3b82f6);
    color: white;
  }

  .btn-primary:not(.custom-styled):hover {
    background: var(--color-primary-dark, #2563eb);
  }

  .btn-secondary:not(.custom-styled) {
    background: var(--color-secondary, #64748b);
    color: white;
  }

  .btn-secondary:not(.custom-styled):hover {
    background: var(--color-secondary-dark, #475569);
  }

  .btn-outline:not(.custom-styled) {
    background: transparent;
    border: 2px solid var(--color-primary, #3b82f6);
    color: var(--color-primary, #3b82f6);
  }

  .btn-outline:not(.custom-styled):hover {
    background: var(--color-primary, #3b82f6);
    color: white;
  }

  .btn-text:not(.custom-styled) {
    background: transparent;
    color: var(--color-primary, #3b82f6);
    padding: 0.5rem 0.75rem;
  }

  .btn-text:not(.custom-styled):hover {
    background: rgba(59, 130, 246, 0.1);
  }

  /* Custom styled buttons - subtle hover effect */
  .btn.custom-styled:hover {
    opacity: 0.9;
    filter: brightness(1.1);
  }

  .btn-small {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    gap: 0.375rem;
  }

  .btn-medium {
    padding: 0.5rem 1rem;
    font-size: 1rem;
  }

  .btn-large {
    padding: 0.75rem 1.5rem;
    font-size: 1.125rem;
    gap: 0.625rem;
  }

  .btn-full {
    display: flex;
    width: 100%;
    text-align: center;
  }
</style>
