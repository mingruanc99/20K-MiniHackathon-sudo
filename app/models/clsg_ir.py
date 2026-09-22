# app/models/clsg_ir.py
"""
Data models for Verified CLSG-IR (The Core Intermediate Representation)
and Downstream Engine Export Schemas
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.models.config import PipelineConfig
from app.models.expression import DraftScene, VisualCue, ProsodyPlan
from app.models.guard import QualityReport

class VerifiedScene(BaseModel):
    scene_id: str
    section_id: str
    title: str
    order: int
    pedagogical_function: str
    narration_text: str
    word_count: int
    prosody_plan: ProsodyPlan
    visual_cues: List[VisualCue]
    scene_start_time_sec: float
    scene_end_time_sec: float
    scene_duration_sec: float

class VerifiedCLSG_IR(BaseModel):
    ir_version: str = Field(default="1.0.0")
    ir_id: str = Field(description="Unique Verified IR ID, e.g. clsg_verified_01")
    document_id: str
    blueprint_id: str
    lecture_title: str
    config: PipelineConfig
    total_scenes: int
    total_duration_sec: float
    total_words: int
    scenes: List[VerifiedScene]
    quality_report: QualityReport
    verified_at: str

class ExportPackage(BaseModel):
    ir_id: str
    formats: Dict[str, Any] = Field(
        description="Dictionary containing exported payloads: 'clsg_json', 'remotion_props', 'manim_code', 'ssml_bundle'"
    )
