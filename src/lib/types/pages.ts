/**
 * Page and Component types for WYSIWYG page editor
 */

import type { AmbientConfig, MotionConfig, ScrollEffectConfig } from '$lib/utils/motion';

export type { AmbientConfig, MotionConfig, ScrollEffectConfig };

export type PageStatus = 'draft' | 'published';

export type ComponentType =
  | 'single_product'
  | 'product_list'
  | 'text'
  | 'image'
  | 'icon' // Icon display using Lucide icons
  | 'hero'
  | 'button'
  | 'dropdown'
  | 'spacer'
  | 'columns'
  | 'heading'
  | 'divider'
  | 'features'
  | 'pricing'
  | 'cta'
  | 'navbar'
  | 'footer'
  | 'theme_toggle' // Light/dark theme toggle button
  | 'scene' // Generative ambient backdrop (starfield, aurora, grid)
  | 'yield' // Special component type for layouts - renders page content
  | 'container' // Container with padding and background
  | 'composite' // Multi-part component composition
  | 'component_ref'; // Reference to a saved component (renders component's composition)

/**
 * @deprecated Use ComponentType instead
 */
export type WidgetType = ComponentType;

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export type ColorTheme = string; // Now supports custom theme IDs

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

// Theme-specific color value - supports different colors per theme
export interface ThemeSpecificColor {
  [themeId: string]: string; // Map theme ID to color value
}

export interface ColorThemeDefinition {
  id: string;
  name: string;
  mode: ThemeMode;
  colors: ThemeColors;
  isDefault: boolean;
  isSystem: boolean; // System themes cannot be deleted
  created_at?: number;
  updated_at?: number;
}

export interface Page {
  id: string;
  site_id: string;
  title: string;
  slug: string;
  status: PageStatus;
  content?: string;
  colorTheme?: ColorTheme; // Selected theme for this page
  layout_id?: number | null; // Layout to use for this page (required)
  is_builtin: boolean; // If true, this is a system page that cannot be deleted
  created_at: number;
  updated_at: number;
}

export interface Layout {
  id: number;
  site_id: string;
  name: string;
  description?: string;
  slug: string;
  is_default: boolean;
  is_builtin: boolean;
  page_properties?: string; // JSON string of PageProperties - layout-level styling
  created_at: string;
  updated_at: string;
}

export interface LayoutComponent {
  id: string;
  layout_id: number;
  type: ComponentType;
  config: ComponentConfig;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated Use LayoutComponent instead
 */
export type LayoutWidget = LayoutComponent;

export interface Component {
  id: number;
  site_id: string;
  name: string;
  description?: string;
  type: string; // Component type this represents (kept for backward compatibility)
  config: Record<string, unknown>; // JSON configuration (kept for backward compatibility)
  is_global: boolean; // If true, available to all sites (system component)
  is_primitive: boolean; // If true, this is a base building block (Container, Button, Text, etc.)
  created_at: string;
  updated_at: string;
}

export interface ChildComponent {
  id: string;
  component_id: number;
  type: ComponentType;
  config: ComponentConfig;
  position: number;
  parent_id?: string; // Parent component ID for nested components
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated Use ChildComponent instead
 */
export type ComponentWidget = ChildComponent;

export interface ComponentWithChildren extends Component {
  children: ChildComponent[];
}

/**
 * @deprecated Use ComponentWithChildren instead
 */
export type ComponentWithWidgets = ComponentWithChildren & {
  widgets: ChildComponent[];
};

export interface PageComponent {
  id: string;
  page_id: string;
  type: ComponentType;
  config: ComponentConfig;
  position: number;
  created_at: number;
  updated_at: number;
  parent_id?: string; // For nested components within containers
}

/**
 * @deprecated Use PageComponent instead
 */
export type PageWidget = PageComponent;

// Responsive value type - allows different values per breakpoint
export interface ResponsiveValue<T> {
  mobile?: T;
  tablet?: T;
  desktop: T;
}

// Spacing configuration - allows 'auto' for margin values (CSS auto margin for centering)
export interface SpacingConfig {
  top?: number | 'auto';
  right?: number | 'auto';
  bottom?: number | 'auto';
  left?: number | 'auto';
}

// Typography configuration
export interface TypographyConfig {
  fontSize?: number;
  fontWeight?:
    | 'normal'
    | 'bold'
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900';
  fontStyle?: 'normal' | 'italic' | 'oblique';
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through' | 'overline';
}

// Border configuration
export interface BorderConfig {
  width?: number;
  style?: 'none' | 'solid' | 'dashed' | 'dotted';
  color?: string;
  radius?: number;
}

// Border width configuration (per side)
export interface BorderWidthConfig {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

// Border style configuration (per side)
export interface BorderStyleConfig {
  top?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double';
  right?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double';
  bottom?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double';
  left?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double';
}

// Shadow configuration
export interface ShadowConfig {
  x?: number;
  y?: number;
  blur?: number;
  spread?: number;
  color?: string;
  inset?: boolean;
}

// Transform configuration
export interface TransformConfig {
  translateX?: string;
  translateY?: string;
  translateZ?: string;
  rotate?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  skewX?: number;
  skewY?: number;
}

// Filter configuration
export interface FilterConfig {
  blur?: number;
  brightness?: number;
  contrast?: number;
  grayscale?: number;
  hueRotate?: number;
  invert?: number;
  opacity?: number;
  saturate?: number;
  sepia?: number;
}

/**
 * @deprecated Declared but never rendered — no code has ever read it. Use
 * `ComponentConfig.motion` / `.ambient` / `.scrollEffect` instead, which the
 * builder can edit and `$lib/utils/motion.ts` actually turns into CSS.
 */
// Transition configuration
export interface TransitionConfig {
  property?: string;
  duration?: number;
  timingFunction?: 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  delay?: number;
}

/**
 * @deprecated Declared but never rendered. See the note on TransitionConfig.
 */
// Animation configuration
export interface AnimationConfig {
  name?: string;
  duration?: number;
  timingFunction?: 'ease' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  delay?: number;
  iterationCount?: number | 'infinite';
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
}

// Position configuration
export interface PositionConfig {
  type?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: number;
}

// Overflow configuration
export interface OverflowConfig {
  x?: 'visible' | 'hidden' | 'scroll' | 'auto';
  y?: 'visible' | 'hidden' | 'scroll' | 'auto';
}

// Background configuration
export interface BackgroundConfig {
  color?: string;
  image?: string;
  size?: 'cover' | 'contain' | 'auto';
  position?: string;
  repeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
}

// Common style properties that support responsive design
export interface ResponsiveStyles {
  display?: ResponsiveValue<'block' | 'flex' | 'grid' | 'none'>;
  width?: ResponsiveValue<string>;
  height?: ResponsiveValue<string>;
  padding?: ResponsiveValue<SpacingConfig>;
  margin?: ResponsiveValue<SpacingConfig>;
  textAlign?: ResponsiveValue<'left' | 'center' | 'right' | 'justify'>;
}

// Component configuration types
export interface ComponentConfig {
  // Common fields
  id?: string;
  anchorName?: string; // Optional anchor name for linking to this component (e.g., /#section-name)
  styles?: ResponsiveStyles;
  themeOverrides?: Partial<ThemeColors>; // Component-specific theme color overrides

  // Universal styling properties (available for all components)
  borderWidth?: number; // Border width in pixels
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted' | 'double'; // Border style
  minWidth?: string; // Min width constraint (e.g., '0', '200px')
  maxWidth?: string; // Max width constraint (e.g., 'none', '100%', '1200px')
  minHeight?: string; // Min height constraint
  maxHeight?: string; // Max height constraint

  // Visibility controls - show/hide based on auth state and user roles
  visibilityRule?: 'always' | 'authenticated' | 'unauthenticated' | 'role'; // When to show this component
  requiredRoles?: string[]; // Role names required to see this component (when visibilityRule is 'role')
  hideFromRoles?: string[]; // Role names that should NOT see this component

  // Advanced styling properties (responsive)
  boxShadow?: ResponsiveValue<ShadowConfig | ShadowConfig[]>; // Support multiple shadows
  textShadow?: ResponsiveValue<ShadowConfig>;
  transform?: ResponsiveValue<TransformConfig>;
  filter?: ResponsiveValue<FilterConfig>;
  backdropFilter?: ResponsiveValue<FilterConfig>;
  /** @deprecated Never rendered. Use `motion` / `ambient` / `scrollEffect`. */
  transition?: TransitionConfig | TransitionConfig[];
  /** @deprecated Never rendered. Use `motion` / `ambient` / `scrollEffect`. */
  animation?: AnimationConfig | AnimationConfig[];

  // Motion — see $lib/utils/motion.ts. All three are independent and may be
  // combined on one component; all three do nothing at all for a visitor who
  // has asked for reduced motion or who has no JavaScript.
  motion?: MotionConfig; // One-shot entrance, on scroll or on load
  ambient?: AmbientConfig; // Looping keyframe animation
  scrollEffect?: ScrollEffectConfig; // Parallax and --scroll-progress
  position?: ResponsiveValue<PositionConfig>;
  overflow?: ResponsiveValue<OverflowConfig>;
  opacity?: ResponsiveValue<number>;
  cursor?: ResponsiveValue<
    'auto' | 'pointer' | 'grab' | 'grabbing' | 'text' | 'move' | 'not-allowed' | 'default'
  >;
  userSelect?: ResponsiveValue<'none' | 'auto' | 'text' | 'all'>;
  pointerEvents?: ResponsiveValue<'auto' | 'none'>;

  // Visibility and display
  visibility?: ResponsiveValue<'visible' | 'hidden' | 'collapse'>;
  clipPath?: ResponsiveValue<string>; // CSS clip-path value

  // Aspect ratio
  aspectRatio?: ResponsiveValue<string>; // e.g., '16/9', '1/1'

  // Blend modes
  mixBlendMode?: ResponsiveValue<
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'color-burn'
    | 'hard-light'
    | 'soft-light'
    | 'difference'
    | 'exclusion'
    | 'hue'
    | 'saturation'
    | 'color'
    | 'luminosity'
  >;
  backgroundBlendMode?: ResponsiveValue<
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'color-burn'
    | 'hard-light'
    | 'soft-light'
    | 'difference'
    | 'exclusion'
    | 'hue'
    | 'saturation'
    | 'color'
    | 'luminosity'
  >;

  // Single product component
  productId?: string;
  showPrice?: boolean;
  showDescription?: boolean;
  layout?: 'card' | 'inline' | 'detailed';

  // Product list component
  category?: string;
  tags?: string[];
  limit?: number;
  sortBy?: 'name' | 'price' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  columns?: ResponsiveValue<number>;

  // Text component
  text?: string;
  html?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  typography?: TypographyConfig;
  textColor?: string | ThemeSpecificColor;
  fontSize?: number | ResponsiveValue<number>;
  lineHeight?: number;

  // Heading component
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  heading?: string;

  // Image component
  src?: string;
  alt?: string;
  width?: number | string;
  imageWidth?: number | string;
  imageHeight?: number | string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  link?: string;

  // Icon component
  iconName?: string; // Lucide icon name
  iconSize?: number; // Icon size in pixels
  iconColor?: string | ThemeSpecificColor; // Icon color (supports theme colors)
  strokeWidth?: number; // Icon stroke width

  // Hero component
  title?: string;
  subtitle?: string;
  titleColor?: string | ThemeSpecificColor;
  subtitleColor?: string | ThemeSpecificColor;
  backgroundImage?: string;
  backgroundColor?: string | ThemeSpecificColor;
  heroHeight?: ResponsiveValue<string>;
  overlay?: boolean;
  overlayOpacity?: number;
  ctaText?: string;
  ctaLink?: string;
  ctaBackgroundColor?: string | ThemeSpecificColor;
  ctaTextColor?: string | ThemeSpecificColor;
  ctaFontSize?: string;
  ctaFontWeight?: string;
  contentAlign?: 'left' | 'center' | 'right';

  // Button component
  label?: string;
  url?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: ResponsiveValue<boolean>;
  icon?: string;
  openInNewTab?: boolean;
  borderColor?: string | ThemeSpecificColor; // Custom border color for buttons
  borderRadius?: number; // Custom border radius in pixels
  padding?: ResponsiveValue<SpacingConfig>; // Custom padding for buttons
  iconAfter?: string; // Icon or text to show after the label (e.g., '→')
  buttonAlign?: 'left' | 'center' | 'right'; // Button alignment within container

  // Dropdown menu component (container-type with children)
  triggerLabel?: string;
  triggerIcon?: string;
  triggerVariant?: 'text' | 'button' | 'icon';
  showChevron?: boolean;
  menuWidth?: string | number;
  menuAlign?: 'left' | 'center' | 'right';
  menuBackground?: string;
  menuBorderRadius?: number;
  menuShadow?: boolean;
  menuPadding?: SpacingConfig;

  // Legacy dropdown form field (deprecated - use triggerLabel, etc.)
  placeholder?: string;
  options?: Array<{
    value: string;
    label: string;
    icon?: string;
    disabled?: boolean;
    group?: string;
  }>;
  defaultValue?: string;
  required?: boolean;
  searchable?: boolean;
  description?: string;
  name?: string; // Form field name

  // Spacer component
  space?: ResponsiveValue<number>;

  // Columns component
  columnCount?: ResponsiveValue<number>;
  gap?: ResponsiveValue<number>;
  verticalAlign?: 'stretch' | 'start' | 'center' | 'end';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children?: any[]; // Flexible children array - can be PageComponent or inline definitions

  // Divider component
  thickness?: number;
  dividerColor?: string | ThemeSpecificColor;
  dividerStyle?: 'solid' | 'dashed' | 'dotted';
  spacing?: ResponsiveValue<number>;

  // Theme toggle component
  toggleVariant?: 'icon' | 'icon-label' | 'button';

  // Scene component — a generative ambient backdrop. See $lib/utils/scene.ts.
  sceneVariant?: 'stars' | 'aurora' | 'grid';
  sceneDensity?: number; // 0..100, 50 is the designed density
  sceneSpeed?: number; // 0..100, 50 is the designed speed
  scenePointerParallax?: boolean; // Default true; ignored under reduced motion
  sceneColors?: string[]; // Theme refs or hexes; the scene picks from the list
  sceneHeight?: string; // CSS length; the box the scene fills

  // Features component
  features?: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  cardBackground?: string | ThemeSpecificColor;
  cardBorderColor?: string | ThemeSpecificColor;
  cardBorderWidth?: number;
  cardBorderRadius?: number;
  featuresColumns?: ResponsiveValue<number>;
  featuresGap?: ResponsiveValue<number>;
  featuresLimit?: ResponsiveValue<number>; // Max number of features to display per breakpoint

  // Pricing component
  tagline?: string;
  pricingFeatures?: string[]; // Simple string list for pricing
  tiers?: Array<{
    range: string;
    fee: string;
    description: string;
    highlight?: boolean;
  }>;
  ctaNote?: string;
  // Pricing component - extended properties
  headerIcon?: string; // Emoji icon for the section header
  modelTitle?: string; // Title for the features panel (e.g., "Pay-as-You-Grow")
  modelSubtitle?: string; // Subtitle for the features panel
  modelIcon?: string; // Emoji icon for the features panel
  revenueTitle?: string; // Title for the revenue share panel
  revenueIcon?: string; // Emoji icon for the revenue share panel
  showTiersArrow?: boolean; // Whether to show the arrow below tiers
  showCta?: boolean; // Whether to show the CTA button
  highlightBackground?: string | ThemeSpecificColor; // Background color for highlighted tier
  highlightBorderColor?: string | ThemeSpecificColor; // Border color for highlighted tier

  // CTA component (and Hero component's secondary CTA)
  primaryCtaText?: string;
  primaryCtaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  secondaryCtaBackgroundColor?: string | ThemeSpecificColor;
  secondaryCtaTextColor?: string | ThemeSpecificColor;
  secondaryCtaBorderColor?: string | ThemeSpecificColor;
  secondaryCtaFontSize?: string;
  secondaryCtaFontWeight?: string;

  // Component reference (component_ref type)
  componentId?: number; // Reference to a saved component - renders its composition
  logo?: {
    text?: string;
    image?: string;
    url?: string;
    imageHeight?: number; // Logo height in pixels
  };
  links?: Array<{
    text: string;
    url: string;
    openInNewTab?: boolean;
    children?: Array<{
      // Dropdown submenu items
      text: string;
      url: string;
      openInNewTab?: boolean;
    }>;
  }>;
  showSearch?: boolean;
  showCart?: boolean;
  showAuth?: boolean;
  showThemeToggle?: boolean; // Show theme toggle in navbar
  showLanguageSwitcher?: boolean; // Show language switcher in navbar (multilingual sites)
  showAccountMenu?: boolean; // Show account dropdown menu when authenticated
  accountMenuItems?: Array<{
    // Custom menu items in account dropdown
    text: string;
    url: string;
    icon?: string; // Icon name or emoji
    dividerBefore?: boolean; // Show divider before this item
  }>;
  navbarBackground?: string | ThemeSpecificColor;
  navbarTextColor?: string | ThemeSpecificColor;
  navbarHoverColor?: string | ThemeSpecificColor; // Link hover color
  navbarBorderColor?: string | ThemeSpecificColor; // Border color
  navbarShadow?: boolean; // Show shadow on navbar
  sticky?: boolean;
  navbarHeight?: number; // Height in pixels (default: auto)
  navbarPadding?: ResponsiveValue<SpacingConfig>; // Custom padding
  logoPosition?: 'left' | 'center'; // Logo alignment
  linksPosition?: 'left' | 'center' | 'right'; // Links alignment
  actionsPosition?: 'right' | 'left'; // Actions (cart, auth) alignment
  dropdownBackground?: string | ThemeSpecificColor; // Dropdown menu background
  dropdownTextColor?: string | ThemeSpecificColor; // Dropdown text color
  dropdownHoverBackground?: string | ThemeSpecificColor; // Dropdown hover background

  // Footer component
  copyright?: string;
  footerLinks?: Array<{
    text: string;
    url: string;
    openInNewTab?: boolean;
  }>;
  socialLinks?: Array<{
    platform:
      | 'facebook'
      | 'twitter'
      | 'instagram'
      | 'linkedin'
      | 'youtube'
      | 'github'
      | 'tiktok'
      | 'pinterest';
    url: string;
  }>;
  footerBackground?: string | ThemeSpecificColor;
  footerTextColor?: string | ThemeSpecificColor;
  footerHoverColor?: string | ThemeSpecificColor; // Link hover color
  footerBorderColor?: string | ThemeSpecificColor; // Border color
  footerShadow?: boolean; // Show shadow on footer
  footerPadding?: ResponsiveValue<SpacingConfig>; // Custom padding
  columnsPerRow?: ResponsiveValue<number>; // Number of columns in footer grid
  linkSections?: Array<{
    title: string;
    links: Array<{
      text: string;
      url: string;
      openInNewTab?: boolean;
    }>;
  }>;

  // Yield component (special - renders page content in layout)
  // Configuration for page content rendering
  showPageTitle?: boolean; // Whether to show the page title above content (default: false)

  // Container component - wraps content with padding and background (horizontal row layout)
  containerPadding?: ResponsiveValue<SpacingConfig>;
  containerMargin?: ResponsiveValue<SpacingConfig>;
  containerBackground?: string | ThemeSpecificColor;
  containerBorderRadius?: number;
  containerBorderColor?: string | ThemeSpecificColor;
  containerBorderWidth?: number;
  containerBorderStyle?: string;
  containerBorder?: BorderConfig;
  containerMaxWidth?: string; // e.g., '1200px', '100%'
  containerMinHeight?: ResponsiveValue<string>; // Min height
  containerMaxHeight?: ResponsiveValue<string>; // Max height
  containerWidth?: ResponsiveValue<string>; // Width
  containerGap?: ResponsiveValue<number>; // Gap between children
  containerGapX?: ResponsiveValue<number>; // Horizontal gap
  containerGapY?: ResponsiveValue<number>; // Vertical gap
  containerJustifyContent?:
    | 'flex-start'
    | 'center'
    | 'flex-end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  containerAlignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  containerAlignContent?:
    | 'flex-start'
    | 'center'
    | 'flex-end'
    | 'stretch'
    | 'space-between'
    | 'space-around';
  containerWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  containerFlexDirection?: ResponsiveValue<'row' | 'column' | 'row-reverse' | 'column-reverse'>;

  // Container display mode
  containerDisplay?: ResponsiveValue<'flex' | 'grid' | 'block'>;

  // Container grid properties (when containerDisplay === 'grid')
  containerGridCols?: ResponsiveValue<number | string>; // e.g., 3 or '1fr 2fr 1fr'
  containerGridRows?: ResponsiveValue<number | string>;
  containerGridAutoFlow?: ResponsiveValue<
    'row' | 'column' | 'dense' | 'row dense' | 'column dense'
  >;
  containerGridAutoColumns?: ResponsiveValue<string>;
  containerGridAutoRows?: ResponsiveValue<string>;
  containerPlaceItems?: ResponsiveValue<string>; // Shorthand for align-items + justify-items
  containerPlaceContent?: ResponsiveValue<string>; // Shorthand for align-content + justify-content

  // Container advanced styling
  containerBoxShadow?: ResponsiveValue<ShadowConfig | ShadowConfig[]>;
  containerTransform?: ResponsiveValue<TransformConfig>;
  containerTransition?: TransitionConfig | TransitionConfig[];
  containerOpacity?: ResponsiveValue<number>;
  containerOverflow?: ResponsiveValue<OverflowConfig>;
  containerPosition?: ResponsiveValue<PositionConfig>;
  containerZIndex?: ResponsiveValue<number>;

  // Container background advanced
  containerBackgroundImage?: string;
  containerBackgroundSize?: ResponsiveValue<'cover' | 'contain' | 'auto' | string>;
  containerBackgroundPosition?: ResponsiveValue<string>; // e.g., 'center', 'top left'
  containerBackgroundRepeat?: ResponsiveValue<'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y'>;
  containerBackgroundAttachment?: ResponsiveValue<'scroll' | 'fixed' | 'local'>;

  // Container filters
  containerFilter?: ResponsiveValue<FilterConfig>;
  containerBackdropFilter?: ResponsiveValue<FilterConfig>;

  // Container blend modes
  containerMixBlendMode?: ResponsiveValue<string>;
  containerBackgroundBlendMode?: ResponsiveValue<string>;

  // Container cursor and interactions
  containerCursor?: ResponsiveValue<string>;
  containerPointerEvents?: ResponsiveValue<'auto' | 'none'>;

  // Container mobile collapse - hides children behind hamburger icon on mobile
  containerMobileCollapse?: boolean; // Enable mobile collapse behavior
  containerMobileCollapseLabel?: string; // Label text shown next to hamburger icon (default: 'Menu')
  containerMobileCollapseIconColor?: string; // Color of the hamburger/close icon
  containerMobileCollapseBackground?: string; // Background color of the toggle bar

  // Row component - horizontal flexbox layout
  rowGap?: ResponsiveValue<number>;
  rowJustifyContent?:
    | 'flex-start'
    | 'center'
    | 'flex-end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  rowAlignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  rowFlexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  rowPadding?: ResponsiveValue<SpacingConfig>;
  rowBackground?: string | ThemeSpecificColor;

  // Flex component - flexible container (grid or flex)
  // Core flex properties
  flexDirection?: ResponsiveValue<'row' | 'column' | 'row-reverse' | 'column-reverse'>;
  flexWrap?: ResponsiveValue<'nowrap' | 'wrap' | 'wrap-reverse'>;
  flexJustifyContent?: ResponsiveValue<
    'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'
  >;
  flexAlignItems?: ResponsiveValue<'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'>;
  flexAlignContent?: ResponsiveValue<
    'flex-start' | 'center' | 'flex-end' | 'stretch' | 'space-between' | 'space-around'
  >;
  flexGap?: ResponsiveValue<number>;
  flexGapX?: ResponsiveValue<number>; // Horizontal gap
  flexGapY?: ResponsiveValue<number>; // Vertical gap
  flexPadding?: ResponsiveValue<SpacingConfig>;
  flexMargin?: ResponsiveValue<SpacingConfig>;
  flexBackground?: string | ThemeSpecificColor;
  flexBorderRadius?: number;
  flexBorderColor?: string | ThemeSpecificColor;
  flexBorderWidth?: number;
  flexBorderStyle?: string;
  flexBorder?: BorderConfig;
  flexWidth?: ResponsiveValue<string>; // Width: 'full', 'auto', '1/2', '1/3', etc.
  flexHeight?: ResponsiveValue<string>; // Height: 'auto', 'full', 'screen', etc.
  flexMinHeight?: ResponsiveValue<string>;
  flexMaxWidth?: ResponsiveValue<string>;

  // Individual child flex properties (applied to direct children)
  childFlexGrow?: ResponsiveValue<number>; // Default flex-grow for children
  childFlexShrink?: ResponsiveValue<number>; // Default flex-shrink for children
  childFlexBasis?: ResponsiveValue<string>; // Default flex-basis for children
  childAlignSelf?: ResponsiveValue<'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch'>;

  // Grid-specific properties for flex widget
  useGrid?: boolean; // If true, use CSS Grid instead of flexbox
  gridColumns?: ResponsiveValue<number | string>; // e.g., 3 or '1fr 2fr 1fr'
  gridRows?: ResponsiveValue<number | string>;
  gridAutoFlow?: ResponsiveValue<'row' | 'column' | 'dense' | 'row dense' | 'column dense'>;
  gridAutoColumns?: ResponsiveValue<string>; // e.g., 'auto', 'min-content', '1fr'
  gridAutoRows?: ResponsiveValue<string>;
  gridColumnGap?: ResponsiveValue<number>;
  gridRowGap?: ResponsiveValue<number>;
  gridPlaceItems?: ResponsiveValue<string>; // Shorthand for align-items + justify-items
  gridPlaceContent?: ResponsiveValue<string>; // Shorthand for align-content + justify-content
  gridJustifyItems?: ResponsiveValue<'start' | 'center' | 'end' | 'stretch'>;
  gridAlignItems?: ResponsiveValue<'start' | 'center' | 'end' | 'stretch'>;
  gridJustifyContent?: ResponsiveValue<
    'start' | 'center' | 'end' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'
  >;
  gridAlignContent?: ResponsiveValue<
    'start' | 'center' | 'end' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly'
  >;

  // Individual child layout properties (applied to this component when inside a container)
  // These control how this specific child behaves within its parent's layout

  // Flexbox child properties
  layoutFlexGrow?: ResponsiveValue<number>; // How much this child should grow (0 = don't grow)
  layoutFlexShrink?: ResponsiveValue<number>; // How much this child should shrink (1 = can shrink)
  layoutFlexBasis?: ResponsiveValue<string>; // Initial size before grow/shrink ('auto', '200px', '50%')
  layoutAlignSelf?: ResponsiveValue<
    'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'
  >; // Override parent's align-items for this child

  // Grid child properties
  layoutGridColumn?: ResponsiveValue<string>; // Grid column placement ('span 2', '1 / 3', 'auto')
  layoutGridRow?: ResponsiveValue<string>; // Grid row placement ('span 2', '1 / 3', 'auto')
  layoutGridColumnStart?: ResponsiveValue<number | string>;
  layoutGridColumnEnd?: ResponsiveValue<number | string>;
  layoutGridRowStart?: ResponsiveValue<number | string>;
  layoutGridRowEnd?: ResponsiveValue<number | string>;
  layoutPlaceSelf?: ResponsiveValue<string>; // Shorthand for align-self + justify-self
  layoutJustifySelf?: ResponsiveValue<'start' | 'center' | 'end' | 'stretch'>;

  // Common layout properties (work in both flex and grid)
  layoutOrder?: ResponsiveValue<number>; // Visual order (-1, 0, 1, 2, etc.)
  layoutMinWidth?: ResponsiveValue<string>; // Minimum width constraint
  layoutMaxWidth?: ResponsiveValue<string>; // Maximum width constraint
  layoutMinHeight?: ResponsiveValue<string>; // Minimum height constraint
  layoutMaxHeight?: ResponsiveValue<string>; // Maximum height constraint
  layoutWidth?: ResponsiveValue<string>; // Explicit width ('100%', '200px', 'auto')
  layoutHeight?: ResponsiveValue<string>; // Explicit height
}

/**
 * @deprecated Use ComponentConfig instead
 */
export type WidgetConfig = ComponentConfig;

export interface PageWithComponents extends Page {
  components: PageComponent[];
}

/**
 * @deprecated Use PageWithComponents instead
 */
export type PageWithWidgets = PageWithComponents & {
  widgets: PageComponent[];
};

// Form data for creating/updating pages
export interface PageFormData {
  title: string;
  slug: string;
  status: PageStatus;
  content?: string;
}

// Form data for creating/updating components
export interface ComponentFormData {
  type: ComponentType;
  config: ComponentConfig;
  position: number;
}

/**
 * @deprecated Use ComponentFormData instead
 */
export type WidgetFormData = ComponentFormData;

// Page properties for page-level styling (background, borders, positioning, etc.)
export interface PageProperties {
  // Page title display - overrides layout yield setting if set
  showPageTitle?: boolean; // true = show, false = hide, undefined = use layout yield setting (default: false)
  backgroundColor?: string;
  backgroundImage?: string;
  minHeight?: string;
  padding?: string;
  // Granular padding (takes precedence over padding if set)
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  // Size properties
  width?: string;
  maxWidth?: string;
  // Border properties
  borderColor?: string;
  borderWidth?: string;
  borderStyle?: string;
  borderRadius?: string;
  // Effects
  boxShadow?: string;
  opacity?: number;
  // Overflow
  overflow?: 'visible' | 'hidden' | 'scroll' | 'auto';
  // Positioning properties
  positionType?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  positionTop?: string;
  positionRight?: string;
  positionBottom?: string;
  positionLeft?: string;
  zIndex?: number;
}

// Page revision for history tracking (Git-like system)
export interface PageRevision {
  id: string;
  page_id: string;
  revision_hash: string; // Short hash like Git (8 characters)
  parent_revision_id?: string; // ID of parent revision (for branching)
  title: string;
  slug: string;
  status: PageStatus;
  color_theme?: string;
  widgets_snapshot: string; // JSON string of PageComponent[] - DB column name preserved
  page_properties?: string; // JSON string of PageProperties - page-level styling
  created_by?: string;
  created_at: number;
  is_published: boolean;
  notes?: string;
}

// Revision node for building history tree
export interface RevisionNode extends ParsedPageRevision {
  children: RevisionNode[]; // Child revisions that branch from this one
  depth: number; // Depth in the tree for visualization
  branch: number; // Branch number for graph layout
}

// Parsed revision with components as objects (widgets_snapshot parsed to components)
export interface ParsedPageRevision
  extends Omit<PageRevision, 'widgets_snapshot' | 'page_properties'> {
  components: PageComponent[];
  pageProperties?: PageProperties;
}

// Form data for creating revisions
export interface CreateRevisionData {
  title: string;
  slug: string;
  status: PageStatus;
  colorTheme?: string;
  components: PageComponent[];
  pageProperties?: PageProperties;
  notes?: string;
  parent_revision_id?: string | null;
}
