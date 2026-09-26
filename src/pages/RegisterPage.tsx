// src/pages/RegisterPage.tsx
import React,{ useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, User as UserIcon, AlertCircle } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { registerWithEmail, loginAsDemo } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng điền đầy đủ email và mật khẩu.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await registerWithEmail(email, password, name);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Đăng ký thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoRegister = () => {
    loginAsDemo({
      displayName: name || email.split('@')[0] || 'Academic Instructor',
      email: email || 'instructor@academic.edu',
      role: 'instructor'
    });
    navigate('/dashboard');
  };

  return (
    <div className="ledger-world min-h-screen bg-paper flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-cover flex items-center justify-center text-white font-bold text-2xl shadow-sm mx-auto mb-3">
          C
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-ink">Tạo tài khoản Giảng viên / Nghiên cứu</h2>
        <p className="mt-1 text-xs text-ink-faint">Truy cập VideoLearn</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-paper-sheet py-8 px-6 shadow-sm rounded-2xl border border-rule sm:px-10 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-pen-soft border border-pen-line text-xs text-pen space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-pen shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={handleDemoRegister}
                className="w-full mt-1 py-1.5 px-3 bg-pen-soft hover:bg-pen-line text-pen rounded font-semibold text-xs transition text-center"
              >
                👉 Bấm vào đây để tạo tài khoản nhanh ở chế độ Demo
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">Họ & Tên</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="GS. Nguyễn Văn A"
                  className="w-full pl-9 pr-3 py-2 border border-rule-strong rounded-lg text-xs focus:ring-2 focus:ring-print outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="instructor@university.edu.vn"
                  className="w-full pl-9 pr-3 py-2 border border-rule-strong rounded-lg text-xs focus:ring-2 focus:ring-print outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">Mật khẩu</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-faint absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 border border-rule-strong rounded-lg text-xs focus:ring-2 focus:ring-print outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-lg text-xs font-semibold text-white bg-cover hover:bg-cover transition"
            >
              {loading ? 'Đang tạo tài khoản...' : 'Tạo Tài Khoản'}
            </button>
          </form>

          <div className="text-center text-xs text-ink-faint">
            Đã có tài khoản?{' '}
            <Link to="/login" className="font-semibold text-navy hover:text-navy">
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

