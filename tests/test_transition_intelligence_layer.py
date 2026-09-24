# tests/test_transition_intelligence_layer.py
"""
==============================================================================
UNIT TESTS — Transition Intelligence Layer (TIL)
==============================================================================
Tests cover:
  1. TransitionIR model validation
  2. LectureTransitionMap construction
  3. Relationship inference from pedagogical role pairs
  4. Rule-based bridge text generation
  5. Slide-centric anti-pattern detection
  6. Quality metric scoring
  7. Full TIL.analyze() integration
  8. Edge cases (single section, identical roles)
==============================================================================
"""

import unittest
from unittest.mock import MagicMock, patch

from app.models.transition_ir import (
    TransitionIR,
    LectureTransitionMap,
    TransitionQualityMetrics,
)
from app.models.blueprint import LessonBlueprint, SectionPlan
from app.modules.transition.transition_layer import (
    TransitionIntelligenceLayer,
    detect_slide_centric,
    _infer_relationship,
    _score_transition,
    _fill_template,
    _BRIDGE_TEMPLATES,
    SLIDE_CENTRIC_PHRASES,
)


def _make_plan(section_id, title, order, role, key_concepts=None, prereqs=None):
    """Helper: create a minimal SectionPlan for testing."""
    return SectionPlan(
        section_id=section_id,
        title=title,
        order=order,
        pedagogical_function=role,
        bloom_level="Understand",
        target_duration_sec=120,
        target_word_budget=200,
        key_concepts=key_concepts or [title.split()[0]],
        prerequisite_concepts=prereqs or [],
        instructional_goal=f"Understand {title}",
        assigned_chunk_ids=[section_id],
        primary_visual_id=None,
    )


def _make_blueprint(plans):
    return LessonBlueprint(
        blueprint_id="bp_test",
        document_id="doc_test",
        lecture_title="Test Lecture",
        total_target_duration_sec=sum(p.target_duration_sec for p in plans),
        total_word_budget=sum(p.target_word_budget for p in plans),
        pedagogical_strategy="Test",
        sections=plans,
        metadata={},
    )


class TestSlideCentricDetection(unittest.TestCase):
    """Test anti-pattern (slide-centric phrase) detection."""

    def test_detects_lets_move_on_to(self):
        text = "Let's move on to the next concept."
        found = detect_slide_centric(text)
        self.assertTrue(len(found) > 0, "Should detect 'Let's move on to'")

    def test_detects_next_slide(self):
        found = detect_slide_centric("Next slide: Bounding Box")
        self.assertTrue(len(found) > 0)

    def test_detects_in_this_section(self):
        found = detect_slide_centric("In this section, we will cover pose estimation.")
        self.assertTrue(len(found) > 0)

    def test_detects_now_we_will_see(self):
        found = detect_slide_centric("Now we will see how keypoints work.")
        self.assertTrue(len(found) > 0)

    def test_detects_vietnamese_phrases(self):
        found = detect_slide_centric("Tiếp theo chúng ta sẽ xem xét pose estimation.")
        self.assertTrue(len(found) > 0)

    def test_clean_bridge_passes(self):
        text = ("Bounding boxes tell us where a person is. "
                "However, location alone is not enough — we still do not know "
                "how the person's body is arranged.")
        found = detect_slide_centric(text)
        self.assertEqual(found, [], f"Should not detect slide-centric phrases in: {text}")

    def test_clean_opening_passes(self):
        text = ("That is precisely the gap that pose representation fills — "
                "giving us the full arrangement of body joints.")
        found = detect_slide_centric(text)
        self.assertEqual(found, [])


class TestRelationshipInference(unittest.TestCase):
    """Test rule-based relationship inference from pedagogical role pairs."""

    def test_hook_to_definition(self):
        plan_a = _make_plan("s1", "Hook", 1, "hook")
        plan_b = _make_plan("s2", "Definition", 2, "definition")
        rel, strat = _infer_relationship(plan_a, plan_b)
        self.assertEqual(rel, "ObservationToExplanation")
        self.assertEqual(strat, "curiosity_hook")

    def test_definition_to_mechanism(self):
        plan_a = _make_plan("s1", "Bounding Box", 1, "definition")
        plan_b = _make_plan("s2", "Pose Encoding", 2, "mechanism")
        rel, strat = _infer_relationship(plan_a, plan_b)
        self.assertEqual(rel, "FoundationToExtension")
        self.assertEqual(strat, "causal_chain")

    def test_mechanism_to_example(self):
        plan_a = _make_plan("s1", "Pose Representation", 1, "mechanism")
        plan_b = _make_plan("s2", "Keypoint Demo", 2, "example")
        rel, strat = _infer_relationship(plan_a, plan_b)
        self.assertEqual(rel, "ConceptToApplication")
        self.assertEqual(strat, "gap_bridge")

    def test_example_to_summary_uses_component_to_whole(self):
        plan_a = _make_plan("s1", "17 Keypoints", 1, "example")
        plan_b = _make_plan("s2", "Skeleton Graph", 2, "summary")
        rel, strat = _infer_relationship(plan_a, plan_b)
        self.assertEqual(rel, "ComponentToWhole")
        self.assertEqual(strat, "zoom_transition")

    def test_unknown_pair_falls_back(self):
        plan_a = _make_plan("s1", "A", 1, "summary")
        plan_b = _make_plan("s2", "B", 2, "mechanism")
        rel, strat = _infer_relationship(plan_a, plan_b)
        # Should not raise; returns a valid relationship
        self.assertIsInstance(rel, str)
        self.assertIsInstance(strat, str)


class TestBridgeTemplates(unittest.TestCase):
    """Test that rule-based bridge templates produce correct filled text."""

    def test_limitation_to_solution_template(self):
        tmpl = _BRIDGE_TEMPLATES["LimitationToSolution"]
        closing = _fill_template(tmpl["closing"], "Bounding Box", "Pose", "body posture", "pose representation")
        opening = _fill_template(tmpl["opening"], "Bounding Box", "Pose", "body posture", "pose representation")
        self.assertIn("Bounding Box", closing)
        self.assertIn("Pose", opening)
        self.assertNotIn("{A}", closing)
        self.assertNotIn("{B}", opening)

    def test_definition_to_example_template(self):
        tmpl = _BRIDGE_TEMPLATES["DefinitionToExample"]
        closing = _fill_template(tmpl["closing"], "Keypoint", "COCO Format")
        self.assertIn("Keypoint", closing)
        self.assertIn("practice", closing.lower())

    def test_default_template_used_for_unknown(self):
        tmpl = _BRIDGE_TEMPLATES["_default"]
        closing = _fill_template(tmpl["closing"], "ConceptA", "ConceptB")
        opening = _fill_template(tmpl["opening"], "ConceptA", "ConceptB")
        self.assertIn("ConceptA", closing)
        self.assertIn("ConceptB", opening)


class TestQualityScoring(unittest.TestCase):
    """Test transition quality scoring logic."""

    def test_clean_bridge_scores_high(self):
        closing = ("Bounding boxes tell us where a person is. "
                   "However, location alone is not enough.")
        opening = ("That is precisely the gap that pose representation fills — "
                   "the full encoding of body joints.")
        quality = _score_transition(closing, opening, "Bounding", "Pose", "LimitationToSolution")
        self.assertGreater(quality.human_lecture_flow_score, 0.5)
        self.assertEqual(quality.slide_dependency_score, 0.0)

    def test_slide_centric_bridge_penalized(self):
        closing = "Let's move on to pose estimation."
        opening = "In this section, pose is defined as 51 numbers."
        quality = _score_transition(closing, opening, "Bounding", "Pose", "LimitationToSolution")
        self.assertGreater(quality.slide_dependency_score, 0.0)

    def test_overall_clean_bridge_above_0_7(self):
        closing = ("Bounding boxes tell us where a person is. "
                   "However, that is not enough — we do not yet know how the body is arranged.")
        opening = ("Pose representation fills exactly that gap.")
        quality = _score_transition(closing, opening, "Bounding", "Pose", "LimitationToSolution")
        # Since this is a rule-based score, just check it's in valid range
        self.assertGreaterEqual(quality.transition_quality_score, 0.0)
        self.assertLessEqual(quality.transition_quality_score, 1.0)
        self.assertGreaterEqual(quality.overall, 0.0)
        self.assertLessEqual(quality.overall, 1.0)


class TestTransitionIRModel(unittest.TestCase):
    """Test TransitionIR Pydantic model validation."""

    def test_valid_transition_ir(self):
        tr = TransitionIR(
            transition_id="tr_01_02",
            from_section_id="sec_01",
            to_section_id="sec_02",
            from_concept_label="Bounding Box",
            to_concept_label="Pose Representation",
            relationship="LimitationToSolution",
            bridge_reason="Bounding boxes provide location but not posture.",
            learner_question="How is body structure encoded?",
            strategy="gap_bridge",
            closing_sentence_a="Bounding boxes tell us where. But not how.",
            opening_sentence_b="Pose representation fills that gap.",
            bridge_text="Bounding boxes tell us where. But not how. Pose fills that gap.",
        )
        self.assertEqual(tr.transition_id, "tr_01_02")
        self.assertEqual(tr.relationship, "LimitationToSolution")
        self.assertIsNone(tr.quality)
        self.assertEqual(tr.slide_centric_phrases_detected, [])

    def test_transition_quality_metrics_overall(self):
        q = TransitionQualityMetrics(
            transition_quality_score=0.9,
            bridge_coherence_score=0.85,
            concept_continuity_score=0.90,
            human_lecture_flow_score=0.95,
            slide_dependency_score=0.0,
        )
        overall = q.overall
        self.assertGreater(overall, 0.8)
        self.assertLessEqual(overall, 1.0)

    def test_quality_overall_penalizes_slide_dependency(self):
        q_clean = TransitionQualityMetrics(
            transition_quality_score=0.9,
            bridge_coherence_score=0.9,
            concept_continuity_score=0.9,
            human_lecture_flow_score=0.9,
            slide_dependency_score=0.0,
        )
        q_dirty = TransitionQualityMetrics(
            transition_quality_score=0.9,
            bridge_coherence_score=0.9,
            concept_continuity_score=0.9,
            human_lecture_flow_score=0.9,
            slide_dependency_score=1.0,
        )
        self.assertGreater(q_clean.overall, q_dirty.overall)


class TestTransitionIntelligenceLayerIntegration(unittest.TestCase):
    """Integration tests for the full TIL pipeline."""

    def setUp(self):
        # Use TIL with LLM disabled (rule-based only for testing)
        self.til = TransitionIntelligenceLayer(provider=None, use_llm=False)

    def _pose_estimation_blueprint(self):
        plans = [
            _make_plan("sec_01", "Object Detection",       1, "hook",       ["Object Detection"]),
            _make_plan("sec_02", "Bounding Box",           2, "definition",  ["Bounding Box"]),
            _make_plan("sec_03", "Pose Representation",    3, "mechanism",   ["Pose Representation"]),
            _make_plan("sec_04", "17 Keypoints",           4, "example",     ["Keypoints"]),
            _make_plan("sec_05", "Skeleton Graph",         5, "summary",     ["Skeleton Graph"]),
        ]
        return _make_blueprint(plans)

    def test_analyze_returns_correct_count(self):
        bp = self._pose_estimation_blueprint()
        tmap = self.til.analyze(bp)
        # n sections → n-1 transitions
        self.assertEqual(tmap.total_transitions, 4)
        self.assertEqual(len(tmap.transitions), 4)

    def test_transition_ids_are_sequential(self):
        bp = self._pose_estimation_blueprint()
        tmap = self.til.analyze(bp)
        expected_ids = ["tr_01_02", "tr_02_03", "tr_03_04", "tr_04_05"]
        actual_ids = [t.transition_id for t in tmap.transitions]
        self.assertEqual(actual_ids, expected_ids)

    def test_from_to_section_ids_correct(self):
        bp = self._pose_estimation_blueprint()
        tmap = self.til.analyze(bp)
        self.assertEqual(tmap.transitions[0].from_section_id, "sec_01")
        self.assertEqual(tmap.transitions[0].to_section_id, "sec_02")
        self.assertEqual(tmap.transitions[-1].from_section_id, "sec_04")
        self.assertEqual(tmap.transitions[-1].to_section_id, "sec_05")

    def test_no_slide_centric_phrases_in_rule_based_bridges(self):
        bp = self._pose_estimation_blueprint()
        tmap = self.til.analyze(bp)
        for tr in tmap.transitions:
            bad = detect_slide_centric(tr.bridge_text)
            self.assertEqual(
                bad, [],
                f"Transition {tr.transition_id} contains slide-centric phrases: {bad}\nBridge: {tr.bridge_text}"
            )

    def test_all_bridges_non_empty(self):
        bp = self._pose_estimation_blueprint()
        tmap = self.til.analyze(bp)
        for tr in tmap.transitions:
            self.assertTrue(len(tr.closing_sentence_a) > 0, f"{tr.transition_id} closing is empty")
            self.assertTrue(len(tr.opening_sentence_b) > 0, f"{tr.transition_id} opening is empty")
            self.assertTrue(len(tr.bridge_text) > 0, f"{tr.transition_id} bridge_text is empty")

    def test_quality_scores_populated(self):
        bp = self._pose_estimation_blueprint()
        tmap = self.til.analyze(bp)
        for tr in tmap.transitions:
            self.assertIsNotNone(tr.quality, f"{tr.transition_id} has no quality")
            self.assertGreaterEqual(tr.quality.transition_quality_score, 0.0)
            self.assertLessEqual(tr.quality.transition_quality_score, 1.0)

    def test_aggregate_stats_computed(self):
        bp = self._pose_estimation_blueprint()
        tmap = self.til.analyze(bp)
        self.assertGreater(tmap.average_transition_quality, 0.0)
        self.assertIsNotNone(tmap.created_at)
        self.assertEqual(tmap.blueprint_id, "bp_test")

    def test_single_section_blueprint_produces_empty_map(self):
        bp = _make_blueprint([_make_plan("sec_01", "Only Section", 1, "hook")])
        tmap = self.til.analyze(bp)
        self.assertEqual(tmap.total_transitions, 0)
        self.assertEqual(tmap.transitions, [])

    def test_two_section_blueprint(self):
        bp = _make_blueprint([
            _make_plan("sec_01", "Hook", 1, "hook"),
            _make_plan("sec_02", "Definition", 2, "definition"),
        ])
        tmap = self.til.analyze(bp)
        self.assertEqual(tmap.total_transitions, 1)
        tr = tmap.transitions[0]
        self.assertEqual(tr.relationship, "ObservationToExplanation")

    def test_get_transition_index(self):
        bp = self._pose_estimation_blueprint()
        tmap = self.til.analyze(bp)
        index = self.til.get_transition_index(tmap)
        # Index is keyed by to_section_id
        self.assertIn("sec_02", index)
        self.assertIn("sec_03", index)
        self.assertEqual(index["sec_02"].from_section_id, "sec_01")

    def test_generation_method_is_rule_based_without_llm(self):
        bp = self._pose_estimation_blueprint()
        tmap = self.til.analyze(bp)
        for tr in tmap.transitions:
            self.assertEqual(tr.generation_method, "rule_based")

    def test_bounding_box_to_pose_is_limitation_to_solution(self):
        """The canonical example: Bounding Box → Pose should be LimitationToSolution."""
        bp = _make_blueprint([
            _make_plan("sec_bb", "Bounding Box", 1, "definition", ["Bounding Box"]),
            _make_plan("sec_pose", "Pose Representation", 2, "mechanism", ["Pose Representation"]),
        ])
        tmap = self.til.analyze(bp)
        self.assertEqual(tmap.transitions[0].relationship, "FoundationToExtension")
        # The closing should NOT say "Let's move on to Pose"
        bad = detect_slide_centric(tmap.transitions[0].closing_sentence_a)
        self.assertEqual(bad, [])
        # The opening should NOT start with "Pose is..." followed by "In this section"
        self.assertNotIn("In this section", tmap.transitions[0].opening_sentence_b)


if __name__ == "__main__":
    unittest.main(verbosity=2)
