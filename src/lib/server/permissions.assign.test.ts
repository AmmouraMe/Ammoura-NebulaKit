import { describe, it, expect } from 'vitest';
import { canAssignRole, canCreateWithRole, canGrantPermissions } from './permissions';
import type { DBUser } from './db/users';

const user = (overrides: Partial<DBUser>): DBUser => ({
  id: 'actor',
  site_id: 'site-1',
  email: 'a@example.com',
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

describe('canAssignRole', () => {
  const admin = user({ role: 'admin' });
  const roleAdmin = user({ role: 'admin', permissions: '["users:roles"]' });
  const engineer = user({ role: 'platform_engineer' });

  it('allows an unchanged or absent role', () => {
    expect(canAssignRole(admin, 'user', 'user')).toBe(true);
    expect(canAssignRole(admin, undefined, 'user')).toBe(true);
  });

  it('requires users:roles for ordinary role changes', () => {
    expect(canAssignRole(admin, 'admin', 'user')).toBe(false);
    expect(canAssignRole(roleAdmin, 'admin', 'user')).toBe(true);
  });

  it('never lets a tenant admin grant or revoke platform_engineer', () => {
    expect(canAssignRole(roleAdmin, 'platform_engineer', 'user')).toBe(false);
    expect(canAssignRole(roleAdmin, 'platform_engineer', undefined)).toBe(false);
    expect(canAssignRole(roleAdmin, 'customer', 'platform_engineer')).toBe(false);
  });

  it('lets an active platform engineer grant platform_engineer', () => {
    expect(canAssignRole(engineer, 'platform_engineer', 'user')).toBe(true);
    expect(
      canAssignRole(user({ role: 'platform_engineer', status: 'suspended' }), 'platform_engineer')
    ).toBe(false);
  });
});

describe('canGrantPermissions', () => {
  const admin = user({ role: 'admin' });

  it('allows permissions the actor holds', () => {
    expect(canGrantPermissions(admin, ['orders:read', 'products:write'])).toBe(true);
  });

  it('rejects permissions the actor does not hold', () => {
    expect(canGrantPermissions(admin, ['users:roles'])).toBe(false);
    expect(canGrantPermissions(admin, ['orders:read', 'users:delete'])).toBe(false);
  });

  it('keeps permissions the user already had', () => {
    expect(canGrantPermissions(admin, ['users:roles'], ['users:roles'])).toBe(true);
  });

  it('treats a missing list as no change', () => {
    expect(canGrantPermissions(admin, undefined)).toBe(true);
    expect(canGrantPermissions(admin, null)).toBe(true);
  });
});

describe('canCreateWithRole', () => {
  it('allows ordinary roles and reserves platform_engineer for platform engineers', () => {
    expect(canCreateWithRole(user({ role: 'admin' }), 'admin')).toBe(true);
    expect(canCreateWithRole(user({ role: 'admin' }), undefined)).toBe(true);
    expect(canCreateWithRole(user({ role: 'admin' }), 'platform_engineer')).toBe(false);
    expect(canCreateWithRole(user({ role: 'platform_engineer' }), 'platform_engineer')).toBe(true);
  });
});
