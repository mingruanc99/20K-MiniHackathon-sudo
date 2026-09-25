// src/pages/NewLecturePage.tsx
/**
 * New lecture: drop a deck, pick length / audience / language / writing mode, scan.
 * The scan builds the document, reads tables & diagrams and proposes the weighted tree;
 * the lecture then opens on its review step.
 */
import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileUp, FileText, Loader2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { projectService } from '../services/projectService';
import { cloudinaryService } from '../services/cloudinaryService';
import { scanDocument, ScanProgress } from '../pipeline/services/documentScanner';
import { warmUpTesseract } from '../pipeline/module1_extractor/visualRegionOcr';
import { benchmarkService, buildScanRunLog, summarizeRun } from '../services/benchmark/benchmarkService';
import { FileType, LearnerLevel, UserConfiguration } from '../types';
import { markLectureMoved } from './LectureBoardPage';

const ACCEPT = '.pptx,.pdf,.md,.markdown,.txt';
const DURATIONS = [3, 5, 10, 15, 20];
const LEVELS: { id: LearnerLevel; label: string }[] = [
  { id: 'beginner', label: 'Phổ thông' },
  { id: 'undergraduate', label: 'Đại học' },
  { id: 'graduate', label: 'Sau đại học' },
  { id: 'professional', label: 'Chuyên gia' }
];

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  hint
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">{label}</legend>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      <div className="mt-2 inline-flex flex-wrap gap-1 rounded-xl bg-paper-band p-1">
        {options.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              value === o.id ? 'bg-paper-sheet font-semibold text-ink shadow-[0_1px_2px_rgba(16,48,42,0.12)]' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export const NewLecturePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [minutes, setMinutes] = useState(5);
  const [level, setLevel] = useState<LearnerLevel>('undergraduate');
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [engine, setEngine] = useState<'template' | 'llm'>('template');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = (f: File | undefined) => {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (!['pptx', 'pdf', 'md', 'markdown', 'txt'].includes(ext)) {
      setError(`Chưa hỗ trợ định dạng .${ext}. Hãy dùng PPTX, PDF hoặc Markdown (với .ppt/.docx: lưu lại thành PPTX hoặc PDF).`);
      return;
    }
    setError('');
    setFile(f);
    // Slides and PDFs may hold tables/diagrams: load OCR while the user fills in the rest of the form.
    if (ext === 'pptx' || ext === 'pdf') warmUpTesseract();
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '));
  };

  const start = async () => {
    if (!user || !file) return;
    setBusy(true);
    setError('');
    const config: UserConfiguration = {
      language: lang,
      narration_language: lang,
      technical_terminology_language: 'en',
      preserve_technical_terms: true,
      natural_vietnamese: lang === 'vi',
      learnerLevel: level,
      priorKnowledge: '',
      targetDurationSeconds: minutes * 60,
      targetWpm: 140,
      narrationStyle: 'academic',
      visualDensity: 'balanced',
      narrationEngine: engine
    };
    try {
      const [scan, upload] = await Promise.all([
        scanDocument(file, file.name, config, { onProgress: setProgress }),
        cloudinaryService.uploadFile(file, file.name)
      ]);
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pptx';
      let project = await projectService.createProject(
        user.uid,
        title.trim() || scan.documentTree.title,
        {
          fileName: file.name,
          fileType: (ext === 'markdown' || ext === 'md' ? 'markdown' : ext === 'txt' ? 'text' : ext) as FileType,
          fileSize: file.size,
          cloudinaryPublicId: upload.public_id,
          cloudinaryUrl: upload.secure_url
        },
        config,
        `${scan.documentTree.total_sections} trang`,
        scan.documentTree
      );
      const log = buildScanRunLog({
        runId: `scan_${Date.now().toString(36)}`,
        projectId: project.projectId,
        projectTitle: project.title,
        config,
        tree: scan.knowledgeTree,
        timings: [
          { stage: 'extract', ms: scan.timings.extractMs },
          { stage: 'ocr+keywords+chapters (parallel)', ms: scan.timings.analyzeMs },
          { stage: 'build tree', ms: scan.timings.buildMs }
        ],
        totalMs: scan.timings.totalMs,
        calls: scan.llmCalls
      });
      project = { ...project, knowledgeTree: scan.knowledgeTree, lastBenchmark: summarizeRun(log) };
      await Promise.all([projectService.updateProject(project), benchmarkService.saveRun(log)]);
      markLectureMoved(project.projectId);
      navigate(`/lectures/${project.projectId}`);
    } catch (err: any) {
      setError(`Không quét được tài liệu: ${err?.message || err}`);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Sổ bài giảng
        </Link>
        <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight text-ink">Ghi bài mới</h1>
        <p className="mt-1 text-sm text-ink-faint">Tải slide lên, chọn thời lượng và người học. Bạn sẽ duyệt cấu trúc trước khi tạo lời giảng.</p>
      </div>

      {/* Drop zone */}
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={`flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-print ${
            dragOver ? 'border-print bg-paper-band' : 'border-rule-strong bg-paper-sheet hover:border-print-soft'
          }`}
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-paper-band text-print">
            <FileUp className="h-6 w-6" />
          </span>
          <span className="text-base font-semibold text-ink">Thả file bài giảng vào đây</span>
          <span className="text-sm text-ink-faint">hoặc bấm để chọn · PPTX, PDF, Markdown</span>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-rule bg-paper-sheet p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-paper-band text-ink-soft">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{file.name}</div>
            <div className="text-xs tabular-nums text-ink-faint">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
          </div>
          {!busy && (
            <button type="button" onClick={() => setFile(null)} aria-label="Bỏ file" className="rounded-lg p-2 text-ink-faint hover:bg-paper-band hover:text-ink-soft">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

      {/* Settings */}
      <div className="space-y-6">
        <label className="block">
          <span className="text-sm font-medium text-ink">Tên bài giảng</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Mạng nơ-ron tích chập"
            className="mt-2 w-full rounded-xl border border-rule-strong bg-paper-sheet px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-print focus:outline-none focus:ring-2 focus:ring-print/20"
          />
        </label>
        <Segmented
          label="Thời lượng lời giảng"
          value={minutes}
          options={DURATIONS.map((m) => ({ id: m, label: `${m} phút` }))}
          onChange={(v) => setMinutes(Number(v))}
          hint="Hệ thống chia thời lượng cho từng phần; bạn chỉnh được ở bước duyệt."
        />
        <Segmented label="Người học" value={level} options={LEVELS} onChange={(v) => setLevel(v as LearnerLevel)} />
        <Segmented
          label="Ngôn ngữ lời giảng"
          value={lang}
          options={[
            { id: 'vi', label: 'Tiếng Việt' },
            { id: 'en', label: 'English' }
          ]}
          onChange={(v) => setLang(v as 'vi' | 'en')}
          hint="Thuật ngữ kỹ thuật tiếng Anh (CNN, kernel…) luôn được giữ nguyên."
        />
        <Segmented
          label="Cách viết lời giảng"
          value={engine}
          options={[
            { id: 'template', label: 'Theo mẫu' },
            { id: 'llm', label: 'AI viết' }
          ]}
          onChange={(v) => setEngine(v as 'template' | 'llm')}
          hint={engine === 'llm' ? 'Tự nhiên hơn, tốn token API.' : 'Nhanh, không tốn token, bám sát chữ trên slide.'}
        />
      </div>

      {error && <p className="rounded-xl bg-pen-soft px-4 py-3 text-sm text-pen">{error}</p>}

      <div className="flex flex-col gap-3 border-t border-rule pt-6 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={!file || busy}
          onClick={start}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cover px-5 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-cover-deep disabled:cursor-not-allowed disabled:bg-rule-strong"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? 'Đang quét tài liệu...' : 'Quét tài liệu'}
        </button>
        {busy && progress && (
          <div className="flex-1">
            <div className="flex justify-between text-xs text-ink-soft">
              <span className="truncate pr-2">{progress.message}</span>
              <span className="tabular-nums">{(progress.elapsedMs / 1000).toFixed(0)}s</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-cover transition-[width] duration-500 ease-out" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        )}
        {!busy && <p className="text-xs text-ink-faint">Thường mất dưới 1 phút, kể cả đọc bảng và sơ đồ.</p>}
      </div>
    </div>
  );
};

export default NewLecturePage;
