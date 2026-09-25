// src/pages/admin/AdminContentQualityPage.tsx
import React, { useState, useEffect } from 'react';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import { ContentQualityIssue, QualityIssueType, ErrorSeverity } from '../../types';
import { CompactChart } from '../../components/admin/CompactChart';
import {
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  Filter,
  Eye,
  X,
  Search,
  Check,
  ShieldCheck,
  SplitSquareVertical,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export const AdminContentQualityPage: React.FC = () => {
  const [data, setData] = useState(() => adminTelemetryService.getContentQualityData());
  const [selectedIssue, setSelectedIssue] = useState<ContentQualityIssue | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    await adminTelemetryService.syncRealData();
    setData(adminTelemetryService.getContentQualityData());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const unsub = adminTelemetryService.subscribe(() => {
      setData(adminTelemetryService.getContentQualityData());
    });
    return () => unsub();
  }, []);

  const hasScan = data.scannedScenes > 0;
  const overallScore = data.qualityMetrics.overallQualityScore;
  const scanRate = (v: number) => (hasScan ? `${v}%` : '—');
  const qualityTrend = adminTelemetryService.getQualityTrend();

  const qualityRateCards = [
    { label: 'Overall Quality Score', value: overallScore > 0 ? `${overallScore}/100` : '—', status: 'safe', target: 'Target > 95' },
    { label: 'Metadata Leakage Rate', value: scanRate(data.qualityMetrics.metadataLeakageRate), status: 'safe', target: '0% Allowed' },
    { label: 'Invalid Character Rate (■)', value: scanRate(data.qualityMetrics.invalidCharacterRate), status: 'safe', target: '0% Allowed' },
    { label: 'Duplicate Sentence Rate', value: scanRate(data.qualityMetrics.duplicateRate), status: 'safe', target: '0% Allowed' },
    { label: 'Filler Overuse Rate', value: scanRate(data.qualityMetrics.fillerRate), status: 'safe', target: '< 2%' },
    { label: 'Role Violation Rate', value: scanRate(data.qualityMetrics.sectionRoleViolationRate), status: 'safe', target: '< 1%' },
    { label: 'Generation Error Rate', value: adminTelemetryService.getAILlmData().totalRequests > 0 ? `${data.qualityMetrics.generationErrorRate}%` : '—', status: 'safe', target: '< 2%' }
  ];

  const filteredIssues = data.issues.filter((iss) => {
    if (filterType !== 'all' && iss.issueType !== filterType) return false;
    if (filterSeverity !== 'all' && iss.severity !== filterSeverity) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        iss.lessonTitle.toLowerCase().includes(q) ||
        iss.sectionId.toLowerCase().includes(q) ||
        iss.rawOutput.toLowerCase().includes(q) ||
        (iss.traceId && iss.traceId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-ink tracking-tight">Content Quality Center</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-paper-band text-print border border-rule-strong">
              <span className="w-1.5 h-1.5 rounded-full bg-print animate-pulse" />
              Dữ Liệu Thật (Purifier Real Audit)
            </span>
          </div>
          <p className="text-xs text-ink-faint mt-1">
            Giám sát chất lượng sư phạm, phát hiện rò rỉ metadata, chuẩn hóa ký tự ■ và bảo vệ Zero-Leak cho mọi bài giảng.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-paper-sheet border border-rule text-xs font-medium text-ink-soft hover:bg-paper-band rounded-xl transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-ink-faint ${loading ? 'animate-spin text-print' : ''}`} />
            <span>{loading ? 'Đang quét...' : 'Quét Lại'}</span>
          </button>
          <a
            href={adminTelemetryService.getLangfuseTraceUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-cover hover:bg-cover text-white text-xs font-semibold rounded-xl transition shadow-xs self-start sm:self-auto"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Langfuse Quality Traces</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {qualityRateCards.map((card, i) => (
          <div key={i} className="bg-paper-sheet p-3.5 rounded-xl border border-rule shadow-xs space-y-1">
            <span className="text-xs font-medium text-ink-faint line-clamp-1">{card.label}</span>
            <div className="text-lg font-bold text-ink">{card.value}</div>
            <div className="text-[11px] text-print font-medium flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>{card.target}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quality Trend & Error Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quality Trend */}
        <div className="lg:col-span-2 bg-paper-sheet p-5 rounded-2xl border border-rule shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xs font-bold text-ink uppercase tracking-wider">
                Chất Lượng Sư Phạm & Tỷ Lệ Sạch Siêu Dữ Liệu Theo Thời Gian
              </h2>
              <p className="text-xs text-ink-faint">Điểm Quality Guard của từng bài giảng, sắp theo thời gian cập nhật</p>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-paper-band text-print">
              {overallScore > 0 ? `Score: ${overallScore} / 100` : 'Chưa có dữ liệu'}
            </span>
          </div>

          <CompactChart
            data={qualityTrend}
            color="#10b981"
            fillColor="rgba(16, 185, 129, 0.08)"
            type="area"
            valueSuffix="/100"
            height={180}
          />
        </div>

        {/* Error Distribution */}
        <div className="bg-paper-sheet p-5 rounded-2xl border border-rule shadow-xs space-y-4">
          <div>
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider">
              Phân Bố Loại Lỗi Phát Hiện (Tự Động Làm Sạch)
            </h2>
            <p className="text-xs text-ink-faint">Phát hiện bởi ContentPurifierService & Guard</p>
          </div>

          <div className="space-y-3 pt-2">
            {data.errorDistribution.length === 0 && (
              <div className="text-xs text-ink-faint text-center py-6">Chưa có dữ liệu</div>
            )}
            {data.errorDistribution.map((item) => (
              <div key={item.type} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-ink-soft">{item.type}</span>
                  <span className="font-mono text-ink-faint">
                    {item.count} vụ ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-paper-band rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-paper-sheet rounded-2xl border border-rule shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider">
              Nhật Ký Sự Cố Nội Dung Đã Ghi Nhận (Recent Content Issues)
            </h2>
            <p className="text-xs text-ink-faint">
              Nhấp vào từng dòng để mở so sánh chi tiết Raw Output vs Cleaned Output và Trace ID
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-faint absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Lọc sự cố..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs bg-paper-band border border-rule rounded-lg text-ink-soft placeholder-ink-faint focus:outline-none focus:border-print"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs bg-paper-band border border-rule rounded-lg px-2.5 py-1 text-ink-soft focus:outline-none"
            >
              <option value="all">Tất cả loại lỗi</option>
              <option value="INVALID_CHARACTER">INVALID_CHARACTER (■ / 1^-4)</option>
              <option value="METADATA_LEAK">METADATA_LEAK</option>
              <option value="DUPLICATE_CONTENT">DUPLICATE_CONTENT</option>
              <option value="FILLER_CONTENT">FILLER_CONTENT</option>
              <option value="ROLE_VIOLATION">ROLE_VIOLATION</option>
            </select>

            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="text-xs bg-paper-band border border-rule rounded-lg px-2.5 py-1 text-ink-soft focus:outline-none"
            >
              <option value="all">Tất cả mức độ</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-rule rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-paper-band border-b border-rule text-ink-faint font-semibold uppercase text-[11px] tracking-wider">
                <th className="py-2.5 px-3">Thời gian</th>
                <th className="py-2.5 px-3">Bài giảng & Phân cảnh</th>
                <th className="py-2.5 px-3">Loại sự cố</th>
                <th className="py-2.5 px-3">Mức độ</th>
                <th className="py-2.5 px-3">Model & Prompt</th>
                <th className="py-2.5 px-3">Trạng thái</th>
                <th className="py-2.5 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {filteredIssues.map((issue) => (
                <tr
                  key={issue.id}
                  onClick={() => setSelectedIssue(issue)}
                  className="hover:bg-paper-band cursor-pointer transition"
                >
                  <td className="py-3 px-3 font-mono text-xs text-ink-faint whitespace-nowrap">
                    {issue.timestamp}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-ink">{issue.lessonTitle}</div>
                    <div className="text-[11px] font-mono text-ink-faint">{issue.sectionId}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        issue.issueType === 'INVALID_CHARACTER'
                          ? 'bg-pen-soft text-pen border border-pen-line'
                          : issue.issueType === 'METADATA_LEAK'
                          ? 'bg-pen-soft text-pen border border-pen-line'
                          : 'bg-paper-band text-print border border-rule-strong'
                      }`}
                    >
                      {issue.issueType}
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded text-[11px] font-semibold uppercase ${
                        issue.severity === 'critical'
                          ? 'text-pen'
                          : issue.severity === 'high'
                          ? 'text-pen'
                          : 'text-ink-soft'
                      }`}
                    >
                      {issue.severity}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-mono text-xs text-ink-soft">{issue.model}</div>
                    <div className="text-[11px] text-ink-faint">{issue.promptVersion}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {issue.resolved ? (
                      <span className="inline-flex items-center space-x-1 text-print font-medium text-xs">
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã làm sạch</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-pen font-medium text-xs">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Chờ xử lý</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIssue(issue);
                      }}
                      className="px-2.5 py-1 bg-paper-band hover:bg-rule text-ink-soft rounded-lg text-xs font-medium transition"
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))}
              {filteredIssues.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 px-3 text-center text-ink-faint">
                    {hasScan ? 'Không có sự cố nội dung nào được phát hiện' : 'Chưa có dữ liệu'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue Detail Modal with Raw vs Clean Diff */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 bg-cover  flex items-center justify-center p-4">
          <div className="bg-paper-sheet max-w-2xl w-full rounded-2xl border border-rule shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-rule flex items-center justify-between bg-paper-band">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-paper-band text-print">
                  {selectedIssue.issueType}
                </span>
                <h3 className="text-sm font-bold text-ink">Chi Tiết Sự Cố Nội Dung</h3>
              </div>
              <button
                onClick={() => setSelectedIssue(null)}
                className="p-1 text-ink-faint hover:text-ink-soft rounded-lg hover:bg-paper-band"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-paper-band p-3.5 rounded-xl border border-rule/80">
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Bài giảng</span>
                  <div className="font-semibold text-ink truncate">{selectedIssue.lessonTitle}</div>
                </div>
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Phân cảnh (Section)</span>
                  <div className="font-mono text-ink">{selectedIssue.sectionId}</div>
                </div>
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Mô hình AI</span>
                  <div className="font-mono text-ink">{selectedIssue.model}</div>
                </div>
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Prompt Version</span>
                  <div className="font-mono text-ink">{selectedIssue.promptVersion}</div>
                </div>
              </div>

              {/* Side-by-Side: Raw vs Cleaned Output */}
              <div className="space-y-3">
                <div className="flex items-center space-x-1.5 font-bold text-ink">
                  <SplitSquareVertical className="w-4 h-4 text-print" />
                  <span>So Sánh Đầu Ra (Raw LLM Output vs Cleaned Learner-Facing)</span>
                </div>

                <div className="space-y-2">
                  <div className="p-3.5 bg-pen-soft border border-pen-line rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-[11px] font-bold text-pen uppercase">
                      <span>1. Raw Output (Trước khi xử lý)</span>
                      <span className="text-pen">Chứa lỗi ký tự / rò rỉ metadata</span>
                    </div>
                    <p className="font-mono text-xs text-pen leading-relaxed break-words">
                      {selectedIssue.rawOutput}
                    </p>
                  </div>

                  <div className="p-3.5 bg-paper-band border border-rule-strong rounded-xl space-y-1">
                    <div className="flex justify-between items-center text-[11px] font-bold text-print uppercase">
                      <span>2. Cleaned Output (Sau khi qua ContentPurifierService)</span>
                      <span className="text-print flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Học viên nhìn thấy</span>
                      </span>
                    </div>
                    <p className="font-mono text-xs text-cover leading-relaxed break-words">
                      {selectedIssue.cleanedOutput}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trace Information */}
              <div className="flex items-center justify-between p-3 bg-paper-band border border-rule rounded-xl">
                <div>
                  <span className="text-[11px] text-ink-faint uppercase font-semibold">Langfuse Trace ID</span>
                  <div className="font-mono text-xs text-ink-soft font-semibold">{selectedIssue.traceId || 'N/A'}</div>
                </div>

                {selectedIssue.traceId && (
                  <a
                    href={adminTelemetryService.getLangfuseTraceUrl(selectedIssue.traceId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-cover hover:bg-cover text-white rounded-lg font-semibold text-xs transition shadow-xs"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>View in Langfuse</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-rule bg-paper-band flex justify-end">
              <button
                onClick={() => setSelectedIssue(null)}
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
