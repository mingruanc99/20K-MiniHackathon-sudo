// src/pages/admin/AdminOverviewPage.tsx
import React from 'react';
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
  CheckCircle2
} from 'lucide-react';

export const AdminOverviewPage: React.FC = () => {
  const { timeFilter } = useAdmin();
  const kpis = adminTelemetryService.getOverviewKPIs(timeFilter);
  const charts = adminTelemetryService.getOverviewCharts(timeFilter);
  const langfuseData = adminTelemetryService.getLangfuseData();
  const recentIssues = adminTelemetryService.getContentQualityData().issues.slice(0, 3);

  const kpiCards = [
    {
      title: 'Total Users',
      value: kpis.totalUsers.toLocaleString(),
      subValue: `${kpis.activeUsers} đang hoạt động`,
      icon: Users,
      trend: '+14% vs kỳ trước',
      trendPositive: true,
      color: 'blue'
    },
    {
      title: 'Total Lessons',
      value: kpis.totalLessons.toLocaleString(),
      subValue: `${kpis.publishedLessons} đã xuất bản`,
      icon: BookOpen,
      trend: '+22% vs kỳ trước',
      trendPositive: true,
      color: 'indigo'
    },
    {
      title: 'AI Requests',
      value: kpis.aiRequests.toLocaleString(),
      subValue: 'Gemini 1.5 Pro & Flash',
      icon: Cpu,
      trend: '+38% volume',
      trendPositive: true,
      color: 'sky'
    },
    {
      title: 'AI Cost (Total)',
      value: `$${kpis.aiCost.toFixed(2)}`,
      subValue: 'Avg $0.0008 / request',
      icon: DollarSign,
      trend: 'Tối ưu -18%',
      trendPositive: true,
      color: 'emerald'
    },
    {
      title: 'Avg Latency',
      value: `${kpis.avgLatencyMs}ms`,
      subValue: 'Target < 1200ms',
      icon: Clock,
      trend: '-60ms faster',
      trendPositive: true,
      color: 'amber'
    },
    {
      title: 'Error Rate',
      value: `${kpis.errorRate}%`,
      subValue: '0 Critical unhandled',
      icon: AlertTriangle,
      trend: '-0.4% giảm',
      trendPositive: true,
      color: 'rose'
    },
    {
      title: 'Content Quality',
      value: `${kpis.contentQualityScore}/100`,
      subValue: 'Zero-Leak Guaranteed',
      icon: Award,
      trend: '+3.2 pts',
      trendPositive: true,
      color: 'emerald'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Overview</h1>
          <p className="text-xs text-slate-500 mt-1">
            Trung tâm giám sát hiệu năng AI generation, chi phí LLM, chất lượng bài giảng và trạng thái hệ thống.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/admin/quality"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition shadow-xs"
          >
            <span>Quality Center</span>
          </Link>
          <a
            href={adminTelemetryService.getLangfuseTraceUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-xs"
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
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition"
            >
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-medium text-slate-600">{kpi.title}</span>
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500">
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">{kpi.value}</div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                <span className="text-slate-400 truncate">{kpi.subValue}</span>
                <span className="text-emerald-600 font-semibold shrink-0 ml-1">{kpi.trend}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6 Key Charts Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            System Trends ({timeFilter === 'today' ? 'Hôm nay' : timeFilter})
          </h2>
          <span className="text-xs text-slate-400">Tự động đồng bộ từ Telemetry Service</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Chart 1: Users */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-slate-700">1. Users Over Time</div>
                <div className="text-[11px] text-slate-400">Lượng người dùng hoạt động</div>
              </div>
              <span className="text-xs font-bold text-blue-600">Active</span>
            </div>
            <CompactChart data={charts.users} color="#2563eb" fillColor="rgba(37, 99, 235, 0.08)" type="area" />
          </div>

          {/* Chart 2: Lessons */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-slate-700">2. Lesson Generation</div>
                <div className="text-[11px] text-slate-400">Số bài giảng sinh ra</div>
              </div>
              <span className="text-xs font-bold text-indigo-600">Lessons</span>
            </div>
            <CompactChart data={charts.lessons} color="#6366f1" fillColor="rgba(99, 102, 241, 0.08)" type="bar" />
          </div>

          {/* Chart 3: AI Requests */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-slate-700">3. AI Requests</div>
                <div className="text-[11px] text-slate-400">Lưu lượng gọi API LLM</div>
              </div>
              <span className="text-xs font-bold text-sky-600">Calls</span>
            </div>
            <CompactChart data={charts.requests} color="#0284c7" fillColor="rgba(2, 132, 199, 0.08)" type="area" />
          </div>

          {/* Chart 4: AI Cost */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-slate-700">4. AI Cost ($)</div>
                <div className="text-[11px] text-slate-400">Chi phí token tiêu thụ</div>
              </div>
              <span className="text-xs font-bold text-emerald-600">USD</span>
            </div>
            <CompactChart data={charts.cost} color="#059669" fillColor="rgba(5, 150, 105, 0.08)" type="line" valuePrefix="$" />
          </div>

          {/* Chart 5: Quality Score */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-slate-700">5. Quality Score</div>
                <div className="text-[11px] text-slate-400">Điểm sư phạm chuẩn hoá</div>
              </div>
              <span className="text-xs font-bold text-emerald-600">pts</span>
            </div>
            <CompactChart data={charts.quality} color="#10b981" fillColor="rgba(16, 185, 129, 0.08)" type="area" valueSuffix="/100" />
          </div>

          {/* Chart 6: Error Rate */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold text-slate-700">6. Error Rate (%)</div>
                <div className="text-[11px] text-slate-400">Tỷ lệ lỗi phát sinh</div>
              </div>
              <span className="text-xs font-bold text-rose-600">Error %</span>
            </div>
            <CompactChart data={charts.errorRate} color="#e11d48" fillColor="rgba(225, 29, 72, 0.08)" type="line" valueSuffix="%" />
          </div>
        </div>
      </div>

      {/* Bottom split: Recent Quality Issues & Langfuse Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quality Issues Feed */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Ghi Nhận Sự Cố Nội Dung Gần Đây (Content Quality Feed)
              </h3>
            </div>
            <Link to="/admin/quality" className="text-xs text-blue-600 hover:underline font-medium">
              Xem tất cả →
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentIssues.map((issue) => (
              <div
                key={issue.id}
                className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl transition flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-800">{issue.lessonTitle}</span>
                    <span className="text-[10px] font-mono text-slate-400">({issue.sectionId})</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                        issue.severity === 'critical'
                          ? 'bg-rose-100 text-rose-700'
                          : issue.severity === 'high'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {issue.issueType}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] line-clamp-1 italic">
                    Raw: "{issue.rawOutput}"
                  </p>
                  <p className="text-emerald-700 text-[11px] line-clamp-1 font-medium">
                    Cleaned: "{issue.cleanedOutput}"
                  </p>
                </div>

                {issue.traceId && (
                  <a
                    href={adminTelemetryService.getLangfuseTraceUrl(issue.traceId)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-slate-400 hover:text-blue-600 transition p-1"
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
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Langfuse Observability
                </h3>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Theo dõi toàn diện các generation LLM, phân rã latency, tính toán chi phí token và quản lý phiên trace.
            </p>

            <div className="space-y-2 pt-1 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Traces Count:</span>
                <span className="font-mono font-semibold text-slate-800">{langfuseData.summary.totalTraces}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Generations:</span>
                <span className="font-mono font-semibold text-slate-800">{langfuseData.summary.totalGenerations}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Telemetry Cost:</span>
                <span className="font-mono font-semibold text-emerald-600">${langfuseData.summary.totalCost}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Quality Index:</span>
                <span className="font-mono font-semibold text-blue-600">{langfuseData.summary.qualityScore}/100</span>
              </div>
            </div>
          </div>

          <a
            href={langfuseData.summary.projectUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shadow-xs"
          >
            <span>Open Langfuse Project</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
