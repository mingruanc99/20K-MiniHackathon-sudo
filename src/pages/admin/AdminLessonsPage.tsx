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
            <h1 className="text-xl font-bold text-ink tracking-tight">Lessons Management</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-paper-band text-print border border-rule-strong">
              <span className="w-1.5 h-1.5 rounded-full bg-print animate-pulse" />
              Dữ Liệu Thật
            </span>
          </div>
          <p className="text-xs text-ink-faint mt-1">
            Quản lý toàn bộ bài giảng trong hệ thống, theo dõi chất lượng sư phạm, trạng thái sinh AI và chi phí thực tế.
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
          <span className="text-xs text-ink-faint font-medium">Tổng số:</span>
          <span className="px-2 py-0.5 rounded-lg bg-paper-band text-print font-bold text-xs font-mono">
            {lessons.length} bài giảng
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-paper-sheet rounded-2xl border border-rule shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm bài giảng, tác giả, id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-paper-band border border-rule rounded-xl text-xs text-ink-soft focus:outline-none focus:border-print"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-ink-faint">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-paper-band border border-rule rounded-xl px-3 py-1.5 text-ink-soft focus:outline-none"
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
        <div className="overflow-x-auto border border-rule rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-paper-band border-b border-rule text-ink-faint font-semibold uppercase text-[11px] tracking-wider">
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
            <tbody className="divide-y divide-rule">
              {filteredLessons.map((lesson) => (
                <tr
                  key={lesson.id}
                  onClick={() => setSelectedLesson(lesson)}
                  className="hover:bg-paper-band cursor-pointer transition"
                >
                  <td className="py-3 px-3">
                    <div className="font-semibold text-ink">{lesson.title}</div>
                    <div className="text-[11px] font-mono text-ink-faint">{lesson.id}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-ink-soft">{lesson.author}</div>
                    <div className="text-[11px] text-ink-faint font-mono">{lesson.authorEmail}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono">{lesson.sectionsCount} slides</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        lesson.status === 'Published'
                          ? 'bg-paper-band text-print'
                          : lesson.status === 'Generating'
                          ? 'bg-paper-band text-print animate-pulse'
                          : 'bg-paper-band text-ink-soft'
                      }`}
                    >
                      {lesson.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {lesson.qualityScore > 0 ? (
                      <>
                        <span className="font-bold text-ink">{lesson.qualityScore}</span>
                        <span className="text-[11px] text-ink-faint">/100</span>
                      </>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono text-print font-semibold">
                    ${lesson.aiCost.toFixed(4)}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-ink-faint font-mono text-xs">
                    {lesson.lastUpdated}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLesson(lesson);
                      }}
                      className="px-2.5 py-1 bg-paper-band hover:bg-rule text-ink-soft rounded-lg text-xs font-medium transition"
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
        <div className="fixed inset-0 z-50 bg-cover  flex items-center justify-center p-4">
          <div className="bg-paper-sheet max-w-3xl w-full rounded-2xl border border-rule shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-rule flex items-center justify-between bg-paper-band">
              <div className="flex items-center space-x-2.5">
                <BookOpen className="w-5 h-5 text-print" />
                <div>
                  <h3 className="text-sm font-bold text-ink">{selectedLesson.title}</h3>
                  <div className="text-xs text-ink-faint font-mono">Tác giả: {selectedLesson.author} ({selectedLesson.authorEmail})</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLesson(null)}
                className="p-1 text-ink-faint hover:text-ink-soft rounded-lg hover:bg-paper-band"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
              {/* Technical Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-paper-band p-4 rounded-xl border border-rule/80">
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Điểm Chất Lượng</span>
                  <div className="text-base font-bold text-print">
                    {selectedLesson.qualityScore > 0 ? `${selectedLesson.qualityScore}/100` : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">AI Cost</span>
                  <div className="text-base font-mono font-bold text-ink">${selectedLesson.aiCost.toFixed(4)}</div>
                </div>
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Mô hình AI</span>
                  <div className="font-mono text-xs font-semibold text-ink">{selectedLesson.model}</div>
                </div>
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Latency TB</span>
                  <div className="font-mono text-xs font-semibold text-ink">
                    {selectedLesson.latencyMs > 0 ? `${selectedLesson.latencyMs}ms` : '—'}
                  </div>
                </div>
              </div>

              {/* Sections Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-ink text-xs uppercase tracking-wider flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-print" />
                    <span>Danh Sách Phân Cảnh (Sections Breakdown)</span>
                  </h4>
                  <span className="text-xs text-ink-faint font-mono">{selectedLesson.sections.length} sections</span>
                </div>

                <div className="space-y-2.5">
                  {selectedLesson.sections.map((sec) => (
                    <div
                      key={sec.id}
                      className="p-3.5 bg-paper-band border border-rule rounded-xl space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-print bg-paper-band px-1.5 py-0.5 rounded text-[11px]">
                            {sec.id}
                          </span>
                          <span className="font-semibold text-ink">{sec.title}</span>
                          <span className="text-[11px] text-ink-faint uppercase font-mono">[{sec.role}]</span>
                        </div>
                        <span className="text-ink-faint font-mono text-[11px]">{sec.durationSec}s</span>
                      </div>
                      <p className="text-ink-soft text-xs leading-relaxed pl-2 border-l-2 border-rule-strong">
                        "{sec.narration}"
                      </p>
                    </div>
                  ))}

                  {selectedLesson.sections.length === 0 && (
                    <div className="p-4 text-center text-ink-faint bg-paper-band rounded-xl border border-dashed border-rule">
                      Bài giảng đang trong trạng thái khởi tạo phân cảnh.
                    </div>
                  )}
                </div>
              </div>

              {/* Trace Deep Link */}
              <div className="flex items-center justify-between p-3.5 bg-paper-band border border-rule-strong rounded-xl">
                <div>
                  <div className="text-[11px] text-print font-semibold uppercase">Langfuse Trace ID</div>
                  <div className="font-mono text-xs text-ink">{selectedLesson.traceId}</div>
                </div>

                <a
                  href={adminTelemetryService.getLangfuseTraceUrl(selectedLesson.traceId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-cover hover:bg-cover text-white rounded-lg text-xs font-semibold transition shadow-xs"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Inspect Trace</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-rule bg-paper-band flex items-center justify-between">
              <Link
                to={`/projects/${selectedLesson.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cover hover:bg-cover text-white font-medium text-xs rounded-xl transition shadow-xs"
              >
                <span>Mở Trong Studio Bài Giảng</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSelectedLesson(null)}
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
