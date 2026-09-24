# tests/test_multimodal_normalizer_chunker.py
import unittest
from app.models.document import DocumentSection, ContentElement, VisualElement
from app.modules.extractor.normalizer import ContentNormalizer
from app.modules.extractor.chunker import SemanticChunker
from app.core.provider import LLMGateway, DeterministicMockProvider

class TestMultimodalNormalizerAndChunker(unittest.TestCase):
    def setUp(self):
        self.normalizer = ContentNormalizer()
        self.chunker = SemanticChunker()

    def test_structured_markdown_normalization(self):
        sections = [
            DocumentSection(
                section_id="S1",
                title="Object Detection Overview",
                order=1,
                elements=[
                    ContentElement(
                        element_id="S1_el_01",
                        type="paragraph",
                        text="Object Detection is defined as locating and classifying objects simultaneously."
                    ),
                    ContentElement(
                        element_id="S1_el_02",
                        type="bullet_point",
                        text="Bounding Box regression",
                        level=1
                    ),
                    ContentElement(
                        element_id="S1_el_03",
                        type="table",
                        text="Model | mAP | FPS\nYOLOv8 | 53.9 | 120\nFaster R-CNN | 42.0 | 18"
                    ),
                    ContentElement(
                        element_id="S1_el_04",
                        type="note",
                        text="Emphasize inference latency difference."
                    )
                ]
            )
        ]
        visuals = [
            VisualElement(
                visual_id="DOC01_S01_IMG01",
                source_document="DOC01",
                source_slide=1,
                visual_role="Architecture Diagram",
                caption="YOLO Architecture Flow",
                storage_path="assets/slide_01_img_01.png"
            )
        ]

        md = self.normalizer.normalize_to_markdown("DOC01", "pptx", "Computer Vision", sections, visuals)

        self.assertIn("# Computer Vision", md)
        self.assertIn("slide_id: 1", md)
        self.assertIn("title: Object Detection Overview", md)
        self.assertIn("## Slide 1: Object Detection Overview", md)
        self.assertIn("![YOLO Architecture Flow](assets/slide_01_img_01.png)", md)
        self.assertIn("[TABLE: comparison]", md)
        self.assertIn("| Model | mAP | FPS |", md)
        self.assertIn("[NOTE: reference]", md)

    def test_semantic_slide_aware_chunking(self):
        sections = [
            DocumentSection(
                section_id="S12",
                title="YOLO Single Regression Principle",
                order=12,
                elements=[
                    ContentElement(
                        element_id="S12_el_01",
                        type="paragraph",
                        text="YOLO is defined as a single-stage detector that treats detection as a regression problem."
                    ),
                    ContentElement(
                        element_id="S12_el_02",
                        type="bullet_point",
                        text="Step 1: Divide image into S x S grid cells.",
                        level=1
                    ),
                    ContentElement(
                        element_id="S12_el_03",
                        type="bullet_point",
                        text="Step 2: Predict bounding boxes and confidence scores.",
                        level=1
                    ),
                    ContentElement(
                        element_id="S12_el_04",
                        type="table",
                        text="Metric | YOLO | SSD\nFPS | 120 | 45"
                    ),
                    ContentElement(
                        element_id="S12_el_05",
                        type="note",
                        text="Compare single-stage with two-stage pipeline."
                    )
                ]
            )
        ]
        visuals = [
            VisualElement(
                visual_id="DOC01_S12_IMG01",
                source_document="DOC01",
                source_slide=12,
                visual_role="Architecture Diagram",
                caption="YOLO Grid Tensor Mapping"
            )
        ]

        chunks = self.chunker.chunk_document("DOC01", "pptx", sections, visuals)

        self.assertTrue(len(chunks) >= 3)
        
        # Check first chunk: definition
        def_chunk = chunks[0]
        self.assertEqual(def_chunk.chunk_id, "DOC01-S12-C01")
        self.assertEqual(def_chunk.chunk_type, "definition")
        self.assertEqual(def_chunk.provenance.source_slide, 12)
        self.assertEqual(def_chunk.provenance.document_id, "DOC01")
        self.assertEqual(len(def_chunk.visual_refs), 1)
        self.assertEqual(def_chunk.visual_refs[0].visual_id, "DOC01_S12_IMG01")
        self.assertIn("Compare single-stage", def_chunk.speaker_notes)

        # Check comparison chunk (table)
        table_chunks = [c for c in chunks if c.chunk_type == "comparison"]
        self.assertTrue(len(table_chunks) >= 1)

    def test_llm_gateway_traceability(self):
        gateway = LLMGateway(DeterministicMockProvider())
        resp1 = gateway.lesson_understanding("DOC01", "# Lesson Content")
        resp2 = gateway.content_prioritization("DOC01", 180, resp1)
        resp3 = gateway.teaching_arc_generation("DOC01", resp2)
        resp4 = gateway.narration_generation("DOC01", "S1", "Write narration", "System prompt", ["DOC01-S01-C01"])

        self.assertEqual(len(gateway.trace_logs), 4)
        for event in gateway.trace_logs:
            self.assertEqual(event.document_id, "DOC01")
            self.assertTrue(event.latency_ms >= 0.0)
            self.assertEqual(event.status, "success")
        
        # Verify narration call trace metadata
        narration_event = gateway.trace_logs[3]
        self.assertEqual(narration_event.lesson_unit_id, "S1")
        self.assertEqual(narration_event.chunk_id, "DOC01-S01-C01")

if __name__ == "__main__":
    unittest.main()
