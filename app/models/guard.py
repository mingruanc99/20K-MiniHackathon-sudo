# app/models/guard.py
"""
Data models for Module 4: Quality & Visual Guard
Evaluates DAR-P, Factual Consistency, Visual Necessity, and Taxonomy Validity.
"""
from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field

QualityStatus = Literal["PASSED", "WARNING", "FAILED"]

class ValidationCheck(BaseModel):
    check_id: str = Field(description="Unique check identifier, e.g. chk_dar_p")
    rule_name: str = Field(description="Human-readable rule name")
    category: Literal["temporal_dar_p", "factual_consistency", "visual_coherence", "prosody_validity"]
    status: QualityStatus
    score: float = Field(description="Normalized evaluation score between 0.0 and 1.0")
    threshold: float = Field(description="Minimum acceptable score threshold")
    actual_value: Any = Field(description="Observed value during evaluation")
    message: str = Field(description="Detailed evaluation outcome or diagnostic notice")
    auto_repaired: bool = Field(default=False)

class QualityReport(BaseModel):
    report_id: str = Field(description="Unique quality report identifier")
    overall_status: QualityStatus
    overall_quality_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Weighted aggregate quality index"
    )
    dar_p_ratio: float = Field(
        description="Duration Adherence Ratio with Prosody: |T_act - T_tgt| / T_tgt"
    )
    target_duration_sec: float
    actual_duration_sec: float
    duration_error_pct: float = Field(description="DAR-P expressed as percentage")
    
    factual_consistency_score: float = Field(ge=0.0, le=1.0)
    visual_necessity_score: float = Field(ge=0.0, le=1.0)
    taxonomy_validity_score: float = Field(ge=0.0, le=1.0)
    prosody_coherence_score: float = Field(ge=0.0, le=1.0)

    checks: List[ValidationCheck] = Field(default_factory=list)
    auto_repairs_applied: List[str] = Field(default_factory=list)
    human_review_required: bool = Field(default=False)
    timestamp: str = Field(default="")
