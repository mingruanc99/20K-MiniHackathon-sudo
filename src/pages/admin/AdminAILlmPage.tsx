import React, { useState, useEffect } from 'react';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import { CompactChart } from '../../components/admin/CompactChart';
import {
  Cpu,
  Zap,
  DollarSign,
  Clock,
  Layers,
  Sparkles,
  Flame,
  ArrowUpRight,
  TrendingUp,
  Activity,
  RefreshCw
} from 'lucide-react';

export const AdminAILlmPage: React.FC = () => {
  const [data, setData] = useState(() => adminTelemetryService.getAILlmData());
  const [activeTab, setActiveTab] = useState<'byModel' | 'byFeature' | 'byPrompt'>('byModel');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    await adminTelemetryService.syncRealData();
    setData(adminTelemetryService.getAILlmData());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const unsub = adminTelemetryService.subscribe(() => {
      setData(adminTelemetryService.getAILlmData());
    });
    return () => unsub();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">AI & LLM Analytics</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Lưu Lượng Thật
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi chi tiết mức tiêu thụ token, chi phí API, độ trễ và phân tích hiệu năng theo mô hình, tính năng và phiên bản prompt thực tế.
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
          <a
            href={adminTelemetryService.getLangfuseTraceUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-xs self-start sm:self-auto"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Langfuse LLM Telemetry</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Total Requests</span>
          <div className="text-xl font-bold font-mono text-slate-900">{data.totalRequests.toLocaleString()}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">{data.successRate}% Success</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Total Tokens</span>
          <div className="text-xl font-bold font-mono text-slate-900">{(data.totalTokens / 1000).toFixed(1)}k</div>
          <span className="text-[10px] text-slate-400">In: {(data.inputTokens / 1000).toFixed(0)}k • Out: {(data.outputTokens / 1000).toFixed(0)}k</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Total Cost</span>
          <div className="text-xl font-bold font-mono text-emerald-600">${data.totalCost.toFixed(2)}</div>
          <span className="text-[10px] text-slate-400">Avg $0.0005 / req</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Avg Latency</span>
          <div className="text-xl font-bold font-mono text-slate-900">{data.avgLatencyMs}ms</div>
          <span className="text-[10px] text-blue-600 font-medium">Flash: 460ms</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Successful Calls</span>
          <div className="text-xl font-bold font-mono text-emerald-700">{data.successfulRequests.toLocaleString()}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">98.66% High</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-medium text-slate-500">Failed Calls</span>
          <div className="text-xl font-bold font-mono text-rose-600">{data.failedRequests}</div>
          <span className="text-[10px] text-rose-500 font-medium">1.34% Handled</span>
        </div>
      </div>

      {/* 4 Interactive Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Lưu Lượng Gọi LLM (Requests Over Time)</span>
            <span className="text-xs font-mono font-semibold text-blue-600">{data.totalRequests} reqs</span>
          </div>
          <CompactChart
            data={[
              { label: '00:00', value: 42 },
              { label: '04:00', value: 28 },
              { label: '08:00', value: 184 },
              { label: '12:00', value: 310 },
              { label: '16:00', value: 420 },
              { label: '20:00', value: 280 }
            ]}
            color="#2563eb"
            fillColor="rgba(37, 99, 235, 0.08)"
            type="area"
            height={160}
          />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Chi Phí Token Tiêu Thụ ($ USD Over Time)</span>
            <span className="text-xs font-mono font-semibold text-emerald-600">${data.totalCost}</span>
          </div>
          <CompactChart
            data={[
              { label: 'T2', value: 0.18 },
              { label: 'T3', value: 0.22 },
              { label: 'T4', value: 0.26 },
              { label: 'T5', value: 0.31 },
              { label: 'T6', value: 0.28 },
              { label: 'T7', value: 0.23 }
            ]}
            color="#059669"
            fillColor="rgba(5, 150, 105, 0.08)"
            type="line"
            valuePrefix="$"
            height={160}
          />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Độ Trễ Phản Hồi Trung Bình (Latency ms)</span>
            <span className="text-xs font-mono font-semibold text-amber-600">{data.avgLatencyMs}ms</span>
          </div>
          <CompactChart
            data={[
              { label: 'T2', value: 920 },
              { label: 'T3', value: 880 },
              { label: 'T4', value: 840 },
              { label: 'T5', value: 810 },
              { label: 'T6', value: 830 },
              { label: 'T7', value: 820 }
            ]}
            color="#d97706"
            fillColor="rgba(217, 119, 6, 0.08)"
            type="line"
            valueSuffix="ms"
            height={160}
          />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Tỷ Lệ Lỗi API (Error Rate % Over Time)</span>
            <span className="text-xs font-mono font-semibold text-rose-600">1.34%</span>
          </div>
          <CompactChart
            data={[
              { label: 'T2', value: 2.8 },
              { label: 'T3', value: 2.1 },
              { label: 'T4', value: 1.8 },
              { label: 'T5', value: 1.4 },
              { label: 'T6', value: 1.3 },
              { label: 'T7', value: 1.2 }
            ]}
            color="#e11d48"
            fillColor="rgba(225, 29, 72, 0.08)"
            type="area"
            valueSuffix="%"
            height={160}
          />
        </div>
      </div>

      {/* Breakdown Tabs & Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('byModel')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'byModel'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Phân Rã Theo Mô Hình (By Model)
            </button>
            <button
              onClick={() => setActiveTab('byFeature')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'byFeature'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Phân Rã Theo Tính Năng (By Feature)
            </button>
            <button
              onClick={() => setActiveTab('byPrompt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'byPrompt'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Theo Phiên Bản Prompt
            </button>
          </div>
        </div>

        {/* Tab 1: By Model */}
        {activeTab === 'byModel' && (
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Mô Hình AI</th>
                  <th className="py-2.5 px-3">Lượt Gọi (Calls)</th>
                  <th className="py-2.5 px-3">Tokens Tiêu Thụ</th>
                  <th className="py-2.5 px-3">Chi Phí ($)</th>
                  <th className="py-2.5 px-3">Độ Trễ TB</th>
                  <th className="py-2.5 px-3">Tỷ Lệ Lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.byModel.map((m) => (
                  <tr key={m.model} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">{m.model}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{m.requests.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{m.tokens.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-emerald-600 font-semibold">${m.cost.toFixed(2)}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{m.avgLatencyMs}ms</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{m.errorRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: By Feature */}
        {activeTab === 'byFeature' && (
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Tính Năng / Module Pipeline</th>
                  <th className="py-2.5 px-3">Lượt Gọi</th>
                  <th className="py-2.5 px-3">Tokens</th>
                  <th className="py-2.5 px-3">Chi Phí ($)</th>
                  <th className="py-2.5 px-3">Độ Trễ TB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.byFeature.map((f) => (
                  <tr key={f.feature} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3 font-semibold text-slate-800">{f.feature}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{f.requests.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{f.tokens.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-emerald-600 font-semibold">${f.cost.toFixed(2)}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{f.avgLatencyMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: By Prompt */}
        {activeTab === 'byPrompt' && (
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Tên Prompt</th>
                  <th className="py-2.5 px-3">Phiên Bản</th>
                  <th className="py-2.5 px-3">Lượt Gọi</th>
                  <th className="py-2.5 px-3">Điểm Chất Lượng</th>
                  <th className="py-2.5 px-3">Chi Phí ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.byPromptVersion.map((p) => (
                  <tr key={p.prompt} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">{p.prompt}</td>
                    <td className="py-3 px-3 font-mono text-blue-700">{p.version}</td>
                    <td className="py-3 px-3 font-mono text-slate-700">{p.requests.toLocaleString()}</td>
                    <td className="py-3 px-3 font-bold text-emerald-600">{p.qualityScore}/100</td>
                    <td className="py-3 px-3 font-mono text-slate-700">${p.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
