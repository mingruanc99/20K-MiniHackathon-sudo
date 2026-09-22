# app/core/orchestrator.py
"""
Pipeline Orchestrator for CLSG-IR.
Coordinates:
Extractor -> Planner -> ExpressionGenerator -> QualityVisualGuard -> Export Engine.
Maintains an execution trace log for transparency and debugging.
"""
import time
import json
from typing import Dict, Any, List, Optional
from app.models.document import CanonicalDocumentTree
from app.models.config import PipelineConfig
from app.models.blueprint import LessonBlueprint
from app.models.expression import DraftCLSG_IR
from app.models.guard import QualityReport
from app.models.clsg_ir import VerifiedCLSG_IR, ExportPackage
from app.modules.extractor.factory import extract_document
from app.modules.planner.planner import InstructionalPlanner
from app.modules.generator.generator import ExpressionGenerator
from app.modules.guard.guard import QualityVisualGuard

class PipelineOrchestrator:
    def __init__(self):
        self.planner = InstructionalPlanner()
        self.generator = ExpressionGenerator()
        self.guard = QualityVisualGuard()
        self.trace_logs: List[Dict[str, Any]] = []

    def run_full_pipeline(
        self,
        source_bytes_or_path: Any,
        filename: str,
        config: Optional[PipelineConfig] = None
    ) -> Dict[str, Any]:
        self.trace_logs = []
        pipeline_start = time.perf_counter()
        cfg = config or PipelineConfig()

        # Phase 1: Content Extraction
        t0 = time.perf_counter()
        doc_tree = extract_document(source_bytes_or_path, filename)
        t1 = time.perf_counter()
        self._log_stage("Module 1: Content Extractor", t1 - t0, {
            "sections_extracted": doc_tree.total_sections,
            "extraction_mode": "Deterministic Zero-LLM/VLM",
            "latency_ms": doc_tree.extraction_time_ms
        })

        # Phase 2: Instructional Planning
        t0 = time.perf_counter()
        blueprint = self.planner.plan(doc_tree, cfg)
        t1 = time.perf_counter()
        self._log_stage("Module 2: Instructional Planner", t1 - t0, {
            "blueprint_id": blueprint.blueprint_id,
            "total_target_duration_sec": blueprint.total_target_duration_sec,
            "total_word_budget": blueprint.total_word_budget,
            "sections_planned": len(blueprint.sections)
        })

        # Phase 3: Expression Generation (3A Narration, 3B Prosody, 3C Visual)
        t0 = time.perf_counter()
        draft = self.generator.generate_draft(blueprint, doc_tree, cfg)
        t1 = time.perf_counter()
        self._log_stage("Module 3: Expression Generator (Narration + Prosody + Visual)", t1 - t0, {
            "draft_id": draft.draft_id,
            "generated_words": draft.total_word_count,
            "estimated_duration_sec": draft.estimated_total_duration_sec,
            "scenes": len(draft.scenes)
        })

        # Phase 4: Quality & Visual Guard
        t0 = time.perf_counter()
        quality_report, verified_ir = self.guard.validate_and_certify(draft, blueprint, doc_tree, cfg)
        t1 = time.perf_counter()
        self._log_stage("Module 4: Quality & Visual Guard", t1 - t0, {
            "status": quality_report.overall_status,
            "quality_score": quality_report.overall_quality_score,
            "dar_p_pct": quality_report.duration_error_pct,
            "auto_repairs": quality_report.auto_repairs_applied
        })

        total_elapsed = time.perf_counter() - pipeline_start
        self._log_stage("Pipeline Complete", total_elapsed, {
            "ir_id": verified_ir.ir_id,
            "verified_scenes": verified_ir.total_scenes,
            "total_runtime_sec": round(total_elapsed, 3)
        })

        export_pkg = self.build_export_package(verified_ir)

        return {
            "document_tree": doc_tree.model_dump(),
            "blueprint": blueprint.model_dump(),
            "draft": draft.model_dump(),
            "quality_report": quality_report.model_dump(),
            "verified_ir": verified_ir.model_dump(),
            "export_package": export_pkg.model_dump(),
            "trace_logs": self.trace_logs
        }

    def _log_stage(self, stage_name: str, duration_sec: float, details: Dict[str, Any]):
        self.trace_logs.append({
            "stage": stage_name,
            "duration_sec": round(duration_sec, 4),
            "timestamp": time.strftime("%H:%M:%S"),
            "details": details
        })

    def build_export_package(self, ir: VerifiedCLSG_IR) -> ExportPackage:
        # 1. CLSG JSON
        clsg_json = ir.model_dump()

        # 2. Remotion Video Composition Props
        remotion_props = {
            "compositionWidth": 1920,
            "compositionHeight": 1080,
            "fps": 30,
            "durationInFrames": int(ir.total_duration_sec * 30),
            "lectureTitle": ir.lecture_title,
            "scenes": []
        }
        for s in ir.scenes:
            remotion_props["scenes"].append({
                "sceneId": s.scene_id,
                "title": s.title,
                "startFrame": int(s.scene_start_time_sec * 30),
                "durationInFrames": int(s.scene_duration_sec * 30),
                "script": s.narration_text,
                "visualCues": [
                    {
                        "triggerFrame": int(c.trigger_timestamp_sec * 30),
                        "type": c.taxonomy_type,
                        "action": c.action,
                        "target": c.element_target,
                        "description": c.visual_description,
                        "hints": c.renderer_hints
                    }
                    for c in s.visual_cues
                ]
            })

        # 3. Manim Python Script Skeleton
        manim_lines = [
            "# Auto-generated Manim Scene from CLSG-IR",
            "from manim import *",
            "",
            "class GeneratedLectureScene(Scene):",
            "    def construct(self):",
            f'        # Lecture: {ir.lecture_title}',
            f'        title = Text("{ir.lecture_title}", font_size=40).to_edge(UP)',
            '        self.play(Write(title))',
            '        self.wait(1)',
            ''
        ]
        for s in ir.scenes:
            manim_lines.append(f'        # Scene: {s.title} ({s.pedagogical_function})')
            manim_lines.append(f'        sec_text = Text("{s.title}", font_size=32, color=YELLOW).next_to(title, DOWN)')
            manim_lines.append('        self.play(FadeIn(sec_text))')
            for c in s.visual_cues:
                manim_lines.append(f'        # Visual Cue: {c.taxonomy_type} -> {c.element_target}')
                manim_lines.append(f'        # {c.visual_description}')
                manim_lines.append(f'        self.wait({max(1.0, round(s.scene_duration_sec / max(1, len(s.visual_cues)), 1))})')
            manim_lines.append('        self.play(FadeOut(sec_text))')
            manim_lines.append('')
        manim_lines.append('        self.wait(2)')
        manim_code = "\n".join(manim_lines)

        # 4. SSML Audio Bundle
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
