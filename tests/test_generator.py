# tests/test_generator.py
import unittest
from app.modules.extractor import extract_document
from app.modules.planner import InstructionalPlanner
from app.modules.generator import ExpressionGenerator, ProsodyPausePlanner, VisualIntentGenerator
from app.models.config import PipelineConfig

class TestExpressionGenerator(unittest.TestCase):
    def setUp(self):
        self.md_content = """# Title
Intro
## Convolutional Layer
Kernel weights sliding across image tensors.
"""
        self.tree = extract_document(self.md_content.encode("utf-8"), "test.md")
        self.config = PipelineConfig()
        self.bp = InstructionalPlanner().plan(self.tree, self.config)
        self.generator = ExpressionGenerator()

    def test_draft_generation_and_ssml(self):
        draft = self.generator.generate_draft(self.bp, self.tree, self.config)
        self.assertEqual(len(draft.scenes), 2)

        for scene in draft.scenes:
            # 3A check
            self.assertTrue(len(scene.narration_text) > 20)
            self.assertTrue(scene.word_count > 0)

            # 3B Prosody check
            plan = scene.prosody_plan
            self.assertTrue(plan.total_pause_sec > 0.0)
            self.assertTrue(plan.ssml_full.startswith("<speak"))
            self.assertTrue(plan.ssml_full.endswith("</speak>"))
            self.assertIn("<break time=", plan.ssml_full)

            # 3C Visual Taxonomy check
            self.assertTrue(len(scene.visual_cues) > 0)
            for cue in scene.visual_cues:
                self.assertIn(cue.taxonomy_type, VisualIntentGenerator.VALID_TAXONOMIES)
                self.assertTrue(len(cue.necessity_justification) > 10)
                self.assertTrue(cue.trigger_timestamp_sec >= 0.0)

if __name__ == "__main__":
    unittest.main()
