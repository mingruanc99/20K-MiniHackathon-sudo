// src/services/rbacService.ts
/**
 * Role-Based Access Control (RBAC) & Authorization Service
 * Enforces admin route protections, permission checks, and bootstraps hkthien@husc.edu.vn.
 */
import { User, AdminPermission } from '../types';

export const BOOTSTRAP_ADMIN_EMAIL = 'hkthien@husc.edu.vn';

export const ADMIN_PERMISSIONS: AdminPermission[] = [
  'view_dashboard',
  'view_users',
  'view_lessons',
  'view_content_quality',
  'view_ai_analytics',
  'view_errors',
  'view_tts',
  'view_langfuse',
  'manage_prompts',
  'manage_lessons'
];

export class RBACService {
  /**
   * Evaluates if user has ADMIN privileges.
   * Explicitly bootstraps hkthien@husc.edu.vn as permanent root admin.
   */
  isAdmin(user: User | null): boolean {
    if (!user) return false;
    const email = (user.email || '').toLowerCase().trim();
    if (email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      return true;
    }
    return user.role === 'admin';
  }

  /**
   * Checks if user has a specific permission.
   */
  hasPermission(user: User | null, permission: AdminPermission): boolean {
    if (!this.isAdmin(user)) return false;
    return ADMIN_PERMISSIONS.includes(permission);
  }

  /**
   * Returns list of effective permissions for user.
   */
  getUserPermissions(user: User | null): AdminPermission[] {
    if (this.isAdmin(user)) {
      return [...ADMIN_PERMISSIONS];
    }
    return [];
  }

  /**
   * Backend simulation / token validator for authorized admin requests
   */
  validateAdminRequest(user: User | null): { authorized: boolean; error?: string } {
    if (!user) {
      return { authorized: false, error: 'UNAUTHENTICATED: Yêu cầu đăng nhập để truy cập.' };
    }
    if (!this.isAdmin(user)) {
      return { authorized: false, error: 'FORBIDDEN_NOT_ADMIN: Chỉ tài khoản Admin mới có quyền truy cập.' };
    }
    return { authorized: true };
  }
}

export const rbacService = new RBACService();
