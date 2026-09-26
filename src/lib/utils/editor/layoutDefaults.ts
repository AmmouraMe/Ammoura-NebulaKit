/**
 * Built-in layout defaults - Source of truth for built-in layout configurations
 *
 * This module defines the default content for built-in layouts.
 * When updating default configurations, increment CURRENT_BUILTIN_VERSION
 * in builtin-seeding.ts and the seeding system will propagate changes.
 */

import type { LayoutWidgetData } from '$lib/types/revisions';

/**
 * Built-in layout definition
 */
export interface BuiltinLayoutDefinition {
  slug: string; // Stable slug like 'default'
  name: string;
  description: string;
  isDefault: boolean;
  getWidgets: () => LayoutWidgetData[];
}

/**
 * Generate a deterministic ID for a layout widget
 * Uses a stable format for built-in layouts
 */
function generateWidgetId(layoutSlug: string, widgetType: string, position: number): string {
  return `${layoutSlug}-${widgetType}-${position}`;
}

/**
 * Get the default layout widgets configuration
 * This layout has a navbar at top, yield in middle, and footer at bottom
 */
export function getDefaultLayoutWidgets(): LayoutWidgetData[] {
  return [
    {
      id: generateWidgetId('default', 'navbar', 0),
      type: 'navbar',
      position: 0,
      config: {
        // This will be populated with the navbar component ID during seeding
        componentId: null
      }
    },
    {
      id: generateWidgetId('default', 'yield', 1),
      type: 'yield',
      position: 1,
      config: {}
    },
    {
      id: generateWidgetId('default', 'footer', 2),
      type: 'footer',
      position: 2,
      config: {
        // This will be populated with the footer component ID during seeding
        componentId: null
      }
    }
  ];
}

/**
 * Get a minimal layout with just the yield component
 * Useful for custom pages that don't need navbar/footer
 */
export function getMinimalLayoutWidgets(): LayoutWidgetData[] {
  return [
    {
      id: generateWidgetId('minimal', 'yield', 0),
      type: 'yield',
      position: 0,
      config: {}
    }
  ];
}

/**
 * Get a layout with just navbar and yield (no footer)
 * Useful for landing pages
 */
export function getHeaderOnlyLayoutWidgets(): LayoutWidgetData[] {
  return [
    {
      id: generateWidgetId('header-only', 'navbar', 0),
      type: 'navbar',
      position: 0,
      config: {
        componentId: null
      }
    },
    {
      id: generateWidgetId('header-only', 'yield', 1),
      type: 'yield',
      position: 1,
      config: {}
    }
  ];
}

/**
 * All built-in layout definitions
 */
export const BUILTIN_LAYOUTS: BuiltinLayoutDefinition[] = [
  {
    slug: 'default',
    name: 'Default Layout',
    description: 'Basic layout with header, content area, and footer',
    isDefault: true,
    getWidgets: getDefaultLayoutWidgets
  },
  {
    // Enabled for the coming-soon holding page, which must not wear the site's
    // navbar and footer: while the gate is up every link in them answers 503,
    // so a holding page carrying them is a page of dead ends. getMinimalLayout-
    // Widgets has said "useful for custom pages that don't need navbar/footer"
    // since it was written; this is that page.
    slug: 'minimal',
    name: 'Minimal Layout',
    description: 'Just the content area — no navbar, no footer',
    isDefault: false,
    getWidgets: getMinimalLayoutWidgets
  }
  // Future layouts can be added here:
  // {
  //   slug: 'header-only',
  //   name: 'Header Only Layout',
  //   description: 'Layout with navbar and content, no footer',
  //   isDefault: false,
  //   getWidgets: getHeaderOnlyLayoutWidgets
  // }
];

/**
 * Get the default widgets for a built-in layout by slug
 */
export function getBuiltinLayoutWidgets(slug: string): LayoutWidgetData[] | null {
  const definition = BUILTIN_LAYOUTS.find((l) => l.slug === slug);
  return definition ? definition.getWidgets() : null;
}
