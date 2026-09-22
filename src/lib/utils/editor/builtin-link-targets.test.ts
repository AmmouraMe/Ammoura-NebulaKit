/**
 * Built-in link targets
 *
 * The default navbar and footer ship with links baked into their config. If one
 * of those points at a path nothing serves, every storefront created from the
 * defaults carries a dead link — which is exactly what happened in issue #72,
 * where the footer's Legal section linked to /privacy-policy and
 * /terms-of-service and neither page was ever created.
 *
 * These tests resolve each internal link the way a visitor would: it has to be
 * either a real SvelteKit route on disk, or the slug of a built-in page that
 * gets seeded into every site.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDefaultConfig } from './componentDefaults';
import { BUILTIN_PAGES, LEGAL_BUILTIN_PAGE_SLUGS } from './pageDefaults';
import type { ComponentType } from '$lib/types/pages';

const ROUTES_DIR = path.join(process.cwd(), 'src', 'routes');
const PAGE_FILES = ['+page.svelte', '+page.server.ts', '+page.ts', '+server.ts'];

/**
 * Walk a config object and collect every value stored under a `url` key.
 * Covers linkSections, footerLinks, socialLinks, the logo, and any nested
 * button children, without needing to know the shape of each one.
 */
function collectUrls(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, found);
    return found;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'url' && typeof child === 'string') {
        found.add(child);
      } else {
        collectUrls(child, found);
      }
    }
  }
  return found;
}

/** Links we cannot or should not resolve here. */
function isInternalPath(url: string): boolean {
  if (!url) return false;
  if (url === '#') return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false; // http:, https:, mailto:, tel:
  if (url.startsWith('//')) return false;
  return url.startsWith('/');
}

/** `/#products` and `/cart?open=1` both resolve against `/` and `/cart`. */
function toPathname(url: string): string {
  const withoutHash = url.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  return withoutQuery === '' ? '/' : withoutQuery;
}

/** A real route directory in src/routes with something that serves a page. */
function isStaticRoute(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  const dir = path.join(ROUTES_DIR, ...segments);
  if (!fs.existsSync(dir)) return false;
  return PAGE_FILES.some((file) => fs.existsSync(path.join(dir, file)));
}

/** A built-in page seeded into every site, served by the [...slug] catch-all. */
function isBuiltinPageSlug(pathname: string): boolean {
  return BUILTIN_PAGES.some((page) => page.slug === pathname);
}

function unresolvedLinks(type: ComponentType): string[] {
  const urls = [...collectUrls(getDefaultConfig(type))];
  return urls
    .filter(isInternalPath)
    .map(toPathname)
    .filter((pathname) => !isStaticRoute(pathname) && !isBuiltinPageSlug(pathname));
}

describe('Built-in component link targets', () => {
  it('the footer defaults actually contain internal links to check', () => {
    const urls = [...collectUrls(getDefaultConfig('footer'))].filter(isInternalPath);
    expect(urls.length).toBeGreaterThan(0);
  });

  it('every internal link in the footer defaults resolves to a real page', () => {
    expect(unresolvedLinks('footer')).toEqual([]);
  });

  it('every internal link in the navbar defaults resolves to a real page', () => {
    expect(unresolvedLinks('navbar')).toEqual([]);
  });
});

describe('Built-in legal pages (issue #72)', () => {
  it.each(LEGAL_BUILTIN_PAGE_SLUGS)('%s is a built-in page', (slug) => {
    expect(isBuiltinPageSlug(slug)).toBe(true);
  });

  it('the footer links to both legal pages, so the check above stays meaningful', () => {
    const pathnames = [...collectUrls(getDefaultConfig('footer'))]
      .filter(isInternalPath)
      .map(toPathname);
    for (const slug of LEGAL_BUILTIN_PAGE_SLUGS) {
      expect(pathnames).toContain(slug);
    }
  });

  it('each legal page has a title, a published-ready widget tree, and names the store', () => {
    for (const slug of LEGAL_BUILTIN_PAGE_SLUGS) {
      const definition = BUILTIN_PAGES.find((page) => page.slug === slug);
      expect(definition).toBeDefined();
      expect(definition!.title.length).toBeGreaterThan(0);

      const widgets = definition!.getWidgets();
      expect(widgets.length).toBeGreaterThan(0);

      // The tenant's own name, not another tenant's, and not a hardcoded one.
      const serialised = JSON.stringify(widgets);
      expect(serialised).toContain('${site.name}');
      // Neither the old codename nor the platform's own name belongs in a
      // tenant's builtin content.
      expect(serialised).not.toContain('Hermes');
      expect(serialised).not.toContain('Ammoura');
    }
  });

  it('every widget in a legal page has a stable id so translations can key off it', () => {
    const ids = new Set<string>();
    for (const slug of LEGAL_BUILTIN_PAGE_SLUGS) {
      const definition = BUILTIN_PAGES.find((page) => page.slug === slug)!;
      const walk = (widgets: { id: string; config?: Record<string, unknown> }[]): void => {
        for (const widget of widgets) {
          expect(widget.id).toBeTruthy();
          expect(ids.has(widget.id)).toBe(false);
          ids.add(widget.id);
          const children = widget.config?.children;
          if (Array.isArray(children)) {
            walk(children as { id: string; config?: Record<string, unknown> }[]);
          }
        }
      };
      walk(definition.getWidgets());
    }
  });
});
