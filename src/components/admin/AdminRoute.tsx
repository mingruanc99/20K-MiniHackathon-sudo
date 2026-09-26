// src/components/admin/AdminRoute.tsx
import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { rbacService, BOOTSTRAP_ADMIN_EMAIL } from '../../services/rbacService';
import { ArrowLeft, Lock, UserCheck } from 'lucide-react';

export const AdminRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, loading, loginAsAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-band text-ink-faint text-sm">
        <div className="flex items-center space-x-3">
          <div className="w-4 h-4 border-2 border-print border-t-transparent rounded-full animate-spin"></div>
          <span>Đang xác thực quyền quản trị...</span>
        </div>
      </div>
    );
  }

  // If not logged in at all, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check RBAC permission
  const isAuthorizedAdmin = rbacService.isAdmin(user);

  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-screen bg-paper-band flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-paper-sheet rounded-2xl border border-rule shadow-sm p-8 text-center space-y-6">
          <div className="w-14 h-14 bg-pen-soft border border-pen-line rounded-2xl flex items-center justify-center mx-auto text-pen">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-ink">403 — Từ Chối Truy Cập</h1>
            <p className="text-sm text-ink-faint leading-relaxed">
              Khu vực <span className="font-mono text-ink-soft bg-paper-band px-1.5 py-0.5 rounded">/admin</span> được bảo vệ nghiêm ngặt bằng chính sách RBAC. Tài khoản hiện tại của bạn không có quyền quản trị viên.
            </p>
          </div>

          <div className="bg-paper-band rounded-xl p-4 text-xs text-left space-y-1.5 border border-rule">
            <div className="flex justify-between">
              <span className="text-ink-faint">Tài khoản đang đăng nhập:</span>
              <span className="font-medium text-ink-soft truncate max-w-[200px]">{user.email || user.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Vai trò (Role):</span>
              <span className="font-semibold text-pen uppercase">{user.role || 'user'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Admin Bootstrap:</span>
              <span className="font-mono text-print">{BOOTSTRAP_ADMIN_EMAIL}</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              to="/dashboard"
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 bg-cover hover:bg-cover-deep text-white rounded-xl text-sm font-medium transition shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay Lại Studio Bài Giảng</span>
            </Link>

            <button
              onClick={() => loginAsAdmin()}
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 bg-paper-band hover:bg-paper-band text-navy border border-rule-strong rounded-xl text-xs font-semibold transition"
            >
              <UserCheck className="w-4 h-4 text-print" />
              <span>Đăng Nhập Với Tài Khoản Admin ({BOOTSTRAP_ADMIN_EMAIL})</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
