import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../components/admin/AdminLayout';
import { adminTelemetryService } from '../../services/adminTelemetryService';
import { CompactChart } from '../../components/admin/CompactChart';
import { Link } from 'react-router-dom';
import {
  Users,
  BookOpen,
  Cpu,
  DollarSign,
  Clock,
  AlertTriangle,
  Award,
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  Flame,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export const AdminOverviewPage: React.FC = () => {
  const { timeFilter } = useAdmin();
  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState(() => adminTelemetryService.getOverviewKPIs(timeFilter));
  const [charts, setCharts] = useState(() => adminTelemetryService.getOverviewCharts(timeFilter));
  const [langfuseData, setLangfuseData] = useState(() => adminTelemetryService.getLangfuseData());
  const [recentIssues, setRecentIssues] = useState(() => adminTelemetryService.getContentQualityData().issues.slice(0, 3));

  const refresh = async () => {
    setLoading(true);
    await adminTelemetryService.syncRealData();
    setKpis(adminTelemetryService.getOverviewKPIs(timeFilter));
    setCharts(adminTelemetryService.getOverviewCharts(timeFilter));
    setLangfuseData(adminTelemetryService.getLangfuseData());
    setRecentIssues(adminTelemetryService.getContentQualityData().issues.slice(0, 3));
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const unsub = adminTelemetryService.subscribe(() => {
      setKpis(adminTelemetryService.getOverviewKPIs(timeFilter));
      setCharts(adminTelemetryService.getOverviewCharts(timeFilter));
      setLangfuseData(adminTelemetryService.getLangfuseData());
      setRecentIssues(adminTelemetryService.getContentQualityData().issues.slice(0, 3));
    });
    return () => unsub();
  }, [timeFilter]);

  const hasCalls = kpis.aiRequests > 0;
  const hasQuality = kpis.contentQualityScore > 0;

  const kpiCards = [
    {
      title: 'Total Users',
      value: kpis.totalUsers.toLocaleString(),
      subValue: `${kpis.activeUsers} đang hoạt động`,
      icon: Users,
      trend: 'Tài khoản đã đăng ký',
      trendPositive: true,
      color: 'blue'
    },
    {
      title: 'Total Lessons',
      value: kpis.totalLessons.toLocaleString(),
      subValue: `${kpis.publishedLessons} đã xuất bản`,
      icon: BookOpen,
      trend: 'Đồng bộ từ Studio',
      trendPositive: true,
      color: 'indigo'
    },
    {
      title: 'AI Requests',
      value: kpis.aiRequests.toLocaleString(),
      subValue: 'Lượt gọi LLM đã ghi nhận',
      icon: Cpu,
      trend: hasCalls ? 'Lưu lượng thực' : 'Chưa có dữ liệu',
      trendPositive: true,
      color: 'sky'
    },
    {
      title: 'AI Cost (Total)',
      value: hasCalls ? `$${kpis.aiCost.toFixed(4)}` : '—',
      subValue: 'Chi phí token thực tế',
      icon: DollarSign,
      trend: hasCalls ? 'Theo usage thực' : 'Chưa có dữ liệu',
      trendPositive: true,
      color: 'emerald'
    },
    {
      title: 'Avg Latency',
      value: hasCalls ? `${kpis.avgLatencyMs}ms` : '—',
      subValue: 'Trung bình mỗi lượt gọi',
      icon: Clock,
      trend: hasCalls ? 'Đo thực tế' : 'Chưa có dữ liệu',
      trendPositive: true,
      color: 'amber'
    },
    {
      title: 'Error Rate',
      value: hasCalls ? `${kpis.errorRate}%` : '—',
      subValue: 'Lượt gọi LLM lỗi / tổng',
      icon: AlertTriangle,
      trend: !hasCalls ? 'Chưa có dữ liệu' : kpis.errorRate === 0 ? '0 lỗi' : 'Có lỗi',
      trendPositive: kpis.errorRate === 0,
      color: 'rose'
    },
    {
      title: 'Content Quality',
      value: hasQuality ? `${kpis.contentQualityScore}/100` : '—',
      subValue: 'Điểm TB Quality Guard',
      icon: Award,
      trend: hasQuality ? 'Module 4 Quality Guard' : 'Chưa có dữ liệu',
      trendPositive: true,
      color: 'emerald'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-ink tracking-tight">System Overview</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-paper-band text-print border border-rule-strong">
              <span className="w-1.5 h-1.5 rounded-full bg-print animate-pulse" />
              Dữ Liệu Thật 100% (Live Telemetry)
            </span>
          </div>
          <p className="text-xs text-ink-faint mt-1">
            Trung tâm giám sát hiệu năng AI generation, chi phí LLM, chất lượng bài giảng và trạng thái hệ thống từ các bài học thực tế.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-paper-sheet border border-rule text-xs font-medium text-ink-soft hover:bg-paper-band rounded-xl transition shadow-xs disabled:opacity-50"
            title="Đồng bộ lại từ cơ sở dữ liệu thật"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-ink-faint ${loading ? 'animate-spin text-print' : ''}`} />
            <span>{loading ? 'Đang đồng bộ...' : 'Làm Mới Dữ Liệu'}</span>
          </button>
          <Link
            to="/admin/quality"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-paper-sheet border border-rule text-xs font-medium text-ink-soft hover:bg-paper-band rounded-xl transition shadow-xs"
          >
            <span>Quality Center</span>
          </Link>
          <a
            href={adminTelemetryService.getLangfuseTraceUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-cover hover:bg-cover text-white text-xs font-semibold rounded-xl transition shadow-xs"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Open Langfuse</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-paper-sheet p-4 rounded-2xl border border-rule shadow-xs hover:border-rule-strong transition"
            >
              <div className="flex items-center justify-between text-ink-faint mb-2">
                <span className="text-xs font-medium text-ink-soft">{kpi.title}</span>
                <div className="w-7 h-7 rounded-lg bg-paper-band flex items-center justify-center text-ink-faint">
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-navy tracking-tight">{kpi.value}</div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-rule text-xs">
                <span className="text-ink-faint truncate">{kpi.subValue}</span>
                <span className="text-print font-semibold shrink-0 ml-1">{kpi.trend}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6 Key Charts Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
            System Trends ({timeFilter === 'today' ? 'Hôm nay' : timeFilter})
          </h2>
          <span className="text-xs text-ink-faint">Tự động đồng bộ từ Telemetry Service</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Chart 1: Users */}
          <div className="bg-paper-sheet p-5 rounded-2xl border border-rule shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-ink-soft">1. Users Over Time</div>
                <div className="text-xs text-ink-faint">Lượng người dùng hoạt động</div>
              </div>
              <span className="text-xs font-bold text-print">Active</span>
            </div>
            <CompactChart data={charts.users} color="#2563eb" fillColor="rgba(37, 99, 235, 0.08)" type="area" />
          </div>

          {/* Chart 2: Lessons */}
          <div className="bg-paper-sheet p-5 rounded-2xl border border-rule shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-ink-soft">2. Lesson Generation</div>
                <div className="text-xs text-ink-faint">Số bài giảng sinh ra</div>
              </div>
              <span className="text-xs font-bold text-print">Lessons</span>
            </div>
            <CompactChart data={charts.lessons} color="#6366f1" fillColor="rgba(99, 102, 241, 0.08)" type="bar" />
          </div>

          {/* Chart 3: AI Requests */}
          <div className="bg-paper-sheet p-5 rounded-2xl border border-rule shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-ink-soft">3. AI Requests</div>
                <div className="text-xs text-ink-faint">Lưu lượng gọi API LLM</div>
              </div>
              <span className="text-xs font-bold text-print">Calls</span>
            </div>
            <CompactChart data={charts.requests} color="#0284c7" fillColor="rgba(2, 132, 199, 0.08)" type="area" />
          </div>

          {/* Chart 4: AI Cost */}
          <div className="bg-paper-sheet p-5 rounded-2xl border border-rule shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-ink-soft">4. AI Cost ($)</div>
                <div className="text-xs text-ink-faint">Chi phí token tiêu thụ</div>
              </div>
              <span className="text-xs font-bold text-print">USD</span>
            </div>
            <CompactChart data={charts.cost} color="#059669" fillColor="rgba(5, 150, 105, 0.08)" type="line" valuePrefix="$" />
          </div>

          {/* Chart 5: Quality Score */}
          <div className="bg-paper-sheet p-5 rounded-2xl border border-rule shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-ink-soft">5. Quality Score</div>
                <div className="text-xs text-ink-faint">Điểm sư phạm chuẩn hoá</div>
              </div>
              <span className="text-xs font-bold text-print">pts</span>
            </div>
            <CompactChart data={charts.quality} color="#10b981" fillColor="rgba(16, 185, 129, 0.08)" type="area" valueSuffix="/100" />
          </div>

          {/* Chart 6: Error Rate */}
          <div className="bg-paper-sheet p-5 rounded-2xl border border-rule shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-ink-soft">6. Error Rate (%)</div>
                <div className="text-xs text-ink-faint">Tỷ lệ lỗi phát sinh</div>
              </div>
              <span className="text-xs font-bold text-pen">Error %</span>
            </div>
            <CompactChart data={charts.errorRate} color="#e11d48" fillColor="rgba(225, 29, 72, 0.08)" type="line" valueSuffix="%" />
          </div>
        </div>
      </div>

      {/* Bottom split: Recent Quality Issues & Langfuse Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quality Issues Feed */}
        <div className="lg:col-span-2 bg-paper-sheet rounded-2xl border border-rule p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-pen" />
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                Ghi Nhận Sự Cố Nội Dung Gần Đây (Content Quality Feed)
              </h3>
            </div>
            <Link to="/admin/quality" className="text-xs text-navy hover:underline font-medium">
              Xem tất cả →
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentIssues.length === 0 && (
              <div className="p-4 text-center text-xs text-ink-faint bg-paper-band rounded-xl border border-dashed border-rule">
                Chưa có dữ liệu
              </div>
            )}
            {recentIssues.map((issue) => (
              <div
                key={issue.id}
                className="p-3 bg-paper-band hover:bg-paper-band border border-rule rounded-xl transition flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-ink">{issue.lessonTitle}</span>
                    <span className="text-[11px] font-mono text-ink-faint">({issue.sectionId})</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[11px] font-bold uppercase ${
                        issue.severity === 'critical'
                          ? 'bg-pen-soft text-pen'
                          : issue.severity === 'high'
                          ? 'bg-pen-soft text-pen'
                          : 'bg-paper-band text-print'
                      }`}
                    >
                      {issue.issueType}
                    </span>
                  </div>
                  <p className="text-ink-soft text-xs line-clamp-1 italic">
                    Raw: "{issue.rawOutput}"
                  </p>
                  <p className="text-print text-xs line-clamp-1 font-medium">
                    Cleaned: "{issue.cleanedOutput}"
                  </p>
                </div>

                {issue.traceId && (
                  <a
                    href={adminTelemetryService.getLangfuseTraceUrl(issue.traceId)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-ink-faint hover:text-navy transition p-1"
                    title="Mở Trace trong Langfuse"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Langfuse Observability Summary Card */}
        <div className="bg-paper-sheet rounded-2xl border border-rule p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Flame className="w-4 h-4 text-pen" />
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                  Langfuse Observability
                </h3>
              </div>
              <span className="w-2 h-2 rounded-full bg-print animate-pulse"></span>
            </div>

            <p className="text-xs text-ink-faint leading-relaxed">
              Theo dõi toàn diện các generation LLM, phân rã latency, tính toán chi phí token và quản lý phiên trace.
            </p>

            <div className="space-y-2 pt-1 text-xs">
              <div className="flex justify-between py-1.5 border-b border-rule">
                <span className="text-ink-faint">Traces Count:</span>
                <span className="font-mono font-semibold text-ink">{langfuseData.summary.totalTraces}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-rule">
                <span className="text-ink-faint">Generations:</span>
                <span className="font-mono font-semibold text-ink">{langfuseData.summary.totalGenerations}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-rule">
                <span className="text-ink-faint">Total Telemetry Cost:</span>
                <span className="font-mono font-semibold text-print">${langfuseData.summary.totalCost}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-ink-faint">Quality Index:</span>
                <span className="font-mono font-semibold text-print">
                  {langfuseData.summary.qualityScore > 0 ? `${langfuseData.summary.qualityScore}/100` : '—'}
                </span>
              </div>
            </div>
          </div>

          <a
            href={langfuseData.summary.projectUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 bg-cover hover:bg-cover-deep text-white rounded-xl text-xs font-semibold transition shadow-xs"
          >
            <span>Open Langfuse Project</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
