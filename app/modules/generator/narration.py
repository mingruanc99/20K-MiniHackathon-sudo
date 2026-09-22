# app/modules/generator/narration.py
"""
Module 3A: Narration Script Generator
Transforms SectionPlan into a concise, instructional spoken narrative matching W_target.
"""
from typing import Dict, Any
from app.models.blueprint import SectionPlan
from app.models.document import DocumentSection
from app.models.config import PipelineConfig
from app.core.provider import BaseLLMProvider

class NarrationGenerator:
    def __init__(self, provider: BaseLLMProvider):
        self.provider = provider

    def generate_narration(
        self,
        plan: SectionPlan,
        section: DocumentSection,
        config: PipelineConfig
    ) -> str:
        prompt = (
            f"Generate an educational lecture narration script for the following section:\n"
            f"Slide/Section Title: {plan.title}\n"
            f"Pedagogical Role: {plan.pedagogical_function}\n"
            f"Bloom Taxonomy Level: {plan.bloom_level}\n"
            f"Target Audience: {config.learner.target_audience}\n"
            f"Pedagogical Tone: {config.learner.tone}\n"
            f"Key Concepts: {', '.join(plan.key_concepts)}\n"
            f"Source Content:\n{section.raw_text}\n\n"
            f"STRICT CONSTRAINT: The narration MUST strictly target approximately {plan.target_word_budget} words.\n"
            f"Do not include stage directions, speaker prefixes, or markdown formatting in your output."
        )

        system_prompt = (
            "You are a master university lecturer and educational scriptwriter. "
            "Write clear, mathematically and conceptually accurate spoken explanations. "
            "Never use conversational filler or meta-announcements (e.g. 'In this slide, I will show you'). "
            "Jump straight into direct, engaging instruction."
        )

        raw_script = self.provider.generate(prompt, system_prompt).strip()
        # Clean any quotes or prefixes if accidentally added
        cleaned = raw_script.replace('"', '').replace("Narration:", "").strip()
        return cleaned
