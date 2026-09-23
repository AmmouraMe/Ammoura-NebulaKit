import type { PageServerLoad, Actions } from './$types';
import { getDB, getUserById } from '$lib/server/db';
import { getActivityLogs } from '$lib/server/db/activity-logs';
import {
  canAssignRole,
  canPerformAction,
  isUserAccountActive,
  isSystemUser,
  getUserAllPermissions
} from '$lib/server/permissions';
import { error, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ platform, locals, params }) => {
  // Check authentication
  const currentUser = locals.currentUser;
  if (!currentUser) {
    throw error(401, 'Not authenticated');
  }

  // Check permission to view users
  if (!canPerformAction(currentUser, 'users:read')) {
    throw error(403, 'Insufficient permissions to view user details');
  }

  const db = getDB(platform);
  const siteId = locals.siteId;
  const userId = params.userId;

  // Get user details
  const user = await getUserById(db, siteId, userId);

  if (!user) {
    throw error(404, 'User not found');
  }

  // Remove password hash from user object
  const { password_hash: _password_hash, ...userWithoutPassword } = user;

  // Check if this is a system user
  const isSystem = isSystemUser(userId);

  // Get recent activity logs for this user
  const activityLogs = await getActivityLogs(db, siteId, {
    user_id: userId,
    limit: 50,
    offset: 0
  });

  return {
    user: {
      ...userWithoutPassword,
      isActive: isUserAccountActive(user),
      permissions: isSystem ? await getUserAllPermissions(db, user) : JSON.parse(user.permissions),
      isSystemUser: isSystem
    },
    activityLogs,
    currentUser: {
      id: currentUser.id,
      role: currentUser.role,
      canWrite: canPerformAction(currentUser, 'users:write'),
      canDelete: canPerformAction(currentUser, 'users:delete'),
      canManageRoles: canPerformAction(currentUser, 'users:roles')
    }
  };
};

export const actions: Actions = {
  updateStatus: async ({ request, platform, locals, params }) => {
    const currentUser = locals.currentUser;
    if (!currentUser) {
      throw error(401, 'Not authenticated');
    }

    if (!canPerformAction(currentUser, 'users:write')) {
      throw error(403, 'Insufficient permissions to update user status');
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
    const status = formData.get('status')?.toString() as
      | 'active'
      | 'inactive'
      | 'expired'
      | 'suspended';

    if (!status || !['active', 'inactive', 'expired', 'suspended'].includes(status)) {
      throw error(400, 'Invalid status');
    }

    const db = getDB(platform);
    const siteId = locals.siteId;

    // Update user status
    const { updateUser } = await import('$lib/server/db/users');
    await updateUser(db, siteId, userId, {
      status,
      updated_by: currentUser.id
    });

    // Log the action
    const { createActivityLog } = await import('$lib/server/db/activity-logs');
    await createActivityLog(db, siteId, {
      user_id: currentUser.id,
      action: 'user.status_updated',
      entity_type: 'user',
      entity_id: userId,
      description: `Updated user status to ${status}`,
      severity: 'info'
    });

    return { success: true };
  },

  updateRole: async ({ request, platform, locals, params }) => {
    const currentUser = locals.currentUser;
    if (!currentUser) {
      throw error(401, 'Not authenticated');
    }

    if (!canPerformAction(currentUser, 'users:roles')) {
      throw error(403, 'Insufficient permissions to update user role');
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
    const role = formData.get('role')?.toString() as
      | 'admin'
      | 'user'
      | 'customer'
      | 'platform_engineer';

    if (!role || !['admin', 'user', 'customer', 'platform_engineer'].includes(role)) {
      throw error(400, 'Invalid role');
    }

    const db = getDB(platform);
    const siteId = locals.siteId;

    const target = await getUserById(db, siteId, userId);
    if (!target) {
      throw error(404, 'User not found');
    }
    if (!canAssignRole(currentUser, role, target.role)) {
      throw error(403, 'Insufficient permissions to assign that role');
    }

    // Update user role
    const { updateUser } = await import('$lib/server/db/users');
    await updateUser(db, siteId, userId, {
      role,
      updated_by: currentUser.id
    });

    // Log the action
    const { createActivityLog } = await import('$lib/server/db/activity-logs');
    await createActivityLog(db, siteId, {
      user_id: currentUser.id,
      action: 'user.role_updated',
      entity_type: 'user',
      entity_id: userId,
      description: `Updated user role to ${role}`,
      severity: 'info'
    });

    return { success: true };
  },

  delete: async ({ platform, locals, params }) => {
    const currentUser = locals.currentUser;
    if (!currentUser) {
      throw error(401, 'Not authenticated');
    }

    if (!canPerformAction(currentUser, 'users:delete')) {
      throw error(403, 'Insufficient permissions to delete user');
    }

    const userId = params.userId;

    // Cannot delete yourself
    if (userId === currentUser.id) {
      throw error(400, 'Cannot delete your own account');
    }

    // Prevent deleting system users
    if (isSystemUser(userId)) {
      throw error(403, 'Cannot delete system users');
    }

    const db = getDB(platform);
    const siteId = locals.siteId;

    // Get user for logging
    const user = await getUserById(db, siteId, userId);
    if (!user) {
      throw error(404, 'User not found');
    }

    // Delete user
    const { deleteUser } = await import('$lib/server/db/users');
    await deleteUser(db, siteId, userId);

    // Log the action
    const { createActivityLog } = await import('$lib/server/db/activity-logs');
    await createActivityLog(db, siteId, {
      user_id: currentUser.id,
      action: 'user.deleted',
      entity_type: 'user',
      entity_id: userId,
      entity_name: user.name,
      description: `Deleted user ${user.name} (${user.email})`,
      severity: 'warning'
    });

    throw redirect(303, '/admin/users');
  }
};
