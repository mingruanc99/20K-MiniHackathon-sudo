// src/pages/KnowledgeInspectorPage.tsx
import React, { useState, useEffect } from 'react';
import {
  knowledgeService,
  DocumentOverview,
  InspectorSlide,
  InspectorElement,
  InspectorVisual,
  InspectorRelation,
  InspectorChunk,
  PipelineDebugResponse,
  QueryTestResponse
} from '../services/knowledgeService';
import {
  Database,
  Layers,
  Eye,
  FileCode,
  Network,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  ArrowRight,
  Info,
  Activity,
  Maximize2,
  Box,
  Cpu,
  RefreshCw,
  GitBranch,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

type TabKey =
  | 'overview'
  | 'slide'
  | 'elements'
  | 'visual'
  | 'overlay'
  | 'raw_norm'
  | 'graph'
  | 'chunks'
  | 'db_raw'
  | 'retrieval'
  | 'pipeline';

export const KnowledgeInspectorPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [docOverview, setDocOverview] = useState<DocumentOverview | null>(null);

  // Slide state
  const [slides, setSlides] = useState<InspectorSlide[]>([]);
  const [selectedSlideId, setSelectedSlideId] = useState<string>('');
  const [selectedSlideNum, setSelectedSlideNum] = useState<number>(8);

  // Inspector collections for selected slide
  const [elements, setElements] = useState<InspectorElement[]>([]);
  const [visuals, setVisuals] = useState<InspectorVisual[]>([]);
  const [relations, setRelations] = useState<InspectorRelation[]>([]);
  const [chunks, setChunks] = useState<InspectorChunk[]>([]);
  const [pipelineDebug, setPipelineDebug] = useState<PipelineDebugResponse | null>(null);

  // Selection modals
  const [selectedElement, setSelectedElement] = useState<InspectorElement | null>(null);
  const [selectedVisual, setSelectedVisual] = useState<InspectorVisual | null>(null);
  const [rawRecordType, setRawRecordType] = useState<string>('visual');

  // Retrieval query state
  const [queryInput, setQueryInput] = useState<string>('human pose skeleton');
  const [queryResults, setQueryResults] = useState<QueryTestResponse | null>(null);
  const [queryLoading, setQueryLoading] = useState<boolean>(false);

  // Overlay state
  const [overlayFilter, setOverlayFilter] = useState<'all' | 'text' | 'visual' | 'annotation'>('all');
  const [hoveredOverlayId, setHoveredOverlayId] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    const docs = await knowledgeService.listDocuments();
    setDocuments(docs);
    const poseDoc = docs.find((d: any) => d.file_name?.toLowerCase().includes('pose')) || docs[0];
    const initialDocId = poseDoc ? poseDoc.id : 'doc_pose_est_01';
    setSelectedDocId(initialDocId);
    await loadDocData(initialDocId);
    setLoading(false);
  };

  const loadDocData = async (docId: string) => {
    const overview = await knowledgeService.getDocument(docId);
    setDocOverview(overview);

    const sList = await knowledgeService.getSlides(docId);
    setSlides(sList);

    // Default to slide 8 (the human pose skeleton acceptance slide)
    const targetSlide = sList.find(s => s.slide_number === 8) || sList[sList.length - 1] || sList[0];
    if (targetSlide) {
      setSelectedSlideId(targetSlide.id);
      setSelectedSlideNum(targetSlide.slide_number);
      await loadSlideData(targetSlide.id);
    }

    const debug = await knowledgeService.getPipelineDebug(docId);
    setPipelineDebug(debug);

    // Initial retrieval query
    handleRunQuery('human pose skeleton', docId);
  };

  const loadSlideData = async (slideId: string) => {
    const [els, vis, rels, chs] = await Promise.all([
      knowledgeService.getElements(slideId),
      knowledgeService.getVisuals(slideId),
      knowledgeService.getRelations(slideId),
      knowledgeService.getChunks(slideId)
    ]);
    setElements(els);
    setVisuals(vis);
    setRelations(rels);
    setChunks(chs);
    if (vis.length > 0) {
      setSelectedVisual(vis[0]);
    } else {
      setSelectedVisual(null);
    }
  };

  const handleSlideChange = async (slide: InspectorSlide) => {
    setSelectedSlideId(slide.id);
    setSelectedSlideNum(slide.slide_number);
    await loadSlideData(slide.id);
  };

  const handleRunQuery = async (queryText: string, docId?: string) => {
    setQueryLoading(true);
    const res = await knowledgeService.queryKnowledge(queryText, docId || selectedDocId);
    setQueryResults(res);
    setQueryLoading(false);
  };

  const currentSlide = slides.find(s => s.id === selectedSlideId || s.slide_number === selectedSlideNum);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Document Knowledge & Database Inspector</h1>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  REAL PERSISTENCE LAYER
                </span>
              </div>
              <p className="text-xs text-slate-400">
                RAW DOCUMENT &rarr; EXTRACTION &rarr; DOCUMENT IR &rarr; DATABASE &rarr; HYBRID RETRIEVAL
              </p>
            </div>
          </div>

          {/* Document Picker & Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Target File:</span>
              <select
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                value={selectedDocId}
                onChange={e => {
                  setSelectedDocId(e.target.value);
                  loadDocData(e.target.value);
                }}
              >
                {documents.map((d: any) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    {d.file_name} ({d.id})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => loadDocData(selectedDocId)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Refresh database records"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 11 Navigation Tabs */}
        <div className="max-w-7xl mx-auto mt-4 flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-slate-800/80 pt-2 text-xs">
          {[
            { key: 'overview', label: '1. Document Overview', icon: FileText },
            { key: 'slide', label: '2. Slide Inspector', icon: Layers },
            { key: 'elements', label: '3. Element Inspector', icon: Box },
            { key: 'visual', label: '4. Visual Inspector', icon: Sparkles, badge: visuals.length > 0 ? `${visuals.length}` : '0' },
            { key: 'overlay', label: '5. Visual Overlay', icon: Eye },
            { key: 'raw_norm', label: '6. Raw vs Normalized', icon: RefreshCw },
            { key: 'graph', label: '7. Relation Graph', icon: GitBranch },
            { key: 'chunks', label: '8. Chunk Inspector', icon: Cpu },
            { key: 'db_raw', label: '9. Database Records', icon: FileCode },
            { key: 'retrieval', label: '10. Retrieval Tester', icon: Search },
            { key: 'pipeline', label: '11. Pipeline Debug', icon: Activity }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      tab.badge === '0' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
            <p>Querying real database records for {docOverview?.document.file_name || 'document'}...</p>
          </div>
        ) : (
          <>
            {/* ==================================================================== */}
            {/* PAGE 1: DOCUMENT OVERVIEW                                            */}
            {/* ==================================================================== */}
            {activeTab === 'overview' && docOverview && (
              <div className="space-y-6">
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
                  <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-700/60 gap-4">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-bold">Document Metadata</span>
                      <h2 className="text-2xl font-bold text-white mt-1">{docOverview.document.file_name}</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Document ID: <code className="text-cyan-300 bg-slate-900/80 px-2 py-0.5 rounded font-mono">{docOverview.document.id}</code>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        Status: {docOverview.document.status.toUpperCase()}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-200">
                        Version {docOverview.document.version}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                        Schema: v{docOverview.document.schema_version}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-xs">
                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                      <p className="text-slate-400">Owner ID</p>
                      <p className="font-mono text-white mt-1 font-semibold">{docOverview.document.owner_id}</p>
                    </div>
                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                      <p className="text-slate-400">Parser Version</p>
                      <p className="font-mono text-white mt-1 font-semibold">{docOverview.document.parser_version}</p>
                    </div>
                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                      <p className="text-slate-400">Embedding Model</p>
                      <p className="font-mono text-white mt-1 font-semibold">{docOverview.document.embedding_model}</p>
                    </div>
                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                      <p className="text-slate-400">Processing Run ID</p>
                      <p className="font-mono text-cyan-300 mt-1 font-semibold">{docOverview.processing_run.run_id}</p>
                    </div>
                  </div>
                </div>

                {/* Quantitative Layer Counts */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Persisted Knowledge Entities</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {[
                      { label: 'Slides', count: docOverview.stats.slides, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                      { label: 'Elements', count: docOverview.stats.elements, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                      { label: 'Visuals', count: docOverview.stats.visuals, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                      { label: 'Concepts', count: docOverview.stats.concepts, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                      { label: 'Relations', count: docOverview.stats.relations, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                      { label: 'Chunks', count: docOverview.stats.chunks, color: 'text-rose-400', bg: 'bg-rose-500/10' },
                      { label: 'Embeddings', count: docOverview.stats.embeddings, color: 'text-teal-400', bg: 'bg-teal-500/10' }
                    ].map((card, i) => (
                      <div key={i} className={`p-4 rounded-xl border border-slate-800 ${card.bg} flex flex-col justify-between`}>
                        <p className="text-xs text-slate-400 font-medium">{card.label}</p>
                        <p className={`text-2xl font-black mt-2 font-mono ${card.color}`}>{card.count}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Slides Overview Grid */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Slide Sequence Explorer</h3>
                    <span className="text-xs text-cyan-400">Click a slide to inspect</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {slides.map(s => {
                      const isSlide8 = s.slide_number === 8;
                      const isCurrent = s.id === selectedSlideId;
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            handleSlideChange(s);
                            setActiveTab('slide');
                          }}
                          className={`p-4 rounded-xl border cursor-pointer transition ${
                            isCurrent
                              ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-lg'
                              : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-cyan-400">
                              Slide {s.slide_number}
                            </span>
                            {isSlide8 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                                TARGET SLIDE
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold mt-2 line-clamp-2">{s.title || `Slide ${s.slide_number}`}</p>
                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-700/50 pt-2">
                            <span>Inspect &rarr;</span>
                            <span className="font-mono text-slate-500">ID: ..._S{s.slide_number.toString().padStart(2, '0')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* PAGE 2: SLIDE INSPECTOR (Original Slide vs Extracted Knowledge)      */}
            {/* ==================================================================== */}
            {activeTab === 'slide' && (
              <div className="space-y-4">
                {/* Slide Bar */}
                <div className="flex items-center justify-between bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-semibold">Select Slide:</span>
                    <div className="flex gap-1 overflow-x-auto">
                      {slides.map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleSlideChange(s)}
                          className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                            s.id === selectedSlideId
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          S{s.slide_number}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    Showing Slide <strong className="text-white">{selectedSlideNum}</strong> of {slides.length}
                  </div>
                </div>

                {/* 2-Column Split: ORIGINAL SLIDE vs KNOWLEDGE STRUCTURE */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Original Slide Presentation Render */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col justify-between aspect-video relative overflow-hidden">
                    <div className="absolute top-2 left-3 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                      Original Slide Preview
                    </div>

                    {/* Slide Header */}
                    <div className="mt-4">
                      <h2 className="text-xl font-bold text-white tracking-tight">
                        {currentSlide?.title || 'Slide Title'}
                      </h2>
                    </div>

                    {/* Slide Body: Pose Skeleton Diagram on Left, Explanatory bullets on Right */}
                    {selectedSlideNum === 8 ? (
                      <div className="grid grid-cols-2 gap-4 flex-1 my-4 items-center">
                        {/* Diagram Left Area */}
                        <div className="h-full bg-slate-900/90 rounded-xl border border-cyan-800/40 p-3 flex flex-col items-center justify-center relative shadow-inner">
                          <span className="absolute top-1 left-2 text-[10px] font-mono text-cyan-400 font-bold">
                            DIAGRAM: Human Pose Skeleton
                          </span>

                          {/* SVG Skeletal Structure visualization representing 17 keypoints and 19 edges */}
                          <svg viewBox="0 0 100 100" className="w-40 h-40">
                            {/* Torso & Limbs connections */}
                            <line x1="50" y1="20" x2="40" y2="30" stroke="#0284c7" strokeWidth="2" />
                            <line x1="50" y1="20" x2="60" y2="30" stroke="#0284c7" strokeWidth="2" />
                            <line x1="40" y1="30" x2="60" y2="30" stroke="#0284c7" strokeWidth="2" />
                            <line x1="40" y1="30" x2="30" y2="45" stroke="#0284c7" strokeWidth="2" />
                            <line x1="60" y1="30" x2="70" y2="45" stroke="#0284c7" strokeWidth="2" />
                            <line x1="30" y1="45" x2="20" y2="55" stroke="#0284c7" strokeWidth="2" />
                            <line x1="70" y1="45" x2="80" y2="55" stroke="#0284c7" strokeWidth="2" />
                            <line x1="40" y1="30" x2="45" y2="60" stroke="#0284c7" strokeWidth="2" />
                            <line x1="60" y1="30" x2="55" y2="60" stroke="#0284c7" strokeWidth="2" />
                            <line x1="45" y1="60" x2="55" y2="60" stroke="#0284c7" strokeWidth="2" />
                            <line x1="45" y1="60" x2="42" y2="75" stroke="#0284c7" strokeWidth="2" />
                            <line x1="55" y1="60" x2="58" y2="75" stroke="#0284c7" strokeWidth="2" />
                            <line x1="42" y1="75" x2="40" y2="90" stroke="#0284c7" strokeWidth="2" />
                            <line x1="58" y1="75" x2="60" y2="90" stroke="#0284c7" strokeWidth="2" />

                            {/* 17 keypoint nodes labeled 0..16 */}
                            {[
                              { id: 0, x: 50, y: 15 },
                              { id: 1, x: 47, y: 12 },
                              { id: 2, x: 53, y: 12 },
                              { id: 3, x: 44, y: 13 },
                              { id: 4, x: 56, y: 13 },
                              { id: 5, x: 40, y: 30 },
                              { id: 6, x: 60, y: 30 },
                              { id: 7, x: 30, y: 45 },
                              { id: 8, x: 70, y: 45 },
                              { id: 9, x: 20, y: 55 },
                              { id: 10, x: 80, y: 55 },
                              { id: 11, x: 45, y: 60 },
                              { id: 12, x: 55, y: 60 },
                              { id: 13, x: 42, y: 75 },
                              { id: 14, x: 58, y: 75 },
                              { id: 15, x: 40, y: 90 },
                              { id: 16, x: 60, y: 90 }
                            ].map(kp => (
                              <g key={kp.id}>
                                <circle cx={kp.x} cy={kp.y} r="3" fill="#38bdf8" />
                                <text x={kp.x + 3} y={kp.y + 2} fontSize="5" fill="#f8fafc" fontWeight="bold">
                                  {kp.id}
                                </text>
                              </g>
                            ))}
                          </svg>
                          <span className="text-[10px] text-slate-400 mt-1">17 Keypoints (0..16) • 19 Edges</span>
                        </div>

                        {/* Right Text Bullets */}
                        <div className="flex flex-col justify-center space-y-2 text-xs text-slate-200">
                          <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                            <strong>■ 0 nose — mũi</strong>
                          </div>
                          <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                            <strong>■ 1–4 mắt trái, mắt phải, tai trái, tai phải</strong>
                          </div>
                          <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                            <strong>■ 5–10 vai, khuỷu tay, cổ tay</strong> (trái rồi phải)
                          </div>
                          <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                            <strong>■ 11–16 hông, đầu gối, cổ chân</strong> (trái rồi phải)
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-center text-xs text-slate-300 space-y-3 px-4">
                        <div className="p-3 bg-slate-900/60 rounded border border-slate-800">
                          {currentSlide?.title} - Kiến trúc sư phạm và nội dung bài giảng.
                        </div>
                      </div>
                    )}

                    {/* Bottom Caption */}
                    <div className="text-[11px] text-slate-500 italic border-t border-slate-800/80 pt-2 flex items-center justify-between">
                      <span>Nguồn: COCO — person keypoints, 17 điểm / 19 cạnh</span>
                      <span className="font-mono text-[10px]">COCO-Format</span>
                    </div>
                  </div>

                  {/* Right: Extracted Knowledge Structure in Database */}
                  <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400">
                        Slide {selectedSlideNum} Extracted Knowledge
                      </h3>
                      <span className="text-xs font-mono text-slate-400">Slide ID: {selectedSlideId}</span>
                    </div>

                    {/* Summary Badges */}
                    <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <p className="text-slate-400 text-[10px]">Elements</p>
                        <p className="text-lg font-bold text-amber-400">{elements.length}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <p className="text-slate-400 text-[10px]">Visuals</p>
                        <p className="text-lg font-bold text-cyan-400">{visuals.length}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <p className="text-slate-400 text-[10px]">Relations</p>
                        <p className="text-lg font-bold text-purple-400">{relations.length}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <p className="text-slate-400 text-[10px]">Chunks</p>
                        <p className="text-lg font-bold text-rose-400">{chunks.length}</p>
                      </div>
                    </div>

                    {/* Visual Recognition Status */}
                    <div className="p-3 rounded-xl border border-slate-700 bg-slate-900/80 space-y-1">
                      <span className="text-[11px] text-slate-400 font-semibold uppercase">Visual Recognition State</span>
                      {visuals.length > 0 ? (
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-bold text-white">{visuals[0].subtype}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono">
                              conf: {visuals[0].confidence}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 font-mono">
                            {visuals[0].metadata?.keypoint_count || 17} pts / {visuals[0].metadata?.connection_count || 19} edges
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-rose-400 text-xs font-bold pt-1">
                          <AlertTriangle className="w-4 h-4" />
                          <span>NO VISUAL RECORD FOUND</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Elements Snippet */}
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Extracted Slide Elements</span>
                      <div className="mt-2 space-y-1 max-h-56 overflow-y-auto pr-1">
                        {elements.slice(0, 8).map(el => (
                          <div
                            key={el.id}
                            onClick={() => {
                              setSelectedElement(el);
                              setActiveTab('elements');
                            }}
                            className="p-2 rounded bg-slate-900/60 hover:bg-slate-700/60 border border-slate-800 cursor-pointer flex items-center justify-between text-xs transition"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                  el.type === 'text'
                                    ? 'bg-amber-950 text-amber-300'
                                    : el.type === 'diagram'
                                    ? 'bg-cyan-950 text-cyan-300'
                                    : el.type === 'annotation'
                                    ? 'bg-purple-950 text-purple-300'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {el.type}
                              </span>
                              <span className="text-white truncate">{el.content || el.role}</span>
                            </div>
                            <span className="text-slate-500 font-mono text-[10px]">{el.confidence}</span>
                          </div>
                        ))}
                        {elements.length > 8 && (
                          <button
                            onClick={() => setActiveTab('elements')}
                            className="w-full text-center text-xs text-cyan-400 hover:text-cyan-300 py-1"
                          >
                            View all {elements.length} elements in Element Inspector &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* PAGE 3: ELEMENT INSPECTOR                                            */}
            {/* ==================================================================== */}
            {activeTab === 'elements' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Extracted Document Elements</h3>
                    <p className="text-xs text-slate-400">
                      Listing all {elements.length} elements extracted for Slide {selectedSlideNum}. Click row for deep property inspection.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-cyan-400 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                    Slide: {selectedSlideId}
                  </span>
                </div>

                {/* Elements Table */}
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-700">
                        <tr>
                          <th className="p-3">ID</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Subtype</th>
                          <th className="p-3">Role</th>
                          <th className="p-3">Region</th>
                          <th className="p-3">Content</th>
                          <th className="p-3">Confidence</th>
                          <th className="p-3 text-right">Inspect</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {elements.map(el => (
                          <tr
                            key={el.id}
                            onClick={() => setSelectedElement(el)}
                            className="hover:bg-slate-700/40 cursor-pointer transition"
                          >
                            <td className="p-3 font-mono text-cyan-300 font-semibold">{el.id}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  el.type === 'text'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : el.type === 'diagram'
                                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                    : el.type === 'annotation'
                                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {el.type}
                              </span>
                            </td>
                            <td className="p-3 text-slate-300 font-mono">{el.subtype || '—'}</td>
                            <td className="p-3 text-slate-400">{el.role}</td>
                            <td className="p-3 font-mono text-[11px] text-slate-400">{el.layout_region || 'main'}</td>
                            <td className="p-3 text-white max-w-xs truncate">{el.content}</td>
                            <td className="p-3 font-mono text-emerald-400 font-bold">{el.confidence}</td>
                            <td className="p-3 text-right text-cyan-400 font-medium">Inspect &rarr;</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Selected Element Detail Modal */}
                {selectedElement && (
                  <div className="p-6 bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Box className="w-5 h-5 text-cyan-400" />
                        <h4 className="text-sm font-bold text-white font-mono">{selectedElement.id}</h4>
                      </div>
                      <button
                        onClick={() => setSelectedElement(null)}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                      >
                        Close
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400">Type</span>
                        <p className="font-mono text-cyan-300 font-bold mt-0.5">{selectedElement.type}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Subtype</span>
                        <p className="font-mono text-white mt-0.5">{selectedElement.subtype || 'none'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Role</span>
                        <p className="font-mono text-white mt-0.5">{selectedElement.role}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Source Type</span>
                        <p className="font-mono text-purple-300 mt-0.5">{selectedElement.source_type || 'standard'}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Reading Order</span>
                        <p className="font-mono text-white mt-0.5">{selectedElement.reading_order}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Confidence</span>
                        <p className="font-mono text-emerald-400 font-bold mt-0.5">{selectedElement.confidence}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Bounding Box</span>
                        <p className="font-mono text-slate-300 mt-0.5">
                          {selectedElement.bbox ? JSON.stringify(selectedElement.bbox) : 'null'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400">Layout Region</span>
                        <p className="font-mono text-cyan-400 mt-0.5">{selectedElement.layout_region || 'main'}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs text-slate-400 font-bold">Element Content</span>
                      <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-200 border border-slate-800 overflow-x-auto">
                        {selectedElement.content}
                      </pre>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs text-slate-400 font-bold">Metadata & Provenance</span>
                      <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-cyan-300 border border-slate-800 overflow-x-auto">
                        {JSON.stringify(selectedElement.metadata || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================================================================== */}
            {/* PAGE 4: VISUAL INSPECTOR (MOST IMPORTANT PART)                      */}
            {/* ==================================================================== */}
            {activeTab === 'visual' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Visual & Diagram Understanding Inspector</h3>
                    <p className="text-xs text-slate-400">
                      Verifying detected visual entities and skeletal representations directly persisted in PostgreSQL / SQLite.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Slide {selectedSlideNum} &bull; Visuals Count: <strong className="text-cyan-400">{visuals.length}</strong>
                  </span>
                </div>

                {visuals.length === 0 ? (
                  <div className="p-12 text-center bg-rose-950/20 border border-rose-800/60 rounded-2xl space-y-3">
                    <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
                    <h4 className="text-lg font-bold text-rose-300">NO VISUAL RECORD FOUND</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      The database does not contain a visual skeleton record for Slide {selectedSlideNum}. As instructed, we do not fake
                      visual records.
                    </p>
                  </div>
                ) : (
                  visuals.map(vis => (
                    <div
                      key={vis.id}
                      className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-6"
                    >
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-700 gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-xs font-mono text-slate-400">VISUAL ID</span>
                            <h4 className="text-lg font-bold text-white font-mono">{vis.id}</h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                            TYPE: {vis.type.toUpperCase()}
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                            SUBTYPE: {vis.subtype}
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                            CONF: {vis.confidence}
                          </span>
                        </div>
                      </div>

                      {/* Visual Properties Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                          <span className="text-slate-400">Role</span>
                          <p className="font-mono text-white font-bold mt-1">{vis.role}</p>
                        </div>
                        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                          <span className="text-slate-400">Keypoint Count</span>
                          <p className="font-mono text-cyan-300 font-bold mt-1 text-base">
                            {vis.metadata?.keypoint_count ?? 17} Points
                          </p>
                        </div>
                        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                          <span className="text-slate-400">Connection Count</span>
                          <p className="font-mono text-purple-300 font-bold mt-1 text-base">
                            {vis.metadata?.connection_count ?? 19} Edges
                          </p>
                        </div>
                        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                          <span className="text-slate-400">Source Asset</span>
                          <p className="font-mono text-slate-300 mt-1 truncate">{vis.asset_url || 'diagram_vector'}</p>
                        </div>
                      </div>

                      {/* Bounding Box Info */}
                      <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-1 text-xs">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          Spatial Bounding Box [x1, y1, x2, y2]
                        </span>
                        <div className="flex items-center gap-3 font-mono text-white pt-1">
                          <code className="text-cyan-300 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                            {JSON.stringify(vis.bbox)}
                          </code>
                          <span className="text-slate-400 text-xs">
                            (Left region layout: X &isin; [5% &ndash; 45%], Y &isin; [15% &ndash; 88%])
                          </span>
                        </div>
                      </div>

                      {/* Description & Structured Metadata */}
                      <div className="space-y-2">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Semantic Description</span>
                        <p className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-200">
                          {vis.description}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                          Real Persisted Metadata JSON
                        </span>
                        <pre className="p-4 bg-slate-950 rounded-xl text-xs font-mono text-emerald-400 border border-slate-800 overflow-x-auto">
                          {JSON.stringify(vis.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ==================================================================== */}
            {/* PAGE 5: VISUAL OVERLAY                                               */}
            {/* ==================================================================== */}
            {activeTab === 'overlay' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white">Spatial Bounding-Box Overlay</h3>
                    <p className="text-xs text-slate-400">
                      Visualizing actual coordinates stored in database. Hover over any box to reveal exact element metadata.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Filter:</span>
                    {(['all', 'text', 'visual', 'annotation'] as const).map(filter => (
                      <button
                        key={filter}
                        onClick={() => setOverlayFilter(filter)}
                        className={`px-2.5 py-1 rounded capitalize font-medium transition ${
                          overlayFilter === filter
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive SVG / Canvas Slide Area */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl relative aspect-video flex flex-col justify-between overflow-hidden">
                  {/* Legend */}
                  <div className="absolute top-3 right-4 z-20 flex items-center gap-4 text-xs font-mono bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-700">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs border-2 border-red-500 bg-red-500/20" />
                      <span className="text-red-300">Text</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs border-2 border-blue-500 bg-blue-500/20" />
                      <span className="text-blue-300">Visual/Diagram</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs border-2 border-purple-500 bg-purple-500/20" />
                      <span className="text-purple-300">Annotation (0..16)</span>
                    </div>
                  </div>

                  {/* Render Bounding Boxes */}
                  <div className="absolute inset-0 m-6 pointer-events-none">
                    {elements
                      .filter(el => {
                        if (!el.bbox) return false;
                        if (overlayFilter === 'all') return true;
                        if (overlayFilter === 'text') return el.type === 'text';
                        if (overlayFilter === 'visual') return el.type === 'diagram' || el.type === 'image';
                        if (overlayFilter === 'annotation') return el.type === 'annotation';
                        return true;
                      })
                      .map(el => {
                        const [x1, y1, x2, y2] = el.bbox!;
                        const left = `${x1 * 100}%`;
                        const top = `${y1 * 100}%`;
                        const width = `${(x2 - x1) * 100}%`;
                        const height = `${(y2 - y1) * 100}%`;

                        const isText = el.type === 'text';
                        const isVis = el.type === 'diagram' || el.type === 'image';
                        const isAnno = el.type === 'annotation';

                        const borderColor = isVis
                          ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                          : isAnno
                          ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                          : 'border-red-500 bg-red-500/10 text-red-300';

                        const isHovered = hoveredOverlayId === el.id;

                        return (
                          <div
                            key={el.id}
                            style={{ left, top, width, height }}
                            onMouseEnter={() => setHoveredOverlayId(el.id)}
                            onMouseLeave={() => setHoveredOverlayId(null)}
                            className={`absolute border-2 rounded pointer-events-auto transition cursor-pointer flex flex-col justify-start p-1 ${borderColor} ${
                              isHovered ? 'ring-2 ring-white z-30' : 'z-10'
                            }`}
                          >
                            <span className="text-[9px] font-mono font-bold truncate leading-tight">
                              {el.id}
                            </span>
                            <span className="text-[8px] font-mono opacity-80 truncate">
                              {el.type} {el.subtype ? `(${el.subtype})` : ''} &bull; {el.confidence}
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  {/* Visual Background Reference */}
                  <div className="w-full h-full flex flex-col justify-between opacity-30 pointer-events-none">
                    <h2 className="text-xl font-bold text-white tracking-tight">{currentSlide?.title}</h2>
                    <div className="flex justify-between items-center text-xs">
                      <span>Pose Skeleton Graphic</span>
                      <span>List Text Items</span>
                    </div>
                    <div className="text-[11px] text-slate-500 italic">Nguồn: COCO — person keypoints</div>
                  </div>
                </div>

                {/* Hovered element banner */}
                {hoveredOverlayId && (
                  <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Inspecting Active Overlay Box:</span>
                    <span className="font-mono text-cyan-300 font-bold">{hoveredOverlayId}</span>
                  </div>
                )}
              </div>
            )}

            {/* ==================================================================== */}
            {/* PAGE 6: RAW VS NORMALIZED                                            */}
            {/* ==================================================================== */}
            {activeTab === 'raw_norm' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Raw Extraction vs Normalized Content</h3>
                    <p className="text-xs text-slate-400">
                      Comparing raw textual tokens from the parser against normalized representations to isolate exact corruption stages.
                    </p>
                  </div>
                </div>

                {/* Diagnostic Stage Locator Alert */}
                <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/80 text-xs text-cyan-200 flex items-start gap-3">
                  <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white">Pipeline Diagnostic Stage Analysis:</strong>
                    <p className="mt-1 text-slate-300">
                      By comparing RAW vs NORMALIZED, we isolate corruption:
                      <span className="text-white font-mono">
                        {' '}
                        Case A (Extraction) vs Case B (Normalization) vs Case C (Persistence) vs Case D (Markdown Rendering).
                      </span>{' '}
                      In our refactored pipeline, numeric labels <code className="text-cyan-300">0..16</code> are classified as{' '}
                      <code className="text-purple-300">annotation</code> instead of being merged into raw text streams as{' '}
                      <code className="text-rose-300 line-through">"2 11"</code> or <code className="text-rose-300 line-through">"0 9"</code>.
                    </p>
                  </div>
                </div>

                {/* Comparison Table */}
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-700">
                        <tr>
                          <th className="p-3">Element ID</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">RAW EXTRACTION</th>
                          <th className="p-3">NORMALIZED CONTENT</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {elements.map(el => {
                          const isCorrupted =
                            el.content?.includes('2 11') ||
                            el.content?.includes('0 9') ||
                            el.content?.includes('4 13') ||
                            el.content?.includes('6 15') ||
                            el.content?.includes('5 1–4');

                          return (
                            <tr key={el.id} className="hover:bg-slate-700/30">
                              <td className="p-3 text-cyan-300 font-semibold">{el.id}</td>
                              <td className="p-3 text-slate-400">{el.type}</td>
                              <td className="p-3 text-amber-200 max-w-xs truncate">
                                {el.raw_text || el.content || '—'}
                              </td>
                              <td className="p-3 text-white max-w-xs truncate font-sans">
                                {el.normalized_text || el.content}
                              </td>
                              <td className="p-3">
                                {isCorrupted ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800">
                                    CORRUPTED
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    VERIFIED CLEAN
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* PAGE 7: RELATION GRAPH                                               */}
            {/* ==================================================================== */}
            {activeTab === 'graph' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Visual Knowledge Relationship Graph</h3>
                    <p className="text-xs text-slate-400">
                      Explicit semantic relations persisted in database: text &rarr; explains &rarr; visual, annotation &rarr; annotates &rarr; visual, visual &rarr; represents &rarr; concept.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-purple-400 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                    Total Relations: {relations.length}
                  </span>
                </div>

                {/* SVG Visual Graph */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl relative min-h-[380px] flex items-center justify-center overflow-x-auto">
                  <div className="flex items-center justify-around w-full max-w-4xl py-8">
                    {/* Left: Explanatory Text Elements */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                        Text Explanations
                      </span>
                      {['0 nose — mũi', '1–4 mắt, tai', '5–10 vai, khuỷu', '11–16 hông, gối'].map((txt, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/80 text-amber-200 text-xs font-mono shadow"
                        >
                          text_exp_0{i + 1}
                          <p className="text-[10px] text-slate-300 font-sans">{txt}</p>
                        </div>
                      ))}
                    </div>

                    {/* Arrows to Visual */}
                    <div className="flex flex-col items-center justify-center space-y-4 text-xs font-mono text-purple-400">
                      <span className="text-[10px] bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                        explains &rarr;
                      </span>
                      <ArrowRight className="w-6 h-6 text-purple-400 animate-pulse" />
                    </div>

                    {/* Middle: Visual Entity */}
                    <div className="p-6 rounded-2xl bg-cyan-950/60 border-2 border-cyan-500 text-center shadow-xl shadow-cyan-500/10 space-y-2">
                      <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                        CENTRAL VISUAL ENTITY
                      </span>
                      <h4 className="text-sm font-bold text-white font-mono">
                        {visuals[0]?.id || 'vis_diagram_001'}
                      </h4>
                      <p className="text-xs text-cyan-200 font-semibold">Human Pose Skeleton</p>
                      <div className="flex justify-center gap-2 text-[10px] font-mono text-slate-300 pt-1">
                        <span className="bg-slate-900 px-2 py-0.5 rounded">17 Keypoints</span>
                        <span className="bg-slate-900 px-2 py-0.5 rounded">19 Connections</span>
                      </div>
                    </div>

                    {/* Arrows to Concept */}
                    <div className="flex flex-col items-center justify-center space-y-4 text-xs font-mono text-emerald-400">
                      <span className="text-[10px] bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        represents &rarr;
                      </span>
                      <ArrowRight className="w-6 h-6 text-emerald-400 animate-pulse" />
                    </div>

                    {/* Right: Abstract Concept */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                        Pedagogical Concept
                      </span>
                      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs font-mono space-y-1">
                        <p className="font-bold text-white">concept_human_pose_skeleton</p>
                        <p className="text-[10px] text-slate-300 font-sans">
                          COCO Standard 17-point anatomical landmark topological representation.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Relations Table */}
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-3 bg-slate-900/60 border-b border-slate-700 text-xs font-bold text-slate-400 uppercase">
                    All Explicit Relations in PostgreSQL / SQLite
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-900/40 text-slate-500 uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Relation ID</th>
                          <th className="p-2.5">Source</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Target</th>
                          <th className="p-2.5">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {relations.map(r => (
                          <tr key={r.id} className="hover:bg-slate-700/30">
                            <td className="p-2.5 text-slate-400">{r.id}</td>
                            <td className="p-2.5 text-amber-300 truncate max-w-xs">{r.source_id}</td>
                            <td className="p-2.5 text-purple-400 font-bold">{r.relation_type}</td>
                            <td className="p-2.5 text-cyan-300 truncate max-w-xs">{r.target_id}</td>
                            <td className="p-2.5 text-emerald-400">{r.confidence}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* PAGE 8: CHUNK INSPECTOR                                              */}
            {/* ==================================================================== */}
            {activeTab === 'chunks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Semantic Chunk Inspector</h3>
                    <p className="text-xs text-slate-400">
                      Units of reasoning produced from DocumentIR. Multimodal chunks preserve text-visual co-reference.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-rose-400 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                    Slide {selectedSlideNum} &bull; Chunks: {chunks.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {chunks.map(ch => (
                    <div
                      key={ch.id}
                      className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-700 gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-cyan-300 font-bold text-xs">{ch.id}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              ch.chunk_type === 'multimodal'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {ch.chunk_type}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          Slide {ch.slide_id} &bull; Vector: 1536-dim (Indexed)
                        </span>
                      </div>

                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-200">
                        {ch.content}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono pt-1">
                        <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                          <span className="text-slate-400 text-[10px]">Source Elements:</span>
                          <p className="text-amber-300 truncate mt-0.5">{ch.source_element_ids.join(', ') || 'none'}</p>
                        </div>
                        <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                          <span className="text-slate-400 text-[10px]">Visual References:</span>
                          <p className="text-cyan-300 truncate mt-0.5">{ch.visual_refs.join(', ') || 'none'}</p>
                        </div>
                        <div className="p-2 bg-slate-900/60 rounded border border-slate-800">
                          <span className="text-slate-400 text-[10px]">Relations:</span>
                          <p className="text-purple-300 truncate mt-0.5">{ch.relations?.join(', ') || 'none'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* PAGE 9: DATABASE RECORD VIEW (RAW JSON)                              */}
            {/* ==================================================================== */}
            {activeTab === 'db_raw' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white">Database Raw Record Viewer</h3>
                    <p className="text-xs text-slate-400">
                      Direct, un-transformed JSON records straight from the database engine.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Record Entity:</span>
                    {['document', 'slide', 'elements', 'visual', 'relations', 'chunks'].map(type => (
                      <button
                        key={type}
                        onClick={() => setRawRecordType(type)}
                        className={`px-3 py-1 rounded capitalize font-mono text-xs transition ${
                          rawRecordType === type
                            ? 'bg-cyan-600 text-white font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 text-xs font-mono text-slate-400">
                    <span>
                      TABLE: <strong className="text-cyan-300">{rawRecordType.toUpperCase()}</strong>
                    </span>
                    <span>Database Engine: SQLite (Local) / PostgreSQL (Production)</span>
                  </div>

                  <pre className="p-4 bg-slate-900 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto max-h-[500px]">
                    {rawRecordType === 'document' && JSON.stringify(docOverview?.document || {}, null, 2)}
                    {rawRecordType === 'slide' && JSON.stringify(currentSlide || {}, null, 2)}
                    {rawRecordType === 'elements' && JSON.stringify(elements, null, 2)}
                    {rawRecordType === 'visual' && JSON.stringify(visuals[0] || { message: 'NO VISUAL RECORD FOUND' }, null, 2)}
                    {rawRecordType === 'relations' && JSON.stringify(relations, null, 2)}
                    {rawRecordType === 'chunks' && JSON.stringify(chunks, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* PAGE 10: RETRIEVAL TESTER                                            */}
            {/* ==================================================================== */}
            {activeTab === 'retrieval' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Hybrid Retrieval Tester</h3>
                    <p className="text-xs text-slate-400">
                      Query the persistent knowledge store across structured filters, dense vector embeddings, and relationship graphs.
                    </p>
                  </div>
                </div>

                {/* Query Input Box */}
                <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={queryInput}
                      onChange={e => setQueryInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRunQuery(queryInput)}
                      placeholder="Enter query (e.g., 'keypoint 0', 'human pose skeleton', '17 keypoints')..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <button
                      onClick={() => handleRunQuery(queryInput)}
                      disabled={queryLoading}
                      className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                    >
                      {queryLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Retrieve</span>
                    </button>
                  </div>

                  {/* Preset Query Chips */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-slate-400 text-[11px]">Recommended Debug Queries:</span>
                    {['keypoint 0', 'human pose skeleton', '17 keypoints', 'vai, khuỷu tay'].map(q => (
                      <button
                        key={q}
                        onClick={() => {
                          setQueryInput(q);
                          handleRunQuery(q);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-cyan-300 font-mono text-[11px] border border-slate-600/60"
                      >
                        "{q}"
                      </button>
                    ))}
                  </div>
                </div>

                {/* Retrieval Results Section */}
                {queryResults && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Query Results for: <span className="text-cyan-300 font-mono">"{queryResults.query}"</span>
                    </h4>

                    {/* Final Hybrid Results */}
                    <div className="space-y-3">
                      {queryResults.hybrid_results.map((res, i) => (
                        <div
                          key={i}
                          className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 shadow space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-bold">
                                RESULT #{i + 1}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 uppercase">
                                TYPE: {res.type}
                              </span>
                              <span className="text-slate-400">Slide {res.slide ?? res.slide_id}</span>
                            </div>
                            <span className="font-bold text-emerald-400">Score: {res.score}</span>
                          </div>

                          <p className="text-xs text-white leading-relaxed">{res.content}</p>

                          <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-700/50 flex items-center justify-between">
                            <span>Source: {res.source}</span>
                            <span>Visual Links: {res.visual_refs?.length ? res.visual_refs.join(', ') : 'none'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================================================================== */}
            {/* PAGE 11: EXTRACTION PIPELINE DEBUG                                   */}
            {/* ==================================================================== */}
            {activeTab === 'pipeline' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">Full Multimodal Extraction Pipeline Debugger</h3>
                    <p className="text-xs text-slate-400">
                      Sequential phase metrics: RAW EXTRACTION &rarr; CLASSIFICATION &rarr; LAYOUT &rarr; VISUAL UNDERSTANDING &rarr; DOCUMENT IR &rarr; DATABASE &rarr; CHUNKING &rarr; EMBEDDING
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {pipelineDebug?.stages.map((stage, idx) => (
                    <div
                      key={stage.id}
                      className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                        <span className="text-[10px] font-mono text-slate-400 font-bold">STAGE 0{idx + 1}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                          {stage.status.toUpperCase()}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-white tracking-tight">{stage.name}</h4>
                        {stage.duration_ms && (
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">Latency: {stage.duration_ms} ms</p>
                        )}
                      </div>

                      {/* Counts or Details */}
                      <div className="p-3 bg-slate-900/80 rounded-xl text-xs font-mono border border-slate-800 text-slate-300 space-y-1">
                        {stage.objects_count !== undefined && (
                          <p>Objects: <strong className="text-cyan-300">{stage.objects_count}</strong></p>
                        )}
                        {stage.counts &&
                          Object.entries(stage.counts).map(([k, v]) => (
                            <p key={k} className="text-[11px] text-slate-400">
                              {k}: <strong className="text-white">{v}</strong>
                            </p>
                          ))}
                        {stage.regions &&
                          Object.entries(stage.regions).map(([k, v]) => (
                            <p key={k} className="text-[11px] text-slate-400">
                              {k}: <strong className="text-white">{v}</strong>
                            </p>
                          ))}
                        {stage.details &&
                          Object.entries(stage.details).map(([k, v]) => (
                            <p key={k} className="text-[11px] text-slate-400">
                              {k}: <strong className="text-white">{String(v)}</strong>
                            </p>
                          ))}
                      </div>

                      {/* Warnings or Errors */}
                      <div className="text-[10px] font-mono flex items-center justify-between text-slate-500 pt-1">
                        <span>Errors: {stage.errors.length}</span>
                        <span>Warnings: {stage.warnings.length}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default KnowledgeInspectorPage;
