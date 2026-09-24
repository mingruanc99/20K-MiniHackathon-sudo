# app/modules/curriculum/curriculum_optimizer.py
# -*- coding: utf-8 -*-
"""
==============================================================================
CURRICULUM OPTIMIZER: DURATION-AWARE PEDAGOGICAL ARCHITECT
==============================================================================

DESIGN MANDATE (read before editing):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This module answers:

  "What is the best way to teach this knowledge space in X minutes?"

NOT:

  "How do I compress the existing slides into X minutes?"

The fundamental unit is CONCEPT + TEACHING_DEPTH, not SLIDE + WORD_COUNT.

Different durations produce QUALITATIVELY DIFFERENT curricula:

  3 min  (flash_3m):
    → Core concept only
    → hook_question + intuition only
    → No mechanisms, no examples, no caveats
    → Bloom ceiling: Understand
    → Goal: "What is this and why does it matter?"

  10 min (standard_10m):
    → Core concepts + intuition + analogy
    → hook_question + intuition + analogy_grounding + open_question
    → No formal mechanisms, no detailed examples
    → Bloom ceiling: Understand
    → Goal: "I understand what this is and can explain it"

  30 min (deep_30m):
    → Core + mechanism + worked example + application
    → Full narration layers up to application
    → Bloom ceiling: Apply
    → Goal: "I can apply this knowledge"

  60 min (masterclass_60m):
    → Full depth: mechanism + caveats + comparisons + failure cases
    → All narration layers
    → Bloom ceiling: Analyze or Evaluate
    → Goal: "I can reason about tradeoffs and failure modes"

CONCEPT SELECTION LOGIC:
━━━━━━━━━━━━━━━━━━━━━━━━
At all tiers, ALL foundational and core concepts are included.
The difference is not WHICH concepts — it's HOW DEEP each is taught.

Exception: At flash_3m, only the single most significant core concept
is taught. The rationale is that 3 minutes cannot even introduce
multiple concepts properly.

At standard_10m, core concepts only (no edge cases, no caveats).
At deep_30m, core + applications (edge cases deferred to 60m).
At masterclass_60m, full knowledge space including edge cases and
architectural tradeoffs.

TOPOLOGICAL ORDERING:
━━━━━━━━━━━━━━━━━━━━
Concepts are ALWAYS taught in prerequisite order, regardless of their
order in the original document/slide deck. The original slide order
is treated as evidence, not as the teaching structure.

WORD BUDGET:
━━━━━━━━━━━
Word budget is computed from the total time and the set of active
narration layers, not from a crude per-section division. Each layer
has a calibrated word count based on cognitive research:
  - hook_question:     ~30 words
  - intuition:         ~80 words
  - formal_definition: ~50 words
  - mechanism:         ~150 words
  - worked_example:    ~120 words
  - visual_walkthrough:~80 words
  - application:       ~100 words
  - analogy_grounding: ~60 words
  - comparison:        ~100 words
  - caveat:            ~80 words
  - failure_case:      ~80 words
  - misconception_inoculation: ~60 words
  - synthesis_callback:~50 words
  - open_question:     ~30 words
==============================================================================
"""

import datetime
from typing import List, Dict, Any, Optional, Set, Tuple

from app.models.knowledge_ir import KnowledgeIR, ConceptNode, EpistemicEdge
from app.models.curriculum_ir import (
    CurriculumIR,
    TeachingUnitPlan,
    TeachingDepth,
    DurationTier,
    NarrationLayer,
    BloomLevel,
    BLOOM_RANK,
)


# ─────────────────────────────────────────────────────────────────────────────
# LAYER WORD BUDGET CALIBRATION
# Based on average observed word counts for each cognitive layer
# in well-crafted educational lecture scripts.
# ─────────────────────────────────────────────────────────────────────────────

LAYER_WORD_BUDGET: Dict[NarrationLayer, int] = {
    "hook_question":               30,
    "intuition":                   80,
    "formal_definition":           50,
    "mechanism":                  150,
    "worked_example":             120,
    "visual_walkthrough":          80,
    "application":                100,
    "analogy_grounding":           60,
    "comparison":                 100,
    "caveat":                      80,
    "failure_case":                80,
    "misconception_inoculation":   60,
    "synthesis_callback":          50,
    "open_question":               30,
}


def _layers_word_budget(layers: List[NarrationLayer]) -> int:
    return sum(LAYER_WORD_BUDGET.get(layer, 60) for layer in layers)


# ─────────────────────────────────────────────────────────────────────────────
# DURATION TIER PROFILES
# ─────────────────────────────────────────────────────────────────────────────

def _get_tier(target_duration_min: int) -> DurationTier:
    if target_duration_min <= 3:
        return "flash_3m"
    elif target_duration_min <= 10:
        return "standard_10m"
    elif target_duration_min <= 30:
        return "deep_30m"
    else:
        return "masterclass_60m"


# Role inclusion matrix per tier
# Maps EpistemicRole → whether this role is included at each tier
_ROLE_INCLUSION: Dict[str, Dict[str, bool]] = {
    #                           flash  10m    30m    60m
    "foundational_axiom":    {"flash_3m": True,  "standard_10m": True,  "deep_30m": True,  "masterclass_60m": True},
    "core_mechanism":        {"flash_3m": True,  "standard_10m": True,  "deep_30m": True,  "masterclass_60m": True},
    "architectural_tradeoff":{"flash_3m": False, "standard_10m": False, "deep_30m": True,  "masterclass_60m": True},
    "empirical_proof":       {"flash_3m": False, "standard_10m": False, "deep_30m": True,  "masterclass_60m": True},
    "edge_case_limitation":  {"flash_3m": False, "standard_10m": False, "deep_30m": False, "masterclass_60m": True},
    "practical_application": {"flash_3m": False, "standard_10m": False, "deep_30m": True,  "masterclass_60m": True},
}

_EXCLUSION_RATIONALE: Dict[str, Dict[str, str]] = {
    "architectural_tradeoff": {
        "flash_3m": "Tradeoff analysis requires foundational understanding not possible in 3 minutes.",
        "standard_10m": "Comparative tradeoffs need mechanism depth first established at 30m+.",
    },
    "empirical_proof": {
        "flash_3m": "Empirical evidence walkthrough requires time investment not available at this tier.",
        "standard_10m": "Quantitative benchmarks are a depth layer reserved for 30m+ curricula.",
    },
    "edge_case_limitation": {
        "flash_3m": "Edge cases and failure modes are advanced content — reserved for masterclass tier.",
        "standard_10m": "Edge cases and failure modes are advanced content — reserved for masterclass tier.",
        "deep_30m": "Comprehensive failure case analysis is reserved for 60-minute masterclass tier.",
    },
    "practical_application": {
        "flash_3m": "Application requires prior mechanism understanding not covered at this tier.",
        "standard_10m": "Practical application is a depth layer reserved for 30m+ curricula.",
    },
}


# Narration layer sets per tier
_TIER_LAYERS: Dict[DurationTier, Dict[str, List[NarrationLayer]]] = {
    "flash_3m": {
        # 3 min: WHY it matters + WHAT it is. Nothing else.
        "foundational_axiom": ["hook_question", "intuition"],
        "core_mechanism":     ["hook_question", "intuition"],
        "_default":           ["intuition"],
    },
    "standard_10m": {
        # 10 min: Core idea + analogy + open question for next concept
        "foundational_axiom": ["hook_question", "intuition", "analogy_grounding", "open_question"],
        "core_mechanism":     ["hook_question", "intuition", "analogy_grounding", "open_question"],
        "_default":           ["intuition", "open_question"],
    },
    "deep_30m": {
        # 30 min: Mechanism + worked example + application
        "foundational_axiom": [
            "hook_question", "intuition", "formal_definition",
            "analogy_grounding", "open_question"
        ],
        "core_mechanism": [
            "hook_question", "intuition", "formal_definition",
            "mechanism", "visual_walkthrough", "worked_example", "open_question"
        ],
        "architectural_tradeoff": [
            "hook_question", "comparison", "caveat", "open_question"
        ],
        "empirical_proof": [
            "visual_walkthrough", "worked_example"
        ],
        "practical_application": [
            "application", "worked_example"
        ],
        "_default": [
            "intuition", "formal_definition", "mechanism", "open_question"
        ],
    },
    "masterclass_60m": {
        # 60 min: Full depth — everything
        "foundational_axiom": [
            "hook_question", "intuition", "formal_definition",
            "analogy_grounding", "misconception_inoculation", "synthesis_callback"
        ],
        "core_mechanism": [
            "hook_question", "intuition", "formal_definition",
            "mechanism", "visual_walkthrough", "worked_example",
            "analogy_grounding", "misconception_inoculation",
            "synthesis_callback", "open_question"
        ],
        "architectural_tradeoff": [
            "hook_question", "comparison", "caveat",
            "failure_case", "synthesis_callback"
        ],
        "empirical_proof": [
            "visual_walkthrough", "worked_example", "caveat"
        ],
        "edge_case_limitation": [
            "hook_question", "failure_case", "caveat", "synthesis_callback"
        ],
        "practical_application": [
            "application", "worked_example", "comparison", "synthesis_callback"
        ],
        "_default": [
            "hook_question", "intuition", "formal_definition",
            "mechanism", "open_question"
        ],
    },
}

_TIER_BLOOM_CEILING: Dict[DurationTier, BloomLevel] = {
    "flash_3m":        "Understand",
    "standard_10m":    "Understand",
    "deep_30m":        "Apply",
    "masterclass_60m": "Analyze",
}

_TIER_EVIDENCE_DENSITY: Dict[DurationTier, float] = {
    "flash_3m":        0.0,   # No time for evidence walkthrough
    "standard_10m":    0.2,   # At most one key visual
    "deep_30m":        0.6,   # Primary + one supporting artifact
    "masterclass_60m": 1.0,   # All artifacts
}

_TIER_INCLUDE_ANALOGY: Dict[DurationTier, bool] = {
    "flash_3m":        False,
    "standard_10m":    True,
    "deep_30m":        True,
    "masterclass_60m": True,
}

_TIER_MISCONCEPTION: Dict[DurationTier, bool] = {
    "flash_3m":        False,
    "standard_10m":    False,
    "deep_30m":        False,
    "masterclass_60m": True,
}


# ─────────────────────────────────────────────────────────────────────────────
# TOPOLOGICAL SORT (prerequisite ordering)
# ─────────────────────────────────────────────────────────────────────────────

def _topological_sort(
    concepts: List[ConceptNode],
    edges: List[EpistemicEdge],
) -> List[ConceptNode]:
    """
    Orders concepts by prerequisite topology.
    Concepts with no prerequisites come first.
    Falls back to epistemic role priority if topology is flat.
    """
    concept_map: Dict[str, ConceptNode] = {c.concept_id: c for c in concepts}
    # Build adjacency: which concepts must come BEFORE each concept
    prereqs: Dict[str, Set[str]] = {c.concept_id: set() for c in concepts}
    for edge in edges:
        if (edge.relationship_type == "prerequisite_to"
                and edge.source_concept_id in concept_map
                and edge.target_concept_id in concept_map):
            prereqs[edge.target_concept_id].add(edge.source_concept_id)

    # Kahn's algorithm
    in_degree = {cid: len(ps) for cid, ps in prereqs.items()}
    queue = [c for c in concepts if in_degree[c.concept_id] == 0]

    # Secondary sort: role priority within the same in_degree level
    role_priority = {
        "foundational_axiom":    1,
        "core_mechanism":        2,
        "architectural_tradeoff":3,
        "empirical_proof":       4,
        "practical_application": 5,
        "edge_case_limitation":  6,
    }
    queue.sort(key=lambda c: (role_priority.get(c.epistemic_role, 9), -c.significance_score))

    ordered: List[ConceptNode] = []
    while queue:
        node = queue.pop(0)
        ordered.append(node)
        # Reduce in_degree for dependents
        for edge in edges:
            if edge.source_concept_id == node.concept_id and edge.relationship_type == "prerequisite_to":
                dep_id = edge.target_concept_id
                if dep_id in in_degree:
                    in_degree[dep_id] -= 1
                    if in_degree[dep_id] == 0:
                        dep = concept_map.get(dep_id)
                        if dep and dep not in ordered:
                            # Insert in sorted position
                            inserted = False
                            for i, q in enumerate(queue):
                                if role_priority.get(dep.epistemic_role, 9) < role_priority.get(q.epistemic_role, 9):
                                    queue.insert(i, dep)
                                    inserted = True
                                    break
                            if not inserted:
                                queue.append(dep)

    # Append any remaining (e.g., cycles or isolated nodes)
    seen = {c.concept_id for c in ordered}
    remaining = [c for c in concepts if c.concept_id not in seen]
    remaining.sort(key=lambda c: role_priority.get(c.epistemic_role, 9))
    ordered.extend(remaining)

    return ordered


# ─────────────────────────────────────────────────────────────────────────────
# TIME ALLOCATION
# ─────────────────────────────────────────────────────────────────────────────

def _allocate_time(
    concepts: List[ConceptNode],
    tier: DurationTier,
    total_sec: float,
) -> Dict[str, float]:
    """
    Allocates teaching time across selected concepts.

    PRINCIPLE: Time allocation reflects cognitive weight, not equal division.
    Foundational axioms and core mechanisms get more time because they
    are prerequisites for everything else. Edge cases and tradeoffs get
    relatively less time because they presuppose prior understanding.

    Weight by: epistemic_role + significance_score + number of active layers
    """
    tier_layers = _TIER_LAYERS[tier]

    weights: Dict[str, float] = {}
    for c in concepts:
        layers = tier_layers.get(c.epistemic_role, tier_layers["_default"])
        layer_words = _layers_word_budget(layers)
        # Weight = calibrated word need × significance
        weights[c.concept_id] = layer_words * max(0.5, c.significance_score)

    total_weight = sum(weights.values()) or 1.0
    return {
        cid: (w / total_weight) * total_sec
        for cid, w in weights.items()
    }


# ─────────────────────────────────────────────────────────────────────────────
# DESIGN RATIONALE GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

def _build_rationale(
    tier: DurationTier,
    active_count: int,
    total_count: int,
    excluded: Dict[str, str],
    duration_min: int,
) -> str:
    tier_descriptions = {
        "flash_3m": (
            f"This is a {duration_min}-minute flash overview. "
            "The goal is to answer 'What is this and why does it matter?' — nothing more. "
            "Only the single most significant core concept is introduced using hook and intuition layers. "
            "No mechanisms, no examples, no caveats. The learner leaves with a mental model, not mastery."
        ),
        "standard_10m": (
            f"This is a {duration_min}-minute standard lecture. "
            "The goal is 'I understand what this is and can explain it to someone else.' "
            "Core and foundational concepts are taught with intuition and analogy. "
            "Formal mechanisms, worked examples, and caveats are deliberately deferred — "
            "they would overload working memory without sufficient time for consolidation."
        ),
        "deep_30m": (
            f"This is a {duration_min}-minute deep dive. "
            "The goal is 'I can apply this knowledge to solve real problems.' "
            "All core concepts are covered with full mechanism explanation, "
            "at least one worked example, and practical application context. "
            "Edge cases and architectural tradeoffs are introduced but not exhaustively analyzed."
        ),
        "masterclass_60m": (
            f"This is a {duration_min}-minute masterclass. "
            "The goal is 'I can reason about tradeoffs, predict failure modes, "
            "and evaluate design decisions.' "
            "All knowledge space concepts are covered at full cognitive depth. "
            "This includes failure cases, comparative tradeoffs, misconception inoculation, "
            "and synthesis callbacks that connect ideas across the full knowledge graph."
        ),
    }
    base = tier_descriptions.get(tier, "")
    if excluded:
        base += (
            f" {len(excluded)} concept(s) from the knowledge space are deliberately "
            "excluded at this tier — not because of compression, but because they are "
            "pedagogically inappropriate for this duration and audience level."
        )
    return base


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class CurriculumOptimizer:
    """
    Designs a complete teaching curriculum for a given duration.

    INVARIANT: This class NEVER compresses, truncates, or shortens content.
    It SELECTS which concepts to teach and at what cognitive depth.
    """

    def compile_curriculum(
        self,
        knowledge_ir: KnowledgeIR,
        target_duration_min: int = 10,
        speaking_wpm: int = 135,
    ) -> CurriculumIR:
        """
        Compile the best possible teaching curriculum for the target duration.

        The result is a qualitatively different teaching plan per duration,
        not a compression of the same lecture.
        """
        tier = _get_tier(target_duration_min)
        target_sec = target_duration_min * 60
        total_words = int((target_sec / 60) * speaking_wpm)

        # ── Step 1: Select concepts appropriate for this tier ────────────────
        included: List[ConceptNode] = []
        excluded: Dict[str, str] = {}

        for concept in knowledge_ir.concepts:
            role = concept.epistemic_role
            role_map = _ROLE_INCLUSION.get(role, {})
            if role_map.get(tier, True):
                included.append(concept)
            else:
                reason = (
                    _EXCLUSION_RATIONALE
                    .get(role, {})
                    .get(tier, f"Not included at {tier} tier.")
                )
                excluded[concept.concept_id] = reason

        # ── Step 2: Special case — flash_3m: only the top 1 core concept ─────
        if tier == "flash_3m":
            core_candidates = [
                c for c in included
                if c.epistemic_role in ("foundational_axiom", "core_mechanism")
            ]
            core_candidates.sort(key=lambda c: c.significance_score, reverse=True)
            top = core_candidates[:1]
            for c in included:
                if c not in top:
                    excluded[c.concept_id] = (
                        "flash_3m can only introduce the single most significant concept. "
                        "This concept is pedagogically appropriate but excluded due to time."
                    )
            included = top

        # ── Step 3: Topological sort (prerequisite ordering) ─────────────────
        # This may REORDER concepts from their original slide sequence.
        ordered = _topological_sort(included, knowledge_ir.edges)

        # ── Step 4: Time allocation (weighted by cognitive need) ──────────────
        time_allocation = _allocate_time(ordered, tier, float(target_sec))

        # ── Step 5: Build TeachingUnitPlan per concept ────────────────────────
        tier_layers = _TIER_LAYERS[tier]
        bloom_ceiling = _TIER_BLOOM_CEILING[tier]
        evidence_density = _TIER_EVIDENCE_DENSITY[tier]
        include_analogy = _TIER_INCLUDE_ANALOGY[tier]
        include_misconception = _TIER_MISCONCEPTION[tier]

        trajectory: List[TeachingUnitPlan] = []
        prereq_ids_so_far: List[str] = []

        for idx, concept in enumerate(ordered):
            layers = tier_layers.get(concept.epistemic_role, tier_layers["_default"])

            # Override analogy inclusion per concept
            active_layers = list(layers)
            if include_analogy and concept.analogies and "analogy_grounding" not in active_layers:
                # Insert after intuition if present
                if "intuition" in active_layers:
                    i = active_layers.index("intuition")
                    active_layers.insert(i + 1, "analogy_grounding")
            if not include_analogy and "analogy_grounding" in active_layers:
                active_layers.remove("analogy_grounding")

            if include_misconception and concept.common_misconceptions and "misconception_inoculation" not in active_layers:
                if "formal_definition" in active_layers:
                    i = active_layers.index("formal_definition")
                    active_layers.insert(i + 1, "misconception_inoculation")

            concept_time_sec = time_allocation.get(concept.concept_id, target_sec / max(1, len(ordered)))
            layer_words = _layers_word_budget(active_layers)
            # Scale words proportionally to time allocation
            scaled_words = int(layer_words * (concept_time_sec / target_sec) * len(ordered))
            scaled_words = max(30, scaled_words)

            # Evidence selection
            all_evidence = concept.evidence_artifacts
            n_evidence = max(0, round(len(all_evidence) * evidence_density))
            primary_evidence = all_evidence[0].artifact_id if all_evidence and n_evidence >= 1 else None
            supporting = [e.artifact_id for e in all_evidence[1:n_evidence]]

            # Pedagogical strategy
            if idx == 0:
                strategy = "epistemic_hook_reveal"
            elif concept.epistemic_role == "architectural_tradeoff":
                strategy = "comparative_tradeoff_analysis"
            elif concept.analogies and include_analogy:
                strategy = "intuitive_analogy_walkthrough"
            elif primary_evidence:
                strategy = "empirical_evidence_deconstruction"
            elif idx == len(ordered) - 1:
                strategy = "synthesis_and_mastery"
            else:
                strategy = "intuitive_analogy_walkthrough"

            # Bloom level: capped by tier ceiling, elevated by role
            bloom_map = {
                "foundational_axiom":    "Understand",
                "core_mechanism":        "Understand",
                "architectural_tradeoff":"Analyze",
                "empirical_proof":       "Apply",
                "edge_case_limitation":  "Analyze",
                "practical_application": "Apply",
            }
            raw_bloom = bloom_map.get(concept.epistemic_role, "Understand")
            # Apply ceiling
            bloom = raw_bloom if BLOOM_RANK.get(raw_bloom, 2) <= BLOOM_RANK.get(bloom_ceiling, 4) else bloom_ceiling

            depth = TeachingDepth(
                narration_layers=active_layers,
                evidence_density=evidence_density,
                bloom_ceiling=bloom_ceiling,
                include_analogy=include_analogy and bool(concept.analogies),
                include_misconception_inoculation=include_misconception and bool(concept.common_misconceptions),
                teaching_time_sec=concept_time_sec,
            )

            # Epistemic goal — tier-specific language
            goal_templates = {
                "flash_3m":        f"Grasp the essential idea of {concept.canonical_name} and why it matters.",
                "standard_10m":    f"Understand {concept.canonical_name} well enough to explain it clearly.",
                "deep_30m":        f"Apply {concept.canonical_name} to solve practical problems.",
                "masterclass_60m": f"Analyze tradeoffs and failure modes in {concept.canonical_name}.",
            }

            unit = TeachingUnitPlan(
                unit_id=f"unit_{idx + 1:02d}_{concept.concept_id}",
                concept_id=concept.concept_id,
                unit_title=concept.canonical_name,
                target_duration_sec=round(concept_time_sec, 1),
                target_word_budget=scaled_words,
                pedagogical_strategy=strategy,
                bloom_level=bloom,
                depth=depth,
                primary_evidence_artifact_id=primary_evidence,
                supporting_artifact_ids=supporting,
                epistemic_goal=goal_templates[tier],
                prerequisite_concept_ids=list(prereq_ids_so_far),
            )
            trajectory.append(unit)
            prereq_ids_so_far.append(concept.concept_id)

        # ── Step 6: Aggregate metrics ─────────────────────────────────────────
        total_active = len(ordered)
        pruned_count = len(knowledge_ir.concepts) - total_active
        cognitive_density = round(
            sum(c.cognitive_complexity_score for c in ordered) / max(1, total_active), 2
        )

        rationale = _build_rationale(
            tier, total_active, len(knowledge_ir.concepts), excluded, target_duration_min
        )

        return CurriculumIR(
            curriculum_id=f"curr_{knowledge_ir.knowledge_space_id}_{target_duration_min}m",
            knowledge_space_id=knowledge_ir.knowledge_space_id,
            target_duration_min=target_duration_min,
            total_target_duration_sec=float(target_sec),
            total_target_words=total_words,
            teaching_design_strategy=tier,
            compression_strategy=tier,  # backward-compat alias
            teaching_trajectory=trajectory,
            active_concepts_count=total_active,
            pruned_concepts_count=max(0, pruned_count),
            cognitive_density_score=cognitive_density,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            design_rationale=rationale,
            excluded_concept_rationale=excluded,
        )
