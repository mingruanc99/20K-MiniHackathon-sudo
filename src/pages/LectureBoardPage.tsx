// src/pages/LectureBoardPage.tsx
/**
 * Home: the lecture logbook (sổ bài giảng). One ruled entry per lecture with its minutes, the
 * teacher's remark (what to do next) and a grade stamp (status). Entries needing action come first;
 * ledger-edge tabs filter by status. The entry that just changed gets its stamp pressed once.
 */
import React,{ useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, PenLine, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { projectService } from '../services/projectService';
import { Project } from '../types';
import { STAGES, LectureStage, lectureStage, fmtClock } from '../services/lectureStatus';

const MOVED_KEY = 'vl_last_moved';
const STALE_DAYS = 30;
const ORDER: LectureStage[] = ['attention', 'review', 'uploaded', 'done'];

type Filter = 'all' | LectureStage;

interface Entry {
  p: Project;
  stage: LectureStage;
  stamp: { label: string; tone: string };
  remark: { text: string; red: boolean };
  minutes: { actual?: number; target: number };
}

function describe(p: Project): Entry {
  const stage = lectureStage(p);
  const report = p.qualityReport || p.clsgIr?.quality_report;
  const target = p.knowledgeTree?.root.duration_sec || p.configuration.targetDurationSeconds;
  const score = report ? Math.round(report.overall_quality_score * 100) : 0;

  if (stage === 'done') {
    return {
      p,
      stage,
      stamp: { label: score >= 85 ? 'Tốt' : score >= 70 ? 'Khá' : 'Đạt', tone: 'text-print' },
      remark: { text: `Điểm ${score}${p.lastBenchmark ? ` · ${p.lastBenchmark.total_tokens.toLocaleString('vi-VN')} token` : ''}`, red: false },
      minutes: { actual: report?.actual_duration_sec, target: report?.target_duration_sec || target }
    };
  }
  if (stage === 'attention') {
    const failing = report?.checks.filter((c) => c.status !== 'PASSED').map((c) => c.rule_name.split(/[(:]/)[0].trim()) || [];
    return {
      p,
      stage,
      stamp: { label: 'Cần sửa', tone: 'text-pen' },
      remark: { text: failing.length ? `Xem lại: ${failing.slice(0, 2).join(', ')}` : 'Tạo bài giảng chưa thành công', red: true },
      minutes: { actual: report?.actual_duration_sec, target: report?.target_duration_sec || target }
    };
  }
  if (stage === 'review') {
    const t = p.knowledgeTree!;
    return {
      p,
      stage,
      stamp: { label: 'Chờ duyệt', tone: 'text-ink-soft' },
      remark: { text: `Duyệt ${t.stats.pages_total} trang, ${t.stats.regions_ocr_done}/${t.stats.regions_total} vùng ảnh đã đọc`, red: false },
      minutes: { target }
    };
  }
  return {
    p,
    stage,
    stamp: { label: 'Mới', tone: 'text-ink-faint' },
    remark: { text: 'Quét tài liệu để chia chương và đề xuất thời lượng', red: false },
    minutes: { target }
  };
}

const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

export const LectureBoardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [moved] = useState<string | null>(() => {
    try {
      const v = sessionStorage.getItem(MOVED_KEY);
      sessionStorage.removeItem(MOVED_KEY);
      return v;
    } catch {
      return null;
    }
  });

  // Cleaning mode: pick lectures (by hand or "older than 30 days") and delete them in one go.
  const [cleaning, setCleaning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cleanNote, setCleanNote] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const local = projectService.listLocalProjects(user.uid);
    if (local.length) setProjects(local);
    projectService.listProjects(user.uid).then(setProjects);
  }, [user]);

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const stopCleaning = () => {
    setCleaning(false);
    setSelected(new Set());
    setConfirming(false);
  };
  const deleteSelected = async () => {
    if (!user || selected.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selected);
    const failed = await projectService.deleteProjects(ids, user.uid);
    const removed = ids.length - failed.length;
    setProjects((prev) => (prev || []).filter((p) => !selected.has(p.projectId) || failed.includes(p.projectId)));
    setCleanNote(failed.length ? `Đã xoá ${removed} bài. ${failed.length} bài chưa xoá được, vui lòng thử lại.` : `Đã xoá ${removed} bài.`);
    setDeleting(false);
    setSelected(new Set(failed));
    setConfirming(false);
    if (!failed.length) setCleaning(false);
  };

  const entries = useMemo(
    () =>
      (projects || [])
        .map(describe)
        .sort((a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage) || b.p.updatedAt.localeCompare(a.p.updatedAt)),
    [projects]
  );
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: entries.length, uploaded: 0, review: 0, done: 0, attention: 0 };
    entries.forEach((e) => c[e.stage]++);
    return c;
  }, [entries]);
  const shown = filter === 'all' ? entries : entries.filter((e) => e.stage === filter);
  const stageMeta = (s: LectureStage) => STAGES.find((x) => x.id === s)!;
  const staleCutoff = Date.now() - STALE_DAYS * 86400000;
  const staleIds = shown.filter((e) => new Date(e.p.updatedAt).getTime() < staleCutoff).map((e) => e.p.projectId);
  const allShownSelected = shown.length > 0 && shown.every((e) => selected.has(e.p.projectId));
  const openEntry = (id: string) => (cleaning ? toggleSelected(id) : navigate(`/lectures/${id}`));

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'attention', label: 'Cần sửa' },
    { id: 'review', label: 'Chờ duyệt' },
    { id: 'uploaded', label: 'Mới' },
    { id: 'done', label: 'Đã tạo' }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight text-ink">Sổ bài giảng</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {projects === null ? 'Đang mở sổ…' : `${counts.all} bài · ${counts.attention} cần sửa · ${counts.review} chờ duyệt`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!cleaning && counts.all > 0 && (
            <button
              type="button"
              onClick={() => {
                setCleaning(true);
                setCleanNote(null);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-rule-strong bg-paper-sheet px-3.5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-pen-line hover:text-pen"
            >
              <Trash2 className="h-4 w-4" /> Dọn sổ
            </button>
          )}
          <Link
            to="/lectures/new"
            className="inline-flex items-center gap-2 rounded-xl bg-cover px-4 py-2.5 text-sm font-semibold text-paper shadow-[0_1px_2px_rgba(19,75,136,0.35)] transition-colors hover:bg-cover-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-print focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <PenLine className="h-4 w-4" /> Ghi bài mới
          </Link>
        </div>
      </div>

      {cleanNote && !cleaning && <p className="font-hand text-lg text-print">{cleanNote}</p>}

      {cleaning && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-pen-line bg-pen-soft px-4 py-3 text-sm">
          {confirming ? (
            <>
              <span className="font-medium text-pen">
                Xoá vĩnh viễn {selected.size} bài giảng cùng nhật ký chạy? Thao tác này không thể hoàn tác.
              </span>
              <span className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-pen px-3 py-1.5 font-semibold text-white hover:bg-[#9e1825] disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Xoá
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={deleting} className="rounded-lg border border-rule-strong bg-paper-sheet px-3 py-1.5 text-ink-soft hover:text-ink">
                  Giữ lại
                </button>
              </span>
            </>
          ) : (
            <>
              <span className="font-medium text-ink">{selected.size ? `Đã chọn ${selected.size} bài` : 'Chọn các bài không còn dùng'}</span>
              <button
                type="button"
                onClick={() => setSelected(new Set(staleIds))}
                disabled={staleIds.length === 0}
                className="rounded-lg border border-rule-strong bg-paper-sheet px-2.5 py-1 text-ink-soft hover:text-ink disabled:opacity-50"
              >
                Chọn bài cũ hơn {STALE_DAYS} ngày ({staleIds.length})
              </button>
              <button
                type="button"
                onClick={() => setSelected(allShownSelected ? new Set() : new Set(shown.map((e) => e.p.projectId)))}
                className="rounded-lg border border-rule-strong bg-paper-sheet px-2.5 py-1 text-ink-soft hover:text-ink"
              >
                {allShownSelected ? 'Bỏ chọn' : 'Chọn tất cả ở mục này'}
              </button>
              <span className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={selected.size === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-pen px-3 py-1.5 font-semibold text-white hover:bg-[#9e1825] disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Xoá {selected.size || ''} bài
                </button>
                <button type="button" onClick={stopCleaning} className="inline-flex items-center gap-1 rounded-lg border border-rule-strong bg-paper-sheet px-3 py-1.5 text-ink-soft hover:text-ink">
                  <X className="h-4 w-4" /> Xong
                </button>
              </span>
            </>
          )}
        </div>
      )}

      {/* Ledger-edge tabs */}
      <div className="-mb-5 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Lọc theo xếp loại">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={filter === t.id}
            onClick={() => setFilter(t.id)}
            className={`relative shrink-0 rounded-t-lg border border-b-0 px-3.5 pb-2 pt-1.5 text-sm transition-colors ${
              filter === t.id ? 'z-10 border-rule-strong border-t-2 border-t-navy bg-paper font-semibold text-navy' : 'border-transparent bg-paper-band text-ink-soft hover:text-ink'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 tabular-nums ${t.id === 'attention' && counts.attention ? 'text-pen' : 'text-ink-faint'}`}>{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <section className="relative overflow-hidden rounded-lg rounded-tl-none border border-rule-strong bg-paper shadow-[0_1px_0_#dfe6da,0_12px_28px_-20px_rgba(19,75,136,0.45)]">
        {projects === null ? (
          <div className="ledger-ruled flex h-64 items-center gap-2 px-6 text-sm text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang mở sổ…
          </div>
        ) : shown.length === 0 ? (
          <div className="ledger-ruled px-6 py-14">
            <p className="font-hand text-xl text-ink-soft">{filter === 'all' ? 'Sổ còn trống. Ghi bài giảng đầu tiên từ slide của bạn.' : 'Không có bài nào ở mục này.'}</p>
            {filter === 'all' && (
              <Link to="/lectures/new" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-navy hover:text-navy">
                Ghi bài mới <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop: the ruled table */}
            <table className="hidden w-full border-collapse text-left md:table">
              <thead>
                <tr className="border-b-2 border-print/60 bg-paper-band text-[13px] font-semibold text-print">
                  {cleaning && (
                    <th scope="col" className="w-10 border-r border-rule px-2 py-2.5 text-center">
                      <span className="sr-only">Chọn</span>
                    </th>
                  )}
                  <th scope="col" className="w-14 border-r border-rule px-3 py-2.5 text-center">Tiết</th>
                  <th scope="col" className="w-20 border-r border-rule px-3 py-2.5">Ngày</th>
                  <th scope="col" className="border-r border-rule px-4 py-2.5">Tên bài</th>
                  <th scope="col" className="w-32 border-r border-rule px-3 py-2.5 text-right">Thời lượng</th>
                  <th scope="col" className="border-r border-rule px-4 py-2.5">Nhận xét</th>
                  <th scope="col" className="w-36 px-3 py-2.5 text-center">Xếp loại</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e, i) => (
                  <tr
                    key={e.p.projectId}
                    onClick={() => openEntry(e.p.projectId)}
                    className={`group cursor-pointer border-b border-rule transition-colors ${
                      selected.has(e.p.projectId) ? 'bg-pen-soft hover:bg-pen-soft' : 'hover:bg-paper-band'
                    }`}
                  >
                    {cleaning && (
                      <td className="border-r border-rule px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(e.p.projectId)}
                          onChange={() => toggleSelected(e.p.projectId)}
                          onClick={(ev) => ev.stopPropagation()}
                          aria-label={`Chọn ${e.p.title}`}
                          className="h-4 w-4 accent-[#BE1E2D]"
                        />
                      </td>
                    )}
                    <td className="border-r border-rule px-3 py-3 text-center text-sm tabular-nums text-ink-faint">{i + 1}</td>
                    <td className="border-r border-rule px-3 py-3 text-sm tabular-nums text-ink-soft">{dateLabel(e.p.updatedAt)}</td>
                    <td className="border-r border-rule px-4 py-3">
                      <Link
                        to={`/lectures/${e.p.projectId}`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (cleaning) {
                            ev.preventDefault();
                            toggleSelected(e.p.projectId);
                          }
                        }}
                        className="line-clamp-1 text-[15px] font-semibold text-ink underline-offset-4 group-hover:underline"
                      >
                        {e.p.title}
                      </Link>
                      <span className="text-xs text-ink-faint">
                        {e.p.canonicalDocument ? `${e.p.canonicalDocument.total_sections} trang · ` : ''}
                        {e.p.source.fileName}
                      </span>
                    </td>
                    <td className="border-r border-rule px-3 py-3 text-right text-sm tabular-nums">
                      {e.minutes.actual !== undefined ? (
                        <>
                          <span className="font-semibold text-ink">{fmtClock(e.minutes.actual)}</span>
                          <span className="text-ink-faint"> / {fmtClock(e.minutes.target)}</span>
                        </>
                      ) : (
                        <span className="text-ink-soft">{fmtClock(e.minutes.target)}</span>
                      )}
                    </td>
                    <td className="border-r border-rule px-4 py-3">
                      <span className={`font-hand text-[17px] leading-snug ${e.remark.red ? 'text-pen' : 'text-ink-soft'}`}>{e.remark.text}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`ledger-stamp ${e.stamp.tone} ${moved === e.p.projectId ? 'ledger-stamp-press' : ''}`}>{e.stamp.label}</span>
                      <span className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-navy opacity-0 transition-opacity group-hover:opacity-100">
                        {stageMeta(e.stage).action} <ArrowRight className="h-3 w-3" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile: ruled entries */}
            <ul className="divide-y divide-rule md:hidden">
              {shown.map((e) => (
                <li key={e.p.projectId} className={`flex items-start ${selected.has(e.p.projectId) ? 'bg-pen-soft' : ''}`}>
                  {cleaning && (
                    <input
                      type="checkbox"
                      checked={selected.has(e.p.projectId)}
                      onChange={() => toggleSelected(e.p.projectId)}
                      aria-label={`Chọn ${e.p.title}`}
                      className="ml-4 mt-5 h-4 w-4 shrink-0 accent-[#BE1E2D]"
                    />
                  )}
                  <Link
                    to={`/lectures/${e.p.projectId}`}
                    onClick={(ev) => {
                      if (cleaning) {
                        ev.preventDefault();
                        toggleSelected(e.p.projectId);
                      }
                    }}
                    className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 px-4 py-3.5"
                  >
                    <span className="text-[15px] font-semibold leading-snug text-ink">{e.p.title}</span>
                    <span className={`ledger-stamp row-span-2 mt-1 ${e.stamp.tone} ${moved === e.p.projectId ? 'ledger-stamp-press' : ''}`}>{e.stamp.label}</span>
                    <span className="text-xs tabular-nums text-ink-faint">
                      {dateLabel(e.p.updatedAt)} · {e.minutes.actual !== undefined ? `${fmtClock(e.minutes.actual)}/` : ''}
                      {fmtClock(e.minutes.target)}
                    </span>
                    <span className={`col-span-2 font-hand text-base ${e.remark.red ? 'text-pen' : 'text-ink-soft'}`}>{e.remark.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
};

/** Lecture page calls this so the logbook presses the stamp of the entry that just changed. */
export function markLectureMoved(projectId: string) {
  try {
    sessionStorage.setItem(MOVED_KEY, projectId);
  } catch {
    /* ignore */
  }
}

