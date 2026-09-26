import React,{ useState, useEffect } from 'react';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import {
  Search,Cpu,
  Volume2,X,RefreshCw
} from 'lucide-react';
import { UserAdminRecord } from '../../types';

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
            <h1 className="text-xl font-bold text-ink tracking-tight">Users Management</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-paper-band text-print border border-rule-strong">
              <span className="w-1.5 h-1.5 rounded-full bg-print animate-pulse" />
              Tài Khoản Thật
            </span>
          </div>
          <p className="text-xs text-ink-faint mt-1">
            Quản lý tài khoản, theo dõi hạn ngạch AI, lưu lượng TTS và lịch sử hoạt động học tập thực tế.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-paper-sheet border border-rule text-xs font-medium text-ink-soft hover:bg-paper-band rounded-xl transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-ink-faint ${loading ? 'animate-spin text-print' : ''}`} />
            <span>{loading ? 'Đang đồng bộ...' : 'Làm Mới'}</span>
          </button>
          <span className="text-xs text-ink-faint">Đã đăng ký:</span>
          <span className="px-2 py-0.5 rounded-lg bg-paper-band text-print font-bold text-xs font-mono">
            {users.length} người dùng
          </span>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-paper-sheet rounded-2xl border border-rule shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-paper-band border border-rule rounded-xl text-xs text-ink-soft focus:outline-none focus:border-print"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-ink-faint">Vai trò:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs bg-paper-band border border-rule rounded-xl px-3 py-1.5 text-ink-soft focus:outline-none"
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
        <div className="overflow-x-auto border border-rule rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-paper-band border-b border-rule text-ink-faint font-semibold uppercase text-[11px] tracking-wider">
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
            <tbody className="divide-y divide-rule">
              {filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="hover:bg-paper-band cursor-pointer transition"
                >
                  <td className="py-3 px-3">
                    <div className="font-semibold text-ink">{u.name}</div>
                    <div className="text-xs text-ink-faint font-mono">{u.email}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        u.role === 'admin'
                          ? 'bg-paper-band text-print border border-rule-strong'
                          : u.role === 'instructor'
                          ? 'bg-paper-band text-print'
                          : u.role === 'researcher'
                          ? 'bg-pen-soft text-pen'
                          : 'bg-paper-band text-ink-soft'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-ink-soft">{u.lessonsCount} lessons</td>
                  <td className="py-3 px-3 font-mono text-ink-soft">{u.aiRequestsCount} calls</td>
                  <td className="py-3 px-3 font-mono text-print font-semibold">${u.totalCost.toFixed(4)}</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="inline-flex items-center space-x-1.5 text-xs">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          u.activityStatus === 'active'
                            ? 'bg-print'
                            : u.activityStatus === 'idle'
                            ? 'bg-pen'
                            : 'bg-rule'
                        }`}
                      ></span>
                      <span className="capitalize text-ink-soft">{u.activityStatus}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-ink-faint text-xs whitespace-nowrap">{u.lastActive}</td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUser(u);
                      }}
                      className="px-2.5 py-1 bg-paper-band hover:bg-rule text-ink-soft rounded-lg text-xs font-medium transition"
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
        <div className="fixed inset-0 z-50 bg-cover  flex items-center justify-center p-4">
          <div className="bg-paper-sheet max-w-xl w-full rounded-2xl border border-rule shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-rule flex items-center justify-between bg-paper-band">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-paper-band text-print flex items-center justify-center font-bold text-xs uppercase">
                  {selectedUser.name.slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">{selectedUser.name}</h3>
                  <div className="text-xs text-ink-faint font-mono">{selectedUser.email}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 text-ink-faint hover:text-ink-soft rounded-lg hover:bg-paper-band"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-3 gap-3 bg-paper-band p-3.5 rounded-xl border border-rule/80">
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Vai trò</span>
                  <div className="font-bold text-print uppercase mt-0.5">{selectedUser.role}</div>
                </div>
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Bài giảng</span>
                  <div className="font-bold text-ink mt-0.5">{selectedUser.lessonsCount} bài</div>
                </div>
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">AI Cost</span>
                  <div className="font-bold font-mono text-print mt-0.5">${selectedUser.totalCost.toFixed(4)}</div>
                </div>
              </div>

              {/* Usage Breakdown */}
              <div className="space-y-2">
                <h4 className="font-bold text-ink text-xs uppercase tracking-wider">Hạn Mức & Lưu Lượng</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-paper-band rounded-xl border border-rule space-y-1">
                    <div className="flex items-center space-x-1.5 text-ink-faint">
                      <Cpu className="w-3.5 h-3.5 text-print" />
                      <span className="text-xs">AI Requests</span>
                    </div>
                    <div className="text-base font-bold font-mono text-ink">{selectedUser.aiRequestsCount}</div>
                  </div>
                  <div className="p-3 bg-paper-band rounded-xl border border-rule space-y-1">
                    <div className="flex items-center space-x-1.5 text-ink-faint">
                      <Volume2 className="w-3.5 h-3.5 text-print" />
                      <span className="text-xs">TTS Requests</span>
                    </div>
                    <div className="text-base font-bold font-mono text-ink">{selectedUser.ttsRequestsCount}</div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="space-y-2">
                <h4 className="font-bold text-ink text-xs uppercase tracking-wider">Lịch Sử Hoạt Động Gần Đây</h4>
                <div className="space-y-1.5">
                  {selectedUser.recentActivity.map((act, i) => (
                    <div key={i} className="p-2.5 bg-paper-band rounded-lg text-ink-soft border border-rule flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-print"></span>
                      <span>{act}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-rule bg-paper-band flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-paper-sheet border border-rule text-ink-soft font-medium text-xs rounded-xl hover:bg-paper-band transition shadow-xs"
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
