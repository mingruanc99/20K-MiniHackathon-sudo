// src/components/layout/Navbar.tsx
import React,{ useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck, SlidersHorizontal, LayoutGrid, Cpu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiKeyService, PROVIDERS, ActiveAIState } from '../../services/llm/apiKeyService';
import { ApiKeyModal } from '../common/ApiKeyModal';
import { PRODUCT_NAME } from '../../config/brand';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-paper text-cover' : 'text-paper/80 hover:bg-cover-deep hover:text-paper'
  }`;

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [aiState, setAiState] = useState<ActiveAIState>(() => apiKeyService.getActiveAIState());

  useEffect(() => apiKeyService.subscribe(setAiState), []);

  const provider = PROVIDERS[aiState.provider] || PROVIDERS.gemini;
  const isAdmin = user?.role === 'admin' || user?.email?.toLowerCase() === 'hkthien@husc.edu.vn';

  return (
    <>
      <header className="ledger-world sticky top-0 z-40 border-b-4 border-cover-deep bg-cover text-paper">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cover-foil">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-cover-foil/60 font-hand text-lg text-cover-foil">V</span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-wide text-cover-foil">{PRODUCT_NAME}</span>
              <span className="hidden text-xs text-paper/60 sm:block">Sổ bài giảng</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1" aria-label="Điều hướng chính">
            <NavLink to="/" end className={navClass}>
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Sổ bài giảng</span>
            </NavLink>
            <NavLink to="/knowledge" className={navClass}>
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Nâng cao</span>
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navClass}>
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Quản trị</span>
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsKeyModalOpen(true)}
              title="Đổi mô hình AI hoặc API key"
              className="hidden items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1.5 text-xs text-paper/80 transition-colors hover:border-white/40 hover:text-paper md:inline-flex"
            >
              <Cpu className="h-3.5 w-3.5 text-cover-foil" />
              <span className="font-medium">{provider.name.split(' ')[0]}</span>
              <span className="font-mono text-xs text-paper/60">{aiState.model}</span>
            </button>

            {user ? (
              <div className="flex items-center gap-1 border-l border-white/15 pl-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full border border-white/30 object-cover" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-cover-deep text-xs font-semibold text-cover-foil" aria-hidden>
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-[160px] truncate text-sm text-paper/90 lg:inline">{user.displayName || user.email}</span>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate('/login');
                  }}
                  title="Đăng xuất"
                  aria-label="Đăng xuất"
                  className="rounded-lg p-2 text-paper/60 transition-colors hover:bg-cover-deep hover:text-paper"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link to="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium text-cover-foil hover:bg-cover-deep">
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>

      <ApiKeyModal isOpen={isKeyModalOpen} onClose={() => setIsKeyModalOpen(false)} />
    </>
  );
};
