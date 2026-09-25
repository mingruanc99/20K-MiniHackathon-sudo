// src/pipeline/orchestrator.ts
/**
 * Master Pipeline Orchestrator for CLSG-IR
 * M1 (Content Extractor) -> M2 (Instructional Planner, weighted by the Knowledge Tree)
 *   -> M3 (Narration [template | LLM] -> discourse & heading policy -> Prosody -> Visual cues)
 *   -> M4 (Quality Guard) -> benchmark run log (metrics + real LLM token usage)
 */
import {
  CanonicalDocumentTree,
  UserConfiguration,
  LessonBlueprint,
  CLSGScene,
  VerifiedCLSG_IR,
  QualityReport,
  ExecutionTraceLog,
  GlobalNarrativeContext,
  SectionSummaryInfo,
  NarrativeIR,
  KnowledgeIR,
  CurriculumIR,
  KnowledgeTree
} from '../types';
import { extractDocument } from './module1_extractor/extractorFactory';
import { InstructionalPlanner } from './module2_planner/instructionalPlanner';
import { narrativeIntelligenceEngine } from './services/narrativeIntelligenceEngine';
import { knowledgeSpaceEngine } from './services/knowledgeSpaceEngine';
import { NarrationGenerator } from './module3_generator/narrationGenerator';
import { generateLlmNarrations } from './module3_generator/llmNarrationGenerator';
import { ProsodyPlanner } from './module3_generator/prosodyPlanner';
import { VisualIntentGenerator } from './module3_generator/visualIntentGenerator';
import { QualityVisualGuard } from './module4_guard/qualityGuard';
import { treeToPipelineOverrides, TreePipelineOverrides } from './services/knowledgeTreeOps';
import { applyConnectivePolicy, applyHeadingPolicy, HeadingSpec, ConnectiveStats, HeadingStats } from './services/discoursePolicy';
import { regionReadingText } from './module1_extractor/visualRegionOcr';
import { usageMeter } from '../services/llm/usageMeter';
import { llmRouter } from '../services/llm/LLMRouter';
import { buildPipelineRunLog, computeBenchmarkMetrics } from '../services/benchmark/benchmarkService';
import { BenchmarkRunLog, BenchmarkTiming } from '../services/benchmark/benchmarkTypes';

export interface PipelineExecutionResult {
  documentTree: CanonicalDocumentTree;
  blueprint: LessonBlueprint;
  knowledgeIr: KnowledgeIR;
  curriculumIr: CurriculumIR;
  narrativeIr: NarrativeIR;
  draftScenes: CLSGScene[];
  qualityReport: QualityReport;
  verifiedIr: VerifiedCLSG_IR;
  traceLogs: ExecutionTraceLog[];
  benchmark: BenchmarkRunLog;
}

export interface PipelineRunOptions {
  knowledgeTree?: KnowledgeTree;
  projectId?: string;
  projectTitle?: string;
}

export class PipelineOrchestrator {
  private planner = new InstructionalPlanner();
  private narrationGen = new NarrationGenerator();
  private prosodyPlanner = new ProsodyPlanner();
  private visualGen = new VisualIntentGenerator();
  private guard = new QualityVisualGuard();

  async runFullPipeline(
    source: File | Blob | string | CanonicalDocumentTree,
    filename: string,
    config: UserConfiguration,
    onProgress?: (stage: string, progress: number) => void,
    options: PipelineRunOptions = {}
  ): Promise<PipelineExecutionResult> {
    const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    usageMeter.beginRun(runId);
    try {
      return await this.run(runId, source, filename, config, onProgress, options);
    } finally {
      usageMeter.endRun(runId);
    }
  }

  private async run(
    runId: string,
    source: File | Blob | string | CanonicalDocumentTree,
    filename: string,
    config: UserConfiguration,
    onProgress: ((stage: string, progress: number) => void) | undefined,
    options: PipelineRunOptions
  ): Promise<PipelineExecutionResult> {
    const traceLogs: ExecutionTraceLog[] = [];
    const timings: BenchmarkTiming[] = [];
    const totalStart = performance.now();
    const isVi = (config.narration_language || config.language || 'vi') !== 'en';
    const lang: 'vi' | 'en' = isVi ? 'vi' : 'en';

    const stage = (name: string, t0: number, details: Record<string, any>) => {
      const ms = performance.now() - t0;
      timings.push({ stage: name, ms: Math.round(ms) });
      traceLogs.push({ stage: name, duration_sec: Math.round(ms / 10) / 100, timestamp: new Date().toLocaleTimeString(), details });
    };

    // Stage 1: Content Extraction
    onProgress?.('Đang đọc cấu trúc tài liệu...', 10);
    let t = performance.now();
    const docTree = await extractDocument(source, filename);
    stage('Module 1: Content Extractor', t, {
      sections: docTree.total_sections,
      visual_regions: docTree.visual_regions?.length || 0,
      regions_read: docTree.visual_regions?.filter((r) => r.ocr?.status === 'done').length || 0
    });

    // Knowledge tree weights (from the Inspector)
    const overrides: TreePipelineOverrides | undefined =
      options.knowledgeTree && options.knowledgeTree.document_id === docTree.document_id ? treeToPipelineOverrides(options.knowledgeTree) : undefined;
    const effectiveConfig: UserConfiguration = overrides ? { ...config, targetDurationSeconds: config.targetDurationSeconds || overrides.totalDurationSec } : config;

    // Stage 1.5: Knowledge Space & Curriculum
    onProgress?.('Dựng không gian tri thức...', 20);
    t = performance.now();
    const knowledgeIr = knowledgeSpaceEngine.buildKnowledgeSpace(docTree);
    const targetMin = Math.max(3, Math.round((effectiveConfig.targetDurationSeconds || 600) / 60));
    const curriculumIr = knowledgeSpaceEngine.compileCurriculum(knowledgeIr, targetMin, effectiveConfig.targetWpm || 135);
    stage('Knowledge Space & Curriculum', t, { concepts: knowledgeIr.concepts.length, active: curriculumIr.active_concepts_count });

    // Stage 2: Instructional Planning
    onProgress?.('Phân tích bài học và phân bổ thời lượng...', 35);
    t = performance.now();
    const blueprint = await this.planner.plan(docTree, effectiveConfig, overrides);
    stage('Module 2: Instructional Planner', t, {
      sections_planned: blueprint.sections.length,
      sections_excluded: overrides?.excludedSections.size || 0,
      weighted_by_tree: Boolean(overrides),
      target_words: blueprint.total_word_budget,
      duration_sec: blueprint.total_target_duration_sec
    });

    // Stage 2.5: Narrative beats
    t = performance.now();
    const narrativeIr = narrativeIntelligenceEngine.generateNarrativeIR(docTree, blueprint, effectiveConfig);
    stage('Module 2.5: Narrative Intelligence', t, { beats: narrativeIr.narrative_beats.length, source_questions: narrativeIr.total_curiosity_hooks });

    // Stage 3A: Narration
    const engine = effectiveConfig.narrationEngine === 'llm' && llmRouter.getOnlineProvider()?.hasApiKey() ? 'llm' : 'template';
    onProgress?.(engine === 'llm' ? 'LLM đang viết lời giảng...' : 'Đang viết lời giảng...', 55);
    t = performance.now();
    const docMap = new Map(docTree.sections.map((s) => [s.section_id, s]));
    const regionMap = new Map((docTree.visual_regions || []).map((r) => [r.region_id, r]));
    const chapterCount = overrides ? new Set(Object.values(overrides.chapterOf).map((c) => c.chapterId)).size : 0;

    const headingSpecs: HeadingSpec[] = blueprint.sections.map((plan) => {
      const ch = overrides?.chapterOf[plan.section_id];
      return { sceneId: plan.section_id, sectionTitle: plan.title, chapterId: ch?.chapterId, chapterTitle: ch?.chapterTitle, isChapterFirstPage: ch?.isFirstPage };
    });

    let llmTexts: (string | null)[] = blueprint.sections.map(() => null);
    if (engine === 'llm') {
      llmTexts = await generateLlmNarrations(
        blueprint.sections.map((plan, idx) => {
          const ch = overrides?.chapterOf[plan.section_id];
          return {
            plan,
            section: docMap.get(plan.section_id),
            prevSection: idx > 0 ? docMap.get(blueprint.sections[idx - 1].section_id) : undefined,
            nextTitle: blueprint.sections[idx + 1]?.title,
            chapter: ch && chapterCount > 1 ? { title: ch.chapterTitle, isFirstPage: ch.isFirstPage } : undefined,
            keywords: plan.key_concepts || [],
            lessonTitle: blueprint.lecture_title || docTree.title,
            isFirstScene: idx === 0
          };
        }),
        effectiveConfig
      );
    }

    const rawTexts: string[] = [];
    const generatedHistory: SectionSummaryInfo[] = [];
    const usedOpenings = new Set<string>();
    const usedPhrases = new Set<string>();
    const usedAnalogies = new Set<string>();
    let llmFallbacks = 0;

    blueprint.sections.forEach((plan, idx) => {
      const docSec = docMap.get(plan.section_id);
      const prevPlan = idx > 0 ? blueprint.sections[idx - 1] : undefined;
      const nextPlan = blueprint.sections[idx + 1];
      const ch = overrides?.chapterOf[plan.section_id];
      const role = plan.slide_analysis?.slide_role || 'KEY_EXPLANATION';

      let text = llmTexts[idx];
      if (!text) {
        if (engine === 'llm') llmFallbacks++;
        const globalContext: GlobalNarrativeContext = {
          lesson_topic: blueprint.lecture_title || docTree.title,
          previous_sections: [...generatedHistory],
          current_section: { id: plan.section_id, type: role, title: plan.title },
          next_section: nextPlan ? { id: nextPlan.section_id, type: nextPlan.slide_analysis?.slide_role || 'KEY_EXPLANATION', title: nextPlan.title } : undefined,
          used_phrases: Array.from(usedPhrases),
          used_openings: Array.from(usedOpenings),
          used_concepts: []
        };
        const visualReadings = (docSec?.elements || [])
          .filter((e) => e.region_id)
          .map((e) => regionMap.get(e.region_id!))
          .filter((r) => r && r.ocr?.status === 'done' && !r.ocr.is_decorative && !r.excluded)
          .map((r) => ({ kind: r!.ocr?.content_type || r!.kind, text: regionReadingText(r!), summary: r!.ocr?.summary }));
        text = this.narrationGen.generateNarration(plan, effectiveConfig, docSec?.raw_text, {
          previousPlan: prevPlan,
          nextPlan,
          lessonModel: blueprint.lesson_model,
          teachingUnit: blueprint.teaching_units?.find((u) => u.slide_ids.includes(plan.section_id)),
          globalContext,
          usedOpenings,
          usedPhrases,
          chapter: ch ? { title: ch.chapterTitle, isFirstPage: ch.isFirstPage, isOnlyChapter: chapterCount <= 1 } : undefined,
          visualReadings,
          notes: (docSec?.elements || []).filter((e) => e.type === 'note').map((e) => e.text),
          lessonTitle: blueprint.lecture_title || docTree.title
        });
        text = narrativeIntelligenceEngine.revoiceDraft(text, narrativeIr.narrative_beats[idx], isVi, {
          role,
          isChapterStart: Boolean(ch?.isFirstPage),
          usedAnalogies
        });
      }

      const firstSentence = text.split(/[.!?\n]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 5) {
        usedOpenings.add(firstSentence.toLowerCase());
        usedPhrases.add(firstSentence);
      }
      generatedHistory.push({ id: plan.section_id, title: plan.title, type: role, narration: text, opening_phrase: firstSentence });
      rawTexts.push(text);
    });
    stage(`Module 3A: Narration (${engine})`, t, { scenes: rawTexts.length, llm_fallbacks: llmFallbacks });

    // Stage 3A+: lecture-wide discourse policy (headings first: dropping sentences changes connective context)
    t = performance.now();
    const heading = applyHeadingPolicy(rawTexts, headingSpecs, { maxSectionTitleMentions: effectiveConfig.maxSectionTitleMentions ?? 1, language: lang });
    const chapterLast = new Set<string>();
    if (overrides) {
      const lastByChapter = new Map<string, string>();
      blueprint.sections.forEach((p) => {
        const c = overrides.chapterOf[p.section_id];
        if (c) lastByChapter.set(c.chapterId, p.section_id);
      });
      lastByChapter.forEach((sid) => chapterLast.add(sid));
    }
    const connective = applyConnectivePolicy(
      heading.texts.map((text, idx) => {
        const plan = blueprint.sections[idx];
        const role = plan.slide_analysis?.slide_role;
        return {
          text,
          ctx: {
            sceneId: plan.section_id,
            role,
            isSequential: role === 'PROCESS' || plan.narrative_plan?.list_strategy === 'SEQUENTIAL_PROCESS' || plan.narrative_plan?.body_strategy === 'PROCESS',
            isChapterLastScene: chapterLast.has(plan.section_id) || idx === blueprint.sections.length - 1
          }
        };
      }),
      lang
    );
    stage('Discourse policy: headings & connectives', t, {
      heading_repeats_removed: heading.stats.repeatsRemoved,
      transition_sentences_dropped: heading.stats.sentencesDropped,
      connectives_before: connective.stats.connectivesBefore,
      connectives_removed: connective.stats.removed.length
    });

    // Stage 3B/3C: prosody & visual cues from the final text
    t = performance.now();
    const draftScenes: CLSGScene[] = blueprint.sections.map((plan, idx) => {
      const narrationText = connective.texts[idx];
      const prosodyPlan = this.prosodyPlanner.planProsody(narrationText, plan, effectiveConfig);
      const visualCues = this.visualGen.generateVisualCues(plan, prosodyPlan, effectiveConfig);
      return {
        section_id: plan.section_id,
        topic: plan.title,
        order: plan.order,
        pedagogical_function: plan.pedagogical_function,
        learning_goal: plan.instructional_goal,
        slide_analysis: plan.slide_analysis,
        narrative_plan: plan.narrative_plan,
        narration: { text: narrationText, word_count: prosodyPlan.total_words, sentences: prosodyPlan.sentences },
        prosody_plan: prosodyPlan,
        visual_cues: visualCues,
        section_summary: plan.instructional_goal,
        scene_start_time_sec: 0,
        scene_end_time_sec: prosodyPlan.effective_scene_duration_sec,
        scene_duration_sec: prosodyPlan.effective_scene_duration_sec
      };
    });
    stage('Module 3B/3C: Prosody & Visual Intent', t, {
      total_words: draftScenes.reduce((s, sc) => s + sc.narration.word_count, 0),
      visual_cues: draftScenes.reduce((s, sc) => s + sc.visual_cues.length, 0)
    });

    // Stage 4: Quality Guard
    onProgress?.('Kiểm định chất lượng...', 88);
    t = performance.now();
    const { qualityReport, verifiedIr } = this.guard.validateAndCertify(draftScenes, blueprint, docTree, effectiveConfig, { headingSpecs });
    verifiedIr.lesson_model = blueprint.lesson_model;
    verifiedIr.content_prioritization = blueprint.content_prioritization;
    verifiedIr.teaching_units = blueprint.teaching_units;
    verifiedIr.narrative_ir = narrativeIr;
    verifiedIr.knowledge_ir = knowledgeIr;
    verifiedIr.curriculum_ir = curriculumIr;
    stage('Module 4: Quality & Visual Guard', t, {
      decision: qualityReport.decision,
      score: qualityReport.overall_quality_score,
      dar_p_error_pct: qualityReport.duration_error_pct,
      repairs: qualityReport.auto_repairs_applied.length
    });

    const totalMs = Math.round(performance.now() - totalStart);
    const calls = usageMeter.peek(runId);
    const metrics = computeBenchmarkMetrics(verifiedIr, qualityReport, docTree, headingSpecs, options.knowledgeTree, qualityReport.dar_p_pre_repair_pct);
    const online = llmRouter.getOnlineProvider();
    const notes: string[] = [];
    if (!online) notes.push('Chạy với MockLLMProvider (không gọi API).');
    if (engine === 'llm' && llmFallbacks) notes.push(`${llmFallbacks} cảnh dùng template vì gọi LLM thất bại.`);
    if (effectiveConfig.narrationEngine === 'llm' && engine !== 'llm') notes.push('Chọn chế độ LLM nhưng chưa có API key: đã dùng template.');
    const failed = calls.filter((c) => c.status === 'error').length;
    if (failed) notes.push(`${failed} lần gọi LLM lỗi; planner đã dùng dữ liệu dự phòng cho các bước đó.`);

    const benchmark = buildPipelineRunLog({
      runId,
      projectId: options.projectId || 'local',
      projectTitle: options.projectTitle || docTree.title,
      config: effectiveConfig,
      model: online ? online.getActiveModel() : 'mock',
      timings,
      totalMs,
      metrics,
      connectiveStats: connective.stats,
      headingStats: heading.stats,
      calls,
      usedTree: Boolean(overrides),
      notes
    });

    traceLogs.push({
      stage: 'Pipeline Complete',
      duration_sec: Math.round(totalMs / 10) / 100,
      timestamp: new Date().toLocaleTimeString(),
      details: { ir_id: verifiedIr.ir_id, scenes: verifiedIr.total_scenes, tokens: benchmark.tokens.totalTokens, llm_calls: benchmark.tokens.calls - benchmark.tokens.cacheHits }
    });
    onProgress?.('Hoàn tất!', 100);

    return { documentTree: docTree, blueprint, knowledgeIr, curriculumIr, narrativeIr, draftScenes, qualityReport, verifiedIr, traceLogs, benchmark };
  }
}

export const pipelineOrchestrator = new PipelineOrchestrator();
