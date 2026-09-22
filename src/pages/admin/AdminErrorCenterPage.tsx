// src/pages/admin/AdminErrorCenterPage.tsx
import React, { useState } from 'react';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import { ErrorRecord, ErrorSeverity } from '../../types';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Flame,
  ArrowUpRight,
  Check,
  RotateCcw,
  X
} from 'lucide-react';

export const AdminErrorCenterPage: React.FC = () => {
  const [errors, setErrors] = useState<ErrorRecord[]>(() => adminTelemetryService.getErrorRecords());
  const [selectedError, setSelectedError] = useState<ErrorRecord | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const handleResolve = (errId: string) => {
    adminTelemetryService.resolveError(errId);
    setErrors([...adminTelemetryService.getErrorRecords()]);
    if (selectedError?.id === errId) {
      setSelectedError({ ...selectedError, status: 'resolved' });
    }
  };

  const filteredErrors = errors.filter((e) => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.lessonTitle.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.message.toLowerCase().includes(q) ||
        (e.traceId && e.traceId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const unresolvedCount = errors.filter((e) => e.status !== 'resolved').length;
  const criticalCount = errors.filter((e) => e.severity === 'critical' && e.status !== 'resolved').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <AlertOctagon className="w-5 h-5 text-rose-600" />
            <span>Centralized Error Center</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Trung tâm quản lý và khắc phục sự cố hệ thống: rò rỉ metadata, lỗi ký tự ô vuông đen (■), timeout và ngoại lệ API.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {criticalCount > 0 && (
            <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200">
              {criticalCount} Critical Alert
            </span>
          )}
          <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
            {unresolvedCount} Chưa giải quyết
          </span>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo lỗi, bài giảng, trace id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả mức độ</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="unresolved">Chưa xử lý (Unresolved)</option>
              <option value="investigating">Đang điều tra</option>
              <option value="resolved">Đã giải quyết (Resolved)</option>
            </select>
          </div>
        </div>

        {/* Errors Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Thời Gian</th>
                <th className="py-3 px-3">Loại Lỗi</th>
                <th className="py-3 px-3">Bài Giảng & Section</th>
                <th className="py-3 px-3">Mô Hình</th>
                <th className="py-3 px-3">Mức Độ</th>
                <th className="py-3 px-3">Trạng Thái</th>
                <th className="py-3 px-3 text-right">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredErrors.map((err) => (
                <tr
                  key={err.id}
                  onClick={() => setSelectedError(err)}
                  className="hover:bg-slate-50/60 cursor-pointer transition"
                >
                  <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                    {err.timestamp}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="font-mono font-bold text-slate-800">{err.type}</span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-800">{err.lessonTitle}</div>
                    <div className="text-[10px] font-mono text-slate-400">{err.sectionId}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-700">
                    {err.model}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        err.severity === 'critical'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : err.severity === 'high'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {err.severity}
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center space-x-1 text-xs font-semibold ${
                        err.status === 'resolved'
                          ? 'text-emerald-600'
                          : err.status === 'investigating'
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {err.status === 'resolved' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Resolved</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{err.status}</span>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                    {err.status !== 'resolved' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResolve(err.id);
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition"
                      >
                        Đánh dấu đã sửa
                      </button>
                    )}
                    {err.traceId && (
                      <a
                        href={adminTelemetryService.getLangfuseTraceUrl(err.traceId)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition"
                      >
                        <Flame className="w-3 h-3 text-orange-500" />
                        <span>Trace</span>
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error Detail Modal */}
      {selectedError && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">Chi Tiết Sự Cố Lỗi</h3>
              </div>
              <button
                onClick={() => setSelectedError(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Loại lỗi</span>
                  <div className="font-mono font-bold text-slate-900">{selectedError.type}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Mức độ</span>
                  <div className="font-bold text-rose-600 uppercase">{selectedError.severity}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Bài giảng</span>
                  <div className="font-semibold text-slate-800">{selectedError.lessonTitle}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Section ID</span>
                  <div className="font-mono text-slate-800">{selectedError.sectionId}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Thông Điệp / Chẩn Đoán Lỗi</span>
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 leading-relaxed font-mono text-xs">
                  {selectedError.message}
                </div>
              </div>

              {selectedError.traceId && (
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Trace ID</span>
                    <div className="font-mono text-slate-800">{selectedError.traceId}</div>
                  </div>
                  <a
                    href={adminTelemetryService.getLangfuseTraceUrl(selectedError.traceId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Mở Trace</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                {selectedError.status !== 'resolved' && (
                  <button
                    onClick={() => handleResolve(selectedError.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition"
                  >
                    Đánh dấu đã giải quyết (Resolve)
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedError(null)}
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
