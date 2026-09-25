import type { PageServerLoad, Actions } from './$types';
import { getDB, getUserById } from '$lib/server/db';
import { error, fail, redirect } from '@sveltejs/kit';
import {
  canAssignRole,
  canGrantPermissions,
  canPerformAction,
  isSystemUser,
  parseUserPermissions
} from '$lib/server/permissions';
import { hashPassword } from '$lib/server/password';

export const load: PageServerLoad = async ({ platform, locals, params }) => {
  // Check authentication
  // hooks.server.ts resolves the session cookie against the users table, so
  // locals.currentUser is already the full DB row
  const currentUser = locals.currentUser;
  if (!currentUser) {
    throw error(401, 'Not authenticated');
  }

  const db = getDB(platform);
  const siteId = locals.siteId;

  // Check permission to edit users
  if (!canPerformAction(currentUser, 'users:write')) {
    throw error(403, 'Insufficient permissions to edit users');
  }

  const userId = params.userId;

  // Get user details to edit
  const user = await getUserById(db, siteId, userId);

  if (!user) {
    throw error(404, 'User not found');
  }

  // Prevent editing own account
  if (userId === currentUser.id) {
    throw error(403, 'Cannot edit your own account');
  }

  // Check if this is a system user
  const isSystem = isSystemUser(userId);

  // Prevent editing system users
  if (isSystem) {
    throw error(403, 'Cannot edit system users');
  }

  // Remove password hash from user object
  const { password_hash: _password_hash, ...userWithoutPassword } = user;

  return {
    user: {
      ...userWithoutPassword,
      permissions: JSON.parse(user.permissions)
    },
    currentUser: {
      id: currentUser.id,
      role: currentUser.role,
      canManageRoles: canPerformAction(currentUser, 'users:roles')
    }
  };
};

export const actions: Actions = {
  default: async ({ request, platform, locals, params }) => {
    // hooks.server.ts resolves the session cookie against the users table, so
    // locals.currentUser is already the full DB row
    const currentUser = locals.currentUser;
    if (!currentUser) {
      throw error(401, 'Not authenticated');
    }

    const db = getDB(platform);
    const siteId = locals.siteId;

    if (!canPerformAction(currentUser, 'users:write')) {
      throw error(403, 'Insufficient permissions to edit users');
    }

    const userId = params.userId;

    // Prevent editing own account
    if (userId === currentUser.id) {
      throw error(403, 'Cannot edit your own account');
    }

    // Prevent editing system users
    if (isSystemUser(userId)) {
      throw error(403, 'Cannot modify system users');
    }

    const formData = await request.formData();
    const email = formData.get('email')?.toString();
    const name = formData.get('name')?.toString();
    const role = formData.get('role')?.toString() as
      'admin' | 'user' | 'customer' | 'platform_engineer';
    const status = formData.get('status')?.toString() as
      'active' | 'inactive' | 'expired' | 'suspended';
    const expiration_date = formData.get('expiration_date')?.toString();
    const grace_period_days = formData.get('grace_period_days')?.toString();
    const permissionsJson = formData.get('permissions')?.toString();
    const newPassword = formData.get('new_password')?.toString();

    // Validation
    const errors: Record<string, string> = {};

    if (!email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Invalid email format';
    }

    if (!name) {
      errors.name = 'Name is required';
    }

    if (!role || !['admin', 'user', 'customer', 'platform_engineer'].includes(role)) {
      errors.role = 'Invalid role';
    }

    if (!status || !['active', 'inactive', 'expired', 'suspended'].includes(status)) {
      errors.status = 'Invalid status';
    }

    if (grace_period_days && parseInt(grace_period_days) < 0) {
      errors.grace_period_days = 'Grace period cannot be negative';
    }

    // Role changes need users:roles, and only a platform engineer may grant
    // or revoke platform_engineer.
    const existingUser = await getUserById(db, siteId, userId);
    if (existingUser && !canAssignRole(currentUser, role, existingUser.role)) {
      errors.role = 'Insufficient permissions to change user role';
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, { errors });
    }

    try {
      // Parse permissions
      let permissions: string[] = [];
      if (permissionsJson) {
        try {
          permissions = JSON.parse(permissionsJson);
        } catch {
          return fail(400, { errors: { permissions: 'Invalid permissions format' } });
        }
      }
      if (
        !Array.isArray(permissions) ||
        !canGrantPermissions(
          currentUser,
          permissions,
          existingUser ? parseUserPermissions(existingUser) : []
        )
      ) {
        return fail(403, {
          errors: { permissions: 'Cannot grant permissions you do not have' }
        });
      }

      // Build update data
      const updateData: {
        email?: string;
        name?: string;
        role?: 'admin' | 'user' | 'customer' | 'platform_engineer';
        status?: 'active' | 'inactive' | 'expired' | 'suspended';
        permissions?: string[];
        expiration_date?: number | null;
        grace_period_days?: number;
        password_hash?: string;
        updated_by?: string;
      } = {
        email,
        name,
        role,
        status,
        permissions,
        expiration_date: expiration_date
          ? Math.floor(new Date(expiration_date).getTime() / 1000)
          : null,
        grace_period_days: grace_period_days ? parseInt(grace_period_days) : 0,
        updated_by: currentUser.id
      };

      // Handle password update if provided
      if (newPassword && newPassword.length > 0) {
        if (newPassword.length < 8) {
          return fail(400, { errors: { new_password: 'Password must be at least 8 characters' } });
        }
        updateData.password_hash = await hashPassword(newPassword);
      }

      // Update user
      const { updateUser } = await import('$lib/server/db/users');
      await updateUser(db, siteId, userId, updateData);

      // Log the action
      const { createActivityLog } = await import('$lib/server/db/activity-logs');
      await createActivityLog(db, siteId, {
        user_id: currentUser.id,
        action: 'user.updated',
        entity_type: 'user',
        entity_id: userId,
        description: `Updated user ${name}`,
        severity: 'info'
      });
    } catch (err) {
      console.error('Failed to update user:', err);
      return fail(500, {
        errors: { submit: 'Failed to update user. Please try again.' }
      });
    }

    throw redirect(303, `/admin/settings/admin-users/${userId}`);
  }
};
