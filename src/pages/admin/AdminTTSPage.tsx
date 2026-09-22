// src/pages/admin/AdminTTSPage.tsx
import React from 'react';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import {
  Volume2,
  Mic,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
  Sparkles
} from 'lucide-react';

export const AdminTTSPage: React.FC = () => {
  const tts = adminTelemetryService.getTTSData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Volume2 className="w-5 h-5 text-emerald-600" />
            <span>TTS Speech Synthesis Analytics</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi lưu lượng tổng hợp giọng nói AI, thời lượng audio sinh ra, chi phí nhà cung cấp và độ trễ phát âm.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
            {tts.successRate}% Success Rate
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">TTS Requests</span>
          <div className="text-xl font-bold font-mono text-slate-900">{tts.requests.toLocaleString()}</div>
          <span className="text-[10px] text-emerald-600 font-medium">99.4% Success</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Audio Generated</span>
          <div className="text-xl font-bold font-mono text-slate-900">{tts.totalDurationMin.toFixed(1)} min</div>
          <span className="text-[10px] text-slate-400">~5.7 giờ audio</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Total TTS Cost</span>
          <div className="text-xl font-bold font-mono text-emerald-600">${tts.totalCost.toFixed(2)}</div>
          <span className="text-[10px] text-slate-400">$0.0025 / min</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Avg Latency</span>
          <div className="text-xl font-bold font-mono text-slate-900">{tts.avgLatencyMs}ms</div>
          <span className="text-[10px] text-blue-600 font-medium">Fast Synthesis</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Voice Quality</span>
          <div className="text-xl font-bold font-mono text-blue-700">Neural2</div>
          <span className="text-[10px] text-emerald-600 font-medium">WaveNet High-Fi</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Failure Rate</span>
          <div className="text-xl font-bold font-mono text-emerald-600">{tts.failureRate}%</div>
          <span className="text-[10px] text-slate-400">Tự động retry</span>
        </div>
      </div>

      {/* Voice & Provider Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown by Voice */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Mic className="w-4 h-4 text-emerald-600" />
              <span>Phân Bổ Theo Giọng Đọc (By Voice Persona)</span>
            </h2>
            <p className="text-[11px] text-slate-400">Giọng đọc tiếng Việt tự nhiên và tiếng Anh học thuật</p>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Giọng Đọc</th>
                  <th className="py-2.5 px-3">Lượt Gọi</th>
                  <th className="py-2.5 px-3">Thời Lượng (Phút)</th>
                  <th className="py-2.5 px-3">Chi Phí ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tts.byVoice.map((v) => (
                  <tr key={v.voice} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">{v.voice}</div>
                      <div className="text-[10px] text-slate-400">{v.provider}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700">{v.requests.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{v.durationMin.toFixed(1)}m</td>
                    <td className="py-3 px-3 font-mono text-emerald-600 font-semibold">${v.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown by Provider */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Nhà Cung Cấp Giọng Đọc (TTS Providers)</span>
            </h2>
            <p className="text-[11px] text-slate-400">Google Cloud TTS và Browser Web Speech API fallback</p>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Nhà Cung Cấp</th>
                  <th className="py-2.5 px-3">Lượt Gọi</th>
                  <th className="py-2.5 px-3">Độ Trễ TB</th>
                  <th className="py-2.5 px-3">Chi Phí ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tts.byProvider.map((p) => (
                  <tr key={p.provider} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3 font-semibold text-slate-800">{p.provider}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{p.requests.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{p.avgLatencyMs}ms</td>
                    <td className="py-3 px-3 font-mono text-emerald-600 font-semibold">${p.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
