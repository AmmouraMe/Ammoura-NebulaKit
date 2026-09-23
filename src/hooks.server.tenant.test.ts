import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

const getUserBySessionToken = vi.fn();

vi.mock('$lib/server/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/server/db')>();
  return {
    ...actual,
    getUserBySessionToken: (...args: unknown[]) => getUserBySessionToken(...args)
  };
});

vi.mock('$lib/server/site-routing', () => ({
  resolveSiteIdForHostname: vi.fn().mockResolvedValue('site-b')
}));

const { handle } = await import('./hooks.server');

function makeEvent(pathname: string, method = 'GET') {
  const db = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] })
      })
    })
  };
  const cookies = {
    get: vi.fn((name: string) => (name === 'user_session' ? 'raw-token' : undefined)),
    delete: vi.fn()
  };
  return {
    event: {
      url: new URL(`https://b.example.com${pathname}`),
      locals: {} as App.Locals,
      cookies,
      request: { method, headers: new Headers() },
      platform: { env: { DB: db } }
    } as unknown as RequestEvent,
    cookies
  };
}

const adminOf = (siteId: string) => ({
  user: { id: 'u1', site_id: siteId, role: 'admin', status: 'active', locale: null },
  session: { id: 's1', user_id: 'u1', site_id: siteId, expires_at: '9999', created_at: '0' }
});

describe('handle: user sessions are bound to their site', () => {
  beforeEach(() => {
    getUserBySessionToken.mockReset();
  });

  it('signs in an admin whose session belongs to the requested site', async () => {
    getUserBySessionToken.mockResolvedValue(adminOf('site-b'));
    const { event } = makeEvent('/');
    const resolve = vi.fn().mockResolvedValue(new Response());

    await handle({ event, resolve });

    expect(event.locals.siteId).toBe('site-b');
    expect(event.locals.isAdmin).toBe(true);
    expect(event.locals.currentUser?.id).toBe('u1');
  });

  it("ignores another tenant's admin session instead of granting admin here", async () => {
    getUserBySessionToken.mockResolvedValue(adminOf('site-a'));
    const { event, cookies } = makeEvent('/');
    const resolve = vi.fn().mockResolvedValue(new Response());

    await handle({ event, resolve });

    expect(event.locals.isAdmin).toBeFalsy();
    expect(event.locals.currentUser).toBeUndefined();
    expect(cookies.delete).not.toHaveBeenCalled();
  });

  it("rejects an owner-only write carrying another tenant's admin session", async () => {
    getUserBySessionToken.mockResolvedValue(adminOf('site-a'));
    const { event } = makeEvent('/api/products', 'DELETE');
    const resolve = vi.fn().mockResolvedValue(new Response());

    const response = await handle({ event, resolve });

    expect(response.status).toBe(401);
    expect(resolve).not.toHaveBeenCalled();
  });
});
