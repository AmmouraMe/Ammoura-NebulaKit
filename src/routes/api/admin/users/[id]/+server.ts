/**
 * Individual User Management API
 * Endpoints for getting, updating, and deleting specific users
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB, getUserById, updateUser, deleteUser, type UpdateUserData } from '$lib/server/db';
import {
  canAssignRole,
  canGrantPermissions,
  canPerformAction,
  isUserAccountActive,
  parseUserPermissions
} from '$lib/server/permissions';
import { createActivityLog } from '$lib/server/db/activity-logs';

/**
 * GET /api/admin/users/[id]
 * Get a specific user by ID
 */
export const GET: RequestHandler = async ({ params, platform, locals }) => {
  try {
    // Check authentication
    if (!locals.currentUser) {
      return json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const currentUser = locals.currentUser;

    // Check permission
    if (!canPerformAction(currentUser, 'users:read')) {
      return json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const db = getDB(platform);
    const siteId = locals.siteId;

    const user = await getUserById(db, siteId, params.id);

    if (!user) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Remove password hash from response
    const { password_hash: _password_hash, ...userWithoutPassword } = user;

    return json({
      success: true,
      user: {
        ...userWithoutPassword,
        isActive: isUserAccountActive(user)
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return json({ success: false, error: 'Failed to fetch user' }, { status: 500 });
  }
};

/**
 * PUT /api/admin/users/[id]
 * Update a specific user
 */
export const PUT: RequestHandler = async ({ params, request, platform, locals }) => {
  try {
    // Check authentication
    if (!locals.currentUser) {
      return json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const currentUser = locals.currentUser;

    // Check permission
    if (!canPerformAction(currentUser, 'users:write')) {
      return json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const db = getDB(platform);
    const siteId = locals.siteId;

    // Get existing user
    const existingUser = await getUserById(db, siteId, params.id);
    if (!existingUser) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // A password hash is never accepted from the client; see POST.
    const { password_hash: _clientHash, ...data } = (await request.json()) as UpdateUserData & {
      password_hash?: unknown;
      expiration_date?: string | number | null;
    };

    if (!canAssignRole(currentUser, data.role, existingUser.role)) {
      return json(
        { success: false, error: 'Insufficient permissions to assign that role' },
        { status: 403 }
      );
    }
    if (!canGrantPermissions(currentUser, data.permissions, parseUserPermissions(existingUser))) {
      return json(
        { success: false, error: 'Cannot grant permissions you do not have' },
        { status: 403 }
      );
    }

    // Convert expiration_date to timestamp if it's a date string
    const updateData: UpdateUserData = { ...data };
    if (data.expiration_date !== undefined) {
      if (typeof data.expiration_date === 'string') {
        const timestamp = Math.floor(new Date(data.expiration_date).getTime() / 1000);
        // Validate that the date is valid
        if (isNaN(timestamp)) {
          return json({ success: false, error: 'Invalid expiration date format' }, { status: 400 });
        }
        updateData.expiration_date = timestamp;
      } else {
        updateData.expiration_date = data.expiration_date;
      }
    }

    // Add updated_by
    updateData.updated_by = currentUser.id;

    // Update user
    const updatedUser = await updateUser(db, siteId, params.id, updateData);

    if (!updatedUser) {
      return json({ success: false, error: 'Failed to update user' }, { status: 500 });
    }

    // Log the activity
    await createActivityLog(db, siteId, {
      user_id: currentUser.id,
      action: 'user.updated',
      entity_type: 'user',
      entity_id: params.id,
      entity_name: updatedUser.name,
      description: `Updated user ${updatedUser.email}`,
      metadata: {
        old_values: {
          role: existingUser.role,
          status: existingUser.status,
          expiration_date: existingUser.expiration_date
        },
        new_values: {
          role: updatedUser.role,
          status: updatedUser.status,
          expiration_date: updatedUser.expiration_date
        }
      },
      severity: 'info'
    });

    // Remove password hash from response
    const { password_hash: _password_hash, ...userWithoutPassword } = updatedUser;

    return json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
};

/**
 * DELETE /api/admin/users/[id]
 * Delete a specific user
 */
export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
  try {
    // Check authentication
    if (!locals.currentUser) {
      return json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const currentUser = locals.currentUser;

    // Check permission
    if (!canPerformAction(currentUser, 'users:delete')) {
      return json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    // Prevent self-deletion
    if (params.id === currentUser.id) {
      return json({ success: false, error: 'Cannot delete your own account' }, { status: 400 });
    }

    const db = getDB(platform);
    const siteId = locals.siteId;

    // Get user before deletion for logging
    const user = await getUserById(db, siteId, params.id);
    if (!user) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const deleted = await deleteUser(db, siteId, params.id);

    if (!deleted) {
      return json({ success: false, error: 'Failed to delete user' }, { status: 500 });
    }

    // Log the activity
    await createActivityLog(db, siteId, {
      user_id: currentUser.id,
      action: 'user.deleted',
      entity_type: 'user',
      entity_id: params.id,
      entity_name: user.name,
      description: `Deleted user ${user.email}`,
      metadata: {
        deleted_user: {
          email: user.email,
          name: user.name,
          role: user.role
        }
      },
      severity: 'warning'
    });

    return json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return json({ success: false, error: 'Failed to delete user' }, { status: 500 });
  }
};
