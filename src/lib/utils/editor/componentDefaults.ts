import type { ComponentType, ComponentConfig } from '$lib/types/pages';

export function getDefaultConfig(type: ComponentType): ComponentConfig {
  switch (type) {
    case 'text':
      return { text: 'Enter your text here', alignment: 'left', backgroundColor: 'transparent' };

    case 'heading':
      return {
        heading: 'Heading Text',
        level: 2,
        textColor: 'theme:text',
        backgroundColor: 'transparent'
      };

    case 'image':
      return {
        src: '',
        alt: '',
        imageWidth: '100%',
        imageHeight: 'auto',
        backgroundColor: 'transparent'
      };

    case 'hero':
      // Container-based architecture matching Navigation Bar and Footer patterns
      // Hero component is composed of primitives for maximum customization
      return {
        // Root component background
        backgroundColor: 'transparent',
        // Outer container styling
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
        // Children structure for Container-based composition
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
                          typography: {
                            fontWeight: 'bold',
                            lineHeight: 1.1
                          }
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
                          typography: {
                            fontWeight: 'bold',
                            lineHeight: 1.1
                          }
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
                    containerGap: { desktop: 4, tablet: 4, mobile: 4 },
                    children: [
                      {
                        id: 'hero-subtitle-line1',
                        type: 'text',
                        position: 0,
                        config: {
                          text: 'Everything you need to start selling products online.',
                          alignment: 'center',
                          fontSize: { desktop: 20, tablet: 18, mobile: 16 },
                          textColor: 'theme:textSecondary',
                          typography: {
                            lineHeight: 1.6
                          }
                        }
                      },
                      {
                        id: 'hero-subtitle-line2',
                        type: 'container',
                        position: 1,
                        config: {
                          containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                          containerFlexDirection: { desktop: 'row', tablet: 'row', mobile: 'row' },
                          containerAlignItems: 'center',
                          containerJustifyContent: 'center',
                          containerGap: { desktop: 6, tablet: 5, mobile: 4 },
                          containerWrap: 'wrap',
                          children: [
                            {
                              id: 'hero-subtitle-line2-styled',
                              type: 'text',
                              position: 0,
                              config: {
                                text: 'Simple, beautiful,',
                                alignment: 'center',
                                fontSize: { desktop: 20, tablet: 18, mobile: 16 },
                                textColor: 'theme:accent',
                                typography: {
                                  fontStyle: 'italic',
                                  lineHeight: 1.6
                                }
                              }
                            },
                            {
                              id: 'hero-subtitle-line2-plain',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'and ready for your business.',
                                alignment: 'center',
                                fontSize: { desktop: 20, tablet: 18, mobile: 16 },
                                textColor: 'theme:textSecondary',
                                typography: {
                                  lineHeight: 1.6
                                }
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                },
                {
                  id: 'hero-buttons-row',
                  type: 'container',
                  position: 3,
                  config: {
                    containerPadding: {
                      desktop: { top: 16, right: 0, bottom: 0, left: 0 }
                    },
                    containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                    containerFlexDirection: { desktop: 'row', tablet: 'row', mobile: 'column' },
                    containerGap: { desktop: 16, tablet: 12, mobile: 12 },
                    containerAlignItems: 'center',
                    containerJustifyContent: 'center',
                    children: [
                      {
                        id: 'hero-cta-primary',
                        type: 'button',
                        position: 0,
                        config: {
                          label: 'See Example Store',
                          url: '#products',
                          variant: 'outline',
                          size: 'large',
                          fullWidth: { desktop: false, tablet: false, mobile: true },
                          backgroundColor: 'transparent',
                          textColor: 'theme:text',
                          borderColor: 'theme:border',
                          iconAfter: '→',
                          borderRadius: 8,
                          padding: { desktop: { top: 14, right: 28, bottom: 14, left: 28 } },
                          fontSize: { desktop: 16, tablet: 15, mobile: 14 }
                        }
                      },
                      {
                        id: 'hero-cta-secondary',
                        type: 'button',
                        position: 1,
                        config: {
                          label: 'Start Your Store',
                          url: '/auth/login',
                          variant: 'secondary',
                          size: 'large',
                          fullWidth: { desktop: false, tablet: false, mobile: true },
                          backgroundColor: 'transparent',
                          textColor: 'theme:text',
                          borderColor: 'theme:border',
                          borderRadius: 8,
                          padding: { desktop: { top: 14, right: 28, bottom: 14, left: 28 } },
                          fontSize: { desktop: 16, tablet: 15, mobile: 14 }
                        }
                      }
                    ]
                  }
                },
                {
                  id: 'hero-stats-row',
                  type: 'container',
                  position: 4,
                  config: {
                    containerPadding: {
                      desktop: { top: 32, right: 64, bottom: 32, left: 64 },
                      tablet: { top: 24, right: 32, bottom: 24, left: 32 },
                      mobile: { top: 20, right: 16, bottom: 20, left: 16 }
                    },
                    containerMargin: {
                      desktop: { top: 32, right: 0, bottom: 0, left: 0 }
                    },
                    containerBackground: 'transparent',
                    containerBorderRadius: 0,
                    containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                    containerFlexDirection: { desktop: 'row', tablet: 'row', mobile: 'column' },
                    containerGap: { desktop: 48, tablet: 32, mobile: 24 },
                    containerAlignItems: 'center',
                    containerJustifyContent: 'center',
                    children: [
                      {
                        id: 'hero-stat-1',
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
                          containerGap: { desktop: 4, tablet: 4, mobile: 4 },
                          children: [
                            {
                              id: 'hero-stat-1-value',
                              type: 'text',
                              position: 0,
                              config: {
                                text: 'Simple',
                                alignment: 'center',
                                fontSize: { desktop: 20, tablet: 18, mobile: 18 },
                                textColor: 'theme:accent',
                                typography: {
                                  fontWeight: 'bold'
                                }
                              }
                            },
                            {
                              id: 'hero-stat-1-label',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'SETUP',
                                alignment: 'center',
                                fontSize: { desktop: 12, tablet: 11, mobile: 11 },
                                textColor: 'theme:textSecondary',
                                typography: {
                                  textTransform: 'uppercase',
                                  letterSpacing: 1.5
                                }
                              }
                            }
                          ]
                        }
                      },
                      {
                        id: 'hero-stat-divider-1',
                        type: 'divider',
                        position: 1,
                        config: {
                          thickness: 1,
                          dividerColor: 'theme:border',
                          dividerStyle: 'solid',
                          dividerWidth: '1px',
                          dividerHeight: '40px',
                          orientation: 'vertical'
                        }
                      },
                      {
                        id: 'hero-stat-2',
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
                          containerGap: { desktop: 4, tablet: 4, mobile: 4 },
                          children: [
                            {
                              id: 'hero-stat-2-value',
                              type: 'text',
                              position: 0,
                              config: {
                                text: 'Beautiful',
                                alignment: 'center',
                                fontSize: { desktop: 20, tablet: 18, mobile: 18 },
                                textColor: 'theme:accent',
                                typography: {
                                  fontWeight: 'bold'
                                }
                              }
                            },
                            {
                              id: 'hero-stat-2-label',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'DESIGN',
                                alignment: 'center',
                                fontSize: { desktop: 12, tablet: 11, mobile: 11 },
                                textColor: 'theme:textSecondary',
                                typography: {
                                  textTransform: 'uppercase',
                                  letterSpacing: 1.5
                                }
                              }
                            }
                          ]
                        }
                      },
                      {
                        id: 'hero-stat-divider-2',
                        type: 'divider',
                        position: 3,
                        config: {
                          thickness: 1,
                          dividerColor: 'theme:border',
                          dividerStyle: 'solid',
                          dividerWidth: '1px',
                          dividerHeight: '40px',
                          orientation: 'vertical'
                        }
                      },
                      {
                        id: 'hero-stat-3',
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
                          containerGap: { desktop: 4, tablet: 4, mobile: 4 },
                          children: [
                            {
                              id: 'hero-stat-3-value',
                              type: 'text',
                              position: 0,
                              config: {
                                text: 'Your',
                                alignment: 'center',
                                fontSize: { desktop: 20, tablet: 18, mobile: 18 },
                                textColor: 'theme:accent',
                                typography: {
                                  fontWeight: 'bold'
                                }
                              }
                            },
                            {
                              id: 'hero-stat-3-label',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'BRAND',
                                alignment: 'center',
                                fontSize: { desktop: 12, tablet: 11, mobile: 11 },
                                textColor: 'theme:textSecondary',
                                typography: {
                                  textTransform: 'uppercase',
                                  letterSpacing: 1.5
                                }
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
      };

    case 'button':
      return {
        label: 'Click Here',
        url: '#',
        variant: 'primary',
        size: 'medium',
        fullWidth: { desktop: false, tablet: false, mobile: true },
        backgroundColor: 'transparent'
      };

    case 'icon':
      return {
        iconName: 'Star',
        iconSize: 24,
        iconColor: 'theme:text',
        strokeWidth: 2,
        alignment: 'center',
        backgroundColor: 'transparent'
      };

    case 'spacer':
      return { space: { desktop: 40, tablet: 30, mobile: 20 }, backgroundColor: 'transparent' };

    case 'divider':
      return {
        thickness: 1,
        dividerColor: 'theme:border',
        dividerStyle: 'solid',
        spacing: { desktop: 20, tablet: 15, mobile: 10 },
        backgroundColor: 'transparent'
      };

    case 'scene':
      // Starfield by default: it is the variant that reads as intentional on any
      // palette, where aurora depends on the theme's colours being worth seeing
      // and grid announces a genre.
      return {
        sceneVariant: 'stars',
        sceneDensity: 50,
        sceneSpeed: 50,
        scenePointerParallax: true,
        sceneHeight: '420px',
        backgroundColor: 'theme:background'
      };

    case 'columns':
      return {
        columnCount: { desktop: 2, tablet: 2, mobile: 1 },
        gap: { desktop: 20 },
        verticalAlign: 'stretch',
        backgroundColor: 'transparent'
      };

    case 'single_product':
      return {
        productId: '',
        layout: 'card',
        showPrice: true,
        showDescription: true,
        backgroundColor: 'transparent'
      };

    case 'product_list':
      return {
        category: '',
        limit: 6,
        sortBy: 'created_at',
        sortOrder: 'desc',
        columns: { desktop: 3, tablet: 2, mobile: 1 },
        backgroundColor: 'transparent'
      };

    case 'features':
      // Container-based architecture matching Hero and Navigation Bar patterns
      // Features section is composed of primitives for maximum customization
      return {
        // Root component background
        backgroundColor: 'transparent',
        // Outer container styling
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
        // Children structure for Container-based composition
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
                    containerFlexDirection: {
                      desktop: 'column',
                      tablet: 'column',
                      mobile: 'column'
                    },
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
                          typography: {
                            fontWeight: 'bold',
                            lineHeight: 1.2
                          }
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
                          typography: {
                            lineHeight: 1.6
                          }
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
                    children: [
                      {
                        id: 'feature-card-1',
                        type: 'container',
                        position: 0,
                        config: {
                          containerPadding: {
                            desktop: { top: 32, right: 24, bottom: 32, left: 24 },
                            tablet: { top: 24, right: 20, bottom: 24, left: 20 },
                            mobile: { top: 24, right: 16, bottom: 24, left: 16 }
                          },
                          containerBackground: 'theme:surface',
                          containerBorderRadius: 12,
                          containerBorderWidth: 1,
                          containerBorderColor: 'theme:border',
                          containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
                          containerAlignItems: 'flex-start',
                          containerGap: { desktop: 16, tablet: 12, mobile: 12 },
                          children: [
                            {
                              id: 'feature-1-icon',
                              type: 'text',
                              position: 0,
                              config: {
                                text: '🎯',
                                fontSize: { desktop: 48, tablet: 40, mobile: 36 }
                              }
                            },
                            {
                              id: 'feature-1-title',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'Easy Setup',
                                fontSize: { desktop: 20, tablet: 18, mobile: 16 },
                                textColor: 'theme:text',
                                typography: { fontWeight: '600' }
                              }
                            },
                            {
                              id: 'feature-1-desc',
                              type: 'text',
                              position: 2,
                              config: {
                                text: 'Get your online store up and running in minutes, no technical skills needed',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                                textColor: 'theme:textSecondary',
                                typography: { lineHeight: 1.6 }
                              }
                            }
                          ]
                        }
                      },
                      {
                        id: 'feature-card-2',
                        type: 'container',
                        position: 1,
                        config: {
                          containerPadding: {
                            desktop: { top: 32, right: 24, bottom: 32, left: 24 },
                            tablet: { top: 24, right: 20, bottom: 24, left: 20 },
                            mobile: { top: 24, right: 16, bottom: 24, left: 16 }
                          },
                          containerBackground: 'theme:surface',
                          containerBorderRadius: 12,
                          containerBorderWidth: 1,
                          containerBorderColor: 'theme:border',
                          containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
                          containerAlignItems: 'flex-start',
                          containerGap: { desktop: 16, tablet: 12, mobile: 12 },
                          children: [
                            {
                              id: 'feature-2-icon',
                              type: 'text',
                              position: 0,
                              config: {
                                text: '✨',
                                fontSize: { desktop: 48, tablet: 40, mobile: 36 }
                              }
                            },
                            {
                              id: 'feature-2-title',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'Beautiful Design',
                                fontSize: { desktop: 20, tablet: 18, mobile: 16 },
                                textColor: 'theme:text',
                                typography: { fontWeight: '600' }
                              }
                            },
                            {
                              id: 'feature-2-desc',
                              type: 'text',
                              position: 2,
                              config: {
                                text: 'Gorgeous, modern storefront that looks professional on any device',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                                textColor: 'theme:textSecondary',
                                typography: { lineHeight: 1.6 }
                              }
                            }
                          ]
                        }
                      },
                      {
                        id: 'feature-card-3',
                        type: 'container',
                        position: 2,
                        config: {
                          containerPadding: {
                            desktop: { top: 32, right: 24, bottom: 32, left: 24 },
                            tablet: { top: 24, right: 20, bottom: 24, left: 20 },
                            mobile: { top: 24, right: 16, bottom: 24, left: 16 }
                          },
                          containerBackground: 'theme:surface',
                          containerBorderRadius: 12,
                          containerBorderWidth: 1,
                          containerBorderColor: 'theme:border',
                          containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
                          containerAlignItems: 'flex-start',
                          containerGap: { desktop: 16, tablet: 12, mobile: 12 },
                          children: [
                            {
                              id: 'feature-3-icon',
                              type: 'text',
                              position: 0,
                              config: {
                                text: '📦',
                                fontSize: { desktop: 48, tablet: 40, mobile: 36 }
                              }
                            },
                            {
                              id: 'feature-3-title',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'Manage Products',
                                fontSize: { desktop: 20, tablet: 18, mobile: 16 },
                                textColor: 'theme:text',
                                typography: { fontWeight: '600' }
                              }
                            },
                            {
                              id: 'feature-3-desc',
                              type: 'text',
                              position: 2,
                              config: {
                                text: 'Simple dashboard to add, edit, and organize your products effortlessly',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                                textColor: 'theme:textSecondary',
                                typography: { lineHeight: 1.6 }
                              }
                            }
                          ]
                        }
                      },
                      {
                        id: 'feature-card-4',
                        type: 'container',
                        position: 3,
                        config: {
                          containerPadding: {
                            desktop: { top: 32, right: 24, bottom: 32, left: 24 },
                            tablet: { top: 24, right: 20, bottom: 24, left: 20 },
                            mobile: { top: 24, right: 16, bottom: 24, left: 16 }
                          },
                          containerBackground: 'theme:surface',
                          containerBorderRadius: 12,
                          containerBorderWidth: 1,
                          containerBorderColor: 'theme:border',
                          containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
                          containerAlignItems: 'flex-start',
                          containerGap: { desktop: 16, tablet: 12, mobile: 12 },
                          children: [
                            {
                              id: 'feature-4-icon',
                              type: 'text',
                              position: 0,
                              config: {
                                text: '💳',
                                fontSize: { desktop: 48, tablet: 40, mobile: 36 }
                              }
                            },
                            {
                              id: 'feature-4-title',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'Accept Payments',
                                fontSize: { desktop: 20, tablet: 18, mobile: 16 },
                                textColor: 'theme:text',
                                typography: { fontWeight: '600' }
                              }
                            },
                            {
                              id: 'feature-4-desc',
                              type: 'text',
                              position: 2,
                              config: {
                                text: 'Secure checkout ready to connect with your preferred payment processor',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                                textColor: 'theme:textSecondary',
                                typography: { lineHeight: 1.6 }
                              }
                            }
                          ]
                        }
                      },
                      {
                        id: 'feature-card-5',
                        type: 'container',
                        position: 4,
                        config: {
                          containerPadding: {
                            desktop: { top: 32, right: 24, bottom: 32, left: 24 },
                            tablet: { top: 24, right: 20, bottom: 24, left: 20 },
                            mobile: { top: 24, right: 16, bottom: 24, left: 16 }
                          },
                          containerBackground: 'theme:surface',
                          containerBorderRadius: 12,
                          containerBorderWidth: 1,
                          containerBorderColor: 'theme:border',
                          containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
                          containerAlignItems: 'flex-start',
                          containerGap: { desktop: 16, tablet: 12, mobile: 12 },
                          children: [
                            {
                              id: 'feature-5-icon',
                              type: 'text',
                              position: 0,
                              config: {
                                text: '🎨',
                                fontSize: { desktop: 48, tablet: 40, mobile: 36 }
                              }
                            },
                            {
                              id: 'feature-5-title',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'Customize Everything',
                                fontSize: { desktop: 20, tablet: 18, mobile: 16 },
                                textColor: 'theme:text',
                                typography: { fontWeight: '600' }
                              }
                            },
                            {
                              id: 'feature-5-desc',
                              type: 'text',
                              position: 2,
                              config: {
                                text: 'Make your store uniquely yours with flexible customization options',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                                textColor: 'theme:textSecondary',
                                typography: { lineHeight: 1.6 }
                              }
                            }
                          ]
                        }
                      },
                      {
                        id: 'feature-card-6',
                        type: 'container',
                        position: 5,
                        config: {
                          containerPadding: {
                            desktop: { top: 32, right: 24, bottom: 32, left: 24 },
                            tablet: { top: 24, right: 20, bottom: 24, left: 20 },
                            mobile: { top: 24, right: 16, bottom: 24, left: 16 }
                          },
                          containerBackground: 'theme:surface',
                          containerBorderRadius: 12,
                          containerBorderWidth: 1,
                          containerBorderColor: 'theme:border',
                          containerDisplay: { desktop: 'flex', tablet: 'flex', mobile: 'flex' },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
                          containerAlignItems: 'flex-start',
                          containerGap: { desktop: 16, tablet: 12, mobile: 12 },
                          children: [
                            {
                              id: 'feature-6-icon',
                              type: 'text',
                              position: 0,
                              config: {
                                text: '📱',
                                fontSize: { desktop: 48, tablet: 40, mobile: 36 }
                              }
                            },
                            {
                              id: 'feature-6-title',
                              type: 'text',
                              position: 1,
                              config: {
                                text: 'Mobile Ready',
                                fontSize: { desktop: 20, tablet: 18, mobile: 16 },
                                textColor: 'theme:text',
                                typography: { fontWeight: '600' }
                              }
                            },
                            {
                              id: 'feature-6-desc',
                              type: 'text',
                              position: 2,
                              config: {
                                text: 'Your customers can shop from anywhere, on any device',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                                textColor: 'theme:textSecondary',
                                typography: { lineHeight: 1.6 }
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
      };

    case 'pricing':
      // Container-based architecture matching Hero, NavBar, and Footer patterns
      // Pricing component is composed of primitives for maximum customization
      return {
        // Root component background
        backgroundColor: 'transparent',
        // Container styling
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
        // Children structure for Container-based composition
        children: [
          // Header Section
          {
            id: 'pricing-header',
            type: 'container',
            position: 0,
            config: {
              containerPadding: {
                desktop: { top: 0, right: 0, bottom: 0, left: 0 }
              },
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
                    color: 'theme:textSecondary',
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
                    color: 'theme:textSecondary',
                    fontSize: { desktop: 16, tablet: 15, mobile: 14 }
                  }
                }
              ]
            }
          },
          // Two-Column Pricing Cards
          {
            id: 'pricing-cards',
            type: 'container',
            position: 1,
            config: {
              containerPadding: {
                desktop: { top: 0, right: 0, bottom: 0, left: 0 }
              },
              containerDisplay: { desktop: 'grid', tablet: 'grid', mobile: 'flex' },
              containerGridCols: { desktop: 2, tablet: 2, mobile: 1 },
              containerFlexDirection: { desktop: 'row', tablet: 'row', mobile: 'column' },
              containerGap: { desktop: 32, tablet: 24, mobile: 24 },
              containerMaxWidth: '1200px',
              containerWidth: { desktop: '100%', tablet: '100%', mobile: '100%' },
              children: [
                // Left Card: Features
                {
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
                    containerFlexDirection: {
                      desktop: 'column',
                      tablet: 'column',
                      mobile: 'column'
                    },
                    containerGap: { desktop: 24, tablet: 20, mobile: 16 },
                    children: [
                      // Card Header
                      {
                        id: 'features-header',
                        type: 'container',
                        position: 0,
                        config: {
                          containerDisplay: {
                            desktop: 'flex',
                            tablet: 'flex',
                            mobile: 'flex'
                          },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
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
                                color: 'theme:textSecondary',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 }
                              }
                            }
                          ]
                        }
                      },
                      // Features List
                      {
                        id: 'features-list',
                        type: 'container',
                        position: 1,
                        config: {
                          containerDisplay: {
                            desktop: 'flex',
                            tablet: 'flex',
                            mobile: 'flex'
                          },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
                          containerGap: { desktop: 0, tablet: 0, mobile: 0 },
                          children: [
                            {
                              id: 'feature-1',
                              type: 'text',
                              position: 0,
                              config: {
                                text: '✓ Unlimited products',
                                color: 'theme:text',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                                padding: {
                                  desktop: { top: 16, right: 0, bottom: 16, left: 0 }
                                },
                                borderBottom: '1px solid theme:border'
                              }
                            },
                            {
                              id: 'feature-2',
                              type: 'text',
                              position: 1,
                              config: {
                                text: '✓ Free custom domain (optional)',
                                color: 'theme:text',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                                padding: {
                                  desktop: { top: 16, right: 0, bottom: 16, left: 0 }
                                },
                                borderBottom: '1px solid theme:border'
                              }
                            },
                            {
                              id: 'feature-3',
                              type: 'text',
                              position: 2,
                              config: {
                                text: '✓ AI-powered builder (voice + text)',
                                color: 'theme:text',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                                padding: {
                                  desktop: { top: 16, right: 0, bottom: 16, left: 0 }
                                },
                                borderBottom: '1px solid theme:border'
                              }
                            },
                            {
                              id: 'feature-4',
                              type: 'text',
                              position: 3,
                              config: {
                                text: '✓ Real-time analytics',
                                color: 'theme:text',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                                padding: {
                                  desktop: { top: 16, right: 0, bottom: 16, left: 0 }
                                },
                                borderBottom: '1px solid theme:border'
                              }
                            },
                            {
                              id: 'feature-5',
                              type: 'text',
                              position: 4,
                              config: {
                                text: '✓ Secure checkout (credit card/crypto)',
                                color: 'theme:text',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                                padding: {
                                  desktop: { top: 16, right: 0, bottom: 16, left: 0 }
                                },
                                borderBottom: '1px solid theme:border'
                              }
                            },
                            {
                              id: 'feature-6',
                              type: 'text',
                              position: 5,
                              config: {
                                text: '✓ AI product video generator',
                                color: 'theme:text',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 },
                                padding: {
                                  desktop: { top: 16, right: 0, bottom: 16, left: 0 }
                                }
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                },
                // Right Card: Revenue Tiers
                {
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
                    containerFlexDirection: {
                      desktop: 'column',
                      tablet: 'column',
                      mobile: 'column'
                    },
                    containerGap: { desktop: 24, tablet: 20, mobile: 16 },
                    children: [
                      // Card Header
                      {
                        id: 'tiers-header',
                        type: 'container',
                        position: 0,
                        config: {
                          containerDisplay: {
                            desktop: 'flex',
                            tablet: 'flex',
                            mobile: 'flex'
                          },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
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
                                color: 'theme:textSecondary',
                                fontSize: { desktop: 15, tablet: 14, mobile: 14 }
                              }
                            }
                          ]
                        }
                      },
                      // Tiers Table
                      {
                        id: 'tiers-table',
                        type: 'container',
                        position: 1,
                        config: {
                          containerDisplay: {
                            desktop: 'flex',
                            tablet: 'flex',
                            mobile: 'flex'
                          },
                          containerFlexDirection: {
                            desktop: 'column',
                            tablet: 'column',
                            mobile: 'column'
                          },
                          containerGap: { desktop: 8, tablet: 6, mobile: 6 },
                          children: [
                            // Table Header
                            {
                              id: 'table-header',
                              type: 'container',
                              position: 0,
                              config: {
                                containerDisplay: {
                                  desktop: 'flex',
                                  tablet: 'flex',
                                  mobile: 'flex'
                                },
                                containerFlexDirection: {
                                  desktop: 'row',
                                  tablet: 'row',
                                  mobile: 'row'
                                },
                                containerJustifyContent: 'space-between',
                                containerPadding: {
                                  desktop: { top: 8, right: 16, bottom: 8, left: 16 }
                                },
                                children: [
                                  {
                                    id: 'header-sales',
                                    type: 'text',
                                    position: 0,
                                    config: {
                                      text: 'MONTHLY SALES',
                                      color: 'theme:textSecondary',
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
                                      color: 'theme:textSecondary',
                                      fontSize: { desktop: 11, tablet: 10, mobile: 10 },
                                      fontWeight: 600,
                                      letterSpacing: '0.05em'
                                    }
                                  }
                                ]
                              }
                            },
                            // Tier Rows
                            {
                              id: 'tier-1',
                              type: 'container',
                              position: 1,
                              config: {
                                containerDisplay: {
                                  desktop: 'flex',
                                  tablet: 'flex',
                                  mobile: 'flex'
                                },
                                containerFlexDirection: {
                                  desktop: 'row',
                                  tablet: 'row',
                                  mobile: 'row'
                                },
                                containerJustifyContent: 'space-between',
                                containerAlignItems: 'center',
                                containerPadding: {
                                  desktop: { top: 16, right: 20, bottom: 16, left: 20 }
                                },
                                containerBackground: 'theme:surface',
                                containerBorderRadius: 12,
                                containerBorderWidth: 1,
                                containerBorderColor: 'theme:border',
                                children: [
                                  {
                                    id: 'tier-1-info',
                                    type: 'container',
                                    position: 0,
                                    config: {
                                      containerDisplay: {
                                        desktop: 'flex',
                                        tablet: 'flex',
                                        mobile: 'flex'
                                      },
                                      containerFlexDirection: {
                                        desktop: 'column',
                                        tablet: 'column',
                                        mobile: 'column'
                                      },
                                      containerGap: { desktop: 4, tablet: 4, mobile: 2 },
                                      children: [
                                        {
                                          id: 'tier-1-range',
                                          type: 'text',
                                          position: 0,
                                          config: {
                                            text: '$0 – $1,000',
                                            color: 'theme:text',
                                            fontSize: { desktop: 16, tablet: 15, mobile: 14 },
                                            fontWeight: 600
                                          }
                                        },
                                        {
                                          id: 'tier-1-desc',
                                          type: 'text',
                                          position: 1,
                                          config: {
                                            text: 'Perfect for getting started',
                                            color: 'theme:textSecondary',
                                            fontSize: { desktop: 14, tablet: 13, mobile: 12 }
                                          }
                                        }
                                      ]
                                    }
                                  },
                                  {
                                    id: 'tier-1-fee',
                                    type: 'text',
                                    position: 1,
                                    config: {
                                      text: '8%',
                                      color: 'theme:accent',
                                      fontSize: { desktop: 28, tablet: 24, mobile: 22 },
                                      fontWeight: 700
                                    }
                                  }
                                ]
                              }
                            },
                            {
                              id: 'tier-2',
                              type: 'container',
                              position: 2,
                              config: {
                                containerDisplay: {
                                  desktop: 'flex',
                                  tablet: 'flex',
                                  mobile: 'flex'
                                },
                                containerFlexDirection: {
                                  desktop: 'row',
                                  tablet: 'row',
                                  mobile: 'row'
                                },
                                containerJustifyContent: 'space-between',
                                containerAlignItems: 'center',
                                containerPadding: {
                                  desktop: { top: 16, right: 20, bottom: 16, left: 20 }
                                },
                                containerBackground: 'theme:surface',
                                containerBorderRadius: 12,
                                containerBorderWidth: 1,
                                containerBorderColor: 'theme:border',
                                children: [
                                  {
                                    id: 'tier-2-info',
                                    type: 'container',
                                    position: 0,
                                    config: {
                                      containerDisplay: {
                                        desktop: 'flex',
                                        tablet: 'flex',
                                        mobile: 'flex'
                                      },
                                      containerFlexDirection: {
                                        desktop: 'column',
                                        tablet: 'column',
                                        mobile: 'column'
                                      },
                                      containerGap: { desktop: 4, tablet: 4, mobile: 2 },
                                      children: [
                                        {
                                          id: 'tier-2-range',
                                          type: 'text',
                                          position: 0,
                                          config: {
                                            text: '$1,001 – $5,000',
                                            color: 'theme:text',
                                            fontSize: { desktop: 16, tablet: 15, mobile: 14 },
                                            fontWeight: 600
                                          }
                                        },
                                        {
                                          id: 'tier-2-desc',
                                          type: 'text',
                                          position: 1,
                                          config: {
                                            text: 'Growing your business',
                                            color: 'theme:textSecondary',
                                            fontSize: { desktop: 14, tablet: 13, mobile: 12 }
                                          }
                                        }
                                      ]
                                    }
                                  },
                                  {
                                    id: 'tier-2-fee',
                                    type: 'text',
                                    position: 1,
                                    config: {
                                      text: '6%',
                                      color: 'theme:accent',
                                      fontSize: { desktop: 28, tablet: 24, mobile: 22 },
                                      fontWeight: 700
                                    }
                                  }
                                ]
                              }
                            },
                            {
                              id: 'tier-3',
                              type: 'container',
                              position: 3,
                              config: {
                                containerDisplay: {
                                  desktop: 'flex',
                                  tablet: 'flex',
                                  mobile: 'flex'
                                },
                                containerFlexDirection: {
                                  desktop: 'row',
                                  tablet: 'row',
                                  mobile: 'row'
                                },
                                containerJustifyContent: 'space-between',
                                containerAlignItems: 'center',
                                containerPadding: {
                                  desktop: { top: 16, right: 20, bottom: 16, left: 20 }
                                },
                                containerBackground: 'theme:surface',
                                containerBorderRadius: 12,
                                containerBorderWidth: 1,
                                containerBorderColor: 'theme:border',
                                children: [
                                  {
                                    id: 'tier-3-info',
                                    type: 'container',
                                    position: 0,
                                    config: {
                                      containerDisplay: {
                                        desktop: 'flex',
                                        tablet: 'flex',
                                        mobile: 'flex'
                                      },
                                      containerFlexDirection: {
                                        desktop: 'column',
                                        tablet: 'column',
                                        mobile: 'column'
                                      },
                                      containerGap: { desktop: 4, tablet: 4, mobile: 2 },
                                      children: [
                                        {
                                          id: 'tier-3-range',
                                          type: 'text',
                                          position: 0,
                                          config: {
                                            text: '$5,001 – $20,000',
                                            color: 'theme:text',
                                            fontSize: { desktop: 16, tablet: 15, mobile: 14 },
                                            fontWeight: 600
                                          }
                                        },
                                        {
                                          id: 'tier-3-desc',
                                          type: 'text',
                                          position: 1,
                                          config: {
                                            text: 'Established sales',
                                            color: 'theme:textSecondary',
                                            fontSize: { desktop: 14, tablet: 13, mobile: 12 }
                                          }
                                        }
                                      ]
                                    }
                                  },
                                  {
                                    id: 'tier-3-fee',
                                    type: 'text',
                                    position: 1,
                                    config: {
                                      text: '4%',
                                      color: 'theme:accent',
                                      fontSize: { desktop: 28, tablet: 24, mobile: 22 },
                                      fontWeight: 700
                                    }
                                  }
                                ]
                              }
                            },
                            // Highlighted Tier
                            {
                              id: 'tier-4',
                              type: 'container',
                              position: 4,
                              config: {
                                containerDisplay: {
                                  desktop: 'flex',
                                  tablet: 'flex',
                                  mobile: 'flex'
                                },
                                containerFlexDirection: {
                                  desktop: 'row',
                                  tablet: 'row',
                                  mobile: 'row'
                                },
                                containerJustifyContent: 'space-between',
                                containerAlignItems: 'center',
                                containerPadding: {
                                  desktop: { top: 16, right: 20, bottom: 16, left: 20 }
                                },
                                containerBackground: 'theme:surface',
                                containerBorderRadius: 12,
                                containerBorderWidth: 2,
                                containerBorderColor: 'theme:accent',
                                children: [
                                  {
                                    id: 'tier-4-info',
                                    type: 'container',
                                    position: 0,
                                    config: {
                                      containerDisplay: {
                                        desktop: 'flex',
                                        tablet: 'flex',
                                        mobile: 'flex'
                                      },
                                      containerFlexDirection: {
                                        desktop: 'column',
                                        tablet: 'column',
                                        mobile: 'column'
                                      },
                                      containerGap: { desktop: 4, tablet: 4, mobile: 2 },
                                      children: [
                                        {
                                          id: 'tier-4-range',
                                          type: 'text',
                                          position: 0,
                                          config: {
                                            text: '$20,001+',
                                            color: 'theme:text',
                                            fontSize: { desktop: 16, tablet: 15, mobile: 14 },
                                            fontWeight: 600
                                          }
                                        },
                                        {
                                          id: 'tier-4-desc',
                                          type: 'text',
                                          position: 1,
                                          config: {
                                            text: 'High volume discounts',
                                            color: 'theme:textSecondary',
                                            fontSize: { desktop: 14, tablet: 13, mobile: 12 }
                                          }
                                        }
                                      ]
                                    }
                                  },
                                  {
                                    id: 'tier-4-fee',
                                    type: 'text',
                                    position: 1,
                                    config: {
                                      text: '3%',
                                      color: 'theme:accent',
                                      fontSize: { desktop: 28, tablet: 24, mobile: 22 },
                                      fontWeight: 700
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
          // CTA Section
          {
            id: 'pricing-cta',
            type: 'container',
            position: 2,
            config: {
              containerPadding: {
                desktop: { top: 0, right: 0, bottom: 0, left: 0 }
              },
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
                    url: '#',
                    variant: 'filled',
                    size: 'large',
                    fullWidth: { desktop: false, tablet: false, mobile: true },
                    borderRadius: 12,
                    backgroundColor: 'theme:primary',
                    textColor: 'theme:background',
                    padding: {
                      desktop: { top: 16, right: 40, bottom: 16, left: 40 }
                    },
                    fontSize: { desktop: 18, tablet: 16, mobile: 16 },
                    fontWeight: 600
                  }
                }
              ]
            }
          }
        ]
      };

    case 'cta':
      return {
        title: 'Ready to Get Started?',
        subtitle: 'Join us today and start building',
        primaryCtaText: 'Get Started',
        primaryCtaLink: '#',
        secondaryCtaText: 'Learn More',
        secondaryCtaLink: '#',
        backgroundColor: 'transparent'
      };

    case 'container':
      return {
        backgroundColor: 'transparent',
        containerPadding: {
          desktop: { top: 40, right: 40, bottom: 40, left: 40 },
          tablet: { top: 30, right: 30, bottom: 30, left: 30 },
          mobile: { top: 20, right: 20, bottom: 20, left: 20 }
        },
        containerMargin: {
          desktop: { top: 0, right: 0, bottom: 0, left: 0 },
          tablet: { top: 0, right: 0, bottom: 0, left: 0 },
          mobile: { top: 0, right: 0, bottom: 0, left: 0 }
        },
        containerBackground: 'transparent',
        containerBorderRadius: 0,
        containerBorderWidth: 0,
        containerBorderColor: 'theme:border',
        containerBorderStyle: 'solid',
        containerMaxWidth: '1200px',
        containerGap: { desktop: 16, tablet: 12, mobile: 8 },
        containerJustifyContent: 'flex-start',
        containerAlignItems: 'center',
        containerWrap: 'wrap',
        children: []
      };

    case 'navbar':
      // Default v3: childless config so FrontendComponentRenderer renders the
      // NavBar builtin (a navbar with `children` falls into the generic
      // container path instead). NavBar owns the hamburger, mobile menu,
      // cart/auth/account, and theme toggle natively; colors are omitted so
      // its theme-variable fallbacks apply in both modes.
      // This is the SINGLE SOURCE OF TRUTH for navbar default configuration.
      // Both the database seed and resetBuiltInComponent use this exact structure.
      return {
        logo: { text: '${site.name}', url: '/', image: '', imageHeight: 40 },
        logoPosition: 'left',
        links: [
          { text: 'Products', url: '/#products' },
          { text: 'Pricing', url: '/#pricing' }
        ],
        linksPosition: 'center',
        actionsPosition: 'right',
        showSearch: false,
        showCart: true,
        showAuth: true,
        showAccountMenu: true,
        showThemeToggle: true,
        showLanguageSwitcher: false,
        sticky: false,
        visibilityRule: 'always'
      };

    case 'footer':
      // Default v3: childless config so FrontendComponentRenderer renders the
      // Footer builtin (already responsive: link columns collapse 4→2→1).
      // Colors are omitted so its theme-variable fallbacks apply in both modes.
      return {
        logo: { text: '${site.name}', url: '/', image: '', imageHeight: 32 },
        tagline: '${site.tagline}',
        copyright: '© ${site.year} ${site.name}. All rights reserved.',
        columnsPerRow: { desktop: 4, tablet: 2, mobile: 1 },
        linkSections: [
          {
            title: 'Shop',
            links: [
              { text: 'Products', url: '/#products' },
              { text: 'Pricing', url: '/#pricing' }
            ]
          },
          {
            title: 'Account',
            links: [
              { text: 'Login', url: '/auth/login' },
              { text: 'Cart', url: '/cart' }
            ]
          },
          {
            title: 'Legal',
            links: [
              { text: 'Privacy Policy', url: '/privacy-policy' },
              { text: 'Terms of Service', url: '/terms-of-service' }
            ]
          }
        ],
        socialLinks: [],
        footerLinks: [],
        footerShadow: false,
        visibilityRule: 'always'
      };

    case 'composite':
      return {
        backgroundColor: 'transparent',
        children: []
      };

    case 'dropdown':
      return {
        backgroundColor: 'transparent',
        triggerLabel: 'Menu',
        triggerIcon: '',
        triggerVariant: 'text',
        showChevron: true,
        menuWidth: '200px',
        menuAlign: 'left',
        menuBackground: 'var(--color-bg-primary)',
        menuBorderRadius: 8,
        menuShadow: true,
        menuPadding: { top: 8, right: 8, bottom: 8, left: 8 },
        children: []
      };

    case 'theme_toggle':
      return {
        backgroundColor: 'transparent',
        size: 'medium',
        toggleVariant: 'icon',
        alignment: 'left'
      };

    case 'yield':
      return { backgroundColor: 'transparent' };

    default:
      return {};
  }
}

export function getComponentLabel(type: ComponentType): string {
  const labels: Record<ComponentType, string> = {
    text: 'Text Content',
    heading: 'Heading',
    image: 'Image',
    icon: 'Icon',
    hero: 'Hero',
    button: 'Button',
    dropdown: 'Dropdown',
    spacer: 'Spacer',
    divider: 'Divider',
    scene: 'Scene',
    columns: 'Columns',
    single_product: 'Single Product',
    product_list: 'Product List',
    features: 'Features Section',
    pricing: 'Pricing Section',
    cta: 'Call to Action',
    navbar: 'Navigation Bar',
    footer: 'Footer',
    theme_toggle: 'Theme Toggle',
    yield: 'Page Content (Yield)',
    container: 'Container',
    composite: 'Composite',
    component_ref: 'Component Reference'
  };
  return labels[type] || type;
}

// Deprecated: Use getComponentLabel instead
export const getWidgetLabel = getComponentLabel;

/**
 * Extract a content preview from a component's config for display purposes.
 * Returns a short string that helps identify the component's content.
 * @param component - The component to extract content from
 * @returns A short content preview or empty string if none available
 */
export function getComponentContentPreview(component: {
  type: ComponentType;
  config?: ComponentConfig;
}): string {
  const config = component.config as Record<string, unknown> | undefined;
  if (!config) return '';

  // Helper to strip HTML tags and get plain text
  const stripHtml = (html: string): string => {
    return html.replace(/<[^>]*>/g, '').trim();
  };

  // Helper to truncate text
  const truncate = (text: string, maxLength: number = 30): string => {
    const clean = text.trim();
    if (clean.length <= maxLength) return clean;
    return clean.substring(0, maxLength).trim() + '…';
  };

  switch (component.type) {
    case 'text':
      // Text components have html or content
      if (typeof config.html === 'string') {
        const text = stripHtml(config.html);
        if (text) return truncate(text);
      }
      if (typeof config.content === 'string') {
        const text = stripHtml(config.content);
        if (text) return truncate(text);
      }
      break;

    case 'heading':
      // Headings have text property
      if (typeof config.text === 'string' && config.text) {
        return truncate(config.text);
      }
      break;

    case 'button':
      // Buttons have text or label
      if (typeof config.text === 'string' && config.text) {
        return truncate(config.text, 25);
      }
      if (typeof config.label === 'string' && config.label) {
        return truncate(config.label, 25);
      }
      break;

    case 'image':
      // Images might have alt text or src
      if (typeof config.alt === 'string' && config.alt) {
        return truncate(config.alt, 25);
      }
      if (typeof config.src === 'string' && config.src) {
        // Extract filename from path
        const filename = config.src.split('/').pop() || '';
        if (filename) return truncate(filename, 25);
      }
      break;

    case 'hero':
      // Heroes have title and subtitle
      if (typeof config.title === 'string' && config.title) {
        return truncate(config.title);
      }
      break;

    case 'cta':
      // CTAs have headline or title
      if (typeof config.headline === 'string' && config.headline) {
        return truncate(config.headline);
      }
      if (typeof config.title === 'string' && config.title) {
        return truncate(config.title);
      }
      break;

    case 'features':
      // Features might have a title
      if (typeof config.title === 'string' && config.title) {
        return truncate(config.title);
      }
      break;

    case 'pricing':
      // Pricing might have a title
      if (typeof config.title === 'string' && config.title) {
        return truncate(config.title);
      }
      break;

    case 'icon':
      // Icons have an icon name
      if (typeof config.icon === 'string' && config.icon) {
        return config.icon;
      }
      if (typeof config.name === 'string' && config.name) {
        return config.name;
      }
      break;

    case 'dropdown':
      // Dropdowns have a label
      if (typeof config.label === 'string' && config.label) {
        return truncate(config.label, 25);
      }
      break;

    case 'navbar':
      // Navbars might have a logo text or brand name
      if (typeof config.brandName === 'string' && config.brandName) {
        return truncate(config.brandName, 25);
      }
      if (typeof config.logoText === 'string' && config.logoText) {
        return truncate(config.logoText, 25);
      }
      break;

    case 'footer':
      // Footers might have copyright text
      if (typeof config.copyright === 'string' && config.copyright) {
        return truncate(config.copyright, 25);
      }
      break;

    case 'container':
    case 'columns':
      // Containers might have a name or label
      if (typeof config.name === 'string' && config.name) {
        return truncate(config.name, 25);
      }
      if (typeof config.label === 'string' && config.label) {
        return truncate(config.label, 25);
      }
      break;

    case 'spacer':
      // Spacers have height
      if (config.height !== undefined) {
        return `${config.height}`;
      }
      break;

    case 'divider':
      // Dividers might have a style
      if (typeof config.style === 'string' && config.style) {
        return config.style;
      }
      break;

    default:
      // For other types, try common properties
      if (typeof config.title === 'string' && config.title) {
        return truncate(config.title);
      }
      if (typeof config.text === 'string' && config.text) {
        return truncate(config.text);
      }
      if (typeof config.label === 'string' && config.label) {
        return truncate(config.label);
      }
      break;
  }

  return '';
}

/**
 * Get the display label for a component, resolving component names for component_ref types.
 * Optionally includes a content preview for better identification.
 * @param component - The component to get the label for
 * @param components - Optional list of components to look up component names
 * @param includeContent - Whether to include content preview (default: false for backwards compatibility)
 * @returns The display label for the component
 */
export function getComponentDisplayLabel(
  component: { type: ComponentType; config?: ComponentConfig },
  components?: { id: number; name: string }[],
  includeContent: boolean = false
): string {
  const config = component.config as Record<string, unknown> | undefined;
  // For component_ref types, try to resolve the component name
  if (component.type === 'component_ref' && config?.componentId && components) {
    const found = components.find((c) => c.id === config?.componentId);
    if (found) {
      return found.name;
    }
  }

  const baseLabel = getComponentLabel(component.type);

  if (includeContent) {
    const contentPreview = getComponentContentPreview(component);
    if (contentPreview) {
      return `${baseLabel}: ${contentPreview}`;
    }
  }

  return baseLabel;
}

// Deprecated: Use getComponentDisplayLabel instead
export const getWidgetDisplayLabel = getComponentDisplayLabel;
