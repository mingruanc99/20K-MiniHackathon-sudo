# tests/test_orchestrator.py
import unittest
from pathlib import Path
from app.core.orchestrator import PipelineOrchestrator
from app.models.config import PipelineConfig

class TestPipelineOrchestrator(unittest.TestCase):
    def test_full_pipeline_run(self):
        demo_pptx = Path("app/data/intro_to_cnn.pptx")
        self.assertTrue(demo_pptx.exists(), "Demo PPTX file must exist")

        orchestrator = PipelineOrchestrator()
        result = orchestrator.run_full_pipeline(demo_pptx, "intro_to_cnn.pptx", PipelineConfig())

        self.assertIn("document_tree", result)
        self.assertIn("blueprint", result)
        self.assertIn("draft", result)
        self.assertIn("quality_report", result)
        self.assertIn("verified_ir", result)
        self.assertIn("export_package", result)
        self.assertIn("trace_logs", result)

        ir = result["verified_ir"]
        self.assertEqual(ir["total_scenes"], 5)
        self.assertTrue(ir["total_duration_sec"] > 0)

        # Check export formats
        formats = result["export_package"]["formats"]
        self.assertIn("clsg_json", formats)
        self.assertIn("remotion_props", formats)
        self.assertIn("manim_code", formats)
        self.assertIn("ssml_bundle", formats)

if __name__ == "__main__":
    unittest.main()
