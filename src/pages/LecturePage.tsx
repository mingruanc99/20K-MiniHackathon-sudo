// src/pages/LecturePage.tsx
/**
 * One lecture, one flow: review structure & time -> generate -> read and download.
 * The full studio (M1–M4 viewers) and the detailed Knowledge Inspector stay one click away
 * under "Nâng cao".
 */
import React,{ useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Network,
  AlertTriangle,
  Pencil,
  Star
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { projectService } from '../services/projectService';
import { pipelineOrchestrator } from '../pipeline/orchestrator';
import { scanDocument, ScanProgress } from '../pipeline/services/documentScanner';
import { findNode, rebalanceToTarget, setNodeDuration, toggleLock, treeToPipelineOverrides } from '../pipeline/services/knowledgeTreeOps';
import { COVERAGE_PRESETS, fullDurationOf, minTemplateCoverage, setCoverage, toggleExcludeKeepingCoverage, withContentEstimates } from '../pipeline/services/contentDuration';
import { QualityVisualGuard } from '../pipeline/module4_guard/qualityGuard';
import { benchmarkService, buildScanRunLog, summarizeRun } from '../services/benchmark/benchmarkService';
import { BenchmarkRunLog } from '../services/benchmark/benchmarkTypes';
import { diagnoseLecture, FixAction, FixItem } from '../services/qualityFixes';
import { KnowledgeTree, KnowledgeTreeNode, Project, UserConfiguration } from '../types';
import { DECISION_LABEL, fmtClock, gradeStamp, lectureDocument, lectureStage } from '../services/lectureStatus';
import { markLectureMoved } from './LectureBoardPage';
import { exportStudioScript } from '../pipeline/export/scriptMarkdown';
import { StudyCalibrationPanel } from '../components/knowledge/StudyCalibrationPanel';

type View = 'review' | 'result';

const LEVEL_LABEL: Record<string, string> = { beginner: 'Phổ thông', undergraduate: 'Đại học', graduate: 'Sau đại học', professional: 'Chuyên gia' };

function download(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'bai-giang';

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
const Steps: React.FC<{ current: number }> = ({ current }) => {
  const steps = ['Tài liệu', 'Thiết lập', 'Duyệt cấu trúc', 'Bài giảng'];
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Tiến trình">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                done ? 'bg-print text-paper' : active ? 'bg-navy text-paper' : 'bg-rule text-ink-faint'
              }`}
              aria-hidden
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={active ? 'font-semibold text-ink' : done ? 'text-ink-soft' : 'text-ink-faint'} aria-current={active ? 'step' : undefined}>
              {s}
            </span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-rule-strong" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
};

// ---------------------------------------------------------------------------
// Structure review
// ---------------------------------------------------------------------------
/** Nudging one page keeps the lecture length: the time comes from (or goes back to) the other unlocked pages. */
function nudgeKeepingTotal(tree: KnowledgeTree, pageId: string, delta: number): KnowledgeTree {
  const total = tree.root.duration_sec || tree.settings.target_duration_sec;
  const page = findNode(tree.root, pageId);
  if (!page) return tree;
  const wasLocked = Boolean(page.locked);
  let next = setNodeDuration(tree, pageId, Math.max(5, (page.duration_sec || 0) + delta));
  if (!wasLocked) next = toggleLock(next, pageId);
  next = rebalanceToTarget(next, total);
  return wasLocked ? next : toggleLock(next, pageId);
}

const PageRow: React.FC<{
  node: KnowledgeTreeNode;
  index: number;
  parentExcluded: boolean;
  secPerTick: number;
  note?: string;
  onToggle: () => void;
  onNudge: (delta: number) => void;
}> = ({ node, index, parentExcluded, secPerTick, note, onToggle, onNudge }) => {
  const off = parentExcluded || node.excluded;
  const keywords = node.children.filter((c) => c.kind === 'keyword' && !c.excluded).sort((a, b) => (b.weight || 0) - (a.weight || 0)).slice(0, 4);
  const ticks = Math.max(1, Math.round((node.duration_sec || 0) / secPerTick));
  return (
    <tr className={`border-b border-rule align-top ${off ? 'text-ink-faint' : ''}`}>
      <td className="border-r border-rule px-2 py-2.5 text-center text-xs tabular-nums text-ink-faint">{index}</td>
      <td className="border-r border-rule px-3 py-2.5">
        <div className={`text-sm ${off ? 'line-through' : 'text-ink'}`}>{node.title}</div>
        {keywords.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-ink-soft">
            {keywords.map((k) => (
              <span key={k.id} title={`Trọng số ${(k.weight || 0).toFixed(2)}`} className={k.keyword?.kind === 'focus' ? 'font-semibold text-pen' : ''}>
                {k.keyword?.kind === 'focus' && <Star className="mr-0.5 inline h-3 w-3 fill-current align-[-1px]" aria-label="Trọng tâm ôn" />}
                {k.title}
              </span>
            ))}
          </div>
        )}
        {note && <p className="mt-1 font-hand text-[15px] text-navy">{note}</p>}
      </td>
      <td className="hidden border-r border-rule px-3 py-3 sm:table-cell">
        {!off && <span className="ledger-ticks block h-2.5 rounded-sm bg-navy" style={{ width: `${Math.min(100, ticks * 6)}%`, ['--tick' as any]: '6px' }} aria-hidden />}
      </td>
      <td className="border-r border-rule px-1 py-1.5">
        <div className="flex items-center justify-center gap-0.5">
          <button type="button" disabled={off} onClick={() => onNudge(-10)} aria-label="Bớt 10 giây" className="rounded p-1 text-ink-faint hover:bg-paper-band hover:text-ink disabled:opacity-30">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-11 text-center text-sm tabular-nums text-ink">{off ? '—' : fmtClock(node.duration_sec)}</span>
          <button type="button" disabled={off} onClick={() => onNudge(10)} aria-label="Thêm 10 giây" className="rounded p-1 text-ink-faint hover:bg-paper-band hover:text-ink disabled:opacity-30">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
      <td className="px-2 py-2.5 text-center">
        <input
          type="checkbox"
          checked={!node.excluded}
          disabled={parentExcluded}
          onChange={onToggle}
          aria-label={`Giảng trang "${node.title}"`}
          className="h-4 w-4 rounded border-rule-strong accent-[#2c5a47]"
        />
      </td>
    </tr>
  );
};

const StructureReview: React.FC<{ tree: KnowledgeTree; engine?: 'template' | 'llm'; onChange: (t: KnowledgeTree) => void }> = ({ tree, engine, onChange }) => {
  const [open, setOpen] = useState<Set<string>>(() => new Set(tree.root.children.slice(0, 2).map((c) => c.id)));
  const [note, setNote] = useState<{ pageId: string; text: string } | null>(null);
  const total = tree.root.duration_sec || 0;
  const minutes = Math.round(total / 60);
  // Length as a share of the full content (null on trees built before content estimates).
  const full = fullDurationOf(tree);
  const coverage = full ? total / full : null;
  // Template narration keeps at least one sentence per page, so very low coverage can't be met.
  const minCov = engine !== 'llm' ? minTemplateCoverage(tree) : null;
  const belowMin = minCov !== null && coverage !== null && coverage < minCov - 0.02;
  const secPerTick = 10;
  let pageIndex = 0;

  const nudge = (pageId: string, delta: number) => {
    onChange(nudgeKeepingTotal(tree, pageId, delta));
    setNote({ pageId, text: delta > 0 ? `+${delta}s, lấy từ các trang chưa khoá` : `${delta}s, trả lại cho các trang khác` });
    window.setTimeout(() => setNote((n) => (n?.pageId === pageId ? null : n)), 2600);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Giáo án: cấu trúc & thời lượng</h2>
          <p className="text-sm text-ink-soft">
            {full
              ? 'Thời lượng tính theo lượng nội dung: 100% là giảng hết chữ, ghi chú, bảng và sơ đồ trên các trang đang bật. Thêm giờ cho một trang thì giờ lấy từ các trang khác.'
              : 'Bỏ dấu ở trang không cần giảng. Thêm giờ cho trang này thì giờ được lấy từ các trang khác, tổng không đổi.'}
          </p>
        </div>
        {full ? (
          <div className="flex flex-col items-end gap-1 text-sm text-ink-soft">
            <div className="flex items-center gap-2">
              Độ phủ
              <div className="flex overflow-hidden rounded-lg border border-rule-strong" role="group" aria-label="Độ phủ nội dung">
                {COVERAGE_PRESETS.map((c) => {
                  const on = coverage !== null && Math.abs(coverage - c) < 0.02;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      title={`${Math.round(c * 100)}% nội dung ≈ ${fmtClock(full * c)}`}
                      onClick={() => onChange(setCoverage(tree, c))}
                      className={`border-r border-rule px-2.5 py-1 tabular-nums transition-colors last:border-r-0 ${on ? 'bg-cover font-semibold text-paper' : 'bg-paper-sheet text-ink-soft hover:bg-paper-band hover:text-ink'}`}
                    >
                      {Math.round(c * 100)}%
                    </button>
                  );
                })}
              </div>
            </div>
            {belowMin && (
              <span role="status" className="max-w-xs text-right text-xs text-pen">
                Cách viết Theo mẫu giữ ít nhất một câu mỗi trang, nên bài sẽ dài khoảng {fmtClock(full! * minCov!)} ({Math.round(minCov! * 100)}%). Tắt bớt trang hoặc chọn AI viết để ngắn hơn.
              </span>
            )}
            <span className="text-xs tabular-nums">
              <span className="font-semibold text-ink">{fmtClock(total)}</span>
              {coverage !== null && ` · ${Math.round(coverage * 100)}% của ${fmtClock(full)} nội dung đầy đủ`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-ink-soft">
            Tổng
            <div className="flex overflow-hidden rounded-lg border border-rule-strong" role="group" aria-label="Tổng thời lượng">
              {[3, 5, 10, 15, 20].map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutes === m}
                  onClick={() => onChange(rebalanceToTarget(tree, m * 60))}
                  className={`border-r border-rule px-2.5 py-1 tabular-nums transition-colors last:border-r-0 ${minutes === m ? 'bg-cover font-semibold text-paper' : 'bg-paper-sheet text-ink-soft hover:bg-paper-band hover:text-ink'}`}
                >
                  {m}′
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-rule-strong bg-paper-sheet">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-print/60 bg-paper-band text-[13px] font-semibold text-print">
              <th scope="col" className="w-10 border-r border-rule px-2 py-2 text-center">Tiết</th>
              <th scope="col" className="border-r border-rule px-3 py-2">Nội dung</th>
              <th scope="col" className="hidden w-[22%] border-r border-rule px-3 py-2 sm:table-cell">Tỉ trọng</th>
              <th scope="col" className="w-32 border-r border-rule px-2 py-2 text-center">Thời lượng</th>
              <th scope="col" className="w-14 px-2 py-2 text-center">Giảng</th>
            </tr>
          </thead>
          {tree.root.children.map((ch) => {
            const isOpen = open.has(ch.id);
            const pages = ch.children.filter((c) => c.kind === 'page');
            const share = total > 0 && !ch.excluded ? (ch.duration_sec || 0) / total : 0;
            return (
              <tbody key={ch.id}>
                <tr className={`border-b border-rule-strong bg-paper-band ${ch.excluded ? 'text-ink-faint' : ''}`}>
                  <td className="border-r border-rule px-2 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() =>
                        setOpen((prev) => {
                          const next = new Set(prev);
                          next.has(ch.id) ? next.delete(ch.id) : next.add(ch.id);
                          return next;
                        })
                      }
                      aria-expanded={isOpen}
                      aria-label={isOpen ? 'Thu gọn chương' : 'Mở chương'}
                      className="rounded p-0.5 text-navy hover:bg-paper-band"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="border-r border-rule px-3 py-2.5">
                    <span className={`text-sm font-semibold ${ch.excluded ? 'line-through' : 'text-ink'}`}>{ch.title}</span>
                    <span className="ml-2 text-xs text-ink-faint">{pages.length} trang</span>
                  </td>
                  <td className="hidden border-r border-rule px-3 py-3 sm:table-cell">
                    <span className="block text-xs tabular-nums text-ink-soft">{Math.round(share * 100)}%</span>
                  </td>
                  <td className="border-r border-rule px-2 py-2.5 text-center text-sm font-semibold tabular-nums text-ink">{ch.excluded ? '—' : fmtClock(ch.duration_sec)}</td>
                  <td className="px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={!ch.excluded}
                      onChange={() => onChange(toggleExcludeKeepingCoverage(tree, ch.id))}
                      aria-label={`Giảng chương "${ch.title}"`}
                      className="h-4 w-4 rounded border-rule-strong accent-[#2c5a47]"
                    />
                  </td>
                </tr>
                {pages.map((pg) => {
                  pageIndex++;
                  return isOpen ? (
                    <PageRow
                      key={pg.id}
                      node={pg}
                      index={pageIndex}
                      parentExcluded={Boolean(ch.excluded)}
                      secPerTick={secPerTick}
                      note={note?.pageId === pg.id ? note.text : undefined}
                      onToggle={() => onChange(toggleExcludeKeepingCoverage(tree, pg.id))}
                      onNudge={(d) => nudge(pg.id, d)}
                    />
                  ) : null;
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
};


// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------
const FixPanel: React.FC<{ fixes: FixItem[]; busy: boolean; onAction: (a: FixAction) => void; onJump: (sceneId: string) => void }> = ({ fixes, busy, onAction, onJump }) => (
  <section className="rounded-lg border border-pen-line bg-paper-wash" aria-labelledby="fix-title">
    <h2 id="fix-title" className="flex items-baseline gap-3 border-b border-pen-line px-4 py-3">
      <span className="font-hand text-2xl leading-none text-pen">Lời phê</span>
      <span className="text-sm text-pen/80">
        {(() => {
          const required = fixes.filter((f) => !f.optional).length;
          const optional = fixes.length - required;
          return [required ? `${required} điểm cần sửa, kèm cách sửa` : '', optional ? `${optional} gợi ý không bắt buộc` : ''].filter(Boolean).join(' · ');
        })()}{' '}
        <AlertTriangle className="inline h-3.5 w-3.5 align-[-2px]" />
      </span>
    </h2>
    <ol className="divide-y divide-pen-line/70">
      {fixes.map((f) => (
        <li key={f.checkId} className="space-y-2 px-4 py-4">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="text-sm font-semibold text-ink">{f.title}</h3>
            <span className={`text-xs font-medium ${f.optional ? 'text-ink-faint' : 'text-pen'}`}>{f.optional ? 'Tuỳ chọn' : f.severity === 'FAILED' ? 'Chưa đạt' : 'Cảnh báo'}</span>
          </div>
          <p className="text-sm text-ink-soft">{f.why}</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-soft">
            {f.how.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          {f.sceneIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
              Cảnh cần sửa:
              {f.sceneIds.map((id) => (
                <button key={id} type="button" onClick={() => onJump(id)} className="rounded-md bg-paper-sheet px-1.5 py-0.5 font-medium text-navy ring-1 ring-pen-line hover:bg-paper-band">
                  {id}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {f.actions.map((a, i) => (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => onAction(a)}
                className={
                  a.primary
                    ? 'rounded-xl bg-cover px-3 py-1.5 text-sm font-semibold text-paper hover:bg-cover-deep disabled:opacity-50'
                    : 'rounded-xl border border-rule-strong bg-paper-sheet px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-paper-band disabled:opacity-50'
                }
              >
                {a.label}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ol>
  </section>
);

const ResultView: React.FC<{
  project: Project;
  run: BenchmarkRunLog | null;
  busy: boolean;
  editRequest: { ids: string[]; nonce: number } | null;
  onAction: (a: FixAction) => void;
  onSaveEdits: (edits: Record<string, string>) => void;
}> = ({ project, run, busy, editRequest, onAction, onSaveEdits }) => {
  const ir = project.clsgIr!;
  const report = project.qualityReport || ir.quality_report;
  const [playing, setPlaying] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const lang = (ir.configuration.narration_language || ir.configuration.language) === 'en' ? 'en-US' : 'vi-VN';
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const fixes = useMemo(() => diagnoseLecture(project), [project]);
  const flagged = useMemo(() => new Set(fixes.filter((f) => !f.optional).flatMap((f) => f.sceneIds)), [fixes]);
  useEffect(() => () => canSpeak && window.speechSynthesis.cancel(), []);

  const openEditors = (ids: string[]) => {
    setDrafts((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        const s = ir.scenes.find((x) => x.section_id === id);
        if (s && next[id] === undefined) next[id] = s.narration.text;
      });
      return next;
    });
    if (ids[0]) setTimeout(() => document.getElementById(`scene-${ids[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  useEffect(() => {
    if (editRequest) openEditors(editRequest.ids.length ? editRequest.ids : ir.scenes.map((s) => s.section_id).slice(0, 1));
  }, [editRequest?.nonce]);

  const speak = (id: string, text: string) => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    if (playing === id) return setPlaying(null);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = Math.max(0.7, Math.min(1.3, (ir.configuration.targetWpm || 140) / 150));
    u.onend = () => setPlaying(null);
    setPlaying(id);
    window.speechSynthesis.speak(u);
  };

  const connective = report.checks.find((c) => c.check_id === 'chk_connective_density');
  const heading = report.checks.find((c) => c.check_id === 'chk_heading_repetition');
  const base = slug(project.title);
  const script = ir.scenes.map((s) => `[${fmtClock(s.scene_start_time_sec)}] ${s.topic}\n${s.narration.text}`).join('\n\n');
  const ssml = ir.scenes.map((s) => `<!-- ${s.section_id}: ${s.topic} -->\n${s.prosody_plan.ssml_full}`).join('\n\n');
  // Video Studio handoff script (source/HANDOFF-TEAM-KICH-BAN.md), linted with the same rules.
  const studio = useMemo(() => exportStudioScript(ir, { sourceFileName: project.source?.fileName }), [ir, project.source?.fileName]);
  const studioErrors = studio.issues.filter((i) => i.level === 'error').length;
  const editCount = Object.keys(drafts).length;

  const stats: { label: string; value: React.ReactNode; note?: string; warn?: boolean }[] = [
    {
      label: 'Thời lượng',
      value: (
        <>
          {fmtClock(report.actual_duration_sec)}
          <span className="text-base font-normal text-ink-faint"> / {fmtClock(report.target_duration_sec)}</span>
        </>
      ),
      note: `lệch ${report.duration_error_pct}%`,
      warn: report.duration_error_pct > 15
    },
    { label: 'Điểm chất lượng', value: Math.round(report.overall_quality_score * 100), note: DECISION_LABEL[report.decision || ''] || report.overall_status, warn: report.decision === 'FAIL' || report.decision === 'NEEDS_REVIEW' },
    { label: 'Số từ', value: ir.total_words.toLocaleString('vi-VN'), note: `${ir.total_scenes} cảnh` },
    {
      label: 'Token API',
      value: run ? run.tokens.totalTokens.toLocaleString('vi-VN') : project.lastBenchmark ? project.lastBenchmark.total_tokens.toLocaleString('vi-VN') : '—',
      note: run ? `${run.tokens.calls - run.tokens.cacheHits} lần gọi` : undefined
    }
  ];

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-rule bg-rule md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-paper-sheet px-4 py-3">
            <dt className="text-xs text-ink-faint">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-navy">{s.value}</dd>
            {s.note && <dd className={`text-xs ${s.warn ? 'font-medium text-pen' : 'text-ink-faint'}`}>{s.note}</dd>}
          </div>
        ))}
      </dl>

      {ir.generation_notes && ir.generation_notes.length > 0 && (() => {
        // Only blame the AI when "AI viết" was chosen and some pages fell back to the template.
        const llmCount = ir.scenes.filter((s) => s.narration_source === 'llm').length;
        const aiFailed = ir.configuration.narrationEngine === 'llm' && llmCount < ir.scenes.length;
        const heading = !aiFailed ? 'Lưu ý về bài giảng' : llmCount > 0 ? 'AI chỉ viết được một phần bài giảng' : 'AI không viết được bài giảng này, đang hiển thị lời giảng theo mẫu';
        return (
        <div role="status" className={`rounded-2xl border px-4 py-3 text-sm text-ink ${aiFailed ? 'border-pen-line bg-pen-soft' : 'border-rule bg-paper-sheet'}`}>
          <p className={`font-semibold ${aiFailed ? 'text-pen' : 'text-ink'}`}>{heading}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">
            {ir.generation_notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
        );
      })()}
      {fixes.length > 0 && <FixPanel fixes={fixes} busy={busy} onAction={onAction} onJump={(id) => openEditors([id])} />}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => download(`${base}.txt`, script)} className="inline-flex items-center gap-1.5 rounded-xl bg-cover px-3.5 py-2 text-sm font-semibold text-paper hover:bg-cover-deep">
          <Download className="h-4 w-4" /> Kịch bản (.txt)
        </button>
        <button
          type="button"
          onClick={() => download(`${base}.kich-ban.md`, studio.markdown, 'text/markdown')}
          title={studio.issues.length ? studio.issues.slice(0, 8).map((i) => `${i.level === 'error' ? 'Lỗi' : 'Lưu ý'} · ${i.where}: ${i.message}`).join('\n') : 'Đạt mọi kiểm tra của quy chuẩn kịch bản Studio'}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rule-strong bg-paper-sheet px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-paper-band"
        >
          Kịch bản Studio (.md)
          {studio.issues.length > 0 && (
            <span className={`rounded-full px-1.5 text-xs tabular-nums ${studioErrors ? 'bg-pen-soft text-pen' : 'bg-paper-band text-ink-faint'}`}>
              {studioErrors ? `${studioErrors} lỗi` : `${studio.issues.length} lưu ý`}
            </span>
          )}
        </button>
        <button type="button" onClick={() => download(`${base}.ssml.xml`, ssml, 'application/xml')} className="inline-flex items-center gap-1.5 rounded-xl border border-rule-strong bg-paper-sheet px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-paper-band">
          SSML cho TTS
        </button>
        <button type="button" onClick={() => download(`${base}.clsg-ir.json`, JSON.stringify(ir, null, 2), 'application/json')} className="inline-flex items-center gap-1.5 rounded-xl border border-rule-strong bg-paper-sheet px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-paper-band">
          CLSG-IR (.json)
        </button>
        <span className="ml-auto text-xs text-ink-faint">
          Từ nối: {connective ? String(connective.actual_value).split('•')[0] : '—'} · Lặp tiêu đề: {heading ? String(heading.actual_value).split('•')[1]?.trim() || '0' : '0'}
        </span>
      </div>

      {editCount > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-rule-strong bg-paper-band px-4 py-3 ">
          <span className="text-sm text-ink">
            Đang sửa <span className="font-semibold tabular-nums">{editCount}</span> cảnh. Lưu để đo lại thời lượng và chất lượng (không tốn token).
          </span>
          <button type="button" onClick={() => setDrafts({})} className="ml-auto text-sm font-medium text-ink-soft hover:text-ink">
            Huỷ
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onSaveEdits(drafts);
              setDrafts({});
            }}
            className="rounded-xl bg-cover px-4 py-2 text-sm font-semibold text-paper hover:bg-cover-deep disabled:opacity-50"
          >
            Lưu & kiểm tra lại
          </button>
        </div>
      )}

      <ol className="divide-y divide-rule overflow-hidden rounded-lg border border-rule-strong bg-paper-sheet" aria-label="Lời giảng theo thời gian">
        <li className="hidden grid-cols-[88px_minmax(0,1fr)] gap-x-5 border-b-2 border-print/60 bg-paper-band px-5 py-2 text-[13px] font-semibold text-print sm:grid" aria-hidden>
          <span>Giờ</span>
          <span>Lời giảng</span>
        </li>
        {ir.scenes.map((s) => {
          const editing = drafts[s.section_id] !== undefined;
          return (
            <li key={s.section_id} id={`scene-${s.section_id}`} className={`grid gap-x-5 gap-y-1 px-4 py-4 sm:grid-cols-[88px_minmax(0,1fr)] sm:px-5 ${flagged.has(s.section_id) ? 'bg-pen-soft' : ''}`}>
              <div className="flex items-center gap-2 sm:flex-col sm:items-start">
                <span className="text-sm font-medium tabular-nums text-ink">{fmtClock(s.scene_start_time_sec)}</span>
                <span className="text-xs tabular-nums text-ink-faint">{Math.round(s.scene_duration_sec)}s</span>
                <span className="ml-auto flex gap-0.5 sm:ml-0">
                  {canSpeak && s.narration.text && !editing && (
                    <button
                      type="button"
                      onClick={() => speak(s.section_id, s.narration.text)}
                      aria-label={playing === s.section_id ? 'Dừng đọc' : 'Nghe thử'}
                      className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-band hover:text-navy"
                    >
                      {playing === s.section_id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                  )}
                  {!editing && (
                    <button type="button" onClick={() => openEditors([s.section_id])} aria-label="Sửa lời giảng cảnh này" className="rounded-lg p-1.5 text-ink-faint hover:bg-paper-band hover:text-navy">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-xs font-medium text-ink-faint">
                  {s.topic}
                  {flagged.has(s.section_id) && <span className="text-pen">· cần xem lại</span>}
                </h3>
                {editing ? (
                  <textarea
                    value={drafts[s.section_id]}
                    onChange={(e) => setDrafts((d) => ({ ...d, [s.section_id]: e.target.value }))}
                    rows={Math.min(12, Math.max(4, Math.ceil(drafts[s.section_id].length / 90)))}
                    className="mt-1 w-full max-w-[72ch] rounded-xl border border-rule-strong bg-paper-sheet px-3 py-2 text-[15px] leading-7 text-ink focus:border-print focus:outline-none focus:ring-2 focus:ring-print/20"
                  />
                ) : (
                  <p className="mt-1 max-w-[68ch] text-[15px] leading-7 text-ink">{s.narration.text || <span className="italic text-ink-faint">Không có lời giảng cho trang này.</span>}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export const LecturePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [view, setView] = useState<View>('review');
  const [busy, setBusy] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState('');
  const [run, setRun] = useState<BenchmarkRunLog | null>(null);
  const [editRequest, setEditRequest] = useState<{ ids: string[]; nonce: number } | null>(null);
  /** Set when a run or re-check just finished, so the grade stamp presses once. */
  const [gradedAt, setGradedAt] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    projectService.getProject(id, user.uid).then((p) => {
      // Lectures scanned before content estimates existed get them now, so they can be sized by coverage.
      const doc = p?.knowledgeTree ? lectureDocument(p) : null;
      if (p?.knowledgeTree && doc) p = { ...p, knowledgeTree: withContentEstimates(p.knowledgeTree, doc, p.configuration) };
      setProject(p);
      if (p?.clsgIr) setView('result');
      if (p) benchmarkService.listRuns(p.projectId, 1).then((runs) => setRun(runs.find((r) => r.kind === 'pipeline') || null));
    });
  }, [user, id]);

  const stage = project ? lectureStage(project) : 'uploaded';
  const stepIndex = view === 'result' && project?.clsgIr ? 3 : 2;

  const updateTree = (tree: KnowledgeTree) => {
    if (!project) return;
    const next = { ...project, knowledgeTree: tree };
    setProject(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => projectService.updateProject(next), 700);
  };

  const scan = async () => {
    if (!project) return;
    const doc = lectureDocument(project);
    if (!doc) {
      setError('Không tìm thấy nội dung đã trích xuất của bài giảng này. Hãy tạo bài giảng mới từ file gốc.');
      return;
    }
    setError('');
    setBusy('scan');
    try {
      const res = await scanDocument(doc, project.source.fileName, project.configuration, { onProgress: setScanProgress });
      const log = buildScanRunLog({
        runId: `scan_${Date.now().toString(36)}`,
        projectId: project.projectId,
        projectTitle: project.title,
        config: project.configuration,
        tree: res.knowledgeTree,
        timings: [
          { stage: 'extract', ms: res.timings.extractMs },
          { stage: 'ocr+keywords+chapters (parallel)', ms: res.timings.analyzeMs },
          { stage: 'build tree', ms: res.timings.buildMs }
        ],
        totalMs: res.timings.totalMs,
        calls: res.llmCalls
      });
      const next: Project = { ...project, canonicalDocument: res.documentTree, knowledgeTree: res.knowledgeTree, lastBenchmark: summarizeRun(log) };
      await Promise.all([projectService.updateProject(next), benchmarkService.saveRun(log)]);
      setProject(next);
    } catch (err: any) {
      setError(`Quét thất bại: ${err?.message || err}`);
    } finally {
      setBusy(null);
      setScanProgress(null);
    }
  };

  /** @param over optional changes applied before generating (fix actions). */
  const generate = async (over: { tree?: KnowledgeTree; config?: Partial<UserConfiguration> } = {}) => {
    if (!project) return;
    const doc = lectureDocument(project);
    setError('');
    setBusy('generate');
    try {
      const tree = over.tree || project.knowledgeTree;
      const baseConfig = { ...project.configuration, ...(over.config || {}) };
      const config = tree ? { ...baseConfig, targetDurationSeconds: Math.round(tree.root.duration_sec || baseConfig.targetDurationSeconds) } : baseConfig;
      const result = await pipelineOrchestrator.runFullPipeline(doc || project.source.fileName, project.source.fileName, config, (msg) => setScanProgress({ stage: 'analyze', message: msg, percent: 0, elapsedMs: 0 }), {
        knowledgeTree: tree,
        projectId: project.projectId,
        projectTitle: project.title
      });
      const next: Project = {
        ...project,
        knowledgeTree: tree,
        configuration: config,
        status: result.qualityReport.overall_status === 'FAILED' ? 'failed' : 'verified',
        canonicalDocument: result.documentTree,
        lessonBlueprint: result.blueprint,
        clsgIr: result.verifiedIr,
        qualityReport: result.qualityReport,
        executionLogs: result.traceLogs,
        lastBenchmark: summarizeRun(result.benchmark),
        updatedAt: new Date().toISOString()
      };
      await Promise.all([projectService.updateProject(next), benchmarkService.saveRun(result.benchmark)]);
      setProject(next);
      setRun(result.benchmark);
      setView('result');
      setGradedAt(Date.now());
      markLectureMoved(next.projectId);
    } catch (err: any) {
      setError(`Tạo bài giảng thất bại: ${err?.message || err}`);
    } finally {
      setBusy(null);
      setScanProgress(null);
    }
  };

  // "Lưu và tạo lại" from the Knowledge Inspector lands here with ?rerun=1: generate once, then drop the flag.
  useEffect(() => {
    if (!project || searchParams.get('rerun') !== '1') return;
    setSearchParams({}, { replace: true });
    generate();
  }, [project?.projectId]);

  const handleFix = (a: FixAction) => {
    if (!project) return;
    switch (a.kind) {
      case 'set_duration': {
        const sec = Number(a.value) || project.configuration.targetDurationSeconds;
        const kt = project.knowledgeTree;
        const full = kt ? fullDurationOf(kt) : null;
        // Keep the coverage setting in step with the new length, so later toggles don't undo the fix.
        const tree = kt ? (full ? setCoverage(kt, sec / full) : rebalanceToTarget(kt, sec)) : undefined;
        generate({ tree, config: { targetDurationSeconds: sec } });
        break;
      }
      case 'switch_engine':
        generate({ config: { narrationEngine: a.value as 'template' | 'llm' } });
        break;
      case 'regenerate':
        generate();
        break;
      case 'review_structure':
        setView('review');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'edit_scenes':
        setEditRequest({ ids: (a.value as string[]) || [], nonce: Date.now() });
        break;
    }
  };

  /** Applies hand edits and re-measures with the quality guard (no LLM calls). */
  const saveEdits = async (edits: Record<string, string>) => {
    if (!project?.clsgIr) return;
    const ir = project.clsgIr;
    const scenes = ir.scenes.map((s) => (edits[s.section_id] !== undefined ? { ...s, narration: { ...s.narration, text: edits[s.section_id].trim() } } : s));
    const doc = lectureDocument(project);
    const bp = project.lessonBlueprint;
    setBusy('recheck');
    try {
      let nextIr = { ...ir, scenes };
      let report = project.qualityReport || ir.quality_report;
      if (bp && doc) {
        const chapterOf = project.knowledgeTree ? treeToPipelineOverrides(project.knowledgeTree).chapterOf : {};
        const headingSpecs = bp.sections.map((p) => ({
          sceneId: p.section_id,
          sectionTitle: p.title,
          chapterId: chapterOf[p.section_id]?.chapterId,
          chapterTitle: chapterOf[p.section_id]?.chapterTitle,
          isChapterFirstPage: chapterOf[p.section_id]?.isFirstPage
        }));
        const checked = new QualityVisualGuard().validateAndCertify(scenes, bp, doc, ir.configuration, { headingSpecs });
        nextIr = { ...checked.verifiedIr, lesson_model: ir.lesson_model, content_prioritization: ir.content_prioritization, teaching_units: ir.teaching_units, narrative_ir: ir.narrative_ir, knowledge_ir: ir.knowledge_ir, curriculum_ir: ir.curriculum_ir };
        report = checked.qualityReport;
      }
      const next: Project = {
        ...project,
        clsgIr: nextIr,
        qualityReport: report,
        status: report.overall_status === 'FAILED' ? 'failed' : 'verified',
        updatedAt: new Date().toISOString()
      };
      await projectService.updateProject(next);
      setProject(next);
      setGradedAt(Date.now());
      if (lectureStage(next) !== lectureStage(project)) markLectureMoved(next.projectId);
    } finally {
      setBusy(null);
    }
  };

  const activePages = useMemo(() => {
    let n = 0;
    const walk = (node: KnowledgeTreeNode, off: boolean) => {
      const ex = off || Boolean(node.excluded);
      if (node.kind === 'page') {
        if (!ex) n++;
        return;
      }
      node.children.forEach((c) => walk(c, ex));
    };
    if (project?.knowledgeTree) walk(project.knowledgeTree.root, false);
    return n;
  }, [project?.knowledgeTree]);

  if (project === undefined) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-ink-faint">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang mở bài giảng...
      </div>
    );
  }
  if (project === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-ink-soft">Không tìm thấy bài giảng này.</p>
        <Link to="/" className="mt-2 inline-block text-sm font-semibold text-navy">
          Về bảng bài giảng
        </Link>
      </div>
    );
  }

  const cfg = project.configuration;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        <div className="space-y-3">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Sổ bài giảng
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-[1.75rem] font-semibold leading-tight text-ink">{project.title}</h1>
            {(() => {
              const stamp = gradeStamp(project);
              return (
                <span key={gradedAt} className={`ledger-stamp mt-1 text-lg ${stamp.tone} ${gradedAt ? 'ledger-stamp-press' : ''}`} aria-label={`Xếp loại: ${stamp.label}`}>
                  {stamp.label}
                </span>
              );
            })()}
          </div>
          <Steps current={stepIndex} />
        </div>

        {error && <p className="rounded-xl bg-pen-soft px-4 py-3 text-sm text-pen">{error}</p>}

        {busy && (
          <div className="flex items-center gap-3 rounded-2xl border border-rule-strong bg-paper-band px-4 py-3 text-sm text-cover" role="status">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span className="flex-1">{scanProgress?.message || (busy === 'scan' ? 'Đang quét tài liệu...' : busy === 'recheck' ? 'Đang kiểm tra lại lời giảng đã sửa...' : 'Đang tạo bài giảng...')}</span>
            {busy === 'scan' && scanProgress && <span className="tabular-nums">{Math.round(scanProgress.elapsedMs / 1000)}s</span>}
          </div>
        )}

        {view === 'result' && project.clsgIr ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setView('review')} className="inline-flex items-center gap-1.5 rounded-xl border border-rule-strong bg-paper-sheet px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-paper-band">
                <Network className="h-4 w-4" /> Chỉnh cấu trúc
              </button>
              <button type="button" disabled={Boolean(busy)} onClick={() => generate()} className="inline-flex items-center gap-1.5 rounded-xl border border-rule-strong bg-paper-sheet px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-paper-band disabled:opacity-50">
                <RefreshCw className="h-4 w-4" /> Tạo lại
              </button>
            </div>
            <ResultView project={project} run={run} busy={Boolean(busy)} editRequest={editRequest} onAction={handleFix} onSaveEdits={saveEdits} />
          </>
        ) : project.knowledgeTree ? (
          <>
            <StudyCalibrationPanel tree={project.knowledgeTree} docTree={lectureDocument(project)} onApply={updateTree} />
            <StructureReview tree={project.knowledgeTree} engine={project.configuration.narrationEngine} onChange={updateTree} />
            <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-rule bg-paper-sheet px-4 py-3 shadow-[0_8px_24px_-12px_rgba(19,75,136,0.28)] ">
              <span className="text-sm text-ink-soft">
                <span className="font-semibold tabular-nums text-ink">{activePages}</span> trang ·{' '}
                <span className="font-semibold tabular-nums text-ink">{fmtClock(project.knowledgeTree.root.duration_sec)}</span>
              </span>
              {project.clsgIr && (
                <button type="button" onClick={() => setView('result')} className="text-sm font-medium text-ink-soft hover:text-ink">
                  Xem bài giảng hiện tại
                </button>
              )}
              <button
                type="button"
                disabled={Boolean(busy) || activePages === 0}
                onClick={() => generate()}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-cover px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-cover-deep disabled:cursor-not-allowed disabled:bg-rule-strong"
              >
                {busy === 'generate' && <Loader2 className="h-4 w-4 animate-spin" />}
                {project.clsgIr ? 'Tạo lại bài giảng' : 'Tạo bài giảng'}
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-rule bg-paper-sheet px-6 py-10 text-center">
            <h2 className="text-base font-semibold text-ink">Chưa có cấu trúc cho bài giảng này</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-faint">Quét tài liệu để chia chương, đọc bảng và sơ đồ, và đề xuất thời lượng cho từng trang.</p>
            <div className="mt-5 flex justify-center gap-2">
              <button type="button" disabled={Boolean(busy)} onClick={scan} className="inline-flex items-center gap-2 rounded-xl bg-cover px-5 py-2.5 text-sm font-semibold text-paper hover:bg-cover-deep disabled:bg-rule-strong">
                Quét tài liệu
              </button>
              <button type="button" disabled={Boolean(busy)} onClick={() => generate()} className="rounded-xl border border-rule-strong bg-paper-sheet px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-paper-band disabled:opacity-50">
                Tạo ngay, bỏ qua bước duyệt
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <section className="rounded-2xl border border-rule bg-paper-sheet p-4">
          <h2 className="text-sm font-semibold text-ink">Thiết lập</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {[
              ['Tài liệu', `${project.source.fileName}${project.canonicalDocument ? ` · ${project.canonicalDocument.total_sections} trang` : ''}`],
              ['Thời lượng', (() => {
                const kt = project.knowledgeTree;
                const full = kt ? fullDurationOf(kt) : null;
                const clock = fmtClock(kt?.root.duration_sec || cfg.targetDurationSeconds);
                return full && kt ? `${clock} · ${Math.round(((kt.root.duration_sec || 0) / full) * 100)}% nội dung` : clock;
              })()],
              ['Người học', LEVEL_LABEL[cfg.learnerLevel] || cfg.learnerLevel],
              ['Ngôn ngữ', (cfg.narration_language || cfg.language) === 'en' ? 'English' : 'Tiếng Việt'],
              ['Cách viết', cfg.narrationEngine === 'llm' ? 'AI viết' : 'Theo mẫu']
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-ink-faint">{k}</dt>
                <dd className="truncate text-right text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {project.knowledgeTree && (
            <p className="mt-3 border-t border-rule pt-3 text-xs text-ink-faint">
              Đã đọc {project.knowledgeTree.stats.regions_ocr_done}/{project.knowledgeTree.stats.regions_total} vùng bảng/sơ đồ/ảnh · quét {Math.round(project.knowledgeTree.stats.scan_ms / 1000)}s
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-rule bg-paper-sheet p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <SlidersHorizontal className="h-4 w-4 text-ink-faint" /> Nâng cao
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link to={`/projects/${project.projectId}/knowledge`} className="block rounded-lg px-2 py-1.5 text-ink-soft hover:bg-paper-band hover:text-ink">
                Sơ đồ trọng số, vùng ảnh & OCR
              </Link>
            </li>
          </ul>
          <p className="mt-2 px-2 text-xs text-ink-faint">Trạng thái: {stage === 'done' ? 'đã tạo' : stage === 'attention' ? 'cần xem lại' : stage === 'review' ? 'chờ duyệt cấu trúc' : 'mới tải lên'}</p>
        </section>
      </aside>
    </div>
  );
};
