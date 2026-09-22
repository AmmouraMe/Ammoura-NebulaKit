/**
 * The platform's own name, in the few places a tenant has not supplied one.
 *
 * The platform was codenamed **Hermes** until 2026-09-22. That name reached
 * user-visible strings — store-name fallbacks, navbar logo text, page titles,
 * the AI assistant — and it reached seeded database rows, which is why the old
 * spelling survives here as a placeholder rather than disappearing outright.
 */
export const PLATFORM_NAME = 'Ammoura';

/** Shown when a site has no `general_store_name` setting of its own. */
export const DEFAULT_STORE_NAME = PLATFORM_NAME;

/** Name of the built-in AI assistant in the admin panel. */
export const AI_ASSISTANT_NAME = `${PLATFORM_NAME} AI`;

/**
 * Navbar logo texts that mean "nobody has customised this yet", so the site's
 * own store name may replace them.
 *
 * `Hermes eCommerce` is the pre-rename spelling of the same default and still
 * sits in every row seeded before 2026-09-22, so it stays recognised. Dropping
 * it would freeze the old brand into those navbars permanently.
 */
export const PLACEHOLDER_LOGO_TEXTS: readonly string[] = [
  'Store',
  PLATFORM_NAME,
  'Hermes eCommerce'
];

/** True when `text` is a default nobody has replaced with their own. */
export function isPlaceholderLogoText(text: string | undefined): boolean {
  return text !== undefined && PLACEHOLDER_LOGO_TEXTS.includes(text);
}
