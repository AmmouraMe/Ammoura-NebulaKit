import { describe, it, expect, vi } from 'vitest';
import * as db from './pages';

describe('Pages Repository', () => {
  const testSiteId = 'test-site-id';

  const mockPage: db.DBPage = {
    id: 'page-1',
    site_id: testSiteId,
    title: 'Test Page',
    slug: '/test-page',
    status: 'draft',
    content: undefined,
    is_builtin: false,
    created_at: 1234567890,
    updated_at: 1234567890
  };

  const mockWidget: db.DBPageWidget = {
    id: 'widget-1',
    page_id: 'page-1',
    type: 'text',
    config: '{"text":"Hello"}',
    position: 0,
    created_at: 1234567890,
    updated_at: 1234567890
  };

  describe('createPage', () => {
    it('should create a new page', async () => {
      const mockFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(mockPage);
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi
        .fn()
        .mockReturnValueOnce({ first: mockFirst })
        .mockReturnValueOnce({ run: mockRun })
        .mockReturnValueOnce({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const pageData: db.CreatePageData = {
        title: 'Test Page',
        slug: '/test-page',
        status: 'draft'
      };

      const page = await db.createPage(mockDB, testSiteId, pageData);

      expect(page).toBeDefined();
      expect(page.title).toBe('Test Page');
    });

    it('should throw error for duplicate slug', async () => {
      const mockFirst = vi.fn().mockResolvedValue(mockPage);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const pageData: db.CreatePageData = {
        title: 'Duplicate',
        slug: '/test-page',
        status: 'draft'
      };

      await expect(db.createPage(mockDB, testSiteId, pageData)).rejects.toThrow('already exists');
    });
  });

  describe('getPageById', () => {
    it('should retrieve a page by ID', async () => {
      const mockFirst = vi.fn().mockResolvedValue(mockPage);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const found = await db.getPageById(mockDB, testSiteId, 'page-1');

      expect(found).toBeDefined();
      expect(found?.id).toBe('page-1');
    });

    it('should return null for non-existent page', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const found = await db.getPageById(mockDB, testSiteId, 'non-existent');
      expect(found).toBeNull();
    });
  });

  describe('getPageBySlug', () => {
    it('should retrieve a page by slug', async () => {
      const mockFirst = vi.fn().mockResolvedValue(mockPage);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const found = await db.getPageBySlug(mockDB, testSiteId, '/test-page');

      expect(found).toBeDefined();
      expect(found?.slug).toBe('/test-page');
    });

    it('should return null for non-existent slug', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const found = await db.getPageBySlug(mockDB, testSiteId, '/non-existent');
      expect(found).toBeNull();
    });
  });

  describe('getAllPages', () => {
    it('should retrieve all pages for a site', async () => {
      const mockPage2 = { ...mockPage, id: 'page-2', title: 'Page 2' };
      const mockAll = vi.fn().mockResolvedValue({ results: [mockPage, mockPage2] });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const pages = await db.getAllPages(mockDB, testSiteId);

      expect(pages).toHaveLength(2);
    });
  });

  describe('getPublishedPages', () => {
    it('should retrieve only published pages', async () => {
      const publishedPage = { ...mockPage, status: 'published' as const };
      const mockAll = vi.fn().mockResolvedValue({ results: [publishedPage] });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const pages = await db.getPublishedPages(mockDB, testSiteId);

      expect(pages).toHaveLength(1);
      expect(pages[0].status).toBe('published');
    });
  });

  describe('updatePage', () => {
    it('should update page title', async () => {
      const updatedPage = { ...mockPage, title: 'Updated' };
      const mockFirst = vi.fn().mockResolvedValueOnce(mockPage).mockResolvedValueOnce(updatedPage);
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi
        .fn()
        .mockReturnValueOnce({ first: mockFirst })
        .mockReturnValueOnce({ run: mockRun })
        .mockReturnValueOnce({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const updated = await db.updatePage(mockDB, testSiteId, 'page-1', {
        title: 'Updated'
      });

      expect(updated?.title).toBe('Updated');
    });

    it('should return null for non-existent page', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const updated = await db.updatePage(mockDB, testSiteId, 'non-existent', {
        title: 'Updated'
      });

      expect(updated).toBeNull();
    });

    it('should update page slug', async () => {
      const updatedPage = { ...mockPage, slug: '/new-slug' };
      // First call: getPageById for the page being updated
      // Second call: getPageBySlug to check for conflicts (returns null = no conflict)
      // Third call: run the update
      // Fourth call: getPageById for the result
      const mockFirst = vi
        .fn()
        .mockResolvedValueOnce(mockPage) // getPageById
        .mockResolvedValueOnce(null) // getPageBySlug (no conflict)
        .mockResolvedValueOnce(updatedPage); // getPageById after update
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi
        .fn()
        .mockReturnValueOnce({ first: mockFirst }) // getPageById
        .mockReturnValueOnce({ first: mockFirst }) // getPageBySlug
        .mockReturnValueOnce({ run: mockRun }) // update
        .mockReturnValueOnce({ first: mockFirst }); // getPageById after
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const updated = await db.updatePage(mockDB, testSiteId, 'page-1', {
        slug: '/new-slug'
      });

      expect(updated?.slug).toBe('/new-slug');
    });

    it('should throw error when updating to existing slug', async () => {
      const existingPage = { ...mockPage, id: 'page-2', slug: '/existing' };
      const mockFirst = vi
        .fn()
        .mockResolvedValueOnce(mockPage) // getPageById
        .mockResolvedValueOnce(existingPage); // getPageBySlug (conflict found)
      const mockBind = vi
        .fn()
        .mockReturnValueOnce({ first: mockFirst })
        .mockReturnValueOnce({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      await expect(
        db.updatePage(mockDB, testSiteId, 'page-1', { slug: '/existing' })
      ).rejects.toThrow('Page with slug "/existing" already exists');
    });

    it('should update page status', async () => {
      const updatedPage = { ...mockPage, status: 'published' as const };
      const mockFirst = vi.fn().mockResolvedValueOnce(mockPage).mockResolvedValueOnce(updatedPage);
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi
        .fn()
        .mockReturnValueOnce({ first: mockFirst })
        .mockReturnValueOnce({ run: mockRun })
        .mockReturnValueOnce({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const updated = await db.updatePage(mockDB, testSiteId, 'page-1', {
        status: 'published'
      });

      expect(updated?.status).toBe('published');
    });

    it('should update page content', async () => {
      const updatedPage = { ...mockPage, content: 'new content' };
      const mockFirst = vi.fn().mockResolvedValueOnce(mockPage).mockResolvedValueOnce(updatedPage);
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi
        .fn()
        .mockReturnValueOnce({ first: mockFirst })
        .mockReturnValueOnce({ run: mockRun })
        .mockReturnValueOnce({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const updated = await db.updatePage(mockDB, testSiteId, 'page-1', {
        content: 'new content'
      });

      expect(updated?.content).toBe('new content');
    });

    it('should update page colorTheme', async () => {
      const updatedPage = { ...mockPage, colorTheme: 'dark' };
      const mockFirst = vi.fn().mockResolvedValueOnce(mockPage).mockResolvedValueOnce(updatedPage);
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi
        .fn()
        .mockReturnValueOnce({ first: mockFirst })
        .mockReturnValueOnce({ run: mockRun })
        .mockReturnValueOnce({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const updated = await db.updatePage(mockDB, testSiteId, 'page-1', {
        colorTheme: 'dark'
      });

      expect(updated?.colorTheme).toBe('dark');
    });

    it('should update page layout_id', async () => {
      const updatedPage = { ...mockPage, layout_id: 5 };
      const mockFirst = vi.fn().mockResolvedValueOnce(mockPage).mockResolvedValueOnce(updatedPage);
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi
        .fn()
        .mockReturnValueOnce({ first: mockFirst })
        .mockReturnValueOnce({ run: mockRun })
        .mockReturnValueOnce({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const updated = await db.updatePage(mockDB, testSiteId, 'page-1', {
        layout_id: 5
      });

      expect(updated?.layout_id).toBe(5);
    });

    it('should return page unchanged when no updates provided', async () => {
      const mockFirst = vi.fn().mockResolvedValue(mockPage);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const updated = await db.updatePage(mockDB, testSiteId, 'page-1', {});

      expect(updated).toEqual(mockPage);
    });
  });

  describe('deletePage', () => {
    it('should delete a page', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 }, success: true });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const deleted = await db.deletePage(mockDB, testSiteId, 'page-1');
      expect(deleted).toBe(true);
    });

    it('should return false for non-existent page', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 0 }, success: true });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const deleted = await db.deletePage(mockDB, testSiteId, 'non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('Widget Operations', () => {
    describe('createWidget', () => {
      it('should create a text widget', async () => {
        const mockFirst = vi.fn().mockResolvedValue(mockWidget);
        const mockRun = vi.fn().mockResolvedValue({ success: true });
        const mockBind = vi
          .fn()
          .mockReturnValueOnce({ run: mockRun })
          .mockReturnValueOnce({ first: mockFirst });
        const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
        const mockDB = { prepare: mockPrepare } as unknown as D1Database;

        const widgetData: db.CreateWidgetData = {
          type: 'text',
          config: { text: 'Hello', alignment: 'center' },
          position: 0
        };

        const widget = await db.createWidget(mockDB, 'page-1', widgetData);

        expect(widget).toBeDefined();
        expect(widget.type).toBe('text');
      });
    });

    describe('getPageWidgets', () => {
      it('should retrieve all widgets for a page', async () => {
        const mockWidget2 = { ...mockWidget, id: 'widget-2', position: 1 };
        const mockAll = vi.fn().mockResolvedValue({ results: [mockWidget, mockWidget2] });
        const mockBind = vi.fn().mockReturnValue({ all: mockAll });
        const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
        const mockDB = { prepare: mockPrepare } as unknown as D1Database;

        const widgets = await db.getPageWidgets(mockDB, 'page-1');

        expect(widgets).toHaveLength(2);
      });
    });

    describe('updateWidget', () => {
      it('should update widget config', async () => {
        const updatedWidget = { ...mockWidget, config: '{"text":"Updated"}' };
        const mockFirst = vi
          .fn()
          .mockResolvedValueOnce(mockWidget)
          .mockResolvedValueOnce(updatedWidget);
        const mockRun = vi.fn().mockResolvedValue({ success: true });
        const mockBind = vi
          .fn()
          .mockReturnValueOnce({ first: mockFirst })
          .mockReturnValueOnce({ run: mockRun })
          .mockReturnValueOnce({ first: mockFirst });
        const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
        const mockDB = { prepare: mockPrepare } as unknown as D1Database;

        const updated = await db.updateWidget(mockDB, 'widget-1', {
          config: { text: 'Updated' }
        });

        expect(updated).toBeDefined();
        expect(updated!.config).toBe('{"text":"Updated"}');
      });

      it('should return null for non-existent widget', async () => {
        const mockFirst = vi.fn().mockResolvedValue(null);
        const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
        const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
        const mockDB = { prepare: mockPrepare } as unknown as D1Database;

        const updated = await db.updateWidget(mockDB, 'nonexistent', {
          config: { text: 'Test' }
        });

        expect(updated).toBeNull();
      });

      it('should update widget type', async () => {
        const updatedWidget = { ...mockWidget, type: 'image' as const };
        const mockFirst = vi
          .fn()
          .mockResolvedValueOnce(mockWidget)
          .mockResolvedValueOnce(updatedWidget);
        const mockRun = vi.fn().mockResolvedValue({ success: true });
        const mockBind = vi
          .fn()
          .mockReturnValueOnce({ first: mockFirst })
          .mockReturnValueOnce({ run: mockRun })
          .mockReturnValueOnce({ first: mockFirst });
        const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
        const mockDB = { prepare: mockPrepare } as unknown as D1Database;

        const updated = await db.updateWidget(mockDB, 'widget-1', {
          type: 'image'
        });

        expect(updated?.type).toBe('image');
      });

      it('should update widget position', async () => {
        const updatedWidget = { ...mockWidget, position: 5 };
        const mockFirst = vi
          .fn()
          .mockResolvedValueOnce(mockWidget)
          .mockResolvedValueOnce(updatedWidget);
        const mockRun = vi.fn().mockResolvedValue({ success: true });
        const mockBind = vi
          .fn()
          .mockReturnValueOnce({ first: mockFirst })
          .mockReturnValueOnce({ run: mockRun })
          .mockReturnValueOnce({ first: mockFirst });
        const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
        const mockDB = { prepare: mockPrepare } as unknown as D1Database;

        const updated = await db.updateWidget(mockDB, 'widget-1', {
          position: 5
        });

        expect(updated?.position).toBe(5);
      });

      it('should return widget unchanged when no updates provided', async () => {
        const mockFirst = vi.fn().mockResolvedValue(mockWidget);
        const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
        const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
        const mockDB = { prepare: mockPrepare } as unknown as D1Database;

        const updated = await db.updateWidget(mockDB, 'widget-1', {});

        expect(updated).toEqual(mockWidget);
      });
    });

    describe('deleteWidget', () => {
      it('should delete a widget', async () => {
        const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 }, success: true });
        const mockBind = vi.fn().mockReturnValue({ run: mockRun });
        const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
        const mockDB = { prepare: mockPrepare } as unknown as D1Database;

        const deleted = await db.deleteWidget(mockDB, 'widget-1');
        expect(deleted).toBe(true);
      });
    });

    describe('reorderWidgets', () => {
      it('should reorder widgets', async () => {
        const mockRun = vi.fn().mockResolvedValue({ success: true });
        const mockBind = vi.fn().mockReturnValue({ run: mockRun });
        const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
        const mockDB = { prepare: mockPrepare } as unknown as D1Database;

        await db.reorderWidgets(mockDB, 'page-1', ['widget-3', 'widget-2', 'widget-1']);

        expect(mockPrepare).toHaveBeenCalledTimes(3);
      });
    });

    describe('deletePageWidgets', () => {
      it('should delete all widgets for a page', async () => {
        const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 3 }, success: true });
        const mockBind = vi.fn().mockReturnValue({ run: mockRun });
        const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
        const mockDB = { prepare: mockPrepare } as unknown as D1Database;

        const deleted = await db.deletePageWidgets(mockDB, 'page-1');
        expect(deleted).toBe(true);
        expect(mockBind).toHaveBeenCalledWith('page-1');
      });

      it('should return false when no widgets to delete', async () => {
        const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 0 }, success: true });
        const mockBind = vi.fn().mockReturnValue({ run: mockRun });
        const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
        const mockDB = { prepare: mockPrepare } as unknown as D1Database;

        const deleted = await db.deletePageWidgets(mockDB, 'nonexistent-page');
        expect(deleted).toBe(false);
      });
    });
  });

  describe('getAllPagesWithRevisionInfo', () => {
    it('should return enriched pages with revision info', async () => {
      const mockPages = [
        {
          id: 'page-1',
          site_id: testSiteId,
          title: 'Published Page',
          slug: '/published',
          status: 'published' as const,
          published_revision_id: 'rev-pub-1',
          draft_revision_id: null,
          published_at: 1000000,
          draft_at: null,
          created_at: 900000,
          updated_at: 1000000
        },
        {
          id: 'page-2',
          site_id: testSiteId,
          title: 'Draft Only Page',
          slug: '/draft',
          status: 'draft' as const,
          published_revision_id: null,
          draft_revision_id: 'rev-draft-2',
          published_at: null,
          draft_at: 1100000,
          created_at: 1100000,
          updated_at: 1100000
        },
        {
          id: 'page-3',
          site_id: testSiteId,
          title: 'Published with Newer Draft',
          slug: '/mixed',
          status: 'published' as const,
          published_revision_id: 'rev-pub-3',
          draft_revision_id: 'rev-draft-3',
          published_at: 1000000,
          draft_at: 1200000,
          created_at: 900000,
          updated_at: 1200000
        }
      ];

      const mockAll = vi.fn().mockResolvedValue({ results: mockPages });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getAllPagesWithRevisionInfo(mockDB, testSiteId);

      expect(result).toHaveLength(3);

      // Published page with no draft
      expect(result[0].has_unpublished_changes).toBe(false);
      expect(result[0].published_at).toBe(1000000);
      expect(result[0].draft_at).toBe(null);

      // Draft only page
      expect(result[1].has_unpublished_changes).toBe(false);
      expect(result[1].published_at).toBe(null);
      expect(result[1].draft_at).toBe(1100000);

      // Published with newer draft
      expect(result[2].has_unpublished_changes).toBe(true);
      expect(result[2].published_at).toBe(1000000);
      expect(result[2].draft_at).toBe(1200000);
    });

    it('should handle empty results', async () => {
      const mockAll = vi.fn().mockResolvedValue({ results: [] });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getAllPagesWithRevisionInfo(mockDB, testSiteId);

      expect(result).toEqual([]);
    });

    it('should correctly detect unpublished changes when draft is newer', async () => {
      const mockPages = [
        {
          id: 'page-1',
          site_id: testSiteId,
          title: 'Test Page',
          slug: '/test',
          status: 'published' as const,
          published_revision_id: 'rev-pub-1',
          draft_revision_id: 'rev-draft-1',
          published_at: 1000000,
          draft_at: 1500000, // Draft is newer
          created_at: 900000,
          updated_at: 1500000
        }
      ];

      const mockAll = vi.fn().mockResolvedValue({ results: mockPages });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getAllPagesWithRevisionInfo(mockDB, testSiteId);

      expect(result[0].has_unpublished_changes).toBe(true);
    });

    it('should not flag unpublished changes when draft is older', async () => {
      const mockPages = [
        {
          id: 'page-1',
          site_id: testSiteId,
          title: 'Test Page',
          slug: '/test',
          status: 'published' as const,
          published_revision_id: 'rev-pub-1',
          draft_revision_id: 'rev-draft-1',
          published_at: 1500000,
          draft_at: 1000000, // Draft is older
          is_builtin: 0,
          created_at: 900000,
          updated_at: 1500000
        }
      ];

      const mockAll = vi.fn().mockResolvedValue({ results: mockPages });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getAllPagesWithRevisionInfo(mockDB, testSiteId);

      expect(result[0].has_unpublished_changes).toBe(false);
    });

    it('should convert is_builtin from 0/1 to boolean', async () => {
      const mockPages = [
        {
          id: 'builtin-page',
          site_id: testSiteId,
          title: 'Home',
          slug: '/',
          status: 'published' as const,
          published_revision_id: null,
          draft_revision_id: null,
          published_at: null,
          draft_at: null,
          is_builtin: 1, // Database stores as integer
          created_at: 900000,
          updated_at: 1500000
        },
        {
          id: 'custom-page',
          site_id: testSiteId,
          title: 'About',
          slug: '/about',
          status: 'draft' as const,
          published_revision_id: null,
          draft_revision_id: null,
          published_at: null,
          draft_at: null,
          is_builtin: 0, // Database stores as integer
          created_at: 900000,
          updated_at: 1500000
        }
      ];

      const mockAll = vi.fn().mockResolvedValue({ results: mockPages });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getAllPagesWithRevisionInfo(mockDB, testSiteId);

      // Built-in page should have is_builtin as boolean true
      expect(result[0].is_builtin).toBe(true);
      expect(typeof result[0].is_builtin).toBe('boolean');

      // Custom page should have is_builtin as boolean false
      expect(result[1].is_builtin).toBe(false);
      expect(typeof result[1].is_builtin).toBe('boolean');
    });
  });

  describe('Built-in Pages', () => {
    it('getPageById should convert is_builtin to boolean', async () => {
      const mockBuiltInPage = {
        ...mockPage,
        is_builtin: 1 // Database stores as integer
      };

      const mockFirst = vi.fn().mockResolvedValue(mockBuiltInPage);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getPageById(mockDB, testSiteId, 'page-1');

      expect(result).not.toBeNull();
      expect(result!.is_builtin).toBe(true);
      expect(typeof result!.is_builtin).toBe('boolean');
    });

    it('getPageBySlug should convert is_builtin to boolean', async () => {
      const mockBuiltInPage = {
        ...mockPage,
        slug: '/',
        is_builtin: 1 // Database stores as integer
      };

      const mockFirst = vi.fn().mockResolvedValue(mockBuiltInPage);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getPageBySlug(mockDB, testSiteId, '/');

      expect(result).not.toBeNull();
      expect(result!.is_builtin).toBe(true);
      expect(typeof result!.is_builtin).toBe('boolean');
    });

    it('getAllPages should convert is_builtin to boolean for all pages', async () => {
      const mockPages = [
        { ...mockPage, id: 'builtin-page', is_builtin: 1 },
        { ...mockPage, id: 'custom-page', is_builtin: 0 }
      ];

      const mockAll = vi.fn().mockResolvedValue({ results: mockPages });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getAllPages(mockDB, testSiteId);

      expect(result).toHaveLength(2);
      expect(result[0].is_builtin).toBe(true);
      expect(result[1].is_builtin).toBe(false);
      expect(typeof result[0].is_builtin).toBe('boolean');
      expect(typeof result[1].is_builtin).toBe('boolean');
    });

    it('getPublishedPages should convert is_builtin to boolean', async () => {
      const mockPages = [{ ...mockPage, status: 'published' as const, is_builtin: 1 }];

      const mockAll = vi.fn().mockResolvedValue({ results: mockPages });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getPublishedPages(mockDB, testSiteId);

      expect(result).toHaveLength(1);
      expect(result[0].is_builtin).toBe(true);
      expect(typeof result[0].is_builtin).toBe('boolean');
    });
  });

  describe('createPage error branch', () => {
    it('should throw when getPageById returns null after insert', async () => {
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      await expect(
        db.createPage(mockDB, testSiteId, {
          title: 'Test Page',
          slug: '/test-page',
          status: 'draft'
        })
      ).rejects.toThrow('Failed to create page');
    });
  });

  describe('createPageComponent error branch', () => {
    it('should throw when getWidgetById returns null after insert', async () => {
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      await expect(
        db.createPageComponent(mockDB, 'page-1', {
          type: 'text',
          config: { text: 'Hello' },
          position: 0
        })
      ).rejects.toThrow('Failed to create page component');
    });
  });

  describe('getPublishedPages null results fallback', () => {
    it('should return empty array when results is null', async () => {
      const mockAll = vi.fn().mockResolvedValue({ results: null });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getPublishedPages(mockDB, testSiteId);
      expect(result).toEqual([]);
    });
  });

  describe('getPageComponents null results fallback', () => {
    it('should return empty array when results is null', async () => {
      const mockAll = vi.fn().mockResolvedValue({ results: null });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getPageComponents(mockDB, 'page-1');
      expect(result).toEqual([]);
    });
  });

  describe('deletePageComponent meta fallback', () => {
    it('should return false when meta.changes is undefined', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: {} });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.deletePageComponent(mockDB, 'widget-1');
      expect(result).toBe(false);
    });
  });

  describe('getAllPagesWithRevisionInfo hasDifferentRevisions branch', () => {
    it('should set has_unpublished_changes false when revisions are equal', async () => {
      const mockAll = vi.fn().mockResolvedValue({
        results: [
          {
            ...mockPage,
            draft_revision_id: 'rev-same',
            published_revision_id: 'rev-same'
          }
        ]
      });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getAllPagesWithRevisionInfo(mockDB, testSiteId);
      expect(result[0].has_unpublished_changes).toBe(false);
    });
  });

  describe('getWidgetByIdForSite', () => {
    it("joins through pages so only the site's own widgets resolve", async () => {
      const mockFirst = vi.fn().mockResolvedValue(mockWidget);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      const result = await db.getWidgetByIdForSite(mockDB, 'site-1', 'w-1');

      expect(result).toEqual(mockWidget);
      expect(mockPrepare.mock.calls[0][0]).toMatch(/JOIN pages p ON p\.id = pw\.page_id/);
      expect(mockPrepare.mock.calls[0][0]).toMatch(/p\.site_id = \?/);
      expect(mockBind).toHaveBeenCalledWith('w-1', 'site-1');
    });
  });
});
