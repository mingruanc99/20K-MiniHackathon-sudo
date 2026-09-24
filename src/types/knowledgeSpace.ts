// src/types/knowledgeSpace.ts
/**
 * Types for First-Principles Knowledge Space and Time-Aware Curriculum IR
 */

export type EpistemicRole =
  | 'foundational_axiom'
  | 'core_mechanism'
  | 'architectural_tradeoff'
  | 'empirical_proof'
  | 'edge_case_limitation'
  | 'practical_application';

export interface AtomicProposition {
  prop_id: string;
  statement: string;
  grounding_source: string;
  confidence: number;
}

export interface EvidenceArtifact {
  artifact_id: string;
  modality: 'diagram' | 'image' | 'table' | 'formula' | 'code_snippet';
  subtype: string;
  role: 'definitive_proof' | 'intuitive_illustration' | 'quantitative_benchmark' | 'structural_specification';
  semantic_description: string;
  spatial_features?: Record<string, any>;
  raw_source_ref: string;
  confidence: number;
}

export interface ConceptAnalogy {
  source_domain: string;
  explanation: string;
}

export interface ConceptNode {
  concept_id: string;
  canonical_name: string;
  formal_definition: string;
  epistemic_role: EpistemicRole;
  cognitive_complexity_score: number;
  significance_score: number;
  propositions: AtomicProposition[];
  analogies: ConceptAnalogy[];
  common_misconceptions: string[];
  evidence_artifacts: EvidenceArtifact[];
  keywords: string[];
}

export interface EpistemicEdge {
  source_concept_id: string;
  target_concept_id: string;
  relationship_type:
    | 'prerequisite_to'
    | 'proves'
    | 'part_of'
    | 'isomorphic_to'
    | 'contrasts_with'
    | 'operationalized_by';
  strength: number;
  pedagogical_justification?: string;
}

export interface KnowledgeIR {
  knowledge_space_id: string;
  source_document_id: string;
  domain: string;
  concepts: ConceptNode[];
  edges: EpistemicEdge[];
  total_propositions: number;
  total_evidence_artifacts: number;
  created_at: string;
}

export type PedagogicalUnitStrategy =
  | 'epistemic_hook_reveal'
  | 'intuitive_analogy_walkthrough'
  | 'empirical_evidence_deconstruction'
  | 'comparative_tradeoff_analysis'
  | 'synthesis_and_mastery';

export interface TeachingUnitPlan {
  unit_id: string;
  concept_id: string;
  unit_title: string;
  target_duration_sec: number;
  target_word_budget: number;
  pedagogical_strategy: PedagogicalUnitStrategy;
  bloom_level: string;
  primary_evidence_artifact_id?: string;
  supporting_artifact_ids: string[];
  epistemic_goal: string;
  prerequisite_concept_ids: string[];
}

export type DurationTier = 'flash_3m' | 'standard_10m' | 'deep_30m' | 'masterclass_60m';

export interface CurriculumIR {
  curriculum_id: string;
  knowledge_space_id: string;
  target_duration_min: number; // 3, 10, 30, 60
  total_target_duration_sec: number;
  total_target_words: number;

  // New: teaching design tier (replaces compression_strategy conceptually)
  teaching_design_strategy?: DurationTier;

  // Backward compat: accepts both old values and new DurationTier values
  compression_strategy: DurationTier | 'flash_overview' | 'core_mechanics' | 'comprehensive_deep_dive' | 'full_mastery';

  teaching_trajectory: TeachingUnitPlan[];
  active_concepts_count: number;
  pruned_concepts_count: number;
  cognitive_density_score: number;
  created_at: string;

  // New: explains WHY this curriculum was designed this way
  design_rationale?: string;

  // New: maps excluded concept_id → reason for exclusion
  excluded_concept_rationale?: Record<string, string>;
}

