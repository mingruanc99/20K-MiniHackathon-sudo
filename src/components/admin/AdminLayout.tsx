// src/components/admin/AdminLayout.tsx
import React, { useState, createContext, useContext, Suspense } from 'react';
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
  // Real average quality score (Module 4); badge hidden when no lesson has been evaluated.
  const avgQuality = adminTelemetryService.getAverageQualityScore();

  const navItems = [
    { label: 'Overview', to: '/admin', exact: true, icon: LayoutDashboard },
    { label: 'Lessons', to: '/admin/lessons', icon: BookOpen },
    {
      label: 'Content Quality',
      to: '/admin/quality',
      icon: CheckCheck,
      badge: avgQuality !== null ? `${avgQuality}/100` : undefined
    },
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
      <div className="ledger-world min-h-screen bg-paper flex text-ink antialiased">
        {/* Mobile menu backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-cover z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 h-screen w-64 bg-paper-sheet border-r border-rule z-50 flex flex-col transition-transform duration-200 ease-in-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Brand header */}
          <div className="h-16 px-5 border-b border-rule flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-cover flex items-center justify-center text-white font-bold text-sm shadow-sm">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-extrabold tracking-wider text-ink uppercase">
                  Admin Control Center
                </div>
                <div className="text-[11px] text-print font-medium flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-print animate-pulse"></span>
                  <span>CLSG-IR Production</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-ink-faint hover:text-ink-soft"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Items */}
          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
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
                      ? 'bg-paper-band text-print font-semibold shadow-xs'
                      : 'text-ink-soft hover:bg-paper-band hover:text-ink'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-print' : 'text-ink-faint'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.alertCount ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-pen text-white shrink-0">
                      {item.alertCount}
                    </span>
                  ) : item.badge ? (
                    <span className="px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-paper-band text-print shrink-0">
                      {item.badge}
                    </span>
                  ) : item.isExternalHub ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-ink-faint" />
                  ) : null}
                </NavLink>
              );
            })}

            <div className="pt-4 px-3 pb-2 text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
              System
            </div>

            <NavLink
              to="/admin/settings"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-paper-band text-print font-semibold'
                    : 'text-ink-soft hover:bg-paper-band hover:text-ink'
                }`
              }
            >
              <Settings className="w-4 h-4 text-ink-faint" />
              <span>Settings & RBAC</span>
            </NavLink>
          </div>

          {/* User profile card & Quick back button */}
          <div className="p-3 border-t border-rule bg-paper-band space-y-2">
            <div className="px-3 py-2 rounded-xl bg-paper-sheet border border-rule/80 shadow-xs flex items-center justify-between">
              <div className="truncate pr-2">
                <div className="text-xs font-bold text-ink truncate">
                  {user?.displayName || 'Huỳnh Khắc Thiên'}
                </div>
                <div className="text-xs text-print font-mono truncate">
                  {user?.email || 'hkthien@husc.edu.vn'}
                </div>
                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[11px] font-bold uppercase bg-paper-band text-print">
                  Role: ADMIN
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-paper-sheet border border-rule text-xs font-medium text-ink-soft hover:bg-paper-band transition shadow-xs"
            >
              <span>Vào Studio Bài Giảng</span>
              <ExternalLink className="w-3.5 h-3.5 text-ink-faint" />
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className="h-16 bg-paper-sheet border-b border-rule px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-1.5 rounded-lg text-ink-faint hover:bg-paper-band"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Global search input */}
              <div className="relative w-64 md:w-80">
                <Search className="w-4 h-4 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm lesson, trace id, user, model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-paper-band hover:bg-paper-band focus:bg-paper-sheet border border-rule focus:border-print rounded-xl text-xs text-ink-soft placeholder-ink-faint focus:outline-none transition"
                />
              </div>
            </div>

            {/* Time Filter & Quick Actions */}
            <div className="flex items-center space-x-3">
              {/* Time window selector */}
              <div className="hidden sm:flex items-center bg-paper-band p-1 rounded-xl border border-rule text-xs font-medium text-ink-soft">
                {(['today', '7d', '30d', '90d'] as TimeFilter[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeFilter(tf)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      timeFilter === tf
                        ? 'bg-paper-sheet text-ink font-semibold shadow-xs'
                        : 'hover:text-ink'
                    }`}
                  >
                    {tf === 'today' ? 'Hôm nay' : tf === '7d' ? '7 ngày' : tf === '30d' ? '30 ngày' : '90 ngày'}
                  </button>
                ))}
              </div>

              {/* Notifications */}
              <NavLink
                to="/admin/errors"
                className="relative p-2 text-ink-faint hover:text-ink hover:bg-paper-band rounded-xl transition"
                title="Trung tâm sự cố"
              >
                <Bell className="w-4 h-4" />
                {unresolvedErrorsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-pen"></span>
                )}
              </NavLink>

              {/* Langfuse quick button */}
              <a
                href={adminTelemetryService.getLangfuseTraceUrl()}
                target="_blank"
                rel="noreferrer"
                className="hidden md:inline-flex items-center space-x-1.5 px-3 py-1.5 bg-paper-band hover:bg-paper-band text-navy border border-rule-strong rounded-xl text-xs font-semibold transition"
              >
                <Flame className="w-3.5 h-3.5 text-print" />
                <span>Open Langfuse</span>
                <ArrowUpRight className="w-3 h-3 text-print-soft" />
              </a>
            </div>
          </header>

          {/* Page Content Outlet */}
          <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
            <Suspense fallback={<div className="py-16 text-center text-sm text-ink-soft">Đang mở trang…</div>}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  );
};
