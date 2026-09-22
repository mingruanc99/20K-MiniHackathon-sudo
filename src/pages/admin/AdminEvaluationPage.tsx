// src/pages/admin/AdminEvaluationPage.tsx
import React, { useState } from 'react';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import { CompactChart } from '../../components/admin/CompactChart';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  Sliders,
  ShieldCheck,
  TrendingUp,
  Brain
} from 'lucide-react';

export const AdminEvaluationPage: React.FC = () => {
  const evalData = adminTelemetryService.getEvaluationData();
  const [evaluatorType, setEvaluatorType] = useState<'llm_judge' | 'rule_based' | 'human'>('llm_judge');

  const dimensionCards = [
    { title: 'Relevance (Sự liên quan)', score: evalData.metrics.relevance, desc: 'Bám sát nội dung slide gốc' },
    { title: 'Accuracy (Độ chính xác)', score: evalData.metrics.accuracy, desc: 'Bảo toàn thuật ngữ kỹ thuật AI' },
    { title: 'Clarity (Tính rõ ràng)', score: evalData.metrics.clarity, desc: 'Diễn giải trực quan, không mơ hồ' },
    { title: 'Conciseness (Súc tích)', score: evalData.metrics.conciseness, desc: 'Đúng ngân sách từ, không dài dòng' },
    { title: 'Structure (Cấu trúc)', score: evalData.metrics.structure, desc: 'Phân định rõ 4 chặng sư phạm' },
    { title: 'Adherence (Tuân thủ chỉ lệnh)', score: evalData.metrics.instructionAdherence, desc: 'Zero-leak nhãn nội bộ & filler' }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI Evaluation & Benchmark</h1>
          <p className="text-xs text-slate-500 mt-1">
            Đánh giá chất lượng sư phạm theo 6 chiều chuẩn hoá (LLM-as-a-Judge, Rule-based Validator, Human Feedback).
          </p>
        </div>

        {/* Evaluator Selector */}
        <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-medium">
          <button
            onClick={() => setEvaluatorType('llm_judge')}
            className={`px-3 py-1.5 rounded-lg transition ${
              evaluatorType === 'llm_judge' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            LLM-as-a-Judge
          </button>
          <button
            onClick={() => setEvaluatorType('rule_based')}
            className={`px-3 py-1.5 rounded-lg transition ${
              evaluatorType === 'rule_based' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rule-based Guard
          </button>
          <button
            onClick={() => setEvaluatorType('human')}
            className={`px-3 py-1.5 rounded-lg transition ${
              evaluatorType === 'human' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Human Feedback
          </button>
        </div>
      </div>

      {/* Main Score Hero Card */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[10px] font-semibold uppercase">
            <Brain className="w-3.5 h-3.5" />
            <span>Benchmark Index: CLSG Pedagogical Evaluation</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Overall Pedagogical Quality Score</h2>
          <p className="text-xs text-blue-200/80 max-w-xl leading-relaxed">
            Điểm tổng hợp phản ánh độ mạch lạc tự sự, chính sách ngôn ngữ tiếng Việt tự nhiên bảo toàn thuật ngữ AI chuẩn, DAR-P temporal adherence và khả năng loại bỏ siêu dữ liệu rò rỉ.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 text-center min-w-[160px] shrink-0">
          <div className="text-4xl font-extrabold font-mono text-emerald-400">
            {evalData.metrics.overallScore}
          </div>
          <div className="text-[11px] text-blue-200 mt-1 uppercase font-semibold">Thang Điểm 100</div>
          <div className="text-[10px] text-emerald-300 font-medium mt-0.5">Xuất sắc (Certified)</div>
        </div>
      </div>

      {/* 6 Dimension Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {dimensionCards.map((d, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-700 line-clamp-1">{d.title}</span>
            <div className="text-xl font-bold font-mono text-blue-700">{d.score}%</div>
            <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{d.desc}</p>
          </div>
        ))}
      </div>

      {/* Trend & Worst Performing Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Tiến Trình Nâng Cao Chất Lượng</span>
            <span className="text-xs font-bold text-emerald-600 font-mono">+3.0 pts</span>
          </div>
          <p className="text-[11px] text-slate-400">Xu hướng điểm đánh giá qua 6 đợt benchmark</p>
          <CompactChart
            data={[
              { label: 'Run 1', value: 95.4 },
              { label: 'Run 2', value: 96.2 },
              { label: 'Run 3', value: 96.8 },
              { label: 'Run 4', value: 97.4 },
              { label: 'Run 5', value: 98.1 },
              { label: 'Run 6', value: 98.4 }
            ]}
            color="#2563eb"
            fillColor="rgba(37, 99, 235, 0.08)"
            type="area"
            valueSuffix="/100"
            height={160}
          />
        </div>

        {/* Worst Performing Sections */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Phân Cảnh Cần Tối Ưu (Worst Performing Sections)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Các phân cảnh có điểm đánh giá thấp nhất cần kiểm tra lại prompt hoặc logic khử lặp
            </p>
          </div>

          <div className="space-y-2.5">
            {evalData.worstPerformingSections.map((sec, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-800">{sec.lesson}</span>
                    <span className="font-mono text-blue-600 font-semibold">{sec.section}</span>
                    <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[9px] font-mono">
                      {sec.role}
                    </span>
                  </div>
                  <div className="text-rose-600 text-[11px] font-medium flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Vấn đề chính: {sec.primaryIssue}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <div className="text-right">
                    <div className="font-bold text-slate-900 font-mono">{sec.score}/100</div>
                    <div className="text-[10px] text-slate-400 font-mono">{sec.model}</div>
                  </div>

                  <a
                    href={adminTelemetryService.getLangfuseTraceUrl(sec.traceId)}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                    title="Mở trace trong Langfuse"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
