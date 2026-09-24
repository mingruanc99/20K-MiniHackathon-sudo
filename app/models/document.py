# app/models/document.py
"""
Data models for Module 1: Canonical Document Tree
Rule-based document structure representation without VLM/OCR dependencies.
"""
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

VisualRoleType = Literal[
    "Architecture Diagram",
    "Flowchart",
    "Data Chart",
    "Code Snippet",
    "Formula/Equation",
    "Screenshot UI",
    "Conceptual Illustration",
    "Table Matrix",
    "Timeline",
    "Real-world Photo",
    "Unknown"
]

class VisualElement(BaseModel):
    visual_id: str = Field(description="Unique visual element identifier, e.g. DOC01_S12_IMG01")
    source_document: str = Field(default="", description="Source document identifier")
    source_slide: int = Field(default=1, description="Slide or page index (1-based)")
    visual_role: VisualRoleType = Field(default="Unknown", description="Pedagogical role of the visual")
    caption: str = Field(default="", description="Caption or concise description of visual")
    ocr_text: Optional[str] = Field(default=None, description="Extracted textual content inside the image if any")
    bounding_box: Optional[Dict[str, float]] = Field(default=None, description="Normalized coordinates {x, y, w, h}")
    storage_path: Optional[str] = Field(default=None, description="Asset path or CDN URL")
    metadata: Dict[str, Any] = Field(default_factory=dict)

class TextVisualLink(BaseModel):
    visual_id: str = Field(description="Referenced visual_id")
    association_strength: Literal["primary", "supporting", "contextual"] = Field(
        default="primary",
        description="Association strength between chunk text and visual element"
    )
    alignment_reason: str = Field(default="", description="Pedagogical rationale for linking text with this visual")

ChunkType = Literal[
    "definition",
    "concept",
    "mechanism",
    "example",
    "comparison",
    "code_walkthrough",
    "mathematical_proof",
    "summary",
    "speaker_note",
    "visual_explanation"
]

class ChunkProvenance(BaseModel):
    document_id: str
    source_slide: int
    source_page: Optional[int] = None
    source_file_type: str = "pptx"
    source_element_ids: List[str] = Field(default_factory=list)
    markdown_line_start: Optional[int] = None
    markdown_line_end: Optional[int] = None

class SemanticChunk(BaseModel):
    chunk_id: str = Field(description="Structured chunk ID, e.g. DOC01-S12-C03")
    document_id: str
    parent_id: Optional[str] = Field(default=None, description="Parent ID (e.g. S12)")
    chapter: Optional[str] = Field(default=None, description="Chapter or major unit title")
    section_id: str = Field(description="Section ID matching DocumentSection.section_id")
    chunk_category: Literal["text", "visual", "table", "chart", "multimodal"] = Field(
        default="text",
        description="High-level modality classification of this chunk"
    )
    chunk_type: ChunkType = Field(default="concept", description="Pedagogical type of this semantic chunk")
    content: str = Field(description="Normalized textual content of the chunk")
    text_refs: List[str] = Field(default_factory=list, description="IDs of text elements composing this chunk")
    visual_refs: List[TextVisualLink] = Field(default_factory=list, description="Associated visual references")
    table_refs: List[str] = Field(default_factory=list, description="IDs of table elements incorporated")
    chart_refs: List[str] = Field(default_factory=list, description="IDs of chart elements incorporated")
    relations: List[str] = Field(default_factory=list, description="Explicit relationship labels (e.g. explains, describes)")
    speaker_notes: Optional[str] = Field(default=None, description="Accompanying instructor notes")
    word_count: int = Field(default=0)
    token_estimate: int = Field(default=0)
    provenance: ChunkProvenance

class ContentElement(BaseModel):
    element_id: str = Field(description="Unique ID for content element, e.g. el_01")
    type: Literal["title", "heading", "paragraph", "bullet_point", "table", "code", "equation", "note"]
    text: str = Field(description="Raw text content of the element")
    level: Optional[int] = Field(default=None, description="Heading level (1-3) or bullet indentation level")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional properties, e.g. table dimensions, slide position")

class DocumentSection(BaseModel):
    section_id: str = Field(description="Section or slide identifier, e.g. S1, slide_01")
    title: str = Field(default="Untitled Section", description="Extracted heading or slide title")
    order: int = Field(description="1-based natural reading order in source document")
    elements: List[ContentElement] = Field(default_factory=list, description="Extracted structural elements")
    raw_text: Optional[str] = Field(default="", description="Aggregated text content for easy analysis")

# Forward ref import for DocumentIR
from app.models.document_ir import DocumentIR

class CanonicalDocumentTree(BaseModel):
    document_id: str = Field(description="Unique document identifier")
    title: str = Field(default="Untitled Document")
    source_type: Literal["pptx", "docx", "markdown", "text", "demo", "pdf"]
    source_filename: str
    total_sections: int
    sections: List[DocumentSection] = Field(default_factory=list)
    extraction_time_ms: float = Field(default=0.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    # Enhanced multimodal & semantic fields
    canonical_markdown: str = Field(
        default="",
        description="Structured Markdown canonical intermediate representation"
    )
    semantic_chunks: List[SemanticChunk] = Field(
        default_factory=list,
        description="Slide-aware hierarchical semantic chunks with provenance"
    )
    visual_elements: List[VisualElement] = Field(
        default_factory=list,
        description="Registry of extracted visual elements, diagrams, and figures"
    )
    # Multimodal Document IR: Complete Source of Truth
    document_ir: Optional[DocumentIR] = Field(
        default=None,
        description="Multimodal Document IR: The deterministic Source of Truth"
    )

