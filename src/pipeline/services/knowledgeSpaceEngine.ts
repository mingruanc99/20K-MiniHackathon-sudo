// src/pipeline/services/knowledgeSpaceEngine.ts
/**
 * KNOWLEDGE SPACE & TIME-AWARE CURRICULUM ENGINE
 * 
 * Re-architects presentation content from first principles:
 * 1. Converts physical document elements into an enduring Concept Knowledge Space.
 * 2. Visual assets (diagrams, tables, formulas) become empirical Evidence bound to Concepts, NOT Slides.
 * 3. Compiles dynamic Curriculums for 3 min, 10 min, 30 min, or 60 min with topologically sorted sequences.
 */

import {
  CanonicalDocumentTree,
  KnowledgeIR,
  ConceptNode,
  EvidenceArtifact,
  AtomicProposition,
  EpistemicEdge,
  CurriculumIR,
  TeachingUnitPlan,
  EpistemicRole
} from '../../types';

export class KnowledgeSpaceEngine {
  /**
   * Reconstructs the presentation-independent Knowledge Space
   */
  buildKnowledgeSpace(docTree: CanonicalDocumentTree): KnowledgeIR {
    const concepts: Record<string, ConceptNode> = {};
    const edges: EpistemicEdge[] = [];
    let totalPropositions = 0;
    let totalEvidence = 0;

    const sections = docTree.sections || [];

    // Pass 1: Extract concepts and bind evidence
    sections.forEach((sec, idx) => {
      const title = sec.title.trim();
      const slug = this.slugify(title);

      if (!concepts[slug]) {
        let role: EpistemicRole = 'core_mechanism';
        if (title.toLowerCase().includes('giới thiệu') || title.toLowerCase().includes('intro')) {
          role = 'foundational_axiom';
        } else if (title.toLowerCase().includes('so sánh') || title.toLowerCase().includes('vs') || title.toLowerCase().includes('tradeoff')) {
          role = 'architectural_tradeoff';
        } else if (title.toLowerCase().includes('kết luận') || title.toLowerCase().includes('ứng dụng')) {
          role = 'practical_application';
        }

        concepts[slug] = {
          concept_id: `c_${slug}`,
          canonical_name: title,
          formal_definition: sec.elements.find(e => e.type === 'paragraph')?.text || `Khái niệm cốt lõi giải thích ${title}`,
          epistemic_role: role,
          cognitive_complexity_score: role === 'architectural_tradeoff' ? 0.75 : 0.55,
          significance_score: title.toLowerCase().includes('pose') || title.toLowerCase().includes('keypoint') || title.toLowerCase().includes('17') ? 0.95 : 0.65,
          propositions: [],
          analogies: [],
          common_misconceptions: [],
          evidence_artifacts: [],
          keywords: title.split(/\s+/).filter(w => w.length > 3)
        };
      }

      const concept = concepts[slug];

      // Extract propositions
      sec.elements.forEach(el => {
        if (el.text && el.text.length > 10 && el.type !== 'note') {
          concept.propositions.push({
            prop_id: `prop_${el.element_id}`,
            statement: el.text.trim(),
            grounding_source: `${docTree.source_filename}#${el.element_id}`,
            confidence: 1.0
          });
          totalPropositions++;
        }

        // Attach visual/diagram elements directly as Evidence
        if (el.type === 'diagram' || el.type === 'image' || el.type === 'table') {
          concept.evidence_artifacts.push({
            artifact_id: `art_${el.element_id}`,
            modality: el.type,
            subtype: el.subtype || 'conceptual_diagram',
            role: el.type === 'diagram' ? 'definitive_proof' : 'quantitative_benchmark',
            semantic_description: el.description || el.caption || `Dẫn chứng thực nghiệm cho ${title}`,
            raw_source_ref: el.element_id,
            confidence: 0.95
          });
          totalEvidence++;
        }
      });

      // Attach analogies for domain
      if (title.toLowerCase().includes('keypoint') || title.toLowerCase().includes('pose') || title.toLowerCase().includes('17')) {
        concept.analogies.push({
          source_domain: 'vẽ người que (stick figure sketching)',
          explanation: 'Thay vì tô vẽ hàng triệu pixel da thịt phức tạp, chỉ định vị 17 khớp bản lề then chốt.'
        });
        concept.common_misconceptions.push(
          'Cho rằng mô hình cần nhận dạng đầy đủ các đường viền cơ thể thay vì ước lượng các tọa độ khớp.'
        );
      }
    });

    // Pass 2: Establish Epistemic Edges (Prerequisites)
    const conceptList = Object.values(concepts);
    for (let i = 0; i < conceptList.length - 1; i++) {
      const src = conceptList[i];
      const tgt = conceptList[i + 1];
      edges.push({
        source_concept_id: src.concept_id,
        target_concept_id: tgt.concept_id,
        relationship_type: src.epistemic_role === 'foundational_axiom' || src.epistemic_role === 'core_mechanism' ? 'prerequisite_to' : 'part_of',
        strength: 0.9,
        pedagogical_justification: `Cần nắm rõ ${src.canonical_name} trước khi chuyển sang ${tgt.canonical_name}`
      });
    }

    return {
      knowledge_space_id: `kspace_${this.slugify(docTree.title || docTree.source_filename)}`,
      source_document_id: docTree.source_filename,
      domain: 'Computer Vision & Deep Learning',
      concepts: conceptList,
      edges,
      total_propositions: totalPropositions,
      total_evidence_artifacts: totalEvidence,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Compiles Knowledge Space into a Duration-Designed Teaching Plan.
   *
   * DESIGN MANDATE:
   * Duration is NOT a compression parameter — it is a teaching design parameter.
   * The question answered here is:
   *   "What is the best way to teach this knowledge in X minutes?"
   * NOT:
   *   "How do I compress the existing slides into X minutes?"
   *
   * Different durations produce QUALITATIVELY DIFFERENT curricula:
   *   3 min  → Core concept only. hook + intuition. No mechanisms.
   *   10 min → Core + Intuition + Analogy. No formal mechanisms.
   *   30 min → Core + Mechanism + Example + Application.
   *   60 min → Full: mechanisms + caveats + comparisons + failure cases.
   */
  compileCurriculum(
    knowledgeIr: KnowledgeIR,
    targetDurationMin: number = 10,
    speakingWpm: number = 135
  ): CurriculumIR {
    const totalSec = targetDurationMin * 60;
    const totalWords = Math.round((totalSec / 60) * speakingWpm);

    // ── Determine duration tier ─────────────────────────────────────────────
    type DurationTier = 'flash_3m' | 'standard_10m' | 'deep_30m' | 'masterclass_60m';
    let tier: DurationTier;
    if (targetDurationMin <= 3) tier = 'flash_3m';
    else if (targetDurationMin <= 10) tier = 'standard_10m';
    else if (targetDurationMin <= 30) tier = 'deep_30m';
    else tier = 'masterclass_60m';

    // ── Role inclusion matrix per tier ──────────────────────────────────────
    // Which epistemic roles are appropriate to teach at each duration?
    type RoleMap = Partial<Record<EpistemicRole, boolean>>;
    const roleInclusion: Record<DurationTier, RoleMap> = {
      flash_3m:        { foundational_axiom: true,  core_mechanism: true },
      standard_10m:    { foundational_axiom: true,  core_mechanism: true },
      deep_30m:        { foundational_axiom: true,  core_mechanism: true,  architectural_tradeoff: true, empirical_proof: true, practical_application: true },
      masterclass_60m: { foundational_axiom: true,  core_mechanism: true,  architectural_tradeoff: true, empirical_proof: true, edge_case_limitation: true, practical_application: true },
    };

    const exclusionRationale: Record<string, string> = {};

    // ── Step 1: Select concepts by role inclusion ───────────────────────────
    let included = knowledgeIr.concepts.filter(c => {
      const allowed = roleInclusion[tier][c.epistemic_role] ?? false;
      if (!allowed) {
        exclusionRationale[c.concept_id] = `Role '${c.epistemic_role}' is not included at the ${tier} tier.`;
      }
      return allowed;
    });

    // ── Step 2: flash_3m: only top 1 core concept ──────────────────────────
    if (tier === 'flash_3m') {
      const cores = included
        .filter(c => c.epistemic_role === 'foundational_axiom' || c.epistemic_role === 'core_mechanism')
        .sort((a, b) => b.significance_score - a.significance_score);
      const top = cores.slice(0, 1);
      included.filter(c => !top.includes(c)).forEach(c => {
        exclusionRationale[c.concept_id] = 'flash_3m can only introduce the single most significant concept.';
      });
      included = top;
    }

    // ── Step 3: Topological sort (prerequisite order) ───────────────────────
    const roleOrder: Record<string, number> = {
      foundational_axiom: 1, core_mechanism: 2, architectural_tradeoff: 3,
      empirical_proof: 4, practical_application: 5, edge_case_limitation: 6,
    };
    const ordered = [...included].sort((a, b) =>
      (roleOrder[a.epistemic_role] || 3) - (roleOrder[b.epistemic_role] || 3)
      || b.significance_score - a.significance_score
    );

    // ── Step 4: Narration layers per tier and role ──────────────────────────
    type NarrationLayer = string;
    const tierLayers: Record<DurationTier, Record<string, NarrationLayer[]>> = {
      flash_3m: {
        foundational_axiom: ['hook_question', 'intuition'],
        core_mechanism:     ['hook_question', 'intuition'],
        _default:           ['intuition'],
      },
      standard_10m: {
        foundational_axiom: ['hook_question', 'intuition', 'analogy_grounding', 'open_question'],
        core_mechanism:     ['hook_question', 'intuition', 'analogy_grounding', 'open_question'],
        _default:           ['intuition', 'open_question'],
      },
      deep_30m: {
        foundational_axiom:     ['hook_question', 'intuition', 'formal_definition', 'analogy_grounding', 'open_question'],
        core_mechanism:         ['hook_question', 'intuition', 'formal_definition', 'mechanism', 'visual_walkthrough', 'worked_example', 'open_question'],
        architectural_tradeoff: ['hook_question', 'comparison', 'caveat', 'open_question'],
        empirical_proof:        ['visual_walkthrough', 'worked_example'],
        practical_application:  ['application', 'worked_example'],
        _default:               ['intuition', 'formal_definition', 'mechanism', 'open_question'],
      },
      masterclass_60m: {
        foundational_axiom:     ['hook_question', 'intuition', 'formal_definition', 'analogy_grounding', 'misconception_inoculation', 'synthesis_callback'],
        core_mechanism:         ['hook_question', 'intuition', 'formal_definition', 'mechanism', 'visual_walkthrough', 'worked_example', 'analogy_grounding', 'misconception_inoculation', 'synthesis_callback', 'open_question'],
        architectural_tradeoff: ['hook_question', 'comparison', 'caveat', 'failure_case', 'synthesis_callback'],
        empirical_proof:        ['visual_walkthrough', 'worked_example', 'caveat'],
        edge_case_limitation:   ['hook_question', 'failure_case', 'caveat', 'synthesis_callback'],
        practical_application:  ['application', 'worked_example', 'comparison', 'synthesis_callback'],
        _default:               ['hook_question', 'intuition', 'formal_definition', 'mechanism', 'open_question'],
      },
    };

    const bloomCeiling: Record<DurationTier, string> = {
      flash_3m: 'Understand', standard_10m: 'Understand',
      deep_30m: 'Apply', masterclass_60m: 'Analyze',
    };
    const evidenceDensity: Record<DurationTier, number> = {
      flash_3m: 0.0, standard_10m: 0.2, deep_30m: 0.6, masterclass_60m: 1.0,
    };

    const layerWordBudget: Record<string, number> = {
      hook_question: 30, intuition: 80, formal_definition: 50, mechanism: 150,
      worked_example: 120, visual_walkthrough: 80, application: 100,
      analogy_grounding: 60, comparison: 100, caveat: 80, failure_case: 80,
      misconception_inoculation: 60, synthesis_callback: 50, open_question: 30,
    };

    // ── Step 5: Weighted time allocation ───────────────────────────────────
    const tierLayerMap = tierLayers[tier];
    const weights = ordered.map(c => {
      const layers = tierLayerMap[c.epistemic_role] ?? tierLayerMap['_default'] ?? ['intuition'];
      const layerWords = layers.reduce((s, l) => s + (layerWordBudget[l] ?? 60), 0);
      return { id: c.concept_id, weight: layerWords * Math.max(0.5, c.significance_score) };
    });
    const totalWeight = weights.reduce((s, w) => s + w.weight, 0) || 1;
    const timeAlloc: Record<string, number> = {};
    weights.forEach(w => { timeAlloc[w.id] = (w.weight / totalWeight) * totalSec; });

    // ── Step 6: Build trajectory ────────────────────────────────────────────
    const epistemic_goal_templates: Record<DurationTier, string> = {
      flash_3m:        'Grasp the essential idea and why it matters.',
      standard_10m:    'Understand well enough to explain it clearly.',
      deep_30m:        'Apply to solve practical problems.',
      masterclass_60m: 'Analyze tradeoffs and predict failure modes.',
    };

    const trajectory: TeachingUnitPlan[] = ordered.map((concept, idx) => {
      const layers = tierLayerMap[concept.epistemic_role] ?? tierLayerMap['_default'] ?? ['intuition'];
      const conceptTime = timeAlloc[concept.concept_id] ?? (totalSec / Math.max(1, ordered.length));
      const layerWords = layers.reduce((s, l) => s + (layerWordBudget[l] ?? 60), 0);
      const scaledWords = Math.max(30, Math.round(layerWords * (conceptTime / totalSec) * ordered.length));
      const density = evidenceDensity[tier];
      const nEvidence = Math.max(0, Math.round(concept.evidence_artifacts.length * density));

      let strategy: TeachingUnitPlan['pedagogical_strategy'] = 'intuitive_analogy_walkthrough';
      if (idx === 0) strategy = 'epistemic_hook_reveal';
      else if (concept.epistemic_role === 'architectural_tradeoff') strategy = 'comparative_tradeoff_analysis';
      else if (nEvidence > 0) strategy = 'empirical_evidence_deconstruction';
      else if (idx === ordered.length - 1) strategy = 'synthesis_and_mastery';

      return {
        unit_id: `unit_${String(idx + 1).padStart(2, '0')}_${concept.concept_id}`,
        concept_id: concept.concept_id,
        unit_title: concept.canonical_name,
        target_duration_sec: Math.round(conceptTime * 10) / 10,
        target_word_budget: scaledWords,
        pedagogical_strategy: strategy,
        bloom_level: (bloomCeiling[tier] as TeachingUnitPlan['bloom_level']),
        primary_evidence_artifact_id: nEvidence >= 1 ? concept.evidence_artifacts[0]?.artifact_id : undefined,
        supporting_artifact_ids: concept.evidence_artifacts.slice(1, nEvidence).map(e => e.artifact_id),
        epistemic_goal: epistemic_goal_templates[tier],
        prerequisite_concept_ids: ordered.slice(0, idx).map(c => c.concept_id),
        // Carry teaching depth for UI display
        narration_layers: layers,
        evidence_density: density,
      } as TeachingUnitPlan & { narration_layers: string[]; evidence_density: number };
    });

    const prunedCount = Math.max(0, knowledgeIr.concepts.length - ordered.length);
    const avgCogDensity = Number(
      (ordered.reduce((sum, c) => sum + c.cognitive_complexity_score, 0) / Math.max(1, ordered.length)).toFixed(2)
    );

    const rationale = {
      flash_3m: `${targetDurationMin}-min flash: Only the most significant core concept is introduced. Goal: WHY it matters.`,
      standard_10m: `${targetDurationMin}-min standard: Core concepts with intuition and analogy. No mechanisms. Goal: I can explain this.`,
      deep_30m: `${targetDurationMin}-min deep dive: Core + mechanisms + examples + applications. Goal: I can apply this.`,
      masterclass_60m: `${targetDurationMin}-min masterclass: Full depth — mechanisms, caveats, comparisons, failure cases. Goal: I can reason about tradeoffs.`,
    }[tier];

    return {
      curriculum_id: `curr_${knowledgeIr.knowledge_space_id}_${targetDurationMin}m`,
      knowledge_space_id: knowledgeIr.knowledge_space_id,
      target_duration_min: targetDurationMin,
      total_target_duration_sec: totalSec,
      total_target_words: totalWords,
      compression_strategy: tier, // backward compat
      teaching_trajectory: trajectory,
      active_concepts_count: ordered.length,
      pruned_concepts_count: prunedCount,
      cognitive_density_score: avgCogDensity,
      created_at: new Date().toISOString(),
      design_rationale: rationale,
      excluded_concept_rationale: exclusionRationale,
    } as CurriculumIR & { design_rationale: string; excluded_concept_rationale: Record<string, string> };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, '')
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join('_') || 'concept';
  }
}

export const knowledgeSpaceEngine = new KnowledgeSpaceEngine();
