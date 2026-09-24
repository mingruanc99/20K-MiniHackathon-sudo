# app/models/evaluation.py
"""
Data models for Evaluation, Human-in-the-loop, User Feedback, Cost, and Security.
Supports:
- Subsystem B: Human-in-the-loop Review
- Subsystem C: User Feedback & Behavioral Telemetry
- Subsystem D: System Latency, Cost Records, and Budget Policies
- Subsystem E: Security Events and Golden Dataset Regression
"""
import time
from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field

HumanReviewAction = Literal["APPROVE", "EDIT", "REGENERATE", "REJECT", "FLAG_ISSUE"]
UserTierType = Literal["NORMAL", "VIP"]

STRUCTURED_HUMAN_ISSUES = [
    "wrong_content",
    "missing_content",
    "hallucination",
    "too_verbose",
    "too_short",
    "bad_explanation",
    "bad_transition",
    "wrong_visual",
    "unnecessary_visual",
    "repetition",
    "wrong_terminology",
    "poor_pedagogy",
    "technical_error",
    "other"
]

class HumanReviewRecord(BaseModel):
    review_id: str = Field(description="Unique review identifier")
    generation_id: str = Field(description="Correlated generation / CLSG IR identifier")
    project_id: str = Field(description="Associated project identifier")
    reviewer_id: str = Field(description="ID of the human educator/reviewer")
    action: HumanReviewAction = Field(description="Action taken by reviewer")
    selected_issues: List[str] = Field(default_factory=list, description="Structured issues selected from taxonomy")
    severity: Literal["low", "medium", "high", "critical"] = Field(default="medium")
    comment: Optional[str] = Field(default=None, description="Detailed explanatory comments")
    edited_script: Optional[Dict[str, str]] = Field(default=None, description="Scene ID to modified narration text mapping")
    reviewed_at: float = Field(default_factory=time.time)

class UserFeedbackRecord(BaseModel):
    feedback_id: str = Field(description="Unique feedback identifier")
    generation_id: str = Field(description="Correlated generation identifier")
    project_id: str = Field(description="Associated project identifier")
    scene_id: Optional[str] = Field(default=None, description="Optional scene scope")
    is_useful: bool = Field(description="Binary explicit signal: True for 👍 Yes, False for 👎 No")
    complaint_tags: List[str] = Field(default_factory=list, description="Complaint tags if is_useful=False (Content, Explanation, Style, Length, Visual, Accuracy, Other)")
    comment: Optional[str] = Field(default=None, description="Optional user commentary")
    model: str = Field(default="gemini-2.5-flash")
    prompt_version: str = Field(default="v2.0")
    user_tier: UserTierType = Field(default="NORMAL")
    created_at: float = Field(default_factory=time.time)

class BehavioralSignalMetrics(BaseModel):
    generation_count: int = 0
    copy_count: int = 0
    regeneration_count: int = 0
    edit_count: int = 0
    export_count: int = 0
    abandonment_count: int = 0

    @property
    def copy_rate(self) -> float:
        return round(self.copy_count / max(1, self.generation_count), 4)

    @property
    def regeneration_rate(self) -> float:
        return round(self.regeneration_count / max(1, self.generation_count), 4)

    @property
    def edit_rate(self) -> float:
        return round(self.edit_count / max(1, self.generation_count), 4)

class SystemPerformanceMetrics(BaseModel):
    generation_id: str
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: float
    user_tier: UserTierType = "NORMAL"
    cache_hit: bool = False
    timestamp: float = Field(default_factory=time.time)

class BudgetPolicy(BaseModel):
    tier: UserTierType
    max_token_budget_per_generation: int
    daily_cost_limit_usd: float
    allowed_models: List[str]
    rate_limit_per_minute: int

class SecurityEvent(BaseModel):
    event_id: str
    user_id: str
    project_id: Optional[str] = None
    event_type: Literal["PROMPT_INJECTION", "TENANT_VIOLATION", "UNAUTHORIZED_RETRIEVAL", "SCOPE_ESCAPE"]
    severity: Literal["low", "medium", "high", "critical"]
    detail: str
    blocked: bool = True
    timestamp: float = Field(default_factory=time.time)

class GoldenTestCase(BaseModel):
    case_id: str
    title: str
    domain: str
    input_text: str
    expected_concepts: List[str]
    expected_visual_types: List[str]
    min_content_score: float = 0.85
    min_pedagogy_score: float = 0.85
    min_narrative_score: float = 0.85
    min_visual_score: float = 0.85
    safety_expected_pass: bool = True

class RegressionReport(BaseModel):
    run_id: str
    version_n: str
    version_n_plus_1: str
    total_cases: int
    passed_cases: int
    pass_rate_pct: float
    safety_pass_rate_pct: float
    regression_detected: bool
    regressed_cases: List[str] = []
    dimension_deltas: Dict[str, float] = {}
    timestamp: float = Field(default_factory=time.time)
