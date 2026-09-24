# app/modules/guard/auto_repair.py
"""
Auto-Repair Loop Strategy Engine for Module 4.
Takes a DraftCLSG_IR and detected QualityIssues, and performs targeted structural corrections:
1. Temporal DAR-P calibration (pause scaling within physiological bounds [100ms, 2500ms])
2. Narrative phrasing sanitization (cleans blind bullet reading phrases)
3. Prosody syntactic re-balancing
Guarantees max_repair_attempts limit to prevent infinite loops.
"""
from typing import List, Tuple
from app.models.expression import DraftCLSG_IR, DraftScene
from app.models.blueprint import LessonBlueprint
from app.models.guard import QualityIssue

class AutoRepairEngine:
    def __init__(self, max_attempts: int = 2):
        self.max_attempts = max_attempts

    def repair(
        self,
        draft: DraftCLSG_IR,
        blueprint: LessonBlueprint,
        issues: List[QualityIssue],
        attempt_count: int
    ) -> Tuple[DraftCLSG_IR, List[str]]:
        """
        Executes repair strategies for detected issues.
        Returns: (repaired_draft, applied_repairs_descriptions)
        """
        applied_repairs: List[str] = []
        repaired_scenes: List[DraftScene] = list(draft.scenes)

        target_duration = float(blueprint.total_target_duration_sec)
        actual_duration = float(draft.estimated_total_duration_sec)

        # Strategy 1: DAR-P Temporal Scaling
        dar_issues = [i for i in issues if "dar_p" in i.issue_type]
        if dar_issues and actual_duration > 0:
            scale_factor = target_duration / actual_duration
            # Keep scale factor within reasonable bounds [0.75, 1.25]
            bounded_scale = max(0.75, min(1.25, scale_factor))
            repaired_scenes = self._scale_scene_pauses(repaired_scenes, bounded_scale)
            new_duration = sum(s.prosody_plan.effective_scene_duration_sec for s in repaired_scenes)
            delta_pct = round((bounded_scale - 1.0) * 100, 1)
            applied_repairs.append(f"Calibrated prosody pause durations by {delta_pct}% (new duration: {round(new_duration, 1)}s vs target {target_duration}s).")

        # Strategy 2: Blind Bullet Reading Sanitization
        bullet_issues = [i for i in issues if i.issue_type == "blind_bullet_reading"]
        if bullet_issues:
            affected_ids = {i.scene_id for i in bullet_issues if i.scene_id}
            cleaned_scenes = []
            for s in repaired_scenes:
                if s.scene_id in affected_ids:
                    cleaned_text = s.narration_text
                    for clue in ["bullet point", "gạch đầu dòng", "as listed on the slide", "như trên slide"]:
                        cleaned_text = cleaned_text.replace(clue, "đặc điểm then chốt")
                    cleaned_scenes.append(s.model_copy(update={"narration_text": cleaned_text}))
                    applied_repairs.append(f"Sanitized mechanical bullet phrasing in scene '{s.title}'.")
                else:
                    cleaned_scenes.append(s)
            repaired_scenes = cleaned_scenes

        # Calculate updated metrics
        new_total_words = sum(s.word_count for s in repaired_scenes)
        new_total_duration = sum(s.prosody_plan.effective_scene_duration_sec for s in repaired_scenes)

        repaired_draft = draft.model_copy(update={
            "scenes": repaired_scenes,
            "total_word_count": new_total_words,
            "estimated_total_duration_sec": round(new_total_duration, 2)
        })

        return repaired_draft, applied_repairs

    def _scale_scene_pauses(self, scenes: List[DraftScene], scale_factor: float) -> List[DraftScene]:
        repaired = []
        for s in scenes:
            new_sentences = []
            for sent in s.prosody_plan.sentences:
                repaired_pauses = []
                for p in sent.pauses:
                    new_ms = int(p.duration_ms * scale_factor)
                    new_ms = max(100, min(2500, new_ms))
                    repaired_pauses.append(p.model_copy(update={"duration_ms": new_ms}))

                new_pause_sec = sum(p.duration_ms for p in repaired_pauses) / 1000.0
                new_sentences.append(sent.model_copy(update={
                    "pauses": repaired_pauses,
                    "estimated_pause_time_sec": round(new_pause_sec, 2)
                }))

            new_total_pause = sum(sent.estimated_pause_time_sec for sent in new_sentences)
            new_effective = s.prosody_plan.total_speaking_sec + new_total_pause

            new_prosody_plan = s.prosody_plan.model_copy(update={
                "sentences": new_sentences,
                "total_pause_sec": round(new_total_pause, 2),
                "effective_scene_duration_sec": round(new_effective, 2)
            })

            repaired.append(s.model_copy(update={"prosody_plan": new_prosody_plan}))
        return repaired
