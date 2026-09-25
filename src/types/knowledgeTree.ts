// src/types/knowledgeTree.ts
/**
 * Weighted knowledge tree shown in the Knowledge Inspector.
 *
 * document -> chapter -> page/slide -> keyword
 * Structural nodes carry a duration (seconds) that acts as their weight in the lecture;
 * keyword nodes carry an importance weight (0..1). Users can edit, lock and exclude nodes;
 * the pipeline then uses page durations as time budgets and kept keywords as key concepts.
 */
import type { WeightedKeyword } from '../pipeline/services/keywordExtractor';

export type KnowledgeNodeKind = 'document' | 'chapter' | 'page' | 'keyword';

export interface KnowledgeTreeNode {
  id: string;
  kind: KnowledgeNodeKind;
  title: string;
  /** Page/slide id for page nodes (DocumentSection.section_id). */
  section_id?: string;
  /** Seconds of lecture time (document/chapter/page). */
  duration_sec?: number;
  /** Importance 0..1 (keywords; pages carry their LLM/local importance too). */
  weight?: number;
  keyword?: WeightedKeyword;
  locked?: boolean;
  excluded?: boolean;
  children: KnowledgeTreeNode[];
}

export interface KnowledgeTreeSettings {
  min_keyword_weight: number;
  max_keywords_per_page: number;
  max_pages: number;
  target_duration_sec: number;
}

export interface KnowledgeTreeStats {
  pages_total: number;
  pages_llm: number;
  keywords_total: number;
  regions_total: number;
  regions_ocr_done: number;
  scan_ms: number;
  llm_calls: number;
  total_tokens: number;
  /** True when some pages/regions were left to local rules because of the time budget or caps. */
  truncated: boolean;
  notes: string[];
}

export interface KnowledgeTree {
  tree_id: string;
  document_id: string;
  created_at: string;
  updated_at: string;
  model: string;
  settings: KnowledgeTreeSettings;
  stats: KnowledgeTreeStats;
  root: KnowledgeTreeNode;
  /** Last study calibration (syllabus / quiz results) applied to this tree. */
  calibration?: {
    syllabus?: string;
    quiz?: string;
    weights: { slide: number; syllabus: number; quiz: number };
    applied_at: string;
    used_llm: boolean;
  };
}
