// src/pipeline/orchestrator.ts
/**
 * Master Pipeline Orchestrator for CLSG-IR
 * Coordinates:
 * M1 (Content Extractor) -> M2 (Instructional Planner) -> M3 (Expression Generator) -> M4 (Quality Guard)
 * Emits VerifiedCLSG_IR and execution trace logs.
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
  CurriculumIR
} from '../types';
import { extractDocument } from './module1_extractor/extractorFactory';
import { InstructionalPlanner } from './module2_planner/instructionalPlanner';
import { narrativeIntelligenceEngine } from './services/narrativeIntelligenceEngine';
import { knowledgeSpaceEngine } from './services/knowledgeSpaceEngine';
import { NarrationGenerator } from './module3_generator/narrationGenerator';
import { ProsodyPlanner } from './module3_generator/prosodyPlanner';
import { VisualIntentGenerator } from './module3_generator/visualIntentGenerator';
import { QualityVisualGuard } from './module4_guard/qualityGuard';

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
    onProgress?: (stage: string, progress: number) => void
  ): Promise<PipelineExecutionResult> {
    const traceLogs: ExecutionTraceLog[] = [];
    const totalStart = performance.now();

    // -------------------------------------------------------------
    // Stage 1: Content Extraction
    // -------------------------------------------------------------
    onProgress?.('Extracting document structure...', 15);
    const t0 = performance.now();
    const docTree = await extractDocument(source, filename);
    const t1 = performance.now();
    traceLogs.push({
      stage: 'Module 1: Content Extractor (Rule-based, 0-LLM)',
      duration_sec: Math.round((t1 - t0) / 10) / 100,
      timestamp: new Date().toLocaleTimeString(),
      details: { sections_extracted: docTree.total_sections, latency_ms: docTree.extraction_time_ms }
    });

    // -------------------------------------------------------------
    // Stage 1.5: Knowledge Space Reconstruction & Time-Aware Curriculum
    // -------------------------------------------------------------
    onProgress?.('Reconstructing knowledge space & curriculum DAG...', 25);
    const tKS0 = performance.now();
    const knowledgeIr = knowledgeSpaceEngine.buildKnowledgeSpace(docTree);
    const targetMin = Math.max(3, Math.round((config.targetDurationSeconds || 600) / 60));
    const curriculumIr = knowledgeSpaceEngine.compileCurriculum(knowledgeIr, targetMin, config.targetWpm || 135);
    const tKS1 = performance.now();
    traceLogs.push({
      stage: 'Knowledge Space & Dynamic Curriculum Compiler',
      duration_sec: Math.round((tKS1 - tKS0) / 10) / 100,
      timestamp: new Date().toLocaleTimeString(),
      details: {
        concepts_extracted: knowledgeIr.concepts.length,
        propositions: knowledgeIr.total_propositions,
        evidence_artifacts: knowledgeIr.total_evidence_artifacts,
        active_concepts: curriculumIr.active_concepts_count,
        strategy: curriculumIr.compression_strategy
      }
    });

    // -------------------------------------------------------------
    // Stage 2: Instructional Planning (Whole-Lesson Understanding)
    // -------------------------------------------------------------
    onProgress?.('Understanding lesson & prioritizing content...', 35);
    const t2 = performance.now();
    const blueprint = await this.planner.plan(docTree, config);
    const t3 = performance.now();
    traceLogs.push({
      stage: 'Module 2: Lesson Semantic & Instructional Planner',
      duration_sec: Math.round((t3 - t2) / 10) / 100,
      timestamp: new Date().toLocaleTimeString(),
      details: {
        core_concepts: blueprint.lesson_model?.core_concepts.length || 0,
        teaching_units: blueprint.teaching_units?.length || 0,
        noise_filtered: blueprint.content_prioritization?.omitted_content_count || 0,
        target_words: blueprint.total_word_budget,
        duration_sec: blueprint.total_target_duration_sec
      }
    });

    // -------------------------------------------------------------
    // Stage 2.5: Module 2.5 - Narrative Intelligence Layer (NIL)
    // -------------------------------------------------------------
    onProgress?.('Synthesizing narrative curiosity, analogies & discourse...', 50);
    const tNIL0 = performance.now();
    const narrativeIr = narrativeIntelligenceEngine.generateNarrativeIR(docTree, blueprint, config);
    const tNIL1 = performance.now();
    traceLogs.push({
      stage: 'Module 2.5: Narrative Intelligence Layer (Curiosity & Cognitive ToM)',
      duration_sec: Math.round((tNIL1 - tNIL0) / 10) / 100,
      timestamp: new Date().toLocaleTimeString(),
      details: {
        narrative_id: narrativeIr.lecture_narrative_id,
        beats_planned: narrativeIr.narrative_beats.length,
        curiosity_hooks: narrativeIr.total_curiosity_hooks,
        avg_cognitive_load: narrativeIr.average_cognitive_load,
        persona: narrativeIr.persona_archetype
      }
    });

    // -------------------------------------------------------------
    // Stage 3: Expression Generation (3A, 3B, 3C)
    // -------------------------------------------------------------
    onProgress?.('Generating knowledge-driven narration, prosody & visuals...', 65);
    const t4 = performance.now();
    const docMap = new Map(docTree.sections.map((s) => [s.section_id, s]));

    const draftScenes: CLSGScene[] = [];
    const generatedHistory: SectionSummaryInfo[] = [];
    const usedOpenings = new Set<string>();
    const usedPhrases = new Set<string>();
    const usedConcepts = new Set<string>();

    for (let idx = 0; idx < blueprint.sections.length; idx++) {
      const plan = blueprint.sections[idx];
      const docSec = docMap.get(plan.section_id);
      const prevPlan = idx > 0 ? blueprint.sections[idx - 1] : undefined;
      const nextPlan = idx < blueprint.sections.length - 1 ? blueprint.sections[idx + 1] : undefined;
      const matchingUnit = blueprint.teaching_units?.find((u) => u.slide_ids.includes(plan.section_id));

      const globalContext: GlobalNarrativeContext = {
        lesson_topic: blueprint.lecture_title || docTree.title,
        previous_sections: [...generatedHistory],
        current_section: {
          id: plan.section_id,
          type: plan.slide_analysis?.slide_role || (plan.pedagogical_function as any) || 'KEY_EXPLANATION',
          title: plan.title
        },
        next_section: nextPlan ? {
          id: nextPlan.section_id,
          type: nextPlan.slide_analysis?.slide_role || (nextPlan.pedagogical_function as any) || 'KEY_EXPLANATION',
          title: nextPlan.title
        } : undefined,
        used_phrases: Array.from(usedPhrases),
        used_openings: Array.from(usedOpenings),
        used_concepts: Array.from(usedConcepts)
      };

      // 3A: Knowledge-Driven Narration Script with Global Narrative Context
      let narrationText = this.narrationGen.generateNarration(plan, config, docSec?.raw_text, {
        previousPlan: prevPlan,
        nextPlan: nextPlan,
        lessonModel: blueprint.lesson_model,
        teachingUnit: matchingUnit,
        globalContext,
        usedOpenings,
        usedPhrases
      });

      // Enhance narration with Narrative Intelligence Re-voicing
      const beat = narrativeIr.narrative_beats[idx];
      if (beat && plan.slide_analysis?.slide_role !== 'DECORATIVE') {
        narrationText = narrativeIntelligenceEngine.revoiceDraft(narrationText, beat, config.narration_language !== 'en');
      }

      // Track opening sentence to prevent future sections from repeating it
      const firstSentence = narrationText.split(/[.!?\n]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 5) {
        usedOpenings.add(firstSentence.toLowerCase());
        usedPhrases.add(firstSentence);
      }

      // Track key concepts
      plan.key_concepts?.forEach((c) => usedConcepts.add(c.toLowerCase()));

      generatedHistory.push({
        id: plan.section_id,
        title: plan.title,
        type: plan.slide_analysis?.slide_role || 'KEY_EXPLANATION',
        narration: narrationText,
        opening_phrase: firstSentence
      });

      const wordCount = narrationText.split(/\s+/).length;

      // 3B: Prosody & Pause Planning (Pre-TTS Intent)
      const prosodyPlan = this.prosodyPlanner.planProsody(narrationText, plan, config);

      // 3C: Visual Intent Cues (13 Taxonomies)
      const visualCues = this.visualGen.generateVisualCues(plan, prosodyPlan, config);

      draftScenes.push({
        section_id: plan.section_id,
        topic: plan.title,
        order: plan.order,
        pedagogical_function: plan.pedagogical_function,
        learning_goal: plan.instructional_goal,
        slide_analysis: plan.slide_analysis,
        narrative_plan: plan.narrative_plan,
        narration: {
          text: narrationText,
          word_count: wordCount,
          sentences: prosodyPlan.sentences
        },
        prosody_plan: prosodyPlan,
        visual_cues: visualCues,
        section_summary: plan.instructional_goal,
        scene_start_time_sec: 0,
        scene_end_time_sec: prosodyPlan.effective_scene_duration_sec,
        scene_duration_sec: prosodyPlan.effective_scene_duration_sec
      });
    }

    const t5 = performance.now();
    traceLogs.push({
      stage: 'Module 3: Expression Generator (Narration + Prosody + Visuals)',
      duration_sec: Math.round((t5 - t4) / 10) / 100,
      timestamp: new Date().toLocaleTimeString(),
      details: {
        total_words: draftScenes.reduce((sum, s) => sum + s.narration.word_count, 0),
        scenes_generated: draftScenes.length
      }
    });

    // -------------------------------------------------------------
    // Stage 4: Quality & Visual Guard
    // -------------------------------------------------------------
    onProgress?.('Certifying DAR-P, visual necessity & semantic critique...', 90);
    const t6 = performance.now();
    const { qualityReport, verifiedIr } = this.guard.validateAndCertify(
      draftScenes,
      blueprint,
      docTree,
      config
    );
    const t7 = performance.now();

    // Attach holistic semantic models to Verified CLSG-IR
    verifiedIr.lesson_model = blueprint.lesson_model;
    verifiedIr.content_prioritization = blueprint.content_prioritization;
    verifiedIr.teaching_units = blueprint.teaching_units;
    verifiedIr.narrative_ir = narrativeIr;
    verifiedIr.knowledge_ir = knowledgeIr;
    verifiedIr.curriculum_ir = curriculumIr;

    traceLogs.push({
      stage: 'Module 4: Quality & Visual Guard (DAR-P <= 15% & Semantic Coherence)',
      duration_sec: Math.round((t7 - t6) / 10) / 100,
      timestamp: new Date().toLocaleTimeString(),
      details: {
        status: qualityReport.overall_status,
        score: qualityReport.overall_quality_score,
        dar_p_error_pct: qualityReport.duration_error_pct,
        repairs: qualityReport.auto_repairs_applied.length
      }
    });

    const totalElapsedSec = Math.round((performance.now() - totalStart) / 10) / 100;
    traceLogs.push({
      stage: 'Pipeline Complete: Verified CLSG-IR Emitted',
      duration_sec: totalElapsedSec,
      timestamp: new Date().toLocaleTimeString(),
      details: { ir_id: verifiedIr.ir_id, scenes: verifiedIr.total_scenes }
    });

    onProgress?.('Complete!', 100);

    return {
      documentTree: docTree,
      blueprint,
      knowledgeIr,
      curriculumIr,
      narrativeIr,
      draftScenes,
      qualityReport,
      verifiedIr,
      traceLogs
    };
  }
}

export const pipelineOrchestrator = new PipelineOrchestrator();
