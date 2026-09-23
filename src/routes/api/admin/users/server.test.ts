import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DBUser } from '$lib/server/db/users';

const createUser = vi.fn();
const getUserById = vi.fn();
const updateUser = vi.fn();

vi.mock('$lib/server/db', () => ({
  getDB: vi.fn(() => ({})),
  getAllUsers: vi.fn(),
  getUsersByRole: vi.fn(),
  createUser: (...args: unknown[]) => createUser(...args),
  getUserById: (...args: unknown[]) => getUserById(...args),
  updateUser: (...args: unknown[]) => updateUser(...args),
  deleteUser: vi.fn()
}));

vi.mock('$lib/server/db/activity-logs', () => ({ createActivityLog: vi.fn() }));

const { POST } = await import('./+server');
const { PUT } = await import('./[id]/+server');

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

function event(body: unknown, currentUser: DBUser, params: Record<string, string> = {}) {
  return {
    request: new Request('https://shop.example.com/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    platform: { env: {} },
    locals: { siteId: 'site-1', currentUser },
    params
  } as never;
}

describe('POST /api/admin/users', () => {
  beforeEach(() => {
    createUser.mockReset().mockImplementation(async (_db, _site, data) => ({
      ...makeUser({ id: 'new', role: data.role }),
      password_hash: data.password_hash
    }));
  });

  it('hashes the password on the server and ignores a client-supplied hash', async () => {
    const res = await POST(
      event(
        {
          email: 'n@example.com',
          name: 'New',
          password: 'correct horse',
          password_hash: 'deadbeef',
          role: 'user'
        },
        makeUser()
      )
    );
    expect(res.status).toBe(200);
    const stored = createUser.mock.calls[0][2].password_hash as string;
    expect(stored.startsWith('pbkdf2$')).toBe(true);
    const body = (await res.json()) as { user: Record<string, unknown> };
    expect(body.user.password_hash).toBeUndefined();
  });

  it('rejects a request with only a client-side hash', async () => {
    const res = await POST(
      event({ email: 'n@example.com', name: 'New', password_hash: 'deadbeef' }, makeUser())
    );
    expect(res.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects a short password', async () => {
    const res = await POST(
      event({ email: 'n@example.com', name: 'New', password: 'short' }, makeUser())
    );
    expect(res.status).toBe(400);
  });

  it('does not let a tenant admin create a platform engineer', async () => {
    const res = await POST(
      event(
        {
          email: 'n@example.com',
          name: 'New',
          password: 'correct horse',
          role: 'platform_engineer'
        },
        makeUser({ permissions: '["users:write","users:roles"]' })
      )
    );
    expect(res.status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('does not let an admin grant permissions they lack', async () => {
    const res = await POST(
      event(
        {
          email: 'n@example.com',
          name: 'New',
          password: 'correct horse',
          role: 'user',
          permissions: ['users:roles']
        },
        makeUser()
      )
    );
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/admin/users/[id]', () => {
  beforeEach(() => {
    getUserById.mockReset().mockResolvedValue(makeUser({ id: 'target', role: 'user' }));
    updateUser.mockReset().mockResolvedValue(makeUser({ id: 'target' }));
  });

  it('refuses a role change without users:roles', async () => {
    const res = await PUT(event({ role: 'admin' }, makeUser(), { id: 'target' }));
    expect(res.status).toBe(403);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('refuses promotion to platform_engineer by a tenant admin', async () => {
    const res = await PUT(
      event(
        { role: 'platform_engineer' },
        makeUser({ permissions: '["users:write","users:roles"]' }),
        {
          id: 'target'
        }
      )
    );
    expect(res.status).toBe(403);
  });

  it('drops a client-supplied password hash', async () => {
    const res = await PUT(
      event({ name: 'Renamed', password_hash: 'deadbeef' }, makeUser(), { id: 'target' })
    );
    expect(res.status).toBe(200);
    expect(updateUser.mock.calls[0][3]).not.toHaveProperty('password_hash');
    expect(updateUser.mock.calls[0][3].name).toBe('Renamed');
  });
});
