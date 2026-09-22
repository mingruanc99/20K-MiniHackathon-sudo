// src/components/admin/AdminLayout.tsx
import React, { useState, createContext, useContext } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import { TimeFilter } from '../../types';
import {
  LayoutDashboard,
  BookOpen,
  CheckCheck,
  Users,
  Cpu,
  Flame,
  Volume2,
  AlertOctagon,
  BarChart3,
  Sliders,
  Settings,
  Search,
  Bell,
  LogOut,
  ExternalLink,
  Shield,
  ArrowUpRight,
  Menu,
  X
} from 'lucide-react';

interface AdminContextType {
  timeFilter: TimeFilter;
  setTimeFilter: (t: TimeFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const AdminContext = createContext<AdminContextType>({
  timeFilter: '7d',
  setTimeFilter: () => {},
  searchQuery: '',
  setSearchQuery: () => {}
});

export const useAdmin = () => useContext(AdminContext);

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7d');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const errors = adminTelemetryService.getErrorRecords();
  const unresolvedErrorsCount = errors.filter((e) => e.status !== 'resolved').length;

  const navItems = [
    { label: 'Overview', to: '/admin', exact: true, icon: LayoutDashboard },
    { label: 'Lessons', to: '/admin/lessons', icon: BookOpen },
    { label: 'Content Quality', to: '/admin/quality', icon: CheckCheck, badge: '98.4%' },
    { label: 'Users', to: '/admin/users', icon: Users },
    { label: 'AI / LLM', to: '/admin/ai-analytics', icon: Cpu },
    { label: 'Langfuse', to: '/admin/langfuse', icon: Flame, isExternalHub: true },
    { label: 'TTS Speech', to: '/admin/tts', icon: Volume2 },
    {
      label: 'Error Center',
      to: '/admin/errors',
      icon: AlertOctagon,
      alertCount: unresolvedErrorsCount > 0 ? unresolvedErrorsCount : undefined
    },
    { label: 'AI Evaluation', to: '/admin/evaluation', icon: BarChart3 },
    { label: 'Prompt Studio', to: '/admin/prompts', icon: Sliders }
  ];

  return (
    <AdminContext.Provider value={{ timeFilter, setTimeFilter, searchQuery, setSearchQuery }}>
      <div className="min-h-screen bg-slate-50 flex text-slate-800 font-sans antialiased">
        {/* Mobile menu backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 h-screen w-64 bg-white border-r border-slate-200 z-50 flex flex-col transition-transform duration-200 ease-in-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Brand header */}
          <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-extrabold tracking-wider text-slate-900 uppercase">
                  Admin Control Center
                </div>
                <div className="text-[10px] text-blue-600 font-medium flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>CLSG-IR Production</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Items */}
          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Management & Observability
            </div>

            {navItems.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.to || location.pathname === `${item.to}/overview`
                : location.pathname.startsWith(item.to);

              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.alertCount ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shrink-0">
                      {item.alertCount}
                    </span>
                  ) : item.badge ? (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 shrink-0">
                      {item.badge}
                    </span>
                  ) : item.isExternalHub ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300" />
                  ) : null}
                </NavLink>
              );
            })}

            <div className="pt-4 px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              System
            </div>

            <NavLink
              to="/admin/settings"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Settings & RBAC</span>
            </NavLink>
          </div>

          {/* User profile card & Quick back button */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
            <div className="px-3 py-2 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="truncate pr-2">
                <div className="text-xs font-bold text-slate-800 truncate">
                  {user?.displayName || 'Huỳnh Khắc Thiên'}
                </div>
                <div className="text-[11px] text-blue-600 font-mono truncate">
                  {user?.email || 'hkthien@husc.edu.vn'}
                </div>
                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-blue-100 text-blue-700">
                  Role: ADMIN
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition shadow-xs"
            >
              <span>Vào Studio Bài Giảng</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Global search input */}
              <div className="relative w-64 md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm lesson, trace id, user, model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Time Filter & Quick Actions */}
            <div className="flex items-center space-x-3">
              {/* Time window selector */}
              <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium text-slate-600">
                {(['today', '7d', '30d', '90d'] as TimeFilter[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeFilter(tf)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      timeFilter === tf
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    {tf === 'today' ? 'Hôm nay' : tf === '7d' ? '7 ngày' : tf === '30d' ? '30 ngày' : '90 ngày'}
                  </button>
                ))}
              </div>

              {/* Notifications */}
              <NavLink
                to="/admin/errors"
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                title="Trung tâm sự cố"
              >
                <Bell className="w-4 h-4" />
                {unresolvedErrorsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500"></span>
                )}
              </NavLink>

              {/* Langfuse quick button */}
              <a
                href={adminTelemetryService.getLangfuseTraceUrl()}
                target="_blank"
                rel="noreferrer"
                className="hidden md:inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition"
              >
                <Flame className="w-3.5 h-3.5 text-blue-600" />
                <span>Open Langfuse</span>
                <ArrowUpRight className="w-3 h-3 text-blue-400" />
              </a>
            </div>
          </header>

          {/* Page Content Outlet */}
          <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  );
};
