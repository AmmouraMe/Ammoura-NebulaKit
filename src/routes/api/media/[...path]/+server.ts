import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Every media key is written with the owning site as its first path segment —
 * `${siteId}/images/…` (api/media/upload) and `${siteId}/designs/…`
 * (api/products/[id]/design-upload). This route is public by design, because
 * product photos must load for anonymous storefront visitors, so the site
 * prefix is the only thing that separates one tenant's files from another's.
 *
 * Reject a key that does not belong to the site this request resolved to. A
 * platform engineer works across sites, so they are exempt.
 */
function mayRead(path: string, siteId: string | undefined, role: string | undefined): boolean {
  if (role === 'platform_engineer') {
    return true;
  }
  if (!siteId) {
    return false;
  }
  return path === siteId || path.startsWith(`${siteId}/`);
}

/**
 * GET media file from R2
 */
export const GET: RequestHandler = async ({ params, platform, locals }) => {
  if (!platform?.env?.MEDIA_BUCKET) {
    throw error(503, 'Storage not available');
  }

  try {
    const path = params.path;

    // 404, not 403: a refusal that says "this exists" is a key oracle.
    if (!mayRead(path, locals.siteId, locals.currentUser?.role)) {
      throw error(404, 'Media not found');
    }

    const object = await platform.env.MEDIA_BUCKET.get(path);

    if (!object) {
      throw error(404, 'Media not found');
    }

    const headers = new Headers();

    // Manually set headers instead of using writeHttpMetadata to avoid serialization issues
    if (object.httpMetadata?.contentType) {
      headers.set('content-type', object.httpMetadata.contentType);
    }
    if (object.httpMetadata?.contentLanguage) {
      headers.set('content-language', object.httpMetadata.contentLanguage);
    }
    if (object.httpMetadata?.contentDisposition) {
      headers.set('content-disposition', object.httpMetadata.contentDisposition);
    }
    if (object.httpMetadata?.contentEncoding) {
      headers.set('content-encoding', object.httpMetadata.contentEncoding);
    }
    if (object.httpMetadata?.cacheControl) {
      headers.set('cache-control', object.httpMetadata.cacheControl);
    } else {
      headers.set('cache-control', 'public, max-age=31536000, immutable');
    }
    if (object.httpMetadata?.cacheExpiry) {
      headers.set('expires', new Date(object.httpMetadata.cacheExpiry).toUTCString());
    }

    headers.set('etag', object.httpEtag);

    return new Response(object.body, {
      headers
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Error serving media:', err);
    throw error(500, 'Failed to serve media');
  }
};
