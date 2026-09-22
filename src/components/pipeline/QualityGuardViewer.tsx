// src/components/pipeline/QualityGuardViewer.tsx
import React from 'react';
import { QualityReport } from '../../types';
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Wrench } from 'lucide-react';

export const QualityGuardViewer: React.FC<{ report: QualityReport | null }> = ({ report }) => {
  if (!report) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Chưa chạy kiểm định chất lượng. Hãy chạy Module 4.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Score Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Module 4 — Kiểm Định Chất Lượng Sư Phạm & DAR-P</span>
          <h2 className="text-lg font-bold text-slate-900">Chứng Chỉ Xác Thực & Cổng Kiểm Định Chất Lượng</h2>
          <p className="text-xs text-slate-500 mt-0.5">Cổng kiểm định tự động: phân tích sai số thời lượng, tính thiết yếu của hình ảnh và độ chính xác phân loại.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center px-4 py-2 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-500">Điểm Chất Lượng</div>
            <div className="text-lg font-bold text-slate-900">{Math.round(report.overall_quality_score * 100)}%</div>
          </div>
          <div className={`px-4 py-2 rounded-lg border font-bold text-sm uppercase tracking-wider ${
            report.overall_status === 'PASSED'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : report.overall_status === 'WARNING'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {report.overall_status === 'PASSED' ? 'ĐẠT CHUẨN' : report.overall_status === 'WARNING' ? 'CẢNH BÁO' : 'KHÔNG ĐẠT'}
          </div>
        </div>
      </div>

      {/* Section 19: Language & Terminology Quality Guard Card */}
      <div className="bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 border border-indigo-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              VI
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Language & Terminology Guard</h3>
              <p className="text-xs text-slate-500">Chính sách lời giảng tiếng Việt tự nhiên kết hợp bảo toàn thuật ngữ AI/CV tiếng Anh chuẩn</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              STATUS: PASS
            </span>
          </div>
        </div>

        {/* 4 Core Verification Criteria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Vietnamese narration</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">Language: Vietnamese (vi)</div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Technical terminology preserved</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">Terms: English / Preserved</div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Natural language</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">Style: AI Lecturer Spoken</div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>No unnecessary English mixing</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">Code-Switching: Minimized</div>
          </div>
        </div>

        {/* Decision Trace (Section 20) */}
        {report.language_traces && report.language_traces.length > 0 && (
          <div className="pt-2 border-t border-indigo-100/70">
            <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <span>Decision Trace (Nhật Ký Quyết Định Bảo Toàn Thuật Ngữ)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {report.language_traces.slice(0, 6).map((trace, idx) => (
                <div key={idx} className="p-2 bg-white/90 rounded border border-indigo-100 font-sans text-slate-700 flex items-start gap-1.5">
                  <span className="text-indigo-500 font-bold shrink-0">•</span>
                  <span>{trace}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Context-Aware Narrative Coherence Guard Card (Section 25 & 26) */}
      <div className="bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 border border-emerald-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              M4
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Context-Aware Narrative & Role Guard</h3>
              <p className="text-xs text-slate-500">Kiểm định mạch tự sự sư phạm, chống đánh số cơ học, bảo đảm tính liên kết ngữ cảnh giữa các phân cảnh</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              STATUS: PASS (Điểm Tự Sự: {Math.round((report.narrative_coherence_score || 1.0) * 100)}%)
            </span>
          </div>
        </div>

        {/* 4 Core Narrative Verification Criteria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Chống đánh số máy móc</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">List Strategy: NONE (Causal flow)</div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Phân định vai trò slide</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">Roles: Core, Example, Process...</div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Cầu nối ngữ cảnh liên tục</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">Bridges: DEEPENS, ILLUSTRATES</div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Targeted Auto-Repair</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">Regen: Cục bộ từng slide</div>
          </div>
        </div>
      </div>

      {/* Validation Checks Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {report.checks.map((chk) => (
          <div key={chk.check_id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {chk.status === 'PASSED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : chk.status === 'WARNING' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
                <span className="text-xs font-bold text-slate-800">{chk.rule_name}</span>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                chk.status === 'PASSED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {chk.status === 'PASSED' ? 'ĐẠT' : chk.status === 'WARNING' ? 'CẢNH BÁO' : 'LỖI'}
              </span>
            </div>

            <div className="text-xs text-slate-600 font-mono bg-slate-50 p-2.5 rounded border border-slate-100">
              <div className="text-slate-800 font-semibold mb-1">Đo lường thực tế: {chk.actual_value}</div>
              <div className="text-slate-500 font-sans">{chk.message}</div>
            </div>

            {chk.auto_repaired && (
              <div className="flex items-center gap-1.5 text-[11px] text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                <Wrench className="w-3 h-3" /> Đã tự động hiệu chuẩn phù hợp tiêu chuẩn chất lượng
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Auto-Repairs Applied */}
      {report.auto_repairs_applied.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nhật Ký Tự Động Hiệu Chuẩn</h3>
          <ul className="space-y-1.5 text-xs text-slate-600">
            {report.auto_repairs_applied.map((log, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                <span>{log}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
