import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './+server';
import type { RequestHandler } from './$types';
import type { DBUser } from '$lib/server/db/users';

type ExtractRequestEvent<T> = T extends (event: infer E) => unknown ? E : never;
type MockRequestEvent = ExtractRequestEvent<RequestHandler>;

/**
 * The media bucket is one namespace shared by every tenant, and this route is
 * public. These tests pin the only thing that keeps site A's files away from
 * site B: the site-id prefix on the key.
 */
describe('GET /api/media/[...path]', () => {
  const bucketGet = vi.fn();

  function event(path: string, siteId: string, role?: string): Partial<MockRequestEvent> {
    return {
      params: { path },
      platform: {
        env: {
          DB: {} as D1Database,
          MEDIA_BUCKET: { get: bucketGet } as unknown as R2Bucket
        },
        context: {} as ExecutionContext,
        caches: {} as CacheStorage & { default: Cache }
      },
      // The route reads siteId and currentUser only. The rest of Locals is
      // request plumbing this handler never touches, so it is stubbed out.
      locals: {
        siteId,
        locale: 'en',
        i18n: { defaultLocale: 'en', enabledLocales: ['en'] },
        isAdmin: false,
        currentUser: role ? ({ id: 'u1', role } as DBUser) : undefined
      } as unknown as App.Locals
    };
  }

  function call(e: Partial<MockRequestEvent>) {
    return (GET as unknown as (e: Partial<MockRequestEvent>) => Promise<Response>)(e);
  }

  beforeEach(() => {
    bucketGet.mockReset();
    bucketGet.mockResolvedValue({
      body: 'bytes',
      httpMetadata: { contentType: 'image/png' },
      httpEtag: '"abc"'
    });
  });

  it('serves a key belonging to the resolved site', async () => {
    const res = await call(event('site-a/images/1-x.png', 'site-a'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(bucketGet).toHaveBeenCalledWith('site-a/images/1-x.png');
  });

  it('refuses another site’s key without touching the bucket', async () => {
    await expect(call(event('site-b/images/1-x.png', 'site-a'))).rejects.toMatchObject({
      status: 404
    });
    expect(bucketGet).not.toHaveBeenCalled();
  });

  it('is not fooled by a site id that is only a prefix of another', async () => {
    await expect(call(event('site-abc/images/1-x.png', 'site-a'))).rejects.toMatchObject({
      status: 404
    });
    expect(bucketGet).not.toHaveBeenCalled();
  });

  it('refuses a key with no site prefix at all', async () => {
    await expect(call(event('orphan.png', 'site-a'))).rejects.toMatchObject({ status: 404 });
    expect(bucketGet).not.toHaveBeenCalled();
  });

  it('lets a platform engineer read across sites', async () => {
    const res = await call(event('site-b/images/1-x.png', 'site-a', 'platform_engineer'));

    expect(res.status).toBe(200);
    expect(bucketGet).toHaveBeenCalledWith('site-b/images/1-x.png');
  });

  it('does not let an ordinary site admin read across sites', async () => {
    await expect(call(event('site-b/images/1-x.png', 'site-a', 'admin'))).rejects.toMatchObject({
      status: 404
    });
    expect(bucketGet).not.toHaveBeenCalled();
  });

  it('still 404s a missing key inside the site', async () => {
    bucketGet.mockResolvedValue(null);

    await expect(call(event('site-a/images/gone.png', 'site-a'))).rejects.toMatchObject({
      status: 404
    });
  });
});
