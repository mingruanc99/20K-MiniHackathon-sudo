# app/models/knowledge.py
"""
Data models for the Persistent Document Knowledge Layer.
Supports:
- Document & Version registry with owner_id user isolation
- Slide, Element, and Visual entities
- Concepts & Hierarchical Taxonomy
- Typed Semantic Chunks with embeddings
- Directional Semantic Relationships
- Processing Runs & Reproducibility
"""
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone
from pydantic import BaseModel, Field

class ConceptRecord(BaseModel):
    id: str = Field(description="Unique concept ID, e.g. concept_human_pose")
    name: str = Field(description="Canonical concept name, e.g. 'Human Pose Keypoints'")
    type: str = Field(default="domain_concept", description="domain_concept | entity | metric | algorithm")
    description: str = Field(default="", description="Pedagogical definition or explanation of the concept")
    owner_id: str = Field(default="system", description="Owner ID for tenant isolation")
    document_id: Optional[str] = None
    slide_ids: List[int] = Field(default_factory=list)
    element_ids: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    embedding: Optional[List[float]] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class VisualRecord(BaseModel):
    id: str = Field(description="Visual identifier, e.g. vis_DOC01_S08_01")
    element_id: str = Field(description="Parent DocumentElement ID")
    slide_id: int
    document_id: str
    owner_id: str = "system"
    type: str = "diagram"  # diagram | image | chart | table
    subtype: str = "unknown"  # human_pose_skeleton | flowchart | architecture_diagram | unknown
    role: str = "conceptual_diagram"
    description: str = ""
    asset_url: Optional[str] = None
    public_id: Optional[str] = None
    bbox: Optional[List[float]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = 1.0
    embedding: Optional[List[float]] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ChunkRecord(BaseModel):
    id: str = Field(description="Chunk ID, e.g. CHK_DOC01_S08_01")
    document_id: str
    owner_id: str = "system"
    slide_id: int
    chunk_type: Literal["text", "visual", "table", "chart", "diagram", "multimodal"] = "text"
    content: str
    source_element_ids: List[str] = Field(default_factory=list)
    visual_refs: List[str] = Field(default_factory=list)
    concept_refs: List[str] = Field(default_factory=list)
    relations: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    embedding: Optional[List[float]] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class RelationRecord(BaseModel):
    id: str = Field(description="Unique relationship ID, e.g. rel_01")
    document_id: str
    owner_id: str = "system"
    source_type: str = "element"  # element | visual | concept | slide | chunk
    source_id: str
    target_type: str = "element"  # element | visual | concept | slide | chunk
    target_id: str
    relation_type: str  # explains | annotates | represents | based_on | contains | defines
    confidence: float = 1.0
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class DocumentRecord(BaseModel):
    id: str
    owner_id: str = Field(description="Owner ID for strict user isolation")
    file_name: str
    file_type: str = "pptx"
    file_hash: str
    storage_url: Optional[str] = None
    version: int = 1
    parser_version: str = "v2.0-multimodal"
    schema_version: str = "v2.0"
    embedding_model: str = "text-embedding-3-small"
    status: Literal["processing", "completed", "failed"] = "completed"
    total_slides: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: Dict[str, Any] = Field(default_factory=dict)

class ProcessingRunRecord(BaseModel):
    run_id: str
    document_id: str
    owner_id: str = "system"
    parser_version: str = "v2.0-multimodal"
    schema_version: str = "v2.0"
    embedding_model: str = "text-embedding-3-small"
    status: Literal["started", "running", "completed", "failed"] = "completed"
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    errors: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
