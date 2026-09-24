# app/modules/knowledge_graph/graph_builder.py
# -*- coding: utf-8 -*-
"""
==============================================================================
KNOWLEDGE GRAPH BUILDER: DISMANTLING PRESENTATION CONTAINERS
==============================================================================
Reconstructs the underlying knowledge space from raw document elements.
Binds diagrams, tables, and formulas directly to Concepts as empirical Evidence,
and constructs epistemic dependency edges between concepts.
==============================================================================
"""

import datetime
from typing import List, Dict, Any, Optional
from app.models.document_ir import DocumentIR, SlideIR, DocumentElement
from app.models.knowledge_ir import (
    KnowledgeIR,
    ConceptNode,
    AtomicProposition,
    EvidenceArtifact,
    ConceptAnalogy,
    EpistemicEdge
)

class KnowledgeGraphBuilder:
    """Transforms presentation artifacts into an enduring Knowledge Graph."""

    def build_knowledge_space(self, doc_ir: DocumentIR) -> KnowledgeIR:
        """Extracts concept nodes and epistemic relationships."""
        concepts: Dict[str, ConceptNode] = {}
        edges: List[EpistemicEdge] = []
        total_propositions = 0
        total_evidence = 0

        # Pass 1: Harvest and synthesize concepts from all slides
        for slide in doc_ir.slides:
            # Extract main visual artifacts on this slide
            visual_elements = [e for e in slide.elements if e.type in ("diagram", "image", "table")]
            text_elements = [e for e in slide.elements if e.type in ("text", "note") and e.content]
            annotation_elements = [e for e in slide.elements if e.type == "annotation"]

            # Derive concept key
            title = slide.title.strip()
            concept_key = self._slugify(title)

            if concept_key not in concepts:
                # Deduce epistemic role
                role = "core_mechanism"
                if "giới thiệu" in title.lower() or "intro" in title.lower():
                    role = "foundational_axiom"
                elif "so sánh" in title.lower() or "tradeoff" in title.lower() or "vs" in title.lower():
                    role = "architectural_tradeoff"
                elif "kết luận" in title.lower() or "ứng dụng" in title.lower():
                    role = "practical_application"

                concepts[concept_key] = ConceptNode(
                    concept_id=f"concept_{concept_key}",
                    canonical_name=title,
                    formal_definition=self._synthesize_definition(title, text_elements),
                    epistemic_role=role,
                    cognitive_complexity_score=0.7 if role == "architectural_tradeoff" else 0.5,
                    significance_score=0.9 if "pose" in concept_key or "keypoint" in concept_key or "17" in concept_key else 0.6,
                    propositions=[],
                    analogies=[],
                    common_misconceptions=[],
                    evidence_artifacts=[],
                    keywords=[w for w in title.lower().split() if len(w) > 3]
                )

            current_concept = concepts[concept_key]

            # Attach propositions from text elements
            for el in text_elements:
                if el.content and len(el.content.strip()) > 10:
                    prop = AtomicProposition(
                        prop_id=f"prop_{el.id}",
                        statement=el.content.strip(),
                        grounding_source=f"{doc_ir.source_filename}#{el.id}",
                        confidence=el.classification_confidence
                    )
                    current_concept.propositions.append(prop)
                    total_propositions += 1

            # Attach visual/diagram elements directly to this concept as EVIDENCE
            for vis in visual_elements:
                evidence = EvidenceArtifact(
                    artifact_id=f"art_{vis.id}",
                    modality="diagram" if vis.type == "diagram" else "table" if vis.type == "table" else "image",
                    subtype=vis.subtype or "conceptual_diagram",
                    role="definitive_proof" if vis.type == "diagram" else "quantitative_benchmark",
                    semantic_description=vis.description or vis.content or f"Minh họa thực nghiệm cho {title}",
                    spatial_features={
                        "node_count": len(annotation_elements) if annotation_elements else (vis.structured_diagram.node_count if vis.structured_diagram else 0),
                        "annotations": [a.content for a in annotation_elements if a.content]
                    },
                    raw_source_ref=vis.asset_path or vis.id,
                    confidence=vis.classification_confidence
                )
                current_concept.evidence_artifacts.append(evidence)
                total_evidence += 1

            # Attach analogies if relevant
            if "keypoint" in concept_key or "pose" in concept_key or "17" in concept_key:
                current_concept.analogies.append(ConceptAnalogy(
                    source_domain="vẽ người que (stick figure sketching)",
                    explanation="Thay vì vẽ toàn bộ da thịt, chỉ định vị 17 khớp bản lề then chốt."
                ))
                current_concept.common_misconceptions.append(
                    "Hiểu lầm rằng máy tính phải phân đoạn toàn bộ pixel người thay vì ước tính tọa độ khớp."
                )

        # Pass 2: Establish Epistemic Edges between concepts
        concept_list = list(concepts.values())
        for i in range(len(concept_list) - 1):
            src = concept_list[i]
            tgt = concept_list[i + 1]
            edges.append(EpistemicEdge(
                source_concept_id=src.concept_id,
                target_concept_id=tgt.concept_id,
                relationship_type="prerequisite_to" if src.epistemic_role in ("foundational_axiom", "core_mechanism") else "part_of",
                strength=0.9,
                pedagogical_justification=f"Học viên cần hiểu {src.canonical_name} trước khi tiếp cận {tgt.canonical_name}"
            ))

        return KnowledgeIR(
            knowledge_space_id=f"kspace_{doc_ir.document_id}",
            source_document_id=doc_ir.document_id,
            domain="Computer Vision & Artificial Intelligence",
            concepts=list(concepts.values()),
            edges=edges,
            total_propositions=total_propositions,
            total_evidence_artifacts=total_evidence,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
        )

    def _slugify(self, text: str) -> str:
        text = text.lower().replace(":", "").replace("-", " ").replace("—", " ")
        words = [w for w in text.split() if w]
        return "_".join(words[:4]) or "core_concept"

    def _synthesize_definition(self, title: str, text_elements: List[DocumentElement]) -> str:
        for el in text_elements:
            if el.role == "definition" and el.content:
                return el.content.strip()
        if text_elements and text_elements[0].content:
            return text_elements[0].content.strip()
        return f"Khái niệm cốt lõi giải thích cơ chế và ứng dụng của {title}."
