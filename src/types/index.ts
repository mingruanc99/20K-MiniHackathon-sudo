// src/types/index.ts
/**
 * Shared TypeScript type definitions for CLSG-IR System
 */
import { LearningNeed } from './lessonModel';

export type UserRole = 'admin' | 'instructor' | 'student' | 'researcher';

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
  /** 'template' = rule-based narration (default, 0 tokens); 'llm' = narration written by the active LLM. */
  narrationEngine?: 'template' | 'llm';
  /** How many times a section heading may be spoken (default 1). */
  maxSectionTitleMentions?: number;
  accessibility?: {
    captions: boolean;
    highContrast: boolean;
    slowerPacing: boolean;
  };
}

export interface DiagramNode {
  id: string;
  label: string;
  name?: string;
  bbox?: number[];
  region?: string;
  metadata?: Record<string, any>;
}

export interface DiagramEdge {
  source: string;
  target: string;
  label?: string;
  metadata?: Record<string, any>;
}

export interface StructuredDiagram {
  diagram_id: string;
  type: string;
  subtype: string;
  role: string;
  description: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  node_count: number;
  edge_count: number;
  annotations: string[];
  bbox?: number[];
  confidence: number;
  metadata?: Record<string, any>;
}

export interface ContentElement {
  element_id: string;
  type: 'title' | 'heading' | 'paragraph' | 'bullet_point' | 'table' | 'code' | 'equation' | 'note' | 'diagram' | 'annotation' | 'image';
  text: string;
  subtype?: string;
  source_type?: 'slide_text' | 'diagram_annotation' | 'shape' | 'visual_asset';
  role?: string;
  level?: number;
  structured_diagram?: StructuredDiagram;
  diagram_ref?: string;
  description?: string;
  caption?: string;
  /** Normalized [x1, y1, x2, y2] in 0..1 page/slide coordinates (top-left origin). */
  bbox?: number[];
  /** Link to the VisualRegion this element came from (tables, charts, OCR'd images). */
  region_id?: string;
  metadata?: Record<string, any>;
}

export type VisualRegionKind = 'picture' | 'table' | 'chart' | 'diagram' | 'smartart' | 'scanned_page' | 'manual';

export interface RegionOcrResult {
  engine: 'gemini' | 'tesseract' | 'native';
  status: 'pending' | 'done' | 'skipped' | 'failed';
  content_type?: 'table' | 'diagram' | 'chart' | 'text' | 'photo' | 'formula';
  /** Plain reading of the region (used by narration and keyword extraction). */
  text?: string;
  table?: string[][];
  nodes?: string[];
  edges?: { from: string; to: string; label?: string }[];
  summary?: string;
  is_decorative?: boolean;
  confidence?: number;
  error?: string;
  latency_ms?: number;
}

/**
 * A located visual area on a page/slide. Detected before OCR so only these crops
 * (not whole pages) are sent to the OCR engines.
 */
export interface VisualRegion {
  region_id: string;
  section_id: string;
  page_number: number;
  kind: VisualRegionKind;
  /** Normalized [x1, y1, x2, y2] (top-left origin). */
  bbox: number[];
  source: 'pptx_xml' | 'pdf_image_op' | 'pdf_vector_cluster' | 'pdf_textless_page' | 'user';
  /** PPTX media path inside the zip, when the region is an embedded picture. */
  asset_ref?: string;
  /** Text already available without OCR (native tables, chart series, SmartArt nodes). */
  native_text?: string;
  ocr?: RegionOcrResult;
  /** User turned this region off in the Knowledge Inspector. */
  excluded?: boolean;
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
  canonical_markdown?: string;
  semantic_chunks?: any[];
  visual_elements?: any[];
  /** Located image/table/chart/diagram regions (see VisualRegion). */
  visual_regions?: VisualRegion[];
  /** Width / height of a page or slide, for drawing region overlays. */
  page_aspect?: number;
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

export * from './guard';

export interface QualityReport {
  report_id: string;
  decision?: import('./guard').QualityDecisionState;
  decision_reason?: string;
  scores?: import('./guard').DimensionScores;
  issues?: import('./guard').QualityIssue[];
  repair_attempts?: number;
  max_repair_attempts?: number;
  human_review_reason?: string;

  overall_status: QualityStatus;
  overall_quality_score: number;
  dar_p_ratio: number;
  target_duration_sec: number;
  actual_duration_sec: number;
  duration_error_pct: number;
  /** DAR-P error before the pause-only repair. */
  dar_p_pre_repair_pct?: number;
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

export * from './narrative';
export * from './knowledgeSpace';
export * from './knowledgeTree';
import { KnowledgeTree } from './knowledgeTree';
import { NarrativeIR } from './narrative';
import { KnowledgeIR, CurriculumIR } from './knowledgeSpace';

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
  knowledge_ir?: KnowledgeIR;
  curriculum_ir?: CurriculumIR;
  narrative_ir?: NarrativeIR;
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
  documentTree?: CanonicalDocumentTree;
  lessonBlueprint?: LessonBlueprint;
  blueprint?: LessonBlueprint;
  clsgIr?: VerifiedCLSG_IR;
  knowledgeIr?: KnowledgeIR;
  curriculumIr?: CurriculumIR;
  narrativeIr?: NarrativeIR;
  qualityReport?: QualityReport;
  executionLogs?: ExecutionTraceLog[];
  /** Weighted chapter/page/keyword tree edited in the Knowledge Inspector. */
  knowledgeTree?: KnowledgeTree;
  /** Summary of the latest benchmark run (full logs live in projects/{id}/runs). */
  lastBenchmark?: import('../services/benchmark/benchmarkTypes').BenchmarkRunSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionTraceLog {
  stage: string;
  duration_sec: number;
  timestamp: string;
  details: Record<string, any>;
}

// ============================================================================
// ADMIN DASHBOARD & OBSERVABILITY TYPES
// ============================================================================

export type AdminPermission =
  | 'view_dashboard'
  | 'view_users'
  | 'view_lessons'
  | 'view_content_quality'
  | 'view_ai_analytics'
  | 'view_errors'
  | 'view_tts'
  | 'view_langfuse'
  | 'manage_prompts'
  | 'manage_lessons';

export type TimeFilter = 'today' | '7d' | '30d' | '90d';

export type QualityIssueType =
  | 'METADATA_LEAK'
  | 'DUPLICATE_CONTENT'
  | 'INVALID_CHARACTER'
  | 'TEMPLATE_LEAK'
  | 'FILLER_CONTENT'
  | 'ROLE_VIOLATION'
  | 'BROKEN_FORMAT'
  | 'EMPTY_CONTENT';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ContentQualityIssue {
  id: string;
  lessonId: string;
  lessonTitle: string;
  sectionId: string;
  issueType: QualityIssueType;
  severity: ErrorSeverity;
  rawOutput: string;
  cleanedOutput: string;
  model: string;
  promptVersion: string;
  timestamp: string;
  traceId?: string;
  resolved?: boolean;
}

export interface AILlmMetric {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  byModel: {
    model: string;
    requests: number;
    tokens: number;
    cost: number;
    avgLatencyMs: number;
    errorRate: number;
  }[];
  byFeature: {
    feature: string;
    requests: number;
    tokens: number;
    cost: number;
    avgLatencyMs: number;
  }[];
  byPromptVersion: {
    prompt: string;
    version: string;
    requests: number;
    qualityScore: number;
    cost: number;
  }[];
}

export interface ErrorRecord {
  id: string;
  timestamp: string;
  type: QualityIssueType | 'GENERATION_ERROR' | 'PARSER_ERROR' | 'TTS_ERROR' | 'LLM_ERROR' | 'TIMEOUT';
  lessonId: string;
  lessonTitle: string;
  sectionId: string;
  model: string;
  severity: ErrorSeverity;
  status: 'unresolved' | 'investigating' | 'resolved';
  message: string;
  traceId?: string;
  stackSnippet?: string;
}

export interface PromptMetadata {
  id: string;
  name: string;
  version: string;
  status: 'production' | 'staging' | 'deprecated';
  model: string;
  qualityScore: number;
  cost: number;
  avgLatencyMs: number;
  templateSnippet: string;
  createdAt: string;
  updatedAt: string;
  traceCount: number;
}

export interface TTSMetric {
  requests: number;
  totalDurationMin: number;
  successRate: number;
  avgLatencyMs: number;
  failureRate: number;
  totalCost: number;
  byVoice: {
    voice: string;
    provider: string;
    requests: number;
    durationMin: number;
    cost: number;
  }[];
  byProvider: {
    provider: string;
    requests: number;
    avgLatencyMs: number;
    cost: number;
  }[];
}

export interface EvaluationMetric {
  relevance: number;
  accuracy: number;
  clarity: number;
  conciseness: number;
  structure: number;
  instructionAdherence: number;
  overallScore: number;
  evaluatorType: 'llm_judge' | 'rule_based' | 'human';
  failedSamplesCount: number;
  trend: number[];
}

export interface LangfuseTraceSummary {
  traceId: string;
  name: string;
  sessionId: string;
  userId: string;
  lessonId: string;
  latencyMs: number;
  totalCost: number;
  status: 'success' | 'error';
  tags: string[];
  url: string;
  timestamp: string;
  model: string;
}

export interface AdminOverviewKPIs {
  totalUsers: number;
  activeUsers: number;
  totalLessons: number;
  publishedLessons: number;
  aiRequests: number;
  aiCost: number;
  avgLatencyMs: number;
  errorRate: number;
  contentQualityScore: number;
}

export interface LessonAdminItem {
  id: string;
  title: string;
  author: string;
  authorEmail: string;
  sectionsCount: number;
  status: 'Published' | 'Draft' | 'Generating' | 'Failed' | 'Archived';
  qualityScore: number;
  aiCost: number;
  latencyMs: number;
  model: string;
  promptVersion: string;
  traceId: string;
  lastUpdated: string;
  sections: {
    id: string;
    title: string;
    role: string;
    narration: string;
    durationSec: number;
  }[];
}

export interface UserAdminRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  lessonsCount: number;
  activityStatus: 'active' | 'idle' | 'offline';
  aiRequestsCount: number;
  ttsRequestsCount: number;
  lastActive: string;
  totalCost: number;
  recentActivity: string[];
}

