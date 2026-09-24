# app/models/transition_ir.py
# -*- coding: utf-8 -*-
"""
==============================================================================
TRANSITION IR (TIR) — DATA MODEL
==============================================================================
Represents the semantic bridge between two adjacent concepts in a lecture.

The Transition Intelligence Layer (TIL) analyzes every adjacent concept pair
(Concept A → Concept B) and produces a TransitionIR that encodes:
  - WHY B appears after A (causal/logical reason)
  - WHAT relationship type connects them
  - WHAT gap in understanding A naturally creates
  - HOW B resolves that gap
  - WHAT spoken bridge language should be used

This IR operates BETWEEN section generation — before narration is written —
so that every section opens with the correct contextual bridge from the prior.

==============================================================================
"""

from typing import Literal, Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# TRANSITION TAXONOMY
# ─────────────────────────────────────────────────────────────────────────────

TransitionRelationship = Literal[
    # Epistemic Progression
    "LimitationToSolution",        # A reveals what it cannot do → B solves it
    "ProblemToMethod",             # A states the problem → B provides the technique
    "QuestionToAnswer",            # A poses a question → B answers it
    "ObservationToExplanation",    # A shows a fact → B explains the mechanism
    "HypothesisToEvidence",        # A proposes a claim → B provides proof

    # Conceptual Structure
    "DefinitionToExample",         # A defines abstractly → B grounds it concretely
    "AbstractToConcreteInstance",  # A gives the principle → B shows a real instance
    "SimpleToAdvanced",            # A gives the basic form → B reveals the full complexity
    "WholeToComponent",            # A shows the complete system → B zooms into one part
    "ComponentToWhole",            # A examines a part → B shows how it fits the full system
    "PartToPart",                  # A covers one component → B covers a sibling component

    # Causal & Temporal
    "CauseToEffect",               # A is the cause → B is what results
    "InputToTransformation",       # A is the input → B describes the process/transform
    "TransformationToOutput",      # A is the process → B is the result produced
    "StepToNextStep",              # A is step N → B is step N+1 in a sequence

    # Comparative & Contrastive
    "ComparisonSetup",             # A introduces first option → B introduces second for comparison
    "ContrastHighlight",           # A describes approach X → B contrasts with approach Y
    "TradeoffAnalysis",            # A covers advantages → B covers limitations (or vice versa)

    # Prerequisite Topology
    "PrerequisiteToDependent",     # A must be understood before B can make sense
    "FoundationToExtension",       # A is the base → B extends or specializes it
    "ConceptToApplication",        # A is the theory → B is how it is applied
    "TheoryToPractice",            # A is formal derivation → B is practical implementation

    # Narrative/Rhetorical
    "AnomalyToResolution",         # A reveals something surprising → B explains why
    "ScopeNarrowDown",             # A is general → B focuses on a specific case
    "ScopeWideOut",                # A is specific → B zooms out to the bigger picture
    "SummaryToDepth",              # A summarizes → B dives deeper into one aspect
]

TransitionStrategy = Literal[
    "gap_bridge",        # Expose A's limitation/gap, then position B as the answer
    "curiosity_hook",    # Plant a question at end of A, resolve at start of B
    "contrast_pivot",    # Acknowledge A, then pivot with contrast (however/but/yet)
    "zoom_transition",   # Shift spatial/conceptual scope (zoom in or out)
    "causal_chain",      # Link A's output directly to B's input as cause-effect
    "sequential_step",   # Enumerate A as step N, B as step N+1
    "analogical_bridge", # Use a shared analogy that spans both A and B
    "question_plant",    # End A with a rhetorical question that B answers
]


# ─────────────────────────────────────────────────────────────────────────────
# QUALITY METRICS
# ─────────────────────────────────────────────────────────────────────────────

class TransitionQualityMetrics(BaseModel):
    """Scores measuring how human-like and educationally effective a transition is."""

    transition_quality_score: float = Field(
        ge=0.0, le=1.0,
        description=(
            "Overall quality of the transition. "
            "1.0 = seamless, natural, idea-to-idea flow. "
            "0.0 = robotic 'Let's move on to...' or slide-title injection."
        )
    )
    bridge_coherence_score: float = Field(
        ge=0.0, le=1.0,
        description=(
            "Semantic coherence between the bridge_text and the two concepts. "
            "1.0 = bridge_text is tightly grounded in both A and B."
        )
    )
    concept_continuity_score: float = Field(
        ge=0.0, le=1.0,
        description=(
            "Whether the end of section A and start of section B feel like "
            "continuous thought rather than a hard cut."
        )
    )
    human_lecture_flow_score: float = Field(
        ge=0.0, le=1.0,
        description=(
            "Whether a human teacher would naturally say this transition. "
            "Penalizes 'Let's move on', 'Next slide', 'Now we will see'."
        )
    )
    slide_dependency_score: float = Field(
        ge=0.0, le=1.0,
        description=(
            "How much the transition references slide structure instead of ideas. "
            "0.0 = fully idea-centric (desired). "
            "1.0 = fully slide-centric (a failure)."
        )
    )

    @property
    def overall(self) -> float:
        """Composite score: penalizes slide_dependency heavily."""
        return round(
            (self.transition_quality_score * 0.30 +
             self.bridge_coherence_score * 0.25 +
             self.concept_continuity_score * 0.20 +
             self.human_lecture_flow_score * 0.20 +
             (1.0 - self.slide_dependency_score) * 0.05),
            3
        )


# ─────────────────────────────────────────────────────────────────────────────
# CORE: TRANSITION IR
# ─────────────────────────────────────────────────────────────────────────────

class TransitionIR(BaseModel):
    """
    Semantic bridge between two adjacent concepts/sections in a lecture.

    One TransitionIR is generated for every adjacent pair:
        (Section[i], Section[i+1])

    This IR drives the closing sentence of Section[i] and the
    opening sentence of Section[i+1], replacing generic transitions
    with idea-centric bridges.
    """

    transition_id: str = Field(description="Unique ID, e.g. 'tr_01_02'")

    # Source and destination concept identity
    from_section_id: str = Field(description="Section ID of concept A")
    to_section_id: str = Field(description="Section ID of concept B")
    from_concept_label: str = Field(description="Human-readable name of concept A, e.g. 'Bounding Box'")
    to_concept_label: str = Field(description="Human-readable name of concept B, e.g. 'Pose Representation'")

    # Core semantic analysis
    relationship: TransitionRelationship = Field(
        description="The epistemic/structural relationship that connects A to B"
    )

    # Why B appears after A
    bridge_reason: str = Field(
        description=(
            "The logical/epistemic reason why B appears after A. "
            "Example: 'Bounding boxes provide location but not body posture. "
            "Pose fills this gap.'"
        )
    )

    # The gap A creates that B resolves
    learner_question: str = Field(
        description=(
            "The implicit question a learner would have after A, before seeing B. "
            "Example: 'We know where the person is — but how is their body arranged?'"
        )
    )

    # Transition strategy type
    strategy: TransitionStrategy = Field(
        description="The rhetorical/pedagogical strategy used to bridge A to B"
    )

    # Generated bridge text — the actual spoken words
    closing_sentence_a: str = Field(
        description=(
            "The final 1–2 sentences spoken at the END of section A. "
            "Must plant the gap/question naturally, NOT announce the next topic. "
            "Bad: 'Let's move on to Pose.' "
            "Good: 'But knowing where the person is still doesn't tell us how their body is arranged.'"
        )
    )
    opening_sentence_b: str = Field(
        description=(
            "The first 1–2 sentences spoken at the START of section B. "
            "Must feel like the answer to the question A created. "
            "Bad: 'Pose is defined as...' "
            "Good: 'That is exactly what pose representation captures — the full arrangement of body joints.'"
        )
    )

    # Full transition prose (closing_sentence_a + opening_sentence_b joined naturally)
    bridge_text: str = Field(
        description=(
            "Complete spoken bridge joining A to B. "
            "This is the actual text injected into the lecture script."
        )
    )

    # Quality evaluation
    quality: Optional[TransitionQualityMetrics] = Field(
        default=None,
        description="Quality scores for this transition"
    )

    # Anti-pattern detection
    slide_centric_phrases_detected: List[str] = Field(
        default_factory=list,
        description=(
            "Any robotic slide-navigation phrases detected and removed during generation. "
            "Tracked for diagnostics."
        )
    )

    # Provenance
    generation_method: Literal["rule_based", "llm_assisted", "hybrid"] = Field(
        default="hybrid"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ─────────────────────────────────────────────────────────────────────────────
# TRANSITION MAP — for the entire lecture
# ─────────────────────────────────────────────────────────────────────────────

class LectureTransitionMap(BaseModel):
    """
    Complete set of transitions for a lecture.
    One TransitionIR per adjacent section pair.
    """

    map_id: str = Field(description="Unique map ID, e.g. 'tmap_bp_abc123'")
    blueprint_id: str
    document_id: str

    transitions: List[TransitionIR] = Field(
        default_factory=list,
        description="Ordered list of transitions: tr_01_02, tr_02_03, ... tr_(n-1)_n"
    )

    # Aggregate quality
    average_transition_quality: float = Field(default=0.0)
    average_bridge_coherence: float = Field(default=0.0)
    average_human_flow: float = Field(default=0.0)
    average_slide_dependency: float = Field(default=0.0)

    total_transitions: int = Field(default=0)
    weak_transitions: List[str] = Field(
        default_factory=list,
        description="IDs of transitions with overall quality < 0.6, flagged for review"
    )

    created_at: str = Field(default="")
