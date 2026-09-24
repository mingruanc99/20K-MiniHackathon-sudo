# app/models/narrative_ir.py
# -*- coding: utf-8 -*-
"""
==============================================================================
NARRATIVE IR: INTERMEDIATE REPRESENTATION FOR COGNITIVE & EDUCATIONAL STORYTELLING
==============================================================================
Complements Document IR (Source of Truth) by modeling:
  - Epistemic Curiosity Gaps (Mystery before explanation)
  - Listener Mental-State & Cognitive Load (Sweller CLT)
  - Spoken Discourse & Oral Pragmatics (Conversational markers, pacing beats)
  - Analogy & Conceptual Grounding (Physical intuition mapping)
  - Cross-Slide Narrative Momentum & Bridges (Netflix-style cliffhangers)
  - Deictic Visual Synchrony (Direct conversational pointing to diagram elements)
==============================================================================
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class EpistemicCuriosityGap(BaseModel):
    """Models the cognitive dissonance or puzzle introduced before delivering facts."""
    hook_type: str = Field("epistemic_conflict", description="Type: epistemic_conflict, counter_intuitive, real_world_conundrum")
    prompt_question: str = Field(..., description="Provocative question posed to the listener")
    known_anchor: str = Field(..., description="What the student already understands or observes")
    unknown_frontier: str = Field(..., description="The mystery that the upcoming concept resolves")
    intensity: float = Field(0.8, ge=0.0, le=1.0, description="Curiosity pull intensity")
    grounding_element_ids: List[str] = Field(default_factory=list, description="Linked Document IR element IDs")

class ListenerMentalState(BaseModel):
    """Tracks estimated cognitive load and active working memory chunks."""
    cognitive_load_score: float = Field(0.4, ge=0.0, le=1.0, description="Sweller Cognitive Load estimate")
    active_memory_items: int = Field(2, ge=0, le=7, description="Estimated Miller 7±2 active items")
    probable_misconception: Optional[str] = Field(None, description="Common student misunderstanding to refute")
    requires_digestive_pause: bool = Field(False, description="Whether to insert an acoustic reset beat")

class AnalogyPoint(BaseModel):
    """Isomorphic mapping from abstract technical topology to bodily/intuitive domain."""
    source_domain: str = Field(..., description="Everyday intuitive domain, e.g. stick figure, rubber band, tree roots")
    target_concept: str = Field(..., description="Technical concept being grounded")
    mapping_explanation: str = Field(..., description="Verbal mapping sentence")
    pedagogical_purpose: str = Field("intuitive_anchor", description="Purpose: intuitive_anchor, simplify_math, contrast")

class SpokenDiscourseBlueprint(BaseModel):
    """Oral vernacular formatting and discourse markers."""
    lead_marker: str = Field("Hãy hình dung thế này...", description="Spoken oral opening signpost")
    adversative_marker: Optional[str] = Field(None, description="Transition marker like 'Tuy nhiên, vấn đề là...'")
    resultative_marker: Optional[str] = Field(None, description="Marker like 'Chính vì thế...', 'So what happens is...'")
    digestive_pause_sec: float = Field(0.8, ge=0.2, le=3.0, description="Acoustic silence for mental processing")
    conversational_questions: List[str] = Field(default_factory=list, description="Rhetorical questions addressed to student")
    deictic_visual_cues: List[Dict[str, str]] = Field(default_factory=list, description="Pointing cues e.g. {'phrase': 'nhìn vào điểm số 0', 'target_id': 'ann_kp_00'}")

class NarrativeBeat(BaseModel):
    """A distinct pedagogical beat within a scene."""
    beat_id: str
    target_section_id: str
    timing_target_sec: float
    curiosity_gap: Optional[EpistemicCuriosityGap] = None
    cognitive_goal: ListenerMentalState
    analogy: Optional[AnalogyPoint] = None
    spoken_discourse: SpokenDiscourseBlueprint
    transitional_bridge_out: Optional[str] = Field(None, description="Bridge previewing the next beat's problem")
    grounding_refs: List[str] = Field(default_factory=list, description="IDs of Document IR elements guaranteeing fidelity")

class NarrativeIR(BaseModel):
    """Complete narrative blueprint for a lecture document."""
    lecture_narrative_id: str
    source_document_id: str
    persona_archetype: str = Field("insightful_mentor", description="insightful_mentor, socratic_explorer, master_craftsman")
    overall_story_arc: str = Field("problem_struggle_breakthrough_mastery")
    narrative_beats: List[NarrativeBeat] = Field(default_factory=list)
    average_cognitive_load: float = Field(0.5, ge=0.0, le=1.0)
    total_curiosity_hooks: int = Field(0)
    created_at: str = Field(..., description="ISO timestamp")
