# tests/test_multimodal_document_ir.py
"""
Comprehensive Validation Test Suite for Multimodal Document Representation (Module 1 Refactor).
Covers all 10 mandatory architectural cases:
- CASE 1: Text-only slide
- CASE 2: Text + image
- CASE 3: Text + table
- CASE 4: Text + chart
- CASE 5: Text + diagram
- CASE 6: Text + image + table + chart
- CASE 7: Visual with low classifier confidence (< 0.7 fallback)
- CASE 8: Table/chart without extractable data (data: null, zero hallucination)
- CASE 9: Multimodal chunk with text + visual relationship
- CASE 10: Trace from SemanticChunk back to Document IR element and Original Slide
"""
import unittest
from app.models.document_ir import (
    DocumentIR,
    SlideIR,
    DocumentElement,
    StructuredTable,
    StructuredChart,
    ElementRelationship
)
from app.modules.extractor.element_classifier import ElementClassifier
from app.modules.extractor.relationship_builder import RelationshipBuilder
from app.modules.extractor.normalizer import ContentNormalizer
from app.modules.extractor.chunker import SemanticChunker

class TestMultimodalDocumentIR(unittest.TestCase):
    def setUp(self):
        self.classifier = ElementClassifier()
        self.rel_builder = RelationshipBuilder()
        self.normalizer = ContentNormalizer()
        self.chunker = SemanticChunker()

    def test_case_1_text_only_slide(self):
        """CASE 1: Slide chỉ có text."""
        elements = [
            DocumentElement(id="S1_el01", type="text", role="concept", reading_order=1, content="Deep Learning Foundations", source_slide=1),
            DocumentElement(id="S1_el02", type="text", role="definition", reading_order=2, content="Neural networks are defined as computational graphs of parameterized nodes.", source_slide=1)
        ]
        slide = SlideIR(slide_id=1, section_id="S1", title="Deep Learning Foundations", elements=elements)
        doc_ir = DocumentIR(document_id="DOC01", title="DL Lecture", source_type="pptx", source_filename="dl.pptx", total_slides=1, slides=[slide])

        chunks = self.chunker.chunk_from_document_ir(doc_ir)
        self.assertEqual(len(chunks), 2)
        self.assertTrue(all(c.chunk_category == "text" for c in chunks))
        self.assertEqual(chunks[1].chunk_type, "definition")

        # Verify clean markdown rendering
        md = self.normalizer.render_from_document_ir(doc_ir)
        self.assertIn("[TEXT: concept]", md)
        self.assertIn("[TEXT: definition]", md)

    def test_case_2_text_plus_image(self):
        """CASE 2: Slide có text + image."""
        elements = [
            DocumentElement(id="S2_txt", type="text", role="concept", reading_order=1, content="Autonomous vehicles utilize computer vision pipelines.", source_slide=2),
            DocumentElement(id="S2_img", type="image", role="real_world_example", reading_order=2, asset_path="assets/car.png", caption="Autonomous car sensor suite", source_slide=2)
        ]
        rels = self.rel_builder.build_slide_relationships(elements)
        self.assertEqual(len(rels), 1)
        self.assertEqual(rels[0].relation, "explains")

        slide = SlideIR(slide_id=2, section_id="S2", title="Autonomous Perception", elements=elements, relationships=rels)
        doc_ir = DocumentIR(document_id="DOC01", title="AV Lecture", source_type="pptx", source_filename="av.pptx", total_slides=1, slides=[slide])

        chunks = self.chunker.chunk_from_document_ir(doc_ir)
        # Should fuse into a multimodal chunk
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].chunk_category, "multimodal")
        self.assertIn("S2_txt", chunks[0].text_refs)
        self.assertEqual(chunks[0].visual_refs[0].visual_id, "S2_img")

    def test_case_3_text_plus_table(self):
        """CASE 3: Slide có text + table."""
        st_table = StructuredTable(
            table_id="tbl_01",
            columns=["Model", "mAP", "FPS"],
            rows=[["YOLOv8", "53.9", "120"], ["Faster R-CNN", "42.0", "18"]],
            headers=["Model", "mAP", "FPS"]
        )
        elements = [
            DocumentElement(id="S3_txt", type="text", role="comparison", reading_order=1, content="Comparison between one-stage and two-stage object detectors.", source_slide=3),
            DocumentElement(id="S3_tbl", type="table", role="comparison", reading_order=2, structured_table=st_table, source_slide=3)
        ]
        rels = self.rel_builder.build_slide_relationships(elements)
        self.assertEqual(len(rels), 1)
        self.assertEqual(rels[0].relation, "compares")

        slide = SlideIR(slide_id=3, section_id="S3", title="Detector Tradeoffs", elements=elements, relationships=rels)
        doc_ir = DocumentIR(document_id="DOC01", title="OD Lecture", source_type="pptx", source_filename="od.pptx", total_slides=1, slides=[slide])

        chunks = self.chunker.chunk_from_document_ir(doc_ir)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].chunk_category, "multimodal")
        self.assertIn("S3_tbl", chunks[0].table_refs)

    def test_case_4_text_plus_chart(self):
        """CASE 4: Slide có text + chart."""
        st_chart = StructuredChart(
            chart_id="chart_01",
            chart_type="bar",
            title="Inference Speed Comparison",
            x_axis="Model",
            y_axis="FPS",
            data=[{"model": "YOLOv8", "fps": 120}, {"model": "SSD", "fps": 45}]
        )
        elements = [
            DocumentElement(id="S4_txt", type="text", role="concept", reading_order=1, content="Evaluating inference throughput across lightweight detectors.", source_slide=4),
            DocumentElement(id="S4_ch", type="chart", role="performance_comparison", reading_order=2, structured_chart=st_chart, source_slide=4)
        ]
        rels = self.rel_builder.build_slide_relationships(elements)
        self.assertEqual(len(rels), 1)
        self.assertEqual(rels[0].relation, "describes")

        slide = SlideIR(slide_id=4, section_id="S4", title="Throughput Benchmarks", elements=elements, relationships=rels)
        doc_ir = DocumentIR(document_id="DOC01", title="Bench Lecture", source_type="pptx", source_filename="bench.pptx", total_slides=1, slides=[slide])

        chunks = self.chunker.chunk_from_document_ir(doc_ir)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].chunk_category, "multimodal")
        self.assertIn("S4_ch", chunks[0].chart_refs)

    def test_case_5_text_plus_diagram(self):
        """CASE 5: Slide có text + diagram."""
        elements = [
            DocumentElement(id="S5_txt", type="text", role="process", reading_order=1, content="The forward pass propagates tensors through convolutional filters.", source_slide=5),
            DocumentElement(id="S5_diag", type="diagram", role="architecture_diagram", reading_order=2, asset_path="assets/cnn_flow.png", caption="Tensor flow diagram", source_slide=5)
        ]
        rels = self.rel_builder.build_slide_relationships(elements)
        self.assertEqual(len(rels), 1)
        self.assertEqual(rels[0].relation, "explains")

        slide = SlideIR(slide_id=5, section_id="S5", title="Tensor Propagation", elements=elements, relationships=rels)
        doc_ir = DocumentIR(document_id="DOC01", title="CNN", source_type="pptx", source_filename="cnn.pptx", total_slides=1, slides=[slide])

        md = self.normalizer.render_from_document_ir(doc_ir)
        self.assertIn("[DIAGRAM: architecture_diagram]", md)
        self.assertIn("[CAPTION]\nTensor flow diagram", md)

    def test_case_6_text_image_table_chart_mixed(self):
        """CASE 6: Slide có text + image + table + chart."""
        elements = [
            DocumentElement(id="S6_txt1", type="text", role="concept", reading_order=1, content="Overview of multi-modal vision models.", source_slide=6),
            DocumentElement(id="S6_img", type="image", role="conceptual_diagram", reading_order=2, caption="ViT Patch Tokenizer", source_slide=6),
            DocumentElement(id="S6_tbl", type="table", role="comparison", reading_order=3, content="| Model | Top-1 |\n| ViT | 88.5 |", source_slide=6),
            DocumentElement(id="S6_ch", type="chart", role="performance_comparison", reading_order=4, caption="Accuracy vs FLOPS", source_slide=6)
        ]
        slide = SlideIR(slide_id=6, section_id="S6", title="Transformer Vision", elements=elements)
        doc_ir = DocumentIR(document_id="DOC01", title="ViT", source_type="pptx", source_filename="vit.pptx", total_slides=1, slides=[slide])

        chunks = self.chunker.chunk_from_document_ir(doc_ir)
        # All 4 elements preserved without loss
        categories = [c.chunk_category for c in chunks]
        self.assertIn("text", categories)
        self.assertIn("visual", categories)
        self.assertIn("table", categories)
        self.assertIn("chart", categories)

    def test_case_7_low_confidence_visual_fallback(self):
        """CASE 7: Visual với classifier confidence thấp (< 0.7 fallback: type=image, không đoán bừa)."""
        el_type, el_role, conf = self.classifier.classify_visual_element("picture 1")
        self.assertEqual(el_type, "image")
        self.assertTrue(conf < 0.70)
        self.assertEqual(el_role, "illustration")  # Safe fallback without hallucinating domain type

    def test_case_8_unextractable_chart_table_zero_hallucination(self):
        """CASE 8: Table/chart không extract được data (data: null, zero hallucination)."""
        chart = StructuredChart(
            chart_id="ch_unextractable",
            chart_type="unknown",
            title="Unreadable Binary Chart",
            data=None  # Zero hallucination guaranteed
        )
        self.assertIsNone(chart.data)
        self.assertEqual(chart.chart_type, "unknown")

        el = DocumentElement(
            id="S8_ch",
            type="chart",
            role="evidence",
            reading_order=1,
            structured_chart=chart,
            caption="Unreadable Chart from binary",
            source_slide=8
        )
        slide = SlideIR(slide_id=8, section_id="S8", title="Raw Chart", elements=[el])
        doc_ir = DocumentIR(document_id="DOC01", title="Chart Demo", source_type="pptx", source_filename="chart.pptx", total_slides=1, slides=[slide])

        chunks = self.chunker.chunk_from_document_ir(doc_ir)
        self.assertEqual(chunks[0].chunk_category, "chart")
        self.assertNotIn("Data: [{'random':", chunks[0].content)

    def test_case_9_multimodal_chunk_relationship_link(self):
        """CASE 9: Multimodal chunk có text + visual relationship (explains)."""
        elements = [
            DocumentElement(id="txt_01", type="text", role="definition", reading_order=1, content="Convolution is defined as a linear sliding filter operation.", source_slide=9),
            DocumentElement(id="img_01", type="diagram", role="architecture_diagram", reading_order=2, caption="3x3 Kernel slide over 6x6 image", source_slide=9)
        ]
        rels = [
            ElementRelationship(source_id="txt_01", target_id="img_01", relation="explains", confidence=0.95)
        ]
        slide = SlideIR(slide_id=9, section_id="S9", title="Kernel Mechanics", elements=elements, relationships=rels)
        doc_ir = DocumentIR(document_id="DOC01", title="CNN", source_type="pptx", source_filename="cnn.pptx", total_slides=1, slides=[slide])

        chunks = self.chunker.chunk_from_document_ir(doc_ir)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].chunk_category, "multimodal")
        self.assertIn("explains", chunks[0].relations)
        self.assertIn("txt_01", chunks[0].text_refs)
        self.assertEqual(chunks[0].visual_refs[0].visual_id, "img_01")

    def test_case_10_trace_semantic_chunk_to_original_element_and_slide(self):
        """CASE 10: Trace từ SemanticChunk về Document IR element và Original Slide."""
        elements = [
            DocumentElement(id="DOC01_S12_el01", type="text", role="concept", reading_order=1, content="YOLO predicts bounding boxes directly.", source_slide=12),
            DocumentElement(id="DOC01_S12_el02", type="image", role="conceptual_diagram", reading_order=2, asset_path="assets/yolo.png", caption="YOLO Pipeline", source_slide=12)
        ]
        rels = self.rel_builder.build_slide_relationships(elements)
        slide = SlideIR(slide_id=12, section_id="S12", title="YOLO Single Stage", elements=elements, relationships=rels)
        doc_ir = DocumentIR(document_id="DOC01", title="Detection", source_type="pptx", source_filename="yolo.pptx", total_slides=1, slides=[slide])

        chunks = self.chunker.chunk_from_document_ir(doc_ir)
        target_chunk = chunks[0]

        # Verify complete provenance traceability
        self.assertEqual(target_chunk.provenance.document_id, "DOC01")
        self.assertEqual(target_chunk.provenance.source_slide, 12)
        self.assertIn("DOC01_S12_el01", target_chunk.provenance.source_element_ids)
        self.assertIn("DOC01_S12_el02", target_chunk.provenance.source_element_ids)

        # Retrieve original elements from DocumentIR
        resolved_elements = [
            el for el in slide.elements if el.id in target_chunk.provenance.source_element_ids
        ]
        self.assertEqual(len(resolved_elements), 2)
        self.assertEqual(resolved_elements[0].content, "YOLO predicts bounding boxes directly.")
        self.assertEqual(resolved_elements[1].caption, "YOLO Pipeline")

if __name__ == "__main__":
    unittest.main()
