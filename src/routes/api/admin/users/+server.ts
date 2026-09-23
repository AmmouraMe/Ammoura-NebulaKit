/**
 * User Management API
 * Endpoints for CRUD operations on users with permission checking
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getDB,
  getAllUsers,
  getUsersByRole,
  createUser,
  type CreateUserData
} from '$lib/server/db';
import {
  canCreateWithRole,
  canGrantPermissions,
  canPerformAction,
  isUserAccountActive
} from '$lib/server/permissions';
import { hashPassword } from '$lib/server/password';

/**
 * GET /api/admin/users
 * List all users with optional filtering by role or status
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
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

    // Get query parameters for filtering
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');

    // Validate role parameter
    const validRoles = ['admin', 'user', 'customer', 'platform_engineer'];

    let users;
    if (role) {
      if (!validRoles.includes(role)) {
        return json({ success: false, error: 'Invalid role parameter' }, { status: 400 });
      }
      users = await getUsersByRole(
        db,
        siteId,
        role as 'admin' | 'user' | 'customer' | 'platform_engineer'
      );
    } else {
      users = await getAllUsers(db, siteId);
    }

    // Filter by status if provided
    if (status) {
      users = users.filter((u) => u.status === status);
    }

    // Remove password hashes from response
    const sanitizedUsers = users.map((user) => {
      const { password_hash: _password_hash, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        isActive: isUserAccountActive(user)
      };
    });

    return json({
      success: true,
      users: sanitizedUsers
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
};

/**
 * POST /api/admin/users
 * Create a new user
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
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

    const {
      password,
      password_hash: _clientHash,
      ...data
    } = (await request.json()) as Omit<CreateUserData, 'password_hash'> & {
      password?: string;
      password_hash?: unknown;
      expiration_date?: string | number | null;
    };

    // Validate required fields. The password is hashed here, never trusted as
    // a hash from the browser: a client-side unsalted SHA-256 is just a
    // password-equivalent, and it let the caller store any hash format at all.
    if (!data.email || !data.name || typeof password !== 'string' || !password) {
      return json(
        { success: false, error: 'Email, name, and password are required' },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    if (!canCreateWithRole(currentUser, data.role)) {
      return json(
        { success: false, error: 'Insufficient permissions to assign that role' },
        { status: 403 }
      );
    }
    if (!canGrantPermissions(currentUser, data.permissions)) {
      return json(
        { success: false, error: 'Cannot grant permissions you do not have' },
        { status: 403 }
      );
    }

    // Convert expiration_date to timestamp if it's a date string
    let expirationTimestamp: number | null = null;
    if (data.expiration_date) {
      if (typeof data.expiration_date === 'string') {
        expirationTimestamp = Math.floor(new Date(data.expiration_date).getTime() / 1000);
      } else {
        expirationTimestamp = data.expiration_date;
      }
    }

    // Create user
    const user = await createUser(db, siteId, {
      ...data,
      password_hash: await hashPassword(password),
      expiration_date: expirationTimestamp,
      created_by: currentUser.id
    });

    // Remove password hash from response
    const { password_hash: _password_hash, ...userWithoutPassword } = user;

    return json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return json({ success: false, error: 'Failed to create user' }, { status: 500 });
  }
};
