import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load, type LayoutData as ServerLayoutData } from './+layout.server';

// Result type from the layout load function
interface LayoutLoadResult {
  themeColorsLight: Record<string, string> | null;
  themeColorsDark: Record<string, string> | null;
  userColorScheme: string | null;
  currentUser: {
    id: string;
    email: string;
    name: string;
    role: string;
  } | null;
  storeName: string;
  layoutData: ServerLayoutData & {
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
  };
}

// Mock types
interface MockPlatform {
  env: {
    DB: {
      prepare: ReturnType<typeof vi.fn>;
    };
  };
}

interface MockLocals {
  siteId: string;
  currentUser: {
    id: string;
    email: string;
    name: string;
    role: string;
  } | null;
}

describe('+layout.server load function', () => {
  let mockPlatform: MockPlatform;
  let mockLocals: MockLocals;

  // Helper to create mock DB prepare function
  const createMockDb = (options: {
    generalSettings?: { store_name?: string };
    themePreferences?: { light?: string; dark?: string };
    colorThemes?: Array<{ id: string; colors: Record<string, string> }>;
    defaultLayout?: { id: number; is_default: number } | null;
    layoutWidgets?: Array<{ type: string; config: string | Record<string, unknown> }>;
    component?: { id?: number; type?: string; config: Record<string, unknown> } | null;
  }) => {
    return vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(() => {
          if (sql.includes('SELECT * FROM site_settings')) {
            return Promise.resolve({
              settings: JSON.stringify({
                storeName: options.generalSettings?.store_name || 'Test Store'
              })
            });
          }
          if (sql.includes('SELECT value FROM theme_preferences')) {
            // Return theme ID based on preference key
            return Promise.resolve(null);
          }
          if (sql.includes('SELECT * FROM layouts WHERE site_id = ? AND is_default')) {
            return Promise.resolve(options.defaultLayout || null);
          }
          if (sql.includes('SELECT * FROM components WHERE id = ?')) {
            return Promise.resolve(options.component || null);
          }
          return Promise.resolve(null);
        }),
        all: vi.fn().mockImplementation(() => {
          if (sql.includes('SELECT * FROM color_themes')) {
            return Promise.resolve({
              results: options.colorThemes || [
                {
                  id: 'vibrant',
                  colors: JSON.stringify({
                    primary: '#3B82F6',
                    secondary: '#10B981',
                    background: '#FFFFFF',
                    text: '#1F2937',
                    textSecondary: '#6B7280',
                    surface: '#F3F4F6',
                    border: '#E5E7EB',
                    accent: '#8B5CF6'
                  })
                },
                {
                  id: 'midnight',
                  colors: JSON.stringify({
                    primary: '#60A5FA',
                    secondary: '#34D399',
                    background: '#111827',
                    text: '#F9FAFB',
                    textSecondary: '#9CA3AF',
                    surface: '#1F2937',
                    border: '#374151',
                    accent: '#A78BFA'
                  })
                }
              ]
            });
          }
          if (sql.includes('SELECT * FROM layout_widgets')) {
            return Promise.resolve({
              results: options.layoutWidgets || []
            });
          }
          return Promise.resolve({ results: [] });
        })
      })
    }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocals = {
      siteId: 'site-1',
      currentUser: null
    };
  });

  describe('when platform is not available', () => {
    it('should return defaults when platform is undefined', async () => {
      const result = (await load({
        platform: undefined,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.themeColorsLight).toBeNull();
      expect(result.themeColorsDark).toBeNull();
      expect(result.userColorScheme).toBeNull();
      expect(result.currentUser).toBeNull();
      expect(result.storeName).toBe('Ammoura');
      expect(result.layoutData).toBeDefined();
      expect(result.layoutData.navbar).toBeDefined();
      expect(result.layoutData.navbar?.type).toBe('navbar');
    });

    it('should return defaults when DB is not available', async () => {
      const result = (await load({
        platform: { env: {} },
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.themeColorsLight).toBeNull();
      expect(result.themeColorsDark).toBeNull();
      expect(result.layoutData.navbar).toBeDefined();
    });
  });

  describe('when platform is available', () => {
    beforeEach(() => {
      mockPlatform = {
        env: {
          DB: {
            prepare: createMockDb({
              generalSettings: { store_name: 'My Store' },
              defaultLayout: { id: 1, is_default: 1 },
              layoutWidgets: [
                {
                  type: 'navbar',
                  config: JSON.stringify({
                    componentId: 10,
                    links: [{ text: 'Test', url: '/test' }]
                  })
                }
              ],
              component: {
                config: {
                  logo: { text: 'Store', url: '/' },
                  links: [{ text: 'Home', url: '/' }],
                  showCart: true,
                  showAuth: true
                }
              }
            })
          }
        }
      };
    });

    it('should load theme colors from database', async () => {
      const result = (await load({
        platform: mockPlatform,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      // Theme colors should be mapped
      expect(result.themeColorsLight).toBeDefined();
      expect(result.themeColorsDark).toBeDefined();
    });

    it('should include current user when available', async () => {
      mockLocals.currentUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin'
      };

      const result = (await load({
        platform: mockPlatform,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.currentUser).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin'
      });
    });

    it('should return userColorScheme null when no user is logged in', async () => {
      const result = (await load({
        platform: mockPlatform,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.userColorScheme).toBeNull();
    });

    it('should return userColorScheme from user preferences when logged in', async () => {
      mockLocals.currentUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'customer'
      };

      // Create a mock DB that returns user theme preferences
      const userPrefsPlatform = {
        env: {
          DB: {
            prepare: vi.fn().mockImplementation((sql: string) => ({
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM site_settings')) {
                    return Promise.resolve({
                      settings: JSON.stringify({ storeName: 'Test Store' })
                    });
                  }
                  if (sql.includes('SELECT value FROM theme_preferences')) {
                    return Promise.resolve(null);
                  }
                  if (sql.includes('FROM user_theme_preferences')) {
                    return Promise.resolve({
                      user_id: 'user-1',
                      site_id: 'site-1',
                      color_scheme: 'dark',
                      light_theme_id: null,
                      dark_theme_id: null,
                      created_at: 1234567890,
                      updated_at: 1234567890
                    });
                  }
                  if (sql.includes('SELECT * FROM layouts WHERE site_id = ? AND is_default')) {
                    return Promise.resolve(null);
                  }
                  if (sql.includes('SELECT * FROM components WHERE name = ? AND is_global = 1')) {
                    return Promise.resolve(null);
                  }
                  return Promise.resolve(null);
                }),
                all: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM site_settings WHERE site_id')) {
                    return Promise.resolve({
                      results: [{ setting_key: 'general_store_name', setting_value: 'Test Store' }]
                    });
                  }
                  if (sql.includes('SELECT * FROM color_themes')) {
                    return Promise.resolve({
                      results: [
                        {
                          id: 'vibrant',
                          colors: JSON.stringify({
                            primary: '#3B82F6',
                            secondary: '#10B981',
                            background: '#FFFFFF',
                            text: '#1F2937',
                            textSecondary: '#6B7280',
                            surface: '#F3F4F6',
                            border: '#E5E7EB',
                            accent: '#8B5CF6'
                          })
                        },
                        {
                          id: 'midnight',
                          colors: JSON.stringify({
                            primary: '#60A5FA',
                            secondary: '#34D399',
                            background: '#111827',
                            text: '#F9FAFB',
                            textSecondary: '#9CA3AF',
                            surface: '#1F2937',
                            border: '#374151',
                            accent: '#A78BFA'
                          })
                        }
                      ]
                    });
                  }
                  if (sql.includes('SELECT * FROM layout_widgets')) {
                    return Promise.resolve({ results: [] });
                  }
                  return Promise.resolve({ results: [] });
                })
              })
            }))
          }
        }
      };

      const result = (await load({
        platform: userPrefsPlatform,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.userColorScheme).toBe('dark');
    });

    it('should load layout data with navbar config', async () => {
      const result = (await load({
        platform: mockPlatform,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.layoutData).toBeDefined();
      expect(result.layoutData.navbar).toBeDefined();
      expect(result.layoutData.navbar?.type).toBe('navbar');
    });

    it('should resolve component_ref widgets to navbar/footer', async () => {
      // Mock DB with component_ref type widgets that reference navbar/footer components
      const componentRefPlatform = {
        env: {
          DB: {
            prepare: createMockDb({
              generalSettings: { store_name: 'My Store' },
              defaultLayout: { id: 1, is_default: 1 },
              layoutWidgets: [
                {
                  type: 'component_ref',
                  config: JSON.stringify({ componentId: 1 })
                },
                {
                  type: 'component_ref',
                  config: JSON.stringify({ componentId: 2 })
                }
              ],
              // The createMockDb will return a navbar component for id 1
              component: {
                id: 1,
                type: 'navbar',
                config: {
                  logo: { text: 'Store', url: '/' },
                  links: [{ text: 'Home', url: '/' }],
                  showCart: true,
                  showAuth: true
                }
              }
            })
          }
        }
      };

      const result = (await load({
        platform: componentRefPlatform,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      // component_ref should resolve to navbar type
      expect(result.layoutData.navbar).toBeDefined();
      expect(result.layoutData.navbar?.type).toBe('navbar');
      expect(result.layoutData.navbar?.config?.showCart).toBe(true);
    });
  });

  describe('default navbar config', () => {
    it('should have correct container architecture', async () => {
      const result = (await load({
        platform: undefined,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      const navbarConfig = result.layoutData.navbar?.config;
      expect(navbarConfig).toBeDefined();

      // Verify container padding (responsive)
      expect(navbarConfig?.containerPadding).toBeDefined();
      expect(navbarConfig?.containerPadding?.desktop).toEqual({
        top: 16,
        right: 24,
        bottom: 16,
        left: 24
      });
      expect(navbarConfig?.containerPadding?.tablet).toEqual({
        top: 12,
        right: 20,
        bottom: 12,
        left: 20
      });
      expect(navbarConfig?.containerPadding?.mobile).toEqual({
        top: 12,
        right: 16,
        bottom: 12,
        left: 16
      });
    });

    it('should have correct container margin', async () => {
      const result = (await load({
        platform: undefined,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      const navbarConfig = result.layoutData.navbar?.config;
      expect(navbarConfig?.containerMargin).toBeDefined();
      expect(navbarConfig?.containerMargin?.desktop).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      });
      expect(navbarConfig?.containerMargin?.tablet).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      });
      expect(navbarConfig?.containerMargin?.mobile).toEqual({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      });
    });

    it('should have correct container styling', async () => {
      const result = (await load({
        platform: undefined,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      const navbarConfig = result.layoutData.navbar?.config;
      expect(navbarConfig?.containerBackground).toBe('theme:secondary');
      expect(navbarConfig?.containerBorderRadius).toBe(0);
      expect(navbarConfig?.containerMaxWidth).toBe('1400px');
    });

    it('should have correct layout properties', async () => {
      const result = (await load({
        platform: undefined,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      const navbarConfig = result.layoutData.navbar?.config;
      expect(navbarConfig?.containerJustifyContent).toBe('space-between');
      expect(navbarConfig?.containerDisplay).toEqual({
        desktop: 'flex',
        tablet: 'flex',
        mobile: 'flex'
      });
      expect(navbarConfig?.containerFlexDirection).toEqual({
        desktop: 'row',
        tablet: 'row',
        mobile: 'column'
      });
      expect(navbarConfig?.containerAlignItems).toBe('stretch');
      expect(navbarConfig?.containerWrap).toBe('nowrap');
    });

    it('should have visibility and sticky settings', async () => {
      const result = (await load({
        platform: undefined,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      const navbarConfig = result.layoutData.navbar?.config;
      expect(navbarConfig?.visibilityRule).toBe('always');
      // Default fallback has sticky disabled - sticky is controlled by position.type = 'sticky' in container architecture
      expect(navbarConfig?.sticky).toBe(false);
    });
  });

  describe('global Navigation Bar component fallback', () => {
    it('should load global Navigation Bar component when no layout widgets exist', async () => {
      // Mock DB that returns no layout widgets but has a global "Navigation Bar" component
      mockPlatform = {
        env: {
          DB: {
            prepare: vi.fn().mockImplementation((sql: string) => ({
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM layouts WHERE site_id = ? AND is_default')) {
                    // Return a layout so we query for widgets
                    return Promise.resolve({ id: 1, is_default: 1 });
                  }
                  if (sql.includes('SELECT * FROM components WHERE name = ? AND is_global = 1')) {
                    // Return the global Navigation Bar component
                    return Promise.resolve({
                      id: 99,
                      name: 'Navigation Bar',
                      is_global: 1,
                      config: JSON.stringify({
                        logo: { text: 'Store', url: '/' },
                        links: [{ text: 'Shop', url: '/shop' }],
                        showCart: true,
                        containerMaxWidth: '1200px',
                        containerBackground: '#ffffff'
                      })
                    });
                  }
                  return Promise.resolve(null);
                }),
                all: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM site_settings WHERE site_id')) {
                    // Return site settings array for getSiteSettings
                    return Promise.resolve({
                      results: [
                        { setting_key: 'general_store_name', setting_value: 'My Custom Store' }
                      ]
                    });
                  }
                  if (sql.includes('SELECT * FROM color_themes')) {
                    return Promise.resolve({ results: [] });
                  }
                  if (sql.includes('SELECT * FROM layout_widgets')) {
                    // No navbar in layout widgets - this triggers global component fallback
                    return Promise.resolve({ results: [] });
                  }
                  return Promise.resolve({ results: [] });
                })
              })
            }))
          }
        }
      };

      const result = (await load({
        platform: mockPlatform,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.layoutData.navbar).toBeDefined();
      expect(result.layoutData.navbar?.type).toBe('navbar');
      // Site title should be updated from settings
      expect(result.layoutData.navbar?.config?.logo?.text).toBe('My Custom Store');
      // Other config should come from the global component
      expect(result.layoutData.navbar?.config?.links).toEqual([{ text: 'Shop', url: '/shop' }]);
      expect(result.layoutData.navbar?.config?.showCart).toBe(true);
      expect(result.layoutData.navbar?.config?.containerMaxWidth).toBe('1200px');
    });

    it('should fall back to hardcoded default when no global Navigation Bar exists', async () => {
      // Mock DB that returns no layout widgets AND no global component
      mockPlatform = {
        env: {
          DB: {
            prepare: vi.fn().mockImplementation((sql: string) => ({
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM layouts WHERE site_id = ? AND is_default')) {
                    return Promise.resolve({ id: 1, is_default: 1 });
                  }
                  // No global component found
                  return Promise.resolve(null);
                }),
                all: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM site_settings WHERE site_id')) {
                    return Promise.resolve({
                      results: [
                        { setting_key: 'general_store_name', setting_value: 'Fallback Store' }
                      ]
                    });
                  }
                  if (sql.includes('SELECT * FROM color_themes')) {
                    return Promise.resolve({ results: [] });
                  }
                  if (sql.includes('SELECT * FROM layout_widgets')) {
                    return Promise.resolve({ results: [] });
                  }
                  return Promise.resolve({ results: [] });
                })
              })
            }))
          }
        }
      };

      const result = (await load({
        platform: mockPlatform,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.layoutData.navbar).toBeDefined();
      expect(result.layoutData.navbar?.type).toBe('navbar');
      // Should have container architecture properties from default
      expect(result.layoutData.navbar?.config?.containerMaxWidth).toBe('1400px');
      expect(result.layoutData.navbar?.config?.containerBackground).toBe('theme:secondary');
      expect(result.layoutData.navbar?.config?.containerJustifyContent).toBe('space-between');
      // Default has sticky disabled - sticky is controlled by position.type = 'sticky' in container architecture
      expect(result.layoutData.navbar?.config?.sticky).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should return defaults on database error', async () => {
      mockPlatform = {
        env: {
          DB: {
            prepare: vi.fn().mockImplementation(() => {
              throw new Error('Database error');
            })
          }
        }
      };

      const result = (await load({
        platform: mockPlatform,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.themeColorsLight).toBeNull();
      expect(result.themeColorsDark).toBeNull();
      expect(result.storeName).toBe('Ammoura');
      expect(result.layoutData.navbar).toBeDefined();
    });
  });

  describe('layout pageProperties', () => {
    it('should parse page_properties from default layout', async () => {
      const pageProps = {
        maxWidth: '1400px',
        paddingTop: 16,
        paddingRight: 24,
        paddingBottom: 16,
        paddingLeft: 24
      };

      const pagePropsLayout = {
        env: {
          DB: {
            prepare: vi.fn().mockImplementation((sql: string) => ({
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM site_settings')) {
                    return Promise.resolve({
                      settings: JSON.stringify({ storeName: 'Test Store' })
                    });
                  }
                  if (sql.includes('SELECT * FROM layouts WHERE site_id = ? AND is_default')) {
                    return Promise.resolve({
                      id: 1,
                      is_default: 1,
                      page_properties: JSON.stringify(pageProps)
                    });
                  }
                  return Promise.resolve(null);
                }),
                all: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM color_themes')) {
                    return Promise.resolve({ results: [] });
                  }
                  if (sql.includes('SELECT * FROM layout_widgets')) {
                    return Promise.resolve({ results: [] });
                  }
                  return Promise.resolve({ results: [] });
                })
              })
            }))
          }
        }
      };

      const result = (await load({
        platform: pagePropsLayout,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.layoutData.pageProperties).toBeDefined();
      expect(result.layoutData.pageProperties?.maxWidth).toBe('1400px');
      expect(result.layoutData.pageProperties?.paddingTop).toBe(16);
      expect(result.layoutData.pageProperties?.paddingRight).toBe(24);
      expect(result.layoutData.pageProperties?.paddingBottom).toBe(16);
      expect(result.layoutData.pageProperties?.paddingLeft).toBe(24);
    });

    it('should not include pageProperties when layout has no page_properties', async () => {
      const noPropsLayout = {
        env: {
          DB: {
            prepare: vi.fn().mockImplementation((sql: string) => ({
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM site_settings')) {
                    return Promise.resolve({
                      settings: JSON.stringify({ storeName: 'Test Store' })
                    });
                  }
                  if (sql.includes('SELECT * FROM layouts WHERE site_id = ? AND is_default')) {
                    return Promise.resolve({ id: 1, is_default: 1 });
                  }
                  return Promise.resolve(null);
                }),
                all: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM color_themes')) {
                    return Promise.resolve({ results: [] });
                  }
                  if (sql.includes('SELECT * FROM layout_widgets')) {
                    return Promise.resolve({ results: [] });
                  }
                  return Promise.resolve({ results: [] });
                })
              })
            }))
          }
        }
      };

      const result = (await load({
        platform: noPropsLayout,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.layoutData.pageProperties).toBeUndefined();
    });

    it('should handle malformed page_properties JSON gracefully', async () => {
      const malformedLayout = {
        env: {
          DB: {
            prepare: vi.fn().mockImplementation((sql: string) => ({
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM site_settings')) {
                    return Promise.resolve({
                      settings: JSON.stringify({ storeName: 'Test Store' })
                    });
                  }
                  if (sql.includes('SELECT * FROM layouts WHERE site_id = ? AND is_default')) {
                    return Promise.resolve({
                      id: 1,
                      is_default: 1,
                      page_properties: '{invalid json!!'
                    });
                  }
                  return Promise.resolve(null);
                }),
                all: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM color_themes')) {
                    return Promise.resolve({ results: [] });
                  }
                  if (sql.includes('SELECT * FROM layout_widgets')) {
                    return Promise.resolve({ results: [] });
                  }
                  return Promise.resolve({ results: [] });
                })
              })
            }))
          }
        }
      };

      const result = (await load({
        platform: malformedLayout,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      // Should not throw and pageProperties should be undefined
      expect(result.layoutData.pageProperties).toBeUndefined();
    });

    it('should handle page_properties that is already an object', async () => {
      const pageProps = { maxWidth: '960px', width: '100%' };

      const objectPropsLayout = {
        env: {
          DB: {
            prepare: vi.fn().mockImplementation((sql: string) => ({
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM site_settings')) {
                    return Promise.resolve({
                      settings: JSON.stringify({ storeName: 'Test Store' })
                    });
                  }
                  if (sql.includes('SELECT * FROM layouts WHERE site_id = ? AND is_default')) {
                    return Promise.resolve({
                      id: 1,
                      is_default: 1,
                      page_properties: pageProps
                    });
                  }
                  return Promise.resolve(null);
                }),
                all: vi.fn().mockImplementation(() => {
                  if (sql.includes('SELECT * FROM color_themes')) {
                    return Promise.resolve({ results: [] });
                  }
                  if (sql.includes('SELECT * FROM layout_widgets')) {
                    return Promise.resolve({ results: [] });
                  }
                  return Promise.resolve({ results: [] });
                })
              })
            }))
          }
        }
      };

      const result = (await load({
        platform: objectPropsLayout,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.layoutData.pageProperties).toBeDefined();
      expect(result.layoutData.pageProperties?.maxWidth).toBe('960px');
      expect(result.layoutData.pageProperties?.width).toBe('100%');
    });

    it('should not include pageProperties in fallback layout when platform is unavailable', async () => {
      const result = (await load({
        platform: undefined,
        locals: mockLocals
      } as never)) as LayoutLoadResult;

      expect(result.layoutData.pageProperties).toBeUndefined();
    });
  });
});
