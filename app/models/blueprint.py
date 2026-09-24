# app/models/blueprint.py
"""
Data models for Module 2: Lesson Blueprint & Section Plans
"""
from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field

BloomLevel = Literal["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]
PedagogicalRole = Literal["hook", "definition", "mechanism", "example", "comparison", "summary", "exercise"]

class PedagogicalObjective(BaseModel):
    objective_id: str = Field(description="Unique identifier, e.g. obj_01")
    bloom_level: BloomLevel = Field(description="Bloom's Revised Taxonomy level")
    description: str = Field(description="Measurable learning outcome")

class SectionPlan(BaseModel):
    section_id: str = Field(description="Section identifier, matches DocumentSection section_id")
    title: str = Field(description="Instructional scene title")
    order: int = Field(description="Sequence index (1-based)")
    pedagogical_function: PedagogicalRole = Field(
        default="definition",
        description="Instructional purpose of this scene"
    )
    bloom_level: BloomLevel = Field(default="Understand")
    target_duration_sec: int = Field(
        description="Target duration for this specific section in seconds"
    )
    target_word_budget: int = Field(
        description="Calculated word count target based on section duration and WPM"
    )
    key_concepts: List[str] = Field(
        default_factory=list,
        description="Core technical concepts to teach in this section"
    )
    prerequisite_concepts: List[str] = Field(
        default_factory=list,
        description="Concepts introduced in earlier sections required here"
    )
    instructional_goal: str = Field(
        description="The specific instructional 'WHY' for this scene"
    )
    assigned_chunk_ids: List[str] = Field(
        default_factory=list,
        description="SemanticChunk IDs assigned as grounded source evidence for this section"
    )
    primary_visual_id: Optional[str] = Field(
        default=None,
        description="Primary visual asset reference ID for visual alignment"
    )

class LessonBlueprint(BaseModel):
    blueprint_id: str = Field(description="Unique blueprint identifier")
    document_id: str = Field(description="Source document ID")
    lecture_title: str = Field(default="Lecture Blueprint")
    total_target_duration_sec: int = Field(description="Total lecture length in seconds")
    total_word_budget: int = Field(description="Total word budget across all sections")
    pedagogical_strategy: str = Field(
        default="Scaffolded Conceptual Progression (Hook -> Intuition -> Mechanism -> Synthesis)"
    )
    sections: List[SectionPlan] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
