// src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, ArrowRight, ShieldCheck, Mail, Lock, UserCheck, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signInWithGoogle, loginWithEmail, loginAsDemo } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await loginWithEmail(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [showCustomGoogle, setShowCustomGoogle] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Đăng nhập bằng Google không thành công.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoogleEmail.trim()) return;
    const name = customGoogleEmail.split('@')[0];
    loginAsDemo({
      displayName: `${name} (Google Account)`,
      email: customGoogleEmail,
      role: 'instructor'
    });
    navigate('/dashboard');
  };

  const handleInstantDemoLogin = (roleName = 'Prof. Alex Rivers', emailStr = 'alex.rivers@stanford.edu') => {
    setLoading(true);
    loginAsDemo({
      displayName: roleName,
      email: emailStr,
      role: 'instructor'
    });
    navigate('/dashboard');
  };

  const isDomainError = error.includes('AUTH_UNAUTHORIZED_DOMAIN');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-sm">
            C
          </div>
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          CLSG-IR Studio
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Configurable Lecture Script & Visual Intent Representation for AI Video Synthesis
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm rounded-2xl border border-slate-200 sm:px-10 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{error.replace('AUTH_UNAUTHORIZED_DOMAIN: ', '')}</span>
              </div>

              {isDomainError && (
                <div className="p-3 bg-white rounded-lg border border-amber-200 space-y-2 text-[11px] text-slate-700">
                  <div className="font-bold text-slate-900">⚡ Để Google bật popup chọn tài khoản trên Vercel:</div>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>
                      Mở{' '}
                      <a
                        href="https://console.firebase.google.com/project/clsg-ir-studio/authentication/settings"
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 font-bold underline"
                      >
                        Firebase Console &gt; Authorized domains
                      </a>
                    </li>
                    <li>
                      Nhấn <b>Add domain</b> và dán: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-mono font-bold">clsg-ir-studio.vercel.app</code>
                    </li>
                    <li>Quay lại đây bấm <b>Đăng nhập bằng Google</b> (sẽ hiện bảng chọn tài khoản ngay).</li>
                  </ol>
                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Hoặc đăng nhập bằng email Google của bạn:</span>
                    <button
                      type="button"
                      onClick={() => setShowCustomGoogle(true)}
                      className="text-indigo-600 font-bold underline"
                    >
                      Nhập email Google
                    </button>
                  </div>
                </div>
              )}

              {!isDomainError && (
                <button
                  type="button"
                  onClick={() => handleInstantDemoLogin('Academic Researcher', email || 'researcher@demo.edu')}
                  className="w-full py-1.5 px-3 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-semibold text-[11px] transition text-center"
                >
                  👉 Bấm vào đây để vào thẳng bằng chế độ Demo với tài khoản này
                </button>
              )}
            </div>
          )}

          {/* Custom Google Account Modal / Form */}
          {showCustomGoogle && (
            <form onSubmit={handleCustomGoogleSubmit} className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2 text-xs">
              <div className="font-bold text-indigo-950 flex items-center justify-between">
                <span>Nhập tài khoản Google bạn muốn sử dụng:</span>
                <button
                  type="button"
                  onClick={() => setShowCustomGoogle(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              </div>
              <input
                type="email"
                required
                value={customGoogleEmail}
                onChange={(e) => setCustomGoogleEmail(e.target.value)}
                placeholder="tenban@gmail.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition"
              >
                Đăng nhập với tài khoản Google này
              </button>
            </form>
          )}

          {/* 1-Click Instant Demo Access (100% Reliable) */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Truy cập nhanh (Không cần mật khẩu)
            </label>
            <button
              type="button"
              onClick={() => handleInstantDemoLogin('Prof. Alex Rivers', 'alex.rivers@stanford.edu')}
              className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition shadow-xs group"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span className="font-semibold">⚡ 1-Click Demo: Prof. Alex Rivers</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-mono">Stanford</span>
            </button>

            <button
              type="button"
              onClick={() => handleInstantDemoLogin('Dr. Elena Rostova', 'elena.rostova@mit.edu')}
              className="w-full flex items-center justify-between py-2 px-4 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition shadow-xs group"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                <span className="font-medium">1-Click Demo: Dr. Elena Rostova</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-200 text-indigo-900 font-mono">MIT</span>
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-medium">Hoặc đăng nhập Firebase</span>
            </div>
          </div>

          {/* Google Sign-in */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2 px-4 border border-slate-300 rounded-xl shadow-xs bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Đăng nhập bằng Google</span>
          </button>

          {/* Email / Password */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex.rivers@stanford.edu"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 rounded-lg shadow-xs text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition"
            >
              {loading ? 'Đang xác thực...' : 'Đăng nhập với Email'}
            </button>
          </form>

          <div className="text-center text-xs text-slate-500">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-800">
              Đăng ký tài khoản
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

