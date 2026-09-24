// src/types/guard.ts
/**
 * Type definitions for Module 4: Quality, Evaluation & Safety
 */

export type QualityDecisionState = 'PASS' | 'NEEDS_REVIEW' | 'AUTO_REPAIR' | 'FAIL';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueCategory = 'content' | 'pedagogy' | 'narrative' | 'visual' | 'technical' | 'security';
export type HumanReviewAction = 'APPROVE' | 'EDIT' | 'REGENERATE' | 'REJECT' | 'FLAG_ISSUE';
export type UserTierType = 'NORMAL' | 'VIP';

export const STRUCTURED_HUMAN_ISSUES = [
  { id: 'wrong_content', label: 'Wrong content (Nội dung sai)' },
  { id: 'missing_content', label: 'Missing content (Thiếu thông tin quan trọng)' },
  { id: 'hallucination', label: 'Hallucination (AI bịa đặt ngoài tài liệu)' },
  { id: 'too_verbose', label: 'Too verbose (Quá dài dòng/dư thừa)' },
  { id: 'too_short', label: 'Too short (Quá ngắn/thiếu chiều sâu)' },
  { id: 'bad_explanation', label: 'Bad explanation (Diễn giải khó hiểu/vụng về)' },
  { id: 'bad_transition', label: 'Bad transition (Chuyển ý giật cục)' },
  { id: 'wrong_visual', label: 'Wrong visual (Chọn sai dạng hình ảnh)' },
  { id: 'unnecessary_visual', label: 'Unnecessary visual (Hình ảnh trang trí không cần thiết)' },
  { id: 'repetition', label: 'Repetition (Lặp lại câu từ hoặc ý tứ)' },
  { id: 'wrong_terminology', label: 'Wrong terminology (Sai thuật ngữ chuyên môn)' },
  { id: 'poor_pedagogy', label: 'Poor pedagogy (Sai phương pháp sư phạm)' },
  { id: 'technical_error', label: 'Technical error (Lỗi kỹ thuật/SSML/thời lượng)' },
  { id: 'other', label: 'Other (Lỗi khác)' }
] as const;

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

export interface HumanReviewRecord {
  review_id: string;
  generation_id: string;
  project_id: string;
  reviewer_id: string;
  action: HumanReviewAction;
  selected_issues: string[];
  severity: IssueSeverity;
  comment?: string;
  edited_script?: Record<string, string>; // scene_id -> edited text
  reviewed_at: number;
}

export interface UserFeedbackRecord {
  feedback_id: string;
  generation_id: string;
  project_id: string;
  scene_id?: string;
  is_useful: boolean; // 👍 Yes (true) / 👎 No (false)
  complaint_tags: string[]; // Content, Explanation, Style, Length, Visual, Accuracy, Other
  comment?: string;
  model: string;
  prompt_version: string;
  user_tier: UserTierType;
  created_at: number;
}

export interface BehavioralSignalMetrics {
  generation_count: number;
  copy_count: number;
  regeneration_count: number;
  edit_count: number;
  export_count: number;
  abandonment_count: number;
  copy_rate: number;
  regeneration_rate: number;
  edit_rate: number;
}

export interface SystemPerformanceMetrics {
  generation_id: string;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  user_tier: UserTierType;
  cache_hit: boolean;
  timestamp: number;
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
