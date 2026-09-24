// src/components/layout/Navbar.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  BookOpen,
  LogOut,
  Plus,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  UploadCloud,
  Database,
  KeyRound,
  ChevronDown
} from 'lucide-react';
import { apiKeyService, PROVIDERS, ActiveAIState } from '../../services/llm/apiKeyService';
import { ApiKeyModal } from '../common/ApiKeyModal';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [aiState, setAiState] = useState<ActiveAIState>(() => apiKeyService.getActiveAIState());

  useEffect(() => {
    const unsub = apiKeyService.subscribe((newState) => {
      setAiState(newState);
    });
    return unsub;
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const providerMeta = PROVIDERS[aiState.provider] || PROVIDERS.gemini;
  const currentModelMeta = providerMeta.models.find((m) => m.id === aiState.model);
  const displayModelName = currentModelMeta ? currentModelMeta.name.split(' ')[0] : aiState.model;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm group-hover:bg-indigo-700 transition">
                C
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 tracking-tight text-base">CLSG-IR</span>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    v1.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">Biểu diễn Trung gian Bài giảng Sư phạm cho AI Video</p>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-600">
              <Link to="/dashboard" className="px-3 py-1.5 rounded-md hover:text-slate-900 hover:bg-slate-100 transition">
                Bảng điều khiển
              </Link>
              <Link to="/projects/new" className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 transition flex items-center gap-1.5 text-xs font-semibold">
                <UploadCloud className="w-3.5 h-3.5 text-indigo-600" /> Tải lên bài giảng
              </Link>
              <Link
                to="/knowledge"
                className="px-3 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-800 transition flex items-center gap-1.5 text-xs font-bold"
              >
                <Database className="w-3.5 h-3.5 text-cyan-600" />
                <span>Knowledge Inspector</span>
              </Link>

              {/* Admin Direct Access */}
              {(user?.role === 'admin' || user?.email?.toLowerCase() === 'hkthien@husc.edu.vn') && (
                <Link
                  to="/admin"
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 text-xs font-bold shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin Dashboard</span>
                </Link>
              )}
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Interactive AI Provider & Key Button */}
            <button
              type="button"
              onClick={() => setIsKeyModalOpen(true)}
              title="Nhấn để đổi API Key, chuyển sang Claude/OpenAI hoặc cấu hình mô hình"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-indigo-950 text-white text-xs font-semibold shadow-xs hover:shadow-md transition cursor-pointer border border-slate-700 group"
            >
              <span className="text-sm">{providerMeta.icon}</span>
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-100">{providerMeta.name.split(' ')[0]}:</span>
                <span className="text-slate-300 font-mono text-[11px]">{displayModelName}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30 flex items-center gap-1">
                <KeyRound className="w-2.5 h-2.5" /> Đổi Key / AI
              </span>
            </button>

            {/* User Profile */}
            {user ? (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'Người dùng'} className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs border border-indigo-200">
                      {user.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="hidden lg:block text-left">
                    <div className="text-xs font-semibold text-slate-800 leading-tight">{user.displayName || user.email}</div>
                    <div className="text-[10px] text-slate-500 capitalize">{user.role === 'instructor' ? 'Giảng viên' : user.role === 'student' ? 'Sinh viên' : 'Nghiên cứu viên'}</div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Đăng xuất"
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded border border-indigo-200 hover:bg-indigo-50"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Global API Key & Provider Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
      />
    </>
  );
};
