// src/types/index.ts
/**
 * Shared TypeScript type definitions for CLSG-IR System
 */
import { LearningNeed } from './lessonModel';

export type UserRole = 'student' | 'instructor' | 'researcher';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role?: UserRole;
  createdAt?: string;
}

export type FileType = 'pptx' | 'docx' | 'markdown' | 'text' | 'demo' | 'pdf';

export interface SourceAsset {
  fileName: string;
  fileType: FileType;
  fileSize?: number;
  cloudinaryPublicId?: string;
  cloudinaryUrl?: string;
  localPath?: string;
}

export type LearnerLevel = 'beginner' | 'undergraduate' | 'graduate' | 'professional';
export type NarrationStyle = 'conversational' | 'academic' | 'rigorous' | 'engaging';
export type VisualDensity = 'minimal' | 'balanced' | 'rich';

export interface LanguagePolicy {
  narration_language: 'vi' | 'en';
  technical_terminology_language: 'en' | 'vi';
  preserve_technical_terms: boolean;
  natural_vietnamese: boolean;
}

export interface UserConfiguration {
  language: string;
  learnerLevel: LearnerLevel;
  priorKnowledge: string;
  targetDurationSeconds: number;
  targetWpm: number;
  narrationStyle: NarrationStyle;
  visualDensity: VisualDensity;
  narration_language?: 'vi' | 'en';
  technical_terminology_language?: 'en' | 'vi';
  preserve_technical_terms?: boolean;
  natural_vietnamese?: boolean;
  language_policy?: LanguagePolicy;
  projectTerminology?: Record<string, { canonical: string; language: string; reason?: string }>;
  interactionLevel?: 'low' | 'moderate' | 'high';
  accessibility?: {
    captions: boolean;
    highContrast: boolean;
    slowerPacing: boolean;
  };
}

export interface ContentElement {
  element_id: string;
  type: 'title' | 'heading' | 'paragraph' | 'bullet_point' | 'table' | 'code' | 'equation' | 'note';
  text: string;
  level?: number;
  metadata?: Record<string, any>;
}

export interface DocumentSection {
  section_id: string;
  title: string;
  order: number;
  elements: ContentElement[];
  raw_text?: string;
}

export interface CanonicalDocumentTree {
  document_id: string;
  title: string;
  source_type: FileType;
  source_filename: string;
  total_sections: number;
  sections: DocumentSection[];
  extraction_time_ms: number;
  metadata?: Record<string, any>;
}

export type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
export type PedagogicalRole = 'hook' | 'definition' | 'mechanism' | 'example' | 'comparison' | 'summary' | 'exercise';

// Context-Aware Instructional Narrative Upgrade Roles & Strategies
export type SlideRole =
  | 'INTRODUCTION'
  | 'HOOK'
  | 'THINK'
  | 'QUESTION'
  | 'MECHANISM'
  | 'TECHNICAL'
  | 'CORE_CONCEPT'
  | 'KEY_EXPLANATION'
  | 'PROCESS'
  | 'EXAMPLE'
  | 'APPLICATION'
  | 'COMPARISON'
  | 'EVIDENCE'
  | 'SUMMARY'
  | 'TRANSITION'
  | 'DECORATIVE';

export interface SectionSummaryInfo {
  id: string;
  title: string;
  type: SlideRole;
  narration: string;
  opening_phrase?: string;
  core_question?: string;
}

export interface GlobalNarrativeContext {
  lesson_topic: string;
  previous_sections: SectionSummaryInfo[];
  current_section: {
    id: string;
    type: SlideRole;
    title: string;
  };
  next_section?: {
    id: string;
    type: SlideRole;
    title: string;
  };
  used_phrases: string[];
  used_openings: string[];
  used_concepts: string[];
}

export type ImportanceLevel = 'high' | 'medium' | 'low';
export type InstructionalValue = 'high' | 'medium' | 'low';
export type VerbosityLevel = 'minimal' | 'concise' | 'standard' | 'detailed';

export type ContentType =
  | 'definition'
  | 'concept'
  | 'mechanism'
  | 'process'
  | 'example'
  | 'application'
  | 'comparison'
  | 'data'
  | 'result'
  | 'summary'
  | 'question'
  | 'diagram'
  | 'workflow'
  | 'formula'
  | 'table'
  | 'image'
  | 'illustration'
  | 'title';

export type NarrativeFunction =
  | 'INTRODUCE'
  | 'EXPLAIN'
  | 'ELABORATE'
  | 'ILLUSTRATE'
  | 'COMPARE'
  | 'APPLY'
  | 'EVIDENCE'
  | 'SUMMARIZE'
  | 'TRANSITION';

export type RelationshipType =
  | 'INTRODUCES'
  | 'CONTINUES'
  | 'DEEPENS'
  | 'EXPLAINS'
  | 'ILLUSTRATES'
  | 'APPLIES'
  | 'CONTRASTS'
  | 'SUMMARIZES'
  | 'TRANSITIONS_TO'
  | 'PROVIDES_EVIDENCE_FOR'
  | 'NONE';

export type OpeningStrategy =
  | 'DIRECT'
  | 'BRIDGE_FROM_PREVIOUS'
  | 'QUESTION'
  | 'CONTEXT'
  | 'EXAMPLE_INTRODUCTION'
  | 'SUMMARY_RECALL';

export type BodyStrategy =
  | 'CONCEPTUAL'
  | 'CAUSAL'
  | 'PROCESS'
  | 'COMPARISON'
  | 'EXAMPLE'
  | 'EVIDENCE'
  | 'APPLICATION';

export type ClosingStrategy =
  | 'NONE'
  | 'TRANSITION_TO_NEXT'
  | 'CONCEPT_RECAP'
  | 'EXAMPLE_INTERPRETATION'
  | 'KEY_TAKEAWAY';

export type ListStrategy =
  | 'NONE'
  | 'ORDERED_LIST'
  | 'CATEGORY_LIST'
  | 'SEQUENTIAL_PROCESS'
  | 'COMPARISON_LIST'
  | 'OPTIONAL_LIST';

export interface SlideRelationship {
  type: RelationshipType;
  reason: string;
}

export interface SlideAnalysis {
  slide_role: SlideRole;
  importance: ImportanceLevel;
  instructional_value: InstructionalValue;
  content_type: ContentType;
  core_message?: string;
  supporting_points?: string[];
  excluded_content?: string[];
  requires_explanation: boolean;
  requires_transition: boolean;
  requires_example: boolean;
  explanation_strategy?: string;
  list_strategy?: ListStrategy;
}

export interface NarrativePlan {
  narrative_function: NarrativeFunction;
  previous_slide_id?: string;
  next_slide_id?: string;
  relationship_to_previous?: SlideRelationship;
  relationship_to_next?: SlideRelationship;
  opening_strategy: OpeningStrategy;
  body_strategy: BodyStrategy;
  closing_strategy: ClosingStrategy;
  list_strategy: ListStrategy;
  verbosity?: VerbosityLevel;
  already_explained_concepts?: string[];
  current_new_information?: string[];
  future_information?: string[];
  learning_need?: LearningNeed;
}

export interface SectionPlan {
  section_id: string;
  title: string;
  order: number;
  pedagogical_function: PedagogicalRole;
  bloom_level: BloomLevel;
  target_duration_sec: number;
  target_word_budget: number;
  key_concepts: string[];
  prerequisite_concepts?: string[];
  instructional_goal: string;
  importance?: 'low' | 'medium' | 'high';
  slide_analysis?: SlideAnalysis;
  narrative_plan?: NarrativePlan;
}

export * from './lessonModel';
import { LessonModel, ContentPrioritization, TeachingUnit } from './lessonModel';

export interface LessonBlueprint {
  blueprint_id: string;
  document_id: string;
  lecture_title: string;
  total_target_duration_sec: number;
  total_word_budget: number;
  target_wpm: number;
  pedagogical_strategy: string;
  sections: SectionPlan[];
  lesson_model?: LessonModel;
  content_prioritization?: ContentPrioritization;
  teaching_units?: TeachingUnit[];
  created_at?: string;
}

export type PauseType =
  | 'syntactic'
  | 'semantic'
  | 'concept_boundary'
  | 'example_transition'
  | 'section_transition'
  | 'emphasis'
  | 'natural';

export interface WordPause {
  pause_id: string;
  pause_type: PauseType;
  after_word: string;
  word_index: number;
  duration_ms: number;
  justification: string;
}

export interface NarrationSentence {
  id: string;
  text: string;
  prosody: {
    pause_after_ms: number;
    pause_type: PauseType;
    rate: 'x-slow' | 'slow' | 'medium' | 'fast';
    energy: 'soft' | 'medium' | 'loud';
    emphasis: string[];
  };
  word_pauses?: WordPause[];
  estimated_speaking_time_sec?: number;
}

export interface ProsodyPlan {
  section_id: string;
  sentences: NarrationSentence[];
  total_words: number;
  total_speaking_sec: number;
  total_pause_sec: number;
  effective_scene_duration_sec: number;
  ssml_full: string;
}

export type VisualTaxonomy =
  | 'diagram'
  | 'flowchart'
  | 'comparison'
  | 'infographic'
  | 'chart'
  | 'table'
  | 'screenshot'
  | 'illustration'
  | 'real_world_example'
  | 'timeline'
  | 'equation'
  | 'process_visualization'
  | 'concept_map';

export interface VisualCue {
  cue_id: string;
  section_id: string;
  trigger_timestamp_sec: number;
  trigger_word?: string;
  visual_need: boolean;
  visual_type: VisualTaxonomy;
  visual_purpose: string;
  content_focus: string[];
  learning_support: string;
  importance_level: 'low' | 'medium' | 'high';
  element_target?: string;
  action?: string;
  renderer_hints?: Record<string, any>;
}

export interface CLSGScene {
  section_id: string;
  topic: string;
  order: number;
  pedagogical_function: PedagogicalRole;
  learning_goal: string;
  slide_analysis?: SlideAnalysis;
  narrative_plan?: NarrativePlan;
  narration: {
    text: string;
    word_count: number;
    sentences: NarrationSentence[];
  };
  prosody_plan: ProsodyPlan;
  visual_cues: VisualCue[];
  section_summary?: string;
  scene_start_time_sec: number;
  scene_end_time_sec: number;
  scene_duration_sec: number;
}

export type QualityStatus = 'PASSED' | 'WARNING' | 'FAILED';

export interface ValidationCheck {
  check_id: string;
  rule_name: string;
  category: 'temporal_dar_p' | 'factual_consistency' | 'visual_coherence' | 'prosody_validity' | 'schema' | 'language_terminology' | 'narrative_coherence';
  status: QualityStatus;
  score: number;
  threshold: number;
  actual_value: any;
  message: string;
  auto_repaired?: boolean;
}

export interface QualityReport {
  report_id: string;
  overall_status: QualityStatus;
  overall_quality_score: number;
  dar_p_ratio: number;
  target_duration_sec: number;
  actual_duration_sec: number;
  duration_error_pct: number;
  factual_consistency_score: number;
  visual_necessity_score: number;
  taxonomy_validity_score: number;
  prosody_coherence_score: number;
  language_terminology_score?: number;
  narrative_coherence_score?: number;
  language_traces?: string[];
  checks: ValidationCheck[];
  auto_repairs_applied: string[];
  human_review_required: boolean;
  timestamp: string;
}

export interface VerifiedCLSG_IR {
  ir_version: string;
  ir_id: string;
  document_id: string;
  blueprint_id: string;
  lecture_title: string;
  configuration: UserConfiguration;
  total_scenes: number;
  total_duration_sec: number;
  total_words: number;
  scenes: CLSGScene[];
  lesson_model?: LessonModel;
  content_prioritization?: ContentPrioritization;
  teaching_units?: TeachingUnit[];
  quality_report: QualityReport;
  verified_at: string;
}

export type ProjectProcessingStatus =
  | 'idle'
  | 'uploaded'
  | 'extracting'
  | 'extracted'
  | 'planning'
  | 'planned'
  | 'generating'
  | 'generated'
  | 'validating'
  | 'verified'
  | 'failed';

export interface Project {
  projectId: string;
  userId: string;
  title: string;
  description?: string;
  source: SourceAsset;
  configuration: UserConfiguration;
  status: ProjectProcessingStatus;
  canonicalDocument?: CanonicalDocumentTree;
  lessonBlueprint?: LessonBlueprint;
  clsgIr?: VerifiedCLSG_IR;
  qualityReport?: QualityReport;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionTraceLog {
  stage: string;
  duration_sec: number;
  timestamp: string;
  details: Record<string, any>;
}
