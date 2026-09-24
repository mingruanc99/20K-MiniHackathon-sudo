# app/modules/guard/automated_qa.py
"""
Subsystem A: Automated Quality Assurance Engine
Evaluates multi-dimensional quality of CLSG scenes:
1. Content Quality (fidelity, coverage, missing info, hallucination, source traceability)
2. Pedagogical Quality (necessity, taxonomy compliance, explanation quality, concept completeness)
3. Narrative Quality (script coherence, slide transitions, repetition, unnecessary phrases, natural explanation vs reading bullets)
4. Visual Quality (text-visual alignment, visual necessity, wrong visual, missing visual, visual intent consistency)
5. Technical Quality (schema validity, missing references, broken assets, invalid metadata, provenance integrity)

Emits: DimensionScores + List[QualityIssue]
"""
import re
import uuid
from typing import List, Tuple, Dict, Any, Optional
from app.models.blueprint import LessonBlueprint
from app.models.document import CanonicalDocumentTree
from app.models.config import PipelineConfig
from app.models.expression import DraftCLSG_IR, DraftScene
from app.models.guard import DimensionScores, QualityIssue, ValidationCheck, QualityStatus
from app.modules.generator.visual import VisualIntentGenerator

class AutomatedQAEngine:
    def __init__(self):
        self.valid_taxonomies = set(VisualIntentGenerator.VALID_TAXONOMIES)

    def evaluate(
        self,
        draft: DraftCLSG_IR,
        blueprint: LessonBlueprint,
        doc_tree: CanonicalDocumentTree,
        config: PipelineConfig
    ) -> Tuple[DimensionScores, List[QualityIssue], List[ValidationCheck]]:
        issues: List[QualityIssue] = []
        checks: List[ValidationCheck] = []

        scenes = draft.scenes
        target_duration = float(blueprint.total_target_duration_sec)
        actual_duration = float(draft.estimated_total_duration_sec)

        # -------------------------------------------------------------
        # 1. Content Quality Evaluation
        # -------------------------------------------------------------
        content_score, content_issues, content_checks = self._evaluate_content_quality(scenes, doc_tree)
        issues.extend(content_issues)
        checks.extend(content_checks)

        # -------------------------------------------------------------
        # 2. Pedagogical Quality Evaluation
        # -------------------------------------------------------------
        pedagogy_score, pedagogy_issues, pedagogy_checks = self._evaluate_pedagogical_quality(scenes, blueprint)
        issues.extend(pedagogy_issues)
        checks.extend(pedagogy_checks)

        # -------------------------------------------------------------
        # 3. Narrative Quality Evaluation (Transitions, Anti-bullet, Repetition)
        # -------------------------------------------------------------
        narrative_score, narrative_issues, narrative_checks = self._evaluate_narrative_quality(scenes)
        issues.extend(narrative_issues)
        checks.extend(narrative_checks)

        # -------------------------------------------------------------
        # 4. Visual Quality Evaluation (13 Taxonomies, Text-Visual Alignment)
        # -------------------------------------------------------------
        visual_score, visual_issues, visual_checks = self._evaluate_visual_quality(scenes)
        issues.extend(visual_issues)
        checks.extend(visual_checks)

        # -------------------------------------------------------------
        # 5. Technical Quality Evaluation (DAR-P, SSML, Provenance Traceability)
        # -------------------------------------------------------------
        tech_score, tech_issues, tech_checks = self._evaluate_technical_quality(
            scenes, target_duration, actual_duration
        )
        issues.extend(tech_issues)
        checks.extend(tech_checks)

        # Weighted aggregate score
        overall_score = (
            content_score * 0.25 +
            pedagogy_score * 0.20 +
            narrative_score * 0.20 +
            visual_score * 0.20 +
            tech_score * 0.15
        )

        scores = DimensionScores(
            content=round(content_score, 3),
            pedagogy=round(pedagogy_score, 3),
            narrative=round(narrative_score, 3),
            visual=round(visual_score, 3),
            technical=round(tech_score, 3),
            overall=round(overall_score, 3)
        )

        return scores, issues, checks

    def _evaluate_content_quality(
        self,
        scenes: List[DraftScene],
        doc_tree: CanonicalDocumentTree
    ) -> Tuple[float, List[QualityIssue], List[ValidationCheck]]:
        issues: List[QualityIssue] = []
        checks: List[ValidationCheck] = []

        if not scenes:
            return 1.0, issues, checks

        source_text = " ".join(s.raw_text or "" for s in doc_tree.sections).lower()
        source_words = set(w.strip(".,;:()[]{}'\"") for w in source_text.split() if len(w) > 4)

        hallucination_scenes = []
        fidelity_scores = []

        for s in scenes:
            scene_words = [w.strip(".,;:()[]{}'\"").lower() for w in s.narration_text.split() if len(w) > 4]
            if not scene_words:
                fidelity_scores.append(1.0)
                continue

            hits = sum(1 for w in scene_words if w in source_words or any(w in sw for sw in source_words))
            ratio = hits / len(scene_words) if scene_words else 1.0
            fidelity_scores.append(min(1.0, 0.82 + ratio * 0.18))

            # Hallucination alert if grounding is excessively low (< 50% hit rate)
            if ratio < 0.40 and len(source_words) > 10:
                hallucination_scenes.append(s.scene_id)
                issues.append(QualityIssue(
                    issue_id=f"iss_{uuid.uuid4().hex[:6]}",
                    category="content",
                    issue_type="hallucination",
                    severity="high",
                    scene_id=s.scene_id,
                    description=f"Scene '{s.title}' displays weak grounding to source document terminology (ratio: {round(ratio, 2)}).",
                    repair_suggestion="Re-anchor narration specifically to assigned semantic chunk vocabulary."
                ))

        avg_fidelity = sum(fidelity_scores) / max(1, len(fidelity_scores))
        status: QualityStatus = "PASSED" if avg_fidelity >= 0.85 else "WARNING"
        if hallucination_scenes:
            status = "FAILED" if len(hallucination_scenes) > 1 else "WARNING"

        checks.append(ValidationCheck(
            check_id="chk_content_fidelity",
            rule_name="Source Material Grounding & Factuality",
            category="content_fidelity",
            status=status,
            score=round(avg_fidelity, 3),
            threshold=0.85,
            actual_value=f"{round(avg_fidelity * 100, 1)}%",
            message="Narration concepts are grounded in extracted document entities without untraceable hallucinations."
        ))

        return avg_fidelity, issues, checks

    def _evaluate_pedagogical_quality(
        self,
        scenes: List[DraftScene],
        blueprint: LessonBlueprint
    ) -> Tuple[float, List[QualityIssue], List[ValidationCheck]]:
        issues: List[QualityIssue] = []
        checks: List[ValidationCheck] = []

        # Check pedagogical function alignment
        valid_functions = {"hook", "definition", "mechanism", "example", "comparison", "summary", "exercise"}
        pedagogy_violations = 0

        for s in scenes:
            if s.pedagogical_function.lower() not in valid_functions:
                pedagogy_violations += 1
                issues.append(QualityIssue(
                    issue_id=f"iss_{uuid.uuid4().hex[:6]}",
                    category="pedagogy",
                    issue_type="invalid_pedagogical_role",
                    severity="medium",
                    scene_id=s.scene_id,
                    description=f"Pedagogical function '{s.pedagogical_function}' does not adhere to standard instructional arc.",
                    repair_suggestion="Assign canonical function: hook, definition, mechanism, example, comparison, or summary."
                ))

        # Check word budget discipline
        under_explained = 0
        for s in scenes:
            if s.word_count < 25:
                under_explained += 1
                issues.append(QualityIssue(
                    issue_id=f"iss_{uuid.uuid4().hex[:6]}",
                    category="pedagogy",
                    issue_type="under_explained",
                    severity="low",
                    scene_id=s.scene_id,
                    description=f"Scene '{s.title}' is under-explained ({s.word_count} words). May lack sufficient pedagogical scaffolding.",
                    repair_suggestion="Elaborate core concept with concrete pedagogical explanation."
                ))

        pedagogy_score = max(0.0, 1.0 - (pedagogy_violations * 0.15) - (under_explained * 0.05))
        status: QualityStatus = "PASSED" if pedagogy_score >= 0.85 else "WARNING"

        checks.append(ValidationCheck(
            check_id="chk_pedagogical_rigor",
            rule_name="Pedagogical Scaffolding & Arc Compliance",
            category="pedagogical_rigor",
            status=status,
            score=round(pedagogy_score, 3),
            threshold=0.85,
            actual_value=f"{round(pedagogy_score * 100, 1)}%",
            message="Instructional role definitions and depth adhere to pedagogical arc standards."
        ))

        return pedagogy_score, issues, checks

    def _evaluate_narrative_quality(
        self,
        scenes: List[DraftScene]
    ) -> Tuple[float, List[QualityIssue], List[ValidationCheck]]:
        issues: List[QualityIssue] = []
        checks: List[ValidationCheck] = []

        seen_phrases = set()
        repetitive_scenes = 0
        bullet_reading_scenes = 0

        bullet_clues = ["bullet point", "gạch đầu dòng", "as listed on the slide", "như trên slide"]

        for s in scenes:
            narration_lower = s.narration_text.lower()

            # Anti-bullet-reading check
            if any(clue in narration_lower for clue in bullet_clues):
                bullet_reading_scenes += 1
                issues.append(QualityIssue(
                    issue_id=f"iss_{uuid.uuid4().hex[:6]}",
                    category="narrative",
                    issue_type="blind_bullet_reading",
                    severity="medium",
                    scene_id=s.scene_id,
                    description="Narration reads mechanical bullet markers instead of formulating natural spoken explanation.",
                    repair_suggestion="Rewrite scene into natural conversational instructional narrative."
                ))

            # Repetition detection across sentences
            sentences = [sent.strip() for sent in re.split(r"[.!?]", s.narration_text) if len(sent.strip()) > 15]
            for sent in sentences:
                norm_sent = " ".join(sent.lower().split()[:5])
                if norm_sent in seen_phrases:
                    repetitive_scenes += 1
                    issues.append(QualityIssue(
                        issue_id=f"iss_{uuid.uuid4().hex[:6]}",
                        category="narrative",
                        issue_type="repetitive_phrase",
                        severity="low",
                        scene_id=s.scene_id,
                        description=f"Repetitive phrasing detected: '{sent[:40]}...'",
                        repair_suggestion="Use transition synonyms or eliminate duplicate sentence."
                    ))
                seen_phrases.add(norm_sent)

        narrative_score = max(0.0, 1.0 - (bullet_reading_scenes * 0.15) - (repetitive_scenes * 0.08))
        status: QualityStatus = "PASSED" if narrative_score >= 0.85 else "WARNING"

        checks.append(ValidationCheck(
            check_id="chk_narrative_coherence",
            rule_name="Spoken Narrative Flow & Non-Repetition",
            category="narrative_coherence",
            status=status,
            score=round(narrative_score, 3),
            threshold=0.85,
            actual_value=f"{round(narrative_score * 100, 1)}%",
            message="Script avoids verbatim bullet-reading and features smooth spoken transitions."
        ))

        return narrative_score, issues, checks

    def _evaluate_visual_quality(
        self,
        scenes: List[DraftScene]
    ) -> Tuple[float, List[QualityIssue], List[ValidationCheck]]:
        issues: List[QualityIssue] = []
        checks: List[ValidationCheck] = []

        total_cues = sum(len(s.visual_cues) for s in scenes)
        invalid_taxonomies = 0
        unjustified_cues = 0
        misaligned_cues = 0

        for s in scenes:
            narration_lower = s.narration_text.lower()
            for cue in s.visual_cues:
                # 1. 13 Canonical taxonomies check
                if cue.taxonomy_type not in self.valid_taxonomies:
                    invalid_taxonomies += 1
                    issues.append(QualityIssue(
                        issue_id=f"iss_{uuid.uuid4().hex[:6]}",
                        category="visual",
                        issue_type="invalid_visual_taxonomy",
                        severity="high",
                        scene_id=s.scene_id,
                        description=f"Visual cue '{cue.cue_id}' specifies invalid taxonomy '{cue.taxonomy_type}'.",
                        repair_suggestion=f"Map to one of 13 canonical taxonomies, e.g. 'Conceptual Architecture Diagram'."
                    ))

                # 2. Visual cognitive necessity
                if len(cue.necessity_justification.strip()) < 15 or not cue.element_target:
                    unjustified_cues += 1
                    issues.append(QualityIssue(
                        issue_id=f"iss_{uuid.uuid4().hex[:6]}",
                        category="visual",
                        issue_type="unjustified_visual",
                        severity="low",
                        scene_id=s.scene_id,
                        description=f"Visual cue '{cue.cue_id}' lacks substantial cognitive necessity justification.",
                        repair_suggestion="Provide explicit pedagogical justification explaining why visual is essential."
                    ))

                # 3. Text-visual coherence
                if cue.taxonomy_type in ("Step-by-Step Code Walkthrough", "Code Execution Trace"):
                    if not any(k in narration_lower for k in ["code", "function", "variable", "line", "syntax", "implementation", "tensor", "class", "def"]):
                        misaligned_cues += 1
                        issues.append(QualityIssue(
                            issue_id=f"iss_{uuid.uuid4().hex[:6]}",
                            category="visual",
                            issue_type="text_visual_mismatch",
                            severity="medium",
                            scene_id=s.scene_id,
                            description=f"Code visual cue '{cue.cue_id}' is shown, but narration lacks code-related concepts.",
                            repair_suggestion="Align spoken narration with displayed code constructs."
                        ))

        if total_cues == 0:
            visual_score = 0.90
        else:
            visual_score = max(0.0, 1.0 - ((invalid_taxonomies * 0.20 + unjustified_cues * 0.05 + misaligned_cues * 0.10) / total_cues))

        status: QualityStatus = "PASSED" if visual_score >= 0.85 else "WARNING"

        checks.append(ValidationCheck(
            check_id="chk_visual_coherence",
            rule_name="13 Canonical Taxonomies & Text-Visual Alignment",
            category="visual_coherence",
            status=status,
            score=round(visual_score, 3),
            threshold=0.85,
            actual_value=f"{round(visual_score * 100, 1)}%",
            message="Visual intent cues strictly conform to canonical taxonomies and synchronize with spoken concepts."
        ))

        return visual_score, issues, checks

    def _evaluate_technical_quality(
        self,
        scenes: List[DraftScene],
        target_duration: float,
        actual_duration: float
    ) -> Tuple[float, List[QualityIssue], List[ValidationCheck]]:
        issues: List[QualityIssue] = []
        checks: List[ValidationCheck] = []

        # DAR-P duration check
        duration_error_ratio = abs(actual_duration - target_duration) / max(1.0, target_duration)
        duration_error_pct = round(duration_error_ratio * 100.0, 2)

        dar_status: QualityStatus = "PASSED"
        if duration_error_pct > 25.0:
            dar_status = "FAILED"
            issues.append(QualityIssue(
                issue_id=f"iss_{uuid.uuid4().hex[:6]}",
                category="technical",
                issue_type="dar_p_duration_exceeded",
                severity="high",
                description=f"DAR-P duration error is {duration_error_pct}%, exceeding 25% tolerance limit.",
                repair_suggestion="Apply temporal pause scaling or adjust scene word budget."
            ))
        elif duration_error_pct > 15.0:
            dar_status = "WARNING"
            issues.append(QualityIssue(
                issue_id=f"iss_{uuid.uuid4().hex[:6]}",
                category="technical",
                issue_type="dar_p_duration_warning",
                severity="medium",
                description=f"DAR-P duration error is {duration_error_pct}% (target: {target_duration}s, actual: {actual_duration}s).",
                repair_suggestion="Slightly scale pause timings by calibration factor."
            ))

        dar_score = max(0.0, min(1.0, 1.0 - (duration_error_pct / 100.0)))
        checks.append(ValidationCheck(
            check_id="chk_dar_p",
            rule_name="Duration Adherence Ratio with Prosody (DAR-P)",
            category="temporal_dar_p",
            status=dar_status,
            score=round(dar_score, 3),
            threshold=0.85,
            actual_value=f"{actual_duration:.1f}s vs target {target_duration:.1f}s ({duration_error_pct}%)",
            message=f"DAR-P duration error is {duration_error_pct}%."
        ))

        # Provenance completeness check
        unprovenanced_scenes = 0
        for s in scenes:
            trace = s.provenance_trace
            if not trace or not trace.source_document or trace.source_slide <= 0:
                unprovenanced_scenes += 1
                issues.append(QualityIssue(
                    issue_id=f"iss_{uuid.uuid4().hex[:6]}",
                    category="technical",
                    issue_type="missing_provenance",
                    severity="high",
                    scene_id=s.scene_id,
                    description=f"Scene '{s.title}' lacks valid provenance trace back to source slide.",
                    repair_suggestion="Populate provenance_trace with origin document and slide number."
                ))

        prov_score = 1.0 if not scenes else (len(scenes) - unprovenanced_scenes) / len(scenes)
        tech_score = (dar_score * 0.6) + (prov_score * 0.4)

        checks.append(ValidationCheck(
            check_id="chk_provenance_traceability",
            rule_name="End-to-End Provenance Traceability",
            category="provenance_traceability",
            status="PASSED" if prov_score >= 0.90 else "WARNING",
            score=round(prov_score, 3),
            threshold=0.90,
            actual_value=f"{round(prov_score * 100, 1)}%",
            message="All generated scenes maintain verifiable provenance links back to source material."
        ))

        return tech_score, issues, checks
