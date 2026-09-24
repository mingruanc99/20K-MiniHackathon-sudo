# app/models/knowledge_ir.py
# -*- coding: utf-8 -*-
"""
==============================================================================
KNOWLEDGE IR: FIRST-PRINCIPLES KNOWLEDGE SPACE REPRESENTATION
==============================================================================
Completely decouples knowledge representation from physical presentation containers (slides/pages).
Concepts are first-class citizens; visuals, formulas, and code snippets are empirical EVIDENCE
attached directly to concepts, not to slides.
==============================================================================
"""

from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field

EpistemicRole = Literal[
    "foundational_axiom",
    "core_mechanism",
    "architectural_tradeoff",
    "empirical_proof",
    "edge_case_limitation",
    "practical_application"
]

class AtomicProposition(BaseModel):
    """An indivisible statement of truth grounded in source materials."""
    prop_id: str
    statement: str = Field(..., description="Atomic factual proposition")
    grounding_source: str = Field(..., description="Provenance trace, e.g. file#shape_id")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)

class EvidenceArtifact(BaseModel):
    """Visual diagram, table, code block, or formula bound to a concept as empirical proof."""
    artifact_id: str
    modality: Literal["diagram", "image", "table", "formula", "code_snippet"]
    subtype: str = Field(default="unknown", description="e.g. human_pose_skeleton, matrix_heatmap")
    role: Literal["definitive_proof", "intuitive_illustration", "quantitative_benchmark", "structural_specification"]
    semantic_description: str = Field(..., description="What this evidence proves or demonstrates")
    spatial_features: Dict[str, Any] = Field(default_factory=dict, description="Nodes, edges, keypoints, or table headers")
    raw_source_ref: str = Field(..., description="Original artifact identifier or asset path")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)

class ConceptAnalogy(BaseModel):
    """Metaphorical mapping from everyday intuition to technical concept."""
    source_domain: str
    explanation: str

class ConceptNode(BaseModel):
    """A distinct cognitive unit of knowledge in the domain."""
    concept_id: str
    canonical_name: str
    formal_definition: str
    epistemic_role: EpistemicRole = "core_mechanism"
    cognitive_complexity_score: float = Field(0.5, ge=0.0, le=1.0, description="Inherent cognitive demand")
    significance_score: float = Field(0.8, ge=0.0, le=1.0, description="Centrality to understanding domain")
    propositions: List[AtomicProposition] = Field(default_factory=list)
    analogies: List[ConceptAnalogy] = Field(default_factory=list)
    common_misconceptions: List[str] = Field(default_factory=list)
    evidence_artifacts: List[EvidenceArtifact] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)

class EpistemicEdge(BaseModel):
    """Directed pedagogical or logical relationship between two concepts."""
    source_concept_id: str
    target_concept_id: str
    relationship_type: Literal[
        "prerequisite_to",
        "proves",
        "part_of",
        "isomorphic_to",
        "contrasts_with",
        "operationalized_by"
    ]
    strength: float = Field(default=1.0, ge=0.0, le=1.0)
    pedagogical_justification: Optional[str] = None

class KnowledgeIR(BaseModel):
    """Complete, presentation-agnostic knowledge space."""
    knowledge_space_id: str
    source_document_id: str
    domain: str = "Computer Science & AI"
    concepts: List[ConceptNode] = Field(default_factory=list)
    edges: List[EpistemicEdge] = Field(default_factory=list)
    total_propositions: int = 0
    total_evidence_artifacts: int = 0
    created_at: str = Field(..., description="ISO timestamp")
