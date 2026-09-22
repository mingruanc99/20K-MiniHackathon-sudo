// src/types/lessonModel.ts
/**
 * Core Data Models & Schemas for Lesson Understanding-First Architecture
 */

export type ConceptImportance = 'core' | 'supporting' | 'example' | 'application' | 'evidence' | 'noise';

export interface ConceptItem {
  concept_id: string;
  name: string;
  definition: string;
  importance: ConceptImportance;
  prerequisites: string[];
  introduced_by?: string[];
  explained_by?: string[];
  illustrated_by?: string[];
  applied_by?: string[];
  related_concepts: string[];
}

export type RelationshipType = 'explains' | 'enables' | 'contrasts' | 'illustrates' | 'applies' | 'deepens' | 'continues' | 'summarizes';

export interface ConceptRelationship {
  source_concept_id: string;
  target_concept_id: string;
  relationship_type: RelationshipType;
  explanation: string;
}

export interface LearningNeed {
  after_concept_id: string;
  natural_question: string;
  resolved_by_concept_id: string;
  pedagogical_hook?: string;
}

export type ContentCategory = 'core' | 'supporting' | 'example' | 'context' | 'noise';

export interface ContentPrioritizationItem {
  content_id: string;
  source_slide_id?: string;
  text: string;
  category: ContentCategory;
  importance_reason: string;
  required_for_understanding: boolean;
  supports?: string[];
  can_be_omitted: boolean;
  narration_priority: 'high' | 'medium' | 'low';
}

export interface ContentPrioritization {
  total_items: number;
  core_items: ContentPrioritizationItem[];
  supporting_items: ContentPrioritizationItem[];
  example_items: ContentPrioritizationItem[];
  context_items: ContentPrioritizationItem[];
  noise_items: ContentPrioritizationItem[];
  omitted_content_count: number;
}

export type TeachingArcStage =
  | 'ENTRY'
  | 'HOOK'
  | 'PROBLEM'
  | 'MOTIVATION'
  | 'CONCEPT'
  | 'MECHANISM'
  | 'EXAMPLE'
  | 'INTERPRETATION'
  | 'APPLICATION'
  | 'SUMMARY';

export interface TeachingUnit {
  unit_id: string;
  title: string;
  stage: TeachingArcStage;
  slide_ids: string[];
  primary_concept_id: string;
  supporting_concept_ids: string[];
  learning_need?: LearningNeed;
  target_duration_sec: number;
  target_word_budget: number;
  narration_focus: string;
  key_talking_points: string[];
  omitted_details: string[];
}

export interface LessonModel {
  lesson_goal: string;
  main_problem: string;
  target_audience: string;
  core_concepts: ConceptItem[];
  supporting_concepts: ConceptItem[];
  examples: string[];
  applications: string[];
  evidence: string[];
  concept_relationships: ConceptRelationship[];
  learning_dependencies: string[];
  learning_needs: LearningNeed[];
  teaching_arc: TeachingArcStage[];
  teaching_units: TeachingUnit[];
  slide_mapping: Array<{ slide_id: string; unit_id: string; role: string }>;
}

export interface SemanticCritiqueIssue {
  check_id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  unit_id?: string;
  recommendation: string;
  auto_repair_applied?: boolean;
}

export interface SemanticCritiqueReport {
  semantic_coherence_score: number;
  learning_need_satisfaction_score: number;
  premature_disclosure_score: number;
  slide_reading_score: number;
  metadata_leak_score: number;
  overall_semantic_status: 'PASSED' | 'WARNING' | 'FAILED';
  issues: SemanticCritiqueIssue[];
  auto_repairs: string[];
  needs_regeneration: boolean;
}
