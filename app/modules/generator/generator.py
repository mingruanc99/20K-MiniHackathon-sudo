# app/modules/generator/generator.py
"""
Module 3 Coordinator: Script, Prosody & Visual Intent Generator
Transforms LessonBlueprint + CanonicalDocumentTree into DraftCLSG_IR.
Orchestrates 3A (Narration), 3B (Prosody & Pause Planning), and 3C (Visual Intent).

──────────────────────────────────────────────────────────────────
TRANSITION INTELLIGENCE LAYER INTEGRATION (TIL)
──────────────────────────────────────────────────────────────────
Before any narration is generated, the TIL analyzes every adjacent
section pair and produces a LectureTransitionMap. For each section:

  - Section A's narration ends with:   bridge.closing_sentence_a
  - Section B's narration begins with: bridge.opening_sentence_b

This eliminates slide-centric transitions ("Let's move on to...")
and replaces them with idea-centric bridges grounded in the
semantic relationship between adjacent concepts.
──────────────────────────────────────────────────────────────────
"""
import uuid
import datetime
from typing import Dict, Any, Optional
from app.models.blueprint import LessonBlueprint
from app.models.document import CanonicalDocumentTree, DocumentSection
from app.models.config import PipelineConfig
from app.models.expression import DraftScene, DraftCLSG_IR, SceneProvenanceTrace
from app.models.transition_ir import LectureTransitionMap, TransitionIR
from app.core.provider import BaseLLMProvider, get_llm_provider
from app.modules.generator.narration import NarrationGenerator
from app.modules.generator.prosody import ProsodyPausePlanner
from app.modules.generator.visual import VisualIntentGenerator
from app.modules.transition.transition_layer import TransitionIntelligenceLayer


class ExpressionGenerator:
    def __init__(self, provider: BaseLLMProvider = None):
        self.provider = provider or get_llm_provider()
        self.narration_gen = NarrationGenerator(self.provider)
        self.prosody_planner = ProsodyPausePlanner()
        self.visual_gen = VisualIntentGenerator()
        # ── NEW: Transition Intelligence Layer ──────────────────────────────
        self.til = TransitionIntelligenceLayer(self.provider, use_llm=True)

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

        # ── STAGE 0: Transition Intelligence Analysis (BEFORE narration) ────
        # Analyzes every adjacent pair (A, B) to infer WHY B follows A,
        # generates idea-centric bridge text, and scores transition quality.
        transition_map: LectureTransitionMap = self.til.analyze(blueprint)
        transition_index: Dict[str, TransitionIR] = self.til.get_transition_index(transition_map)

        draft_scenes = []
        total_words = 0
        total_duration = 0.0
        previous_closing: Optional[str] = None  # closing sentence from prior scene

        for i, plan in enumerate(blueprint.sections):
            doc_sec = doc_section_map.get(
                plan.section_id,
                DocumentSection(
                    section_id=plan.section_id,
                    title=plan.title,
                    order=plan.order,
                    raw_text=plan.title
                )
            )

            # ── Retrieve transition bridges for this section ─────────────────
            # bridge_in  = how THIS section opens (answering previous gap)
            # bridge_out = how THIS section closes (planting next gap)
            bridge_in: Optional[TransitionIR] = transition_index.get(plan.section_id)
            bridge_out: Optional[TransitionIR] = None
            if i < len(blueprint.sections) - 1:
                next_section_id = blueprint.sections[i + 1].section_id
                bridge_out = transition_index.get(next_section_id)

            # ── Step 3A: Narration Generation (with bridge context) ──────────
            narration_text = self.narration_gen.generate_narration(
                plan, doc_sec, config,
                opening_bridge=bridge_in.opening_sentence_b if bridge_in else None,
                closing_bridge=bridge_out.closing_sentence_a if bridge_out else None,
            )
            word_count = len(narration_text.split())
            total_words += word_count

            # ── Step 3B: Prosody & Pause Planning ───────────────────────────
            prosody_plan = self.prosody_planner.plan_prosody(narration_text, plan, config)
            total_duration += prosody_plan.effective_scene_duration_sec

            # ── Step 3C: Visual Intent Generation (13 Taxonomies) ───────────
            visual_cues = self.visual_gen.generate_visual_cues(plan, prosody_plan, config)

            # ── Step 3D: Provenance Traceability ────────────────────────────
            provenance_trace = SceneProvenanceTrace(
                scene_id=f"scene_{plan.order:02d}",
                lesson_unit_id=plan.section_id,
                chunk_ids=plan.assigned_chunk_ids,
                source_slide=plan.order,
                source_document=doc_tree.document_id,
                associated_visual_ids=[plan.primary_visual_id] if plan.primary_visual_id else []
            )

            scene = DraftScene(
                scene_id=f"scene_{plan.order:02d}",
                section_id=plan.section_id,
                title=plan.title,
                order=plan.order,
                pedagogical_function=plan.pedagogical_function,
                narration_text=narration_text,
                word_count=word_count,
                prosody_plan=prosody_plan,
                visual_cues=visual_cues,
                provenance_trace=provenance_trace
            )
            draft_scenes.append(scene)

        draft_id = f"draft_{uuid.uuid4().hex[:8]}"
        created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

        draft = DraftCLSG_IR(
            draft_id=draft_id,
            blueprint_id=blueprint.blueprint_id,
            document_id=doc_tree.document_id,
            scenes=draft_scenes,
            total_word_count=total_words,
            estimated_total_duration_sec=round(total_duration, 2),
            created_at=created_at
        )

        # Attach transition map for downstream inspection / QA
        draft.__dict__["transition_map"] = transition_map
        return draft
