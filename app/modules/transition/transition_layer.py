# app/modules/transition/transition_layer.py
# -*- coding: utf-8 -*-
"""
==============================================================================
TRANSITION INTELLIGENCE LAYER (TIL)
==============================================================================
Operates BETWEEN sections — BEFORE narration script generation.

For every adjacent concept pair (A, B) in the LessonBlueprint:
  1. Analyzes the relationship type between A and B
  2. Infers the learner's implicit question that A creates
  3. Selects the correct transition strategy
  4. Generates:
     - closing_sentence_a  (last words of section A)
     - opening_sentence_b  (first words of section B)
     - bridge_text         (complete prose bridge)
  5. Scores the transition quality along 5 dimensions

ROOT CAUSE OF SLIDE-CENTRIC TRANSITIONS:
─────────────────────────────────────────
The existing system generates each section in ISOLATION:
    for section in blueprint.sections:
        narration = generate(section)   ← no awareness of neighbors

This causes:
  - Each section starts with the section TITLE (because it's the only signal)
  - The generator defaults to "Let's move on to X" / "In this section, we..."
  - There is no semantic reason WHY B follows A, only positional order

THE FIX (this module):
─────────────────────────────────────────
  transitions = TIL.analyze(blueprint)
  for section_b in blueprint.sections[1:]:
      bridge = transitions[section_b.section_id]
      narration_b = generate(section_b, prefix=bridge.opening_sentence_b)
      narration_a[-1] += bridge.closing_sentence_a

==============================================================================
"""

import uuid
import datetime
import re
from typing import List, Dict, Optional, Tuple

from app.models.blueprint import LessonBlueprint, SectionPlan
from app.models.transition_ir import (
    TransitionIR,
    LectureTransitionMap,
    TransitionRelationship,
    TransitionStrategy,
    TransitionQualityMetrics,
)
from app.core.provider import BaseLLMProvider, get_llm_provider


# ─────────────────────────────────────────────────────────────────────────────
# SLIDE-CENTRIC ANTI-PATTERNS (to detect and eliminate)
# ─────────────────────────────────────────────────────────────────────────────

SLIDE_CENTRIC_PHRASES = [
    r"let'?s move on to",
    r"next slide",
    r"next section",
    r"now we will see",
    r"in this slide",
    r"in this section",
    r"as you can see on the slide",
    r"turning to the next",
    r"moving on",
    r"the next topic is",
    r"now let'?s look at",
    r"this slide (shows|presents|covers)",
    r"our next (topic|subject|point) is",
    r"bây giờ (chúng ta|ta) (sẽ|cùng) (xem|sang|chuyển)",
    r"tiếp theo (chúng ta|ta) (sẽ|xem xét)",
    r"slide tiếp theo",
    r"phần tiếp theo là",
    r"chuyển sang phần",
    r"trong slide này",
]

_SLIDE_CENTRIC_RE = re.compile(
    "|".join(SLIDE_CENTRIC_PHRASES),
    re.IGNORECASE | re.UNICODE
)


def detect_slide_centric(text: str) -> List[str]:
    """Returns all slide-centric phrases found in text."""
    return _SLIDE_CENTRIC_RE.findall(text)


# ─────────────────────────────────────────────────────────────────────────────
# RELATIONSHIP INFERENCE RULES (rule-based, fast path)
# ─────────────────────────────────────────────────────────────────────────────

_ROLE_PAIR_TO_RELATIONSHIP: Dict[
    Tuple[str, str], Tuple[TransitionRelationship, TransitionStrategy]
] = {
    # Pedagogical role pairs → (relationship, strategy)
    ("hook",        "definition"):   ("ObservationToExplanation",  "curiosity_hook"),
    ("hook",        "mechanism"):    ("ObservationToExplanation",  "curiosity_hook"),
    ("hook",        "example"):      ("AbstractToConcreteInstance","curiosity_hook"),
    ("definition",  "mechanism"):    ("FoundationToExtension",     "causal_chain"),
    ("definition",  "example"):      ("DefinitionToExample",       "gap_bridge"),
    ("definition",  "comparison"):   ("SimpleToAdvanced",          "contrast_pivot"),
    ("mechanism",   "example"):      ("ConceptToApplication",      "gap_bridge"),
    ("mechanism",   "mechanism"):    ("StepToNextStep",            "sequential_step"),
    ("mechanism",   "comparison"):   ("TradeoffAnalysis",          "contrast_pivot"),
    ("mechanism",   "summary"):      ("SummaryToDepth",            "zoom_transition"),
    ("example",     "mechanism"):    ("PrerequisiteToDependent",   "causal_chain"),
    ("example",     "comparison"):   ("ContrastHighlight",         "contrast_pivot"),
    ("example",     "summary"):      ("ComponentToWhole",          "zoom_transition"),
    ("comparison",  "summary"):      ("ScopeWideOut",              "zoom_transition"),
    ("comparison",  "mechanism"):    ("TradeoffAnalysis",          "contrast_pivot"),
    ("summary",     "hook"):         ("ScopeNarrowDown",           "curiosity_hook"),
    ("summary",     "definition"):   ("FoundationToExtension",     "gap_bridge"),
}

_DEFAULT_RELATIONSHIP: TransitionRelationship = "PrerequisiteToDependent"
_DEFAULT_STRATEGY: TransitionStrategy = "gap_bridge"


def _infer_relationship(
    plan_a: SectionPlan, plan_b: SectionPlan
) -> Tuple[TransitionRelationship, TransitionStrategy]:
    """Infer transition relationship from pedagogical roles."""
    key = (plan_a.pedagogical_function, plan_b.pedagogical_function)
    return _ROLE_PAIR_TO_RELATIONSHIP.get(key, (_DEFAULT_RELATIONSHIP, _DEFAULT_STRATEGY))


# ─────────────────────────────────────────────────────────────────────────────
# BRIDGE TEMPLATES (rule-based, zero-LLM fast path)
# ─────────────────────────────────────────────────────────────────────────────

_BRIDGE_TEMPLATES: Dict[str, Dict[str, str]] = {
    "LimitationToSolution": {
        "closing": (
            "But {concept_a} alone has a fundamental limitation: "
            "it cannot tell us {gap}."
        ),
        "opening": (
            "That is precisely the gap that {concept_b} fills — "
            "giving us {resolution}."
        ),
        "question": "What critical information does {concept_a} still leave out?",
    },
    "DefinitionToExample": {
        "closing": (
            "This definition is precise, but abstract. "
            "The real question is: what does {concept_a} look like in practice?"
        ),
        "opening": (
            "Consider this concrete case — {concept_b} — "
            "which shows exactly how the definition plays out."
        ),
        "question": "How does {concept_a} behave in a real scenario?",
    },
    "PrerequisiteToDependent": {
        "closing": (
            "Understanding {concept_a} is essential, because without it "
            "the next idea simply would not make sense."
        ),
        "opening": (
            "Building directly on that foundation, {concept_b} "
            "takes the reasoning one step further."
        ),
        "question": "What depends on understanding {concept_a} first?",
    },
    "ConceptToApplication": {
        "closing": (
            "The theory of {concept_a} is now clear. "
            "The more interesting question is: where does this actually get used?"
        ),
        "opening": (
            "{concept_b} is the answer — the direct application of everything "
            "we just established."
        ),
        "question": "How is {concept_a} applied in a real system?",
    },
    "StepToNextStep": {
        "closing": (
            "With {concept_a} complete, we have everything we need for the next stage."
        ),
        "opening": (
            "That feeds directly into {concept_b}, "
            "which takes the output of the previous step and transforms it further."
        ),
        "question": "What happens after {concept_a}?",
    },
    "ContrastHighlight": {
        "closing": (
            "{concept_a} works well in certain conditions. "
            "But there is a different approach worth examining."
        ),
        "opening": (
            "{concept_b}, by contrast, takes a fundamentally different path — "
            "which reveals an important tradeoff."
        ),
        "question": "How does {concept_a} compare to an alternative?",
    },
    "FoundationToExtension": {
        "closing": (
            "{concept_a} gives us the core building block. "
            "The natural question is: how far can we extend this?"
        ),
        "opening": (
            "{concept_b} is exactly that extension — "
            "it inherits the foundation and adds a new layer of power."
        ),
        "question": "What does {concept_a} enable beyond itself?",
    },
    "ObservationToExplanation": {
        "closing": (
            "We have observed that {concept_a}. "
            "But observation alone is not enough — we need to understand why."
        ),
        "opening": (
            "{concept_b} is the mechanism that explains what we just saw."
        ),
        "question": "Why does {concept_a} behave this way?",
    },
    "ComponentToWhole": {
        "closing": (
            "We have examined {concept_a} in isolation. "
            "Now we can step back and see where it fits in the larger picture."
        ),
        "opening": (
            "{concept_b} is that larger picture — "
            "the system into which {concept_a} slots as a critical component."
        ),
        "question": "How does {concept_a} contribute to the full system?",
    },
    "ScopeWideOut": {
        "closing": (
            "We have spent time in the details of {concept_a}. "
            "It is worth pulling back to see the broader implications."
        ),
        "opening": (
            "At a higher level, {concept_b} is the perspective "
            "that unifies everything we have covered."
        ),
        "question": "What does {concept_a} look like from a higher vantage point?",
    },
    # Default fallback
    "_default": {
        "closing": (
            "{concept_a} lays the groundwork for the next idea. "
            "There is still one important question left open."
        ),
        "opening": (
            "{concept_b} is the answer — and it changes how we think about everything so far."
        ),
        "question": "What important idea does {concept_a} lead to?",
    },
}


def _fill_template(template: str, concept_a: str, concept_b: str,
                   gap: str = "something essential",
                   resolution: str = "that missing piece") -> str:
    return (template
            .replace("{concept_a}", concept_a)
            .replace("{concept_b}", concept_b)
            .replace("{gap}", gap)
            .replace("{resolution}", resolution))


# ─────────────────────────────────────────────────────────────────────────────
# SCORING
# ─────────────────────────────────────────────────────────────────────────────

def _score_transition(
    closing: str,
    opening: str,
    concept_a: str,
    concept_b: str,
    relationship: TransitionRelationship,
) -> TransitionQualityMetrics:
    bridge = closing + " " + opening

    # Slide-dependency: penalize slide-centric phrases
    bad_phrases = detect_slide_centric(bridge)
    slide_dep = min(1.0, len(bad_phrases) * 0.35)

    # Human flow: presence of idea-connective language
    connectives = ["however", "but", "yet", "that is why", "this is where",
                   "which means", "the reason", "so", "therefore", "exactly",
                   "nhưng", "chính vì vậy", "đó là lý do", "đây là lúc",
                   "điều này", "vì thế", "vì vậy"]
    flow_hits = sum(1 for c in connectives if c in bridge.lower())
    human_flow = min(1.0, 0.5 + flow_hits * 0.1)

    # Coherence: concept labels appear in bridge
    a_in_bridge = concept_a.lower()[:8] in bridge.lower()
    b_in_bridge = concept_b.lower()[:8] in bridge.lower()
    coherence = 0.5 + (0.25 if a_in_bridge else 0) + (0.25 if b_in_bridge else 0)

    # Continuity: closing ends without title injection, opening doesn't start with title
    title_injected = any(
        concept_b.lower()[:6] in s.lower()
        for s in [closing[:60]]
    )
    continuity = 0.5 if title_injected else 0.9

    # Overall quality
    quality = min(1.0, (human_flow + coherence + continuity) / 3.0 * (1 - slide_dep * 0.5))

    return TransitionQualityMetrics(
        transition_quality_score=round(quality, 3),
        bridge_coherence_score=round(coherence, 3),
        concept_continuity_score=round(continuity, 3),
        human_lecture_flow_score=round(human_flow, 3),
        slide_dependency_score=round(slide_dep, 3),
    )


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class TransitionIntelligenceLayer:
    """
    Analyzes every adjacent section pair in a LessonBlueprint
    and produces a LectureTransitionMap.

    Usage in pipeline:
        til = TransitionIntelligenceLayer(provider)
        transition_map = til.analyze(blueprint)

        # In narration generation:
        bridge = transition_map.get(section_b.section_id)
        narration_b = bridge.opening_sentence_b + " " + raw_narration_b
        narration_a = raw_narration_a + " " + bridge.closing_sentence_a
    """

    def __init__(self, provider: Optional[BaseLLMProvider] = None, use_llm: bool = True):
        self.provider = provider or get_llm_provider()
        self.use_llm = use_llm

    # ── Public API ────────────────────────────────────────────────────────────

    def analyze(self, blueprint: LessonBlueprint) -> LectureTransitionMap:
        """
        Analyze all adjacent section pairs and produce a LectureTransitionMap.
        """
        sections = blueprint.sections
        transitions: List[TransitionIR] = []

        for i in range(len(sections) - 1):
            plan_a = sections[i]
            plan_b = sections[i + 1]
            tr = self._build_transition(plan_a, plan_b, i)
            transitions.append(tr)

        # Aggregate stats
        if transitions:
            qualities = [t.quality for t in transitions if t.quality]
            avg_q = sum(q.transition_quality_score for q in qualities) / len(qualities) if qualities else 0.0
            avg_c = sum(q.bridge_coherence_score for q in qualities) / len(qualities) if qualities else 0.0
            avg_f = sum(q.human_lecture_flow_score for q in qualities) / len(qualities) if qualities else 0.0
            avg_s = sum(q.slide_dependency_score for q in qualities) / len(qualities) if qualities else 0.0
            weak = [t.transition_id for t in transitions if t.quality and t.quality.overall < 0.6]
        else:
            avg_q = avg_c = avg_f = avg_s = 0.0
            weak = []

        return LectureTransitionMap(
            map_id=f"tmap_{uuid.uuid4().hex[:8]}",
            blueprint_id=blueprint.blueprint_id,
            document_id=blueprint.document_id,
            transitions=transitions,
            average_transition_quality=round(avg_q, 3),
            average_bridge_coherence=round(avg_c, 3),
            average_human_flow=round(avg_f, 3),
            average_slide_dependency=round(avg_s, 3),
            total_transitions=len(transitions),
            weak_transitions=weak,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        )

    def get_transition_index(
        self, transition_map: LectureTransitionMap
    ) -> Dict[str, TransitionIR]:
        """Returns {to_section_id: TransitionIR} for fast lookup during narration generation."""
        return {tr.to_section_id: tr for tr in transition_map.transitions}

    # ── Core builder ─────────────────────────────────────────────────────────

    def _build_transition(
        self,
        plan_a: SectionPlan,
        plan_b: SectionPlan,
        index: int,
    ) -> TransitionIR:
        concept_a = self._concept_label(plan_a)
        concept_b = self._concept_label(plan_b)

        relationship, strategy = _infer_relationship(plan_a, plan_b)

        # Step 1: Rule-based generation (fast, zero-LLM)
        closing, opening, question = self._rule_based_bridge(
            concept_a, concept_b, relationship, plan_a, plan_b
        )

        # Step 2: (Optional) LLM polish if provider available
        if self.use_llm and self.provider:
            closing, opening = self._llm_polish(
                concept_a, concept_b, relationship, strategy,
                closing, opening, question, plan_a, plan_b
            )

        # Step 3: Anti-pattern detection
        bridge_text = f"{closing} {opening}"
        bad_phrases = detect_slide_centric(bridge_text)

        # Step 4: Score
        quality = _score_transition(closing, opening, concept_a, concept_b, relationship)

        return TransitionIR(
            transition_id=f"tr_{index + 1:02d}_{index + 2:02d}",
            from_section_id=plan_a.section_id,
            to_section_id=plan_b.section_id,
            from_concept_label=concept_a,
            to_concept_label=concept_b,
            relationship=relationship,
            bridge_reason=self._infer_bridge_reason(concept_a, concept_b, relationship),
            learner_question=question,
            strategy=strategy,
            closing_sentence_a=closing,
            opening_sentence_b=opening,
            bridge_text=bridge_text,
            quality=quality,
            slide_centric_phrases_detected=bad_phrases,
            generation_method="hybrid" if (self.use_llm and self.provider) else "rule_based",
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _concept_label(self, plan: SectionPlan) -> str:
        """Extract human-readable concept label from section plan."""
        if plan.key_concepts:
            return plan.key_concepts[0]
        return plan.title

    def _rule_based_bridge(
        self,
        concept_a: str,
        concept_b: str,
        relationship: TransitionRelationship,
        plan_a: SectionPlan,
        plan_b: SectionPlan,
    ) -> Tuple[str, str, str]:
        """Generate bridge text using rule-based templates (zero-LLM)."""
        templates = _BRIDGE_TEMPLATES.get(relationship, _BRIDGE_TEMPLATES["_default"])

        # Infer semantic gap and resolution from key concepts and goals
        gap = self._infer_gap(plan_a, plan_b)
        resolution = self._infer_resolution(plan_b)

        closing = _fill_template(templates["closing"], concept_a, concept_b, gap, resolution)
        opening = _fill_template(templates["opening"], concept_a, concept_b, gap, resolution)
        question = _fill_template(templates["question"], concept_a, concept_b, gap, resolution)

        return closing, opening, question

    def _infer_gap(self, plan_a: SectionPlan, plan_b: SectionPlan) -> str:
        """What does A leave unanswered that B addresses?"""
        # Rough heuristic based on pedagogical role
        role_gaps = {
            "hook":       "how this actually works in detail",
            "definition": "how this definition manifests in practice",
            "mechanism":  "what the downstream effect or application is",
            "example":    "how this generalizes to other cases",
            "comparison": "which approach is better in which context",
            "summary":    "what the next step would be",
        }
        return role_gaps.get(plan_a.pedagogical_function, "the full picture")

    def _infer_resolution(self, plan_b: SectionPlan) -> str:
        """What does B provide as the answer?"""
        if plan_b.key_concepts:
            return f"the concept of {plan_b.key_concepts[0]}"
        return f"the {plan_b.pedagogical_function} of {plan_b.title}"

    def _infer_bridge_reason(
        self,
        concept_a: str,
        concept_b: str,
        relationship: TransitionRelationship,
    ) -> str:
        """Explain in one sentence why B appears after A."""
        reasons = {
            "LimitationToSolution":    f"{concept_a} defines the problem space; {concept_b} is the solution.",
            "DefinitionToExample":     f"{concept_a} establishes the abstract definition; {concept_b} grounds it concretely.",
            "PrerequisiteToDependent": f"{concept_b} cannot be understood without {concept_a} as its foundation.",
            "ConceptToApplication":    f"{concept_a} is the theory; {concept_b} is where it is actually applied.",
            "StepToNextStep":          f"{concept_a} produces the input that {concept_b} processes.",
            "FoundationToExtension":   f"{concept_a} is the base case; {concept_b} extends or generalizes it.",
            "ObservationToExplanation":f"{concept_a} reveals the phenomenon; {concept_b} explains the mechanism.",
            "ContrastHighlight":       f"{concept_a} and {concept_b} take different approaches to the same problem.",
            "ComponentToWhole":        f"{concept_a} is one part; {concept_b} is the system it belongs to.",
            "ScopeWideOut":            f"{concept_a} is the detail; {concept_b} is the broader context.",
        }
        return reasons.get(
            relationship,
            f"{concept_a} sets the stage; {concept_b} advances the argument."
        )

    def _llm_polish(
        self,
        concept_a: str,
        concept_b: str,
        relationship: str,
        strategy: str,
        closing_draft: str,
        opening_draft: str,
        learner_question: str,
        plan_a: SectionPlan,
        plan_b: SectionPlan,
    ) -> Tuple[str, str]:
        """
        LLM-assisted polish of rule-based bridge text.
        Preserves the semantic structure, improves naturalness.
        """
        system = (
            "You are an expert educational lecturer and scriptwriter. "
            "Your job is to write seamless, human-sounding transitions between lecture concepts. "
            "STRICT RULES:\n"
            "1. NEVER say: 'Let's move on to', 'Next slide', 'In this section', 'Now we will see'.\n"
            "2. The transition must be idea-centric, not slide-centric.\n"
            "3. The closing sentence plants a gap or question without naming the next topic explicitly.\n"
            "4. The opening sentence answers that gap naturally.\n"
            "5. Each output should be 1–2 sentences maximum.\n"
            "6. Match the academic/instructional tone.\n"
            "7. Output ONLY the closing sentence, then a blank line, then the opening sentence."
        )

        prompt = (
            f"CONCEPT A: {concept_a} (pedagogical role: {plan_a.pedagogical_function})\n"
            f"CONCEPT B: {concept_b} (pedagogical role: {plan_b.pedagogical_function})\n"
            f"RELATIONSHIP TYPE: {relationship}\n"
            f"TRANSITION STRATEGY: {strategy}\n"
            f"LEARNER QUESTION (implicit): {learner_question}\n\n"
            f"CURRENT DRAFT — Closing sentence of A:\n{closing_draft}\n\n"
            f"CURRENT DRAFT — Opening sentence of B:\n{opening_draft}\n\n"
            "Rewrite both sentences to sound more natural and human. "
            "Preserve the semantic bridge. Improve flow. "
            "Output closing sentence first, blank line, then opening sentence."
        )

        try:
            raw = self.provider.generate(prompt, system).strip()
            parts = [p.strip() for p in raw.split("\n\n") if p.strip()]
            if len(parts) >= 2:
                polished_closing = parts[0]
                polished_opening = parts[1]
                # Safety: reject if slide-centric phrases crept back in
                if not detect_slide_centric(polished_closing + " " + polished_opening):
                    return polished_closing, polished_opening
        except Exception:
            pass  # Graceful degradation to rule-based

        return closing_draft, opening_draft
