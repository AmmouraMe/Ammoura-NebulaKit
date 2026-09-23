import { error } from '@sveltejs/kit';
import { getDB } from '$lib/server/db/connection';
import * as pagesDb from '$lib/server/db/pages';
import { getPublishedRevision, getMostRecentDraftRevision } from '$lib/server/db/revisions';
import { getLayout, getLayoutComponents, getDefaultLayout } from '$lib/server/db/layouts';
import { resolveComponentRefs, getComponent } from '$lib/server/db/components';
import { resolveContentRoute } from '$lib/server/db/contentTypes';
import { getContentEntryBySlug, getPublishedEntries } from '$lib/server/db/contentEntries';
import { resolveWidgetBindings } from '$lib/utils/dataBinding';
import { translateComponents } from '$lib/server/i18n/content-translations';
import type { PageServerLoad } from './$types';
import { logPageAction } from '$lib/server/activity-logger';
import type { LayoutWidget, WidgetConfig, PositionConfig, ResponsiveValue } from '$lib/types/pages';
import type { ContentType, ContentEntry } from '$lib/types/contentTypes';

// Layout data structure for page-specific layout overrides
interface PageLayoutData {
  navbar: {
    type: 'navbar';
    config: WidgetConfig;
    position?: ResponsiveValue<PositionConfig>;
  } | null;
  footer: {
    type: 'footer';
    config: WidgetConfig;
    position?: ResponsiveValue<PositionConfig>;
  } | null;
  // Flag to indicate this page has a custom layout (even if it has no navbar/footer)
  hasCustomLayout: boolean;
}

export const load: PageServerLoad = async ({
  params,
  platform,
  locals,
  url,
  getClientAddress,
  request
}) => {
  const db = getDB(platform);
  const siteId = locals.siteId;

  // Construct the full slug path
  const slug = '/' + (params.slug || '');

  // Check if this is a preview request
  const isPreview = url.searchParams.has('preview');

  try {
    // Fetch page by slug
    let page = await pagesDb.getPageBySlug(db, siteId, slug);

    // Track CMS content data if resolved via content routing
    let contentType: ContentType | null = null;
    let contentEntry: ContentEntry | null = null;
    let contentEntries: ContentEntry[] | null = null;
    let isCmsRoute = false;

    // If no page found, try CMS content routing as fallback
    if (!page) {
      const route = await resolveContentRoute(db, siteId, slug);
      if (route) {
        isCmsRoute = true;
        contentType = route.contentType;

        if (route.entrySlug) {
          // Entry page: /base-path/entry-slug
          contentEntry = await getContentEntryBySlug(db, siteId, contentType.id, route.entrySlug);

          if (!contentEntry) {
            throw error(404, 'Content entry not found');
          }

          if (contentEntry.status !== 'published' && !(isPreview && locals.isAdmin)) {
            throw error(404, 'Content entry not found');
          }

          // Use entry's specific page, or fall back to the type's entry template page
          const pageId = contentEntry.pageId || contentType.entryTemplatePageId;
          if (pageId) {
            page = await pagesDb.getPageById(db, siteId, pageId);
          }
        } else {
          // Listing page: /base-path
          if (contentType.listingPageId) {
            page = await pagesDb.getPageById(db, siteId, contentType.listingPageId);
          }

          // Fetch published entries for listing pages
          contentEntries = await getPublishedEntries(db, siteId, contentType.id, {
            limit: 100,
            sortBy: 'published_at',
            sortOrder: 'desc'
          });
        }
      }
    }

    // If still no page after all resolution attempts:
    // For CMS routes, synthesize a minimal page so the entry/listing still renders
    // with the default layout. For non-CMS routes, 404.
    if (!page && isCmsRoute) {
      const now = Math.floor(Date.now() / 1000);
      page = {
        id: `cms-${contentType!.id}`,
        site_id: siteId,
        title: contentEntry ? contentEntry.title : contentType!.name,
        slug,
        status: 'published' as const,
        layout_id: undefined,
        is_builtin: false,
        created_at: now,
        updated_at: now
      };
    }
    if (!page) {
      throw error(404, 'Page not found');
    }

    // TypeScript narrowing: page is guaranteed non-null after the throw above
    const resolvedPage = page;

    // Only show published pages on the frontend, unless it's a preview by an admin
    if (resolvedPage.status !== 'published') {
      if (!isPreview || !locals.isAdmin) {
        throw error(404, 'Page not found');
      }
    }

    // Fetch revision content - use draft for preview, published otherwise
    let revision;
    if (isPreview && locals.isAdmin) {
      // For admin preview, try to get the most recent draft revision
      revision = await getMostRecentDraftRevision(db, siteId, resolvedPage.id);
      // Fall back to published if no draft exists
      if (!revision) {
        revision = await getPublishedRevision(db, siteId, resolvedPage.id);
      }
    } else {
      // For public viewing, always use published revision
      revision = await getPublishedRevision(db, siteId, resolvedPage.id);
    }

    const rawComponents = revision?.components || [];
    const pageProperties = revision?.pageProperties;

    // Resolve component_ref types to actual component types for frontend rendering
    let components = await resolveComponentRefs(db, siteId, rawComponents);

    // Overlay per-locale content translations (no-op for the default locale).
    // Runs before data bindings so bound values land in translated configs.
    components = await translateComponents(
      db,
      siteId,
      locals.locale,
      locals.i18n?.defaultLocale ?? 'en',
      resolvedPage.id,
      components
    );

    // For CMS entry pages, resolve data bindings in widget configs
    if (isCmsRoute && contentEntry) {
      components = resolveWidgetBindings(components, contentEntry.fieldValues);
    }

    // Fetch the layout for this page (use page's layout_id or default layout)
    let layout = null;
    let layoutComponents: LayoutWidget[] = [];
    // Track if this page has a custom layout (not using default)
    const hasCustomLayout = resolvedPage.layout_id !== null && resolvedPage.layout_id !== undefined;

    if (resolvedPage.layout_id) {
      layout = await getLayout(db, siteId, resolvedPage.layout_id);
    } else {
      // Fall back to the site's default layout
      layout = await getDefaultLayout(db, siteId);
    }

    if (layout) {
      layoutComponents = await getLayoutComponents(db, layout.id);
    }

    // Resolve navbar/footer from the page's layout for root layout to use
    const pageLayoutData: PageLayoutData = {
      navbar: null,
      footer: null,
      hasCustomLayout
    };

    // Only process layout data if the page has a custom layout
    // (otherwise let root layout use its default)
    if (hasCustomLayout && layoutComponents.length > 0) {
      for (const widget of layoutComponents) {
        const widgetPosition = widget.config?.position as
          ResponsiveValue<PositionConfig> | undefined;

        // Handle component_ref widgets that reference navbar or footer
        if (widget.type === 'component_ref' && widget.config?.componentId) {
          const component = await getComponent(db, siteId, widget.config.componentId as number);
          if (component) {
            if (component.type === 'navbar') {
              pageLayoutData.navbar = {
                type: 'navbar',
                config: component.config,
                position: widgetPosition
              };
            } else if (component.type === 'footer') {
              pageLayoutData.footer = {
                type: 'footer',
                config: component.config,
                position: widgetPosition
              };
            }
          }
        }
        // Handle direct navbar/footer widgets
        else if (widget.type === 'navbar') {
          pageLayoutData.navbar = {
            type: 'navbar',
            config: widget.config || {},
            position: widgetPosition
          };
        } else if (widget.type === 'footer') {
          pageLayoutData.footer = {
            type: 'footer',
            config: widget.config || {},
            position: widgetPosition
          };
        }
      }
    }

    // Log page view (only for published pages, not previews)
    if (!isPreview && resolvedPage.status === 'published') {
      try {
        await logPageAction(db, {
          siteId,
          userId: locals.currentUser?.id || null,
          action: 'viewed',
          pageId: resolvedPage.id,
          pageName: resolvedPage.title,
          pageUrl: slug,
          ipAddress: getClientAddress(),
          userAgent: request.headers.get('user-agent')
        });
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error('Failed to log page view:', logError);
      }
    }

    // Use the revision's title if available - this ensures draft preview shows draft title
    // and published page shows published title, even if the pages.title has been updated
    let pageWithRevisionTitle = revision?.title
      ? { ...resolvedPage, title: revision.title }
      : resolvedPage;

    // For CMS entry pages, use the entry title instead of the template page title
    if (isCmsRoute && contentEntry) {
      pageWithRevisionTitle = { ...pageWithRevisionTitle, title: contentEntry.title };
    }

    return {
      page: pageWithRevisionTitle,
      components,
      layout,
      layoutComponents,
      colorTheme: resolvedPage.colorTheme || null,
      isPreview: isPreview && locals.isAdmin,
      isAdmin: locals.isAdmin || false,
      currentUser: locals.currentUser || null,
      // Page properties for title display override
      pageShowPageTitle: pageProperties?.showPageTitle,
      // Page-specific layout data for root layout to use
      pageLayoutData,
      // CMS content data (null when not a CMS route)
      contentType: contentType || null,
      contentEntry: contentEntry || null,
      contentEntries: contentEntries || null
    };
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error loading page:', err);
    throw error(500, 'Failed to load page');
  }
};
