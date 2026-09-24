# tests/test_extractor.py
import unittest
from pathlib import Path
from app.modules.extractor import extract_document, MarkdownExtractor, PPTXExtractor
from app.models.document import CanonicalDocumentTree

class TestExtractors(unittest.TestCase):
    def test_markdown_extractor(self):
        md_content = """# Deep Learning Overview
Introduction to artificial neural networks and optimization.

## Convolutional Neural Networks
- Sparse connectivity
- Parameter sharing
- Translation equivariance

```python
import torch
conv = torch.nn.Conv2d(3, 16, kernel_size=3)
```
"""
        tree = extract_document(md_content.encode("utf-8"), "deep_learning.md")
        self.assertIsInstance(tree, CanonicalDocumentTree)
        self.assertEqual(tree.total_sections, 2)
        self.assertEqual(tree.sections[0].title, "Deep Learning Overview")
        self.assertEqual(tree.sections[1].title, "Convolutional Neural Networks")
        self.assertTrue(tree.extraction_time_ms >= 0.0)
        # Verify Canonical Intermediate Representation
        self.assertTrue(len(tree.canonical_markdown) > 0)
        self.assertIn("slide_id: 1", tree.canonical_markdown)
        self.assertIn("[TEXT:", tree.canonical_markdown)
        # Verify Semantic Chunks
        self.assertTrue(len(tree.semantic_chunks) > 0)
        for chunk in tree.semantic_chunks:
            self.assertTrue(chunk.chunk_id.startswith(f"{tree.document_id}-S"))
            self.assertEqual(chunk.document_id, tree.document_id)
            self.assertIsNotNone(chunk.provenance)
            self.assertTrue(chunk.word_count > 0)

    def test_demo_pptx_extractor(self):
        demo_pptx = Path("app/data/intro_to_cnn.pptx")
        if demo_pptx.exists():
            tree = extract_document(demo_pptx, "intro_to_cnn.pptx")
            self.assertEqual(tree.source_type, "pptx")
            self.assertEqual(tree.total_sections, 5)
            self.assertEqual(tree.sections[0].title, "Introduction to Convolutional Neural Networks")
            self.assertTrue(len(tree.sections[0].elements) > 0)
            # Verify multimodal enhancements
            self.assertTrue(len(tree.canonical_markdown) > 0)
            self.assertTrue(len(tree.semantic_chunks) >= 5)
            self.assertIn(tree.semantic_chunks[0].chunk_type, [
                "definition", "concept", "mechanism", "example", "comparison", "code_walkthrough", "mathematical_proof", "summary", "speaker_note", "visual_explanation"
            ])

if __name__ == "__main__":
    unittest.main()
