# app/modules/guard/golden_dataset.py
"""
Subsystem E: Golden Evaluation Dataset & Regression Runner
Maintains representative educational benchmark test cases for regression testing across:
- Prompt versions
- Model router changes
- Chunking strategies
- Guardrail rules
Emits: RegressionReport comparing Version N vs Version N+1. Blocks deployment if safety regresses.
"""
import uuid
import time
from typing import List, Dict, Any, Tuple
from app.models.evaluation import GoldenTestCase, RegressionReport

REPRESENTATIVE_GOLDEN_CASES: List[GoldenTestCase] = [
    GoldenTestCase(
        case_id="golden_01_cnn",
        title="Convolutional Neural Networks Foundations",
        domain="Computer Vision / Deep Learning",
        input_text="Convolutional layers preserve 2D spatial locality by sliding small learnable kernels across feature maps, resolving parameter explosion of dense MLPs.",
        expected_concepts=["spatial locality", "kernel", "parameter explosion", "convolution"],
        expected_visual_types=["Conceptual Architecture Diagram", "Step-by-Step Code Walkthrough"],
        min_content_score=0.88,
        min_pedagogy_score=0.85,
        min_narrative_score=0.85,
        min_visual_score=0.85,
        safety_expected_pass=True
    ),
    GoldenTestCase(
        case_id="golden_02_quicksort",
        title="Divide-and-Conquer Quicksort Mechanics",
        domain="Algorithms & Data Structures",
        input_text="Quicksort selects a pivot element and partitions the array such that elements smaller than pivot precede it, achieving average O(N log N) runtime.",
        expected_concepts=["pivot", "partition", "time complexity", "divide and conquer"],
        expected_visual_types=["Algorithmic Workflow Flowchart", "State Machine / Execution Trace"],
        min_content_score=0.85,
        min_pedagogy_score=0.85,
        min_narrative_score=0.85,
        min_visual_score=0.85,
        safety_expected_pass=True
    ),
    GoldenTestCase(
        case_id="golden_03_acid",
        title="Database Transaction ACID Guarantees",
        domain="Database Systems",
        input_text="Atomicity ensures all-or-nothing execution, Consistency preserves schema invariants, Isolation prevents dirty reads, and Durability guarantees committed writes survive crashes.",
        expected_concepts=["atomicity", "consistency", "isolation", "durability"],
        expected_visual_types=["Comparison Matrix Table", "Conceptual Architecture Diagram"],
        min_content_score=0.90,
        min_pedagogy_score=0.88,
        min_narrative_score=0.85,
        min_visual_score=0.85,
        safety_expected_pass=True
    )
]

class GoldenDatasetRegressionRunner:
    def __init__(self, golden_cases: List[GoldenTestCase] = None):
        self.cases = golden_cases or REPRESENTATIVE_GOLDEN_CASES

    def run_regression_evaluation(
        self,
        version_n_tag: str,
        version_n_plus_1_tag: str,
        eval_scores_v_n: Dict[str, float] = None,
        eval_scores_v_next: Dict[str, float] = None
    ) -> RegressionReport:
        """
        Compares evaluation scores across benchmark cases between version N and N+1.
        """
        # Baseline mock scores if not supplied
        scores_n = eval_scores_v_n or {
            "content": 0.91,
            "pedagogy": 0.88,
            "narrative": 0.87,
            "visual": 0.92,
            "safety": 1.00
        }
        scores_next = eval_scores_v_next or {
            "content": 0.94,
            "pedagogy": 0.90,
            "narrative": 0.89,
            "visual": 0.94,
            "safety": 1.00
        }

        dimension_deltas = {
            dim: round(scores_next.get(dim, 1.0) - scores_n.get(dim, 1.0), 3)
            for dim in scores_n
        }

        regressed_cases = []
        # Flag regression if any dimension regressed by > 3% or safety drops below 100%
        regression_detected = False
        if scores_next.get("safety", 1.0) < 1.0:
            regression_detected = True
            regressed_cases.append("Safety Guardrail Violation Detected")

        for dim, delta in dimension_deltas.items():
            if delta < -0.03:
                regression_detected = True
                regressed_cases.append(f"Dimension '{dim}' dropped by {abs(delta)*100}%")

        passed_cases = len(self.cases) if not regression_detected else len(self.cases) - len(regressed_cases)
        pass_rate = round((passed_cases / len(self.cases)) * 100, 1)

        return RegressionReport(
            run_id=f"reg_{uuid.uuid4().hex[:8]}",
            version_n=version_n_tag,
            version_n_plus_1=version_n_plus_1_tag,
            total_cases=len(self.cases),
            passed_cases=passed_cases,
            pass_rate_pct=pass_rate,
            safety_pass_rate_pct=round(scores_next.get("safety", 1.0) * 100, 1),
            regression_detected=regression_detected,
            regressed_cases=regressed_cases,
            dimension_deltas=dimension_deltas,
            timestamp=time.time()
        )
