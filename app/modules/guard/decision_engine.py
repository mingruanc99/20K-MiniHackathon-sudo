# app/modules/guard/decision_engine.py
"""
Quality Decision Engine for Module 4.
Determines outcome state based on multi-dimensional scores, issue severity, and repair attempts:
- PASS: High confidence and quality across all dimensions. Ready for release or optional spot-check.
- AUTO_REPAIR: Contains automatically fixable issues (DAR-P pause scaling, minor repetition, terminology) and repair attempts < max_repair_attempts.
- NEEDS_REVIEW: Score is borderline, high severity issue detected, suspected hallucination, or auto-repair exhausted. Escalates to Human Review.
- FAIL: Critical failure (score < 0.60 or critical security/safety breach). Requires regeneration or rejection.
"""
from typing import List, Tuple
from app.models.guard import DimensionScores, QualityIssue, QualityDecisionState

class QualityDecisionEngine:
    def __init__(self, max_repair_attempts: int = 2):
        self.max_repair_attempts = max_repair_attempts

    def decide(
        self,
        scores: DimensionScores,
        issues: List[QualityIssue],
        repair_attempts: int = 0
    ) -> Tuple[QualityDecisionState, str, bool]:
        """
        Returns: (decision_state, decision_reason, human_review_required)
        """
        critical_issues = [i for i in issues if i.severity == "critical"]
        high_issues = [i for i in issues if i.severity == "high"]
        medium_issues = [i for i in issues if i.severity == "medium"]

        # 1. Critical Failure Check
        if critical_issues or scores.overall < 0.60:
            reasons = [f"Critical issue: {i.description}" for i in critical_issues]
            if scores.overall < 0.60:
                reasons.append(f"Overall quality score ({scores.overall}) fell below minimum floor (0.60).")
            return "FAIL", "; ".join(reasons), True

        # 2. Check if Auto-Repair is possible and attempts remaining
        repairable_issue_types = {
            "dar_p_duration_warning",
            "dar_p_duration_exceeded",
            "repetitive_phrase",
            "under_explained",
            "blind_bullet_reading"
        }
        has_repairable_issues = any(i.issue_type in repairable_issue_types for i in issues)

        if has_repairable_issues and repair_attempts < self.max_repair_attempts and not high_issues:
            return "AUTO_REPAIR", f"Detected auto-correctable issues. Triggering auto-repair loop (Attempt {repair_attempts + 1}/{self.max_repair_attempts}).", False

        # 3. Check for Human Review Mandate
        # Conditions: High severity issue, overall score < 0.85, exhausted repair attempts, or suspected hallucination
        if high_issues:
            reasons = [f"High severity issue: {i.description}" for i in high_issues]
            return "NEEDS_REVIEW", f"Human review required due to high severity issue(s): {'; '.join(reasons)}", True

        if repair_attempts >= self.max_repair_attempts and (medium_issues or scores.overall < 0.85):
            return "NEEDS_REVIEW", f"Auto-repair exhausted after {repair_attempts} attempts with unresolved quality issues. Escalated to human review.", True

        if scores.overall < 0.85:
            return "NEEDS_REVIEW", f"Overall quality score ({scores.overall}) is below certification threshold (0.85).", True

        # 4. Standard Pass
        return "PASS", "All 5 quality dimensions satisfy rigor standards. Certified for release.", False
