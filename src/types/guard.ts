// src/types/guard.ts
/**
 * Type definitions for Module 4: Quality, Evaluation & Safety
 */

export type QualityDecisionState = 'PASS' | 'NEEDS_REVIEW' | 'AUTO_REPAIR' | 'FAIL';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueCategory = 'content' | 'pedagogy' | 'narrative' | 'visual' | 'technical' | 'security';

export interface QualityIssue {
  issue_id: string;
  category: IssueCategory;
  issue_type: string;
  severity: IssueSeverity;
  scene_id?: string;
  location?: string;
  description: string;
  repair_suggestion?: string;
}

export interface DimensionScores {
  content: number;
  pedagogy: number;
  narrative: number;
  visual: number;
  technical: number;
  overall: number;
}

export interface GoldenTestCase {
  case_id: string;
  title: string;
  domain: string;
  input_text: string;
  expected_concepts: string[];
  expected_visual_types: string[];
  min_content_score: number;
  min_pedagogy_score: number;
  safety_expected_pass: boolean;
}

export interface RegressionReport {
  run_id: string;
  version_n: string;
  version_n_plus_1: string;
  total_cases: number;
  passed_cases: number;
  pass_rate_pct: number;
  safety_pass_rate_pct: number;
  regression_detected: boolean;
  regressed_cases: string[];
  dimension_deltas: Record<string, number>;
  timestamp: number;
}
