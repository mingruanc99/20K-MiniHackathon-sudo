// src/pages/admin/AdminEvaluationPage.tsx
/**
 * Benchmark & evaluation from real run logs (no constants).
 * Sources: benchmark run logs (localStorage + Firestore projects/{id}/runs) and golden regression runs.
 */
import React,{ useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, FlaskConical, Loader2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { CompactChart } from '../../components/admin/CompactChart';
import { benchmarkService } from '../../services/benchmark/benchmarkService';
import { BenchmarkRunLog } from '../../services/benchmark/benchmarkTypes';
import { goldenDatasetService, RegressionRun } from '../../services/goldenDatasetService';
import { projectService } from '../../services/projectService';

const pct = (v?: number | null, digits = 0) => (v === undefined || v === null ? '—' : `${(v * 100).toFixed(digits)}%`);
const num = (v?: number | null, digits = 2) => (v === undefined || v === null ? '—' : v.toFixed(digits));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

async function loadAllRuns(): Promise<BenchmarkRunLog[]> {
  const local = await benchmarkService.listRuns(undefined, 200);
  const byId = new Map(local.map((r) => [r.run_id, r]));
  try {
    const projects = await projectService.listAllProjects();
    const remote = await Promise.all(projects.filter((p) => p.projectId.startsWith('proj_') && !p.projectId.startsWith('proj_demo')).map((p) => benchmarkService.listRuns(p.projectId, 30)));
    remote.flat().forEach((r) => byId.set(r.run_id, r));
  } catch {
    /* local runs only */
  }
  return Array.from(byId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export const AdminEvaluationPage: React.FC = () => {
  const [runs, setRuns] = useState<BenchmarkRunLog[] | null>(null);
  const [regressions, setRegressions] = useState<RegressionRun[]>(() => goldenDatasetService.getRuns());
  const [loading, setLoading] = useState(false);
  const [regBusy, setRegBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [kind, setKind] = useState<'pipeline' | 'scan' | 'all'>('pipeline');

  const refresh = async () => {
    setLoading(true);
    setRuns(await loadAllRuns());
    setRegressions(goldenDatasetService.getRuns());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const runRegression = async (engine: 'template' | 'llm') => {
    if (engine === 'llm' && !window.confirm('Chạy hồi quy bằng LLM sẽ gọi API cho 4 bài và tốn token. Tiếp tục?')) return;
    setRegBusy('0/4');
    try {
      await goldenDatasetService.runRegressionEvaluation({ engine, onProgress: (d, t) => setRegBusy(`${d}/${t}`) });
      await refresh();
    } finally {
      setRegBusy(null);
    }
  };

  const shown = useMemo(() => (runs || []).filter((r) => kind === 'all' || r.kind === kind), [runs, kind]);
  const pipelineRuns = useMemo(() => (runs || []).filter((r) => r.kind === 'pipeline' && r.metrics), [runs]);
  const recent = pipelineRuns.slice(0, 10);

  const kpis = {
    runs: runs?.length || 0,
    overall: mean(recent.map((r) => r.metrics!.dimensions.overall)),
    darp: mean(recent.map((r) => r.metrics!.dar_p_error_pct)),
    connective: mean(recent.map((r) => r.metrics!.connective_density)),
    headingRepeats: mean(recent.map((r) => r.metrics!.heading_repeats)),
    tokens: (runs || []).reduce((s, r) => s + r.tokens.totalTokens, 0),
    cost: (runs || []).reduce((s, r) => s + r.tokens.costUsd, 0),
    costComplete: (runs || []).every((r) => r.tokens.costComplete),
    estimated: (runs || []).reduce((s, r) => s + r.tokens.estimatedCalls, 0)
  };

  const trend = pipelineRuns
    .slice(0, 20)
    .reverse()
    .map((r) => ({ label: new Date(r.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }), value: Math.round(r.metrics!.dimensions.overall * 1000) / 10 }));

  const latestReg = regressions[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Benchmark & Đánh giá</h1>
          <p className="mt-1 text-xs text-ink-faint">
            Mọi số liệu tính từ log của từng lần chạy thật (pipeline, quét tài liệu, hồi quy). Không có log thì hiển thị “—”.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-rule-strong bg-paper-sheet px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-paper-band disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
          </button>
          <button type="button" onClick={() => runRegression('template')} disabled={Boolean(regBusy)} className="inline-flex items-center gap-1.5 rounded-lg bg-cover px-3 py-1.5 text-xs font-semibold text-white hover:bg-cover disabled:opacity-50">
            {regBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
            {regBusy ? `Đang chạy hồi quy ${regBusy}` : 'Chạy hồi quy (template, 0 token)'}
          </button>
          <button type="button" onClick={() => runRegression('llm')} disabled={Boolean(regBusy)} className="inline-flex items-center gap-1.5 rounded-lg border border-rule-strong bg-paper-sheet px-3 py-1.5 text-xs font-semibold text-navy hover:bg-paper-band disabled:opacity-50">
            Hồi quy bằng LLM
          </button>
          <button type="button" disabled={!runs?.length} onClick={() => runs && benchmarkService.download(runs)} className="inline-flex items-center gap-1.5 rounded-lg border border-rule-strong bg-paper-sheet px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-paper-band disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> Tải tất cả log
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {[
          ['Số lần chạy', runs ? String(kpis.runs) : '—', 'pipeline + quét + hồi quy'],
          ['Điểm tổng (10 lần gần nhất)', kpis.overall === null ? '—' : (kpis.overall * 100).toFixed(1), '0–100, trọng số 5 chiều'],
          ['DAR-P lệch TB', kpis.darp === null ? '—' : `${kpis.darp.toFixed(1)}%`, 'ngưỡng ≤ 15%'],
          ['Mật độ từ nối TB', kpis.connective === null ? '—' : pct(kpis.connective), 'ngưỡng ≤ 25% số câu'],
          ['Lặp tiêu đề TB', kpis.headingRepeats === null ? '—' : kpis.headingRepeats.toFixed(1), 'lần / bài giảng'],
          ['Tổng token', kpis.tokens.toLocaleString(), kpis.estimated ? `${kpis.estimated} lần gọi là ước tính` : 'từ usage của API'],
          ['Chi phí', `$${kpis.cost.toFixed(4)}`, kpis.costComplete ? 'theo bảng giá model' : 'thiếu giá một số model']
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-xl border border-rule bg-paper-sheet p-3">
            <div className="text-xs font-medium text-ink-faint">{label}</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-ink">{value}</div>
            <div className="text-[11px] text-ink-faint">{hint}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-rule bg-paper-sheet p-4">
          <div className="mb-2 text-xs font-semibold text-ink">Điểm tổng theo từng lần chạy pipeline</div>
          <CompactChart data={trend} type="line" valueSuffix="" height={170} />
        </div>
        <div className="space-y-2 rounded-xl border border-rule bg-paper-sheet p-4 text-xs text-ink-soft">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Info className="h-3.5 w-3.5 text-print" /> Công thức
          </div>
          <p><b>DAR-P</b> = |T_ước tính − T_mục tiêu| / T_mục tiêu; T_ước tính = Σ từ/(WPM/60)·hệ số tốc độ + Σ khoảng nghỉ.</p>
          <p><b>VTC</b> = cue đúng 13 loại / tổng cue. <b>CNS</b> = cue có lý do sư phạm / tổng cue.</p>
          <p><b>Grounding</b> = token nội dung (&gt;4 ký tự) của lời giảng có trong tài liệu / tổng token nội dung.</p>
          <p><b>Mật độ từ nối</b> = câu mở đầu bằng từ nối / tổng câu. <b>Lặp tiêu đề</b> = số lần nhắc lại tiêu đề đã nói.</p>
          <p><b>Điểm tổng</b> = 0.25·content + 0.20·pedagogy + 0.20·narrative + 0.20·visual + 0.15·technical.</p>
          <p className="text-ink-faint">Chi tiết: docs/specs/EVALUATION.md</p>
        </div>
      </div>

      {/* Regression */}
      <div className="rounded-xl border border-rule bg-paper-sheet p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="text-xs font-semibold text-ink">Hồi quy golden dataset</div>
          {latestReg && (
            <span className="text-xs text-ink-faint">
              {new Date(latestReg.timestamp).toLocaleString('vi-VN')} • {latestReg.engine} • đạt {latestReg.passed_cases}/{latestReg.total_cases}
              {latestReg.regression_detected ? ` • hồi quy: ${latestReg.regressed_cases.join(', ')}` : ''}
            </span>
          )}
        </div>
        {!latestReg ? (
          <p className="text-xs text-ink-faint">Chưa chạy hồi quy lần nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-ink-faint">
                <tr>
                  <th className="py-1 pr-3 font-medium">Ca</th>
                  <th className="py-1 pr-3 font-medium">Kết quả</th>
                  <th className="py-1 pr-3 font-medium">Phủ khái niệm</th>
                  <th className="py-1 pr-3 font-medium">Thiếu</th>
                  <th className="py-1 pr-3 font-medium">Tổng</th>
                  <th className="py-1 pr-3 font-medium">DAR-P</th>
                  <th className="py-1 font-medium">Δ so với lần trước</th>
                </tr>
              </thead>
              <tbody>
                {latestReg.cases.map((c) => (
                  <tr key={c.case_id} className="border-t border-rule">
                    <td className="py-1.5 pr-3 text-ink">{c.title}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`rounded px-1.5 py-0.5 font-semibold ${c.passed ? 'bg-paper-band text-print' : 'bg-pen-soft text-pen'}`}>{c.passed ? 'Đạt' : 'Không đạt'}</span>
                    </td>
                    <td className="py-1.5 pr-3 font-mono">{pct(c.concept_recall)}</td>
                    <td className="py-1.5 pr-3 text-ink-faint">{c.missing_concepts.join(', ') || '—'}</td>
                    <td className="py-1.5 pr-3 font-mono">{num(c.scores.overall)}</td>
                    <td className="py-1.5 pr-3 font-mono">{c.dar_p_error_pct}%</td>
                    <td className="py-1.5 font-mono text-ink-faint">{c === latestReg.cases[0] ? Object.entries(latestReg.dimension_deltas).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(' · ') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Run log table */}
      <div className="rounded-xl border border-rule bg-paper-sheet p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="text-xs font-semibold text-ink">Log từng lần chạy</div>
          <div className="ml-auto flex gap-1">
            {(['pipeline', 'scan', 'all'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-md px-2 py-0.5 text-xs ${kind === k ? 'bg-cover text-white' : 'text-ink-soft hover:bg-paper-band'}`}>
                {k === 'pipeline' ? 'Pipeline' : k === 'scan' ? 'Quét tài liệu' : 'Tất cả'}
              </button>
            ))}
          </div>
        </div>
        {!runs ? (
          <p className="text-xs text-ink-faint">Đang tải...</p>
        ) : shown.length === 0 ? (
          <p className="text-xs text-ink-faint">Chưa có log. Chạy một bài giảng hoặc bấm “Chạy hồi quy”.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-ink-faint">
                <tr>
                  <th className="py-1 pr-2" />
                  <th className="py-1 pr-3 font-medium">Thời điểm</th>
                  <th className="py-1 pr-3 font-medium">Bài giảng</th>
                  <th className="py-1 pr-3 font-medium">Model / chế độ</th>
                  <th className="py-1 pr-3 font-medium">Tổng</th>
                  <th className="py-1 pr-3 font-medium">DAR-P</th>
                  <th className="py-1 pr-3 font-medium">Từ nối</th>
                  <th className="py-1 pr-3 font-medium">Lặp tiêu đề</th>
                  <th className="py-1 pr-3 font-medium">Token</th>
                  <th className="py-1 pr-3 font-medium">Chi phí</th>
                  <th className="py-1 pr-3 font-medium">Thời gian</th>
                  <th className="py-1 font-medium" />
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 100).map((r) => (
                  <React.Fragment key={r.run_id}>
                    <tr className="border-t border-rule">
                      <td className="py-1.5 pr-2">
                        <button type="button" onClick={() => setOpen(open === r.run_id ? null : r.run_id)} aria-label="Chi tiết" className="rounded p-0.5 hover:bg-paper-band">
                          {open === r.run_id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-ink-soft">{new Date(r.created_at).toLocaleString('vi-VN')}</td>
                      <td className="max-w-[220px] truncate py-1.5 pr-3 text-ink" title={r.project_title}>
                        {r.kind === 'scan' ? '🔎 ' : ''}
                        {r.project_title}
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-ink-soft">
                        {r.model.replace(/^gemini:/, '')} • {r.kind === 'scan' ? 'scan' : r.config.narration_engine}
                      </td>
                      <td className="py-1.5 pr-3 font-mono">{r.metrics ? (r.metrics.dimensions.overall * 100).toFixed(1) : '—'}</td>
                      <td className="py-1.5 pr-3 font-mono">{r.metrics ? `${r.metrics.dar_p_error_pct}%` : '—'}</td>
                      <td className="py-1.5 pr-3 font-mono">{r.metrics ? pct(r.metrics.connective_density) : '—'}</td>
                      <td className="py-1.5 pr-3 font-mono">{r.metrics ? r.metrics.heading_repeats : '—'}</td>
                      <td className="py-1.5 pr-3 font-mono">
                        {r.tokens.totalTokens.toLocaleString()}
                        {r.tokens.estimatedCalls ? '*' : ''}
                      </td>
                      <td className="py-1.5 pr-3 font-mono">${r.tokens.costUsd.toFixed(5)}</td>
                      <td className="py-1.5 pr-3 font-mono">{(r.total_ms / 1000).toFixed(1)}s</td>
                      <td className="py-1.5">
                        <button type="button" onClick={() => benchmarkService.download(r)} className="rounded p-1 text-ink-faint hover:bg-paper-band" aria-label="Tải log JSON">
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                    {open === r.run_id && (
                      <tr>
                        <td colSpan={12} className="bg-paper-band px-3 py-3">
                          <RunDetail run={r} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-ink-faint">* có lần gọi API không trả usage, số token của lần đó là ước tính (~4 ký tự/token).</p>
          </div>
        )}
      </div>
    </div>
  );
};

const RunDetail: React.FC<{ run: BenchmarkRunLog }> = ({ run }) => (
  <div className="grid gap-4 text-xs md:grid-cols-3">
    <div>
      <div className="mb-1 font-semibold text-ink">Chỉ số</div>
      {run.metrics ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-ink-soft">
          <dt>VTC</dt><dd className="font-mono">{pct(run.metrics.vtc)}</dd>
          <dt>CNS</dt><dd className="font-mono">{pct(run.metrics.cns)}</dd>
          <dt>Grounding</dt><dd className="font-mono">{pct(run.metrics.grounding)}</dd>
          <dt>Ngôn ngữ</dt><dd className="font-mono">{pct(run.metrics.language)}</dd>
          <dt>Chống lặp</dt><dd className="font-mono">{pct(run.metrics.anti_repetition)}</dd>
          <dt>Prosody hợp lệ</dt><dd className="font-mono">{pct(run.metrics.prosody_validity)}</dd>
          <dt>Phủ keyword</dt><dd className="font-mono">{pct(run.metrics.keyword_coverage)}</dd>
          <dt>Phủ vùng ảnh</dt><dd className="font-mono">{pct(run.metrics.visual_coverage)}</dd>
          <dt>DAR-P trước sửa</dt><dd className="font-mono">{run.metrics.dar_p_pre_repair_pct}%</dd>
          <dt>Thời lượng</dt><dd className="font-mono">{run.metrics.estimated_duration_sec}s / {run.metrics.target_duration_sec}s</dd>
          <dt>Số từ / câu</dt><dd className="font-mono">{run.metrics.words_total} / {run.metrics.sentences_total}</dd>
          <dt>Quyết định</dt><dd className="font-mono">{run.metrics.decision}</dd>
        </dl>
      ) : run.scan ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-ink-soft">
          <dt>Trang</dt><dd className="font-mono">{run.scan.pages} ({run.scan.pages_llm} LLM)</dd>
          <dt>Vùng ảnh đã đọc</dt><dd className="font-mono">{run.scan.regions_ocr_done}/{run.scan.regions}</dd>
          <dt>Keyword</dt><dd className="font-mono">{run.scan.keywords}</dd>
          <dt>Bị cắt bớt</dt><dd className="font-mono">{run.scan.truncated ? 'có' : 'không'}</dd>
        </dl>
      ) : null}
      {run.discourse && (
        <p className="mt-2 text-ink-faint">
          Từ nối: giữ {run.discourse.connectives_kept}/{run.discourse.connectives_before}, bỏ {run.discourse.connectives_removed}. Tiêu đề lặp đã xử lý: {run.discourse.heading_repeats_removed} (xoá {run.discourse.transition_sentences_dropped} câu chuyển ý).
        </p>
      )}
      {run.notes.length > 0 && <ul className="mt-2 list-disc pl-4 text-pen">{run.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
    </div>
    <div>
      <div className="mb-1 font-semibold text-ink">Thời gian từng bước</div>
      <ul className="space-y-0.5 text-ink-soft">
        {run.timings.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="flex-1 truncate">{t.stage}</span>
            <span className="font-mono">{t.ms}ms</span>
          </li>
        ))}
      </ul>
    </div>
    <div>
      <div className="mb-1 font-semibold text-ink">Lần gọi LLM ({run.calls.length})</div>
      {run.calls.length === 0 ? (
        <p className="text-ink-faint">Không gọi API.</p>
      ) : (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto text-ink-soft">
          {run.calls.map((c) => (
            <li key={c.callId} className="flex gap-2">
              <span className={`w-14 shrink-0 ${c.status === 'error' ? 'text-pen' : c.status === 'cache_hit' ? 'text-ink-faint' : ''}`}>{c.status}</span>
              <span className="flex-1 truncate" title={c.feature}>{c.feature}</span>
              <span className="font-mono">{c.promptTokens}+{c.completionTokens}{c.thoughtsTokens ? `+${c.thoughtsTokens}t` : ''}{c.tokensEstimated ? '*' : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

