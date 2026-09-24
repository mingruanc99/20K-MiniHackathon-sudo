# tests/test_narrative_intelligence.py
import unittest
from app.models.document_ir import DocumentIR, SlideIR, DocumentElement
from app.models.narrative_ir import NarrativeIR
from app.modules.narrative.narrative_engine import NarrativeIntelligenceEngine

class TestNarrativeIntelligenceEngine(unittest.TestCase):
    def setUp(self):
        self.engine = NarrativeIntelligenceEngine()
        self.doc_ir = DocumentIR(
            document_id="test_doc_01",
            title="Introduction to Pose Estimation",
            source_filename="Pose_Estimation.pptx",
            source_type="pptx",
            total_slides=1,
            slides=[
                SlideIR(
                    slide_id=1,
                    section_id="S01",
                    title="Human Pose Keypoints Definition",
                    elements=[
                        DocumentElement(
                            id="el_01",
                            type="text",
                            role="concept",
                            reading_order=1,
                            content="COCO Keypoints Format"
                        ),
                        DocumentElement(
                            id="el_02",
                            type="text",
                            role="definition",
                            reading_order=2,
                            content="Consists of 17 body keypoints and 19 connections."
                        ),
                        DocumentElement(
                            id="ann_01",
                            type="annotation",
                            role="unknown",
                            reading_order=3,
                            content="0 nose - mũi"
                        ),
                        DocumentElement(
                            id="vis_01",
                            type="diagram",
                            subtype="human_pose_skeleton",
                            role="conceptual_diagram",
                            reading_order=4,
                            content="17-keypoint skeleton diagram"
                        )
                    ]
                )
            ]
        )

    def test_narrative_ir_generation(self):
        narrative_ir = self.engine.generate_narrative_ir(self.doc_ir)
        self.assertIsInstance(narrative_ir, NarrativeIR)
        self.assertEqual(len(narrative_ir.narrative_beats), 1)

        beat = narrative_ir.narrative_beats[0]
        # Check curiosity hook formulation
        self.assertIsNotNone(beat.curiosity_gap)
        self.assertIn("máy tính", beat.curiosity_gap.prompt_question.lower())

        # Check spoken discourse
        self.assertIsNotNone(beat.spoken_discourse.lead_marker)
        self.assertTrue(len(beat.spoken_discourse.deictic_visual_cues) > 0)

        # Check analogy mapping
        self.assertIsNotNone(beat.analogy)
        self.assertIn("người que", beat.analogy.source_domain)

        # Check re-voicing
        draft = "COCO format defines 17 keypoints for pose estimation."
        revoiced = self.engine.revoice_to_conversational(draft, beat)
        self.assertIn(beat.spoken_discourse.lead_marker, revoiced)
        self.assertIn("người que", revoiced)

if __name__ == '__main__':
    unittest.main()
