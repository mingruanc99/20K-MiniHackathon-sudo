# app/models/guard.py
"""
Data models for Module 4: Quality, Evaluation & Safety
Architecture:
QUALITY -> EVALUATION -> HUMAN REVIEW -> USER FEEDBACK -> SYSTEM MONITORING -> IMPROVEMENT

Five core subsystems:
A. Automated Quality Assurance & Decision Engine
B. Human-in-the-loop Review
C. User Feedback & Product Evaluation
D. System / Cost Evaluation & Budget Guard
E. Privacy / Security / Golden Dataset Evaluation
"""
from typing import List, Literal, Optional, Dict, Any, Tuple
from pydantic import BaseModel, Field

QualityStatus = Literal["PASSED", "WARNING", "FAILED"]
QualityDecisionState = Literal["PASS", "NEEDS_REVIEW", "AUTO_REPAIR", "FAIL"]
IssueSeverity = Literal["low", "medium", "high", "critical"]
IssueCategory = Literal["content", "pedagogy", "narrative", "visual", "technical", "security"]

class QualityIssue(BaseModel):
    issue_id: str = Field(description="Unique issue identifier")
    category: IssueCategory = Field(description="Issue category dimension")
    issue_type: str = Field(description="Specific type, e.g. hallucination, repetitive_phrase, missing_content, wrong_visual")
    severity: IssueSeverity = Field(default="medium", description="Issue severity level")
    scene_id: Optional[str] = Field(default=None, description="Affected scene identifier if localized")
    location: Optional[str] = Field(default=None, description="Location within scene (e.g. sentence_2)")
    description: str = Field(description="Human-readable description of the detected issue")
    repair_suggestion: Optional[str] = Field(default=None, description="Actionable strategy to repair automatically")

class DimensionScores(BaseModel):
    content: float = Field(ge=0.0, le=1.0, description="Fidelity, coverage, grounding, anti-hallucination")
    pedagogy: float = Field(ge=0.0, le=1.0, description="Bloom taxonomy compliance, explanation depth, necessity")
    narrative: float = Field(ge=0.0, le=1.0, description="Script flow, transitions, anti-bullet-reading, no repetition")
    visual: float = Field(ge=0.0, le=1.0, description="Text-visual alignment, necessity, 13 canonical taxonomies")
    technical: float = Field(ge=0.0, le=1.0, description="Schema validity, SSML prosody, provenance completeness")
    overall: float = Field(ge=0.0, le=1.0, description="Balanced aggregate score across all 5 dimensions")

class ValidationCheck(BaseModel):
    check_id: str = Field(description="Unique check identifier, e.g. chk_dar_p")
    rule_name: str = Field(description="Human-readable rule name")
    category: Literal[
        "temporal_dar_p",
        "factual_consistency",
        "visual_coherence",
        "prosody_validity",
        "content_fidelity",
        "text_visual_consistency",
        "provenance_traceability",
        "narrative_coherence",
        "pedagogical_rigor",
        "schema_validity"
    ]
    status: QualityStatus
    score: float = Field(description="Normalized evaluation score between 0.0 and 1.0")
    threshold: float = Field(description="Minimum acceptable score threshold")
    actual_value: Any = Field(description="Observed value during evaluation")
    message: str = Field(description="Detailed evaluation outcome or diagnostic notice")
    auto_repaired: bool = Field(default=False)

class QualityReport(BaseModel):
    report_id: str = Field(description="Unique quality report identifier")
    decision: QualityDecisionState = Field(default="PASS", description="Engine decision: PASS | NEEDS_REVIEW | AUTO_REPAIR | FAIL")
    decision_reason: str = Field(default="All multi-dimensional quality criteria satisfied.", description="Explicit rationale for the decision")
    scores: DimensionScores = Field(
        default_factory=lambda: DimensionScores(
            content=1.0, pedagogy=1.0, narrative=1.0, visual=1.0, technical=1.0, overall=1.0
        ),
        description="Comprehensive 5-dimensional scores"
    )
    issues: List[QualityIssue] = Field(default_factory=list, description="Structured issues detected by Automated QA")
    repair_attempts: int = Field(default=0, description="Current count of auto-repair cycles applied")
    max_repair_attempts: int = Field(default=2, description="Upper bound before escalating to human review")
    human_review_required: bool = Field(default=False, description="True if decision is NEEDS_REVIEW or critical issues found")
    human_review_reason: Optional[str] = Field(default=None, description="Why human review is mandated")

    # Backward compatibility attributes with legacy consumers
    overall_status: QualityStatus = Field(default="PASSED")
    overall_quality_score: float = Field(ge=0.0, le=1.0, default=1.0)
    dar_p_ratio: float = Field(default=0.0, description="Duration Adherence Ratio with Prosody: |T_act - T_tgt| / T_tgt")
    target_duration_sec: float = Field(default=0.0)
    actual_duration_sec: float = Field(default=0.0)
    duration_error_pct: float = Field(default=0.0)
    
    factual_consistency_score: float = Field(default=1.0, ge=0.0, le=1.0)
    visual_necessity_score: float = Field(default=1.0, ge=0.0, le=1.0)
    taxonomy_validity_score: float = Field(default=1.0, ge=0.0, le=1.0)
    prosody_coherence_score: float = Field(default=1.0, ge=0.0, le=1.0)
    content_fidelity_score: float = Field(default=1.0, ge=0.0, le=1.0)
    text_visual_consistency_score: float = Field(default=1.0, ge=0.0, le=1.0)
    provenance_traceability_score: float = Field(default=1.0, ge=0.0, le=1.0)

    checks: List[ValidationCheck] = Field(default_factory=list)
    auto_repairs_applied: List[str] = Field(default_factory=list)
    timestamp: str = Field(default="")
