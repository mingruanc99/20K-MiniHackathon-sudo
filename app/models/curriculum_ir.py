# app/models/curriculum_ir.py
# -*- coding: utf-8 -*-
"""
==============================================================================
CURRICULUM IR: DURATION-AWARE PEDAGOGICAL DESIGN SPECIFICATION
==============================================================================

CRITICAL DESIGN PRINCIPLE:
━━━━━━━━━━━━━━━━━━━━━━━━━━
Duration is NOT a compression parameter.
Duration is a TEACHING DESIGN parameter.

The question is NOT:
  "How do I compress the existing content into X minutes?"

The question IS:
  "What is the best way to teach this knowledge space in X minutes?"

Different durations produce QUALITATIVELY DIFFERENT curricula:

  10 min → Core + Intuition (no mechanisms, no examples, no caveats)
  30 min → Core + Mechanism + Examples + Applications
  60 min → Full: mechanisms + caveats + comparisons + failure cases

The field previously called "compression_strategy" is now called
"teaching_design_strategy" to make this distinction explicit in code.

TEACHING UNIT DEPTH:
━━━━━━━━━━━━━━━━━━━
Each TeachingUnitPlan now carries a TeachingDepth that specifies exactly
which cognitive layers are activated for this concept in this curriculum:
  - narration_layers: what spoken layers to generate (intuition / mechanism /
                      example / caveat / comparison / failure_case)
  - evidence_density: how many evidence artifacts to surface (0.0 → 1.0)
  - bloom_ceiling:    maximum Bloom level to reach
  - include_analogy:  whether to include grounding analogy
  - include_misconception_inoculation: whether to pre-empt common errors

This replaces the crude "word budget" knapsack with a LAYER SELECTION model.
==============================================================================
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# BLOOM TAXONOMY
# ─────────────────────────────────────────────────────────────────────────────

BloomLevel = Literal["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]

BLOOM_RANK: Dict[str, int] = {
    "Remember": 1, "Understand": 2, "Apply": 3,
    "Analyze": 4, "Evaluate": 5, "Create": 6
}


# ─────────────────────────────────────────────────────────────────────────────
# NARRATION LAYERS
# ─────────────────────────────────────────────────────────────────────────────

NarrationLayer = Literal[
    "hook_question",         # Why does this matter? What problem does it solve?
    "intuition",             # The core idea in plain language, no formalism
    "formal_definition",     # Precise technical definition
    "mechanism",             # How it works internally, step by step
    "worked_example",        # Walk through a concrete instance
    "visual_walkthrough",    # Guided tour of diagram or visual evidence
    "application",           # Where and how this is used in practice
    "analogy_grounding",     # Metaphor from everyday experience
    "comparison",            # How it differs from an alternative
    "caveat",                # Known limitations, edge cases, failure modes
    "failure_case",          # Concrete example of where it breaks
    "misconception_inoculation",  # Pre-empt the most common misunderstanding
    "synthesis_callback",    # Connect back to earlier concepts
    "open_question",         # Leave a productive tension for the next concept
]


# ─────────────────────────────────────────────────────────────────────────────
# TEACHING DEPTH PROFILE
# ─────────────────────────────────────────────────────────────────────────────

class TeachingDepth(BaseModel):
    """
    Specifies WHICH cognitive layers to activate for a concept in a given curriculum.

    This is the core mechanism that makes different durations produce
    qualitatively different lectures, not just shorter ones.

    Instead of word-budget truncation, the system selects LAYERS.
    """

    narration_layers: List[NarrationLayer] = Field(
        description=(
            "Ordered list of cognitive layers to generate for this concept. "
            "The generator produces one paragraph per layer, in this order. "
            "Omitting a layer means that aspect is NOT taught — not truncated."
        )
    )
    evidence_density: float = Field(
        ge=0.0, le=1.0,
        description=(
            "Fraction of available evidence artifacts to surface (0.0 = none, 1.0 = all). "
            "At 0.3, show only the single most definitive piece of evidence. "
            "At 1.0, show all diagrams, tables, and formulas."
        )
    )
    bloom_ceiling: BloomLevel = Field(
        description=(
            "Maximum Bloom's Taxonomy level to reach for this concept. "
            "The generator will not produce content above this level."
        )
    )
    include_analogy: bool = Field(
        default=False,
        description="Whether to include a grounding analogy for this concept."
    )
    include_misconception_inoculation: bool = Field(
        default=False,
        description="Whether to proactively address the most common misconception."
    )
    teaching_time_sec: float = Field(
        description=(
            "Absolute time budget for this concept in seconds. "
            "This is NOT used to truncate text. It is used to calibrate "
            "word count and pacing across all active narration layers."
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# TEACHING UNIT PLAN
# ─────────────────────────────────────────────────────────────────────────────

class TeachingUnitPlan(BaseModel):
    """A distinct cognitive milestone within the curriculum trajectory."""

    unit_id: str
    concept_id: str
    unit_title: str

    # Time & word budget (derived from TeachingDepth)
    target_duration_sec: float
    target_word_budget: int

    pedagogical_strategy: Literal[
        "epistemic_hook_reveal",
        "intuitive_analogy_walkthrough",
        "empirical_evidence_deconstruction",
        "comparative_tradeoff_analysis",
        "synthesis_and_mastery"
    ]
    bloom_level: BloomLevel = "Understand"

    # Teaching depth profile (NEW — replaces crude word budget)
    depth: Optional[TeachingDepth] = Field(
        default=None,
        description=(
            "Layer-selection profile specifying exactly what cognitive content "
            "to generate for this concept at this duration. "
            "When present, this overrides generic narration generation."
        )
    )

    primary_evidence_artifact_id: Optional[str] = None
    supporting_artifact_ids: List[str] = Field(default_factory=list)
    epistemic_goal: str
    prerequisite_concept_ids: List[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# DURATION TIER
# ─────────────────────────────────────────────────────────────────────────────

DurationTier = Literal[
    "flash_3m",          # 3 min: Why it matters. Core idea only.
    "standard_10m",      # 10 min: Core + Intuition. No mechanisms.
    "deep_30m",          # 30 min: Core + Mechanism + Examples + Applications
    "masterclass_60m",   # 60 min: Full depth. Caveats, comparisons, failure cases.
]


# ─────────────────────────────────────────────────────────────────────────────
# CURRICULUM IR
# ─────────────────────────────────────────────────────────────────────────────

class CurriculumIR(BaseModel):
    """
    The complete duration-calibrated teaching plan.

    INVARIANT: Two CurriculumIR objects for the same knowledge space but
    different durations must differ in STRUCTURE (which concepts are taught,
    in what order, with what depth layers), NOT just in word count.
    """

    curriculum_id: str
    knowledge_space_id: str

    target_duration_min: int = Field(
        ..., description="Target duration in minutes (3, 10, 30, 60)"
    )
    total_target_duration_sec: float
    total_target_words: int

    # ── RENAMED from compression_strategy to teaching_design_strategy ────────
    # "compression" implied truncation. "teaching_design" implies architecture.
    teaching_design_strategy: DurationTier = Field(
        ...,
        description=(
            "The pedagogical design tier for this duration. "
            "NOT a compression level. Each tier represents a fundamentally "
            "different teaching architecture."
        )
    )

    # Keep compression_strategy as alias for backward compatibility
    compression_strategy: Optional[str] = Field(
        default=None,
        description="Deprecated alias for teaching_design_strategy. Use teaching_design_strategy."
    )

    teaching_trajectory: List[TeachingUnitPlan] = Field(default_factory=list)

    active_concepts_count: int
    pruned_concepts_count: int = Field(
        description=(
            "Concepts NOT taught in this curriculum. "
            "These are deliberately excluded because they are outside "
            "the pedagogical scope for this duration tier, NOT because "
            "the content was compressed."
        )
    )

    cognitive_density_score: float = Field(0.5, ge=0.0, le=1.0)
    created_at: str = Field(..., description="ISO timestamp")

    # Curriculum design rationale (for explainability)
    design_rationale: str = Field(
        default="",
        description=(
            "Explanation of why this curriculum was designed this way. "
            "Should answer: why these concepts, why this order, why this depth."
        )
    )

    # What was deliberately excluded and why
    excluded_concept_rationale: Dict[str, str] = Field(
        default_factory=dict,
        description=(
            "Maps excluded concept_id → reason for exclusion. "
            "Examples: 'Requires prerequisite not covered at this tier', "
            "'Pedagogically inappropriate for 10-minute audience', "
            "'Edge case — only relevant for 60-minute masterclass'."
        )
    )
