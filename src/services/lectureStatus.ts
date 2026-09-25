// src/services/lectureStatus.ts
/**
 * Where a lecture stands, derived from what the project actually contains (never stored),
 * so the board column always matches reality.
 */
import { Project, CanonicalDocumentTree } from '../types';
import { getBuiltinCnnTree } from '../pipeline/module1_extractor/builtinCnnTree';

export type LectureStage = 'uploaded' | 'review' | 'done' | 'attention';

export const STAGES: { id: LectureStage; title: string; hint: string; action: string }[] = [
  { id: 'uploaded', title: 'Đã tải lên', hint: 'Chưa quét cấu trúc và trọng số', action: 'Quét tài liệu' },
  { id: 'review', title: 'Cần duyệt cấu trúc', hint: 'Kiểm tra chương, thời lượng, keyword rồi tạo bài giảng', action: 'Duyệt cấu trúc' },
  { id: 'done', title: 'Đã tạo', hint: 'Bài giảng đạt các ngưỡng kiểm định', action: 'Đọc bài giảng' },
  { id: 'attention', title: 'Cần xem lại', hint: 'Có chỉ số chưa đạt (thời lượng, lặp, từ nối…)', action: 'Xem lại' }
];

export function lectureStage(p: Project): LectureStage {
  const report = p.qualityReport || p.clsgIr?.quality_report;
  if (p.clsgIr && report) {
    if (p.status === 'failed' || report.decision === 'FAIL' || report.decision === 'NEEDS_REVIEW') return 'attention';
    return 'done';
  }
  if (p.status === 'failed') return 'attention';
  if (p.knowledgeTree) return 'review';
  return 'uploaded';
}

/** The document to work from: the stored extraction, or the built-in demo deck. */
export function lectureDocument(p: Project): CanonicalDocumentTree | null {
  if (p.canonicalDocument) return p.canonicalDocument;
  if (p.projectId === 'proj_demo_cnn_001' || /cnn_intro\.pptx$/.test(p.source.fileName)) return getBuiltinCnnTree();
  return null;
}

/** Grade stamp shown in the logbook: status as the teacher would write it. */
export function gradeStamp(p: Project): { label: string; tone: string } {
  const stage = lectureStage(p);
  if (stage === 'done') {
    const report = p.qualityReport || p.clsgIr?.quality_report;
    const score = report ? Math.round(report.overall_quality_score * 100) : 0;
    return { label: score >= 85 ? 'Tốt' : score >= 70 ? 'Khá' : 'Đạt', tone: 'text-print' };
  }
  if (stage === 'attention') return { label: 'Cần sửa', tone: 'text-pen' };
  if (stage === 'review') return { label: 'Chờ duyệt', tone: 'text-ink-soft' };
  return { label: 'Mới', tone: 'text-ink-faint' };
}

export const fmtClock = (sec?: number) => {
  const v = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

export const DECISION_LABEL: Record<string, string> = {
  PASS: 'Đạt',
  AUTO_REPAIR: 'Đạt sau khi tự sửa',
  NEEDS_REVIEW: 'Cần xem lại',
  FAIL: 'Chưa đạt'
};
