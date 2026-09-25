// src/services/benchmark/benchmarkTypes.ts
import type { LLMCallRecord, UsageSummary } from '../llm/usageMeter';

/** Every value is computed from the run's final output; formulas are in docs/specs/EVALUATION.md. */
export interface BenchmarkMetrics {
  scenes: number;
  words_total: number;
  sentences_total: number;
  target_duration_sec: number;
  estimated_duration_sec: number;
  /** |T_est − T_target| / T_target × 100, after the pause-only repair. */
  dar_p_error_pct: number;
  /** Same, before any repair (words + default pauses). */
  dar_p_pre_repair_pct: number;
  vtc: number;
  cns: number;
  grounding: number;
  language: number;
  anti_repetition: number;
  /** Sentence-initial connectives / sentences. */
  connective_density: number;
  heading_mentions: number;
  heading_repeats: number;
  prosody_validity: number;
  /** Share of each page's top-3 active keywords that the narration actually says. */
  keyword_coverage: number | null;
  /** Visual regions whose content reached the narration / regions located. */
  visual_coverage: number | null;
  dimensions: { content: number; pedagogy: number; narrative: number; visual: number; technical: number; overall: number };
  decision: string;
}

export interface BenchmarkTiming {
  stage: string;
  ms: number;
}

export interface BenchmarkRunLog {
  run_id: string;
  kind: 'pipeline' | 'scan';
  app_version: string;
  project_id: string;
  project_title: string;
  created_at: string;
  model: string;
  config: {
    target_duration_sec: number;
    wpm: number;
    narration_language: string;
    narration_engine: 'template' | 'llm';
    learner_level: string;
    used_knowledge_tree: boolean;
  };
  timings: BenchmarkTiming[];
  total_ms: number;
  metrics?: BenchmarkMetrics;
  discourse?: {
    connectives_before: number;
    connectives_kept: number;
    connectives_removed: number;
    heading_mentions_before: number;
    heading_repeats_removed: number;
    transition_sentences_dropped: number;
  };
  scan?: {
    pages: number;
    pages_llm: number;
    regions: number;
    regions_ocr_done: number;
    keywords: number;
    truncated: boolean;
  };
  tokens: UsageSummary;
  calls: LLMCallRecord[];
  notes: string[];
}

export interface BenchmarkRunSummary {
  run_id: string;
  kind: 'pipeline' | 'scan';
  created_at: string;
  model: string;
  narration_engine?: string;
  overall_quality?: number;
  dar_p_error_pct?: number;
  connective_density?: number;
  heading_repeats?: number;
  total_tokens: number;
  cost_usd: number;
  cost_complete: boolean;
  estimated_calls: number;
  total_ms: number;
}
