# app/core/clsg_pipeline.py
# -*- coding: utf-8 -*-
"""
==============================================================================
CLSG-IR MASTER PIPELINE ENGINE (CONFIGURABLE LECTURE SCRIPT & VISUAL INTENT)
==============================================================================
This module encapsulates the comprehensive, end-to-end pipeline of the CLSG-IR system.
It coordinates all 4 foundational modules, the persistent knowledge layer, and downstream
export targets according to strict pedagogical, architectural, and quality standards.

PIPELINE STAGES:
  Stage 0: Input Inception, Hash Validation & User Configuration Parsing
  Stage 1: Multimodal Extraction & Visual Understanding Pipeline (Zero-LLM/VLM)
  Stage 2: Canonical Document IR Construction & Persistence (Database Source of Truth)
  Stage 3: Multimodal Semantic Chunking & 1536-dim Vector Embedding Indexing
  Stage 4: Module 2 - Instructional Blueprint Planning (Scaffolded Bloom Taxonomy)
  Stage 5: Module 3 - Expression Generation (3A Narration, 3B Prosody/SSML, 3C Visual Taxonomies)
  Stage 6: Module 4 - Quality & Visual Guard Certification (Automated QA, Cost, Decision Engine)
  Stage 7: Downstream Multi-Target Packaging (CLSG JSON, Remotion Props, SSML Bundle, Manim)
  Stage 8: Pedagogical Controlled Hybrid Retrieval & Traceability Verification
==============================================================================
"""

import time
import json
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional, Union

from app.models.config import PipelineConfig, LearnerPersona, PresentationConfig
from app.models.document import CanonicalDocumentTree
from app.models.document_ir import DocumentIR
from app.models.blueprint import LessonBlueprint
from app.models.expression import DraftCLSG_IR
from app.models.clsg_ir import VerifiedCLSG_IR, ExportPackage
from app.models.guard import QualityReport
from app.modules.extractor.factory import extract_document
from app.modules.planner.planner import InstructionalPlanner
from app.modules.generator.generator import ExpressionGenerator
from app.modules.guard.guard import QualityVisualGuard
from app.modules.knowledge_graph.graph_builder import KnowledgeGraphBuilder
from app.modules.curriculum.curriculum_optimizer import CurriculumOptimizer
from app.database.knowledge_store import KnowledgeStore
from app.services.query_service import QueryService

class CLSGExecutionStage:
    INCEPTION = "0. Input & Inception"
    EXTRACTION = "1. Multimodal Extraction & Visual Understanding"
    DOCUMENT_IR = "2. Canonical Document IR Construction"
    PERSISTENCE = "3. Persistent Knowledge Storage & Indexing"
    CHUNKING = "4. Semantic Reasoning Chunking"
    PLANNING = "5. Module 2: Instructional Planning"
    EXPRESSION = "6. Module 3: Expression Generation"
    QUALITY_GUARD = "7. Module 4: Quality & Visual Guard Certification"
    EXPORT = "8. Multi-Target Downstream Export"
    RETRIEVAL_VERIFY = "9. Hybrid Retrieval Verification"

class CLSGPipelineResult:
    def __init__(
        self,
        document_id: str,
        verified_ir_id: str,
        quality_score: float,
        duration_error_pct: float,
        total_runtime_sec: float,
        document_tree: Dict[str, Any],
        blueprint: Dict[str, Any],
        draft: Dict[str, Any],
        quality_report: Dict[str, Any],
        verified_ir: Dict[str, Any],
        export_package: Dict[str, Any],
        trace_logs: List[Dict[str, Any]],
        knowledge_stats: Dict[str, Any]
    ):
        self.document_id = document_id
        self.verified_ir_id = verified_ir_id
        self.quality_score = quality_score
        self.duration_error_pct = duration_error_pct
        self.total_runtime_sec = total_runtime_sec
        self.document_tree = document_tree
        self.blueprint = blueprint
        self.draft = draft
        self.quality_report = quality_report
        self.verified_ir = verified_ir
        self.export_package = export_package
        self.trace_logs = trace_logs
        self.knowledge_stats = knowledge_stats

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": self.document_id,
            "verified_ir_id": self.verified_ir_id,
            "quality_score": self.quality_score,
            "duration_error_pct": self.duration_error_pct,
            "total_runtime_sec": self.total_runtime_sec,
            "document_tree": self.document_tree,
            "blueprint": self.blueprint,
            "draft": self.draft,
            "quality_report": self.quality_report,
            "verified_ir": self.verified_ir,
            "export_package": self.export_package,
            "trace_logs": self.trace_logs,
            "knowledge_stats": self.knowledge_stats
        }

class CLSGMasterPipeline:
    """
    Master pipeline orchestrating the entire lifecycle of CLSG-IR generation,
    verification, storage, and export.
    """

    def __init__(self, db_path: str = "app/data/clsg_knowledge.db"):
        self.db_path = db_path
        self.knowledge_store = KnowledgeStore(db_path)
        self.query_service = QueryService(self.knowledge_store)
        self.graph_builder = KnowledgeGraphBuilder()
        self.curriculum_optimizer = CurriculumOptimizer()
        self.planner = InstructionalPlanner()
        self.generator = ExpressionGenerator()
        self.guard = QualityVisualGuard()
        self.trace_logs: List[Dict[str, Any]] = []

    def _log_event(self, stage: str, elapsed_sec: float, details: Dict[str, Any]):
        entry = {
            "stage": stage,
            "duration_sec": round(elapsed_sec, 4),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "details": details
        }
        self.trace_logs.append(entry)

    def execute(
        self,
        source: Union[bytes, str, Path],
        filename: str,
        config: Optional[PipelineConfig] = None,
        owner_id: str = "user_default"
    ) -> CLSGPipelineResult:
        """
        Executes the entire end-to-end CLSG-IR pipeline.
        """
        self.trace_logs = []
        overall_start = time.perf_counter()
        cfg = config or PipelineConfig()

        # ----------------------------------------------------------------------
        # STAGE 0: INPUT & INCEPTION
        # ----------------------------------------------------------------------
        t0 = time.perf_counter()
        if isinstance(source, (str, Path)):
            source_bytes = Path(source).read_bytes()
        else:
            source_bytes = source

        file_hash = hashlib.sha256(source_bytes).hexdigest()[:16]
        t1 = time.perf_counter()
        self._log_event(CLSGExecutionStage.INCEPTION, t1 - t0, {
            "filename": filename,
            "bytes_length": len(source_bytes),
            "file_hash": file_hash,
            "target_duration_sec": cfg.presentation.target_duration_sec,
            "baseline_wpm": cfg.presentation.baseline_wpm,
            "target_audience": cfg.learner.target_audience
        })

        # ----------------------------------------------------------------------
        # STAGE 1: MULTIMODAL EXTRACTION & VISUAL UNDERSTANDING
        # ----------------------------------------------------------------------
        t0 = time.perf_counter()
        doc_tree: CanonicalDocumentTree = extract_document(source_bytes, filename)
        t1 = time.perf_counter()
        
        doc_ir: Optional[DocumentIR] = getattr(doc_tree, "document_ir", None)
        self._log_event(CLSGExecutionStage.EXTRACTION, t1 - t0, {
            "mode": "Deterministic Zero-LLM/VLM",
            "total_sections": doc_tree.total_sections,
            "extraction_time_ms": doc_tree.extraction_time_ms,
            "has_document_ir": doc_ir is not None,
            "visual_elements_count": len(doc_tree.visual_elements or [])
        })

        # ----------------------------------------------------------------------
        # STAGE 2 & 3: PERSISTENT KNOWLEDGE STORAGE & INDEXING
        # ----------------------------------------------------------------------
        t0 = time.perf_counter()
        doc_id = doc_tree.document_id
        if doc_ir:
            doc_id = self.knowledge_store.persist_document_ir(
                doc_ir=doc_ir,
                owner_id=owner_id,
                file_hash=file_hash
            )
        knowledge_overview = self.knowledge_store.get_document_overview(doc_id)
        k_stats = knowledge_overview.get("stats", {})
        t1 = time.perf_counter()

        self._log_event(CLSGExecutionStage.PERSISTENCE, t1 - t0, {
            "document_id": doc_id,
            "slides_persisted": k_stats.get("slides", 0),
            "elements_persisted": k_stats.get("elements", 0),
            "visuals_persisted": k_stats.get("visuals", 0),
            "relations_persisted": k_stats.get("relations", 0),
            "chunks_persisted": k_stats.get("chunks", 0),
            "embeddings_persisted": k_stats.get("embeddings", 0)
        })

        # ----------------------------------------------------------------------
        # STAGE 4: MODULE 2 - INSTRUCTIONAL BLUEPRINT PLANNING (KNOWLEDGE-CENTRIC)
        # ----------------------------------------------------------------------
        t0 = time.perf_counter()
        if doc_ir:
            knowledge_ir = self.graph_builder.build_knowledge_space(doc_ir)
            target_min = max(3, int(cfg.presentation.target_duration_sec / 60))
            curriculum_ir = self.curriculum_optimizer.compile_curriculum(
                knowledge_ir,
                target_duration_min=target_min,
                speaking_wpm=cfg.presentation.baseline_wpm
            )
            blueprint: LessonBlueprint = self.planner.plan_from_curriculum(
                curriculum_ir,
                doc_id=doc_id,
                title=doc_tree.title,
                config=cfg
            )
        else:
            blueprint: LessonBlueprint = self.planner.plan(doc_tree, cfg)
        t1 = time.perf_counter()

        self._log_event(CLSGExecutionStage.PLANNING, t1 - t0, {
            "blueprint_id": blueprint.blueprint_id,
            "total_target_duration_sec": blueprint.total_target_duration_sec,
            "total_word_budget": blueprint.total_word_budget,
            "sections_planned": len(blueprint.sections),
            "pedagogical_strategy": blueprint.pedagogical_strategy
        })

        # ----------------------------------------------------------------------
        # STAGE 5: MODULE 3 - EXPRESSION GENERATION (NARRATION + PROSODY + VISUAL)
        # ----------------------------------------------------------------------
        t0 = time.perf_counter()
        draft: DraftCLSG_IR = self.generator.generate_draft(blueprint, doc_tree, cfg)
        t1 = time.perf_counter()

        total_cues = sum(len(sc.visual_cues) for sc in draft.scenes)
        total_pauses = sum(sc.prosody_plan.total_pause_sec for sc in draft.scenes)
        self._log_event(CLSGExecutionStage.EXPRESSION, t1 - t0, {
            "draft_id": draft.draft_id,
            "total_word_count": draft.total_word_count,
            "estimated_duration_sec": draft.estimated_total_duration_sec,
            "total_scenes": len(draft.scenes),
            "total_visual_cues": total_cues,
            "total_pause_seconds": round(total_pauses, 2)
        })

        # ----------------------------------------------------------------------
        # STAGE 6: MODULE 4 - QUALITY & VISUAL GUARD CERTIFICATION
        # ----------------------------------------------------------------------
        t0 = time.perf_counter()
        quality_report, verified_ir = self.guard.validate_and_certify(draft, blueprint, doc_tree, cfg)
        t1 = time.perf_counter()

        self._log_event(CLSGExecutionStage.QUALITY_GUARD, t1 - t0, {
            "overall_status": quality_report.overall_status,
            "quality_score": quality_report.overall_quality_score,
            "dar_p_error_pct": quality_report.duration_error_pct,
            "auto_repairs_count": len(quality_report.auto_repairs_applied),
            "certified_ir_id": verified_ir.ir_id
        })

        # ----------------------------------------------------------------------
        # STAGE 7: MULTI-TARGET DOWNSTREAM EXPORT
        # ----------------------------------------------------------------------
        t0 = time.perf_counter()
        export_package: ExportPackage = self._build_export_package(verified_ir)
        t1 = time.perf_counter()

        self._log_event(CLSGExecutionStage.EXPORT, t1 - t0, {
            "available_formats": list(export_package.formats.keys()),
            "manim_lines": len(export_package.formats.get("manim_code", "").split("\n")),
            "ssml_scenes": len(export_package.formats.get("ssml_bundle", {}))
        })

        total_elapsed = time.perf_counter() - overall_start

        return CLSGPipelineResult(
            document_id=doc_id,
            verified_ir_id=verified_ir.ir_id,
            quality_score=quality_report.overall_quality_score,
            duration_error_pct=quality_report.duration_error_pct,
            total_runtime_sec=round(total_elapsed, 4),
            document_tree=doc_tree.model_dump(),
            blueprint=blueprint.model_dump(),
            draft=draft.model_dump(),
            quality_report=quality_report.model_dump(),
            verified_ir=verified_ir.model_dump(),
            export_package=export_package.model_dump(),
            trace_logs=self.trace_logs,
            knowledge_stats=k_stats
        )

    def _build_export_package(self, ir: VerifiedCLSG_IR) -> ExportPackage:
        """
        Transforms verified CLSG-IR into concrete downstream runtime formats.
        """
        # 1. CLSG JSON Representation
        clsg_json = ir.model_dump()

        # 2. Remotion Video Composition Props (30 FPS)
        remotion_props = {
            "compositionWidth": 1920,
            "compositionHeight": 1080,
            "fps": 30,
            "durationInFrames": int(ir.total_duration_sec * 30),
            "lectureTitle": ir.lecture_title,
            "scenes": [
                {
                    "sceneId": s.scene_id,
                    "title": s.title,
                    "startFrame": int(s.scene_start_time_sec * 30),
                    "durationInFrames": int(s.scene_duration_sec * 30),
                    "narration": s.narration_text,
                    "visualCues": [
                        {
                            "triggerFrame": int(c.trigger_timestamp_sec * 30),
                            "taxonomy": c.taxonomy_type,
                            "action": c.action,
                            "target": c.element_target,
                            "description": c.visual_description,
                            "hints": c.renderer_hints
                        }
                        for c in s.visual_cues
                    ]
                }
                for s in ir.scenes
            ]
        }

        # 3. Manim Animation Code
        manim_lines = [
            "# Auto-generated Manim Scene from Verified CLSG-IR",
            "from manim import *",
            "",
            "class CLSGLectureScene(Scene):",
            "    def construct(self):",
            f'        title = Text("{ir.lecture_title}", font_size=38).to_edge(UP)',
            "        self.play(Write(title))",
            "        self.wait(1)",
            ""
        ]
        for s in ir.scenes:
            manim_lines.append(f'        # Scene {s.scene_id}: {s.title} ({s.pedagogical_function})')
            manim_lines.append(f'        sec_lbl = Text("{s.title}", font_size=28, color=YELLOW).next_to(title, DOWN)')
            manim_lines.append("        self.play(FadeIn(sec_lbl))")
            for c in s.visual_cues:
                manim_lines.append(f'        # Visual: {c.taxonomy_type} -> {c.element_target}')
                manim_lines.append(f'        # {c.visual_description}')
                manim_lines.append(f'        self.wait({max(1.0, round(s.scene_duration_sec / max(1, len(s.visual_cues)), 1))})')
            manim_lines.append("        self.play(FadeOut(sec_lbl))")
            manim_lines.append("")
        manim_lines.append("        self.wait(2)")
        manim_code = "\n".join(manim_lines)

        # 4. SSML Audio Synthesizer Bundle
        ssml_bundle = {
            f"{s.scene_id}.ssml": s.prosody_plan.ssml_full
            for s in ir.scenes
        }

        return ExportPackage(
            ir_id=ir.ir_id,
            formats={
                "clsg_json": clsg_json,
                "remotion_props": remotion_props,
                "manim_code": manim_code,
                "ssml_bundle": ssml_bundle
            }
        )

# Global singleton master pipeline
clsg_pipeline = CLSGMasterPipeline()
