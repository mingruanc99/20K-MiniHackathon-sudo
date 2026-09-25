// src/components/pipeline/RelationalDatabaseViewer.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Layers,
  Image as ImageIcon,
  FileText,
  BarChart3,
  Table as TableIcon,
  Tag,
  GitFork,
  CheckCircle2,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  Info,
  Maximize2,
  ChevronRight,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import {
  knowledgeService,
  DocumentOverview,
  InspectorSlide,
  InspectorElement,
  InspectorVisual,
  InspectorRelation,
  InspectorChunk
} from '../../services/knowledgeService';

interface RelationalDatabaseViewerProps {
  documentId?: string;
  className?: string;
}

export type EntityCategory = 'all' | 'content' | 'image' | 'diagram' | 'table' | 'annotation';

export const RelationalDatabaseViewer: React.FC<RelationalDatabaseViewerProps> = ({
  documentId = 'doc_pose_estimation_v1',
  className = ''
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [overview, setOverview] = useState<DocumentOverview | null>(null);
  const [slides, setSlides] = useState<InspectorSlide[]>([]);
  const [activeSlideNum, setActiveSlideNum] = useState<number>(1);
  const [elements, setElements] = useState<InspectorElement[]>([]);
  const [visuals, setVisuals] = useState<InspectorVisual[]>([]);
  const [relations, setRelations] = useState<InspectorRelation[]>([]);
  const [chunks, setChunks] = useState<InspectorChunk[]>([]);
  
  // Filtering & Selection
  const [categoryFilter, setCategoryFilter] = useState<EntityCategory>('all');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'spatial' | 'table' | 'relations'>('spatial');

  // Load data for document and initial slide
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      try {
        const [ov, sList] = await Promise.all([
          knowledgeService.getOverview(documentId),
          knowledgeService.getSlides(documentId)
        ]);
        if (!mounted) return;
        setOverview(ov);
        setSlides(sList);
        if (sList.length > 0) {
          const firstSlideNum = sList[0].slide_number;
          setActiveSlideNum(firstSlideNum);
          await loadSlideData(firstSlideNum);
        }
      } catch (err) {
        console.error('Failed to load database visualizer data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, [documentId]);

  const loadSlideData = async (slideNum: number) => {
    try {
      const [el, vis, rel, ch] = await Promise.all([
        knowledgeService.getElements(slideNum),
        knowledgeService.getVisuals(slideNum),
        knowledgeService.getRelations(slideNum),
        knowledgeService.getChunks(slideNum)
      ]);
      setElements(el);
      setVisuals(vis);
      setRelations(rel);
      setChunks(ch);
      // Default selection to first visual if exists, otherwise first element
      if (vis.length > 0) {
        setSelectedEntityId(vis[0].id);
      } else if (el.length > 0) {
        setSelectedEntityId(el[0].id);
      } else {
        setSelectedEntityId(null);
      }
    } catch (err) {
      console.warn('Error loading slide elements:', err);
    }
  };

  const handleSelectSlide = (slideNum: number) => {
    setActiveSlideNum(slideNum);
    loadSlideData(slideNum);
  };

  // Categorize elements into:
  // 1. 'content' (Nội dung: headings, paragraphs, definitions, lists)
  // 2. 'image' (Ảnh: photos, screenshots, static artwork)
  // 3. 'diagram' (Biểu đồ: pose diagrams, flowcharts, architectures)
  // 4. 'table' (Bảng: tables, matrices)
  // 5. 'annotation' (Chú thích: keypoints, labels, markers)
  const getCategoryOf = (el: InspectorElement | InspectorVisual): EntityCategory => {
    const rawType = (el.type || '').toLowerCase();
    const role = ((el as any).role || '').toLowerCase();
    const subtype = ((el as any).subtype || '').toLowerCase();

    if (rawType === 'annotation' || rawType === 'visual_annotation' || role === 'annotation' || subtype === 'keypoint') {
      return 'annotation';
    }
    if (rawType === 'diagram' || subtype.includes('diagram') || subtype.includes('skeleton') || subtype.includes('chart') || subtype.includes('flowchart') || role.includes('diagram')) {
      return 'diagram';
    }
    if (rawType === 'image' || rawType === 'photo' || subtype.includes('photo') || subtype.includes('image')) {
      return 'image';
    }
    if (rawType === 'table' || subtype.includes('table')) {
      return 'table';
    }
    return 'content';
  };

  // Grouped counts for badges
  const categoryCounts = useMemo(() => {
    const counts = {
      all: elements.length + visuals.length,
      content: 0,
      image: 0,
      diagram: 0,
      table: 0,
      annotation: 0
    };

    visuals.forEach((v) => {
      const cat = getCategoryOf(v);
      counts[cat]++;
    });

    elements.forEach((e) => {
      const cat = getCategoryOf(e);
      counts[cat]++;
    });

    return counts;
  }, [elements, visuals]);

  // Unified entity representation for visualizer
  interface UnifiedEntity {
    id: string;
    sourceTable: 'document_elements' | 'visual_entities';
    category: EntityCategory;
    categoryLabel: string;
    type: string;
    subtype?: string;
    role: string;
    content: string;
    bbox?: [number, number, number, number] | null;
    confidence: number;
    layoutRegion?: string;
    metadata?: any;
    raw: InspectorElement | InspectorVisual;
  }

  const unifiedEntities: UnifiedEntity[] = useMemo(() => {
    const list: UnifiedEntity[] = [];

    // Add visuals (Biểu đồ / Diagram hoặc Ảnh / Image)
    visuals.forEach((v) => {
      const cat = getCategoryOf(v);
      list.push({
        id: v.id,
        sourceTable: 'visual_entities',
        category: cat,
        categoryLabel: cat === 'diagram' ? 'Biểu đồ / Diagram' : cat === 'image' ? 'Ảnh / Image' : 'Thị giác',
        type: v.type,
        subtype: v.subtype,
        role: v.role,
        content: v.description,
        bbox: v.bbox,
        confidence: v.confidence,
        layoutRegion: 'visual_container',
        metadata: v.metadata,
        raw: v
      });
    });

    // Add elements (Nội dung văn bản, bảng, hoặc chú thích số)
    elements.forEach((e) => {
      const cat = getCategoryOf(e);
      list.push({
        id: e.id,
        sourceTable: 'document_elements',
        category: cat,
        categoryLabel:
          cat === 'annotation'
            ? 'Chú thích / Marker'
            : cat === 'table'
            ? 'Bảng / Table'
            : 'Nội dung / Text',
        type: e.type,
        subtype: e.subtype,
        role: e.role,
        content: e.content,
        bbox: e.bbox,
        confidence: e.confidence,
        layoutRegion: e.layout_region,
        metadata: e.metadata,
        raw: e
      });
    });

    return list;
  }, [elements, visuals]);

  // Filtered by category
  const filteredEntities = useMemo(() => {
    if (categoryFilter === 'all') return unifiedEntities;
    return unifiedEntities.filter((u) => u.category === categoryFilter);
  }, [unifiedEntities, categoryFilter]);

  // Selected Entity Details
  const selectedEntity = useMemo(() => {
    return unifiedEntities.find((u) => u.id === selectedEntityId) || null;
  }, [unifiedEntities, selectedEntityId]);

  // Linked relations for selected entity
  const relatedLinks = useMemo(() => {
    if (!selectedEntityId) return [];
    return relations.filter(
      (r) => r.source_id === selectedEntityId || r.target_id === selectedEntityId
    );
  }, [relations, selectedEntityId]);

  // Visual styling helpers based on Category
  const getCategoryTheme = (cat: EntityCategory) => {
    switch (cat) {
      case 'diagram':
        return {
          bg: 'bg-paper-band',
          border: 'border-rule-strong',
          hoverBorder: 'hover:border-print',
          text: 'text-print',
          badgeBg: 'bg-print',
          badgeText: 'text-white',
          icon: BarChart3,
          label: 'Biểu đồ (Diagram)'
        };
      case 'image':
        return {
          bg: 'bg-paper-band',
          border: 'border-rule-strong',
          hoverBorder: 'hover:border-print',
          text: 'text-print',
          badgeBg: 'bg-cover',
          badgeText: 'text-white',
          icon: ImageIcon,
          label: 'Ảnh (Image)'
        };
      case 'annotation':
        return {
          bg: 'bg-pen-soft',
          border: 'border-pen-line',
          hoverBorder: 'hover:border-pen',
          text: 'text-pen',
          badgeBg: 'bg-pen',
          badgeText: 'text-white',
          icon: Tag,
          label: 'Chú thích (Annotation)'
        };
      case 'table':
        return {
          bg: 'bg-pen-soft',
          border: 'border-pen-line',
          hoverBorder: 'hover:border-pen',
          text: 'text-pen',
          badgeBg: 'bg-pen',
          badgeText: 'text-white',
          icon: TableIcon,
          label: 'Bảng (Table)'
        };
      default: // content
        return {
          bg: 'bg-paper-band',
          border: 'border-rule-strong',
          hoverBorder: 'hover:border-print',
          text: 'text-print',
          badgeBg: 'bg-cover',
          badgeText: 'text-white',
          icon: FileText,
          label: 'Nội dung (Text Content)'
        };
    }
  };

  if (loading) {
    return (
      <div className={`p-8 bg-paper-sheet rounded-2xl border border-rule text-center ${className}`}>
        <RefreshCw className="w-8 h-8 text-print animate-spin mx-auto mb-2" />
        <p className="text-xs text-ink-faint font-medium">Đang tải cấu trúc Database Quan hệ Đa phương thức...</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Banner: Relational DB Inspector Overview */}
      <div className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-rule">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-paper-band border border-rule-strong text-print text-xs font-bold uppercase tracking-wider font-mono">
                <Database className="w-3.5 h-3.5" />
                Relational Knowledge Database
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-paper-band text-print border border-rule-strong font-semibold">
                Multimodal Entities Ready
              </span>
            </div>
            <h2 className="text-lg font-bold text-ink">
              Trực Quan Hoá Database Quan Hệ (Phân Biệt Ảnh • Biểu Đồ • Nội Dung • Chú Thích)
            </h2>
            <p className="text-xs text-ink-faint mt-1 max-w-3xl leading-relaxed">
              Dữ liệu được bóc tách và lưu trữ trong các bảng quan hệ <code className="font-mono text-print font-semibold">document_elements</code>, <code className="font-mono text-print font-semibold">visual_entities</code> và <code className="font-mono text-print font-semibold">element_relations</code>. Không còn tình trạng chú thích biểu đồ bị coi là văn bản rời rạc!
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 shrink-0 text-center">
            <div className="p-2.5 rounded-xl bg-paper-band border border-rule">
              <div className="text-[11px] font-medium text-ink-faint uppercase">Slides</div>
              <div className="text-base font-extrabold text-ink font-mono">{overview?.stats.slides || slides.length}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-paper-band border border-rule-strong">
              <div className="text-[11px] font-medium text-print uppercase">Nội dung</div>
              <div className="text-base font-extrabold text-print font-mono">{categoryCounts.content}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-paper-band border border-rule-strong">
              <div className="text-[11px] font-medium text-print uppercase">Biểu đồ</div>
              <div className="text-base font-extrabold text-print font-mono">{categoryCounts.diagram}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-paper-band border border-rule-strong">
              <div className="text-[11px] font-medium text-print uppercase">Ảnh</div>
              <div className="text-base font-extrabold text-print font-mono">{categoryCounts.image}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-pen-soft border border-pen-line">
              <div className="text-[11px] font-medium text-pen uppercase">Chú thích</div>
              <div className="text-base font-extrabold text-pen font-mono">{categoryCounts.annotation}</div>
            </div>
          </div>
        </div>

        {/* Slide Selection Bar */}
        <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink-soft flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-ink-faint" />
              Chọn Slide:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-xl py-1">
              {slides.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSlide(s.slide_number)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition shrink-0 ${
                    activeSlideNum === s.slide_number
                      ? 'bg-cover text-white shadow-xs'
                      : 'bg-paper-band hover:bg-rule text-ink-soft'
                  }`}
                >
                  #{s.slide_number}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-paper-band p-1 rounded-xl gap-1">
            <button
              onClick={() => setViewMode('spatial')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                viewMode === 'spatial' ? 'bg-paper-sheet shadow-xs text-print' : 'text-ink-soft hover:text-ink'
              }`}
            >
              2D Layout Spatial
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                viewMode === 'table' ? 'bg-paper-sheet shadow-xs text-print' : 'text-ink-soft hover:text-ink'
              }`}
            >
              Bảng Dữ Liệu SQL
            </button>
            <button
              onClick={() => setViewMode('relations')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                viewMode === 'relations' ? 'bg-paper-sheet shadow-xs text-print' : 'text-ink-soft hover:text-ink'
              }`}
            >
              Mạng Lưới Quan Hệ ({relations.length})
            </button>
          </div>
        </div>
      </div>

      {/* Multimodal Entity Type Filter Chips */}
      <div className="flex items-center flex-wrap gap-2">
        <span className="text-xs font-bold text-ink-soft uppercase tracking-wider flex items-center gap-1 mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5 text-ink-faint" />
          Bộ lọc thực thể:
        </span>

        <button
          onClick={() => setCategoryFilter('all')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
            categoryFilter === 'all'
              ? 'bg-cover-deep text-white border-cover-deep shadow-xs'
              : 'bg-paper-sheet text-ink-soft border-rule hover:bg-paper-band'
          }`}
        >
          <span>Tất cả</span>
          <span className="px-1.5 py-0.2 rounded-md bg-paper-sheet text-[11px] font-mono">{categoryCounts.all}</span>
        </button>

        {/* Nội dung */}
        <button
          onClick={() => setCategoryFilter('content')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
            categoryFilter === 'content'
              ? 'bg-cover text-white border-print shadow-xs'
              : 'bg-paper-sheet text-print border-rule-strong hover:bg-paper-band'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>📝 Nội dung (Text)</span>
          <span className="px-1.5 py-0.2 rounded-md bg-paper-band text-print text-[11px] font-mono font-bold">
            {categoryCounts.content}
          </span>
        </button>

        {/* Biểu đồ / Diagram */}
        <button
          onClick={() => setCategoryFilter('diagram')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
            categoryFilter === 'diagram'
              ? 'bg-print text-white border-print shadow-xs'
              : 'bg-paper-sheet text-print border-rule-strong hover:bg-paper-band'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>📊 Biểu đồ (Diagram)</span>
          <span className="px-1.5 py-0.2 rounded-md bg-paper-band text-print text-[11px] font-mono font-bold">
            {categoryCounts.diagram}
          </span>
        </button>

        {/* Ảnh / Image */}
        <button
          onClick={() => setCategoryFilter('image')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
            categoryFilter === 'image'
              ? 'bg-cover text-white border-print shadow-xs'
              : 'bg-paper-sheet text-print border-rule-strong hover:bg-paper-band'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>🖼️ Ảnh (Image)</span>
          <span className="px-1.5 py-0.2 rounded-md bg-paper-band text-print text-[11px] font-mono font-bold">
            {categoryCounts.image}
          </span>
        </button>

        {/* Bảng / Table */}
        <button
          onClick={() => setCategoryFilter('table')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
            categoryFilter === 'table'
              ? 'bg-pen text-white border-pen shadow-xs'
              : 'bg-paper-sheet text-pen border-pen-line hover:bg-pen-soft'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span>📑 Bảng (Table)</span>
          <span className="px-1.5 py-0.2 rounded-md bg-pen-soft text-pen text-[11px] font-mono font-bold">
            {categoryCounts.table}
          </span>
        </button>

        {/* Chú thích / Annotation */}
        <button
          onClick={() => setCategoryFilter('annotation')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
            categoryFilter === 'annotation'
              ? 'bg-pen text-white border-pen shadow-xs'
              : 'bg-paper-sheet text-pen border-pen-line hover:bg-pen-soft'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>🏷️ Chú thích biểu đồ (Keypoints)</span>
          <span className="px-1.5 py-0.2 rounded-md bg-pen-soft text-pen text-[11px] font-mono font-bold">
            {categoryCounts.annotation}
          </span>
        </button>
      </div>

      {/* Main Interactive Stage Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Spatial View or Table View */}
        <div className="lg:col-span-8 space-y-4">
          {viewMode === 'spatial' && (
            <div className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-print" />
                  <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                    Không Gian Bố Cục Slide (16:9 2D Canvas)
                  </h3>
                </div>
                <span className="text-xs text-ink-faint">
                  Click vào từng hộp để kiểm tra thuộc tính DB
                </span>
              </div>

              {/* 16:9 Canvas Simulator */}
              <div className="relative w-full aspect-video  bg-cover   rounded-xl overflow-hidden border border-cover-deep shadow-inner p-4">
                {/* Background grid lines */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

                {/* Render Bounding Boxes */}
                {filteredEntities.map((ent) => {
                  const isSelected = selectedEntityId === ent.id;
                  const theme = getCategoryTheme(ent.category);
                  const Icon = theme.icon;

                  // Normalize bbox [ymin, xmin, ymax, xmax] in 0..1000
                  const bbox = ent.bbox || [100, 100, 400, 400];
                  const [ymin, xmin, ymax, xmax] = bbox;
                  const topPct = (ymin / 1000) * 100;
                  const leftPct = (xmin / 1000) * 100;
                  const widthPct = Math.max(((xmax - xmin) / 1000) * 100, 6);
                  const heightPct = Math.max(((ymax - ymin) / 1000) * 100, 5);

                  // Distinct color styling for each type on the dark canvas
                  let borderColor = 'border-rule-strong';
                  let bgColor = 'bg-print/20';
                  let labelColor = 'bg-cover text-white';

                  if (ent.category === 'diagram') {
                    borderColor = 'border-print';
                    bgColor = 'bg-print/25';
                    labelColor = 'bg-print text-white';
                  } else if (ent.category === 'image') {
                    borderColor = 'border-rule-strong';
                    bgColor = 'bg-print/25';
                    labelColor = 'bg-cover text-white';
                  } else if (ent.category === 'annotation') {
                    borderColor = 'border-pen';
                    bgColor = 'bg-pen/30';
                    labelColor = 'bg-pen text-white';
                  } else if (ent.category === 'table') {
                    borderColor = 'border-pen';
                    bgColor = 'bg-pen/25';
                    labelColor = 'bg-pen text-white';
                  }

                  return (
                    <div
                      key={ent.id}
                      onClick={() => setSelectedEntityId(ent.id)}
                      style={{
                        top: `${topPct}%`,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`
                      }}
                      className={`absolute cursor-pointer rounded-lg border-2 transition-all p-1 flex flex-col justify-between select-none ${
                        isSelected
                          ? 'border-white ring-4 ring-rule-strong/50 z-30 scale-[1.02]'
                          : `${borderColor} ${bgColor} hover:brightness-125 z-10 opacity-90`
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 overflow-hidden">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold shrink-0 truncate ${labelColor}`}>
                          {ent.category === 'diagram' ? 'BIỂU ĐỒ' : ent.category === 'image' ? 'ẢNH' : ent.category === 'annotation' ? 'CHÚ THÍCH' : 'TEXT'}
                        </span>
                        <span className="text-[11px] text-white/80 font-mono truncate">
                          {ent.id}
                        </span>
                      </div>
                      <div className="text-[11px] text-white font-medium truncate mt-0.5 drop-shadow">
                        {ent.content}
                      </div>
                    </div>
                  );
                })}

                {/* Watermark / Canvas legend */}
                <div className="absolute bottom-2 right-3 pointer-events-none text-[11px] font-mono text-white/50 bg-cover-deep px-2 py-0.5 rounded">
                  Slide #{activeSlideNum} Canvas (16:9)
                </div>
              </div>

              {/* Quick Legend under canvas */}
              <div className="mt-3 flex items-center justify-between text-xs text-ink-faint flex-wrap gap-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-print border border-rule-strong" />
                    <span>Nội dung Text</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-print border border-print" />
                    <span className="font-semibold text-print">Biểu đồ / Diagram</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-print border border-rule-strong" />
                    <span>Ảnh / Image</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-pen border border-pen" />
                    <span className="font-semibold text-pen">Chú thích (Annotation)</span>
                  </div>
                </div>
                <span className="font-mono text-xs text-ink-faint">
                  Hiển thị {filteredEntities.length} thực thể
                </span>
              </div>
            </div>
          )}

          {viewMode === 'table' && (
            <div className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-print" />
                  Dữ Liệu Bản Ghi Quan Hệ (SQL Rows)
                </h3>
                <span className="text-xs text-ink-faint">Tổng: {filteredEntities.length} hàng</span>
              </div>

              <div className="overflow-x-auto border border-rule rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-paper-band border-b border-rule text-ink-soft font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Entity ID</th>
                      <th className="py-2.5 px-3">Bảng Nguồn</th>
                      <th className="py-2.5 px-3">Phân Loại Đa Phương Thức</th>
                      <th className="py-2.5 px-3">Role / Vai Trò</th>
                      <th className="py-2.5 px-3">Độ Tin Cậy</th>
                      <th className="py-2.5 px-3">Nội Dung / Mô Tả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule font-mono">
                    {filteredEntities.map((ent) => {
                      const isSelected = selectedEntityId === ent.id;
                      const theme = getCategoryTheme(ent.category);
                      return (
                        <tr
                          key={ent.id}
                          onClick={() => setSelectedEntityId(ent.id)}
                          className={`cursor-pointer transition ${
                            isSelected ? 'bg-paper-band font-bold' : 'hover:bg-paper-band'
                          }`}
                        >
                          <td className="py-2 px-3 text-print font-semibold">{ent.id}</td>
                          <td className="py-2 px-3 text-ink-faint">{ent.sourceTable}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${theme.badgeBg} ${theme.badgeText}`}>
                              {ent.categoryLabel}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-ink-soft">{ent.role}</td>
                          <td className="py-2 px-3 text-ink">
                            {(ent.confidence * 100).toFixed(0)}%
                          </td>
                          <td className="py-2 px-3 font-sans text-ink truncate max-w-xs">
                            {ent.content}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode === 'relations' && (
            <div className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <GitFork className="w-4 h-4 text-print" />
                  Mạng Lưới Quan Hệ (Semantic & Visual Relations)
                </h3>
                <span className="text-xs text-ink-faint">{relations.length} liên kết quan hệ</span>
              </div>

              <div className="space-y-2">
                {relations.map((rel) => {
                  const isLinkedToSelected =
                    rel.source_id === selectedEntityId || rel.target_id === selectedEntityId;
                  return (
                    <div
                      key={rel.id}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-4 transition ${
                        isLinkedToSelected
                          ? 'bg-paper-band border-rule-strong ring-2 ring-rule-strong'
                          : 'bg-paper-band border-rule hover:border-rule-strong'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-ink">{rel.source_id}</span>
                        <span className="px-2 py-0.5 rounded bg-paper-band text-print font-bold uppercase text-[11px] flex items-center gap-1">
                          <ArrowRightIcon />
                          {rel.relation_type}
                        </span>
                        <span className="font-bold text-print">{rel.target_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-ink-faint">
                          Độ tin cậy: {(rel.confidence * 100).toFixed(0)}%
                        </span>
                        <span className="text-[11px] font-mono text-ink-faint px-1.5 py-0.5 rounded bg-paper-sheet border border-rule">
                          {rel.id}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* List of Entities on Slide */}
          <div className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider mb-3">
              Danh Sách Thực Thể Đã Phân Biệt Trên Slide #{activeSlideNum} ({filteredEntities.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredEntities.map((ent) => {
                const isSelected = selectedEntityId === ent.id;
                const theme = getCategoryTheme(ent.category);
                const Icon = theme.icon;

                return (
                  <div
                    key={ent.id}
                    onClick={() => setSelectedEntityId(ent.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition text-xs flex flex-col justify-between ${
                      isSelected
                        ? `${theme.bg} ${theme.border} ring-2 ring-rule-strong/40 shadow-xs`
                        : `bg-paper-band border-rule ${theme.hoverBorder}`
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${theme.badgeBg} ${theme.badgeText}`}>
                          <Icon className="w-3 h-3" />
                          {ent.categoryLabel}
                        </span>
                        <span className="font-mono text-[11px] text-ink-faint font-semibold">{ent.id}</span>
                      </div>
                      <p className="text-ink font-medium line-clamp-2 leading-relaxed">
                        {ent.content}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-rule/60 flex items-center justify-between text-[11px] font-mono text-ink-faint">
                      <span>Role: {ent.role}</span>
                      <span>BBox: [{ent.bbox ? ent.bbox.join(',') : 'N/A'}]</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Detailed Entity Inspector & Relations */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected Entity Inspector Card */}
          <div className="bg-paper-sheet border border-rule rounded-2xl p-5 shadow-xs sticky top-4">
            <div className="flex items-center justify-between pb-3 border-b border-rule mb-3">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-4 h-4 text-print" />
                Chi Tiết Bản Ghi Database
              </h3>
              {selectedEntity && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-paper-band text-print font-bold border border-rule-strong">
                  {selectedEntity.sourceTable}
                </span>
              )}
            </div>

            {selectedEntity ? (
              <div className="space-y-3.5 text-xs">
                {/* Type & Status Header */}
                {(() => {
                  const theme = getCategoryTheme(selectedEntity.category);
                  const Icon = theme.icon;
                  return (
                    <div className={`p-3 rounded-xl border ${theme.bg} ${theme.border} space-y-1.5`}>
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${theme.badgeBg} ${theme.badgeText}`}>
                          <Icon className="w-3 h-3" />
                          {theme.label}
                        </span>
                        <span className="font-mono text-xs font-bold text-ink-soft">
                          {selectedEntity.id}
                        </span>
                      </div>
                      <div className="text-xs text-ink-soft">
                        {selectedEntity.category === 'diagram' && (
                          <span className="text-print font-medium">
                            ✓ Đã nhận diện cấu trúc đồ hoạ đa điểm (Pose Skeleton Diagram). Các số 0..16 được liên kết làm chú thích, không bị tách thành văn bản rời rạc.
                          </span>
                        )}
                        {selectedEntity.category === 'annotation' && (
                          <span className="text-pen font-medium">
                            ✓ Chú thích visual marker được lưu với vai trò <code className="font-mono">annotation</code> và liên kết tới sơ đồ cha thông qua bảng quan hệ.
                          </span>
                        )}
                        {selectedEntity.category === 'content' && (
                          <span className="text-print font-medium">
                            ✓ Văn bản nội dung được phân vai trò rõ ràng (heading, definition, list_item).
                          </span>
                        )}
                        {selectedEntity.category === 'image' && (
                          <span className="text-print font-medium">
                            ✓ Hình ảnh minh hoạ được bóc tách và tạo liên kết giải nghĩa ngữ nghĩa.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Key Field Inspection */}
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between p-2 rounded-lg bg-paper-band border border-rule">
                    <span className="text-ink-faint">primary_type:</span>
                    <span className="font-bold text-ink">{selectedEntity.type}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-paper-band border border-rule">
                    <span className="text-ink-faint">subtype:</span>
                    <span className="font-bold text-print">{selectedEntity.subtype || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-paper-band border border-rule">
                    <span className="text-ink-faint">role:</span>
                    <span className="font-bold text-ink">{selectedEntity.role}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-paper-band border border-rule">
                    <span className="text-ink-faint">layout_region:</span>
                    <span className="font-bold text-ink">{selectedEntity.layoutRegion || 'main'}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-paper-band border border-rule">
                    <span className="text-ink-faint">confidence:</span>
                    <span className="font-bold text-print">
                      {(selectedEntity.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-paper-band border border-rule">
                    <span className="text-ink-faint">bounding_box:</span>
                    <span className="font-bold text-ink-soft">
                      {selectedEntity.bbox ? `[${selectedEntity.bbox.join(', ')}]` : 'None'}
                    </span>
                  </div>
                </div>

                {/* Content Payload */}
                <div>
                  <div className="text-[11px] font-bold text-ink-faint uppercase tracking-wider mb-1 font-mono">
                    Nội dung / Mô tả (Content Payload):
                  </div>
                  <div className="p-3 rounded-xl bg-cover text-paper font-mono text-xs max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {selectedEntity.content}
                  </div>
                </div>

                {/* Relational Connections for this Entity */}
                <div className="pt-2 border-t border-rule">
                  <div className="text-[11px] font-bold text-ink-faint uppercase tracking-wider mb-2 font-mono flex items-center justify-between">
                    <span>Quan Hệ Liên Kết ({relatedLinks.length}):</span>
                  </div>
                  {relatedLinks.length === 0 ? (
                    <div className="text-xs text-ink-faint italic p-2 bg-paper-band rounded-lg">
                      Không có quan hệ trực tiếp được đăng ký.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {relatedLinks.map((rl) => (
                        <div
                          key={rl.id}
                          className="p-2 rounded-lg bg-paper-band border border-rule-strong text-xs flex items-center justify-between font-mono"
                        >
                          <span className="text-print font-bold">
                            {rl.source_id === selectedEntity.id ? rl.relation_type : `is_${rl.relation_type}_of`}
                          </span>
                          <span className="text-print font-semibold">
                            {rl.source_id === selectedEntity.id ? rl.target_id : rl.source_id}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Additional Metadata JSON if present */}
                {selectedEntity.metadata && Object.keys(selectedEntity.metadata).length > 0 && (
                  <div className="pt-2 border-t border-rule">
                    <div className="text-[11px] font-bold text-ink-faint uppercase tracking-wider mb-1 font-mono">
                      Metadata (JSON):
                    </div>
                    <pre className="p-2.5 rounded-lg bg-paper-band text-ink text-[11px] font-mono overflow-x-auto max-h-28">
                      {JSON.stringify(selectedEntity.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-ink-faint">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Chọn một thực thể trên bố cục hoặc bảng để kiểm tra chi tiết.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Mini arrow icon
const ArrowRightIcon: React.FC = () => (
  <svg className="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
