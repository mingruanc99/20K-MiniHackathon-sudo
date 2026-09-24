# app/modules/generator/narration.py
"""
Module 3A: Narration Script Generator

Transforms SectionPlan into a spoken lecture narration.

═══════════════════════════════════════════════════════════════════
TEACHING DEPTH INTEGRATION (from CurriculumOptimizer)
═══════════════════════════════════════════════════════════════════
When the SectionPlan carries a TeachingDepth profile (attached by
plan_from_curriculum), the generator uses LAYER-BASED generation:

  10-minute plan gets: [hook_question, intuition, analogy_grounding]
  30-minute plan gets: [hook_question, intuition, formal_definition,
                        mechanism, visual_walkthrough, worked_example]
  60-minute plan gets: [all of the above + comparison, caveat,
                        failure_case, misconception_inoculation]

This produces QUALITATIVELY DIFFERENT narrations for each duration,
not just shorter or longer versions of the same script.

═══════════════════════════════════════════════════════════════════
TRANSITION INTELLIGENCE LAYER INTEGRATION
═══════════════════════════════════════════════════════════════════
Accepts optional bridge anchors from TIL:
  opening_bridge: First sentence (answers previous gap)
  closing_bridge: Last sentence (plants next gap)
═══════════════════════════════════════════════════════════════════
"""
from typing import Optional, List, Dict
from app.models.blueprint import SectionPlan
from app.models.document import DocumentSection
from app.models.config import PipelineConfig
from app.core.provider import BaseLLMProvider


# ─────────────────────────────────────────────────────────────────────────────
# ANTI-PATTERNS
# ─────────────────────────────────────────────────────────────────────────────

_FORBIDDEN_TRANSITIONS = [
    "Let's move on to",
    "Next slide",
    "Next section",
    "Now we will see",
    "In this slide",
    "In this section",
    "Turning to",
    "Moving on",
    "Our next topic",
    "Bay gio chung ta se",
    "Tiep theo chung ta",
    "Slide tiep theo",
    "Phan tiep theo la",
    "Chuyen sang phan",
    "Trong slide nay",
]

# ─────────────────────────────────────────────────────────────────────────────
# LAYER DESCRIPTIONS (for LLM prompt)
# ─────────────────────────────────────────────────────────────────────────────

_LAYER_DESCRIPTIONS: Dict[str, str] = {
    "hook_question":              "Open with a compelling question that makes the learner feel WHY this matters.",
    "intuition":                  "Explain the core idea in plain language. No formulas. No jargon. Pure concept.",
    "formal_definition":          "Give the precise technical definition, grounded in the source material.",
    "mechanism":                  "Explain HOW it works, step by step. Include internal logic and data flow.",
    "worked_example":             "Walk through a concrete example. Show the concept in action.",
    "visual_walkthrough":         "Guide the listener through the key visual/diagram, pointing to what matters.",
    "application":                "Describe where and how this is used in practice. Real-world context.",
    "analogy_grounding":          "Introduce a grounding analogy from everyday experience.",
    "comparison":                 "Compare with an alternative. What are the tradeoffs?",
    "caveat":                     "Describe known limitations, edge cases, or conditions where it fails.",
    "failure_case":               "Give a concrete example where this breaks. What goes wrong and why.",
    "misconception_inoculation":  "Pre-empt the most common misunderstanding. State it and correct it.",
    "synthesis_callback":         "Connect back to earlier concepts. Show how this builds on what came before.",
    "open_question":              "End with a productive question that sets up the next concept naturally.",
}


class NarrationGenerator:
    def __init__(self, provider: BaseLLMProvider):
        self.provider = provider

    def generate_narration(
        self,
        plan: SectionPlan,
        section: DocumentSection,
        config: PipelineConfig,
        opening_bridge: Optional[str] = None,
        closing_bridge: Optional[str] = None,
    ) -> str:
        """
        Generate spoken narration for a single concept section.

        When the plan carries a TeachingDepth profile (from CurriculumOptimizer),
        the LLM generates exactly the specified cognitive layers in order.
        This is the key mechanism that makes different durations produce
        qualitatively different lecture scripts.
        """
        forbidden_str = "\n".join(f'  - "{p}"' for p in _FORBIDDEN_TRANSITIONS)

        # ── TeachingDepth layer injection ─────────────────────────────────────
        teaching_depth = plan.__dict__.get("teaching_depth", None)
        depth_instruction = ""
        if teaching_depth:
            layers: List[str] = teaching_depth.get("narration_layers", [])
            bloom_ceiling: str = teaching_depth.get("bloom_ceiling", plan.bloom_level)
            include_analogy: bool = teaching_depth.get("include_analogy", False)
            include_misconception: bool = teaching_depth.get("include_misconception_inoculation", False)
            evidence_density: float = teaching_depth.get("evidence_density", 0.5)
            teaching_time: float = teaching_depth.get("teaching_time_sec", float(plan.target_duration_sec))
            target_duration_min: int = config.presentation.target_duration_sec // 60

            layers_formatted = "\n".join(
                f"  {i+1}. [{layer.upper()}] — {_LAYER_DESCRIPTIONS.get(layer, layer)}"
                for i, layer in enumerate(layers)
            )

            depth_instruction = (
                f"\n\n{'='*60}\n"
                f"TEACHING DEPTH PROFILE (Duration-Aware Curriculum)\n"
                f"{'='*60}\n"
                f"This is a {target_duration_min}-MINUTE lecture.\n"
                f"Teaching time for this concept: {int(teaching_time)}s\n"
                f"Bloom Ceiling: {bloom_ceiling} — do NOT generate content above this cognitive level.\n"
                f"Include Analogy: {'YES' if include_analogy else 'NO'}\n"
                f"Include Misconception Inoculation: {'YES' if include_misconception else 'NO'}\n"
                f"Evidence Density: {evidence_density:.0%} of available visuals/diagrams\n\n"
                f"COGNITIVE LAYERS — generate EXACTLY these, in this order:\n"
                f"{layers_formatted}\n\n"
                f"RULES:\n"
                f"- Generate all listed layers as a single flowing spoken narrative.\n"
                f"- Do NOT add any layer not listed above.\n"
                f"- Do NOT omit any listed layer.\n"
                f"- Each layer = 1-3 sentences (calibrated to the time budget).\n"
                f"- Total target: ~{plan.target_word_budget} words.\n"
                f"- A {target_duration_min}-minute lecture demands DIFFERENT DEPTH than a 30-minute one.\n"
                f"  At 10 min: intuition only, no mechanisms.\n"
                f"  At 30 min: add mechanism and worked example.\n"
                f"  At 60 min: add comparison, caveat, failure cases.\n"
                f"  Generate content appropriate for {target_duration_min} minutes, no more.\n"
                f"{'='*60}"
            )

        # ── Bridge instructions ───────────────────────────────────────────────
        opening_instruction = ""
        if opening_bridge:
            opening_instruction = (
                f"\n\nOPENING BRIDGE (MANDATORY FIRST SENTENCE):\n"
                f'"{opening_bridge}"\n'
                f"Your narration MUST begin with this or a close paraphrase. "
                f"Do NOT add 'In this section' before it."
            )

        closing_instruction = ""
        if closing_bridge:
            closing_instruction = (
                f"\n\nCLOSING BRIDGE (MANDATORY LAST SENTENCE):\n"
                f'"{closing_bridge}"\n'
                f"Your narration MUST end with this or a close paraphrase. "
                f"Do NOT add 'Let's move on to' after it."
            )

        # ── Main prompt ───────────────────────────────────────────────────────
        prompt = (
            f"Generate an educational lecture narration script for the following concept:\n"
            f"Concept: {plan.title}\n"
            f"Pedagogical Role: {plan.pedagogical_function}\n"
            f"Bloom Level: {plan.bloom_level}\n"
            f"Target Audience: {config.learner.target_audience}\n"
            f"Tone: {config.learner.tone}\n"
            f"Key Concepts: {', '.join(plan.key_concepts)}\n"
            f"Prerequisites (already taught): {', '.join(plan.prerequisite_concepts) if plan.prerequisite_concepts else 'None'}\n"
            f"Source Content:\n{section.raw_text}\n"
            f"\nTarget Word Count: ~{plan.target_word_budget} words.\n"
            f"\nFORBIDDEN PHRASES (never use):\n{forbidden_str}"
            f"{depth_instruction}"
            f"{opening_instruction}"
            f"{closing_instruction}"
            f"\n\nThis narration is part of a continuous lecture. "
            f"Sound like a natural, thoughtful teacher — not a slide reader. "
            f"No stage directions, no speaker labels, no markdown."
        )

        system_prompt = (
            "You are a master university lecturer and educational scriptwriter. "
            "You generate spoken narrations that sound like a brilliant, natural teacher. "
            "You NEVER announce slides, sections, or transitions. "
            "You NEVER say 'Let's move on to', 'Next slide', or 'In this section'. "
            "When given a TEACHING DEPTH PROFILE, you generate exactly those cognitive layers "
            "in order — calibrated for the target duration. "
            "A 10-minute audience gets intuition and analogy. "
            "A 30-minute audience gets mechanisms and examples. "
            "A 60-minute audience gets caveats, comparisons, and failure cases. "
            "These are qualitatively different lectures, not compressed versions."
        )

        raw = self.provider.generate(prompt, system_prompt).strip()
        cleaned = raw.replace('"', '').replace("Narration:", "").strip()
        return cleaned
