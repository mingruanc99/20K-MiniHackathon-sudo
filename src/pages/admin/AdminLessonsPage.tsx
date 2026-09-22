// src/pages/admin/AdminLessonsPage.tsx
import React, { useState, useEffect } from 'react';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  ExternalLink,
  Flame,
  ArrowUpRight,
  X,
  FileText,
  DollarSign,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { LessonAdminItem } from '../../types';

export const AdminLessonsPage: React.FC = () => {
  const [selectedLesson, setSelectedLesson] = useState<LessonAdminItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [lessons, setLessons] = useState<LessonAdminItem[]>(() => adminTelemetryService.getLessons());
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    await adminTelemetryService.syncRealData();
    setLessons(adminTelemetryService.getLessons());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const unsub = adminTelemetryService.subscribe(() => {
      setLessons(adminTelemetryService.getLessons());
    });
    return () => unsub();
  }, []);

  const filteredLessons = lessons.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.title.toLowerCase().includes(q) || l.author.toLowerCase().includes(q) || l.id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Lessons Management</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Dữ Liệu Thật
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý toàn bộ bài giảng trong hệ thống, theo dõi chất lượng sư phạm, trạng thái sinh AI và chi phí thực tế.
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
          <span className="text-xs text-slate-500 font-medium">Tổng số:</span>
          <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs font-mono">
            {lessons.length} bài giảng
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm bài giảng, tác giả, id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Published">Published</option>
              <option value="Generating">Generating</option>
              <option value="Draft">Draft</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Lessons Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Bài Giảng</th>
                <th className="py-3 px-3">Tác Giả</th>
                <th className="py-3 px-3">Sections</th>
                <th className="py-3 px-3">Trạng Thái</th>
                <th className="py-3 px-3">Chất Lượng</th>
                <th className="py-3 px-3">AI Cost</th>
                <th className="py-3 px-3">Cập Nhật</th>
                <th className="py-3 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLessons.map((lesson) => (
                <tr
                  key={lesson.id}
                  onClick={() => setSelectedLesson(lesson)}
                  className="hover:bg-blue-50/40 cursor-pointer transition"
                >
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-800">{lesson.title}</div>
                    <div className="text-[10px] font-mono text-slate-400">{lesson.id}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-700">{lesson.author}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{lesson.authorEmail}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono">{lesson.sectionsCount} slides</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        lesson.status === 'Published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : lesson.status === 'Generating'
                          ? 'bg-blue-100 text-blue-800 animate-pulse'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {lesson.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="font-bold text-slate-800">{lesson.qualityScore}</span>
                    <span className="text-[10px] text-slate-400">/100</span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono text-emerald-600 font-semibold">
                    ${lesson.aiCost.toFixed(4)}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                    {lesson.lastUpdated}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLesson(lesson);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lesson Detail Drawer / Modal */}
      {selectedLesson && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-3xl w-full rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedLesson.title}</h3>
                  <div className="text-[11px] text-slate-400 font-mono">Tác giả: {selectedLesson.author} ({selectedLesson.authorEmail})</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLesson(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
              {/* Technical Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Điểm Chất Lượng</span>
                  <div className="text-base font-bold text-emerald-600">{selectedLesson.qualityScore}/100</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">AI Cost</span>
                  <div className="text-base font-mono font-bold text-slate-800">${selectedLesson.aiCost.toFixed(4)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Mô hình AI</span>
                  <div className="font-mono text-xs font-semibold text-slate-800">{selectedLesson.model}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Latency TB</span>
                  <div className="font-mono text-xs font-semibold text-slate-800">{selectedLesson.latencyMs}ms</div>
                </div>
              </div>

              {/* Sections Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Danh Sách Phân Cảnh (Sections Breakdown)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">{selectedLesson.sections.length} sections</span>
                </div>

                <div className="space-y-2.5">
                  {selectedLesson.sections.map((sec) => (
                    <div
                      key={sec.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded text-[10px]">
                            {sec.id}
                          </span>
                          <span className="font-semibold text-slate-800">{sec.title}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">[{sec.role}]</span>
                        </div>
                        <span className="text-slate-400 font-mono text-[10px]">{sec.durationSec}s</span>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed pl-2 border-l-2 border-blue-200">
                        "{sec.narration}"
                      </p>
                    </div>
                  ))}

                  {selectedLesson.sections.length === 0 && (
                    <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Bài giảng đang trong trạng thái khởi tạo phân cảnh.
                    </div>
                  )}
                </div>
              </div>

              {/* Trace Deep Link */}
              <div className="flex items-center justify-between p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl">
                <div>
                  <div className="text-[10px] text-blue-600 font-semibold uppercase">Langfuse Trace ID</div>
                  <div className="font-mono text-xs text-slate-800">{selectedLesson.traceId}</div>
                </div>

                <a
                  href={adminTelemetryService.getLangfuseTraceUrl(selectedLesson.traceId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition shadow-xs"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Inspect Trace</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <Link
                to={`/projects/${selectedLesson.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition shadow-xs"
              >
                <span>Mở Trong Studio Bài Giảng</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSelectedLesson(null)}
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
