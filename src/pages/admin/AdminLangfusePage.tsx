// src/pages/admin/AdminLangfusePage.tsx
import React from 'react';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import {
  Flame,
  ArrowUpRight,
  Shield,
  Layers,
  CheckCircle2,
  ExternalLink,
  Workflow,
  Search,
  Filter,
  Activity,
  Cpu
} from 'lucide-react';

export const AdminLangfusePage: React.FC = () => {
  const langfuse = adminTelemetryService.getLangfuseData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <span>Langfuse AI Observability Hub</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Trung tâm kết nối và giám sát dấu vết AI (Traces, Generations, Latency, Scores) theo kiến trúc SDK Langfuse chính thống.
          </p>
        </div>

        <a
          href={langfuse.summary.projectUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition shadow-xs self-start sm:self-auto"
        >
          <span>Open Langfuse Cloud</span>
          <ArrowUpRight className="w-4 h-4 text-orange-400" />
        </a>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Total Traces</span>
          <div className="text-xl font-bold font-mono text-slate-900">{langfuse.summary.totalTraces.toLocaleString()}</div>
          <span className="text-[10px] text-emerald-600 font-medium">100% Tracked</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Generations Spans</span>
          <div className="text-xl font-bold font-mono text-slate-900">{langfuse.summary.totalGenerations.toLocaleString()}</div>
          <span className="text-[10px] text-blue-600 font-medium">2.0 spans / trace</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Total Telemetry Cost</span>
          <div className="text-xl font-bold font-mono text-emerald-600">${langfuse.summary.totalCost.toFixed(2)}</div>
          <span className="text-[10px] text-slate-400">Gemini Pro & Flash</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Avg Trace Latency</span>
          <div className="text-xl font-bold font-mono text-slate-900">{langfuse.summary.avgLatencyMs}ms</div>
          <span className="text-[10px] text-slate-400">E2E Generation</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Quality Score</span>
          <div className="text-xl font-bold font-mono text-blue-700">{langfuse.summary.qualityScore}/100</div>
          <span className="text-[10px] text-emerald-600 font-medium">Zero-Leak Guarded</span>
        </div>
      </div>

      {/* Architecture & Trace Hierarchy Explanation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div>
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
            <Workflow className="w-4 h-4 text-blue-600" />
            <span>Kiến Trúc Dữ Liệu Phân Cấp (Hierarchical Trace Data Model)</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Cấu trúc cây dấu vết tuân thủ chuẩn phân cấp Langfuse v2, tách biệt 100% siêu dữ liệu kiểm thử khỏi nội dung giảng dạy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-slate-800">
              <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-mono text-[10px]">1</span>
              <span>Session Level</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Đại diện cho phiên làm việc tạo bài giảng của người dùng. Chứa <code className="text-blue-600 font-mono text-[10px]">user_id</code>, <code className="text-blue-600 font-mono text-[10px]">session_id</code>.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-slate-800">
              <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center font-mono text-[10px]">2</span>
              <span>Lesson Generation Trace</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Root trace bao quát toàn bộ bài giảng. Lưu trữ <code className="text-indigo-600 font-mono text-[10px]">lesson_id</code>, <code className="text-indigo-600 font-mono text-[10px]">blueprint_id</code>, tổng thời lượng DAR-P.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-slate-800">
              <span className="w-5 h-5 rounded bg-sky-100 text-sky-700 flex items-center justify-center font-mono text-[10px]">3</span>
              <span>Section Generation Spans</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Nhánh con theo từng phân cảnh (<code className="text-sky-600 font-mono text-[10px]">S1, S2...</code>). Ghi nhận <code className="text-sky-600 font-mono text-[10px]">slide_role</code>, <code className="text-sky-600 font-mono text-[10px]">prompt_version</code>.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-slate-800">
              <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-mono text-[10px]">4</span>
              <span>Purifier & Eval Scores</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Chấm điểm tự động và gắn nhãn xử lý (Purification, Zero-Leak validation, DAR-P accuracy, LLM-as-a-judge score).
            </p>
          </div>
        </div>

        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start space-x-2">
          <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px]">
            <strong>Nguyên tắc bảo vệ bảo mật:</strong> Secret key của Langfuse (<code className="font-mono text-[10px]">LANGFUSE_SECRET_KEY</code>) được giữ hoàn toàn ở backend/serverless layer. Frontend chỉ giao tiếp qua deep-links và telemetry endpoint an toàn.
          </p>
        </div>
      </div>

      {/* Live Traces Table with Deep Links */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Danh Sách Traces Hoạt Động Gần Đây (Live Langfuse Traces)
            </h2>
            <p className="text-[11px] text-slate-400">Deep link trực tiếp đến trang kiểm tra chi tiết trên Langfuse Cloud</p>
          </div>

          <a
            href={langfuse.summary.projectUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline font-semibold inline-flex items-center space-x-1"
          >
            <span>Mở toàn bộ danh sách trong Langfuse</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">Trace ID</th>
                <th className="py-3 px-3">Tên Tác Vụ</th>
                <th className="py-3 px-3">Session & User</th>
                <th className="py-3 px-3">Mô Hình</th>
                <th className="py-3 px-3">Thời Lượng</th>
                <th className="py-3 px-3">Chi Phí</th>
                <th className="py-3 px-3">Tags</th>
                <th className="py-3 px-3 text-right">Deep Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {langfuse.traces.map((trace) => (
                <tr key={trace.traceId} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                    {trace.traceId}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-800">
                    <div>{trace.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{trace.timestamp}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-mono text-[11px] text-slate-700">{trace.sessionId}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{trace.userId}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-700">
                    {trace.model}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-700">
                    {trace.latencyMs}ms
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap font-mono text-emerald-600 font-semibold">
                    ${trace.totalCost.toFixed(4)}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {trace.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-mono"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <a
                      href={trace.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition"
                    >
                      <Flame className="w-3.5 h-3.5 text-blue-600" />
                      <span>Trace</span>
                      <ArrowUpRight className="w-3 h-3 text-blue-400" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
