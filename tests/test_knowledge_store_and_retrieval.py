# tests/test_knowledge_store_and_retrieval.py
"""
Test Suite for Persistent Document Knowledge Layer, Hybrid Retrieval,
Unicode Preservation, and Security Isolation (Parts 13 to 43).
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.modules.extractor.base import normalize_text_and_symbols, parse_list_item
from app.models.document_ir import (
    DocumentIR,
    SlideIR,
    DocumentElement,
    StructuredDiagram,
    ElementRelationship
)
from app.models.knowledge import (
    DocumentRecord,
    ConceptRecord,
    ChunkRecord,
    RelationRecord
)
from app.database.knowledge_store import KnowledgeStore
from app.services.embedding_provider import EmbeddingProvider
from app.services.query_service import QueryService
from app.modules.extractor.diagram_recognizer import DiagramRecognizer
from app.modules.extractor.relationship_builder import RelationshipBuilder
from app.modules.extractor.normalizer import ContentNormalizer
from app.modules.extractor.chunker import SemanticChunker

class TestKnowledgeStoreAndRetrieval(unittest.TestCase):
    def setUp(self):
        self.embedding_provider = EmbeddingProvider()
        self.store = KnowledgeStore(":memory:", embedding_provider=self.embedding_provider)
        self.query_service = QueryService(self.store)
        self.recognizer = DiagramRecognizer()
        self.rel_builder = RelationshipBuilder()
        self.normalizer = ContentNormalizer()
        self.chunker = SemanticChunker()

    def test_unicode_and_punctuation_preservation(self):
        """PART 7 & 40: Unicode punctuation and numeric ranges must NOT be corrupted."""
        cases = [
            "1–4",
            "5–10",
            "11–16",
            "nose — mũi",
            "COCO — person keypoints",
            "Nguồn: COCO — person keypoints, 17 điểm / 19 cạnh",
            "1–4 mắt trái, mắt phải, tai trái, tai phải",
            "5–10 vai, khuỷu tay, cổ tay (trái rồi phải)",
            "11–16 hông, đầu gối, cổ chân (trái rồi phải)"
        ]
        for c in cases:
            norm = normalize_text_and_symbols(c)
            self.assertEqual(norm, c, f"Failed preserving exact punctuation for: {c}")

        # List item parsing test
        is_list, marker, clean = parse_list_item("■ 0 nose — mũi")
        self.assertTrue(is_list)
        self.assertEqual(marker, "■")
        self.assertEqual(clean, "0 nose — mũi")

        is_list2, marker2, clean2 = parse_list_item("■ 5–10 vai, khuỷu tay, cổ tay")
        self.assertTrue(is_list2)
        self.assertEqual(clean2, "5–10 vai, khuỷu tay, cổ tay")

    def test_end_to_end_acceptance_skeleton_slide(self):
        """
        PART 41 ACCEPTANCE TEST:
        Validates parsing of slide '17 điểm có tên — và 19 đường nối'
        - 1 diagram visual (human_pose_skeleton) with 17 keypoints and 19 edges
        - Annotations 0..16 separated from normal text
        - Explanatory right-side text preserved without corruption
        - Source caption intact
        - Persisted into KnowledgeStore and retrievable via QueryService
        """
        doc_id = "DOC_ACCEPTED_01"
        owner_id = "user_instructor_01"
        slide_title = "17 điểm có tên — và 19 đường nối"

        raw_elements = [
            DocumentElement(
                id="S8_title",
                type="text",
                role="concept",
                reading_order=1,
                content=slide_title,
                raw_text=slide_title,
                layout_region="top_title",
                bbox=[0.05, 0.05, 0.90, 0.15],
                source_slide=8
            ),
            # Left diagram placeholder
            DocumentElement(
                id="S8_vis_pose",
                type="image",
                role="illustration",
                reading_order=2,
                layout_region="left_diagram",
                bbox=[0.05, 0.18, 0.45, 0.85],
                caption="Human pose skeleton graphic",
                source_slide=8
            ),
            # Keypoint numbers 0..16
            *[
                DocumentElement(
                    id=f"S8_kp_{i:02d}",
                    type="text",
                    role="concept",
                    reading_order=3 + i,
                    layout_region="left_diagram",
                    bbox=[0.08, 0.20 + (i * 0.035), 0.12, 0.23 + (i * 0.035)],
                    content=str(i),
                    raw_text=str(i),
                    source_slide=8
                )
                for i in range(17)
            ],
            # Explanatory right side text
            DocumentElement(
                id="S8_exp_intro",
                type="text",
                role="concept",
                reading_order=20,
                layout_region="right_text",
                bbox=[0.50, 0.20, 0.95, 0.26],
                content="Thứ tự cố định, từ đầu xuống chân, trái trước phải sau:",
                raw_text="Thứ tự cố định, từ đầu xuống chân, trái trước phải sau:",
                source_slide=8
            ),
            DocumentElement(
                id="S8_exp_0",
                type="text",
                role="concept",
                reading_order=21,
                layout_region="right_text",
                bbox=[0.50, 0.28, 0.95, 0.35],
                marker="■",
                content="0 nose — mũi",
                raw_text="■ 0 nose — mũi",
                source_slide=8
            ),
            DocumentElement(
                id="S8_exp_1_4",
                type="text",
                role="concept",
                reading_order=22,
                layout_region="right_text",
                bbox=[0.50, 0.38, 0.95, 0.46],
                marker="■",
                content="1–4 mắt trái, mắt phải, tai trái, tai phải",
                raw_text="■ 1–4 mắt trái, mắt phải, tai trái, tai phải",
                source_slide=8
            ),
            DocumentElement(
                id="S8_exp_5_10",
                type="text",
                role="concept",
                reading_order=23,
                layout_region="right_text",
                bbox=[0.50, 0.49, 0.95, 0.58],
                marker="■",
                content="5–10 vai, khuỷu tay, cổ tay (trái rồi phải)",
                raw_text="■ 5–10 vai, khuỷu tay, cổ tay (trái rồi phải)",
                source_slide=8
            ),
            DocumentElement(
                id="S8_exp_11_16",
                type="text",
                role="concept",
                reading_order=24,
                layout_region="right_text",
                bbox=[0.50, 0.61, 0.95, 0.70],
                marker="■",
                content="11–16 hông, đầu gối, cổ chân (trái rồi phải)",
                raw_text="■ 11–16 hông, đầu gối, cổ chân (trái rồi phải)",
                source_slide=8
            ),
            # Source caption at bottom
            DocumentElement(
                id="S8_caption",
                type="text",
                role="reference",
                reading_order=25,
                layout_region="bottom_caption",
                bbox=[0.05, 0.88, 0.95, 0.95],
                content="Nguồn: COCO — person keypoints, 17 điểm / 19 cạnh",
                raw_text="Nguồn: COCO — person keypoints, 17 điểm / 19 cạnh",
                source_slide=8
            )
        ]

        # 1. Analyze with DiagramRecognizer
        analyzed_elements = self.recognizer.analyze_slide(raw_elements, slide_title, 8, doc_id)

        # 2. Assertions on Visual Structure
        diagrams = [e for e in analyzed_elements if e.type == "diagram"]
        self.assertEqual(len(diagrams), 1)
        diag = diagrams[0]
        self.assertEqual(diag.subtype, "human_pose_skeleton")
        self.assertEqual(diag.role, "conceptual_diagram")
        self.assertEqual(diag.structured_diagram.node_count, 17)
        self.assertEqual(diag.structured_diagram.edge_count, 19)

        # 3. Assertions on Annotations: None are in normal text!
        annotations = [e for e in analyzed_elements if e.source_type == "diagram_annotation"]
        self.assertEqual(len(annotations), 17)

        # 4. Assertions on Reading Order: Right-side text is ordered sequentially
        text_elements = [e for e in analyzed_elements if e.type == "text"]
        text_contents = [e.content for e in text_elements]
        self.assertIn("0 nose — mũi", text_contents)
        self.assertIn("1–4 mắt trái, mắt phải, tai trái, tai phải", text_contents)
        self.assertIn("5–10 vai, khuỷu tay, cổ tay (trái rồi phải)", text_contents)
        self.assertIn("11–16 hông, đầu gối, cổ chân (trái rồi phải)", text_contents)
        self.assertIn("Nguồn: COCO — person keypoints, 17 điểm / 19 cạnh", text_contents)

        # No mangled fragments like '51–4' or isolated '–10' or '2 11'
        self.assertNotIn("51–4", " ".join(text_contents))
        self.assertFalse(any(t.startswith("–10") or t.startswith("-10") for t in text_contents))
        self.assertNotIn("2 11", " ".join(text_contents))
        self.assertNotIn("0 9", " ".join(text_contents))

        # 5. Build Relationships
        relationships = self.rel_builder.build_slide_relationships(analyzed_elements)

        # 6. Build DocumentIR & Semantic Chunks
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

        chunks = self.chunker.chunk_from_document_ir(doc_ir)

        # 7. Persist into KnowledgeStore
        self.store.persist_document_ir(doc_ir, owner_id=owner_id)

        # Register domain concepts
        concept_pose = ConceptRecord(
            id="concept_human_pose",
            name="Human Pose Skeleton",
            description="Human body pose estimation consisting of 17 keypoints and 19 anatomical connections.",
            owner_id=owner_id,
            document_id=doc_id,
            slide_ids=[8]
        )
        concept_kp0 = ConceptRecord(
            id="concept_kp0_nose",
            name="Keypoint 0 Nose",
            description="Keypoint 0 represents the human nose (mũi).",
            owner_id=owner_id,
            document_id=doc_id,
            slide_ids=[8]
        )
        self.store.save_concept(concept_pose)
        self.store.save_concept(concept_kp0)

        # Save semantic chunks
        chunk_records = [
            ChunkRecord(
                id=c.chunk_id,
                document_id=doc_id,
                owner_id=owner_id,
                slide_id=8,
                chunk_type=c.chunk_category if c.chunk_category in ("text", "visual", "table", "chart", "multimodal") else "text",
                content=c.content,
                source_element_ids=c.text_refs + [v.visual_id for v in c.visual_refs],
                visual_refs=[v.visual_id for v in c.visual_refs]
            )
            for c in chunks
        ]
        self.store.save_chunks(chunk_records)

        # 8. Test Hybrid Queries (Parts 23 & 43)

        # QUERY 1: Tìm hình minh họa về human pose
        q1_res = self.query_service.query(
            document_id=doc_id,
            owner_id=owner_id,
            query_text="Tìm hình minh họa về human pose",
            intent="FIND_VISUAL"
        )
        self.assertTrue(len(q1_res["visuals"]) >= 1)
        self.assertEqual(q1_res["visuals"][0]["subtype"], "human_pose_skeleton")

        # QUERY 2: Keypoint 0 là gì?
        q2_res = self.query_service.query(
            document_id=doc_id,
            owner_id=owner_id,
            query_text="Keypoint 0 là gì?",
            intent="FIND_CONCEPT"
        )
        self.assertTrue(len(q2_res["concepts"]) >= 1)
        self.assertIn("nose", q2_res["concepts"][0]["description"].lower())

        # QUERY 3: Slide nào giải thích 17 keypoints?
        q3_res = self.query_service.query(
            document_id=doc_id,
            owner_id=owner_id,
            query_text="Slide nào giải thích 17 keypoints?",
            intent="FIND_SLIDES"
        )
        self.assertTrue(len(q3_res["results"]) >= 1)
        self.assertEqual(q3_res["results"][0]["slide_id"], 8)

        # 9. Test Provenance Traceability (Part 11)
        first_chunk_id = chunk_records[0].id
        provenance = self.store.resolve_provenance(first_chunk_id, owner_id)
        self.assertIsNotNone(provenance)
        self.assertEqual(provenance["document"]["id"], doc_id)
        self.assertEqual(provenance["slide"]["slide_number"], 8)
        self.assertTrue(len(provenance["source_elements"]) >= 1)

    def test_database_security_user_isolation(self):
        """PART 31: User A must never access User B's documents or chunks."""
        # Create doc for user A
        doc_a = DocumentRecord(
            id="DOC_USER_A",
            owner_id="user_alice",
            file_name="alice_notes.pptx",
            file_hash="hash_a"
        )
        self.store.save_document(doc_a)

        # Alice retrieves -> OK
        retrieved_alice = self.store.get_document("DOC_USER_A", owner_id="user_alice")
        self.assertIsNotNone(retrieved_alice)

        # Bob attempts retrieve Alice's doc -> Access Denied / None
        retrieved_bob = self.store.get_document("DOC_USER_A", owner_id="user_bob")
        self.assertIsNone(retrieved_bob)

        # Query service denies unauthorized user
        query_bob = self.query_service.query("DOC_USER_A", "user_bob", "What is inside?")
        self.assertEqual(query_bob.get("status"), "unauthorized")

if __name__ == "__main__":
    unittest.main()
