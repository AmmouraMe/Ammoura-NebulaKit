/**
 * Tests for built-in component seeding with revision system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getLatestDefaultRevision,
  isCurrentRevisionDefault,
  seedBuiltinComponent,
  seedAllBuiltinComponents,
  migrateInitialRevisionsToVersioned,
  getDefaultRevisionsSummary,
  seedBuiltinLayout,
  seedAllBuiltinLayouts,
  seedBuiltinPage,
  seedAllBuiltinPages,
  DEFAULT_REVISION_MESSAGE_PREFIX,
  BUILTIN_LAYOUTS,
  BUILTIN_PAGES,
  type BuiltinComponentDefinition
} from './builtin-seeding';
import type { D1Database } from '@cloudflare/workers-types';

// Mock the imports
vi.mock('./revisions-service', () => ({
  createRevision: vi.fn(),
  getRevisions: vi.fn(),
  getCurrentRevision: vi.fn(),
  setCurrentRevision: vi.fn()
}));

vi.mock('$lib/utils/editor/componentDefaults', () => ({
  getDefaultConfig: vi.fn()
}));

vi.mock('$lib/utils/editor/pageDefaults', async () => {
  const actual = await vi.importActual('$lib/utils/editor/pageDefaults');
  return {
    ...actual
  };
});

vi.mock('$lib/utils/editor/layoutDefaults', async () => {
  const actual = await vi.importActual('$lib/utils/editor/layoutDefaults');
  return {
    ...actual
  };
});

import {
  createRevision,
  getRevisions,
  getCurrentRevision,
  setCurrentRevision
} from './revisions-service';
import { getDefaultConfig } from '$lib/utils/editor/componentDefaults';

describe('builtin-seeding', () => {
  let mockDb: D1Database;
  const testSiteId = 'test-site-1';

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn()
      }),
      batch: vi.fn()
    } as unknown as D1Database;
  });

  describe('DEFAULT_REVISION_MESSAGE_PREFIX', () => {
    it('should have the correct prefix', () => {
      expect(DEFAULT_REVISION_MESSAGE_PREFIX).toBe('Default configuration v');
    });
  });

  describe('getLatestDefaultRevision', () => {
    it('should return null if no revisions exist', async () => {
      vi.mocked(getRevisions).mockResolvedValue([]);

      const result = await getLatestDefaultRevision(mockDb, testSiteId, 'component', '1');

      expect(result).toBeNull();
    });

    it('should return null if no default revisions exist', async () => {
      vi.mocked(getRevisions).mockResolvedValue([
        { id: 'rev1', message: 'Custom change', data: {} }
      ] as never[]);

      const result = await getLatestDefaultRevision(mockDb, testSiteId, 'component', '1');

      expect(result).toBeNull();
    });

    it('should return the latest default revision by version', async () => {
      vi.mocked(getRevisions).mockResolvedValue([
        { id: 'rev1', message: 'Default configuration v1', data: { name: 'v1' } },
        { id: 'rev2', message: 'Custom change', data: {} },
        { id: 'rev3', message: 'Default configuration v3', data: { name: 'v3' } },
        { id: 'rev4', message: 'Default configuration v2', data: { name: 'v2' } }
      ] as never[]);

      const result = await getLatestDefaultRevision(mockDb, testSiteId, 'component', '1');

      expect(result).not.toBeNull();
      expect(result!.version).toBe(3);
      expect(result!.revision.id).toBe('rev3');
    });
  });

  describe('isCurrentRevisionDefault', () => {
    it('should return false if no current revision', async () => {
      vi.mocked(getCurrentRevision).mockResolvedValue(null);

      const result = await isCurrentRevisionDefault(mockDb, testSiteId, 'component', '1');

      expect(result.isDefault).toBe(false);
      expect(result.version).toBeNull();
    });

    it('should return false if current revision is not a default', async () => {
      vi.mocked(getCurrentRevision).mockResolvedValue({
        id: 'rev1',
        message: 'Custom configuration'
      } as never);

      const result = await isCurrentRevisionDefault(mockDb, testSiteId, 'component', '1');

      expect(result.isDefault).toBe(false);
      expect(result.version).toBeNull();
    });

    it('should return true with version if current revision is a default', async () => {
      vi.mocked(getCurrentRevision).mockResolvedValue({
        id: 'rev1',
        message: 'Default configuration v2'
      } as never);

      const result = await isCurrentRevisionDefault(mockDb, testSiteId, 'component', '1');

      expect(result.isDefault).toBe(true);
      expect(result.version).toBe(2);
    });
  });

  describe('seedBuiltinComponent', () => {
    const testDefinition: BuiltinComponentDefinition = {
      name: 'Test Component',
      description: 'A test component',
      type: 'navbar',
      isGlobal: true,
      isPrimitive: false
    };

    beforeEach(() => {
      vi.mocked(getDefaultConfig).mockReturnValue({
        brand: 'Test Brand',
        children: []
      } as never);
    });

    it('should create a new component if it does not exist', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null), // Component doesn't exist
        run: vi.fn().mockResolvedValue({ meta: { last_row_id: 123 } })
      });
      mockDb.prepare = mockPrepare;

      vi.mocked(createRevision).mockResolvedValue({
        id: 'new-rev-id',
        site_id: testSiteId,
        entity_type: 'component',
        entity_id: '123',
        revision_hash: 'abc1234',
        data: {},
        is_current: false,
        created_at: Date.now()
      } as never);

      const result = await seedBuiltinComponent(mockDb, testSiteId, testDefinition, 1);

      expect(result.action).toBe('created');
      expect(result.entityName).toBe('Test Component');
      expect(result.newVersion).toBe(1);
      expect(createRevision).toHaveBeenCalled();
      expect(setCurrentRevision).toHaveBeenCalled();
    });

    it('should skip if component already has the current version', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 1, config: '{}' }),
        run: vi.fn()
      });
      mockDb.prepare = mockPrepare;

      vi.mocked(getRevisions).mockResolvedValue([
        { id: 'rev1', message: 'Default configuration v1', data: {} }
      ] as never[]);

      const result = await seedBuiltinComponent(mockDb, testSiteId, testDefinition, 1);

      expect(result.action).toBe('skipped');
      expect(result.message).toContain('already has default v1');
    });

    it('should upgrade if site is on previous default version', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 1, config: '{}' }),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } })
      });
      mockDb.prepare = mockPrepare;

      // Has v1 default
      vi.mocked(getRevisions).mockResolvedValue([
        { id: 'rev1', message: 'Default configuration v1', data: {} }
      ] as never[]);

      // Currently on v1 default
      vi.mocked(getCurrentRevision).mockResolvedValue({
        id: 'rev1',
        message: 'Default configuration v1'
      } as never);

      vi.mocked(createRevision).mockResolvedValue({
        id: 'new-rev-id',
        message: 'Default configuration v2'
      } as never);

      const result = await seedBuiltinComponent(mockDb, testSiteId, testDefinition, 2);

      expect(result.action).toBe('upgraded');
      expect(result.previousVersion).toBe(1);
      expect(result.newVersion).toBe(2);
      expect(setCurrentRevision).toHaveBeenCalledWith(
        mockDb,
        testSiteId,
        'component',
        '1',
        'new-rev-id'
      );
    });

    it('should not upgrade if site has custom configuration', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 1, config: '{}' }),
        run: vi.fn()
      });
      mockDb.prepare = mockPrepare;

      // Has v1 default
      vi.mocked(getRevisions).mockResolvedValue([
        { id: 'rev1', message: 'Default configuration v1', data: {} }
      ] as never[]);

      // Currently on a custom revision (not a default)
      vi.mocked(getCurrentRevision).mockResolvedValue({
        id: 'rev2',
        message: 'Custom configuration by user'
      } as never);

      vi.mocked(createRevision).mockResolvedValue({
        id: 'new-rev-id',
        message: 'Default configuration v2'
      } as never);

      const result = await seedBuiltinComponent(mockDb, testSiteId, testDefinition, 2);

      expect(result.action).toBe('skipped');
      expect(result.message).toContain('site has custom configuration');
      expect(setCurrentRevision).not.toHaveBeenCalled();
    });
  });

  describe('seedAllBuiltinComponents', () => {
    it('should seed components for all sites', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [{ id: 'site-1' }, { id: 'site-2' }] }),
        run: vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } })
      });
      mockDb.prepare = mockPrepare;

      vi.mocked(createRevision).mockResolvedValue({
        id: 'rev-id',
        message: 'Default configuration v1'
      } as never);

      const definitions: BuiltinComponentDefinition[] = [
        { name: 'Component 1', type: 'navbar', isGlobal: true, isPrimitive: false },
        { name: 'Component 2', type: 'footer', isGlobal: true, isPrimitive: false }
      ];

      const results = await seedAllBuiltinComponents(mockDb, definitions, 1);

      // 2 sites * 2 components = 4 results
      expect(results.length).toBe(4);
    });
  });

  describe('migrateInitialRevisionsToVersioned', () => {
    it('should update old revision messages to v1 format', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ meta: { changes: 5 } })
      });
      mockDb.prepare = mockPrepare;

      const result = await migrateInitialRevisionsToVersioned(mockDb, 'component');

      expect(result).toBe(5);
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining("SET message = 'Default configuration v1'")
      );
    });
  });

  describe('getDefaultRevisionsSummary', () => {
    it('should return summary of default revisions', async () => {
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              site_id: 'site-1',
              entity_id: '1',
              message: 'Default configuration v2',
              is_current: 1,
              entity_name: 'Navigation Bar'
            },
            {
              site_id: 'site-1',
              entity_id: '1',
              message: 'Default configuration v1',
              is_current: 0,
              entity_name: 'Navigation Bar'
            },
            {
              site_id: 'site-1',
              entity_id: '2',
              message: 'Default configuration v1',
              is_current: 0,
              entity_name: 'Footer'
            }
          ]
        })
      });
      mockDb.prepare = mockPrepare;

      const result = await getDefaultRevisionsSummary(mockDb, 'component');

      expect(result.length).toBe(2);

      const navbar = result.find((r) => r.entityName === 'Navigation Bar');
      expect(navbar).toBeDefined();
      expect(navbar!.latestDefaultVersion).toBe(2);
      expect(navbar!.currentVersion).toBe(2);
      expect(navbar!.isOnLatestDefault).toBe(true);

      const footer = result.find((r) => r.entityName === 'Footer');
      expect(footer).toBeDefined();
      expect(footer!.latestDefaultVersion).toBe(1);
      expect(footer!.currentVersion).toBeNull(); // v1 not current
      expect(footer!.isOnLatestDefault).toBe(false);
    });
  });

  // ============================================================================
  // Layout Seeding Tests
  // ============================================================================

  describe('BUILTIN_LAYOUTS', () => {
    it('should export the default layout definition', () => {
      expect(BUILTIN_LAYOUTS).toBeDefined();
      expect(BUILTIN_LAYOUTS.length).toBeGreaterThan(0);

      const defaultLayout = BUILTIN_LAYOUTS.find((l) => l.slug === 'default');
      expect(defaultLayout).toBeDefined();
      expect(defaultLayout!.name).toBe('Default Layout');
      expect(defaultLayout!.isDefault).toBe(true);
    });

    it('should have valid widget definitions for default layout', () => {
      const defaultLayout = BUILTIN_LAYOUTS.find((l) => l.slug === 'default');
      expect(defaultLayout).toBeDefined();

      const widgets = defaultLayout!.getWidgets();
      expect(widgets.length).toBe(3);

      // Should have navbar, yield, and footer in order
      expect(widgets[0].type).toBe('navbar');
      expect(widgets[1].type).toBe('yield');
      expect(widgets[2].type).toBe('footer');
    });
  });

  describe('seedBuiltinLayout', () => {
    it('should create a new layout if it does not exist', async () => {
      const mockPrepare = vi.fn();
      const mockBind = vi.fn().mockReturnThis();
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockRun = vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } });

      mockPrepare.mockReturnValue({
        bind: mockBind,
        first: mockFirst,
        run: mockRun,
        all: vi.fn().mockResolvedValue({ results: [] })
      });

      mockDb.prepare = mockPrepare;

      vi.mocked(createRevision).mockResolvedValue({
        id: 'rev-1',
        revision_hash: 'abc123',
        created_at: Date.now(),
        is_current: false
      } as never);

      const definition = BUILTIN_LAYOUTS[0];
      const result = await seedBuiltinLayout(mockDb, testSiteId, definition, 1);

      expect(result.action).toBe('created');
      expect(result.entityType).toBe('layout');
      expect(result.newVersion).toBe(1);
    });

    it('should skip if layout already has the current version', async () => {
      const mockPrepare = vi.fn();
      const mockBind = vi.fn().mockReturnThis();
      const mockFirst = vi.fn().mockResolvedValue({ id: 1 });

      mockPrepare.mockReturnValue({
        bind: mockBind,
        first: mockFirst,
        run: vi.fn(),
        all: vi.fn().mockResolvedValue({ results: [] })
      });

      mockDb.prepare = mockPrepare;

      vi.mocked(getRevisions).mockResolvedValue([
        { id: 'rev1', message: 'Default configuration v1', data: {} }
      ] as never[]);

      const definition = BUILTIN_LAYOUTS[0];
      const result = await seedBuiltinLayout(mockDb, testSiteId, definition, 1);

      expect(result.action).toBe('skipped');
      expect(result.previousVersion).toBe(1);
    });
  });

  describe('seedAllBuiltinLayouts', () => {
    it('should seed layouts for all sites', async () => {
      const mockPrepare = vi.fn();
      const mockBind = vi.fn().mockReturnThis();
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockRun = vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } });
      const mockAll = vi.fn();

      // First call returns sites, subsequent calls return empty results
      let callCount = 0;
      mockAll.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ results: [{ id: 'site-1' }, { id: 'site-2' }] });
        }
        return Promise.resolve({ results: [] });
      });

      mockPrepare.mockReturnValue({
        bind: mockBind,
        first: mockFirst,
        run: mockRun,
        all: mockAll
      });

      mockDb.prepare = mockPrepare;

      vi.mocked(createRevision).mockResolvedValue({
        id: 'rev-1',
        revision_hash: 'abc123',
        created_at: Date.now(),
        is_current: false
      } as never);

      const results = await seedAllBuiltinLayouts(mockDb, 1);

      // Should have results for each site * each layout
      expect(results.length).toBe(2 * BUILTIN_LAYOUTS.length);
    });
  });

  // ============================================================================
  // Page Seeding Tests
  // ============================================================================

  describe('BUILTIN_PAGES', () => {
    it('should export the home page definition', () => {
      expect(BUILTIN_PAGES).toBeDefined();
      expect(BUILTIN_PAGES.length).toBeGreaterThan(0);

      const homePage = BUILTIN_PAGES.find((p) => p.id === 'builtin-home-page');
      expect(homePage).toBeDefined();
      expect(homePage!.title).toBe('Home');
      expect(homePage!.slug).toBe('/');
    });

    it('should have valid widget definitions for home page', () => {
      const homePage = BUILTIN_PAGES.find((p) => p.id === 'builtin-home-page');
      expect(homePage).toBeDefined();

      const widgets = homePage!.getWidgets();
      expect(widgets.length).toBeGreaterThan(0);

      // Should have hero as first widget
      expect(widgets[0].type).toBe('hero');
    });
  });

  describe('seedBuiltinPage', () => {
    it('should create a new page if it does not exist', async () => {
      const mockPrepare = vi.fn();
      const mockBind = vi.fn().mockReturnThis();
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockRun = vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } });

      mockPrepare.mockReturnValue({
        bind: mockBind,
        first: mockFirst,
        run: mockRun,
        all: vi.fn().mockResolvedValue({ results: [] })
      });

      mockDb.prepare = mockPrepare;

      const definition = BUILTIN_PAGES[0];
      const result = await seedBuiltinPage(mockDb, testSiteId, definition, 1);

      expect(result.action).toBe('created');
      expect(result.entityType).toBe('page');
      expect(result.newVersion).toBe(1);
    });

    it('should skip if page already exists with current version', async () => {
      const mockPrepare = vi.fn();
      const mockBind = vi.fn().mockReturnThis();
      const mockFirst = vi.fn().mockResolvedValue({ id: 'builtin-home-page' });
      const mockAll = vi.fn().mockResolvedValue({
        results: [{ id: 'rev-1', notes: 'Default configuration v1' }]
      });

      mockPrepare.mockReturnValue({
        bind: mockBind,
        first: mockFirst,
        run: vi.fn(),
        all: mockAll
      });

      mockDb.prepare = mockPrepare;

      const definition = BUILTIN_PAGES[0];
      const result = await seedBuiltinPage(mockDb, testSiteId, definition, 1);

      expect(result.action).toBe('skipped');
      expect(result.previousVersion).toBe(1);
    });

    it('adopts an existing page on the same slug instead of colliding on it', async () => {
      // createSiteForAccount seeds a starter home page with a generated id and
      // is_builtin = 0. The slug lookup has to find it, or the INSERT below
      // breaks on pages' UNIQUE(site_id, slug).
      const mockPrepare = vi.fn();
      const mockRun = vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } });

      const mockFirst = vi
        .fn()
        // lookup by builtin id: not found
        .mockResolvedValueOnce(null)
        // lookup by slug: the tenant's own page, is_builtin = 0
        .mockResolvedValueOnce({ id: 'generated-home-id' });

      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: mockFirst,
        run: mockRun,
        all: vi.fn().mockResolvedValue({ results: [] })
      });

      mockDb.prepare = mockPrepare;

      const result = await seedBuiltinPage(mockDb, testSiteId, BUILTIN_PAGES[0], 1);

      expect(result.action).not.toBe('created');
      expect(result.entityId).toBe('generated-home-id');

      const insertedPages = mockPrepare.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO pages')
      );
      expect(insertedPages).toHaveLength(0);
    });

    it('looks a page up by slug without requiring is_builtin', async () => {
      const mockPrepare = vi.fn();

      mockPrepare.mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } }),
        all: vi.fn().mockResolvedValue({ results: [] })
      });

      mockDb.prepare = mockPrepare;

      await seedBuiltinPage(mockDb, testSiteId, BUILTIN_PAGES[0], 1);

      const slugLookups = mockPrepare.mock.calls
        .map((call) => call[0])
        .filter(
          (sql) =>
            typeof sql === 'string' && sql.includes('SELECT id FROM pages') && sql.includes('slug')
        );

      expect(slugLookups.length).toBeGreaterThan(0);
      for (const sql of slugLookups) {
        expect(sql).not.toContain('is_builtin');
      }
    });
  });

  describe('seedAllBuiltinPages', () => {
    it('should seed pages for all sites', async () => {
      const mockPrepare = vi.fn();
      const mockBind = vi.fn().mockReturnThis();
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockRun = vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } });
      const mockAll = vi.fn();

      // First call returns sites, subsequent calls return empty results
      let callCount = 0;
      mockAll.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ results: [{ id: 'site-1' }, { id: 'site-2' }] });
        }
        return Promise.resolve({ results: [] });
      });

      mockPrepare.mockReturnValue({
        bind: mockBind,
        first: mockFirst,
        run: mockRun,
        all: mockAll
      });

      mockDb.prepare = mockPrepare;

      const results = await seedAllBuiltinPages(mockDb, 1);

      // Should have results for each site * each page
      expect(results.length).toBe(2 * BUILTIN_PAGES.length);
    });
  });

  describe('a built-in page that declares a layout', () => {
    /**
     * The holding page is the reason `layoutSlug` exists: while the coming-soon
     * gate is up, every link in the site's navbar and footer answers 503, so a
     * holding page wearing them is a page of dead ends.
     */
    it('is the only built-in page that asks for one, and asks for minimal', () => {
      const withLayout = BUILTIN_PAGES.filter((page) => page.layoutSlug);
      expect(withLayout.map((page) => [page.slug, page.layoutSlug])).toEqual([
        ['/coming-soon', 'minimal']
      ]);
    });

    it('names a layout that actually exists', () => {
      // A slug with no matching definition silently leaves the page on the
      // site's default, which is exactly the outcome it was set to avoid.
      for (const page of BUILTIN_PAGES.filter((p) => p.layoutSlug)) {
        expect(BUILTIN_LAYOUTS.some((layout) => layout.slug === page.layoutSlug)).toBe(true);
      }
    });

    it('points the new page at that layout', async () => {
      const statements: string[] = [];
      const binds: unknown[][] = [];
      const mockPrepare = vi.fn((sql: string) => {
        statements.push(sql);
        return {
          bind: vi.fn((...args: unknown[]) => {
            binds.push(args);
            return {
              // No existing page, no existing layout: the create path.
              first: vi.fn().mockResolvedValue(sql.includes('FROM layouts') ? { id: 7 } : null),
              run: vi.fn().mockResolvedValue({ meta: { last_row_id: 7 } }),
              all: vi.fn().mockResolvedValue({ results: [] })
            };
          })
        };
      });
      mockDb.prepare = mockPrepare as never;

      const definition = BUILTIN_PAGES.find((page) => page.slug === '/coming-soon');
      await seedBuiltinPage(mockDb, testSiteId, definition!, 1);

      const update = statements.find((sql) => sql.includes('UPDATE pages SET layout_id'));
      expect(update).toBeDefined();
      // The layout id the lookup returned, the page, and the site — in that order.
      expect(binds.some((args) => args[0] === 7 && args[2] === testSiteId)).toBe(true);
    });

    it('does not run the layout update for a page that declares none', async () => {
      const statements: string[] = [];
      const mockPrepare = vi.fn((sql: string) => {
        statements.push(sql);
        return {
          bind: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ meta: { last_row_id: 1 } }),
            all: vi.fn().mockResolvedValue({ results: [] })
          }))
        };
      });
      mockDb.prepare = mockPrepare as never;

      const definition = BUILTIN_PAGES.find((page) => page.slug === '/privacy-policy');
      await seedBuiltinPage(mockDb, testSiteId, definition!, 1);

      expect(statements.some((sql) => sql.includes('UPDATE pages SET layout_id'))).toBe(false);
    });
  });
});
