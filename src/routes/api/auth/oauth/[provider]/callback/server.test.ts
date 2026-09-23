import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUserByEmail = vi.fn();
const createUserSession = vi.fn();
const createUser = vi.fn();
const getUserById = vi.fn();
const updateUser = vi.fn();
const createProviderAccount = vi.fn();
const getProviderAccountByProviderId = vi.fn();
const profile = vi.fn();

vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$lib/server/db', () => ({
  getDB: vi.fn(() => ({})),
  getUserByEmail: (...a: unknown[]) => getUserByEmail(...a),
  createUserSession: (...a: unknown[]) => createUserSession(...a)
}));
vi.mock('$lib/server/db/users.js', () => ({
  createUser: (...a: unknown[]) => createUser(...a),
  getUserById: (...a: unknown[]) => getUserById(...a),
  updateUser: (...a: unknown[]) => updateUser(...a)
}));
vi.mock('$lib/server/db/oauth.js', () => ({
  getOAuthSession: vi.fn(async () => ({
    provider: 'twitter',
    redirect_uri: 'https://shop.example.com/cb',
    code_verifier: 'v'
  })),
  deleteOAuthSession: vi.fn(),
  createProviderAccount: (...a: unknown[]) => createProviderAccount(...a),
  getProviderAccountByProviderId: (...a: unknown[]) => getProviderAccountByProviderId(...a),
  createAuthAuditLog: vi.fn()
}));
vi.mock('$lib/server/db/sso-providers.js', () => ({ getSSOProvider: vi.fn() }));
vi.mock('$lib/server/oauth/env-providers.js', () => ({
  getEnvOAuthCredentials: vi.fn(() => ({ clientId: 'id', clientSecret: 'secret' }))
}));
vi.mock('$lib/server/oauth/providers/index.js', () => ({
  createOAuthProvider: vi.fn(() => ({
    exchangeCodeForTokens: vi.fn(async () => ({ access_token: 'at' })),
    getUserProfile: (...a: unknown[]) => profile(...a)
  }))
}));
vi.mock('$lib/server/activity-logger', () => ({ logActivity: vi.fn() }));

const { GET } = await import('./+server');

function callback(env: Record<string, unknown> = {}) {
  return GET({
    params: { provider: 'twitter' },
    url: new URL('https://shop.example.com/api/auth/oauth/twitter/callback?code=c&state=s'),
    platform: { env },
    locals: { siteId: 'site-1' },
    cookies: { set: vi.fn() },
    request: new Request('https://shop.example.com/')
  } as never);
}

async function redirectOf(promise: unknown): Promise<string> {
  try {
    await promise;
  } catch (e) {
    return (e as { location: string }).location;
  }
  throw new Error('expected a redirect');
}

const activeUser = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'owner@example.com',
  name: 'Owner',
  role: 'admin',
  status: 'active',
  ...over
});

describe('OAuth callback account linking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProviderAccountByProviderId.mockResolvedValue(null);
    createUserSession.mockResolvedValue({ token: 't' });
  });

  it('refuses to link an unverified provider email to an existing user', async () => {
    profile.mockResolvedValue({ id: 'x1', email: 'owner@example.com', email_verified: false });
    getUserByEmail.mockResolvedValue(activeUser());

    const location = await redirectOf(callback());

    expect(location).toBe('/auth/login?error=email_unverified&provider=twitter');
    expect(createProviderAccount).not.toHaveBeenCalled();
    expect(createUserSession).not.toHaveBeenCalled();
  });

  it('links a verified provider email to the existing user', async () => {
    profile.mockResolvedValue({ id: 'x1', email: 'owner@example.com', email_verified: true });
    getUserByEmail.mockResolvedValue(activeUser());
    getUserById.mockResolvedValue(activeUser());

    const location = await redirectOf(callback());

    expect(location).toBe('/admin/dashboard');
    expect(createProviderAccount).toHaveBeenCalled();
    expect(createUserSession).toHaveBeenCalledWith(expect.anything(), 'u1', 'site-1');
  });

  it('creates new SSO users with a PBKDF2 hash, not unsalted SHA-256', async () => {
    profile.mockResolvedValue({ id: 'x1', email: 'new@example.com', email_verified: false });
    getUserByEmail.mockResolvedValue(null);
    createUser.mockResolvedValue(activeUser({ id: 'u2', role: 'customer' }));
    getUserById.mockResolvedValue(activeUser({ id: 'u2', role: 'customer' }));

    await redirectOf(callback());

    expect(createUser.mock.calls[0][2].password_hash).toMatch(/^pbkdf2\$/);
  });

  it('does not elevate to platform_engineer on an unverified email', async () => {
    profile.mockResolvedValue({ id: 'x1', email: 'eng@example.com', email_verified: false });
    getUserByEmail.mockResolvedValue(null);
    const created = activeUser({ id: 'u3', email: 'eng@example.com', role: 'customer' });
    createUser.mockResolvedValue(created);
    getUserById.mockResolvedValue(created);

    await redirectOf(callback({ PLATFORM_ENGINEER_EMAIL: 'eng@example.com' }));

    expect(updateUser).not.toHaveBeenCalledWith(expect.anything(), 'site-1', 'u3', {
      role: 'platform_engineer'
    });
  });

  it('elevates to platform_engineer on a verified matching email', async () => {
    profile.mockResolvedValue({ id: 'x1', email: 'eng@example.com', email_verified: true });
    getUserByEmail.mockResolvedValue(null);
    const created = activeUser({ id: 'u3', email: 'eng@example.com', role: 'customer' });
    createUser.mockResolvedValue(created);
    getUserById.mockResolvedValue(created);

    await redirectOf(callback({ PLATFORM_ENGINEER_EMAIL: 'eng@example.com' }));

    expect(updateUser).toHaveBeenCalledWith(expect.anything(), 'site-1', 'u3', {
      role: 'platform_engineer'
    });
  });
});
