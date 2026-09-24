# tests/test_knowledge_graph_and_curriculum.py
import unittest
from app.models.document_ir import DocumentIR, SlideIR, DocumentElement
from app.modules.knowledge_graph.graph_builder import KnowledgeGraphBuilder
from app.modules.curriculum.curriculum_optimizer import CurriculumOptimizer

class TestKnowledgeGraphAndCurriculum(unittest.TestCase):
    def setUp(self):
        self.graph_builder = KnowledgeGraphBuilder()
        self.curriculum_optimizer = CurriculumOptimizer()
        self.doc_ir = DocumentIR(
            document_id="doc_pose_test",
            title="Human Pose Estimation Masterclass",
            source_filename="Pose_Estimation.pptx",
            source_type="pptx",
            total_slides=3,
            slides=[
                SlideIR(
                    slide_id=1,
                    section_id="S01",
                    title="Giới thiệu về Pose Estimation",
                    elements=[
                        DocumentElement(
                            id="el_01",
                            type="text",
                            role="definition",
                            reading_order=1,
                            content="Pose estimation là bài toán định vị các điểm khớp cơ thể người trong ảnh 2D."
                        )
                    ]
                ),
                SlideIR(
                    slide_id=2,
                    section_id="S02",
                    title="17 điểm COCO Keypoints và 19 đường nối",
                    elements=[
                        DocumentElement(
                            id="el_02",
                            type="text",
                            role="concept",
                            reading_order=1,
                            content="Định dạng chuẩn COCO bao gồm 17 keypoints từ mũi đến cổ chân."
                        ),
                        DocumentElement(
                            id="vis_01",
                            type="diagram",
                            subtype="human_pose_skeleton",
                            role="conceptual_diagram",
                            reading_order=2,
                            content="Sơ đồ 17 keypoints"
                        ),
                        DocumentElement(
                            id="ann_01",
                            type="annotation",
                            role="unknown",
                            reading_order=3,
                            content="0 nose - mũi"
                        )
                    ]
                ),
                SlideIR(
                    slide_id=3,
                    section_id="S03",
                    title="So sánh Top-Down vs Bottom-Up Tradeoff",
                    elements=[
                        DocumentElement(
                            id="el_03",
                            type="text",
                            role="comparison",
                            reading_order=1,
                            content="Top-Down chậm hơn khi đông người nhưng chính xác; Bottom-Up nhanh ổn định ở 60 FPS."
                        )
                    ]
                )
            ]
        )

    def test_knowledge_space_construction(self):
        knowledge_ir = self.graph_builder.build_knowledge_space(self.doc_ir)
        self.assertEqual(len(knowledge_ir.concepts), 3)

        # Verify diagram is attached as Evidence directly to the concept
        coco_concept = next(c for c in knowledge_ir.concepts if "coco" in c.canonical_name.lower() or "17" in c.canonical_name.lower())
        self.assertTrue(len(coco_concept.evidence_artifacts) > 0)
        self.assertEqual(coco_concept.evidence_artifacts[0].modality, "diagram")
        self.assertEqual(coco_concept.evidence_artifacts[0].subtype, "human_pose_skeleton")

        # Verify edges exist
        self.assertTrue(len(knowledge_ir.edges) >= 2)
        self.assertEqual(knowledge_ir.edges[0].relationship_type, "prerequisite_to")

    def test_curriculum_time_awareness(self):
        knowledge_ir = self.graph_builder.build_knowledge_space(self.doc_ir)

        # ── 3-minute flash lecture ────────────────────────────────────────────
        curr_3m = self.curriculum_optimizer.compile_curriculum(knowledge_ir, target_duration_min=3)
        self.assertEqual(curr_3m.target_duration_min, 3)
        # New: tier name is 'flash_3m', not 'flash_overview'
        self.assertEqual(curr_3m.teaching_design_strategy, "flash_3m")
        self.assertEqual(curr_3m.compression_strategy, "flash_3m")  # backward compat alias
        # flash_3m introduces exactly 1 concept (the most significant core concept)
        self.assertEqual(curr_3m.active_concepts_count, 1)
        self.assertGreater(curr_3m.pruned_concepts_count, 0)
        self.assertEqual(curr_3m.total_target_words, int(3 * 135))

        # Verify narration layers are minimal (hook + intuition only)
        unit_3m = curr_3m.teaching_trajectory[0]
        self.assertIsNotNone(unit_3m.depth)
        self.assertIn("hook_question", unit_3m.depth.narration_layers)
        self.assertIn("intuition", unit_3m.depth.narration_layers)
        # Should NOT include mechanism, worked_example, caveat
        self.assertNotIn("mechanism", unit_3m.depth.narration_layers)
        self.assertNotIn("caveat", unit_3m.depth.narration_layers)
        self.assertEqual(unit_3m.depth.bloom_ceiling, "Understand")
        self.assertEqual(unit_3m.depth.evidence_density, 0.0)

        # ── 30-minute deep dive ───────────────────────────────────────────────
        curr_30m = self.curriculum_optimizer.compile_curriculum(knowledge_ir, target_duration_min=30)
        self.assertEqual(curr_30m.target_duration_min, 30)
        # New: tier name is 'deep_30m', not 'comprehensive_deep_dive'
        self.assertEqual(curr_30m.teaching_design_strategy, "deep_30m")
        self.assertEqual(curr_30m.compression_strategy, "deep_30m")  # backward compat alias
        # All 3 core/foundational concepts included at deep_30m
        self.assertEqual(curr_30m.active_concepts_count, 3)
        self.assertEqual(curr_30m.pruned_concepts_count, 0)
        self.assertEqual(curr_30m.total_target_words, int(30 * 135))

        # Verify narration layers include mechanism and worked_example for deep tier
        core_unit = next(
            (u for u in curr_30m.teaching_trajectory if u.depth and "mechanism" in u.depth.narration_layers),
            None
        )
        self.assertIsNotNone(core_unit, "deep_30m should have at least one unit with mechanism layer")
        self.assertIn("worked_example", core_unit.depth.narration_layers)
        self.assertEqual(core_unit.depth.bloom_ceiling, "Apply")
        self.assertEqual(core_unit.depth.evidence_density, 0.6)

        # ── Cross-tier qualitative difference check ───────────────────────────
        # 3m and 30m curricula for the same knowledge space should differ structurally
        layers_3m = curr_3m.teaching_trajectory[0].depth.narration_layers
        # 30m should have strictly more layers than 3m
        all_layers_30m = [layer for u in curr_30m.teaching_trajectory
                          if u.depth for layer in u.depth.narration_layers]
        self.assertGreater(len(set(all_layers_30m)), len(set(layers_3m)),
                           "30-min curriculum must activate more cognitive layers than 3-min")

        # Verify design_rationale is populated
        self.assertTrue(len(curr_3m.design_rationale) > 0)
        self.assertTrue(len(curr_30m.design_rationale) > 0)

        # Verify excluded_concept_rationale populated for 3m (many excluded)
        self.assertGreater(len(curr_3m.excluded_concept_rationale), 0)


if __name__ == '__main__':
    unittest.main()

