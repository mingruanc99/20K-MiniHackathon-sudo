# app/models/expression.py
"""
Data models for Module 3:
- 3A: Narration Script
- 3B: Prosody & Pause Planning (Pre-TTS Instructional Intent Layer)
- 3C: Visual Intent Cues (13 Taxonomies)
- Draft CLSG-IR representation
"""
from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field

PauseType = Literal[
    "Micro-pause (Syntactic Chunking)",
    "Emphasis-pause (Pre-Keyword Focus)",
    "Cognitive-pause (Post-Concept Processing)",
    "Transition-pause (Inter-Scene Boundary)"
]

VisualTaxonomy = Literal[
    "Diagram Animation",
    "Step-by-Step Code Walkthrough",
    "Mathematical Derivation Step",
    "Geometric Spatial Transform",
    "Timeline Progression",
    "Data Chart Dynamic Trend",
    "Concept Map Linkage",
    "Physical World Metaphor",
    "Architectural Block Highlight",
    "Code Execution Trace",
    "Component Zoom-in",
    "Morphing Transition",
    "Side-by-Side Comparison"
]

VisualAction = Literal["highlight", "reveal", "zoom", "draw", "pulse", "fade", "transform", "pan", "overlay"]

class WordPause(BaseModel):
    pause_id: str = Field(description="Unique pause ID, e.g. p_01")
    pause_type: PauseType
    after_word: str = Field(description="The word immediately preceding this pause")
    word_index: int = Field(description="0-based word index within sentence")
    duration_ms: int = Field(ge=100, le=3000, description="Pause duration in milliseconds")
    justification: str = Field(description="Cognitive or syntactic rationale for this pause")

class SentenceProsody(BaseModel):
    sentence_id: str = Field(description="Unique sentence ID, e.g. s_01")
    text: str = Field(description="Sentence text without SSML markup")
    pitch: Literal["low", "medium", "high"] = Field(default="medium")
    rate: Literal["x-slow", "slow", "medium", "fast"] = Field(default="medium")
    volume: Literal["soft", "medium", "loud"] = Field(default="medium")
    pauses: List[WordPause] = Field(default_factory=list)
    ssml: str = Field(description="SSML snippet with <prosody> and <break> tags")
    estimated_speaking_time_sec: float = Field(default=0.0)
    estimated_pause_time_sec: float = Field(default=0.0)

class ProsodyPlan(BaseModel):
    section_id: str
    sentences: List[SentenceProsody] = Field(default_factory=list)
    total_words: int = Field(default=0)
    total_speaking_sec: float = Field(default=0.0)
    total_pause_sec: float = Field(default=0.0)
    effective_scene_duration_sec: float = Field(
        default=0.0,
        description="total_speaking_sec + total_pause_sec"
    )
    ssml_full: str = Field(default="", description="Full scene SSML document ready for TTS engine")

class VisualCue(BaseModel):
    cue_id: str = Field(description="Unique visual cue ID, e.g. vc_01")
    section_id: str
    trigger_timestamp_sec: float = Field(
        description="Exact audio timeline second when this visual trigger fires"
    )
    trigger_word: Optional[str] = Field(
        default=None,
        description="Specific word anchor in narration that triggers this visual event"
    )
    taxonomy_type: VisualTaxonomy = Field(
        description="One of the 13 canonical visual taxonomies"
    )
    element_target: str = Field(
        description="Target graphic object (e.g. 'kernel_window_3x3', 'feature_map_tensor')"
    )
    action: VisualAction = Field(description="Motion/visual effect applied to element")
    visual_description: str = Field(
        description="Precise rendering instruction for Manim / Remotion / Canvas"
    )
    necessity_justification: str = Field(
        description="Instructional justification explaining why this visual aids cognitive comprehension"
    )
    renderer_hints: Dict[str, Any] = Field(
        default_factory=dict,
        description="Coordinates, colors, bounding boxes, or Manim object classes"
    )

class DraftScene(BaseModel):
    scene_id: str = Field(description="Unique scene ID, e.g. scene_01")
    section_id: str
    title: str
    order: int
    pedagogical_function: str
    narration_text: str = Field(description="Full spoken text of this scene")
    word_count: int
    prosody_plan: ProsodyPlan
    visual_cues: List[VisualCue] = Field(default_factory=list)

class DraftCLSG_IR(BaseModel):
    draft_id: str = Field(description="Draft representation ID")
    blueprint_id: str
    document_id: str
    scenes: List[DraftScene] = Field(default_factory=list)
    total_word_count: int = Field(default=0)
    estimated_total_duration_sec: float = Field(default=0.0)
    created_at: str = Field(default="")
