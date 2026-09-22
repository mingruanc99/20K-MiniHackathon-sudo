// src/pages/admin/AdminSettingsPage.tsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { BOOTSTRAP_ADMIN_EMAIL, ADMIN_PERMISSIONS } from '../../services/rbacService';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import {
  Settings,
  Shield,
  Key,
  Flame,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  Server,
  UserCheck
} from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [purifierStrictness, setPurifierStrictness] = useState<'strict' | 'standard'>('strict');
  const [autoRepairEnabled, setAutoRepairEnabled] = useState(true);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <Settings className="w-5 h-5 text-slate-700" />
          <span>System Settings & RBAC Policy</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Cấu hình quyền hạn quản trị viên, thông số kiểm duyệt nội dung tự động và kết nối hệ thống vi dịch vụ.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Admin Account & RBAC Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Shield className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Chính Sách Quyền Quản Trị (RBAC Authority)
            </h2>
          </div>

          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-blue-900">Root Admin Bootstrap:</span>
              <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                {BOOTSTRAP_ADMIN_EMAIL}
              </span>
            </div>
            <p className="text-blue-800 text-[11px] leading-relaxed">
              Tài khoản này được hệ thống định danh vĩnh viễn là Quản Trị Viên Tối Cao (Root Admin) với đầy đủ 10 quyền hạn quản lý hệ thống.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
              Danh Sách Quyền Được Cấp (Active Permissions)
            </span>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              {ADMIN_PERMISSIONS.map((perm) => (
                <div key={perm} className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center space-x-1.5 text-slate-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{perm}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Telemetry & Observability Server Configuration */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Server className="w-4 h-4 text-orange-500" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Bảo Mật Langfuse & LLM Credentials
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Langfuse Project:</span>
                <span className="font-mono font-bold text-slate-800">clsg-ir-studio</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Server Key Isolation:</span>
                <span className="text-emerald-600 font-semibold flex items-center space-x-1">
                  <Lock className="w-3 h-3" />
                  <span>Server-Side Only (Bảo mật 100%)</span>
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Theo quy tắc kiến trúc Section 13 & 15, các khóa bí mật của Langfuse không bao giờ được gửi về máy người dùng. Tất cả dấu vết telemetry được xử lý an toàn qua tầng backend.
            </p>
          </div>

          {/* Purifier Configuration */}
          <div className="border-t border-slate-100 pt-4 space-y-3 text-xs">
            <span className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
              Cấu Hình ContentPurifierService
            </span>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="font-semibold text-slate-800">Tự Động Làm Sạch & Hiệu Chuẩn (Auto-Repair)</div>
                <div className="text-[11px] text-slate-400">Tự động sửa ký tự ô vuông đen (■), khoảng số (1^-4) và lặp template</div>
              </div>
              <input
                type="checkbox"
                checked={autoRepairEnabled}
                onChange={(e) => setAutoRepairEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="font-semibold text-slate-800">Chế Độ Khử Rò Rỉ (Strict Zero-Leak)</div>
                <div className="text-[11px] text-slate-400">Kiểm tra nghiêm ngặt 9 tiêu chí sư phạm trước khi xuất bản</div>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] uppercase">
                Bật
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
