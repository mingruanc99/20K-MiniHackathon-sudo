# app/modules/generator/generator.py
"""
Module 3 Coordinator: Script, Prosody & Visual Intent Generator
Transforms LessonBlueprint + CanonicalDocumentTree into DraftCLSG_IR.
Orchestrates 3A (Narration), 3B (Prosody & Pause Planning), and 3C (Visual Intent).
"""
import uuid
import datetime
from typing import Dict, Any
from app.models.blueprint import LessonBlueprint
from app.models.document import CanonicalDocumentTree, DocumentSection
from app.models.config import PipelineConfig
from app.models.expression import DraftScene, DraftCLSG_IR
from app.core.provider import BaseLLMProvider, get_llm_provider
from app.modules.generator.narration import NarrationGenerator
from app.modules.generator.prosody import ProsodyPausePlanner
from app.modules.generator.visual import VisualIntentGenerator

class ExpressionGenerator:
    def __init__(self, provider: BaseLLMProvider = None):
        self.provider = provider or get_llm_provider()
        self.narration_gen = NarrationGenerator(self.provider)
        self.prosody_planner = ProsodyPausePlanner()
        self.visual_gen = VisualIntentGenerator()

    def generate_draft(
        self,
        blueprint: LessonBlueprint,
        doc_tree: CanonicalDocumentTree,
        config: PipelineConfig
    ) -> DraftCLSG_IR:
        # Create map of document sections by section_id for quick lookup
        doc_section_map: Dict[str, DocumentSection] = {
            s.section_id: s for s in doc_tree.sections
        }

        draft_scenes = []
        total_words = 0
        total_duration = 0.0

        for plan in blueprint.sections:
            doc_sec = doc_section_map.get(
                plan.section_id,
                DocumentSection(
                    section_id=plan.section_id,
                    title=plan.title,
                    order=plan.order,
                    raw_text=plan.title
                )
            )

            # Step 3A: Narration Generation
            narration_text = self.narration_gen.generate_narration(plan, doc_sec, config)
            word_count = len(narration_text.split())
            total_words += word_count

            # Step 3B: Prosody & Pause Planning (Instructional Intent Layer)
            prosody_plan = self.prosody_planner.plan_prosody(narration_text, plan, config)
            total_duration += prosody_plan.effective_scene_duration_sec

            # Step 3C: Visual Intent Generation (13 Taxonomies)
            visual_cues = self.visual_gen.generate_visual_cues(plan, prosody_plan, config)

            scene = DraftScene(
                scene_id=f"scene_{plan.order:02d}",
                section_id=plan.section_id,
                title=plan.title,
                order=plan.order,
                pedagogical_function=plan.pedagogical_function,
                narration_text=narration_text,
                word_count=word_count,
                prosody_plan=prosody_plan,
                visual_cues=visual_cues
            )
            draft_scenes.append(scene)

        draft_id = f"draft_{uuid.uuid4().hex[:8]}"
        created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

        return DraftCLSG_IR(
            draft_id=draft_id,
            blueprint_id=blueprint.blueprint_id,
            document_id=doc_tree.document_id,
            scenes=draft_scenes,
            total_word_count=total_words,
            estimated_total_duration_sec=round(total_duration, 2),
            created_at=created_at
        )
