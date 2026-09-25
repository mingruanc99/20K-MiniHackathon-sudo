import {
  CanonicalDocumentTree,
  UserConfiguration,
  LessonBlueprint,
  SectionPlan,
  PedagogicalRole,
  BloomLevel,
  LessonModel,
  ContentPrioritization,
  TeachingUnit
} from '../../types';
import { narrativePlannerService } from '../services/narrativePlannerService';
import { llmRouter } from '../../services/llm/LLMRouter';
import { extractLocalKeywords, pageTextsFromSections } from '../services/keywordExtractor';
import type { TreePipelineOverrides } from '../services/knowledgeTreeOps';

export class InstructionalPlanner {
  /**
   * @param overrides weights from the Knowledge Inspector tree: excluded pages are dropped,
   *   page durations become time budgets and weighted keywords become key concepts.
   */
  async plan(sourceTree: CanonicalDocumentTree, config: UserConfiguration, overrides?: TreePipelineOverrides): Promise<LessonBlueprint> {
    const docTree: CanonicalDocumentTree = overrides
      ? (() => {
          const sections = sourceTree.sections.filter((s) => !overrides.excludedSections.has(s.section_id));
          return { ...sourceTree, sections: sections.length ? sections : sourceTree.sections, total_sections: sections.length || sourceTree.sections.length };
        })()
      : sourceTree;
    const numSections = docTree.sections.length;
    if (numSections === 0) {
      throw new Error('Cannot create lesson plan from an empty document tree.');
    }

    // Step 1: Global Lesson Understanding (M2.1 - M2.4: Concept Graph, Dependencies & Needs)
    const lessonModel: LessonModel = await llmRouter.generateLessonUnderstanding(docTree, config);

    // Step 2: Content Prioritization (M2.5: Core, Supporting, Example, Context, Noise)
    const prioritization: ContentPrioritization = await llmRouter.generateContentPrioritization(docTree, lessonModel);

    // Step 3: Teaching Arc & Multi-Slide Teaching Unit Construction (M2.8 - M2.9)
    const teachingUnits: TeachingUnit[] = await llmRouter.generateTeachingPlan(docTree, lessonModel, prioritization, config);

    // Step 4: Mathematical Duration & Word Budget Allocation (M2.10 - Deterministic 0-LLM)
    const configuredSec = config.targetDurationSeconds || 180;
    // Without a user-weighted tree, keep a floor of 20 s per page; with a tree, honour the user's target exactly.
    const totalSec = overrides ? configuredSec : Math.max(configuredSec, numSections * 20);
    const wpm = config.targetWpm || 140;

    // Pause overhead accounts for 18% in normal pacing, 22% in slow, 12% in fast
    let pauseFactor = 0.18;
    if (config.narrationStyle === 'conversational') pauseFactor = 0.20;
    if (config.accessibility?.slowerPacing) pauseFactor = 0.24;

    const netSpeakingSec = totalSec * (1.0 - pauseFactor);
    const totalWordBudget = Math.round(netSpeakingSec * (wpm / 60));

    // Heuristic duration distribution weights
    let durations: number[];
    const treeDurations = overrides ? docTree.sections.map((s) => overrides.sectionDurations[s.section_id] || 0) : [];
    const treeSum = treeDurations.reduce((a, b) => a + b, 0);
    if (overrides && treeSum > 0) {
      // Scale the tree's split to the configured length (the tree may have been edited to another total).
      durations = this.distributeDurations(totalSec, treeDurations.map((d) => d / treeSum));
    } else {
      durations = this.distributeDurations(totalSec, this.calculateWeights(numSections));
    }

    // Weighted keywords: from the tree when available, otherwise computed locally for the whole deck.
    const localKeywords = overrides ? null : extractLocalKeywords(pageTextsFromSections(docTree.sections), { maxPerPage: 5, minWeight: 0.3 });

    const sectionPlans: SectionPlan[] = [];
    const cumulativeConcepts: string[] = [];

    docTree.sections.forEach((sec, idx) => {
      const order = idx + 1;
      const duration = durations[idx];
      const role = this.determinePedagogicalRole(order, numSections, sec.title);
      const bloom = this.determineBloomLevel(role, config.learnerLevel);

      const secWordBudget = Math.max(15, Math.round(duration * (1.0 - pauseFactor) * (wpm / 60)));
      const treeKeywords = overrides?.sectionKeywords[sec.section_id];
      const extractedConcepts = (treeKeywords && treeKeywords.length ? treeKeywords : (localKeywords?.get(sec.section_id) || []).map((k) => k.term)).slice(0, 6);
      const prereqs = cumulativeConcepts.slice(0, 3);
      cumulativeConcepts.push(...extractedConcepts);

      const isVietnamese = (config.narration_language || config.language || 'vi') !== 'en';
      const goal = this.formulateLearningGoal(sec.title, role, bloom, isVietnamese);

      sectionPlans.push({
        section_id: sec.section_id,
        title: sec.title,
        order,
        pedagogical_function: role,
        bloom_level: bloom,
        target_duration_sec: duration,
        target_word_budget: secWordBudget,
        key_concepts: extractedConcepts,
        prerequisite_concepts: prereqs,
        instructional_goal: goal,
        importance: role === 'mechanism' || role === 'definition' ? 'high' : 'medium'
      });
    });

    // Generate Context-Aware Narrative Planning (M2 -> M3 bridge)
    const { analyses, plans: narrativePlans } = narrativePlannerService.planNarrative(
      sectionPlans,
      docTree.sections
    );

    // Map Teaching Units and Prioritized Content back into Slide Analyses
    const noiseBySlide = new Map<string, string[]>();
    prioritization.noise_items.forEach((item) => {
      if (item.source_slide_id) {
        const existing = noiseBySlide.get(item.source_slide_id) || [];
        existing.push(item.text);
        noiseBySlide.set(item.source_slide_id, existing);
      }
    });

    sectionPlans.forEach((plan) => {
      const analysis = analyses.get(plan.section_id);
      const narrativePlan = narrativePlans.get(plan.section_id);
      
      // Inject noise items into excluded_content
      const extraNoise = noiseBySlide.get(plan.section_id) || [];
      if (analysis && extraNoise.length > 0) {
        analysis.excluded_content = Array.from(new Set([...analysis.excluded_content, ...extraNoise]));
      }

      // Associate with corresponding teaching unit if available
      const matchingUnit = teachingUnits.find((u) => u.slide_ids.includes(plan.section_id));
      if (matchingUnit) {
        if (narrativePlan && matchingUnit.learning_need) {
          narrativePlan.learning_need = matchingUnit.learning_need;
        }
        // Only mark the first slide of a HOOK unit as HOOK if it doesn't already have a more specific role
        if (analysis && matchingUnit.stage === 'HOOK' && matchingUnit.slide_ids[0] === plan.section_id) {
          if (analysis.slide_role !== 'INTRODUCTION' && analysis.slide_role !== 'THINK' && analysis.slide_role !== 'EXAMPLE' && analysis.slide_role !== 'MECHANISM') {
            analysis.slide_role = 'HOOK';
          }
        }
      }

      plan.slide_analysis = analysis;
      plan.narrative_plan = narrativePlan;
      if (plan.slide_analysis) {
        plan.importance = plan.slide_analysis.importance;
      }
    });

    const isVi = (config.narration_language || config.language || 'vi') !== 'en';

    return {
      blueprint_id: `bp_${Date.now().toString(36)}`,
      document_id: docTree.document_id,
      lecture_title: docTree.title,
      total_target_duration_sec: totalSec,
      total_word_budget: sectionPlans.reduce((sum, s) => sum + s.target_word_budget, 0),
      target_wpm: wpm,
      pedagogical_strategy: isVi
        ? `Tiến trình nhận thức sư phạm cho trình độ ${config.learnerLevel} (${config.narrationStyle}, ${numSections} slide)`
        : `Scaffolded Cognitive Progression for ${config.learnerLevel} (${config.narrationStyle} tone, ${numSections} slides)`,
      sections: sectionPlans,
      lesson_model: lessonModel,
      content_prioritization: prioritization,
      teaching_units: teachingUnits,
      created_at: new Date().toISOString()
    };
  }

  private calculateWeights(n: number): number[] {
    if (n <= 1) return [1.0];
    if (n === 2) return [0.45, 0.55];
    if (n === 3) return [0.25, 0.50, 0.25];
    if (n === 4) return [0.20, 0.30, 0.30, 0.20];

    // For any n >= 5 (unlimited slides): equal distribution with smooth rounding
    const baseShare = 1.0 / n;
    return new Array(n).fill(baseShare);
  }

  private distributeDurations(totalSec: number, weights: number[]): number[] {
    const n = weights.length;
    if (n === 0) return [];

    // Minimum duration per slide: at least 8s, up to 20s if totalSec permits
    const minSec = Math.max(8, Math.min(20, Math.floor((totalSec / n) * 0.6)));

    let raw = weights.map((w) => Math.max(minSec, Math.round(w * totalSec)));
    let sum = raw.reduce((a, b) => a + b, 0);

    let diff = totalSec - sum;
    let idx = 0;
    while (diff !== 0) {
      if (diff > 0) {
        raw[idx % n] += 1;
        diff -= 1;
      } else {
        if (raw[idx % n] > minSec) {
          raw[idx % n] -= 1;
          diff += 1;
        }
      }
      idx++;
      if (idx > n * 200) break; // safety guard
    }
    return raw;
  }

  private determinePedagogicalRole(order: number, total: number, title: string): PedagogicalRole {
    const t = title.toLowerCase();
    if (t.includes('hook') || t.includes('motivat') || order === 1) return 'hook';
    if (t.includes('summary') || t.includes('conclusion') || order === total) return 'summary';
    if (t.includes('what is') || t.includes('definition') || t.includes('concept')) return 'definition';
    if (t.includes('math') || t.includes('mechanism') || t.includes('convolution') || t.includes('algorithm')) return 'mechanism';
    if (t.includes('vs') || t.includes('compar') || t.includes('difference')) return 'comparison';
    if (t.includes('example') || t.includes('application') || t.includes('walkthrough')) return 'example';

    return order % 2 === 0 ? 'mechanism' : 'example';
  }

  private determineBloomLevel(role: PedagogicalRole, level: string): BloomLevel {
    if (role === 'hook') return 'Remember';
    if (role === 'definition') return 'Understand';
    if (role === 'mechanism') return level === 'graduate' || level === 'professional' ? 'Analyze' : 'Understand';
    if (role === 'example') return 'Apply';
    if (role === 'comparison') return 'Analyze';
    if (role === 'summary') return 'Evaluate';
    return 'Understand';
  }

  private formulateLearningGoal(
    title: string,
    role: PedagogicalRole,
    bloom: BloomLevel,
    isVietnamese: boolean = true
  ): string {
    if (!isVietnamese) {
      const verbs: Record<BloomLevel, string> = {
        Remember: 'Recall and state the foundational relevance of',
        Understand: 'Explain the mathematical and conceptual intuition behind',
        Apply: 'Demonstrate the algorithmic application and computational flow of',
        Analyze: 'Differentiate structural tradeoffs and data efficiency in',
        Evaluate: 'Critique scaling bottlenecks and operational boundaries of',
        Create: 'Synthesize novel pipeline architectures utilizing'
      };
      return `${verbs[bloom]} ${title} via an instructional ${role} narrative.`;
    }

    const verbsVi: Record<BloomLevel, string> = {
      Remember: 'nắm vững tầm quan trọng nền tảng của',
      Understand: 'hiểu rõ bản chất và trực giác khái niệm của',
      Apply: 'vận dụng các bước thuật toán và quy trình xử lý của',
      Analyze: 'phân tích các đánh đổi về cấu trúc và hiệu quả của',
      Evaluate: 'đánh giá điểm nghẽn hiệu năng và giới hạn vận hành của',
      Create: 'tổng hợp kiến trúc hệ thống mới dựa trên'
    };
    return `${verbsVi[bloom]} ${title}`;
  }
}
