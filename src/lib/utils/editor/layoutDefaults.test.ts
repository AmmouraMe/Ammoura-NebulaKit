import { describe, it, expect } from 'vitest';
import {
  getDefaultLayoutWidgets,
  getMinimalLayoutWidgets,
  getHeaderOnlyLayoutWidgets,
  getBuiltinLayoutWidgets,
  BUILTIN_LAYOUTS
} from './layoutDefaults';

describe('layoutDefaults', () => {
  describe('getDefaultLayoutWidgets', () => {
    it('should return widgets with navbar, yield, and footer', () => {
      const widgets = getDefaultLayoutWidgets();
      expect(widgets).toHaveLength(3);
      expect(widgets[0].type).toBe('navbar');
      expect(widgets[1].type).toBe('yield');
      expect(widgets[2].type).toBe('footer');
    });

    it('should have sequential positions', () => {
      const widgets = getDefaultLayoutWidgets();
      expect(widgets[0].position).toBe(0);
      expect(widgets[1].position).toBe(1);
      expect(widgets[2].position).toBe(2);
    });

    it('should generate deterministic IDs with layout slug', () => {
      const widgets = getDefaultLayoutWidgets();
      expect(widgets[0].id).toBe('default-navbar-0');
      expect(widgets[1].id).toBe('default-yield-1');
      expect(widgets[2].id).toBe('default-footer-2');
    });

    it('should have componentId null for navbar and footer configs', () => {
      const widgets = getDefaultLayoutWidgets();
      expect(widgets[0].config).toEqual({ componentId: null });
      expect(widgets[2].config).toEqual({ componentId: null });
    });

    it('should have empty config for yield widget', () => {
      const widgets = getDefaultLayoutWidgets();
      expect(widgets[1].config).toEqual({});
    });
  });

  describe('getMinimalLayoutWidgets', () => {
    it('should return only a yield widget', () => {
      const widgets = getMinimalLayoutWidgets();
      expect(widgets).toHaveLength(1);
      expect(widgets[0].type).toBe('yield');
    });

    it('should use minimal slug in ID', () => {
      const widgets = getMinimalLayoutWidgets();
      expect(widgets[0].id).toBe('minimal-yield-0');
    });

    it('should have position 0', () => {
      const widgets = getMinimalLayoutWidgets();
      expect(widgets[0].position).toBe(0);
    });

    it('should have empty config', () => {
      const widgets = getMinimalLayoutWidgets();
      expect(widgets[0].config).toEqual({});
    });
  });

  describe('getHeaderOnlyLayoutWidgets', () => {
    it('should return navbar and yield widgets (no footer)', () => {
      const widgets = getHeaderOnlyLayoutWidgets();
      expect(widgets).toHaveLength(2);
      expect(widgets[0].type).toBe('navbar');
      expect(widgets[1].type).toBe('yield');
    });

    it('should use header-only slug in IDs', () => {
      const widgets = getHeaderOnlyLayoutWidgets();
      expect(widgets[0].id).toBe('header-only-navbar-0');
      expect(widgets[1].id).toBe('header-only-yield-1');
    });

    it('should have sequential positions', () => {
      const widgets = getHeaderOnlyLayoutWidgets();
      expect(widgets[0].position).toBe(0);
      expect(widgets[1].position).toBe(1);
    });

    it('should have componentId null for navbar config', () => {
      const widgets = getHeaderOnlyLayoutWidgets();
      expect(widgets[0].config).toEqual({ componentId: null });
    });
  });

  describe('BUILTIN_LAYOUTS', () => {
    it('offers the default layout and the minimal one', () => {
      // `minimal` was enabled for the coming-soon holding page, which must not
      // wear the site's navbar and footer: while the gate is up every link in
      // them answers 503.
      expect(BUILTIN_LAYOUTS.map((layout) => layout.slug)).toEqual(['default', 'minimal']);
    });

    it('has exactly one default, or a new site does not know what to use', () => {
      expect(BUILTIN_LAYOUTS.filter((layout) => layout.isDefault)).toHaveLength(1);
    });

    it('keeps the default layout first and unchanged', () => {
      expect(BUILTIN_LAYOUTS[0].slug).toBe('default');
      expect(BUILTIN_LAYOUTS[0].name).toBe('Default Layout');
      expect(BUILTIN_LAYOUTS[0].isDefault).toBe(true);
    });

    it('should reference getDefaultLayoutWidgets', () => {
      const result = BUILTIN_LAYOUTS[0].getWidgets();
      const expected = getDefaultLayoutWidgets();
      expect(result).toEqual(expected);
    });

    it('gives the minimal layout nothing but a yield', () => {
      // A navbar or footer creeping in here would silently put the site's
      // chrome back on the holding page.
      const widgets = getBuiltinLayoutWidgets('minimal');
      expect(widgets?.map((widget) => widget.type)).toEqual(['yield']);
    });
  });

  describe('getBuiltinLayoutWidgets', () => {
    it('should return widgets for existing layout slug', () => {
      const widgets = getBuiltinLayoutWidgets('default');
      expect(widgets).not.toBeNull();
      expect(widgets).toEqual(getDefaultLayoutWidgets());
    });

    it('should return null for non-existent layout slug', () => {
      const widgets = getBuiltinLayoutWidgets('nonexistent');
      expect(widgets).toBeNull();
    });

    it('should return null for empty string slug', () => {
      const widgets = getBuiltinLayoutWidgets('');
      expect(widgets).toBeNull();
    });
  });
});
