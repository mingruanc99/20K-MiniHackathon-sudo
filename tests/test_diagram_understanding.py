# tests/test_diagram_understanding.py
"""
Test Suite for Visual / Diagram Understanding & Graph Reconstruction in Module 1.
Validates:
1. Human pose skeleton recognition (17 keypoints, 19 connections, COCO topology).
2. Separation of diagram annotations (0..16 marked source_type="diagram_annotation").
3. Diagram annotations DO NOT pollute normal Markdown text paragraphs.
4. Text-visual association (right side explanation linked to skeleton via 'explains').
5. Multimodal semantic chunk generation with diagram context.
6. Unknown diagram fallback (type=diagram, subtype=unknown, confidence=0.5).
7. Vector shapes & grouped diagram graph reconstruction.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.document_ir import (
    DocumentIR,
    SlideIR,
    DocumentElement,
    StructuredDiagram
)
from app.modules.extractor.diagram_recognizer import DiagramRecognizer
from app.modules.extractor.relationship_builder import RelationshipBuilder
from app.modules.extractor.normalizer import ContentNormalizer
from app.modules.extractor.chunker import SemanticChunker

class TestDiagramUnderstanding(unittest.TestCase):
    def setUp(self):
        self.recognizer = DiagramRecognizer()
        self.rel_builder = RelationshipBuilder()
        self.normalizer = ContentNormalizer()
        self.chunker = SemanticChunker()

    def test_acceptance_criteria_human_pose_skeleton(self):
        """
        SECTION 14 ACCEPTANCE TEST:
        Slide contains human pose skeleton diagram on the left side and annotations 0..16,
        plus explanatory text on the right side.
        """
        doc_id = "DOC_POSE_01"
        slide_title = "17 điểm có tên — và 19 đường nối"

        # Raw extracted elements before diagram understanding
        elements = [
            # Slide Title
            DocumentElement(
                id="S8_title",
                type="text",
                role="concept",
                reading_order=1,
                content=slide_title,
                source_slide=8
            ),
            # Left-side visual image/shape placeholder
            DocumentElement(
                id="S8_visual_pose",
                type="image",
                role="illustration",
                reading_order=2,
                bbox=[0.05, 0.15, 0.45, 0.88],
                caption="Pose skeleton graphic",
                asset_path="assets/slide_08_diagram_01.png",
                source_slide=8
            ),
            # Isolated numbers 0 to 16 extracted from left-side diagram keypoints
            *[
                DocumentElement(
                    id=f"S8_kp_num_{i:02d}",
                    type="text",
                    role="concept",
                    reading_order=3 + i,
                    bbox=[0.08, 0.18 + (i * 0.04), 0.12, 0.22 + (i * 0.04)],
                    content=str(i),
                    source_slide=8
                )
                for i in range(17)
            ],
            # Right-side explanatory texts
            DocumentElement(
                id="S8_txt_exp1",
                type="text",
                role="concept",
                reading_order=20,
                bbox=[0.52, 0.20, 0.95, 0.30],
                content="0 nose — mũi",
                source_slide=8
            ),
            DocumentElement(
                id="S8_txt_exp2",
                type="text",
                role="concept",
                reading_order=21,
                bbox=[0.52, 0.32, 0.95, 0.45],
                content="1–4 mắt trái, mắt phải, tai trái, tai phải",
                source_slide=8
            ),
            DocumentElement(
                id="S8_txt_exp3",
                type="text",
                role="concept",
                reading_order=22,
                bbox=[0.52, 0.47, 0.95, 0.60],
                content="5–10 vai, khuỷu tay, cổ tay",
                source_slide=8
            ),
            DocumentElement(
                id="S8_txt_exp4",
                type="text",
                role="concept",
                reading_order=23,
                bbox=[0.52, 0.62, 0.95, 0.75],
                content="11–16 hông, đầu gối, cổ chân",
                source_slide=8
            )
        ]

        # 1. Run DiagramRecognizer
        analyzed_elements = self.recognizer.analyze_slide(elements, slide_title, 8, doc_id)

        # 2. Check major visual element
        diagram_elements = [el for el in analyzed_elements if el.type == "diagram"]
        self.assertEqual(len(diagram_elements), 1, "Must contain exactly ONE major diagram visual element")
        diag = diagram_elements[0]

        self.assertEqual(diag.type, "diagram")
        self.assertEqual(diag.subtype, "human_pose_skeleton")
        self.assertEqual(diag.role, "conceptual_diagram")
        self.assertEqual(diag.description, "Human body pose skeleton with 17 keypoints and 19 connections.")

        # Check graph reconstruction
        self.assertIsNotNone(diag.structured_diagram)
        st_diag = diag.structured_diagram
        self.assertEqual(st_diag.node_count, 17, "Must reconstruct 17 keypoint nodes")
        self.assertEqual(st_diag.edge_count, 19, "Must reconstruct 19 connection edges")

        # Verify keypoints (0..16) and body regions
        regions = {n.region for n in st_diag.nodes}
        self.assertIn("head", regions)
        self.assertIn("upper_body", regions)
        self.assertIn("lower_body", regions)

        # 3. Check annotation separation: 0..16 must NOT be regular text
        annotations = [el for el in analyzed_elements if el.source_type == "diagram_annotation"]
        self.assertEqual(len(annotations), 17, "All 17 numbers must have source_type='diagram_annotation'")
        for anno in annotations:
            self.assertEqual(anno.type, "annotation")
            self.assertEqual(anno.diagram_ref, diag.id)

        # Normal text elements must ONLY be the title and the right-side explanations
        normal_texts = [el for el in analyzed_elements if el.type == "text"]
        self.assertEqual(len(normal_texts), 5, "Only title + 4 right-side explanations should be normal text")
        # None of the normal texts should be a single isolated number
        for txt in normal_texts:
            self.assertFalse(txt.content.strip().isdigit() and 0 <= int(txt.content.strip()) <= 16)

        # 4. Text-Visual Association: Explicit relationship linking right side text to diagram
        relationships = self.rel_builder.build_slide_relationships(analyzed_elements)
        explains_rels = [
            r for r in relationships
            if r.target_id == diag.id and r.relation == "explains"
        ]
        self.assertTrue(len(explains_rels) >= 4, "Right-side explanations must explicitly explain the diagram")

        # Annotations must link with 'annotates'
        annotates_rels = [r for r in relationships if r.relation == "annotates"]
        self.assertEqual(len(annotates_rels), 17)

        # 5. Assemble Document IR
        slide_ir = SlideIR(
            slide_id=8,
            section_id="S8",
            title=slide_title,
            elements=analyzed_elements,
            relationships=relationships
        )
        doc_ir = DocumentIR(
            document_id=doc_id,
            title=slide_title,
            source_type="pptx",
            source_filename="pose_lecture.pptx",
            total_slides=1,
            slides=[slide_ir]
        )

        # 6. Markdown Representation Check:
        # Diagram labels (0..16) must NOT appear as independent paragraphs!
        md = self.normalizer.render_from_document_ir(doc_ir)

        # Visual block must be preserved
        self.assertIn("[DIAGRAM: conceptual_diagram]", md)
        self.assertIn("subtype: human_pose_skeleton", md)
        self.assertIn("Human body pose skeleton with 17 keypoints and 19 connections.", md)
        self.assertIn("17 nodes, 19 connections", md)

        # Right-side text must appear
        self.assertIn("0 nose — mũi", md)
        self.assertIn("1–4 mắt trái, mắt phải, tai trái, tai phải", md)

        # Crucial check: No standalone paragraphs "[TEXT: concept]\n0\n" or "[TEXT: concept]\n16\n"
        self.assertNotIn("[TEXT: concept]\n0\n", md)
        self.assertNotIn("[TEXT: concept]\n1\n", md)
        self.assertNotIn("[TEXT: concept]\n15\n", md)
        self.assertNotIn("[TEXT: concept]\n16\n", md)

        # 7. Semantic Chunker Check:
        # Multimodal chunk created linking text and diagram
        chunks = self.chunker.chunk_from_document_ir(doc_ir)
        self.assertTrue(any(c.chunk_category == "multimodal" for c in chunks))
        # Ensure no standalone garbage chunk for number "0"
        self.assertFalse(any(c.content.strip() == "0" for c in chunks))

    def test_vector_shapes_without_initial_image(self):
        """Slide with vector shapes and annotations without an initial Picture shape."""
        doc_id = "DOC_VECTOR_01"
        slide_title = "Human Pose Skeleton 17 điểm có tên"

        elements = [
            DocumentElement(id="S1_title", type="text", role="concept", reading_order=1, content=slide_title, source_slide=1),
            *[DocumentElement(id=f"S1_lbl_{i}", type="text", role="concept", reading_order=2+i, content=str(i), source_slide=1) for i in range(17)],
            DocumentElement(id="S1_txt", type="text", role="concept", reading_order=20, content="17 điểm có tên và 19 đường nối cơ bản", source_slide=1)
        ]

        analyzed = self.recognizer.analyze_slide(elements, slide_title, 1, doc_id)
        # Diagram element must be synthesized
        diag = next((e for e in analyzed if e.type == "diagram"), None)
        self.assertIsNotNone(diag)
        self.assertEqual(diag.subtype, "human_pose_skeleton")
        self.assertEqual(diag.structured_diagram.node_count, 17)
        self.assertEqual(diag.structured_diagram.edge_count, 19)

    def test_diagram_fallback_unknown(self):
        """Diagram with low confidence / unknown domain should fallback gracefully without hallucinating."""
        doc_id = "DOC_UNKNOWN_01"
        elements = [
            DocumentElement(
                id="S1_diag_unknown",
                type="diagram",
                role="conceptual_diagram",
                reading_order=1,
                caption="Generic visual schema",
                source_slide=1
            )
        ]

        analyzed = self.recognizer.analyze_slide(elements, "Generic Schema", 1, doc_id)
        diag = analyzed[0]
        self.assertEqual(diag.type, "diagram")
        self.assertEqual(diag.subtype, "unknown")
        self.assertEqual(diag.classification_confidence, 0.50)
        self.assertIn("Diagram structure associated with Generic Schema", diag.description)

if __name__ == "__main__":
    unittest.main()
