import React, { useState, useEffect } from 'react';
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
  X,
  RefreshCw
} from 'lucide-react';

export const AdminErrorCenterPage: React.FC = () => {
  const [errors, setErrors] = useState<ErrorRecord[]>(() => adminTelemetryService.getErrorRecords());
  const [selectedError, setSelectedError] = useState<ErrorRecord | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    await adminTelemetryService.syncRealData();
    setErrors([...adminTelemetryService.getErrorRecords()]);
    setLoading(false);
  };

  useEffect(() => {
    const unsub = adminTelemetryService.subscribe(() => {
      setErrors([...adminTelemetryService.getErrorRecords()]);
    });
    return () => unsub();
  }, []);

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
          <h1 className="text-xl font-bold text-ink tracking-tight flex items-center space-x-2">
            <AlertOctagon className="w-5 h-5 text-pen" />
            <span>Centralized Error Center</span>
          </h1>
          <p className="text-xs text-ink-faint mt-1">
            Trung tâm quản lý và khắc phục sự cố hệ thống: rò rỉ metadata, lỗi ký tự ô vuông đen (■), timeout và ngoại lệ API.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {criticalCount > 0 && (
            <span className="px-2.5 py-1 rounded-xl bg-pen-soft text-pen text-xs font-bold border border-pen-line">
              {criticalCount} Critical Alert
            </span>
          )}
          <span className="px-2.5 py-1 rounded-xl bg-pen-soft text-pen text-xs font-semibold border border-pen-line">
            {unresolvedCount} Chưa giải quyết
          </span>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-paper-sheet rounded-2xl border border-rule shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo lỗi, bài giảng, trace id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-paper-band border border-rule rounded-xl text-xs text-ink-soft focus:outline-none focus:border-print"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs bg-paper-band border border-rule rounded-xl px-2.5 py-1 text-ink-soft focus:outline-none"
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
              className="text-xs bg-paper-band border border-rule rounded-xl px-2.5 py-1 text-ink-soft focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="unresolved">Chưa xử lý (Unresolved)</option>
              <option value="investigating">Đang điều tra</option>
              <option value="resolved">Đã giải quyết (Resolved)</option>
            </select>
          </div>
        </div>

        {/* Errors Table */}
        <div className="overflow-x-auto border border-rule rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-paper-band border-b border-rule text-ink-faint font-semibold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-3">Thời Gian</th>
                <th className="py-3 px-3">Loại Lỗi</th>
                <th className="py-3 px-3">Bài Giảng & Section</th>
                <th className="py-3 px-3">Mô Hình</th>
                <th className="py-3 px-3">Mức Độ</th>
                <th className="py-3 px-3">Trạng Thái</th>
                <th className="py-3 px-3 text-right">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {filteredErrors.map((err) => (
                <tr
                  key={err.id}
                  onClick={() => setSelectedError(err)}
                  className="hover:bg-paper-band cursor-pointer transition"
                >
                  <td className="py-3 px-3 font-mono text-ink-faint whitespace-nowrap text-xs">
                    {err.timestamp}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="font-mono font-bold text-ink">{err.type}</span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-ink">{err.lessonTitle}</div>
                    <div className="text-[11px] font-mono text-ink-faint">{err.sectionId}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono text-xs text-ink-soft">
                    {err.model}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        err.severity === 'critical'
                          ? 'bg-pen-soft text-pen border border-pen-line'
                          : err.severity === 'high'
                          ? 'bg-pen-soft text-pen border border-pen-line'
                          : 'bg-paper-band text-print'
                      }`}
                    >
                      {err.severity}
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center space-x-1 text-xs font-semibold ${
                        err.status === 'resolved'
                          ? 'text-print'
                          : err.status === 'investigating'
                          ? 'text-pen'
                          : 'text-pen'
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
                        className="px-2.5 py-1 bg-paper-band hover:bg-paper-band text-navy rounded-lg text-xs font-semibold transition"
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
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-paper-band hover:bg-rule text-ink-soft rounded-lg text-xs font-medium transition"
                      >
                        <Flame className="w-3 h-3 text-pen" />
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
        <div className="fixed inset-0 z-50 bg-cover  flex items-center justify-center p-4">
          <div className="bg-paper-sheet max-w-xl w-full rounded-2xl border border-rule shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-rule flex items-center justify-between bg-paper-band">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="w-5 h-5 text-pen" />
                <h3 className="text-sm font-bold text-ink">Chi Tiết Sự Cố Lỗi</h3>
              </div>
              <button
                onClick={() => setSelectedError(null)}
                className="p-1 text-ink-faint hover:text-ink-soft rounded-lg hover:bg-paper-band"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-paper-band p-3.5 rounded-xl border border-rule">
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Loại lỗi</span>
                  <div className="font-mono font-bold text-ink">{selectedError.type}</div>
                </div>
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Mức độ</span>
                  <div className="font-bold text-pen uppercase">{selectedError.severity}</div>
                </div>
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Bài giảng</span>
                  <div className="font-semibold text-ink">{selectedError.lessonTitle}</div>
                </div>
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Section ID</span>
                  <div className="font-mono text-ink">{selectedError.sectionId}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-ink uppercase tracking-wider text-xs">Thông Điệp / Chẩn Đoán Lỗi</span>
                <div className="p-3.5 bg-pen-soft border border-pen-line rounded-xl text-pen leading-relaxed font-mono text-xs">
                  {selectedError.message}
                </div>
              </div>

              {selectedError.traceId && (
                <div className="flex items-center justify-between p-3 bg-paper-band border border-rule rounded-xl">
                  <div>
                    <span className="text-[11px] text-ink-faint uppercase font-semibold">Trace ID</span>
                    <div className="font-mono text-ink">{selectedError.traceId}</div>
                  </div>
                  <a
                    href={adminTelemetryService.getLangfuseTraceUrl(selectedError.traceId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-cover hover:bg-cover text-white rounded-lg text-xs font-semibold transition"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Mở Trace</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-rule bg-paper-band flex justify-between items-center">
              <div>
                {selectedError.status !== 'resolved' && (
                  <button
                    onClick={() => handleResolve(selectedError.id)}
                    className="px-3 py-1.5 bg-print hover:bg-cover text-white text-xs font-semibold rounded-xl transition"
                  >
                    Đánh dấu đã giải quyết (Resolve)
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedError(null)}
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
