# tests/test_guard.py
import unittest
from app.modules.extractor import extract_document
from app.modules.planner import InstructionalPlanner
from app.modules.generator import ExpressionGenerator
from app.modules.guard import QualityVisualGuard
from app.models.config import PipelineConfig

class TestQualityVisualGuard(unittest.TestCase):
    def test_guard_certification_and_darp(self):
        md_content = """# Deep Learning
Foundations.
## Convolution Operations
Mechanics of CNNs.
## Pooling & Invariance
Downsampling operations.
"""
        tree = extract_document(md_content.encode("utf-8"), "dl.md")
        config = PipelineConfig()
        bp = InstructionalPlanner().plan(tree, config)
        draft = ExpressionGenerator().generate_draft(bp, tree, config)
        
        guard = QualityVisualGuard()
        report, verified_ir = guard.validate_and_certify(draft, bp, tree, config)

        self.assertIn(report.overall_status, ["PASSED", "WARNING"])
        self.assertTrue(report.overall_quality_score >= 0.70)
        self.assertTrue(report.dar_p_ratio >= 0.0)
        self.assertTrue(report.content_fidelity_score >= 0.80)
        self.assertTrue(report.text_visual_consistency_score >= 0.80)
        self.assertTrue(report.provenance_traceability_score >= 0.90)
        self.assertEqual(verified_ir.total_scenes, len(draft.scenes))
        self.assertEqual(len(verified_ir.scenes), 3)
        self.assertIsNotNone(verified_ir.scenes[0].provenance_trace)
        self.assertEqual(verified_ir.scenes[0].provenance_trace.source_slide, 1)

if __name__ == "__main__":
    unittest.main()
