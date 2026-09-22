# app/models/config.py
"""
Data models for Learner and Presentation Configuration
"""
from typing import Literal, Dict, Any, Optional
from pydantic import BaseModel, Field

class LearnerPersona(BaseModel):
    target_audience: Literal["beginner", "undergraduate", "graduate", "professional"] = Field(
        default="undergraduate",
        description="Target audience expertise level"
    )
    prior_knowledge: str = Field(
        default="Basic linear algebra, matrix operations, and introductory programming concepts.",
        description="Assumed background knowledge of learner"
    )
    language: str = Field(default="en", description="Target language code (e.g. en, vi)")
    tone: Literal["engaging", "academic", "conversational", "rigorous"] = Field(
        default="academic",
        description="Pedagogical tone of presentation"
    )

class PresentationConfig(BaseModel):
    target_duration_sec: int = Field(
        default=180,
        ge=30,
        le=1200,
        description="Target duration of total lecture in seconds (e.g., 180 for 3 min)"
    )
    pacing: Literal["slow", "normal", "fast"] = Field(
        default="normal",
        description="Lecture delivery pacing"
    )
    baseline_wpm: int = Field(
        default=140,
        ge=90,
        le=200,
        description="Baseline words per minute (typically 130-150 WPM for instructional speech)"
    )
    visual_density: Literal["minimal", "balanced", "rich"] = Field(
        default="balanced",
        description="Target frequency of visual cues and animations per scene"
    )

class SystemInferredParams(BaseModel):
    calculated_word_budget: int = Field(
        description="Computed total word budget: target_duration_sec * (wpm / 60)"
    )
    target_pause_overhead_pct: float = Field(
        default=0.18,
        description="Expected pause overhead percentage (15% - 22% of speech time)"
    )
    effective_speaking_budget_sec: float = Field(
        description="Net speaking duration excluding cognitive/transition pauses"
    )
    max_scenes_recommended: int = Field(default=5)

class PipelineConfig(BaseModel):
    learner: LearnerPersona = Field(default_factory=LearnerPersona)
    presentation: PresentationConfig = Field(default_factory=PresentationConfig)
    inferred: Optional[SystemInferredParams] = None

    def compute_inferred(self) -> SystemInferredParams:
        pause_overhead = 0.18
        if self.presentation.pacing == "slow":
            pause_overhead = 0.22
        elif self.presentation.pacing == "fast":
            pause_overhead = 0.12

        net_speaking_sec = self.presentation.target_duration_sec * (1.0 - pause_overhead)
        word_budget = int(net_speaking_sec * (self.presentation.baseline_wpm / 60.0))
        
        inferred = SystemInferredParams(
            calculated_word_budget=word_budget,
            target_pause_overhead_pct=pause_overhead,
            effective_speaking_budget_sec=round(net_speaking_sec, 2),
            max_scenes_recommended=max(1, int(self.presentation.target_duration_sec / 35))
        )
        self.inferred = inferred
        return inferred
