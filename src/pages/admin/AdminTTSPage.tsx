import React, { useState, useEffect } from 'react';
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
  Sparkles,
  RefreshCw
} from 'lucide-react';

export const AdminTTSPage: React.FC = () => {
  const [tts, setTts] = useState(() => adminTelemetryService.getTTSData());
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    await adminTelemetryService.syncRealData();
    setTts(adminTelemetryService.getTTSData());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const unsub = adminTelemetryService.subscribe(() => {
      setTts(adminTelemetryService.getTTSData());
    });
    return () => unsub();
  }, []);

  const hasTTS = tts.requests > 0;
  const distinctVoices = tts.byVoice.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-ink tracking-tight flex items-center space-x-2">
              <Volume2 className="w-5 h-5 text-print" />
              <span>TTS Speech Synthesis Analytics</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-paper-band text-print border border-rule-strong">
              <span className="w-1.5 h-1.5 rounded-full bg-print animate-pulse" />
              Dữ Liệu Thật
            </span>
          </div>
          <p className="text-xs text-ink-faint mt-1">
            Theo dõi lưu lượng tổng hợp giọng nói AI, thời lượng audio sinh ra, chi phí nhà cung cấp và độ trễ phát âm thực tế.
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
          <span className="px-2.5 py-1 rounded-xl bg-paper-band text-print text-xs font-semibold border border-rule-strong">
            {hasTTS ? `${tts.successRate}% Success Rate` : 'Chưa có dữ liệu'}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-paper-sheet p-4 rounded-xl border border-rule shadow-xs space-y-1">
          <span className="text-xs font-medium text-ink-faint">TTS Requests</span>
          <div className="text-xl font-bold font-mono text-navy">{tts.requests.toLocaleString()}</div>
          <span className="text-[11px] text-print font-medium">{hasTTS ? `${tts.successRate}% Success` : '—'}</span>
        </div>

        <div className="bg-paper-sheet p-4 rounded-xl border border-rule shadow-xs space-y-1">
          <span className="text-xs font-medium text-ink-faint">Audio Generated</span>
          <div className="text-xl font-bold font-mono text-navy">{hasTTS ? `${tts.totalDurationMin.toFixed(1)} min` : '—'}</div>
          <span className="text-[11px] text-ink-faint">{hasTTS ? `~${(tts.totalDurationMin / 60).toFixed(1)} giờ audio` : 'Chưa có dữ liệu'}</span>
        </div>

        <div className="bg-paper-sheet p-4 rounded-xl border border-rule shadow-xs space-y-1">
          <span className="text-xs font-medium text-ink-faint">Total TTS Cost</span>
          <div className="text-xl font-bold font-mono text-navy">{hasTTS ? `$${tts.totalCost.toFixed(4)}` : '—'}</div>
          <span className="text-[11px] text-ink-faint">
            {hasTTS && tts.totalDurationMin > 0 ? `$${(tts.totalCost / tts.totalDurationMin).toFixed(4)} / min` : 'Chưa có dữ liệu'}
          </span>
        </div>

        <div className="bg-paper-sheet p-4 rounded-xl border border-rule shadow-xs space-y-1">
          <span className="text-xs font-medium text-ink-faint">Avg Latency</span>
          <div className="text-xl font-bold font-mono text-navy">{hasTTS ? `${tts.avgLatencyMs}ms` : '—'}</div>
          <span className="text-[11px] text-print font-medium">Trung bình mỗi lượt</span>
        </div>

        <div className="bg-paper-sheet p-4 rounded-xl border border-rule shadow-xs space-y-1">
          <span className="text-xs font-medium text-ink-faint">Giọng Đọc Đã Dùng</span>
          <div className="text-xl font-bold font-mono text-navy">{hasTTS ? distinctVoices : '—'}</div>
          <span className="text-[11px] text-print font-medium">{hasTTS ? 'Giọng khác nhau' : 'Chưa có dữ liệu'}</span>
        </div>

        <div className="bg-paper-sheet p-4 rounded-xl border border-rule shadow-xs space-y-1">
          <span className="text-xs font-medium text-ink-faint">Failure Rate</span>
          <div className="text-xl font-bold font-mono text-navy">{hasTTS ? `${tts.failureRate}%` : '—'}</div>
          <span className="text-[11px] text-ink-faint">Lượt lỗi / tổng</span>
        </div>
      </div>

      {/* Voice & Provider Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown by Voice */}
        <div className="bg-paper-sheet rounded-2xl border border-rule shadow-xs p-5 space-y-4">
          <div>
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center space-x-1.5">
              <Mic className="w-4 h-4 text-print" />
              <span>Phân Bổ Theo Giọng Đọc (By Voice Persona)</span>
            </h2>
            <p className="text-xs text-ink-faint">Giọng đọc tiếng Việt tự nhiên và tiếng Anh học thuật</p>
          </div>

          <div className="overflow-x-auto border border-rule rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-paper-band border-b border-rule text-ink-faint font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 px-3">Giọng Đọc</th>
                  <th className="py-2.5 px-3">Lượt Gọi</th>
                  <th className="py-2.5 px-3">Thời Lượng (Phút)</th>
                  <th className="py-2.5 px-3">Chi Phí ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {tts.byVoice.map((v) => (
                  <tr key={v.voice} className="hover:bg-paper-band">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-ink">{v.voice}</div>
                      <div className="text-[11px] text-ink-faint">{v.provider}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-ink-soft">{v.requests.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-ink-soft">{v.durationMin.toFixed(1)}m</td>
                    <td className="py-3 px-3 font-mono text-print font-semibold">${v.cost.toFixed(4)}</td>
                  </tr>
                ))}
                {tts.byVoice.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 px-3 text-center text-ink-faint">Chưa có dữ liệu</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown by Provider */}
        <div className="bg-paper-sheet rounded-2xl border border-rule shadow-xs p-5 space-y-4">
          <div>
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-print" />
              <span>Nhà Cung Cấp Giọng Đọc (TTS Providers)</span>
            </h2>
            <p className="text-xs text-ink-faint">Google Cloud TTS và Browser Web Speech API fallback</p>
          </div>

          <div className="overflow-x-auto border border-rule rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-paper-band border-b border-rule text-ink-faint font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 px-3">Nhà Cung Cấp</th>
                  <th className="py-2.5 px-3">Lượt Gọi</th>
                  <th className="py-2.5 px-3">Độ Trễ TB</th>
                  <th className="py-2.5 px-3">Chi Phí ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {tts.byProvider.map((p) => (
                  <tr key={p.provider} className="hover:bg-paper-band">
                    <td className="py-3 px-3 font-semibold text-ink">{p.provider}</td>
                    <td className="py-3 px-3 font-mono text-ink-soft">{p.requests.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-ink-soft">{p.avgLatencyMs}ms</td>
                    <td className="py-3 px-3 font-mono text-print font-semibold">${p.cost.toFixed(4)}</td>
                  </tr>
                ))}
                {tts.byProvider.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 px-3 text-center text-ink-faint">Chưa có dữ liệu</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
