// src/components/knowledge/StudyCalibrationPanel.tsx
/**
 * "Hiệu chỉnh theo đề cương & kết quả quiz": upload a syllabus and/or quiz results, preview how
 * lecture time moves between pages (with the reason for each move), then apply to the tree.
 */
import React,{ useRef, useState } from 'react';
import { BookOpenCheck, FileUp, Loader2, X } from 'lucide-react';
import { CanonicalDocumentTree, KnowledgeTree } from '../../types';
import { parseQuizFile, parseSyllabusFile, StudySignals } from '../../pipeline/services/studySignals';
import { calibrateWithStudySignals, CalibrationResult, CalibrationWeights, DEFAULT_CALIBRATION } from '../../pipeline/services/studyCalibration';
import { fmtClock } from '../../services/lectureStatus';

interface Props {
  tree: KnowledgeTree;
  docTree: CanonicalDocumentTree | null;
  onApply: (tree: KnowledgeTree) => void;
}

const FilePick: React.FC<{ label: string; hint: string; accept: string; file: File | null; onFile: (f: File | null) => void }> = ({ label, hint, accept, file, onFile }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div className="text-sm font-medium text-ink">{label}</div>
      <div className="text-xs text-ink-faint">{hint}</div>
      {file ? (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-rule bg-paper-sheet px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
          <button type="button" onClick={() => onFile(null)} aria-label={`Bỏ ${label}`} className="rounded p-1 text-ink-faint hover:bg-paper-band hover:text-ink-soft">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-rule-strong bg-paper-sheet px-3 py-2 text-sm text-ink-soft hover:border-print-soft hover:text-ink">
          <FileUp className="h-4 w-4" /> Chọn file
        </button>
      )}
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
    </div>
  );
};

export const StudyCalibrationPanel: React.FC<Props> = ({ tree, docTree, onApply }) => {
  const [open, setOpen] = useState(false);
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [quizFile, setQuizFile] = useState<File | null>(null);
  const [weights, setWeights] = useState<CalibrationWeights>(tree.calibration?.weights || DEFAULT_CALIBRATION);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [signals, setSignals] = useState<StudySignals | null>(null);

  const analyze = async () => {
    if (!docTree) return setError('Chưa có nội dung đã trích xuất của bài giảng.');
    setBusy(true);
    setError('');
    try {
      const s: StudySignals = {};
      if (syllabusFile) s.syllabus = await parseSyllabusFile(syllabusFile);
      if (quizFile) s.quiz = await parseQuizFile(quizFile);
      setSignals(s);
      setResult(await calibrateWithStudySignals(tree, docTree, s, weights));
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const slider = (key: keyof CalibrationWeights, label: string, disabled = false) => (
    <label className={`block text-xs ${disabled ? 'opacity-40' : ''}`}>
      <span className="flex justify-between text-ink-soft">
        {label}
        <span className="font-medium tabular-nums text-ink">{Math.round(weights[key] * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={weights[key]}
        disabled={disabled}
        onChange={(e) => {
          setWeights({ ...weights, [key]: Number(e.target.value) });
          setResult(null);
        }}
        className="mt-1 w-full accent-[#2c5a47]"
      />
    </label>
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-rule bg-paper-sheet px-4 py-3 text-left transition-colors hover:border-rule-strong"
      >
        <BookOpenCheck className="h-5 w-5 shrink-0 text-print" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">Hiệu chỉnh theo đề cương & kết quả quiz</span>
          <span className="block text-xs text-ink-faint">
            {tree.calibration
              ? `Đã áp dụng: ${[tree.calibration.syllabus, tree.calibration.quiz].filter(Boolean).join(' + ')}`
              : 'Dồn thời lượng vào phần có trong đề cương và phần người học làm sai nhiều.'}
          </span>
        </span>
      </button>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-rule bg-paper-sheet p-4" aria-labelledby="calib-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="calib-title" className="text-sm font-semibold text-ink">Hiệu chỉnh theo đề cương & kết quả quiz</h3>
          <p className="text-xs text-ink-faint">Thời lượng mỗi trang = tỉ trọng slide gốc + mức khớp đề cương + mức sai trong quiz.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="rounded-lg p-1 text-ink-faint hover:bg-paper-band hover:text-ink-soft">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FilePick label="Đề cương" hint=".docx, .md hoặc .txt" accept=".docx,.md,.markdown,.txt" file={syllabusFile} onFile={(f) => { setSyllabusFile(f); setResult(null); }} />
        <FilePick label="Kết quả quiz" hint=".md hoặc .json (câu sai, vùng yếu)" accept=".md,.markdown,.json,.txt" file={quizFile} onFile={(f) => { setQuizFile(f); setResult(null); }} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {slider('slide', 'Slide gốc')}
        {slider('syllabus', 'Đề cương', !syllabusFile)}
        {slider('quiz', 'Lỗ hổng quiz', !quizFile)}
      </div>

      {error && <p className="rounded-xl bg-pen-soft px-3 py-2 text-sm text-pen">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || (!syllabusFile && !quizFile)}
          onClick={analyze}
          className="inline-flex items-center gap-2 rounded-xl bg-cover px-4 py-2 text-sm font-semibold text-paper hover:bg-cover-deep disabled:bg-rule-strong"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Phân tích
        </button>
        {result && (
          <button
            type="button"
            onClick={() => {
              onApply(result.tree);
              setOpen(false);
              setResult(null);
            }}
            className="rounded-xl bg-cover px-4 py-2 text-sm font-semibold text-paper hover:bg-cover-deep"
          >
            Áp dụng vào cấu trúc
          </button>
        )}
      </div>

      {result && signals && (
        <div className="space-y-3 border-t border-rule pt-3">
          <p className="text-xs text-ink-faint">
            {signals.syllabus ? `${signals.syllabus.topics.length} mục đề cương` : ''}
            {signals.syllabus && signals.quiz ? ' · ' : ''}
            {signals.quiz ? `${signals.quiz.gaps.length} lỗ hổng từ ${signals.quiz.quizzes.length} bài quiz${signals.quiz.averageScore !== undefined ? ` (điểm TB ${signals.quiz.averageScore}%)` : ''}` : ''}
            {result.usedLLM ? ' · ghép bằng Gemini + so khớp từ' : ' · ghép bằng so khớp từ'}
          </p>
          <ul className="divide-y divide-rule">
            {result.changes.filter((c) => Math.abs(c.after - c.before) >= 3).slice(0, 10).map((c) => (
              <li key={c.pageId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2">
                <span className="truncate text-sm text-ink">{c.title}</span>
                <span className={`text-sm font-medium tabular-nums ${c.after > c.before ? 'text-navy' : 'text-ink-faint'}`}>
                  {fmtClock(c.before)} → {fmtClock(c.after)}
                </span>
                {c.reasons.length > 0 && <span className="col-span-2 truncate text-xs text-ink-faint">{c.reasons.join(' · ')}</span>}
              </li>
            ))}
          </ul>
          {result.unmatchedGaps.length > 0 && (
            <div className="rounded-xl bg-pen-soft px-3 py-2 text-xs text-pen">
              <div className="font-semibold">Người học sai nhưng slide chưa có nội dung ({result.unmatchedGaps.length}):</div>
              <ul className="mt-1 list-disc pl-4">
                {result.unmatchedGaps.slice(0, 5).map((g) => (
                  <li key={g.id}>{g.label}</li>
                ))}
              </ul>
            </div>
          )}
          {result.unmatchedTopics.length > 0 && (
            <p className="text-xs text-ink-faint">Mục đề cương không thấy trong slide: {result.unmatchedTopics.slice(0, 6).map((t) => `${t.number || ''} ${t.title}`.trim()).join('; ')}</p>
          )}
        </div>
      )}
    </section>
  );
};
