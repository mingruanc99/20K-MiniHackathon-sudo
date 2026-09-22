# app/modules/generator/visual.py
"""
Module 3C: Visual Intent Generator
Generates instructional visual events strictly categorized into the 13 Canonical Visual Taxonomies.
Synchronizes visual triggers precisely to prosody timeline timestamps.
"""
import uuid
from typing import List, Dict, Any
from app.models.blueprint import SectionPlan
from app.models.expression import VisualCue, ProsodyPlan, VisualTaxonomy, VisualAction
from app.models.config import PipelineConfig

class VisualIntentGenerator:
    VALID_TAXONOMIES: List[VisualTaxonomy] = [
        "Diagram Animation",
        "Step-by-Step Code Walkthrough",
        "Mathematical Derivation Step",
        "Geometric Spatial Transform",
        "Timeline Progression",
        "Data Chart Dynamic Trend",
        "Concept Map Linkage",
        "Physical World Metaphor",
        "Architectural Block Highlight",
        "Code Execution Trace",
        "Component Zoom-in",
        "Morphing Transition",
        "Side-by-Side Comparison"
    ]

    def generate_visual_cues(
        self,
        plan: SectionPlan,
        prosody_plan: ProsodyPlan,
        config: PipelineConfig
    ) -> List[VisualCue]:
        cues: List[VisualCue] = []
        sentences = prosody_plan.sentences
        cumulative_time = 0.0

        for s_idx, sentence in enumerate(sentences):
            s_duration = sentence.estimated_speaking_time_sec + sentence.estimated_pause_time_sec
            s_text = sentence.text.lower()

            # Rule-based taxonomy selection based on pedagogical function and sentence content
            cue_specs = self._select_cues_for_sentence(s_text, plan.pedagogical_function, s_idx, len(sentences))
            
            for offset_ratio, taxonomy, target, action, desc, just, hints in cue_specs:
                timestamp = cumulative_time + (s_duration * offset_ratio)
                cue_id = f"vc_{plan.section_id}_{uuid.uuid4().hex[:6]}"
                
                cues.append(VisualCue(
                    cue_id=cue_id,
                    section_id=plan.section_id,
                    trigger_timestamp_sec=round(timestamp, 2),
                    trigger_word=target.split()[0] if target else None,
                    taxonomy_type=taxonomy,
                    element_target=target,
                    action=action,
                    visual_description=desc,
                    necessity_justification=just,
                    renderer_hints=hints
                ))

            cumulative_time += s_duration

        return cues

    def _select_cues_for_sentence(
        self,
        sentence_lower: str,
        role: str,
        s_idx: int,
        total_s: int
    ) -> List[tuple]:
        specs = []

        if "flattening" in sentence_lower or "parameter explosion" in sentence_lower or "120 million" in sentence_lower:
            specs.append((
                0.25,
                "Side-by-Side Comparison",
                "dense_mlp_vs_cnn_receptive_field",
                "transform",
                "Render side-by-side comparison: left panel displays dense 120M weight connection matrix; right panel highlights compact 3x3 shared kernel.",
                "Demonstrates the catastrophic parameter explosion of dense layers vs parameter sharing in CNNs.",
                {"left_label": "Dense MLP (120M weights)", "right_label": "Conv Kernel (9 weights)", "color": "#EF4444"}
            ))
        elif "kernel" in sentence_lower or "convolution" in sentence_lower or "slides smoothly" in sentence_lower:
            specs.append((
                0.20,
                "Geometric Spatial Transform",
                "kernel_convolution_sliding_window",
                "draw",
                "Animate 3x3 kernel moving across 6x6 input tensor matrix with step-by-step dot product accumulation.",
                "Visually grounds the spatial locality and sliding window mechanics in 2D space.",
                {"manim_class": "MatrixConvolveAnimation", "stride": 1, "kernel_size": [3, 3]}
            ))
        elif "pooling" in sentence_lower or "max pooling" in sentence_lower or "downsampling" in sentence_lower:
            specs.append((
                0.30,
                "Component Zoom-in",
                "max_pooling_window_2x2",
                "zoom",
                "Zoom in on 2x2 window: highlight maximum pixel value (e.g. 0.85) and transfer to downsampled feature map.",
                "Clarifies non-linear reduction and translation invariance properties of max-pooling.",
                {"window_size": [2, 2], "operation": "MAX", "highlight_color": "#10B981"}
            ))
        elif "autonomous vehicle" in sentence_lower or "vision" in sentence_lower or "pixel grids" in sentence_lower:
            specs.append((
                0.15,
                "Physical World Metaphor",
                "camera_hud_object_detection_bounding_boxes",
                "overlay",
                "Display autonomous driving camera feed with dynamic green bounding boxes locking onto pedestrians and lane lines.",
                "Builds high-impact motivational intuition and connects theoretical pixels to physical world perception.",
                {"asset_type": "hud_overlay", "theme": "cyber_teal"}
            ))
        elif "architecture" in sentence_lower or "summary" in sentence_lower or "hierarchical" in sentence_lower:
            specs.append((
                0.20,
                "Architectural Block Highlight",
                "full_cnn_pipeline_stage_flow",
                "pulse",
                "Highlight full end-to-end architecture: Input -> Conv2D -> ReLU -> MaxPool -> Dense -> Softmax with glowing data packets.",
                "Synthesizes structural dependencies across complete neural pipeline.",
                {"active_stage": "All", "glow": True, "fps": 60}
            ))
        else:
            # General fallback based on pedagogical role
            if role == "mechanism":
                specs.append((
                    0.25,
                    "Diagram Animation",
                    f"concept_mechanism_diagram_{s_idx}",
                    "highlight",
                    "Animate dynamic flow diagram illustrating data tensor transformation and node state update.",
                    "Provides visual anchoring for abstract algorithmic operations.",
                    {"color": "#3B82F6", "type": "flowchart"}
                ))
            elif role == "example":
                specs.append((
                    0.30,
                    "Step-by-Step Code Walkthrough",
                    f"code_snippet_execution_{s_idx}",
                    "reveal",
                    "Highlight progressive line execution of PyTorch nn.Conv2d tensor forward pass.",
                    "Connects conceptual theory to concrete programming implementation.",
                    {"syntax": "python", "framework": "PyTorch"}
                ))
            else:
                specs.append((
                    0.20,
                    "Concept Map Linkage",
                    f"concept_link_{s_idx}",
                    "reveal",
                    "Display conceptual graph linking prerequisite knowledge nodes to current learning objective.",
                    "Enhances cognitive schema integration for the learner.",
                    {"nodes": ["Input", "Transformation", "Output"]}
                ))

        return specs
