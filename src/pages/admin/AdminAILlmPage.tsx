import React,{ useState, useEffect } from 'react';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import { CompactChart } from '../../components/admin/CompactChart';
import { useAdmin } from '../../components/admin/AdminLayout';
import {
  Flame,
  ArrowUpRight,RefreshCw
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

  const { timeFilter } = useAdmin();
  // Real time-bucketed series from recorded AI calls (empty => chart shows empty state).
  const series = adminTelemetryService.getAILlmTimeSeries(timeFilter);
  const hasCalls = data.totalRequests > 0;
  const failureRate = hasCalls ? Math.round((data.failedRequests / data.totalRequests) * 10000) / 100 : 0;
  const fastestModel = data.byModel.length > 0
    ? data.byModel.reduce((a, b) => (b.avgLatencyMs < a.avgLatencyMs ? b : a))
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-ink tracking-tight">AI & LLM Analytics</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-paper-band text-print border border-rule-strong">
              <span className="w-1.5 h-1.5 rounded-full bg-print animate-pulse" />
              Lưu Lượng Thật
            </span>
          </div>
          <p className="text-xs text-ink-faint mt-1">
            Theo dõi chi tiết mức tiêu thụ token, chi phí API, độ trễ và phân tích hiệu năng theo mô hình, tính năng và phiên bản prompt thực tế.
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
          <a
            href={adminTelemetryService.getLangfuseTraceUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-cover hover:bg-cover text-white text-xs font-semibold rounded-xl transition shadow-xs self-start sm:self-auto"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Langfuse LLM Telemetry</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-paper-sheet p-4 rounded-xl border border-rule shadow-xs space-y-1">
          <span className="text-xs font-medium text-ink-faint">Total Requests</span>
          <div className="text-xl font-bold font-mono text-navy">{data.totalRequests.toLocaleString()}</div>
          <span className="text-[11px] text-print font-semibold">{hasCalls ? `${data.successRate}% Success` : 'Chưa có dữ liệu'}</span>
        </div>

        <div className="bg-paper-sheet p-4 rounded-xl border border-rule shadow-xs space-y-1">
          <span className="text-xs font-medium text-ink-faint">Total Tokens</span>
          <div className="text-xl font-bold font-mono text-navy">{(data.totalTokens / 1000).toFixed(1)}k</div>
          <span className="text-[11px] text-ink-faint">In: {(data.inputTokens / 1000).toFixed(0)}k • Out: {(data.outputTokens / 1000).toFixed(0)}k</span>
        </div>

        <div className="bg-paper-sheet p-4 rounded-xl border border-rule shadow-xs space-y-1">
          <span className="text-xs font-medium text-ink-faint">Total Cost</span>
          <div className="text-xl font-bold font-mono text-navy">{hasCalls ? `$${data.totalCost.toFixed(4)}` : '—'}</div>
          <span className="text-[11px] text-ink-faint">
            {hasCalls ? `Avg $${(data.totalCost / data.totalRequests).toFixed(5)} / req` : 'Chưa có dữ liệu'}
          </span>
        </div>

        <div className="bg-paper-sheet p-4 rounded-xl border border-rule shadow-xs space-y-1">
          <span className="text-xs font-medium text-ink-faint">Avg Latency</span>
          <div className="text-xl font-bold font-mono text-navy">{hasCalls ? `${data.avgLatencyMs}ms` : '—'}</div>
          <span className="text-[11px] text-print font-medium truncate block">
            {fastestModel ? `Nhanh nhất: ${fastestModel.model} ${fastestModel.avgLatencyMs}ms` : 'Chưa có dữ liệu'}
          </span>
        </div>

        <div className="bg-paper-sheet p-4 rounded-xl border border-rule shadow-xs space-y-1">
          <span className="text-xs font-medium text-ink-faint">Successful Calls</span>
          <div className="text-xl font-bold font-mono text-navy">{data.successfulRequests.toLocaleString()}</div>
          <span className="text-[11px] text-print font-semibold">{hasCalls ? `${data.successRate}%` : '—'}</span>
        </div>

        <div className="bg-paper-sheet p-4 rounded-xl border border-rule shadow-xs space-y-1">
          <span className="text-xs font-medium text-ink-faint">Failed Calls</span>
          <div className="text-xl font-bold font-mono text-pen">{data.failedRequests}</div>
          <span className="text-[11px] text-pen font-medium">{hasCalls ? `${failureRate}%` : '—'}</span>
        </div>
      </div>

      {/* 4 Interactive Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-paper-sheet p-5 rounded-2xl border border-rule shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">Lưu Lượng Gọi LLM (Requests Over Time)</span>
            <span className="text-xs font-mono font-semibold text-print">{data.totalRequests} reqs</span>
          </div>
          <CompactChart
            data={series.requests}
            color="#2563eb"
            fillColor="rgba(37, 99, 235, 0.08)"
            type="area"
            height={160}
          />
        </div>

        <div className="bg-paper-sheet p-5 rounded-2xl border border-rule shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">Chi Phí Token Tiêu Thụ ($ USD Over Time)</span>
            <span className="text-xs font-mono font-semibold text-print">{hasCalls ? `$${data.totalCost}` : '—'}</span>
          </div>
          <CompactChart
            data={series.cost}
            color="#059669"
            fillColor="rgba(5, 150, 105, 0.08)"
            type="line"
            valuePrefix="$"
            height={160}
          />
        </div>

        <div className="bg-paper-sheet p-5 rounded-2xl border border-rule shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">Độ Trễ Phản Hồi Trung Bình (Latency ms)</span>
            <span className="text-xs font-mono font-semibold text-pen">{hasCalls ? `${data.avgLatencyMs}ms` : '—'}</span>
          </div>
          <CompactChart
            data={series.latency}
            color="#d97706"
            fillColor="rgba(217, 119, 6, 0.08)"
            type="line"
            valueSuffix="ms"
            height={160}
          />
        </div>

        <div className="bg-paper-sheet p-5 rounded-2xl border border-rule shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">Tỷ Lệ Lỗi API (Error Rate % Over Time)</span>
            <span className="text-xs font-mono font-semibold text-pen">{hasCalls ? `${failureRate}%` : '—'}</span>
          </div>
          <CompactChart
            data={series.errorRate}
            color="#e11d48"
            fillColor="rgba(225, 29, 72, 0.08)"
            type="area"
            valueSuffix="%"
            height={160}
          />
        </div>
      </div>

      {/* Breakdown Tabs & Table */}
      <div className="bg-paper-sheet rounded-2xl border border-rule shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('byModel')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'byModel'
                  ? 'bg-paper-band text-print'
                  : 'text-ink-soft hover:bg-paper-band'
              }`}
            >
              Phân Rã Theo Mô Hình (By Model)
            </button>
            <button
              onClick={() => setActiveTab('byFeature')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'byFeature'
                  ? 'bg-paper-band text-print'
                  : 'text-ink-soft hover:bg-paper-band'
              }`}
            >
              Phân Rã Theo Tính Năng (By Feature)
            </button>
            <button
              onClick={() => setActiveTab('byPrompt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'byPrompt'
                  ? 'bg-paper-band text-print'
                  : 'text-ink-soft hover:bg-paper-band'
              }`}
            >
              Theo Phiên Bản Prompt
            </button>
          </div>
        </div>

        {/* Tab 1: By Model */}
        {activeTab === 'byModel' && (
          <div className="overflow-x-auto border border-rule rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-paper-band border-b border-rule text-ink-faint font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 px-3">Mô Hình AI</th>
                  <th className="py-2.5 px-3">Lượt Gọi (Calls)</th>
                  <th className="py-2.5 px-3">Tokens Tiêu Thụ</th>
                  <th className="py-2.5 px-3">Chi Phí ($)</th>
                  <th className="py-2.5 px-3">Độ Trễ TB</th>
                  <th className="py-2.5 px-3">Tỷ Lệ Lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {data.byModel.map((m) => (
                  <tr key={m.model} className="hover:bg-paper-band">
                    <td className="py-3 px-3 font-mono font-bold text-ink">{m.model}</td>
                    <td className="py-3 px-3 font-mono text-ink-soft">{m.requests.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-ink-soft">{m.tokens.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-print font-semibold">${m.cost.toFixed(4)}</td>
                    <td className="py-3 px-3 font-mono text-ink-soft">{m.avgLatencyMs}ms</td>
                    <td className="py-3 px-3 font-mono text-ink-soft">{m.errorRate}%</td>
                  </tr>
                ))}
                {!hasCalls && (<tr><td colSpan={6} className="py-6 px-3 text-center text-ink-faint">Chưa có dữ liệu</td></tr>)}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: By Feature */}
        {activeTab === 'byFeature' && (
          <div className="overflow-x-auto border border-rule rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-paper-band border-b border-rule text-ink-faint font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 px-3">Tính Năng / Module Pipeline</th>
                  <th className="py-2.5 px-3">Lượt Gọi</th>
                  <th className="py-2.5 px-3">Tokens</th>
                  <th className="py-2.5 px-3">Chi Phí ($)</th>
                  <th className="py-2.5 px-3">Độ Trễ TB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {data.byFeature.map((f) => (
                  <tr key={f.feature} className="hover:bg-paper-band">
                    <td className="py-3 px-3 font-semibold text-ink">{f.feature}</td>
                    <td className="py-3 px-3 font-mono text-ink-soft">{f.requests.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-ink-soft">{f.tokens.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-print font-semibold">${f.cost.toFixed(4)}</td>
                    <td className="py-3 px-3 font-mono text-ink-soft">{f.avgLatencyMs}ms</td>
                  </tr>
                ))}
                {!hasCalls && (<tr><td colSpan={5} className="py-6 px-3 text-center text-ink-faint">Chưa có dữ liệu</td></tr>)}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: By Prompt */}
        {activeTab === 'byPrompt' && (
          <div className="overflow-x-auto border border-rule rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-paper-band border-b border-rule text-ink-faint font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 px-3">Tên Prompt</th>
                  <th className="py-2.5 px-3">Phiên Bản</th>
                  <th className="py-2.5 px-3">Lượt Gọi</th>
                  <th className="py-2.5 px-3">Điểm Chất Lượng</th>
                  <th className="py-2.5 px-3">Chi Phí ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {data.byPromptVersion.map((p) => (
                  <tr key={p.prompt} className="hover:bg-paper-band">
                    <td className="py-3 px-3 font-mono font-bold text-ink">{p.prompt}</td>
                    <td className="py-3 px-3 font-mono text-print">{p.version}</td>
                    <td className="py-3 px-3 font-mono text-ink-soft">{p.requests.toLocaleString()}</td>
                    <td className="py-3 px-3 font-bold text-print">{p.qualityScore > 0 ? `${p.qualityScore}/100` : '—'}</td>
                    <td className="py-3 px-3 font-mono text-ink-soft">${p.cost.toFixed(4)}</td>
                  </tr>
                ))}
                {!hasCalls && (<tr><td colSpan={5} className="py-6 px-3 text-center text-ink-faint">Chưa có dữ liệu</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
