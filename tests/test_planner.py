# tests/test_planner.py
import unittest
from app.modules.extractor import extract_document
from app.modules.planner import InstructionalPlanner
from app.models.config import PipelineConfig, PresentationConfig, LearnerPersona

class TestInstructionalPlanner(unittest.TestCase):
    def setUp(self):
        self.md_content = """# Intro to Neural Networks
Foundations of deep learning.
## Activation Functions
Non-linear mappings like ReLU.
## Optimization & Gradient Descent
Backpropagation mechanics.
## Synthesis & Practical Takeaways
Summary of best practices.
"""
        self.tree = extract_document(self.md_content.encode("utf-8"), "neural_nets.md")
        self.planner = InstructionalPlanner()

    def test_blueprint_generation(self):
        config = PipelineConfig(
            presentation=PresentationConfig(target_duration_sec=180, pacing="normal", baseline_wpm=140)
        )
        bp = self.planner.plan(self.tree, config)

        self.assertEqual(bp.total_target_duration_sec, 180)
        self.assertEqual(len(bp.sections), 4)
        
        # Check that sum of section durations equals 180 exactly
        section_durations = [s.target_duration_sec for s in bp.sections]
        self.assertEqual(sum(section_durations), 180)

        # Check pedagogical functions
        self.assertEqual(bp.sections[0].pedagogical_function, "hook")
        self.assertEqual(bp.sections[-1].pedagogical_function, "summary")

if __name__ == "__main__":
    unittest.main()
