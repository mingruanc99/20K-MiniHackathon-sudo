// src/components/pipeline/QualityGuardViewer.tsx
import React, { useState } from 'react';
import { QualityReport, STRUCTURED_HUMAN_ISSUES, HumanReviewAction, IssueSeverity } from '../../types';
import { humanReviewService } from '../../services/humanReviewService';
import { userFeedbackService } from '../../services/userFeedbackService';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  ThumbsUp,
  ThumbsDown,
  UserCheck,
  RefreshCw,
  Edit3,
  Flag,
  Check,
  BarChart2,
  Activity,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

export const QualityGuardViewer: React.FC<{
  report: QualityReport | null;
  projectId?: string;
  generationId?: string;
  onRefresh?: () => void;
}> = ({ report, projectId = 'demo_project', generationId = 'gen_default', onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'qa' | 'human_review' | 'feedback_telemetry'>('qa');

  // Human Review State
  const [reviewAction, setReviewAction] = useState<HumanReviewAction | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [reviewSeverity, setReviewSeverity] = useState<IssueSeverity>('medium');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // User Feedback State
  const [feedbackVote, setFeedbackVote] = useState<boolean | null>(null);
  const [complaintTags, setComplaintTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Telemetry metrics
  const behavioral = userFeedbackService.getBehavioralMetrics();
  const failurePatterns = userFeedbackService.getFailurePatterns();

  if (!report) {
    return (
      <div className="p-8 text-center bg-paper-sheet rounded-xl border border-rule">
        <ShieldCheck className="w-8 h-8 text-ink-faint mx-auto mb-2" />
        <p className="text-sm text-ink-faint">Chưa chạy kiểm định chất lượng. Hãy chạy Module 4.</p>
      </div>
    );
  }

  const decision = report.decision || (report.overall_status === 'PASSED' ? 'PASS' : report.overall_status === 'FAILED' ? 'FAIL' : 'NEEDS_REVIEW');
  const scores = report.scores || {
    content: report.factual_consistency_score,
    pedagogy: report.visual_necessity_score,
    narrative: report.narrative_coherence_score || 0.92,
    visual: report.taxonomy_validity_score,
    technical: 0.95,
    overall: report.overall_quality_score
  };

  const handleIssueToggle = (issueId: string) => {
    setSelectedIssues((prev) =>
      prev.includes(issueId) ? prev.filter((id) => id !== issueId) : [...prev, issueId]
    );
  };

  const handleComplaintToggle = (tag: string) => {
    setComplaintTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmitHumanReview = (action: HumanReviewAction) => {
    humanReviewService.recordReview({
      generationId,
      projectId,
      reviewerId: 'educator_lead',
      action,
      selectedIssues,
      severity: reviewSeverity,
      comment: reviewComment
    });
    setReviewSubmitted(true);
    setReviewAction(null);
  };

  const handleSubmitFeedback = (vote: boolean) => {
    setFeedbackVote(vote);
    userFeedbackService.recordFeedback({
      generationId,
      projectId,
      isUseful: vote,
      complaintTags,
      comment: feedbackComment
    });
    if (vote) {
      userFeedbackService.recordCopy();
    } else {
      userFeedbackService.recordRegenerate();
    }
    setFeedbackSubmitted(true);
  };

  return (
    <div className="space-y-6">
      {/* Module 4 Subsystem Navigation Bar */}
      <div className="bg-paper-sheet border border-rule rounded-xl p-2 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('qa')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
              activeTab === 'qa'
                ? 'bg-paper-band text-print shadow-2xs font-bold'
                : 'text-ink-soft hover:text-ink hover:bg-paper-band'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>A — Automated QA & Decision</span>
          </button>
          <button
            onClick={() => setActiveTab('human_review')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
              activeTab === 'human_review'
                ? 'bg-paper-band text-print shadow-2xs font-bold'
                : 'text-ink-soft hover:text-ink hover:bg-paper-band'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>B — Human Review</span>
            {report.human_review_required && (
              <span className="w-2 h-2 rounded-full bg-pen animate-pulse ml-1" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('feedback_telemetry')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 ${
              activeTab === 'feedback_telemetry'
                ? 'bg-paper-band text-print shadow-2xs font-bold'
                : 'text-ink-soft hover:text-ink hover:bg-paper-band'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>C — Feedback & Monitoring</span>
          </button>
        </div>

        <div className="text-xs text-ink-faint px-3 py-1 bg-paper-band rounded-lg border border-rule/80 font-mono">
          Engine: Quality, Evaluation & Safety
        </div>
      </div>

      {/* Decision Engine Master Banner */}
      <div className="bg-paper-sheet border border-rule rounded-xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-print uppercase tracking-wider">
            Module 4 — Quality, Evaluation & Safety
          </span>
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <span>Hệ Thống Đánh Giá Toàn Diện & Quyết Định</span>
            {decision === 'PASS' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-paper-band text-print border border-rule-strong">
                DECISION: PASS
              </span>
            )}
            {decision === 'AUTO_REPAIR' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-paper-band text-print border border-rule-strong">
                DECISION: AUTO REPAIR
              </span>
            )}
            {decision === 'NEEDS_REVIEW' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-pen-soft text-pen border border-pen-line">
                DECISION: NEEDS REVIEW
              </span>
            )}
            {decision === 'FAIL' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-pen-soft text-pen border border-pen-line">
                DECISION: FAIL
              </span>
            )}
          </h2>
          <p className="text-xs text-ink-soft mt-1 max-w-2xl">
            {report.decision_reason || 'Đã kiểm tra 5 chiều chất lượng: Nội dung, Sư phạm, Diễn ngôn, Hình ảnh trực quan và Kỹ thuật.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-center px-4 py-2.5 rounded-xl bg-paper-band border border-rule">
            <div className="text-xs text-ink-faint font-medium">Điểm Tổng Thể</div>
            <div className="text-xl font-black text-ink">
              {Math.round(scores.overall * 100)}%
            </div>
          </div>
          <div
            className={`px-4 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider ${
              decision === 'PASS'
                ? 'bg-paper-band text-print border-rule-strong'
                : decision === 'AUTO_REPAIR'
                ? 'bg-paper-band text-print border-rule-strong'
                : decision === 'NEEDS_REVIEW'
                ? 'bg-pen-soft text-pen border-pen-line'
                : 'bg-pen-soft text-pen border-pen-line'
            }`}
          >
            {decision === 'PASS'
              ? 'ĐẠT CHUẨN'
              : decision === 'AUTO_REPAIR'
              ? 'TỰ ĐỘNG SỬA'
              : decision === 'NEEDS_REVIEW'
              ? 'CẦN REVIEW'
              : 'KHÔNG ĐẠT'}
          </div>
        </div>
      </div>

      {/* TAB 1: AUTOMATED QA & DECISION */}
      {activeTab === 'qa' && (
        <div className="space-y-6">
          {/* 5-Dimensional Radar / Score Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* 1. Content Quality */}
            <div className="p-4 bg-paper-sheet rounded-xl border border-rule shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink-soft">1. Content Quality</span>
                <span className="font-bold text-print">{Math.round(scores.content * 100)}%</span>
              </div>
              <div className="w-full bg-paper-band rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-cover h-1.5 rounded-full"
                  style={{ width: `${Math.round(scores.content * 100)}%` }}
                />
              </div>
              <p className="text-xs text-ink-faint leading-relaxed">
                Độ bám sát tài liệu gốc, không bịa đặt, bảo toàn thuật ngữ.
              </p>
            </div>

            {/* 2. Pedagogical Quality */}
            <div className="p-4 bg-paper-sheet rounded-xl border border-rule shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink-soft">2. Pedagogy</span>
                <span className="font-bold text-print">{Math.round(scores.pedagogy * 100)}%</span>
              </div>
              <div className="w-full bg-paper-band rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-cover h-1.5 rounded-full"
                  style={{ width: `${Math.round(scores.pedagogy * 100)}%` }}
                />
              </div>
              <p className="text-xs text-ink-faint leading-relaxed">
                Tuân thủ Bloom & Gagné, giải thích sâu sắc, đúng trọng tâm.
              </p>
            </div>

            {/* 3. Narrative Quality */}
            <div className="p-4 bg-paper-sheet rounded-xl border border-rule shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink-soft">3. Narrative Flow</span>
                <span className="font-bold text-print">{Math.round(scores.narrative * 100)}%</span>
              </div>
              <div className="w-full bg-paper-band rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-print h-1.5 rounded-full"
                  style={{ width: `${Math.round(scores.narrative * 100)}%` }}
                />
              </div>
              <p className="text-xs text-ink-faint leading-relaxed">
                Chuyển ý tự nhiên, không đọc gạch đầu dòng máy móc, không lặp từ.
              </p>
            </div>

            {/* 4. Visual Quality */}
            <div className="p-4 bg-paper-sheet rounded-xl border border-rule shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink-soft">4. Visual Quality</span>
                <span className="font-bold text-print">{Math.round(scores.visual * 100)}%</span>
              </div>
              <div className="w-full bg-paper-band rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-cover h-1.5 rounded-full"
                  style={{ width: `${Math.round(scores.visual * 100)}%` }}
                />
              </div>
              <p className="text-xs text-ink-faint leading-relaxed">
                Đồng bộ Text–Visual, 13 loại hình ảnh chuẩn hoá, có tính thiết yếu.
              </p>
            </div>

            {/* 5. Technical Quality */}
            <div className="p-4 bg-paper-sheet rounded-xl border border-rule shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink-soft">5. Technical & DAR-P</span>
                <span className="font-bold text-print">{Math.round(scores.technical * 100)}%</span>
              </div>
              <div className="w-full bg-paper-band rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-cover h-1.5 rounded-full"
                  style={{ width: `${Math.round(scores.technical * 100)}%` }}
                />
              </div>
              <p className="text-xs text-ink-faint leading-relaxed">
                Sai số DAR-P ({report.duration_error_pct}%), cú pháp SSML, nguồn gốc slide.
              </p>
            </div>
          </div>

          {/* Auto Repairs Applied (if any) */}
          {report.auto_repairs_applied && report.auto_repairs_applied.length > 0 && (
            <div className="bg-paper-band border border-rule-strong rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-cover font-bold text-xs">
                <Wrench className="w-4 h-4 text-print" />
                <span>
                  Đã Tự Động Khắc Phục ({report.auto_repairs_applied.length} điều chỉnh trong vòng lặp Auto-Repair):
                </span>
              </div>
              <ul className="list-disc list-inside text-xs text-print space-y-1">
                {report.auto_repairs_applied.map((repair, idx) => (
                  <li key={idx}>{repair}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Detected Quality Issues List */}
          {report.issues && report.issues.length > 0 && (
            <div className="bg-paper-sheet border border-rule rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-pen" />
                  <span>Danh Sách Vấn Đề Chất Lượng Phát Hiện ({report.issues.length})</span>
                </h3>
                <span className="text-xs text-ink-faint">Phân loại theo mức độ nghiêm trọng</span>
              </div>

              <div className="space-y-2">
                {report.issues.map((issue) => (
                  <div
                    key={issue.issue_id}
                    className="p-3 rounded-lg border border-rule bg-paper-band flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            issue.severity === 'critical'
                              ? 'bg-pen-soft text-pen'
                              : issue.severity === 'high'
                              ? 'bg-pen-soft text-pen'
                              : 'bg-paper-band text-print'
                          }`}
                        >
                          {issue.severity}
                        </span>
                        <span className="font-semibold text-ink font-mono">[{issue.category.toUpperCase()}]</span>
                        <span className="text-ink-soft">{issue.description}</span>
                      </div>
                      {issue.repair_suggestion && (
                        <div className="text-xs text-ink-faint italic pl-2 border-l-2 border-rule-strong">
                          Gợi ý: {issue.repair_suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Validation Checks Table */}
          <div className="bg-paper-sheet border border-rule rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-ink">Chi Tiết Kiểm Định Từng Chỉ Số</h3>
            <div className="divide-y divide-rule text-xs">
              {report.checks.map((chk) => (
                <div key={chk.check_id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      {chk.status === 'PASSED' ? (
                        <CheckCircle2 className="w-4 h-4 text-print shrink-0" />
                      ) : chk.status === 'WARNING' ? (
                        <AlertTriangle className="w-4 h-4 text-pen shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-pen shrink-0" />
                      )}
                      <span className="font-semibold text-ink">{chk.rule_name}</span>
                      {chk.auto_repaired && (
                        <span className="px-1.5 py-0.5 rounded bg-paper-band text-print text-[11px] font-mono border border-rule-strong">
                          Auto-Repaired
                        </span>
                      )}
                    </div>
                    <div className="text-ink-faint text-xs pl-6">{chk.message}</div>
                  </div>
                  <div className="text-right sm:min-w-[120px] pl-6 sm:pl-0">
                    <div className="font-mono font-bold text-ink">{chk.actual_value}</div>
                    <div className="text-[11px] text-ink-faint">Điểm: {Math.round(chk.score * 100)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HUMAN-IN-THE-LOOP REVIEW WORKSPACE */}
      {activeTab === 'human_review' && (
        <div className="bg-paper-sheet border border-rule rounded-xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
            <div>
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-print" />
                <span>Không Gian Thẩm Định Chuyên Gia (Human-in-the-Loop Review)</span>
              </h3>
              <p className="text-xs text-ink-faint mt-0.5">
                Chuyên gia thẩm định bài giảng, đánh giá nội dung nhạy cảm, xác nhận lỗi và đưa ra quyết định phát hành.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleSubmitHumanReview('APPROVE')}
                className="px-3.5 py-2 bg-print hover:bg-cover text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>[APPROVE] Phê Duyệt</span>
              </button>
              <button
                onClick={() => setReviewAction('EDIT')}
                className="px-3.5 py-2 bg-cover hover:bg-cover text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" />
                <span>[EDIT] Chỉnh Sửa</span>
              </button>
              <button
                onClick={() => handleSubmitHumanReview('REGENERATE')}
                className="px-3.5 py-2 bg-pen hover:bg-pen text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
                <span>[REGENERATE] Sinh Lại</span>
              </button>
              <button
                onClick={() => setReviewAction('REJECT')}
                className="px-3.5 py-2 bg-pen hover:bg-pen text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>[REJECT] Từ Chối</span>
              </button>
            </div>
          </div>

          {/* Feedback Success Notification */}
          {reviewSubmitted && (
            <div className="p-4 bg-paper-band border border-rule-strong text-print rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-print" />
                <span>Bản ghi Human Review đã được lưu thành công vào audit trail của hệ thống.</span>
              </div>
              <button
                onClick={() => setReviewSubmitted(false)}
                className="text-xs underline font-bold"
              >
                Đóng
              </button>
            </div>
          )}

          {/* Structured Issue Flagging Form */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                Structured Issue Taxonomy (Chọn các lỗi phát hiện nếu có):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {STRUCTURED_HUMAN_ISSUES.map((issue) => (
                  <label
                    key={issue.id}
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer transition ${
                      selectedIssues.includes(issue.id)
                        ? 'bg-paper-band border-rule-strong text-cover font-semibold'
                        : 'bg-paper-sheet border-rule text-ink-soft hover:bg-paper-band'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIssues.includes(issue.id)}
                      onChange={() => handleIssueToggle(issue.id)}
                      className="rounded text-print focus:ring-print"
                    />
                    <span className="text-xs">{issue.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Severity Selection */}
            <div className="flex items-center space-x-3 text-xs">
              <span className="font-bold text-ink-soft">Mức độ nghiêm trọng:</span>
              {(['low', 'medium', 'high', 'critical'] as IssueSeverity[]).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setReviewSeverity(sev)}
                  className={`px-3 py-1 rounded-md text-xs font-bold uppercase transition ${
                    reviewSeverity === sev
                      ? 'bg-cover text-white'
                      : 'bg-paper-band text-ink-soft hover:bg-rule'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>

            {/* Review Comment */}
            <div>
              <label className="text-xs font-bold text-ink block mb-1">
                Nhận xét chuyên gia & chỉ thị sửa đổi:
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Ghi chú chi tiết nguyên nhân, ví dụ: 'Cần diễn giải sâu hơn về cơ chế trượt kernel thay vì chỉ đọc công thức...'"
                rows={3}
                className="w-full text-xs p-3 rounded-lg border border-rule-strong focus:ring-2 focus:ring-print focus:border-print"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => handleSubmitHumanReview('FLAG_ISSUE')}
                disabled={selectedIssues.length === 0}
                className="px-4 py-2 bg-cover-deep hover:bg-cover disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Gắn Cờ Lỗi Cấu Trúc</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USER FEEDBACK & PRODUCT MONITORING */}
      {activeTab === 'feedback_telemetry' && (
        <div className="space-y-6">
          {/* Behavioral Signal KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-paper-sheet border border-rule rounded-xl p-4 shadow-2xs space-y-1">
              <div className="text-xs text-ink-faint font-semibold uppercase tracking-wider">
                Script Copy Rate
              </div>
              <div className="text-2xl font-black text-ink">
                {Math.round(behavioral.copy_rate * 100)}%
              </div>
              <p className="text-xs text-ink-faint">
                {behavioral.copy_count} lượt sao chép / {behavioral.generation_count} lượt sinh
              </p>
            </div>

            <div className="bg-paper-sheet border border-rule rounded-xl p-4 shadow-2xs space-y-1">
              <div className="text-xs text-ink-faint font-semibold uppercase tracking-wider">
                Regeneration Rate
              </div>
              <div className="text-2xl font-black text-ink">
                {Math.round(behavioral.regeneration_rate * 100)}%
              </div>
              <p className="text-xs text-ink-faint">
                {behavioral.regeneration_count} lượt yêu cầu sinh lại
              </p>
            </div>

            <div className="bg-paper-sheet border border-rule rounded-xl p-4 shadow-2xs space-y-1">
              <div className="text-xs text-ink-faint font-semibold uppercase tracking-wider">
                Script Edit Rate
              </div>
              <div className="text-2xl font-black text-ink">
                {Math.round(behavioral.edit_rate * 100)}%
              </div>
              <p className="text-xs text-ink-faint">
                {behavioral.edit_count} lượt chỉnh sửa nội dung
              </p>
            </div>
          </div>

          {/* User Feedback Submission Widget */}
          <div className="bg-paper-sheet border border-rule rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">Khảo Sát Người Dùng: Bài Giảng Này Có Hữu Ích Không?</h3>
                <p className="text-xs text-ink-faint mt-0.5">
                  Phản hồi trực tiếp giúp hệ thống tự động tối ưu hóa prompt và lọc lỗi.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleSubmitFeedback(true)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition flex items-center space-x-1.5 ${
                    feedbackVote === true
                      ? 'bg-print text-white border-print'
                      : 'bg-paper-sheet text-ink-soft border-rule hover:bg-paper-band'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>Có, rất hữu ích</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackVote(false)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition flex items-center space-x-1.5 ${
                    feedbackVote === false
                      ? 'bg-pen text-white border-pen'
                      : 'bg-paper-sheet text-ink-soft border-rule hover:bg-paper-band'
                  }`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span>Chưa tốt</span>
                </button>
              </div>
            </div>

            {/* If negative vote, show complaint categories */}
            {feedbackVote === false && (
              <div className="space-y-3 pt-3 border-t border-rule">
                <div className="text-xs font-bold text-ink">
                  Điều gì cần cải thiện? (Chọn các yếu tố):
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {['Nội dung', 'Diễn giải khó hiểu', 'Phong cách/Giọng điệu', 'Quá dài dòng', 'Sai hình ảnh trực quan', 'Độ chính xác thuật ngữ', 'Khác'].map(
                    (tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleComplaintToggle(tag)}
                        className={`px-3 py-1 rounded-full border text-xs font-medium transition ${
                          complaintTags.includes(tag)
                            ? 'bg-pen-soft text-pen border-pen-line font-bold'
                            : 'bg-paper-sheet text-ink-soft border-rule hover:bg-paper-band'
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  )}
                </div>

                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Góp ý thêm để chúng tôi cải thiện mô hình..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-lg border border-rule-strong focus:ring-2 focus:ring-pen focus:border-pen"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSubmitFeedback(false)}
                    className="px-4 py-1.5 bg-pen hover:bg-pen text-white rounded-lg text-xs font-bold transition"
                  >
                    Gửi Góp Ý
                  </button>
                </div>
              </div>
            )}

            {feedbackSubmitted && (
              <div className="p-3 bg-paper-band border border-rule-strong text-print rounded-lg text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-print shrink-0" />
                <span>Cảm ơn bạn! Đóng góp của bạn đã được ghi nhận để cải tiến pipeline trong lần phát hành kế tiếp.</span>
              </div>
            )}
          </div>

          {/* Failure Pattern Aggregation Card */}
          <div className="bg-paper-sheet border border-rule rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <Activity className="w-4 h-4 text-print" />
                <span>Phân Tích Gom Cụm Lỗi (Failure Pattern Analysis)</span>
              </h3>
              <span className="text-xs font-bold text-ink-soft">
                Mức độ hài lòng: {failurePatterns.satisfactionRatePct}%
              </span>
            </div>

            <div className="p-3 bg-paper-band border border-rule-strong rounded-lg text-xs text-cover flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-print shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Nhận Định Tự Động: </span>
                {failurePatterns.topActionableInsight}
              </div>
            </div>

            {failurePatterns.complaintBreakdown.length > 0 && (
              <div className="space-y-2 pt-2">
                {failurePatterns.complaintBreakdown.map((item) => (
                  <div key={item.tag} className="space-y-1 text-xs">
                    <div className="flex justify-between text-ink-soft font-medium">
                      <span>{item.tag}</span>
                      <span>
                        {item.count} lượt ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-paper-band rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-pen h-1.5 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
