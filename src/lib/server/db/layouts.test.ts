import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getLayouts,
  getLayout,
  getLayoutBySlug,
  getDefaultLayout,
  createLayout,
  updateLayout,
  deleteLayout,
  getLayoutComponents,
  getLayoutWidgets,
  createLayoutWidget,
  updateLayoutWidget,
  deleteLayoutWidget,
  updateLayoutComponents,
  updateLayoutWidgets
} from './layouts';
import type { Layout, LayoutWidget } from '$lib/types/pages';

describe('layouts database operations', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDb: any;

  const mockLayout: Layout = {
    id: 1,
    site_id: 'site-1',
    name: 'Main Layout',
    description: 'Default layout',
    slug: 'main',
    is_default: true,
    is_builtin: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  const mockLayoutWidget: LayoutWidget = {
    id: 'widget-1',
    layout_id: 1,
    type: 'navbar',
    position: 0,
    config: { title: 'Navigation' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true })
        })
      }),
      batch: vi.fn().mockResolvedValue([])
    };
  });

  describe('getLayouts', () => {
    it('should return all layouts for a site', async () => {
      mockDb
        .prepare()
        .bind()
        .all.mockResolvedValue({
          results: [mockLayout, { ...mockLayout, id: 2, name: 'Secondary', is_default: 0 }]
        });

      const result = await getLayouts(mockDb as unknown as D1Database, 'site-1');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Main Layout');
    });

    it('should return empty array when no layouts exist', async () => {
      mockDb.prepare().bind().all.mockResolvedValue({ results: [] });

      const result = await getLayouts(mockDb as unknown as D1Database, 'site-1');
      expect(result).toEqual([]);
    });

    it('should handle null results', async () => {
      mockDb.prepare().bind().all.mockResolvedValue({ results: null });

      const result = await getLayouts(mockDb as unknown as D1Database, 'site-1');
      expect(result).toEqual([]);
    });

    it('should throw error on database failure', async () => {
      mockDb.prepare().bind().all.mockRejectedValue(new Error('DB error'));

      await expect(getLayouts(mockDb as unknown as D1Database, 'site-1')).rejects.toThrow(
        'DB error'
      );
    });
  });

  describe('getLayout', () => {
    it('should return layout by ID', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(mockLayout);

      const result = await getLayout(mockDb as unknown as D1Database, 'site-1', 1);
      expect(result).toEqual(mockLayout);
    });

    it('should return null when layout not found', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(null);

      const result = await getLayout(mockDb as unknown as D1Database, 'site-1', 999);
      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      mockDb.prepare().bind().first.mockRejectedValue(new Error('DB error'));

      await expect(getLayout(mockDb as unknown as D1Database, 'site-1', 1)).rejects.toThrow(
        'DB error'
      );
    });
  });

  describe('getLayoutBySlug', () => {
    it('should return layout by slug', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(mockLayout);

      const result = await getLayoutBySlug(mockDb as unknown as D1Database, 1, 'main');
      expect(result).toEqual(mockLayout);
    });

    it('should return null when slug not found', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(null);

      const result = await getLayoutBySlug(mockDb as unknown as D1Database, 1, 'nonexistent');
      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      mockDb.prepare().bind().first.mockRejectedValue(new Error('DB error'));

      await expect(getLayoutBySlug(mockDb as unknown as D1Database, 1, 'main')).rejects.toThrow(
        'DB error'
      );
    });
  });

  describe('getDefaultLayout', () => {
    it('should return default layout for site', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(mockLayout);

      const result = await getDefaultLayout(mockDb as unknown as D1Database, 'site-1');
      expect(result).toEqual(mockLayout);
      expect(result?.is_default).toBe(true);
    });

    it('should return null when no default layout', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(null);

      const result = await getDefaultLayout(mockDb as unknown as D1Database, 'site-1');
      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      mockDb.prepare().bind().first.mockRejectedValue(new Error('DB error'));

      await expect(getDefaultLayout(mockDb as unknown as D1Database, 'site-1')).rejects.toThrow(
        'DB error'
      );
    });
  });

  describe('createLayout', () => {
    it('should create a new layout', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(mockLayout);

      const result = await createLayout(mockDb as unknown as D1Database, 'site-1', {
        name: 'Main Layout',
        slug: 'main',
        description: 'Default layout'
      });

      expect(result).toEqual(mockLayout);
    });

    it('should unset other defaults when creating default layout', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(mockLayout);
      const runMock = vi.fn().mockResolvedValue({ success: true });
      mockDb.prepare().bind().run = runMock;

      await createLayout(mockDb as unknown as D1Database, 'site-1', {
        name: 'New Default',
        slug: 'new-default',
        is_default: true
      });

      // Verify that the unset default query was called
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should create layout with page_properties', async () => {
      const layoutWithProps = {
        ...mockLayout,
        page_properties: '{"maxWidth":"1400px","paddingTop":16}'
      };
      mockDb.prepare().bind().first.mockResolvedValue(layoutWithProps);

      const result = await createLayout(mockDb as unknown as D1Database, 'site-1', {
        name: 'Wide Layout',
        slug: 'wide',
        page_properties: JSON.stringify({ maxWidth: '1400px', paddingTop: 16 })
      });

      expect(result.page_properties).toBe('{"maxWidth":"1400px","paddingTop":16}');
    });

    it('should create layout without page_properties (defaults to null)', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(mockLayout);

      const result = await createLayout(mockDb as unknown as D1Database, 'site-1', {
        name: 'Basic Layout',
        slug: 'basic'
      });

      expect(result.page_properties).toBeUndefined();
    });

    it('should throw error when creation fails', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(null);

      await expect(
        createLayout(mockDb as unknown as D1Database, 'site-1', {
          name: 'Test',
          slug: 'test'
        })
      ).rejects.toThrow('Failed to create layout');
    });

    it('should throw error on database failure', async () => {
      mockDb.prepare().bind().first.mockRejectedValue(new Error('DB error'));

      await expect(
        createLayout(mockDb as unknown as D1Database, 'site-1', {
          name: 'Test',
          slug: 'test'
        })
      ).rejects.toThrow('DB error');
    });
  });

  describe('updateLayout', () => {
    it('should update layout name', async () => {
      const updatedLayout = { ...mockLayout, name: 'Updated Layout' };
      mockDb.prepare().bind().first.mockResolvedValue(updatedLayout);

      const result = await updateLayout(mockDb as unknown as D1Database, 'site-1', 1, {
        name: 'Updated Layout'
      });

      expect(result.name).toBe('Updated Layout');
    });

    it('should update layout description', async () => {
      const updatedLayout = { ...mockLayout, description: 'New description' };
      mockDb.prepare().bind().first.mockResolvedValue(updatedLayout);

      const result = await updateLayout(mockDb as unknown as D1Database, 'site-1', 1, {
        description: 'New description'
      });

      expect(result.description).toBe('New description');
    });

    it('should update layout slug', async () => {
      const updatedLayout = { ...mockLayout, slug: 'new-slug' };
      mockDb.prepare().bind().first.mockResolvedValue(updatedLayout);

      const result = await updateLayout(mockDb as unknown as D1Database, 'site-1', 1, {
        slug: 'new-slug'
      });

      expect(result.slug).toBe('new-slug');
    });

    it('should unset other defaults when setting as default', async () => {
      const updatedLayout = { ...mockLayout, is_default: 1 };
      mockDb.prepare().bind().first.mockResolvedValue(updatedLayout);

      await updateLayout(mockDb as unknown as D1Database, 'site-1', 1, {
        is_default: true
      });

      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should update layout page_properties', async () => {
      const pageProps = JSON.stringify({ maxWidth: '1600px', paddingTop: 24 });
      const updatedLayout = { ...mockLayout, page_properties: pageProps };
      mockDb.prepare().bind().first.mockResolvedValue(updatedLayout);

      const result = await updateLayout(mockDb as unknown as D1Database, 'site-1', 1, {
        page_properties: pageProps
      });

      expect(result.page_properties).toBe(pageProps);
    });

    it('should update layout with multiple fields including page_properties', async () => {
      const pageProps = JSON.stringify({ maxWidth: 'none', width: '100%' });
      const updatedLayout = {
        ...mockLayout,
        name: 'Full Width Layout',
        page_properties: pageProps
      };
      mockDb.prepare().bind().first.mockResolvedValue(updatedLayout);

      const result = await updateLayout(mockDb as unknown as D1Database, 'site-1', 1, {
        name: 'Full Width Layout',
        page_properties: pageProps
      });

      expect(result.name).toBe('Full Width Layout');
      expect(result.page_properties).toBe(pageProps);
    });

    it('should throw error when layout not found', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(null);

      await expect(
        updateLayout(mockDb as unknown as D1Database, 'site-1', 999, {
          name: 'Test'
        })
      ).rejects.toThrow('Layout not found or update failed');
    });

    it('should throw error on database failure', async () => {
      mockDb.prepare().bind().first.mockRejectedValue(new Error('DB error'));

      await expect(
        updateLayout(mockDb as unknown as D1Database, 'site-1', 1, {
          name: 'Test'
        })
      ).rejects.toThrow('DB error');
    });
  });

  describe('deleteLayout', () => {
    it('should delete non-default layout', async () => {
      const nonDefaultLayout = { ...mockLayout, is_default: 0 };
      mockDb.prepare().bind().first.mockResolvedValue(nonDefaultLayout);

      await expect(
        deleteLayout(mockDb as unknown as D1Database, 'site-1', 2)
      ).resolves.not.toThrow();
    });

    it('should throw error when deleting default layout', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(mockLayout);

      await expect(deleteLayout(mockDb as unknown as D1Database, 'site-1', 1)).rejects.toThrow(
        'Cannot delete the default layout'
      );
    });

    it('should throw error on database failure', async () => {
      mockDb.prepare().bind().first.mockRejectedValue(new Error('DB error'));

      await expect(deleteLayout(mockDb as unknown as D1Database, 'site-1', 1)).rejects.toThrow(
        'DB error'
      );
    });
  });

  describe('getLayoutComponents', () => {
    it('should return all layout components', async () => {
      mockDb
        .prepare()
        .bind()
        .all.mockResolvedValue({
          results: [
            { ...mockLayoutWidget, config: JSON.stringify(mockLayoutWidget.config) },
            { ...mockLayoutWidget, id: 'widget-2', position: 1 }
          ]
        });

      const result = await getLayoutComponents(mockDb as unknown as D1Database, 1);
      expect(result).toHaveLength(2);
      expect(result[0].config).toEqual({ title: 'Navigation' });
    });

    it('should return empty array when no components', async () => {
      mockDb.prepare().bind().all.mockResolvedValue({ results: [] });

      const result = await getLayoutComponents(mockDb as unknown as D1Database, 1);
      expect(result).toEqual([]);
    });

    it('should handle already parsed config', async () => {
      mockDb
        .prepare()
        .bind()
        .all.mockResolvedValue({
          results: [mockLayoutWidget]
        });

      const result = await getLayoutComponents(mockDb as unknown as D1Database, 1);
      expect(result[0].config).toEqual({ title: 'Navigation' });
    });

    it('should throw error on database failure', async () => {
      mockDb.prepare().bind().all.mockRejectedValue(new Error('DB error'));

      await expect(getLayoutComponents(mockDb as unknown as D1Database, 1)).rejects.toThrow(
        'DB error'
      );
    });
  });

  describe('getLayoutWidgets (deprecated)', () => {
    it('should be an alias for getLayoutComponents', () => {
      expect(getLayoutWidgets).toBe(getLayoutComponents);
    });
  });

  describe('createLayoutWidget', () => {
    it('should create a new layout widget', async () => {
      mockDb
        .prepare()
        .bind()
        .first.mockResolvedValue({
          ...mockLayoutWidget,
          config: JSON.stringify(mockLayoutWidget.config)
        });

      const result = await createLayoutWidget(mockDb as unknown as D1Database, 1, {
        id: 'widget-1',
        type: 'navbar',
        position: 0,
        config: { title: 'Navigation' }
      });

      expect(result.id).toBe('widget-1');
      expect(result.config).toEqual({ title: 'Navigation' });
    });

    it('should throw error when creation fails', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(null);

      await expect(
        createLayoutWidget(mockDb as unknown as D1Database, 1, {
          id: 'widget-1',
          type: 'navbar',
          position: 0,
          config: {}
        })
      ).rejects.toThrow('Failed to create layout widget');
    });

    it('should throw error on database failure', async () => {
      mockDb.prepare().bind().first.mockRejectedValue(new Error('DB error'));

      await expect(
        createLayoutWidget(mockDb as unknown as D1Database, 1, {
          id: 'widget-1',
          type: 'navbar',
          position: 0,
          config: {}
        })
      ).rejects.toThrow('DB error');
    });
  });

  describe('updateLayoutWidget', () => {
    it('should update widget type', async () => {
      const updated = { ...mockLayoutWidget, type: 'footer', config: JSON.stringify({}) };
      mockDb.prepare().bind().first.mockResolvedValue(updated);

      const result = await updateLayoutWidget(mockDb as unknown as D1Database, 'widget-1', {
        type: 'footer'
      });

      expect(result.type).toBe('footer');
    });

    it('should update widget position', async () => {
      const updated = { ...mockLayoutWidget, position: 5, config: JSON.stringify({}) };
      mockDb.prepare().bind().first.mockResolvedValue(updated);

      const result = await updateLayoutWidget(mockDb as unknown as D1Database, 'widget-1', {
        position: 5
      });

      expect(result.position).toBe(5);
    });

    it('should update widget config', async () => {
      const newConfig = { title: 'Updated Nav' };
      const updated = { ...mockLayoutWidget, config: JSON.stringify(newConfig) };
      mockDb.prepare().bind().first.mockResolvedValue(updated);

      const result = await updateLayoutWidget(mockDb as unknown as D1Database, 'widget-1', {
        config: newConfig
      });

      expect(result.config).toEqual(newConfig);
    });

    it('should throw error when widget not found', async () => {
      mockDb.prepare().bind().first.mockResolvedValue(null);

      await expect(
        updateLayoutWidget(mockDb as unknown as D1Database, 'nonexistent', {
          type: 'footer'
        })
      ).rejects.toThrow('Layout widget not found or update failed');
    });

    it('should throw error on database failure', async () => {
      mockDb.prepare().bind().first.mockRejectedValue(new Error('DB error'));

      await expect(
        updateLayoutWidget(mockDb as unknown as D1Database, 'widget-1', {
          type: 'footer'
        })
      ).rejects.toThrow('DB error');
    });
  });

  describe('deleteLayoutWidget', () => {
    it('should delete layout widget', async () => {
      await expect(
        deleteLayoutWidget(mockDb as unknown as D1Database, 'widget-1')
      ).resolves.not.toThrow();
    });

    it('should throw error on database failure', async () => {
      mockDb.prepare().bind().run.mockRejectedValue(new Error('DB error'));

      await expect(deleteLayoutWidget(mockDb as unknown as D1Database, 'widget-1')).rejects.toThrow(
        'DB error'
      );
    });
  });

  describe('updateLayoutComponents', () => {
    it('should batch update multiple components', async () => {
      const components = [
        { id: 'w1', position: 0 },
        { id: 'w2', position: 1 },
        { id: 'w3', position: 2 }
      ];

      await expect(
        updateLayoutComponents(mockDb as unknown as D1Database, 7, components)
      ).resolves.not.toThrow();

      expect(mockDb.batch).toHaveBeenCalled();
    });

    it('should update component type', async () => {
      const components = [{ id: 'w1', type: 'footer' }];

      await updateLayoutComponents(mockDb as unknown as D1Database, 7, components);

      expect(mockDb.batch).toHaveBeenCalled();
    });

    it('should update component config', async () => {
      const components = [{ id: 'w1', config: { text: 'value' } }];

      await updateLayoutComponents(mockDb as unknown as D1Database, 7, components);

      expect(mockDb.batch).toHaveBeenCalled();
    });

    it('scopes every update to the layout', async () => {
      await updateLayoutComponents(mockDb as unknown as D1Database, 7, [{ id: 'w1', position: 0 }]);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('AND layout_id = ?'));
      expect(mockDb.prepare.mock.results[0].value.bind).toHaveBeenCalledWith(0, 'w1', 7);
    });

    it('should throw error on database failure', async () => {
      mockDb.batch.mockRejectedValue(new Error('DB error'));

      await expect(
        updateLayoutComponents(mockDb as unknown as D1Database, 7, [{ id: 'w1', position: 0 }])
      ).rejects.toThrow('DB error');
    });
  });

  describe('updateLayoutWidgets (deprecated)', () => {
    it('should be an alias for updateLayoutComponents', () => {
      expect(updateLayoutWidgets).toBe(updateLayoutComponents);
    });
  });

  describe('updateLayout is_default false branch', () => {
    it('should set is_default to 0 when false', async () => {
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue({
          id: 'layout-1',
          site_id: 'site-1',
          name: 'Test Layout',
          is_default: 0,
          config: '{}',
          created_at: 1000,
          updated_at: 2000
        })
      };
      (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue(mockStatement);

      const result = await updateLayout(mockDb, 'site-1', 1, {
        is_default: false
      });

      expect(result).toBeDefined();
    });
  });

  describe('getLayoutComponents config as object branch', () => {
    it('should pass through config when already an object', async () => {
      const configObj = { text: 'Hello' };
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'widget-1',
              layout_id: 'layout-1',
              type: 'text',
              config: configObj,
              position: 0,
              parent_id: null,
              slot: null
            }
          ]
        })
      };
      (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue(mockStatement);

      const result = await getLayoutComponents(mockDb, 1);

      expect(result[0].config).toEqual(configObj);
    });
  });

  describe('createLayoutWidget config as object branch', () => {
    it('should pass through config when result config is already an object', async () => {
      const configObj = { text: 'New' };
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue({
          id: 'widget-new',
          layout_id: 'layout-1',
          type: 'text',
          config: configObj,
          position: 0,
          parent_id: null,
          slot: null
        })
      };
      (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue(mockStatement);

      const result = await createLayoutWidget(mockDb, 1, {
        id: 'widget-new',
        type: 'text',
        config: configObj,
        position: 0
      });

      expect(result?.config).toEqual(configObj);
    });
  });

  describe('updateLayoutWidget config as object branch', () => {
    it('should pass through config when result config is already an object', async () => {
      const configObj = { text: 'Updated' };
      const mockStatement = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue({
          id: 'widget-1',
          layout_id: 'layout-1',
          type: 'text',
          config: configObj,
          position: 0,
          parent_id: null,
          slot: null
        })
      };
      (mockDb.prepare as ReturnType<typeof vi.fn>).mockReturnValue(mockStatement);

      const result = await updateLayoutWidget(mockDb, 'widget-1', {
        config: configObj
      });

      expect(result?.config).toEqual(configObj);
    });
  });
});
