// src/types/transitionIR.ts
/**
 * ============================================================================
 * TRANSITION IR — TypeScript Type Definitions
 * ============================================================================
 * Mirror of app/models/transition_ir.py
 *
 * The Transition Intelligence Layer (TIL) produces one TransitionIR per
 * adjacent concept pair (A, B) in the lecture. This drives:
 *   - The closing sentence of section A (plants a gap)
 *   - The opening sentence of section B (answers the gap)
 *
 * The LectureTransitionMap holds all transitions for a lecture and is
 * used by the Studio UI to visualize, inspect, and audit transition quality.
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
// TAXONOMY
// ─────────────────────────────────────────────────────────────────────────────

export type TransitionRelationship =
  // Epistemic Progression
  | 'LimitationToSolution'
  | 'ProblemToMethod'
  | 'QuestionToAnswer'
  | 'ObservationToExplanation'
  | 'HypothesisToEvidence'
  // Conceptual Structure
  | 'DefinitionToExample'
  | 'AbstractToConcreteInstance'
  | 'SimpleToAdvanced'
  | 'WholeToComponent'
  | 'ComponentToWhole'
  | 'PartToPart'
  // Causal & Temporal
  | 'CauseToEffect'
  | 'InputToTransformation'
  | 'TransformationToOutput'
  | 'StepToNextStep'
  // Comparative & Contrastive
  | 'ComparisonSetup'
  | 'ContrastHighlight'
  | 'TradeoffAnalysis'
  // Prerequisite Topology
  | 'PrerequisiteToDependent'
  | 'FoundationToExtension'
  | 'ConceptToApplication'
  | 'TheoryToPractice'
  // Narrative/Rhetorical
  | 'AnomalyToResolution'
  | 'ScopeNarrowDown'
  | 'ScopeWideOut'
  | 'SummaryToDepth';

export type TransitionStrategy =
  | 'gap_bridge'
  | 'curiosity_hook'
  | 'contrast_pivot'
  | 'zoom_transition'
  | 'causal_chain'
  | 'sequential_step'
  | 'analogical_bridge'
  | 'question_plant';

// ─────────────────────────────────────────────────────────────────────────────
// QUALITY METRICS
// ─────────────────────────────────────────────────────────────────────────────

export interface TransitionQualityMetrics {
  /** Overall quality. 1.0 = seamless idea-to-idea. 0.0 = robotic slide-nav. */
  transition_quality_score: number;
  /** How tightly the bridge text is grounded in both concepts. */
  bridge_coherence_score: number;
  /** Whether A and B feel like continuous thought, not a hard cut. */
  concept_continuity_score: number;
  /** Whether a human teacher would naturally say this. Penalizes slide phrases. */
  human_lecture_flow_score: number;
  /**
   * Slide-structure dependency.
   * 0.0 = fully idea-centric (desired).
   * 1.0 = fully slide-centric (failure).
   */
  slide_dependency_score: number;
  /** Composite score (computed property on Python side). */
  overall?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: TRANSITION IR
// ─────────────────────────────────────────────────────────────────────────────

export interface TransitionIR {
  transition_id: string; // e.g. "tr_01_02"

  // Source and destination
  from_section_id: string;
  to_section_id: string;
  from_concept_label: string; // e.g. "Bounding Box"
  to_concept_label: string;   // e.g. "Pose Representation"

  // Semantic analysis
  relationship: TransitionRelationship;
  bridge_reason: string;
  learner_question: string;
  strategy: TransitionStrategy;

  // Generated bridge text
  /** Last 1–2 sentences of section A. Plants the gap. Never names next topic. */
  closing_sentence_a: string;
  /** First 1–2 sentences of section B. Answers the gap. */
  opening_sentence_b: string;
  /** Full spoken bridge (closing + opening joined). */
  bridge_text: string;

  // Quality
  quality?: TransitionQualityMetrics;

  // Anti-pattern tracking
  slide_centric_phrases_detected: string[];

  generation_method: 'rule_based' | 'llm_assisted' | 'hybrid';
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE TRANSITION MAP
// ─────────────────────────────────────────────────────────────────────────────

export interface LectureTransitionMap {
  map_id: string;
  blueprint_id: string;
  document_id: string;

  transitions: TransitionIR[];

  // Aggregate quality
  average_transition_quality: number;
  average_bridge_coherence: number;
  average_human_flow: number;
  average_slide_dependency: number;

  total_transitions: number;
  /** Transition IDs with overall quality < 0.6 — flagged for review. */
  weak_transitions: string[];

  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER TYPES for UI
// ─────────────────────────────────────────────────────────────────────────────

/** Human-readable label for each relationship type */
export const RELATIONSHIP_LABELS: Record<TransitionRelationship, string> = {
  LimitationToSolution:      'Limitation → Solution',
  ProblemToMethod:           'Problem → Method',
  QuestionToAnswer:          'Question → Answer',
  ObservationToExplanation:  'Observation → Explanation',
  HypothesisToEvidence:      'Hypothesis → Evidence',
  DefinitionToExample:       'Definition → Example',
  AbstractToConcreteInstance:'Abstract → Concrete',
  SimpleToAdvanced:          'Simple → Advanced',
  WholeToComponent:          'Whole → Component',
  ComponentToWhole:          'Component → Whole',
  PartToPart:                'Part → Part',
  CauseToEffect:             'Cause → Effect',
  InputToTransformation:     'Input → Transform',
  TransformationToOutput:    'Transform → Output',
  StepToNextStep:            'Step N → Step N+1',
  ComparisonSetup:           'Comparison Setup',
  ContrastHighlight:         'Contrast Highlight',
  TradeoffAnalysis:          'Tradeoff Analysis',
  PrerequisiteToDependent:   'Prerequisite → Dependent',
  FoundationToExtension:     'Foundation → Extension',
  ConceptToApplication:      'Concept → Application',
  TheoryToPractice:          'Theory → Practice',
  AnomalyToResolution:       'Anomaly → Resolution',
  ScopeNarrowDown:           'Scope: Wide → Narrow',
  ScopeWideOut:              'Scope: Narrow → Wide',
  SummaryToDepth:            'Summary → Depth',
};

/** Color coding for relationship categories in the UI */
export const RELATIONSHIP_COLORS: Record<string, string> = {
  // Epistemic Progression — Blue
  LimitationToSolution:      '#3b82f6',
  ProblemToMethod:           '#3b82f6',
  QuestionToAnswer:          '#3b82f6',
  ObservationToExplanation:  '#3b82f6',
  HypothesisToEvidence:      '#3b82f6',
  // Conceptual Structure — Purple
  DefinitionToExample:       '#8b5cf6',
  AbstractToConcreteInstance:'#8b5cf6',
  SimpleToAdvanced:          '#8b5cf6',
  WholeToComponent:          '#8b5cf6',
  ComponentToWhole:          '#8b5cf6',
  PartToPart:                '#8b5cf6',
  // Causal & Temporal — Green
  CauseToEffect:             '#10b981',
  InputToTransformation:     '#10b981',
  TransformationToOutput:    '#10b981',
  StepToNextStep:            '#10b981',
  // Comparative — Orange
  ComparisonSetup:           '#f59e0b',
  ContrastHighlight:         '#f59e0b',
  TradeoffAnalysis:          '#f59e0b',
  // Prerequisite Topology — Teal
  PrerequisiteToDependent:   '#14b8a6',
  FoundationToExtension:     '#14b8a6',
  ConceptToApplication:      '#14b8a6',
  TheoryToPractice:          '#14b8a6',
  // Narrative — Pink
  AnomalyToResolution:       '#ec4899',
  ScopeNarrowDown:           '#ec4899',
  ScopeWideOut:              '#ec4899',
  SummaryToDepth:            '#ec4899',
};

export function getQualityColor(score: number): string {
  if (score >= 0.8) return '#10b981'; // green
  if (score >= 0.6) return '#f59e0b'; // amber
  return '#ef4444';                   // red
}
