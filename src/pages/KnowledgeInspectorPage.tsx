// src/pages/KnowledgeInspectorPage.tsx
/**
 * Knowledge Inspector (per project)
 *  - "Cây trọng số": chapter/page/keyword tree; edit lecture time per node (distributes down / sums up),
 *    lock, exclude, keyword weights & filter. Saved with the project and used by the pipeline.
 *  - "Vùng ảnh & OCR": located image/table/chart/diagram regions over the real pages; toggle, draw,
 *    re-OCR. OCR text is merged into the document so narration and keywords can use it.
 * Everything reads the user's own project; there is no demo/fallback data.
 */
import React,{ useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileUp,
  GitBranch,
  ImageIcon,
  Loader2,
  Lock,
  Unlock,
  EyeOff,
  Eye,
  Play,
  Plus,
  Save,
  Scale,
  Trash2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { projectService } from '../services/projectService';
import { Project, KnowledgeTree, KnowledgeTreeNode, VisualRegion, CanonicalDocumentTree } from '../types';
import { KnowledgeTreeDiagram } from '../components/knowledge/KnowledgeTreeDiagram';
import { RegionInspector } from '../components/knowledge/RegionInspector';
import { StudyCalibrationPanel } from '../components/knowledge/StudyCalibrationPanel';
import {
  addKeyword,
  applyKeywordFilter,
  findNode,
  rebalanceToTarget,
  removeKeyword,
  renameNode,
  setKeywordWeight,
  setNodeDuration,
  toggleExclude,
  toggleLock
} from '../pipeline/services/knowledgeTreeOps';
import { fetchSourceFile, reattachSource, scanDocument, ScanProgress } from '../pipeline/services/documentScanner';
import { ocrVisualRegions, mergeRegionsIntoTree, OcrPreference } from '../pipeline/module1_extractor/visualRegionOcr';
import { regionAssetStore } from '../pipeline/module1_extractor/regionAssets';
import { deriveScanLimits } from '../services/llm/modelCatalog';
import { benchmarkService, buildScanRunLog, summarizeRun } from '../services/benchmark/benchmarkService';

type Tab = 'tree' | 'regions';

const fmtSec = (s?: number) => {
  const v = Math.round(s || 0);
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Project picker (/knowledge)
// ---------------------------------------------------------------------------
const ProjectPicker: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  useEffect(() => {
    if (user) projectService.listProjects(user.uid).then(setProjects);
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Knowledge Inspector</h1>
        <p className="text-xs text-ink-faint">Chọn một bài giảng để xem và chỉnh cây trọng số, vùng hình ảnh và kết quả OCR.</p>
      </div>
      {!projects ? (
        <div className="text-xs text-ink-faint">Đang tải...</div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-rule bg-paper-sheet p-6 text-xs text-ink-soft">
          Chưa có bài giảng nào. <Link to="/lectures/new" className="font-semibold text-navy">Tạo bài giảng mới</Link>
        </div>
      ) : (
        <ul className="divide-y divide-rule rounded-xl border border-rule bg-paper-sheet">
          {projects.map((p) => (
            <li key={p.projectId}>
              <Link to={`/projects/${p.projectId}/knowledge`} className="flex items-center gap-3 px-4 py-3 text-xs hover:bg-paper-band">
                <span className="font-semibold text-ink">{p.title}</span>
                <span className="text-ink-faint">{p.canonicalDocument?.total_sections || '?'} trang</span>
                <span className={`ml-auto rounded px-1.5 py-0.5 text-[11px] font-semibold ${p.knowledgeTree ? 'bg-paper-band text-print' : 'bg-paper-band text-ink-soft'}`}>
                  {p.knowledgeTree ? 'Có cây trọng số' : 'Chưa quét'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Node editor (side panel)
// ---------------------------------------------------------------------------
const NodeEditor: React.FC<{
  tree: KnowledgeTree;
  node: KnowledgeTreeNode;
  onChange: (t: KnowledgeTree) => void;
  onSelect: (id: string | null) => void;
}> = ({ tree, node, onChange, onSelect }) => {
  const [newKw, setNewKw] = useState('');
  const [sec, setSec] = useState(String(Math.round(node.duration_sec || 0)));
  const [title, setTitle] = useState(node.title);
  useEffect(() => {
    setSec(String(Math.round(node.duration_sec || 0)));
    setTitle(node.title);
  }, [node.id, node.duration_sec, node.title]);

  if (node.kind === 'keyword') {
    return (
      <div className="space-y-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Keyword</div>
          <div className="text-sm font-semibold text-ink">{node.title}</div>
          <div className="text-xs text-ink-faint">
            Nguồn: {node.keyword?.source === 'llm' ? 'Gemini chấm' : node.keyword?.source === 'user' ? 'bạn thêm/sửa' : 'luật cục bộ (TF-IDF)'}
            {node.keyword?.kind ? ` • ${node.keyword.kind}` : ''}
          </div>
        </div>
        <label className="block text-xs font-semibold text-ink-soft">
          Trọng số: <span className="font-mono">{(node.weight || 0).toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={node.weight || 0}
            onChange={(e) => onChange(setKeywordWeight(tree, node.id, Number(e.target.value)))}
            className="mt-1 w-full accent-print"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(toggleExclude(tree, node.id, false))}
            className="inline-flex items-center gap-1 rounded-lg border border-rule-strong px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-paper-band"
          >
            {node.excluded ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {node.excluded ? 'Dùng lại' : 'Không dùng'}
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(removeKeyword(tree, node.id));
              onSelect(null);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-pen-line px-2 py-1 text-xs font-semibold text-pen hover:bg-pen-soft"
          >
            <Trash2 className="w-3 h-3" /> Xoá
          </button>
        </div>
      </div>
    );
  }

  const commitSec = () => {
    const v = Number(sec);
    if (Number.isFinite(v) && v > 0) onChange(setNodeDuration(tree, node.id, v));
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          {node.kind === 'document' ? 'Tài liệu' : node.kind === 'chapter' ? 'Chương' : 'Trang'}
        </div>
        {node.kind === 'chapter' ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== node.title && onChange(renameNode(tree, node.id, title.trim()))}
            className="w-full rounded-lg border border-rule-strong px-2 py-1 text-sm font-semibold text-ink"
          />
        ) : (
          <div className="text-sm font-semibold text-ink">{node.title}</div>
        )}
      </div>

      <label className="block text-xs font-semibold text-ink-soft">
        Thời lượng (giây)
        <div className="mt-1 flex gap-2">
          <input
            type="number"
            min={5}
            value={sec}
            onChange={(e) => setSec(e.target.value)}
            onBlur={commitSec}
            onKeyDown={(e) => e.key === 'Enter' && commitSec()}
            disabled={node.excluded}
            className="w-24 rounded-lg border border-rule-strong px-2 py-1 font-mono text-xs"
          />
          <span className="self-center text-xs text-ink-faint">= {fmtSec(Number(sec))}</span>
        </div>
        <span className="mt-1 block font-normal text-ink-faint">
          {node.kind === 'page' ? 'Đổi trang này sẽ cộng dồn lên chương và tài liệu.' : 'Chia xuống các mục con theo tỉ lệ hiện tại; mục đã khoá giữ nguyên.'}
        </span>
      </label>

      {node.kind !== 'document' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(toggleLock(tree, node.id))}
            className="inline-flex items-center gap-1 rounded-lg border border-rule-strong px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-paper-band"
          >
            {node.locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {node.locked ? 'Mở khoá' : 'Khoá thời lượng'}
          </button>
          <button
            type="button"
            onClick={() => onChange(toggleExclude(tree, node.id))}
            className="inline-flex items-center gap-1 rounded-lg border border-rule-strong px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-paper-band"
          >
            {node.excluded ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {node.excluded ? 'Đưa vào bài giảng' : 'Bỏ khỏi bài giảng'}
          </button>
        </div>
      )}

      {node.kind === 'page' && (
        <div className="border-t border-rule pt-3">
          <div className="mb-1 text-xs font-semibold text-ink-soft">Thêm keyword</div>
          <div className="flex gap-2">
            <input
              value={newKw}
              onChange={(e) => setNewKw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newKw.trim()) {
                  onChange(addKeyword(tree, node.id, newKw));
                  setNewKw('');
                }
              }}
              placeholder="vd: backpropagation"
              className="min-w-0 flex-1 rounded-lg border border-rule-strong px-2 py-1 text-xs"
            />
            <button
              type="button"
              disabled={!newKw.trim()}
              onClick={() => {
                onChange(addKeyword(tree, node.id, newKw));
                setNewKw('');
              }}
              className="rounded-lg bg-cover px-2 text-white disabled:opacity-40"
              aria-label="Thêm keyword"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Inspector
// ---------------------------------------------------------------------------
export const KnowledgeInspectorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) return <ProjectPicker />;
  return <ProjectKnowledgeInspector projectId={id} />;
};

const ProjectKnowledgeInspector: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tree, setTree] = useState<KnowledgeTree | null>(null);
  const [doc, setDoc] = useState<CanonicalDocumentTree | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>('tree');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['doc_root']));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceReady, setSourceReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    projectService.getProject(projectId, user.uid).then(async (p) => {
      setProject(p);
      setTree(p?.knowledgeTree || null);
      setDoc(p?.canonicalDocument || null);
      if (p?.knowledgeTree) setExpanded(new Set(['doc_root', p.knowledgeTree.root.children[0]?.id].filter(Boolean) as string[]));
      // Try to re-open the uploaded source for real page previews and OCR.
      const docId = p?.canonicalDocument?.document_id;
      if (docId && regionAssetStore.getHandle(docId)) setSourceReady(true);
      else if (docId && p?.source.cloudinaryUrl && !p.source.cloudinaryUrl.includes('/demo/')) {
        const blob = await fetchSourceFile(p.source.cloudinaryUrl);
        if (blob) setSourceReady(await reattachSource(blob, p.source.fileName, docId).catch(() => false));
      }
    });
  }, [user, projectId]);

  const selectedNode = useMemo(() => (tree && selectedId ? findNode(tree.root, selectedId) : null), [tree, selectedId]);

  const updateTree = (t: KnowledgeTree) => {
    setTree(t);
    setDirty(true);
  };

  const save = async (extra: Partial<Project> = {}) => {
    if (!project) return null;
    const next: Project = { ...project, knowledgeTree: tree || undefined, canonicalDocument: doc || project.canonicalDocument, ...extra };
    await projectService.updateProject(next);
    setProject(next);
    setDirty(false);
    return next;
  };

  const attachSource = async (file: File) => {
    if (!doc || !project) return;
    setBusy('Đang mở file nguồn...');
    const ok = await reattachSource(file, file.name, doc.document_id).catch(() => false);
    setSourceReady(ok);
    setBusy(null);
    if (!ok) setError('Không mở được file nguồn.');
  };

  const runScan = async () => {
    if (!project || !doc) return;
    if (tree && !window.confirm('Quét lại sẽ thay cây trọng số hiện tại (mất các chỉnh sửa). Tiếp tục?')) return;
    setError('');
    setBusy('Đang quét tài liệu...');
    try {
      const res = await scanDocument(doc, project.source.fileName, project.configuration, { onProgress: setScanProgress });
      setDoc(res.documentTree);
      setTree(res.knowledgeTree);
      setExpanded(new Set(['doc_root', res.knowledgeTree.root.children[0]?.id].filter(Boolean) as string[]));
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
      await benchmarkService.saveRun(log);
      const next: Project = { ...project, knowledgeTree: res.knowledgeTree, canonicalDocument: res.documentTree, lastBenchmark: summarizeRun(log) };
      await projectService.updateProject(next);
      setProject(next);
      setDirty(false);
    } catch (err: any) {
      setError(`Quét thất bại: ${err.message || err}`);
    } finally {
      setBusy(null);
      setScanProgress(null);
    }
  };

  const runOcr = async (regionIds: string[], preference: OcrPreference = 'auto') => {
    if (!doc) return;
    setBusy('Đang OCR...');
    try {
      const limits = deriveScanLimits();
      const wanted = new Set(regionIds);
      const regions = (doc.visual_regions || []).map((r) => (wanted.has(r.region_id) ? { ...r, ocr: { engine: r.ocr?.engine || 'gemini', status: 'pending' as const } } : r));
      const updated = await ocrVisualRegions(doc.document_id, regions, {
        concurrency: limits.concurrency,
        maxRegionsPerPage: 50,
        maxRegionsTotal: regionIds.length,
        deadline: performance.now() + 50_000,
        preference
      });
      // Manual regions need an element to carry their text into the page content.
      const sections = doc.sections.map((s) => {
        const missing = updated.filter((r) => r.section_id === s.section_id && !s.elements.some((e) => e.region_id === r.region_id));
        if (!missing.length) return s;
        return {
          ...s,
          elements: [...s.elements, ...missing.map((r, i) => ({ element_id: `${s.section_id}_el_u${i}_${Date.now().toString(36)}`, type: 'image' as const, text: '', bbox: r.bbox, region_id: r.region_id }))]
        };
      });
      setDoc(mergeRegionsIntoTree({ ...doc, sections }, updated));
      setDirty(true);
    } finally {
      setBusy(null);
    }
  };

  const setRegions = (regions: VisualRegion[]) => {
    if (!doc) return;
    setDoc(mergeRegionsIntoTree(doc, regions));
    setDirty(true);
  };

  if (!project) return <div className="p-12 text-center text-xs text-ink-faint">Đang tải...</div>;

  const stats = tree?.stats;
  const totalSec = tree?.root.duration_sec || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/lectures/${project.projectId}`} className="rounded-lg border border-rule-strong p-1.5 text-ink-soft hover:bg-paper-band" aria-label="Về bài giảng">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-print">Knowledge Inspector</div>
          <h1 className="truncate text-lg font-bold text-ink">{project.title}</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!sourceReady && (
            <>
              <input ref={fileInput} type="file" accept=".pptx,.pdf,.md,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && attachSource(e.target.files[0])} />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rule-strong bg-paper-sheet px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-paper-band"
              >
                <FileUp className="w-3.5 h-3.5" /> Mở file nguồn
              </button>
            </>
          )}
          <button
            type="button"
            disabled={Boolean(busy) || !doc}
            onClick={runScan}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule-strong bg-paper-sheet px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-paper-band disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {tree ? 'Quét lại' : 'Tạo cây trọng số'}
          </button>
          <button
            type="button"
            disabled={!dirty || Boolean(busy)}
            onClick={() => save()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule-strong bg-paper-sheet px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-paper-band disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" /> Lưu
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || !tree}
            onClick={async () => {
              const next = await save({ configuration: { ...project.configuration, targetDurationSeconds: Math.round(totalSec) || project.configuration.targetDurationSeconds } });
              if (next) navigate(`/lectures/${project.projectId}?rerun=1`);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cover px-3 py-1.5 text-xs font-semibold text-white hover:bg-cover disabled:opacity-40"
          >
            <Play className="w-3.5 h-3.5" /> Áp dụng & tạo lại bài giảng
          </button>
        </div>
      </div>

      {busy && (
        <div className="flex items-center gap-2 rounded-xl border border-rule-strong bg-paper-band px-3 py-2 text-xs text-print">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="flex-1">{scanProgress?.message || busy}</span>
          {scanProgress && <span className="font-mono tabular-nums">{(scanProgress.elapsedMs / 1000).toFixed(1)}s</span>}
        </div>
      )}
      {error && <div className="rounded-xl border border-pen-line bg-pen-soft px-3 py-2 text-xs text-pen">{error}</div>}

      {stats && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
          <span>
            <b className="text-ink">{stats.pages_total}</b> trang ({stats.pages_llm} do Gemini chấm)
          </span>
          <span>
            <b className="text-ink">{stats.regions_ocr_done}</b>/{stats.regions_total} vùng ảnh đã đọc
          </span>
          <span>
            Quét trong <b className="text-ink">{(stats.scan_ms / 1000).toFixed(1)}s</b>
          </span>
          <span>
            <b className="text-ink">{stats.total_tokens.toLocaleString()}</b> tokens • {stats.llm_calls} lần gọi API
          </span>
          <span className="font-mono">{tree?.model}</span>
        </div>
      )}
      {stats?.notes?.length ? (
        <ul className="space-y-1 rounded-xl border border-pen-line bg-pen-soft px-3 py-2 text-xs text-pen">
          {stats.notes.map((n, i) => (
            <li key={i} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {n}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-rule">
        {(
          [
            ['tree', 'Cây trọng số', GitBranch],
            ['regions', `Vùng ảnh & OCR (${doc?.visual_regions?.length || 0})`, ImageIcon]
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold ${
              tab === key ? 'border-print text-print' : 'border-transparent text-ink-faint hover:text-ink'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'tree' &&
        (!tree ? (
          <div className="rounded-xl border border-rule bg-paper-sheet p-8 text-center text-xs text-ink-soft">
            Bài giảng này chưa có cây trọng số. Bấm <b>Tạo cây trọng số</b> để chia chương, chấm trọng số keyword từng trang và phân bổ thời lượng.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-rule bg-paper-band p-4">
              <KnowledgeTreeDiagram
                root={tree.root}
                expanded={expanded}
                selectedId={selectedId}
                onToggle={(id) =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    next.has(id) ? next.delete(id) : next.add(id);
                    return next;
                  })
                }
                onSelect={setSelectedId}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-3 rounded-xl border border-rule bg-paper-sheet p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Scale className="w-3.5 h-3.5 text-print" /> Thiết lập chung
                </div>
                <label className="block text-xs font-semibold text-ink-soft">
                  Tổng thời lượng: <span className="font-mono">{fmtSec(totalSec)}</span>
                  <div className="mt-1 flex gap-2">
                    {[3, 5, 10, 15, 20].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => updateTree(rebalanceToTarget(tree, m * 60))}
                        className={`rounded-md border px-2 py-0.5 text-xs ${Math.round(totalSec / 60) === m ? 'border-print bg-cover text-white' : 'border-rule-strong text-ink-soft hover:bg-paper-band'}`}
                      >
                        {m}′
                      </button>
                    ))}
                  </div>
                </label>
                <label className="block text-xs font-semibold text-ink-soft">
                  Ngưỡng trọng số keyword: <span className="font-mono">{tree.settings.min_keyword_weight.toFixed(2)}</span>
                  <input
                    type="range"
                    min={0}
                    max={0.9}
                    step={0.05}
                    value={tree.settings.min_keyword_weight}
                    onChange={(e) => updateTree(applyKeywordFilter(tree, Number(e.target.value), tree.settings.max_keywords_per_page))}
                    className="mt-1 w-full accent-print"
                  />
                </label>
                <label className="block text-xs font-semibold text-ink-soft">
                  Tối đa keyword / trang: <span className="font-mono">{tree.settings.max_keywords_per_page}</span>
                  <input
                    type="range"
                    min={1}
                    max={16}
                    step={1}
                    value={tree.settings.max_keywords_per_page}
                    onChange={(e) => updateTree(applyKeywordFilter(tree, tree.settings.min_keyword_weight, Number(e.target.value)))}
                    className="mt-1 w-full accent-print"
                  />
                </label>
                <p className="text-xs leading-snug text-ink-faint">
                  Giới hạn mặc định tính theo {tree.model.includes('gemini') ? tree.model.replace(/^gemini:/, '') : 'gemini-2.5-flash'}: tối đa {tree.settings.max_pages} trang được chấm bằng LLM trong ngân sách 55s.
                </p>
              </div>

              <StudyCalibrationPanel tree={tree} docTree={doc} onApply={updateTree} />

              <div className="rounded-xl border border-rule bg-paper-sheet p-4">
                {selectedNode ? (
                  <NodeEditor tree={tree} node={selectedNode} onChange={updateTree} onSelect={setSelectedId} />
                ) : (
                  <p className="text-xs text-ink-faint">Chọn một nút trên cây để chỉnh thời lượng, khoá, bỏ khỏi bài giảng hoặc sửa trọng số keyword.</p>
                )}
              </div>
            </div>
          </div>
        ))}

      {tab === 'regions' && doc && <RegionInspector docTree={doc} sourceReady={sourceReady} busy={busy === 'Đang OCR...'} onChange={setRegions} onRunOcr={runOcr} />}
    </div>
  );
};
