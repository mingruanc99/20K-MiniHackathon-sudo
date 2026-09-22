# app/models/document.py
"""
Data models for Module 1: Canonical Document Tree
Rule-based document structure representation without VLM/OCR dependencies.
"""
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

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

class CanonicalDocumentTree(BaseModel):
    document_id: str = Field(description="Unique document identifier")
    title: str = Field(default="Untitled Document")
    source_type: Literal["pptx", "docx", "markdown", "text", "demo", "pdf"]
    source_filename: str
    total_sections: int
    sections: List[DocumentSection] = Field(default_factory=list)
    extraction_time_ms: float = Field(default=0.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)
