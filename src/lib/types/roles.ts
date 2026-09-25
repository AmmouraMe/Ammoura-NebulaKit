/**
 * Role and Permission types for RBAC system
 */

export interface Permission {
  id: string;
  name: string; // e.g., 'orders:read', 'products:write'
  description: string | null;
  category: string; // e.g., 'orders', 'products', 'reports'
  created_at: number;
}

export interface Role {
  id: string;
  site_id: string;
  name: string;
  description: string | null;
  is_system_role: number; // 1 or 0 (boolean in SQLite)
  created_at: number;
  updated_at: number;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
  granted_at: number;
  granted_by: string | null;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface CreateRoleData {
  name: string;
  description?: string;
  is_system_role?: boolean;
  permission_ids?: string[];
}

export interface UpdateRoleData {
  name?: string;
  description?: string;
}

export type PermissionCategory =
  'orders' | 'products' | 'reports' | 'settings' | 'users' | 'pages' | 'logs';

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  'orders',
  'products',
  'reports',
  'settings',
  'users',
  'pages',
  'logs'
];
