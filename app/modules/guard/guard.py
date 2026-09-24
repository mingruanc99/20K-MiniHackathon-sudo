# app/modules/guard/guard.py
"""
Module 4: Quality, Evaluation & Safety (CLSG-IR)
Architecture:
QUALITY -> EVALUATION -> HUMAN REVIEW -> USER FEEDBACK -> SYSTEM MONITORING -> IMPROVEMENT

Five core subsystems:
A. Automated Quality Assurance & Decision Engine (5 Quality Dimensions)
B. Human-in-the-loop Review Coordinator
C. User Feedback & Product Improvement Bridge
D. System / Latency / Cost Evaluation & Budget Guard
E. Privacy / Tenant Isolation / Prompt Injection Guard & Golden Dataset Evaluation
"""
import uuid
import datetime
import time
from typing import List, Tuple, Dict, Any, Optional
from app.models.blueprint import LessonBlueprint
from app.models.document import CanonicalDocumentTree
from app.models.config import PipelineConfig
from app.models.expression import DraftCLSG_IR, DraftScene
from app.models.guard import QualityReport, ValidationCheck, QualityStatus, QualityDecisionState, DimensionScores, QualityIssue
from app.models.clsg_ir import VerifiedCLSG_IR, VerifiedScene
from app.models.evaluation import UserTierType
from app.modules.guard.automated_qa import AutomatedQAEngine
from app.modules.guard.decision_engine import QualityDecisionEngine
from app.modules.guard.auto_repair import AutoRepairEngine
from app.modules.guard.cost_guard import CostAndBudgetGuard
from app.modules.guard.security_guard import PrivacyAndSecurityGuard

class QualityVisualGuard:
    """
    Subsystem Orchestrator for Module 4: Quality, Evaluation & Safety.
    Guarantees 100% backward compatibility for validate_and_certify while integrating
    multi-dimensional evaluation, decision states, auto-repair loops, and cost tracking.
    """
    def __init__(self, max_repair_attempts: int = 2):
        self.qa_engine = AutomatedQAEngine()
        self.decision_engine = QualityDecisionEngine(max_repair_attempts=max_repair_attempts)
        self.repair_engine = AutoRepairEngine(max_attempts=max_repair_attempts)
        self.cost_guard = CostAndBudgetGuard()
        self.security_guard = PrivacyAndSecurityGuard()
        self.max_repair_attempts = max_repair_attempts

    def validate_and_certify(
        self,
        draft: DraftCLSG_IR,
        blueprint: LessonBlueprint,
        doc_tree: CanonicalDocumentTree,
        config: PipelineConfig,
        user_tier: UserTierType = "NORMAL",
        user_id: str = "default_user"
    ) -> Tuple[QualityReport, VerifiedCLSG_IR]:
        start_time = time.perf_counter()
        auto_repairs_applied: List[str] = []
        working_draft = draft
        repair_attempts = 0

        target_duration = float(blueprint.total_target_duration_sec)

        # -------------------------------------------------------------
        # Phase 1: Initial Multi-Dimensional QA Evaluation
        # -------------------------------------------------------------
        scores, issues, checks = self.qa_engine.evaluate(
            working_draft, blueprint, doc_tree, config
        )
        decision, reason, human_review = self.decision_engine.decide(
            scores, issues, repair_attempts
        )

        # -------------------------------------------------------------
        # Phase 2: Auto-Repair Loop (bounded by max_repair_attempts)
        # -------------------------------------------------------------
        while decision == "AUTO_REPAIR" and repair_attempts < self.max_repair_attempts:
            working_draft, repairs = self.repair_engine.repair(
                working_draft, blueprint, issues, repair_attempts
            )
            auto_repairs_applied.extend(repairs)
            repair_attempts += 1

            # Re-evaluate post-repair
            scores, issues, checks = self.qa_engine.evaluate(
                working_draft, blueprint, doc_tree, config
            )
            decision, reason, human_review = self.decision_engine.decide(
                scores, issues, repair_attempts
            )

        # Map decision to legacy overall_status
        if decision == "PASS":
            overall_status: QualityStatus = "PASSED"
        elif decision in ("NEEDS_REVIEW", "AUTO_REPAIR"):
            overall_status = "WARNING"
        else:
            overall_status = "FAILED"

        actual_duration = float(working_draft.estimated_total_duration_sec)
        duration_error_ratio = abs(actual_duration - target_duration) / max(1.0, target_duration)
        duration_error_pct = round(duration_error_ratio * 100.0, 2)

        # -------------------------------------------------------------
        # Phase 3: Construct Comprehensive QualityReport
        # -------------------------------------------------------------
        report_id = f"qr_{uuid.uuid4().hex[:8]}"
        report = QualityReport(
            report_id=report_id,
            decision=decision,
            decision_reason=reason,
            scores=scores,
            issues=issues,
            repair_attempts=repair_attempts,
            max_repair_attempts=self.max_repair_attempts,
            human_review_required=human_review,
            human_review_reason=reason if human_review else None,
            overall_status=overall_status,
            overall_quality_score=scores.overall,
            dar_p_ratio=round(duration_error_ratio, 4),
            target_duration_sec=target_duration,
            actual_duration_sec=round(actual_duration, 2),
            duration_error_pct=duration_error_pct,
            factual_consistency_score=scores.content,
            visual_necessity_score=scores.visual,
            taxonomy_validity_score=scores.visual,
            prosody_coherence_score=scores.technical,
            content_fidelity_score=scores.content,
            text_visual_consistency_score=scores.visual,
            provenance_traceability_score=scores.technical,
            checks=checks,
            auto_repairs_applied=auto_repairs_applied,
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
        )

        # -------------------------------------------------------------
        # Phase 4: Assemble VerifiedCLSG_IR
        # -------------------------------------------------------------
        verified_scenes = []
        timeline_cursor = 0.0

        for s in working_draft.scenes:
            s_dur = s.prosody_plan.effective_scene_duration_sec
            v_scene = VerifiedScene(
                scene_id=s.scene_id,
                section_id=s.section_id,
                title=s.title,
                order=s.order,
                pedagogical_function=s.pedagogical_function,
                narration_text=s.narration_text,
                word_count=s.word_count,
                prosody_plan=s.prosody_plan,
                visual_cues=s.visual_cues,
                scene_start_time_sec=round(timeline_cursor, 2),
                scene_end_time_sec=round(timeline_cursor + s_dur, 2),
                scene_duration_sec=round(s_dur, 2),
                provenance_trace=s.provenance_trace
            )
            verified_scenes.append(v_scene)
            timeline_cursor += s_dur

        verified_ir = VerifiedCLSG_IR(
            ir_id=f"ir_{uuid.uuid4().hex[:8]}",
            document_id=working_draft.document_id,
            blueprint_id=working_draft.blueprint_id,
            lecture_title=blueprint.lecture_title,
            config=config,
            total_scenes=len(verified_scenes),
            total_duration_sec=round(timeline_cursor, 2),
            total_words=sum(s.word_count for s in verified_scenes),
            scenes=verified_scenes,
            quality_report=report,
            verified_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
        )

        # Record system telemetry & latency
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        self.cost_guard.record_generation_metrics(
            generation_id=verified_ir.ir_id,
            user_id=user_id,
            user_tier=user_tier,
            latency_ms=latency_ms,
            input_tokens=int(working_draft.total_word_count * 1.3),
            output_tokens=int(verified_ir.total_words * 1.3)
        )

        return report, verified_ir
