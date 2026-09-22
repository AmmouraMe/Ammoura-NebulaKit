/**
 * Built-in page defaults - Source of truth for built-in page configurations
 *
 * This module defines the default content for built-in pages.
 * When updating default configurations, increment CURRENT_BUILTIN_VERSION
 * in builtin-seeding.ts and the seeding system will propagate changes.
 */

import type { ComponentType } from '$lib/types/pages';

/**
 * Widget definition for page defaults (simplified from PageComponent)
 * Does not include database fields like page_id, created_at, updated_at
 */
export interface WidgetDefinition {
  id: string;
  type: ComponentType;
  position: number;
  config: Record<string, unknown>;
}

/**
 * Built-in page definition
 */
export interface BuiltinPageDefinition {
  id: string; // Stable ID like 'builtin-home-page'
  title: string;
  slug: string;
  description?: string;
  /**
   * A built-in layout slug this page must use instead of the site's default.
   *
   * Only set it where the default layout would be WRONG, not merely different —
   * the holding page is the case it exists for, because the navbar and footer it
   * would otherwise inherit are full of links that answer 503 while the gate is
   * up. Everything else follows the site's default so a tenant's own layout
   * edits reach it.
   */
  layoutSlug?: string;
  getWidgets: () => WidgetDefinition[];
}

/**
 * Get the default Home page widgets configuration
 * This is the source of truth for the built-in Home page
 */
export function getHomePageWidgets(): WidgetDefinition[] {
  return [
    {
      id: 'home-hero',
      type: 'hero',
      position: 0,
      config: {
        backgroundColor: 'transparent',
        containerPadding: {
          desktop: { top: 0, right: 0, bottom: 0, left: 0 },
          tablet: { top: 0, right: 0, bottom: 0, left: 0 },
          mobile: { top: 0, right: 0, bottom: 0, left: 0 }
        },
        containerMargin: {
          desktop: { top: 0, right: 0, bottom: 0, left: 0 },
          tablet: { top: 0, right: 0, bottom: 0, left: 0 },
          mobile: { top: 0, right: 0, bottom: 0, left: 0 }
        },
        containerBackground: 'transparent',
        containerBorderRadius: 0,
        containerMaxWidth: '100%',
        containerMinHeight: { desktop: '600px', tablet: '500px', mobile: '450px' },
        containerDisplay: { desktop: 'block', tablet: 'block', mobile: 'block' },
        containerWidth: { desktop: '100%', tablet: '100%', mobile: '100%' },
        visibilityRule: 'always',
        children: [
          {
            id: 'hero-main-container',
            type: 'container',
            position: 0,
            config: {
              containerPadding: {
                desktop: { top: 80, right: 24, bottom: 80, left: 24 },
                tablet: { top: 60, right: 20, bottom: 60, left: 20 },
                mobile: { top: 48, right: 16, bottom: 48, left: 16 }
              },
              containerMargin: {
                desktop: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
                tablet: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
                mobile: { top: 0, right: 0, bottom: 0, left: 0 }
              },
              containerBackground: 'transparent',
              containerBorderRadius: 0,
              containerMaxWidth: '1200px',
              containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
              containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
              containerAlignItems: 'center',
              containerJustifyContent: 'center',
              containerWrap: 'nowrap',
              containerGap: { desktop: 24, tablet: 20, mobile: 16 },
              children: [
                {
                  id: 'hero-badge',
                  type: 'button',
                  position: 0,
                  config: {
                    label: '✨ Start Selling Online Today',
                    url: '#',
                    variant: 'outline',
                    size: 'small',
                    fullWidth: { desktop: false, tablet: false, mobile: false },
                    buttonAlign: 'center',
                    borderRadius: 999,
                    backgroundColor: 'transparent',
                    textColor: 'theme:text',
                    borderColor: 'theme:border',
                    padding: { desktop: { top: 8, right: 20, bottom: 8, left: 20 } },
                    fontSize: { desktop: 14, tablet: 13, mobile: 12 }
                  }
                },
                {
                  id: 'hero-title-container',
                  type: 'container',
                  position: 1,
                  config: {
                    containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                    containerFlexDirection: { desktop: 'row', tablet: 'row', mobile: 'column' },
                    containerAlignItems: 'center',
                    containerJustifyContent: 'center',
                    containerGap: { desktop: 12, tablet: 10, mobile: 4 },
                    containerWrap: 'wrap',
                    children: [
                      {
                        id: 'hero-title-part1',
                        type: 'text',
                        position: 0,
                        config: {
                          text: 'Create Your Own',
                          alignment: 'center',
                          fontSize: { desktop: 56, tablet: 42, mobile: 32 },
                          textColor: 'theme:text',
                          typography: { fontWeight: 'bold', lineHeight: 1.1 }
                        }
                      },
                      {
                        id: 'hero-title-part2',
                        type: 'text',
                        position: 1,
                        config: {
                          text: 'Online Store',
                          alignment: 'center',
                          fontSize: { desktop: 56, tablet: 42, mobile: 32 },
                          textColor: 'theme:accent',
                          typography: { fontWeight: 'bold', lineHeight: 1.1 }
                        }
                      }
                    ]
                  }
                },
                {
                  id: 'hero-subtitle-container',
                  type: 'container',
                  position: 2,
                  config: {
                    containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                    containerFlexDirection: {
                      desktop: 'column',
                      tablet: 'column',
                      mobile: 'column'
                    },
                    containerAlignItems: 'center',
                    containerGap: { desktop: 8, tablet: 6, mobile: 4 },
                    children: [
                      {
                        id: 'hero-subtitle-1',
                        type: 'text',
                        position: 0,
                        config: {
                          text: 'Everything you need to start selling products online.',
                          alignment: 'center',
                          fontSize: { desktop: 20, tablet: 18, mobile: 16 },
                          textColor: 'theme:textSecondary',
                          typography: { lineHeight: 1.6 }
                        }
                      },
                      {
                        id: 'hero-subtitle-2',
                        type: 'text',
                        position: 1,
                        config: {
                          text: 'Simple, beautiful, and ready for your business.',
                          alignment: 'center',
                          fontSize: { desktop: 20, tablet: 18, mobile: 16 },
                          textColor: 'theme:accent',
                          typography: { fontWeight: '600', lineHeight: 1.6 }
                        }
                      }
                    ]
                  }
                },
                {
                  id: 'hero-actions',
                  type: 'container',
                  position: 3,
                  config: {
                    containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                    containerFlexDirection: { desktop: 'row', tablet: 'row', mobile: 'column' },
                    containerAlignItems: 'center',
                    containerJustifyContent: 'center',
                    containerGap: { desktop: 16, tablet: 12, mobile: 12 },
                    containerMargin: { desktop: { top: 16, right: 0, bottom: 0, left: 0 } },
                    children: [
                      {
                        id: 'hero-btn-primary',
                        type: 'button',
                        position: 0,
                        config: {
                          label: 'See Example Store',
                          url: '#products',
                          variant: 'primary',
                          size: 'large',
                          fullWidth: { desktop: false, tablet: false, mobile: true },
                          backgroundColor: 'theme:accent',
                          textColor: 'theme:text'
                        }
                      },
                      {
                        id: 'hero-btn-secondary',
                        type: 'button',
                        position: 1,
                        config: {
                          label: 'Start Your Store',
                          url: '/auth/login',
                          variant: 'outline',
                          size: 'large',
                          fullWidth: { desktop: false, tablet: false, mobile: true },
                          textColor: 'theme:text',
                          borderColor: 'theme:border'
                        }
                      }
                    ]
                  }
                },
                {
                  id: 'hero-stats',
                  type: 'container',
                  position: 4,
                  config: {
                    containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                    containerFlexDirection: { desktop: 'row', tablet: 'row', mobile: 'row' },
                    containerAlignItems: 'center',
                    containerJustifyContent: 'center',
                    containerGap: { desktop: 32, tablet: 24, mobile: 16 },
                    containerMargin: { desktop: { top: 32, right: 0, bottom: 0, left: 0 } },
                    children: [
                      {
                        id: 'stat-1',
                        type: 'container',
                        position: 0,
                        config: {
                          containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
                          containerAlignItems: 'center',
                          children: [
                            {
                              id: 'stat-1-value',
                              type: 'text',
                              position: 0,
                              config: {
                                text: 'Simple',
                                alignment: 'center',
                                fontSize: { desktop: 24, tablet: 20, mobile: 18 },
                                textColor: 'theme:accent',
                                typography: { fontWeight: 'bold' }
                              }
                            },
                            {
                              id: 'stat-1-label',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'SETUP',
                                alignment: 'center',
                                fontSize: { desktop: 12, tablet: 11, mobile: 10 },
                                textColor: 'theme:textSecondary',
                                typography: { letterSpacing: '0.1em' }
                              }
                            }
                          ]
                        }
                      },
                      {
                        id: 'stat-divider-1',
                        type: 'divider',
                        position: 1,
                        config: {
                          thickness: 1,
                          dividerColor: 'theme:border',
                          dividerStyle: 'solid',
                          orientation: 'vertical',
                          spacing: { desktop: 0, tablet: 0, mobile: 0 }
                        }
                      },
                      {
                        id: 'stat-2',
                        type: 'container',
                        position: 2,
                        config: {
                          containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
                          containerAlignItems: 'center',
                          children: [
                            {
                              id: 'stat-2-value',
                              type: 'text',
                              position: 0,
                              config: {
                                text: 'Beautiful',
                                alignment: 'center',
                                fontSize: { desktop: 24, tablet: 20, mobile: 18 },
                                textColor: 'theme:accent',
                                typography: { fontWeight: 'bold' }
                              }
                            },
                            {
                              id: 'stat-2-label',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'DESIGN',
                                alignment: 'center',
                                fontSize: { desktop: 12, tablet: 11, mobile: 10 },
                                textColor: 'theme:textSecondary',
                                typography: { letterSpacing: '0.1em' }
                              }
                            }
                          ]
                        }
                      },
                      {
                        id: 'stat-divider-2',
                        type: 'divider',
                        position: 3,
                        config: {
                          thickness: 1,
                          dividerColor: 'theme:border',
                          dividerStyle: 'solid',
                          orientation: 'vertical',
                          spacing: { desktop: 0, tablet: 0, mobile: 0 }
                        }
                      },
                      {
                        id: 'stat-3',
                        type: 'container',
                        position: 4,
                        config: {
                          containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
                          containerAlignItems: 'center',
                          children: [
                            {
                              id: 'stat-3-value',
                              type: 'text',
                              position: 0,
                              config: {
                                text: 'Your',
                                alignment: 'center',
                                fontSize: { desktop: 24, tablet: 20, mobile: 18 },
                                textColor: 'theme:accent',
                                typography: { fontWeight: 'bold' }
                              }
                            },
                            {
                              id: 'stat-3-label',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'BRAND',
                                alignment: 'center',
                                fontSize: { desktop: 12, tablet: 11, mobile: 10 },
                                textColor: 'theme:textSecondary',
                                typography: { letterSpacing: '0.1em' }
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    },
    // Features section
    getFeaturesSectionWidget(),
    // Pricing section
    getPricingSectionWidget(),
    // Products section
    getProductsSectionWidget(),
    // CTA section
    getCtaSectionWidget()
  ];
}

/**
 * Get the Features section widget
 */
function getFeaturesSectionWidget(): WidgetDefinition {
  return {
    id: 'home-features',
    type: 'features',
    position: 1,
    config: {
      backgroundColor: 'transparent',
      containerPadding: {
        desktop: { top: 0, right: 0, bottom: 0, left: 0 },
        tablet: { top: 0, right: 0, bottom: 0, left: 0 },
        mobile: { top: 0, right: 0, bottom: 0, left: 0 }
      },
      containerMargin: {
        desktop: { top: 0, right: 0, bottom: 0, left: 0 },
        tablet: { top: 0, right: 0, bottom: 0, left: 0 },
        mobile: { top: 0, right: 0, bottom: 0, left: 0 }
      },
      containerBackground: 'transparent',
      containerBorderRadius: 0,
      containerMaxWidth: '100%',
      containerDisplay: { desktop: 'block', tablet: 'block', mobile: 'block' },
      containerWidth: { desktop: '100%', tablet: '100%', mobile: '100%' },
      visibilityRule: 'always',
      children: [
        {
          id: 'features-main-container',
          type: 'container',
          position: 0,
          config: {
            containerPadding: {
              desktop: { top: 80, right: 24, bottom: 80, left: 24 },
              tablet: { top: 60, right: 20, bottom: 60, left: 20 },
              mobile: { top: 48, right: 16, bottom: 48, left: 16 }
            },
            containerMargin: {
              desktop: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
              tablet: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
              mobile: { top: 0, right: 0, bottom: 0, left: 0 }
            },
            containerBackground: 'transparent',
            containerBorderRadius: 0,
            containerMaxWidth: '1200px',
            containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
            containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
            containerAlignItems: 'center',
            containerJustifyContent: 'center',
            containerWrap: 'nowrap',
            containerGap: { desktop: 48, tablet: 40, mobile: 32 },
            children: [
              {
                id: 'features-header',
                type: 'container',
                position: 0,
                config: {
                  containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                  containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
                  containerAlignItems: 'center',
                  containerGap: { desktop: 16, tablet: 12, mobile: 10 },
                  children: [
                    {
                      id: 'features-title',
                      type: 'text',
                      position: 0,
                      config: {
                        text: 'Everything You Need to Succeed',
                        alignment: 'center',
                        fontSize: { desktop: 48, tablet: 36, mobile: 28 },
                        textColor: 'theme:text',
                        typography: { fontWeight: 'bold', lineHeight: 1.2 }
                      }
                    },
                    {
                      id: 'features-subtitle',
                      type: 'text',
                      position: 1,
                      config: {
                        text: 'All the tools to run your online business, right out of the box',
                        alignment: 'center',
                        fontSize: { desktop: 18, tablet: 16, mobile: 14 },
                        textColor: 'theme:textSecondary',
                        typography: { lineHeight: 1.6 }
                      }
                    }
                  ]
                }
              },
              {
                id: 'features-grid',
                type: 'container',
                position: 1,
                config: {
                  containerDisplay: { desktop: 'grid', tablet: 'grid', mobile: 'flex' },
                  containerFlexDirection: { desktop: 'row', tablet: 'row', mobile: 'column' },
                  containerGridCols: { desktop: 3, tablet: 2, mobile: 1 },
                  containerGap: { desktop: 24, tablet: 20, mobile: 16 },
                  containerAlignItems: 'stretch',
                  containerWidth: { desktop: '100%', tablet: '100%', mobile: '100%' },
                  children: getFeatureCards()
                }
              }
            ]
          }
        }
      ]
    }
  };
}

/**
 * Get the feature cards for the Features section
 */
function getFeatureCards(): WidgetDefinition['config']['children'] {
  const features = [
    {
      icon: '🎯',
      title: 'Easy Setup',
      desc: 'Get your online store up and running in minutes, no technical skills needed'
    },
    {
      icon: '✨',
      title: 'Beautiful Design',
      desc: 'Gorgeous, modern storefront that looks professional on any device'
    },
    {
      icon: '📦',
      title: 'Manage Products',
      desc: 'Simple dashboard to add, edit, and organize your products effortlessly'
    },
    {
      icon: '💳',
      title: 'Accept Payments',
      desc: 'Secure checkout ready to connect with your preferred payment processor'
    },
    {
      icon: '🎨',
      title: 'Customize Everything',
      desc: 'Make your store uniquely yours with flexible customization options'
    },
    {
      icon: '📱',
      title: 'Mobile Ready',
      desc: 'Your customers can shop from anywhere, on any device'
    }
  ];

  return features.map((f, i) => ({
    id: `feature-card-${i + 1}`,
    type: 'container' as const,
    position: i,
    config: {
      containerPadding: { desktop: { top: 32, right: 24, bottom: 32, left: 24 } },
      containerBackground: 'theme:surface',
      containerBorderRadius: 12,
      containerBorderWidth: 1,
      containerBorderColor: 'theme:border',
      containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
      containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
      containerAlignItems: 'flex-start',
      containerGap: { desktop: 16, tablet: 12, mobile: 12 },
      children: [
        {
          id: `f${i + 1}-icon`,
          type: 'text' as const,
          position: 0,
          config: { text: f.icon, fontSize: { desktop: 48 } }
        },
        {
          id: `f${i + 1}-title`,
          type: 'text' as const,
          position: 1,
          config: {
            text: f.title,
            fontSize: { desktop: 20 },
            textColor: 'theme:text',
            typography: { fontWeight: '600' }
          }
        },
        {
          id: `f${i + 1}-desc`,
          type: 'text' as const,
          position: 2,
          config: {
            text: f.desc,
            fontSize: { desktop: 15 },
            textColor: 'theme:textSecondary',
            typography: { lineHeight: 1.6 }
          }
        }
      ]
    }
  }));
}

/**
 * Get the Pricing section widget
 */
function getPricingSectionWidget(): WidgetDefinition {
  return {
    id: 'home-pricing',
    type: 'pricing',
    position: 2,
    config: {
      anchorName: 'pricing',
      backgroundColor: 'transparent',
      containerPadding: {
        desktop: { top: 80, right: 24, bottom: 80, left: 24 },
        tablet: { top: 60, right: 20, bottom: 60, left: 20 },
        mobile: { top: 48, right: 16, bottom: 48, left: 16 }
      },
      containerMargin: {
        desktop: { top: 0, right: 0, bottom: 0, left: 0 },
        tablet: { top: 0, right: 0, bottom: 0, left: 0 },
        mobile: { top: 0, right: 0, bottom: 0, left: 0 }
      },
      containerBackground: 'transparent',
      containerBorderRadius: 0,
      containerMaxWidth: '100%',
      containerMinHeight: { desktop: 'auto', tablet: 'auto', mobile: 'auto' },
      containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
      containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
      containerAlignItems: 'center',
      containerJustifyContent: 'center',
      containerGap: { desktop: 48, tablet: 40, mobile: 32 },
      visibilityRule: 'always',
      children: [getPricingHeader(), getPricingCards(), getPricingCta()]
    }
  };
}

/**
 * Get the pricing header
 */
function getPricingHeader(): unknown {
  return {
    id: 'pricing-header',
    type: 'container',
    position: 0,
    config: {
      containerPadding: { desktop: { top: 0, right: 0, bottom: 0, left: 0 } },
      containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
      containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
      containerAlignItems: 'center',
      containerJustifyContent: 'center',
      containerGap: { desktop: 16, tablet: 12, mobile: 8 },
      containerMaxWidth: '800px',
      children: [
        {
          id: 'pricing-icon',
          type: 'text',
          position: 0,
          config: {
            text: '🚀',
            alignment: 'center',
            fontSize: { desktop: 48, tablet: 40, mobile: 36 }
          }
        },
        {
          id: 'pricing-title',
          type: 'heading',
          position: 1,
          config: {
            heading: 'Ammoura Pricing',
            level: 2,
            textColor: 'theme:text',
            alignment: 'center',
            fontSize: { desktop: 48, tablet: 40, mobile: 32 },
            fontWeight: 800
          }
        },
        {
          id: 'pricing-tagline',
          type: 'text',
          position: 2,
          config: {
            text: 'Zero monthly fees. We win when you win.',
            alignment: 'center',
            textColor: 'theme:textSecondary',
            fontSize: { desktop: 20, tablet: 18, mobile: 16 },
            fontWeight: 500
          }
        },
        {
          id: 'pricing-subtitle',
          type: 'text',
          position: 3,
          config: {
            text: 'Every store gets full access — we only earn a small % per sale.',
            alignment: 'center',
            textColor: 'theme:textSecondary',
            fontSize: { desktop: 16, tablet: 15, mobile: 14 }
          }
        }
      ]
    }
  };
}

/**
 * Get the pricing cards grid
 */
function getPricingCards(): unknown {
  return {
    id: 'pricing-cards',
    type: 'container',
    position: 1,
    config: {
      containerPadding: { desktop: { top: 0, right: 0, bottom: 0, left: 0 } },
      containerDisplay: { desktop: 'grid', tablet: 'grid', mobile: 'flex' },
      containerGridCols: { desktop: 2, tablet: 2, mobile: 1 },
      containerFlexDirection: { desktop: 'row', tablet: 'row', mobile: 'column' },
      containerGap: { desktop: 32, tablet: 24, mobile: 24 },
      containerMaxWidth: '1200px',
      containerWidth: { desktop: '100%', tablet: '100%', mobile: '100%' },
      children: [getFeaturesCard(), getTiersCard()]
    }
  };
}

/**
 * Get the features card for pricing
 */
function getFeaturesCard(): unknown {
  return {
    id: 'features-card',
    type: 'container',
    position: 0,
    config: {
      containerPadding: {
        desktop: { top: 32, right: 32, bottom: 32, left: 32 },
        tablet: { top: 24, right: 24, bottom: 24, left: 24 },
        mobile: { top: 24, right: 20, bottom: 24, left: 20 }
      },
      containerBackground: 'theme:surface',
      containerBorderRadius: 16,
      containerBorderWidth: 1,
      containerBorderColor: 'theme:border',
      containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
      containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
      containerGap: { desktop: 24, tablet: 20, mobile: 16 },
      children: [
        {
          id: 'features-header',
          type: 'container',
          position: 0,
          config: {
            containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
            containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
            containerAlignItems: 'center',
            containerGap: { desktop: 8, tablet: 8, mobile: 6 },
            children: [
              {
                id: 'features-icon',
                type: 'text',
                position: 0,
                config: {
                  text: '💰',
                  alignment: 'center',
                  fontSize: { desktop: 40, tablet: 36, mobile: 32 }
                }
              },
              {
                id: 'features-title',
                type: 'heading',
                position: 1,
                config: {
                  heading: 'Pay-as-You-Grow',
                  level: 3,
                  textColor: 'theme:text',
                  alignment: 'center',
                  fontSize: { desktop: 24, tablet: 22, mobile: 20 },
                  fontWeight: 700
                }
              },
              {
                id: 'features-subtitle',
                type: 'text',
                position: 2,
                config: {
                  text: 'All features included, always.',
                  alignment: 'center',
                  textColor: 'theme:textSecondary',
                  fontSize: { desktop: 15, tablet: 14, mobile: 14 }
                }
              }
            ]
          }
        },
        {
          id: 'features-list',
          type: 'container',
          position: 1,
          config: {
            containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
            containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
            containerGap: { desktop: 0, tablet: 0, mobile: 0 },
            children: [
              {
                id: 'feature-1',
                type: 'text',
                position: 0,
                config: {
                  text: '✓ Unlimited products',
                  textColor: 'theme:text',
                  fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                  padding: { desktop: { top: 16, right: 0, bottom: 16, left: 0 } },
                  borderBottom: '1px solid theme:border'
                }
              },
              {
                id: 'feature-2',
                type: 'text',
                position: 1,
                config: {
                  text: '✓ Free custom domain (optional)',
                  textColor: 'theme:text',
                  fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                  padding: { desktop: { top: 16, right: 0, bottom: 16, left: 0 } },
                  borderBottom: '1px solid theme:border'
                }
              },
              {
                id: 'feature-3',
                type: 'text',
                position: 2,
                config: {
                  text: '✓ AI-powered builder (voice + text)',
                  textColor: 'theme:text',
                  fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                  padding: { desktop: { top: 16, right: 0, bottom: 16, left: 0 } },
                  borderBottom: '1px solid theme:border'
                }
              },
              {
                id: 'feature-4',
                type: 'text',
                position: 3,
                config: {
                  text: '✓ Real-time analytics',
                  textColor: 'theme:text',
                  fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                  padding: { desktop: { top: 16, right: 0, bottom: 16, left: 0 } },
                  borderBottom: '1px solid theme:border'
                }
              },
              {
                id: 'feature-5',
                type: 'text',
                position: 4,
                config: {
                  text: '✓ Secure checkout (credit card/crypto)',
                  textColor: 'theme:text',
                  fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                  padding: { desktop: { top: 16, right: 0, bottom: 16, left: 0 } },
                  borderBottom: '1px solid theme:border'
                }
              },
              {
                id: 'feature-6',
                type: 'text',
                position: 5,
                config: {
                  text: '✓ AI product video generator',
                  textColor: 'theme:text',
                  fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                  padding: { desktop: { top: 16, right: 0, bottom: 16, left: 0 } }
                }
              }
            ]
          }
        }
      ]
    }
  };
}

/**
 * Get the pricing tiers card
 */
function getTiersCard(): unknown {
  const tiers = [
    { range: '$0 – $1,000', desc: 'Perfect for getting started', fee: '8%', highlight: false },
    { range: '$1,001 – $5,000', desc: 'Growing your business', fee: '6%', highlight: false },
    { range: '$5,001 – $20,000', desc: 'Established sales', fee: '4%', highlight: false },
    { range: '$20,001+', desc: 'High volume discounts', fee: '3%', highlight: true }
  ];

  return {
    id: 'tiers-card',
    type: 'container',
    position: 1,
    config: {
      containerPadding: {
        desktop: { top: 32, right: 32, bottom: 32, left: 32 },
        tablet: { top: 24, right: 24, bottom: 24, left: 24 },
        mobile: { top: 24, right: 20, bottom: 24, left: 20 }
      },
      containerBackground: 'theme:surface',
      containerBorderRadius: 16,
      containerBorderWidth: 1,
      containerBorderColor: 'theme:border',
      containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
      containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
      containerGap: { desktop: 24, tablet: 20, mobile: 16 },
      children: [
        {
          id: 'tiers-header',
          type: 'container',
          position: 0,
          config: {
            containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
            containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
            containerAlignItems: 'center',
            containerGap: { desktop: 8, tablet: 8, mobile: 6 },
            children: [
              {
                id: 'tiers-icon',
                type: 'text',
                position: 0,
                config: {
                  text: '💎',
                  alignment: 'center',
                  fontSize: { desktop: 40, tablet: 36, mobile: 32 }
                }
              },
              {
                id: 'tiers-title',
                type: 'heading',
                position: 1,
                config: {
                  heading: 'Revenue Share',
                  level: 3,
                  textColor: 'theme:text',
                  alignment: 'center',
                  fontSize: { desktop: 24, tablet: 22, mobile: 20 },
                  fontWeight: 700
                }
              },
              {
                id: 'tiers-subtitle',
                type: 'text',
                position: 2,
                config: {
                  text: 'Includes payment processor fees',
                  alignment: 'center',
                  textColor: 'theme:textSecondary',
                  fontSize: { desktop: 15, tablet: 14, mobile: 14 }
                }
              }
            ]
          }
        },
        {
          id: 'tiers-table',
          type: 'container',
          position: 1,
          config: {
            containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
            containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
            containerGap: { desktop: 8, tablet: 6, mobile: 6 },
            children: [
              {
                id: 'table-header',
                type: 'container',
                position: 0,
                config: {
                  containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                  containerFlexDirection: { desktop: 'row', tablet: 'row', mobile: 'row' },
                  containerJustifyContent: 'space-between',
                  containerPadding: { desktop: { top: 8, right: 16, bottom: 8, left: 16 } },
                  children: [
                    {
                      id: 'header-sales',
                      type: 'text',
                      position: 0,
                      config: {
                        text: 'MONTHLY SALES',
                        textColor: 'theme:textSecondary',
                        fontSize: { desktop: 11, tablet: 10, mobile: 10 },
                        fontWeight: 600,
                        letterSpacing: '0.05em'
                      }
                    },
                    {
                      id: 'header-fee',
                      type: 'text',
                      position: 1,
                      config: {
                        text: 'FEE',
                        textColor: 'theme:textSecondary',
                        fontSize: { desktop: 11, tablet: 10, mobile: 10 },
                        fontWeight: 600,
                        letterSpacing: '0.05em'
                      }
                    }
                  ]
                }
              },
              ...tiers.map((t, i) => ({
                id: `tier-${i + 1}`,
                type: 'container' as const,
                position: i + 1,
                config: {
                  containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                  containerFlexDirection: { desktop: 'row', tablet: 'row', mobile: 'row' },
                  containerJustifyContent: 'space-between',
                  containerAlignItems: 'center',
                  containerPadding: { desktop: { top: 16, right: 20, bottom: 16, left: 20 } },
                  containerBackground: 'theme:surface',
                  containerBorderRadius: 12,
                  containerBorderWidth: t.highlight ? 2 : 1,
                  containerBorderColor: t.highlight ? 'theme:accent' : 'theme:border',
                  children: [
                    {
                      id: `tier-${i + 1}-info`,
                      type: 'container' as const,
                      position: 0,
                      config: {
                        containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                        containerFlexDirection: {
                          desktop: 'column',
                          tablet: 'column',
                          mobile: 'column'
                        },
                        containerGap: { desktop: 4, tablet: 4, mobile: 2 },
                        children: [
                          {
                            id: `tier-${i + 1}-range`,
                            type: 'text' as const,
                            position: 0,
                            config: {
                              text: t.range,
                              textColor: 'theme:text',
                              fontSize: { desktop: 16, tablet: 15, mobile: 14 },
                              fontWeight: 600
                            }
                          },
                          {
                            id: `tier-${i + 1}-desc`,
                            type: 'text' as const,
                            position: 1,
                            config: {
                              text: t.desc,
                              textColor: 'theme:textSecondary',
                              fontSize: { desktop: 14, tablet: 13, mobile: 12 }
                            }
                          }
                        ]
                      }
                    },
                    {
                      id: `tier-${i + 1}-fee`,
                      type: 'text' as const,
                      position: 1,
                      config: {
                        text: t.fee,
                        textColor: 'theme:accent',
                        fontSize: { desktop: 28, tablet: 24, mobile: 22 },
                        fontWeight: 700
                      }
                    }
                  ]
                }
              }))
            ]
          }
        }
      ]
    }
  };
}

/**
 * Get the pricing CTA button
 */
function getPricingCta(): unknown {
  return {
    id: 'pricing-cta',
    type: 'container',
    position: 2,
    config: {
      containerPadding: { desktop: { top: 0, right: 0, bottom: 0, left: 0 } },
      containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
      containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
      containerAlignItems: 'center',
      containerGap: { desktop: 16, tablet: 12, mobile: 8 },
      children: [
        {
          id: 'cta-button',
          type: 'button',
          position: 0,
          config: {
            label: 'Get Started Free →',
            url: '/auth/login',
            variant: 'filled',
            size: 'large',
            fullWidth: { desktop: false, tablet: false, mobile: true },
            borderRadius: 12,
            backgroundColor: 'theme:accent',
            textColor: 'theme:text',
            padding: { desktop: { top: 16, right: 40, bottom: 16, left: 40 } },
            fontSize: { desktop: 18, tablet: 16, mobile: 16 },
            fontWeight: 600
          }
        }
      ]
    }
  };
}

/**
 * Get the Products section widget
 */
function getProductsSectionWidget(): WidgetDefinition {
  return {
    id: 'home-products',
    type: 'container',
    position: 3,
    config: {
      anchorName: 'products',
      containerPadding: {
        desktop: { top: 80, right: 24, bottom: 80, left: 24 },
        tablet: { top: 60, right: 20, bottom: 60, left: 20 },
        mobile: { top: 48, right: 16, bottom: 48, left: 16 }
      },
      containerMargin: {
        desktop: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
        tablet: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
        mobile: { top: 0, right: 0, bottom: 0, left: 0 }
      },
      containerBackground: 'transparent',
      containerMaxWidth: '1200px',
      containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
      containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
      containerAlignItems: 'center',
      containerGap: { desktop: 48, tablet: 40, mobile: 32 },
      children: [
        {
          id: 'products-header',
          type: 'container',
          position: 0,
          config: {
            containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
            containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
            containerAlignItems: 'center',
            containerGap: { desktop: 16, tablet: 12, mobile: 10 },
            children: [
              {
                id: 'products-title',
                type: 'text',
                position: 0,
                config: {
                  text: 'Example Store',
                  alignment: 'center',
                  fontSize: { desktop: 48, tablet: 36, mobile: 28 },
                  textColor: 'theme:text',
                  typography: { fontWeight: 'bold', lineHeight: 1.2 }
                }
              },
              {
                id: 'products-subtitle',
                type: 'text',
                position: 1,
                config: {
                  text: 'Here is what your store could look like - this is a real, working example',
                  alignment: 'center',
                  fontSize: { desktop: 18, tablet: 16, mobile: 14 },
                  textColor: 'theme:textSecondary',
                  typography: { lineHeight: 1.6 }
                }
              }
            ]
          }
        },
        {
          id: 'products-list',
          type: 'product_list',
          position: 1,
          config: {
            category: '',
            limit: 6,
            sortBy: 'created_at',
            sortOrder: 'desc',
            columns: { desktop: 3, tablet: 2, mobile: 1 },
            backgroundColor: 'transparent'
          }
        }
      ]
    }
  };
}

/**
 * Get the CTA section widget
 */
function getCtaSectionWidget(): WidgetDefinition {
  return {
    id: 'home-cta',
    type: 'container',
    position: 4,
    config: {
      containerPadding: {
        desktop: { top: 80, right: 24, bottom: 80, left: 24 },
        tablet: { top: 60, right: 20, bottom: 60, left: 20 },
        mobile: { top: 48, right: 16, bottom: 48, left: 16 }
      },
      containerMargin: {
        desktop: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
        tablet: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
        mobile: { top: 0, right: 0, bottom: 0, left: 0 }
      },
      containerBackground: 'theme:surface',
      containerBorderRadius: 16,
      containerMaxWidth: '800px',
      containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
      containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
      containerAlignItems: 'center',
      containerGap: { desktop: 24, tablet: 20, mobile: 16 },
      children: [
        {
          id: 'cta-title',
          type: 'text',
          position: 0,
          config: {
            text: 'Ready to Start Your Business?',
            alignment: 'center',
            fontSize: { desktop: 36, tablet: 28, mobile: 24 },
            textColor: 'theme:text',
            typography: { fontWeight: 'bold', lineHeight: 1.2 }
          }
        },
        {
          id: 'cta-subtitle',
          type: 'text',
          position: 1,
          config: {
            text: 'Join entrepreneurs around the world who are building their dreams with their own online stores.',
            alignment: 'center',
            fontSize: { desktop: 18, tablet: 16, mobile: 14 },
            textColor: 'theme:textSecondary',
            typography: { lineHeight: 1.6 }
          }
        },
        {
          id: 'cta-button',
          type: 'button',
          position: 2,
          config: {
            label: 'Create Your Store',
            url: '/auth/login',
            variant: 'primary',
            size: 'large',
            fullWidth: { desktop: false, tablet: false, mobile: true },
            backgroundColor: 'theme:accent',
            textColor: 'theme:text'
          }
        }
      ]
    }
  };
}

/**
 * A titled block of legal copy. Kept as data rather than one HTML blob so the
 * sections stay readable here and translate field-by-field in the overlay.
 */
interface LegalSection {
  heading: string;
  paragraphs: string[];
}

/**
 * Render legal sections to the HTML the text widget accepts.
 *
 * Content strings are single-quoted on purpose: they carry literal
 * `${site.name}` placeholders that templateSubstitution resolves at render
 * time, and a backtick template would interpolate them here instead.
 */
function legalSectionsToHtml(sections: LegalSection[]): string {
  return sections
    .map(
      (section) =>
        `<h2>${section.heading}</h2>\n` + section.paragraphs.map((p) => `<p>${p}</p>`).join('\n')
    )
    .join('\n');
}

/**
 * Shared page shell for the built-in legal pages.
 *
 * Widget ids are stable and prefixed per page so `content_translations`
 * (keyed `widgetId:configPath`) can overlay each field per locale.
 */
function legalPageWidgets(
  prefix: string,
  title: string,
  intro: string,
  sections: LegalSection[]
): WidgetDefinition[] {
  return [
    {
      id: `${prefix}-page-container`,
      type: 'container',
      position: 0,
      config: {
        containerPadding: {
          desktop: { top: 64, right: 24, bottom: 80, left: 24 },
          tablet: { top: 48, right: 20, bottom: 64, left: 20 },
          mobile: { top: 32, right: 16, bottom: 48, left: 16 }
        },
        containerMargin: {
          desktop: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
          tablet: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
          mobile: { top: 0, right: 0, bottom: 0, left: 0 }
        },
        containerBackground: 'transparent',
        containerMaxWidth: '760px',
        containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
        containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
        containerAlignItems: 'stretch',
        containerGap: { desktop: 20, tablet: 16, mobile: 14 },
        children: [
          {
            id: `${prefix}-title`,
            type: 'heading',
            position: 0,
            config: {
              heading: title,
              level: 1,
              alignment: 'left',
              textColor: 'theme:text',
              fontSize: { desktop: 40, tablet: 34, mobile: 28 },
              typography: { fontWeight: 'bold', lineHeight: 1.2 }
            }
          },
          {
            id: `${prefix}-intro`,
            type: 'text',
            position: 1,
            config: {
              text: intro,
              alignment: 'left',
              textColor: 'theme:textSecondary',
              fontSize: { desktop: 17, tablet: 16, mobile: 15 },
              typography: { lineHeight: 1.7 }
            }
          },
          {
            id: `${prefix}-body`,
            type: 'text',
            position: 2,
            config: {
              html: legalSectionsToHtml(sections),
              alignment: 'left',
              textColor: 'theme:text',
              fontSize: { desktop: 16, tablet: 16, mobile: 15 },
              typography: { lineHeight: 1.7 }
            }
          }
        ]
      }
    }
  ];
}

/**
 * Default Privacy Policy copy.
 *
 * Deliberately generic starting text. It names the store through
 * `${site.name}` so no tenant ships a document carrying another tenant's name,
 * and it says in the first line that the store — not the platform — owns and
 * is responsible for the policy.
 */
export function getPrivacyPolicyPageWidgets(): WidgetDefinition[] {
  return legalPageWidgets(
    'privacy',
    'Privacy Policy',
    'This policy explains what personal information ${site.name} collects, why it is collected, and what you can do about it. ${site.name} operates this store and is responsible for the information described here.',
    [
      {
        heading: 'Information we collect',
        paragraphs: [
          'When you place an order we collect the details needed to fulfil it: your name, your email address, your delivery address, and the contents of your order.',
          'If you contact ${site.name} for support, we keep the message and our reply so we can follow up.',
          'Our servers record ordinary technical information such as your IP address, browser type, and the pages you visit. This is used to keep the store working and secure.'
        ]
      },
      {
        heading: 'Payment information',
        paragraphs: [
          'Card payments are handled by our payment processor. Your full card number is entered on the processor’s systems and is never stored by ${site.name}.',
          'We receive only what we need to recognise the payment: the result, the amount, and a reference such as the last four digits of the card.'
        ]
      },
      {
        heading: 'How we use your information',
        paragraphs: [
          'We use your information to take payment, fulfil and deliver your order, answer your questions, prevent fraud and abuse, and meet our legal and tax obligations.',
          'We do not sell your personal information.'
        ]
      },
      {
        heading: 'Who we share it with',
        paragraphs: [
          'We share your details with the suppliers who make delivery possible — our payment processor, our print and fulfilment partners, and our delivery carriers — and only the parts of it they need.',
          'We also share information where the law requires it.'
        ]
      },
      {
        heading: 'Cookies',
        paragraphs: [
          'This store uses cookies to keep you signed in and to remember the contents of your cart. Blocking them will stop those features from working.'
        ]
      },
      {
        heading: 'How long we keep it',
        paragraphs: [
          'Order records are kept for as long as our tax and accounting obligations require. Account information is kept while your account is open.'
        ]
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'You can ask for a copy of the personal information ${site.name} holds about you, ask for it to be corrected, or ask for it to be deleted. Deletion requests cannot remove records we are legally required to keep.',
          'To make any of these requests, contact ${site.name} using the contact details published on this site.'
        ]
      },
      {
        heading: 'Changes to this policy',
        paragraphs: ['If this policy changes, the updated version will be published on this page.']
      }
    ]
  );
}

/**
 * Default Terms of Service copy.
 *
 * As with the privacy policy, this is a starting point that names the store
 * through `${site.name}` and places responsibility for the terms on the store.
 */
export function getTermsOfServicePageWidgets(): WidgetDefinition[] {
  return legalPageWidgets(
    'terms',
    'Terms of Service',
    'These terms cover your use of this store, which is operated by ${site.name}. By browsing the store or placing an order you accept them. ${site.name} is responsible for these terms and for the orders placed here.',
    [
      {
        heading: 'Orders',
        paragraphs: [
          'Placing an order is an offer to buy. The order is accepted when ${site.name} confirms it, and a contract is formed at that point.',
          'An order may be declined — for example if an item is unavailable, if the price was listed incorrectly, or if payment cannot be taken. If an order is declined after payment, it is refunded in full.'
        ]
      },
      {
        heading: 'Prices and payment',
        paragraphs: [
          'Prices are shown in the store’s listed currency. Delivery charges and any taxes are shown before you confirm the order.',
          'Payment is taken at checkout through our payment processor.'
        ]
      },
      {
        heading: 'Delivery',
        paragraphs: [
          'Delivery times shown at checkout are estimates, not guarantees. Risk in the goods passes to you on delivery.'
        ]
      },
      {
        heading: 'Returns and refunds',
        paragraphs: [
          'Faulty or incorrect items are put right — replaced or refunded — once ${site.name} has been told about the problem.',
          'Nothing in these terms removes the statutory rights you have as a consumer where you live.'
        ]
      },
      {
        heading: 'Made-to-order and personalised items',
        paragraphs: [
          'Items printed or made to your own design or specification are produced for you alone and cannot be returned simply because you changed your mind. This does not apply where the item arrives faulty or is not what you ordered.',
          'You are responsible for any artwork or text you supply, and you confirm that you have the right to use it.'
        ]
      },
      {
        heading: 'Digital products',
        paragraphs: [
          'Digital items are licensed to you for your own use. You may not redistribute or resell them.',
          'Access to a digital item begins as soon as payment clears, which ends the right to cancel it.'
        ]
      },
      {
        heading: 'Acceptable use',
        paragraphs: [
          'Do not attempt to break into, overload, or interfere with this store, and do not use it for anything unlawful.',
          'Accounts used for fraud or abuse may be closed.'
        ]
      },
      {
        heading: 'Our content',
        paragraphs: [
          'The text, images, and designs on this store belong to ${site.name} or to its suppliers, and may not be copied for commercial use without permission.'
        ]
      },
      {
        heading: 'Liability',
        paragraphs: [
          'Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot lawfully be limited.',
          'Beyond that, the liability of ${site.name} for any order is limited to the amount paid for that order.'
        ]
      },
      {
        heading: 'Changes to these terms',
        paragraphs: [
          'These terms may be updated, and the current version is always the one published on this page. The terms that apply to your order are the ones in force when you placed it.'
        ]
      }
    ]
  );
}

/**
 * The coming-soon holding page.
 *
 * This is the one built-in page whose job is to exist BEFORE the site does, and
 * it is deliberately built out of ordinary builder components — a scene, a
 * container, a heading, text, a button — rather than being a hand-written HTML
 * document. Two reasons, and the second is the real one:
 *
 * 1. The owner can edit it. It is their holding page, on their domain, and the
 *    words on it are the first thing anyone learns about them. A placeholder
 *    they cannot change is a placeholder that says the wrong thing.
 * 2. It is the proof that the builder can do this at all. If the platform's own
 *    holding page had to be hand-coded, that would be the plainest possible
 *    statement that the builder is not finished — which is exactly the
 *    dogfooding rule in plans/frontend-overhaul.md §2.
 *
 * The starfield and the staggered entrance are the new `scene` and `motion`
 * features being used in anger rather than demonstrated in isolation. Both
 * disappear entirely for a visitor who has asked for reduced motion, and what is
 * left is still a complete page: a name, a sentence, and a way to get in touch.
 */
export function getComingSoonPageWidgets(): WidgetDefinition[] {
  return [
    {
      id: 'coming-soon-scene',
      type: 'scene',
      position: 0,
      config: {
        sceneVariant: 'stars',
        sceneDensity: 55,
        sceneSpeed: 40,
        scenePointerParallax: true,
        // Tall enough to be the page rather than a band across it. dvh, not vh,
        // so a phone browser's collapsing toolbar does not leave a gap.
        sceneHeight: '100dvh',
        backgroundColor: 'theme:background',
        containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
        children: [
          {
            id: 'coming-soon-content',
            type: 'container',
            position: 0,
            config: {
              containerPadding: {
                desktop: { top: 96, right: 24, bottom: 96, left: 24 },
                tablet: { top: 72, right: 20, bottom: 72, left: 20 },
                mobile: { top: 56, right: 16, bottom: 56, left: 16 }
              },
              containerMargin: {
                desktop: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
                tablet: { top: 0, right: 'auto', bottom: 0, left: 'auto' },
                mobile: { top: 0, right: 0, bottom: 0, left: 0 }
              },
              containerBackground: 'transparent',
              containerMaxWidth: '640px',
              containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
              containerFlexDirection: { desktop: 'column', tablet: 'column', mobile: 'column' },
              containerAlignItems: 'center',
              containerJustifyContent: 'center',
              // 100% of the scene, not 100dvh. Both asking for a viewport meant
              // the container was taller than the box it centred itself in, so
              // its content overflowed in BOTH directions and the heading was
              // clipped off the top, unreachable.
              containerMinHeight: { desktop: '100%', tablet: '100%', mobile: '100%' },
              containerGap: { desktop: 20, tablet: 18, mobile: 16 },
              // The container staggers its children rather than each child
              // carrying its own delay: one number here, and the name, the line
              // and the button arrive in the order they are read.
              motion: { preset: 'fade-up', duration: 700, stagger: 110 },
              children: [
                {
                  id: 'coming-soon-name',
                  type: 'heading',
                  position: 0,
                  config: {
                    heading: '${site.name}',
                    level: 1,
                    alignment: 'center',
                    textColor: 'theme:text',
                    fontSize: { desktop: 52, tablet: 42, mobile: 34 },
                    typography: { fontWeight: 'bold', lineHeight: 1.15 },
                    motion: { preset: 'fade-up', duration: 700 }
                  }
                },
                {
                  id: 'coming-soon-line',
                  type: 'text',
                  position: 1,
                  config: {
                    text: 'Something is being built here. Come back soon.',
                    alignment: 'center',
                    textColor: 'theme:textSecondary',
                    fontSize: { desktop: 19, tablet: 18, mobile: 16 },
                    typography: { lineHeight: 1.65 },
                    motion: { preset: 'fade-up', duration: 700 }
                  }
                },
                {
                  id: 'coming-soon-contact',
                  type: 'button',
                  position: 2,
                  config: {
                    label: 'Get in touch',
                    // mailto rather than a form: a holding page that collects
                    // addresses needs somewhere to put them, and at this stage
                    // there may be no store, no list and no privacy notice worth
                    // the name. An email works on day one.
                    url: 'mailto:${site.email}',
                    variant: 'outline',
                    size: 'medium',
                    buttonAlign: 'center',
                    motion: { preset: 'fade', duration: 700 }
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ];
}

/**
 * All built-in page definitions
 */
export const BUILTIN_PAGES: BuiltinPageDefinition[] = [
  {
    id: 'builtin-home-page',
    title: 'Home',
    slug: '/',
    description: 'Default home page with hero, features, pricing, and products sections',
    getWidgets: getHomePageWidgets
  },
  {
    id: 'builtin-coming-soon-page',
    title: 'Coming Soon',
    slug: '/coming-soon',
    layoutSlug: 'minimal',
    description:
      'The holding page served while the coming-soon gate is on. Built from ordinary builder components so the owner can rewrite it.',
    getWidgets: getComingSoonPageWidgets
  },
  {
    id: 'builtin-privacy-policy-page',
    title: 'Privacy Policy',
    slug: '/privacy-policy',
    description:
      'Starting privacy policy, linked from the default footer. The store owner is responsible for its content.',
    getWidgets: getPrivacyPolicyPageWidgets
  },
  {
    id: 'builtin-terms-of-service-page',
    title: 'Terms of Service',
    slug: '/terms-of-service',
    description:
      'Starting terms of service, linked from the default footer. The store owner is responsible for its content.',
    getWidgets: getTermsOfServicePageWidgets
  }
];

/**
 * Built-in pages whose default copy is boilerplate a tenant must review.
 * The admin pages list uses this to warn owners rather than letting the
 * placeholder text quietly stand in as their real policy.
 */
export const LEGAL_BUILTIN_PAGE_SLUGS = ['/privacy-policy', '/terms-of-service'];

/**
 * Built-in pages seeded the moment a site is created, rather than waiting for
 * an admin to run the builtin seeder.
 *
 * The legal pages are here because the default footer links to them, so without
 * them a brand-new store ships two dead links (issue #72). The holding page is
 * here for the same shape of reason: the coming-soon toggle has to be something
 * an owner can switch on, not something that first requires them to know a page
 * needs seeding.
 *
 * The home page is deliberately absent — createSiteForAccount seeds its own
 * starter home immediately above.
 */
export const CREATION_SEEDED_PAGE_SLUGS = [...LEGAL_BUILTIN_PAGE_SLUGS, '/coming-soon'];

/**
 * Get the default widgets for a built-in page by ID
 */
export function getBuiltinPageWidgets(pageId: string): WidgetDefinition[] | null {
  const definition = BUILTIN_PAGES.find((p) => p.id === pageId);
  return definition ? definition.getWidgets() : null;
}
