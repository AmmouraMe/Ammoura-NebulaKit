import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DBUser } from '$lib/server/db/users';

/**
 * Both user-edit forms (`/admin/users/[id]/edit` and the settings copy under
 * `/admin/settings/admin-users`) run against the real permission helpers here,
 * so a tenant admin cannot mint a platform engineer or grant themselves
 * permissions through a second account.
 */

const getUserById = vi.fn();
const updateUser = vi.fn();

vi.mock('$lib/server/db', () => ({
  getDB: vi.fn(() => ({})),
  getUserById: (...a: unknown[]) => getUserById(...a)
}));
vi.mock('$lib/server/db/users', () => ({
  updateUser: (...a: unknown[]) => updateUser(...a)
}));
vi.mock('$lib/server/db/activity-logs', () => ({ createActivityLog: vi.fn() }));

const pages = {
  '/admin/users': await import('./[userId]/edit/+page.server'),
  '/admin/settings/admin-users': await import('../settings/admin-users/[userId]/edit/+page.server')
};

const makeUser = (overrides: Partial<DBUser> = {}): DBUser => ({
  id: 'actor',
  site_id: 'site-1',
  email: 'actor@example.com',
  name: 'Actor',
  password_hash: 'hash',
  role: 'admin',
  permissions: '[]',
  status: 'active',
  expiration_date: null,
  grace_period_days: 0,
  last_login_at: null,
  last_login_ip: null,
  created_at: 0,
  updated_at: 0,
  created_by: null,
  updated_by: null,
  ...overrides
});

function submit(
  page: (typeof pages)[keyof typeof pages],
  currentUser: DBUser,
  fields: Record<string, string>
) {
  const form = new FormData();
  const all = { email: 't@example.com', name: 'Target', role: 'user', status: 'active', ...fields };
  for (const [k, v] of Object.entries(all)) form.set(k, v);
  return page.actions.default({
    request: new Request('https://shop.example.com/', { method: 'POST', body: form }),
    platform: { env: {} },
    locals: { siteId: 'site-1', currentUser },
    params: { userId: 'target' }
  } as never);
}

async function outcome(p: unknown) {
  try {
    return await p;
  } catch (e) {
    return e;
  }
}

describe.each(Object.entries(pages))('%s edit action', (_name, page) => {
  beforeEach(() => {
    getUserById.mockReset().mockResolvedValue(makeUser({ id: 'target', role: 'user' }));
    updateUser.mockReset();
  });

  it('refuses to promote a user to platform_engineer for a tenant admin', async () => {
    const actor = makeUser({ permissions: '["users:write","users:roles"]' });
    const result = (await outcome(submit(page, actor, { role: 'platform_engineer' }))) as {
      status: number;
      data: { errors: Record<string, string> };
    };
    expect(result.status).toBe(400);
    expect(result.data.errors.role).toBeDefined();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('refuses to grant permissions the actor does not hold', async () => {
    const result = (await outcome(
      submit(page, makeUser(), { permissions: JSON.stringify(['users:roles']) })
    )) as { status: number };
    expect(result.status).toBe(403);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('stores a reset password as PBKDF2', async () => {
    await outcome(submit(page, makeUser(), { new_password: 'correct horse battery' }));
    expect(updateUser).toHaveBeenCalled();
    expect(updateUser.mock.calls[0][3].password_hash).toMatch(/^pbkdf2\$/);
  });
});
