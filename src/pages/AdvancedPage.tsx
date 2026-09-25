// src/pages/AdvancedPage.tsx
/**
 * "Nâng cao": the full studio that used to be the home page, plus the detailed tools.
 * Everything here is optional for a lecturer; the simple flow lives on the board.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Database, FilePlus2, ShieldCheck, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DashboardPage } from './DashboardPage';

export const AdvancedPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.email?.toLowerCase() === 'hkthien@husc.edu.vn';

  const tools = [
    { to: '/projects/new', icon: FilePlus2, title: 'Tạo dự án chi tiết', desc: 'Toàn bộ tuỳ chọn: WPM, phong cách, mật độ hình ảnh, thuật ngữ.' },
    { to: '/knowledge', icon: Database, title: 'Knowledge Inspector', desc: 'Sơ đồ cây trọng số, vùng ảnh, kết quả OCR của từng bài.' },
    ...(isAdmin
      ? [
          { to: '/admin', icon: ShieldCheck, title: 'Quản trị hệ thống', desc: 'Người dùng, chất lượng nội dung, LLM, TTS, Langfuse.' },
          { to: '/admin/evaluation', icon: BarChart3, title: 'Benchmark & log', desc: 'Chỉ số từng lần chạy, token, chạy hồi quy.' }
        ]
      : [])
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Nâng cao</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-faint">
          Studio đầy đủ theo từng module (M1–M4), dữ liệu trung gian CLSG-IR và các công cụ kiểm tra. Không bắt buộc để tạo bài giảng.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((t) => (
          <li key={t.to}>
            <Link to={t.to} className="flex h-full gap-3 rounded-2xl border border-rule bg-paper-sheet p-4 transition-colors hover:border-rule-strong hover:bg-paper-band">
              <t.icon className="mt-0.5 h-5 w-5 shrink-0 text-print" />
              <span>
                <span className="block text-sm font-semibold text-ink">{t.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">{t.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="border-t border-rule pt-6">
        <DashboardPage />
      </div>
    </div>
  );
};

export default AdvancedPage;
