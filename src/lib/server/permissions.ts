/**
 * Permission checking utilities for RBAC
 */

import type { DBUser } from './db/users.js';

/**
 * Default permissions for admin role
 * Admins have most permissions except for critical operations like deleting users
 */
export const ADMIN_DEFAULT_PERMISSIONS = [
  'orders:read',
  'orders:write',
  'orders:refund',
  'products:read',
  'products:write',
  'reports:read',
  'reports:export',
  'settings:read',
  'settings:write',
  'settings:theme',
  'users:read',
  'users:write',
  'pages:read',
  'pages:write',
  'pages:publish',
  'logs:read'
];

/**
 * Expiration warning threshold in seconds (7 days)
 */
export const EXPIRATION_WARNING_THRESHOLD = 7 * 86400;

/**
 * Parse permissions from user's JSON permissions field
 */
export function parseUserPermissions(user: DBUser): string[] {
  try {
    return JSON.parse(user.permissions) as string[];
  } catch (error) {
    console.error(`Failed to parse permissions for user ${user.id}:`, error);
    return [];
  }
}

/**
 * Check if user has a specific permission
 */
export function userHasPermission(user: DBUser, permission: string): boolean {
  // Platform engineers have all permissions
  if (user.role === 'platform_engineer') {
    return true;
  }

  // Admins have most permissions by default
  if (user.role === 'admin') {
    // Check if the permission is explicitly in their custom permissions
    const userPermissions = parseUserPermissions(user);
    if (userPermissions.length > 0) {
      return userPermissions.includes(permission);
    }
    // Default admin permissions (configurable list)
    return ADMIN_DEFAULT_PERMISSIONS.includes(permission);
  }

  // Check custom permissions
  const userPermissions = parseUserPermissions(user);
  return userPermissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function userHasAnyPermission(user: DBUser, permissions: string[]): boolean {
  return permissions.some((permission) => userHasPermission(user, permission));
}

/**
 * Check if user has all of the specified permissions
 */
export function userHasAllPermissions(user: DBUser, permissions: string[]): boolean {
  return permissions.every((permission) => userHasPermission(user, permission));
}

/**
 * Check if user's account is active and not expired
 */
export function isUserAccountActive(user: DBUser, currentTimestamp?: number): boolean {
  // Check status
  if (user.status !== 'active') {
    return false;
  }

  // Check expiration
  if (user.expiration_date) {
    const now = currentTimestamp || Math.floor(Date.now() / 1000);
    const expirationWithGrace = user.expiration_date + user.grace_period_days * 86400;
    if (now > expirationWithGrace) {
      return false;
    }
  }

  return true;
}

/**
 * Check if user can perform an action
 */
export function canPerformAction(
  user: DBUser,
  permission: string,
  currentTimestamp?: number
): boolean {
  // First check if account is active
  if (!isUserAccountActive(user, currentTimestamp)) {
    return false;
  }

  // Then check permission
  return userHasPermission(user, permission);
}

/**
 * Check if a user is a system user (Site Owner or Platform Engineer)
 * These users should not be editable through the admin interface
 */
export function isSystemUser(userId: string): boolean {
  return userId === 'admin-1' || userId === 'engineer-1';
}

/**
 * Get all permissions for a user (combines role-based and custom permissions)
 */
export async function getUserAllPermissions(db: D1Database, user: DBUser): Promise<string[]> {
  const permissions = new Set<string>();

  // Add custom permissions
  const userPermissions = parseUserPermissions(user);
  userPermissions.forEach((p) => permissions.add(p));

  // Platform engineers have all permissions
  if (user.role === 'platform_engineer') {
    // Return all possible permissions
    return [
      'orders:read',
      'orders:write',
      'orders:delete',
      'orders:refund',
      'products:read',
      'products:write',
      'products:delete',
      'products:import',
      'reports:read',
      'reports:export',
      'settings:read',
      'settings:write',
      'settings:theme',
      'users:read',
      'users:write',
      'users:delete',
      'users:roles',
      'pages:read',
      'pages:write',
      'pages:delete',
      'pages:publish',
      'logs:read',
      'logs:export'
    ];
  }

  // Admins get default permissions if no custom permissions set
  if (user.role === 'admin' && userPermissions.length === 0) {
    return [
      'orders:read',
      'orders:write',
      'orders:refund',
      'products:read',
      'products:write',
      'reports:read',
      'reports:export',
      'settings:read',
      'settings:write',
      'settings:theme',
      'users:read',
      'users:write',
      'pages:read',
      'pages:write',
      'pages:publish',
      'logs:read'
    ];
  }

  return Array.from(permissions);
}

/**
 * Whether `actor` may move a user from `previousRole` to `nextRole`.
 *
 * `platform_engineer` sees every site on the platform (`/admin/sites`,
 * `/admin/database`), so a tenant admin must never be able to mint one — only
 * an existing platform engineer may grant or revoke it. Every other role
 * change needs `users:roles`. Leaving the role unchanged is always allowed.
 */
export function canAssignRole(
  actor: DBUser,
  nextRole: string | undefined | null,
  previousRole?: string | null
): boolean {
  if (!nextRole || nextRole === previousRole) {
    return true;
  }
  if (nextRole === 'platform_engineer' || previousRole === 'platform_engineer') {
    return actor.role === 'platform_engineer' && isUserAccountActive(actor);
  }
  return canPerformAction(actor, 'users:roles');
}

/**
 * Whether `actor` may create a new user with `role`. Creating users is already
 * gated on `users:write`; the one role that needs more is `platform_engineer`,
 * which only an existing platform engineer may hand out.
 */
export function canCreateWithRole(actor: DBUser, role: string | undefined | null): boolean {
  if (role !== 'platform_engineer') {
    return true;
  }
  return actor.role === 'platform_engineer' && isUserAccountActive(actor);
}

/**
 * Whether `actor` may give a user this permission list. An actor can only
 * hand out permissions they hold themselves; permissions the user already
 * had (`previous`) may be kept as they are.
 */
export function canGrantPermissions(
  actor: DBUser,
  next: readonly string[] | undefined | null,
  previous: readonly string[] = []
): boolean {
  if (!next) {
    return true;
  }
  return next.every((p) => previous.includes(p) || canPerformAction(actor, p));
}
