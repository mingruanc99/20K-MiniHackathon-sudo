import React, { useState, useEffect } from 'react';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  Shield,
  BookOpen,
  Cpu,
  Volume2,
  AlertTriangle,
  X,
  Mail,
  RefreshCw
} from 'lucide-react';
import { UserAdminRecord, UserRole } from '../../types';

export const AdminUsersPage: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<UserAdminRecord | null>(null);
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [users, setUsers] = useState<UserAdminRecord[]>(() => adminTelemetryService.getUsers());
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    await adminTelemetryService.syncRealData();
    setUsers(adminTelemetryService.getUsers());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const unsub = adminTelemetryService.subscribe(() => {
      setUsers(adminTelemetryService.getUsers());
    });
    return () => unsub();
  }, []);

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    const success = adminTelemetryService.changeUserRole(userId, newRole);
    if (success && selectedUser && selectedUser.id === userId) {
      setSelectedUser({ ...selectedUser, role: newRole });
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Users Management</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Tài Khoản Thật
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý tài khoản, theo dõi hạn ngạch AI, lưu lượng TTS và lịch sử hoạt động học tập thực tế.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>{loading ? 'Đang đồng bộ...' : 'Làm Mới'}</span>
          </button>
          <span className="text-xs text-slate-500">Đã đăng ký:</span>
          <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs font-mono">
            {users.length} người dùng
          </span>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">Vai trò:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="admin">Admin</option>
              <option value="instructor">Instructor</option>
              <option value="researcher">Researcher</option>
              <option value="student">Student</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Người Dùng</th>
                <th className="py-3 px-3">Vai Trò</th>
                <th className="py-3 px-3">Bài Giảng</th>
                <th className="py-3 px-3">AI Requests</th>
                <th className="py-3 px-3">Chi Phí</th>
                <th className="py-3 px-3">Trạng Thái</th>
                <th className="py-3 px-3">Hoạt Động Cuối</th>
                <th className="py-3 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="hover:bg-blue-50/40 cursor-pointer transition"
                >
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-800">{u.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.role === 'admin'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : u.role === 'instructor'
                          ? 'bg-purple-100 text-purple-800'
                          : u.role === 'researcher'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-700">{u.lessonsCount} lessons</td>
                  <td className="py-3 px-3 font-mono text-slate-700">{u.aiRequestsCount} calls</td>
                  <td className="py-3 px-3 font-mono text-emerald-600 font-semibold">${u.totalCost.toFixed(2)}</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="inline-flex items-center space-x-1.5 text-xs">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          u.activityStatus === 'active'
                            ? 'bg-emerald-500'
                            : u.activityStatus === 'idle'
                            ? 'bg-amber-500'
                            : 'bg-slate-300'
                        }`}
                      ></span>
                      <span className="capitalize text-slate-600">{u.activityStatus}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">{u.lastActive}</td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUser(u);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
                    >
                      Hồ sơ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase">
                  {selectedUser.name.slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedUser.name}</h3>
                  <div className="text-[11px] text-slate-400 font-mono">{selectedUser.email}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Vai trò</span>
                  <div className="font-bold text-blue-700 uppercase mt-0.5">{selectedUser.role}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Bài giảng</span>
                  <div className="font-bold text-slate-800 mt-0.5">{selectedUser.lessonsCount} bài</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">AI Cost</span>
                  <div className="font-bold font-mono text-emerald-600 mt-0.5">${selectedUser.totalCost.toFixed(2)}</div>
                </div>
              </div>

              {/* Usage Breakdown */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Hạn Mức & Lưu Lượng</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center space-x-1.5 text-slate-500">
                      <Cpu className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-[11px]">AI Requests</span>
                    </div>
                    <div className="text-base font-bold font-mono text-slate-900">{selectedUser.aiRequestsCount}</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center space-x-1.5 text-slate-500">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px]">TTS Requests</span>
                    </div>
                    <div className="text-base font-bold font-mono text-slate-900">{selectedUser.ttsRequestsCount}</div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Lịch Sử Hoạt Động Gần Đây</h4>
                <div className="space-y-1.5">
                  {selectedUser.recentActivity.map((act, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 rounded-lg text-slate-600 border border-slate-100 flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-xl hover:bg-slate-100 transition shadow-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
