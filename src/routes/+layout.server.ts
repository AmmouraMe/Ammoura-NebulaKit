import { getDB } from '$lib/server/db/connection';
import { DEFAULT_STORE_NAME, isPlaceholderLogoText } from '$lib/branding';
import * as colorThemes from '$lib/server/db/color-themes';
import { getUserThemePreferences } from '$lib/server/db/user-theme-preferences';
import { getGeneralSettings } from '$lib/server/db/site-settings';
import { translateGeneralSettings } from '$lib/server/i18n/content-translations';
import { getDefaultLayout, getLayoutComponents } from '$lib/server/db/layouts';
import { getComponent, getGlobalComponentByName } from '$lib/server/db/components';
import { createSiteContext, createDefaultSiteContext } from '$lib/utils/templateSubstitution';
import type { LayoutServerLoad } from './$types';
import type { WidgetConfig, PositionConfig, ResponsiveValue } from '$lib/types/pages';

// Navbar config with component resolved and position settings from layout
export interface NavbarLayoutData {
  type: 'navbar';
  config: WidgetConfig;
  position?: ResponsiveValue<PositionConfig>;
}

// Footer config with component resolved and position settings from layout
export interface FooterLayoutData {
  type: 'footer';
  config: WidgetConfig;
  position?: ResponsiveValue<PositionConfig>;
}

// Layout data passed to the frontend
export interface LayoutData {
  navbar: NavbarLayoutData | null;
  footer: FooterLayoutData | null;
  pageProperties?: {
    maxWidth?: string;
    width?: string;
    padding?: string;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    backgroundColor?: string;
    backgroundImage?: string;
    minHeight?: string;
  };
}

export const load: LayoutServerLoad = async ({ platform, locals }) => {
  // Default navbar config - uses Container-based architecture with children widgets
  // This matches the Navigation Bar component designed in the builder.
  // Note: The full children structure is stored in the database migration (0049_update_navbar_from_builder.sql)
  // Here we provide a simplified fallback for when the database is not available.
  const defaultNavbarConfig: WidgetConfig = {
    containerPadding: {
      desktop: { top: 16, right: 24, bottom: 16, left: 24 },
      tablet: { top: 12, right: 20, bottom: 12, left: 20 },
      mobile: { top: 12, right: 16, bottom: 12, left: 16 }
    },
    containerMargin: {
      desktop: { top: 0, right: 0, bottom: 0, left: 0 },
      tablet: { top: 0, right: 0, bottom: 0, left: 0 },
      mobile: { top: 0, right: 0, bottom: 0, left: 0 }
    },
    containerBackground: 'theme:secondary',
    containerBorderRadius: 0,
    containerMaxWidth: '1400px',
    containerJustifyContent: 'space-between',
    containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
    containerFlexDirection: { desktop: 'row', tablet: 'row', mobile: 'column' },
    containerAlignItems: 'stretch',
    containerWrap: 'nowrap',
    containerGap: { desktop: 16, tablet: 16, mobile: 16 },
    containerWidth: { desktop: 'auto', tablet: 'auto', mobile: 'auto' },
    containerGridCols: { desktop: 3, tablet: 2, mobile: 1 },
    containerGridAutoFlow: { desktop: 'row', tablet: 'row', mobile: 'row' },
    visibilityRule: 'always',
    sticky: false,
    // Children are simplified for the fallback config - full structure is in database
    children: []
  };

  // If platform is not available (development without D1), return defaults
  if (!platform?.env?.DB) {
    return {
      themeColorsLight: null,
      themeColorsDark: null,
      systemLightThemeId: 'vibrant',
      systemDarkThemeId: 'midnight',
      userColorScheme: null,
      currentUser: locals.currentUser || null,
      currentAccount: locals.account || null,
      storeName: DEFAULT_STORE_NAME,
      locale: locals.locale ?? 'en',
      i18n: locals.i18n ?? { defaultLocale: 'en', enabledLocales: ['en'] },
      currency: 'USD',
      layoutData: {
        navbar: { type: 'navbar' as const, config: defaultNavbarConfig, position: undefined },
        footer: null,
        pageProperties: undefined
      }
    };
  }

  try {
    const db = getDB(platform);
    const siteId = locals.siteId || 'default-site';

    // Get general settings, system default theme IDs, and layout data
    const [generalSettingsRaw, systemLightThemeId, systemDarkThemeId, defaultLayout] =
      await Promise.all([
        getGeneralSettings(db, siteId),
        colorThemes.getThemePreference(db, siteId, 'system-light-theme'),
        colorThemes.getThemePreference(db, siteId, 'system-dark-theme'),
        getDefaultLayout(db, siteId)
      ]);

    // Localize translatable settings so ${site.name}/${site.tagline} render in
    // the visitor's language (no-op for the default locale)
    const generalSettings = await translateGeneralSettings(
      db,
      siteId,
      locals.locale,
      locals.i18n?.defaultLocale ?? 'en',
      generalSettingsRaw
    );

    // Fetch all themes and user preferences in parallel
    const userId = locals.currentUser?.id;
    const [allThemes, userPrefs] = await Promise.all([
      colorThemes.getAllColorThemes(db, siteId),
      userId ? getUserThemePreferences(db, siteId, userId) : Promise.resolve(null)
    ]);

    // Resolve effective theme IDs: user preference > site default > fallback
    const effectiveLightThemeId = userPrefs?.light_theme_id || systemLightThemeId || 'vibrant';
    const effectiveDarkThemeId = userPrefs?.dark_theme_id || systemDarkThemeId || 'midnight';

    // Get the effective themes (considering user preferences)
    const lightTheme = allThemes.find((t) => t.id === effectiveLightThemeId);
    const darkTheme = allThemes.find((t) => t.id === effectiveDarkThemeId);

    // Map color_themes colors to the old SiteThemeColors format for compatibility
    const mapThemeColors = (theme: { colors: Record<string, string> } | null | undefined) => {
      if (!theme) return null;
      const colors = theme.colors;
      return {
        primary: colors.primary,
        primaryHover: colors.primary, // Use same as primary
        primaryLight: colors.accent,
        secondary: colors.secondary,
        secondaryHover: colors.secondary,
        bgPrimary: colors.background,
        bgSecondary: colors.surface,
        bgTertiary: colors.surface,
        textPrimary: colors.text,
        textSecondary: colors.textSecondary,
        borderPrimary: colors.border,
        borderSecondary: colors.border
      };
    };

    // Load layout widgets if we have a default layout
    const layoutData: LayoutData = { navbar: null, footer: null };
    if (defaultLayout) {
      const layoutWidgets = await getLayoutComponents(db, defaultLayout.id);

      // Parse layout page_properties if available
      if (defaultLayout.page_properties) {
        try {
          const parsed =
            typeof defaultLayout.page_properties === 'string'
              ? JSON.parse(defaultLayout.page_properties)
              : defaultLayout.page_properties;
          layoutData.pageProperties = parsed;
        } catch {
          // Ignore malformed JSON
        }
      }

      // Process layout widgets to resolve component references
      for (const widget of layoutWidgets) {
        // Extract position settings from the layout widget (if set)
        const widgetPosition = widget.config?.position as
          ResponsiveValue<PositionConfig> | undefined;

        // Handle component_ref widgets that reference navbar or footer components
        if (widget.type === 'component_ref' && widget.config?.componentId) {
          const component = await getComponent(db, siteId, widget.config.componentId as number);
          if (component) {
            const config: WidgetConfig = { ...component.config };

            if (component.type === 'navbar') {
              // Use site title from settings if logo text is default
              if (config.logo && isPlaceholderLogoText(config.logo.text)) {
                config.logo.text = generalSettings.storeName || DEFAULT_STORE_NAME;
              }
              layoutData.navbar = { type: 'navbar', config, position: widgetPosition };
            } else if (component.type === 'footer') {
              layoutData.footer = { type: 'footer', config, position: widgetPosition };
            }
          }
        }
        // Handle direct navbar/footer widgets (legacy or with componentId)
        else if (widget.type === 'navbar' || widget.type === 'footer') {
          let config: WidgetConfig = widget.config || {};

          // If the widget references a component, load the component's config
          if (config.componentId) {
            const component = await getComponent(db, siteId, config.componentId as number);
            if (component) {
              config = { ...component.config, ...config };
              // Remove componentId from the final config since we've resolved it
              delete config.componentId;
            }
          }

          if (widget.type === 'navbar') {
            // Use site title from settings if logo text is default
            if (config.logo && isPlaceholderLogoText(config.logo.text)) {
              config.logo.text = generalSettings.storeName || DEFAULT_STORE_NAME;
            }
            layoutData.navbar = { type: 'navbar', config, position: widgetPosition };
          } else if (widget.type === 'footer') {
            layoutData.footer = { type: 'footer', config, position: widgetPosition };
          }
        }
      }
    }

    // If no navbar in layout, try to load the global "Navigation Bar" component from the builder
    if (!layoutData.navbar) {
      const navbarComponent = await getGlobalComponentByName(db, 'Navigation Bar');
      if (navbarComponent) {
        // Use the component's config (cast to WidgetConfig for type safety)
        const config: WidgetConfig = { ...navbarComponent.config };
        // Update site title if logo text is default
        if (config.logo && isPlaceholderLogoText(config.logo.text)) {
          config.logo.text = generalSettings.storeName || DEFAULT_STORE_NAME;
        }
        layoutData.navbar = { type: 'navbar', config };
      } else {
        // Fall back to hardcoded default if component doesn't exist
        const navbarWithStoreName = {
          ...defaultNavbarConfig,
          logo: {
            ...defaultNavbarConfig.logo,
            text: generalSettings.storeName || DEFAULT_STORE_NAME
          }
        };
        layoutData.navbar = { type: 'navbar', config: navbarWithStoreName };
      }
    }

    return {
      themeColorsLight: mapThemeColors(lightTheme as never),
      themeColorsDark: mapThemeColors(darkTheme as never),
      systemLightThemeId: effectiveLightThemeId,
      systemDarkThemeId: effectiveDarkThemeId,
      userColorScheme: userPrefs?.color_scheme || null,
      currentUser: locals.currentUser || null,
      currentAccount: locals.account || null,
      storeName: generalSettings.storeName || DEFAULT_STORE_NAME,
      siteContext: createSiteContext(generalSettings),
      locale: locals.locale ?? 'en',
      i18n: locals.i18n ?? { defaultLocale: 'en', enabledLocales: ['en'] },
      currency: generalSettings.currency || 'USD',
      layoutData
    };
  } catch (error) {
    console.error('Error loading theme colors:', error);
    return {
      themeColorsLight: null,
      themeColorsDark: null,
      systemLightThemeId: 'vibrant',
      systemDarkThemeId: 'midnight',
      userColorScheme: null,
      currentUser: locals.currentUser || null,
      currentAccount: locals.account || null,
      storeName: DEFAULT_STORE_NAME,
      siteContext: createDefaultSiteContext(),
      locale: locals.locale ?? 'en',
      i18n: locals.i18n ?? { defaultLocale: 'en', enabledLocales: ['en'] },
      currency: 'USD',
      layoutData: {
        navbar: { type: 'navbar' as const, config: defaultNavbarConfig, position: undefined },
        footer: null,
        pageProperties: undefined
      }
    };
  }
};
