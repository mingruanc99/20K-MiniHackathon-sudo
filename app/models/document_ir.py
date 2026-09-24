# app/models/document_ir.py
"""
Multimodal Document Intermediate Representation (Document IR / Slide IR).
The deterministic SOURCE OF TRUTH for CLSG-IR Module 1.
Decouples physical extraction from LLM-friendly Markdown views and reasoning chunks.
"""
from typing import List, Optional, Literal, Dict, Any, Union
from pydantic import BaseModel, Field

# 1. Element Type: What the element physically is
ElementType = Literal[
    "text",
    "image",
    "table",
    "chart",
    "diagram",
    "equation",
    "code",
    "shape",
    "note",
    "annotation",
    "decoration"
]

# 2. Element Subtype: Specific visual / diagram subtype
ElementSubtype = Literal[
    "human_pose_skeleton",
    "flowchart",
    "process_diagram",
    "architecture_diagram",
    "conceptual_diagram",
    "graph",
    "chart",
    "table",
    "screenshot",
    "code_visual",
    "decoration",
    "unknown"
]

# 3. Element Role: What pedagogical purpose the element serves
ElementRole = Literal[
    "concept",
    "definition",
    "example",
    "comparison",
    "process",
    "evidence",
    "illustration",
    "summary",
    "reference",
    "decoration",
    "conceptual_diagram",
    "explanatory_illustration",
    "performance_comparison",
    "real_world_example",
    "architecture_diagram",
    "code_walkthrough",
    "mathematical_proof",
    "unknown"
]

# 4. Relationship Types between elements and knowledge entities
RelationType = Literal[
    "contains",
    "explains",
    "describes",
    "illustrates",
    "references",
    "based_on",
    "defines",
    "example_of",
    "related_to",
    "supports",
    "visualizes",
    "annotates",
    "part_of",
    "represents",
    "compares",
    "summarizes",
    "prerequisite_to"
]

class ElementRelationship(BaseModel):
    id: Optional[str] = None
    source_type: str = "element"
    source_id: str = Field(description="ID of source element, e.g. text_01")
    target_type: str = "element"
    target_id: str = Field(description="ID of target element, e.g. image_01")
    relation: RelationType = Field(description="Semantic relationship link")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class DiagramNode(BaseModel):
    id: str = Field(description="Node identifier, e.g. kp_0")
    label: str = Field(description="Visual label, e.g. '0'")
    name: Optional[str] = Field(default=None, description="Anatomical or logical name, e.g. 'nose'")
    bbox: Optional[List[float]] = Field(default=None, description="Normalized coordinates [x1, y1, x2, y2]")
    region: Optional[str] = Field(default=None, description="Body-part or architectural region, e.g. 'head', 'upper_body'")
    metadata: Dict[str, Any] = Field(default_factory=dict)

class DiagramEdge(BaseModel):
    source: str = Field(description="Source node ID, e.g. kp_0")
    target: str = Field(description="Target node ID, e.g. kp_1")
    label: Optional[str] = Field(default=None, description="Connection name or label")
    metadata: Dict[str, Any] = Field(default_factory=dict)

class StructuredDiagram(BaseModel):
    diagram_id: str
    type: str = "diagram"
    subtype: str = "unknown"
    role: str = "conceptual_diagram"
    description: str = Field(default="", description="Grounded semantic description of diagram")
    nodes: List[DiagramNode] = Field(default_factory=list)
    edges: List[DiagramEdge] = Field(default_factory=list)
    node_count: int = 0
    edge_count: int = 0
    annotations: List[str] = Field(default_factory=list, description="Labels or markers belonging to diagram")
    bbox: Optional[List[float]] = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class StructuredTable(BaseModel):
    table_id: str
    columns: List[str] = Field(default_factory=list, description="Column header labels")
    rows: List[List[Any]] = Field(default_factory=list, description="Matrix of table cell values")
    headers: List[str] = Field(default_factory=list, description="Primary header row values")
    has_merged_cells: bool = False
    image_snapshot_path: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class StructuredChart(BaseModel):
    chart_id: str
    chart_type: Literal["bar", "line", "pie", "scatter", "radar", "area", "unknown"] = "unknown"
    title: Optional[str] = None
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    legend: List[str] = Field(default_factory=list)
    # Zero hallucination guarantee: If raw numeric values cannot be reliably extracted, data must be None
    data: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Extracted chart data points. Must be None if unextractable, never hallucinated."
    )
    image_path: Optional[str] = None
    classification_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class DocumentElement(BaseModel):
    id: str = Field(description="Unique element ID within document, e.g. DOC01_S12_el01")
    type: ElementType = Field(description="What the element is (text, image, table, chart, diagram, annotation, etc.)")
    subtype: Optional[str] = Field(default=None, description="Specific visual/diagram subtype (e.g. human_pose_skeleton)")
    source_type: str = Field(default="slide_text", description="Provenance source: slide_text | diagram_annotation | shape | visual_asset")
    role: ElementRole = Field(default="unknown", description="Pedagogical function the element serves")
    classification_confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    reading_order: int = Field(description="1-based natural reading order on the slide/page")
    bbox: Optional[List[float]] = Field(
        default=None,
        description="Normalized coordinates [x1, y1, x2, y2] within [0.0, 1.0]"
    )
    content: Optional[str] = Field(default=None, description="Textual or formula content")
    raw_text: Optional[str] = Field(default=None, description="Original unnormalized raw text directly from source")
    normalized_text: Optional[str] = Field(default=None, description="NFC normalized text preserving special characters and punctuation")
    marker: Optional[str] = Field(default=None, description="Bullet or list marker (e.g. ■, •, 1.)")
    layout_region: Optional[str] = Field(default=None, description="Detected spatial region: left_diagram | right_text | top_title | bottom_caption | main")
    caption: Optional[str] = Field(default=None, description="Caption or label if visual/table/chart/diagram")
    description: Optional[str] = Field(default=None, description="Concise semantic description of the visual element")
    structured_table: Optional[StructuredTable] = None
    structured_chart: Optional[StructuredChart] = None
    structured_diagram: Optional[StructuredDiagram] = None
    diagram_ref: Optional[str] = Field(default=None, description="ID of parent diagram if this element is an annotation")
    asset_path: Optional[str] = Field(default=None, description="Path to image or visual asset")
    ocr_text: Optional[str] = None
    source_slide: int = 1
    provenance: Optional[Dict[str, Any]] = Field(default=None, description="Detailed provenance tracing back to source file and shape")
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SlideIR(BaseModel):
    slide_id: int = Field(description="Slide or page sequence number (1-based)")
    section_id: str = Field(description="Section ID matching DocumentSection, e.g. S1")
    title: str = Field(default="Untitled Slide")
    elements: List[DocumentElement] = Field(default_factory=list)
    relationships: List[ElementRelationship] = Field(default_factory=list)
    speaker_notes: List[str] = Field(default_factory=list)
    dimensions: Optional[Dict[str, float]] = Field(default=None, description="Slide width/height in points")
    metadata: Dict[str, Any] = Field(default_factory=dict)

class DocumentIR(BaseModel):
    document_id: str
    title: str
    source_type: str = Field(description="pptx | pdf | docx | markdown")
    source_filename: str
    total_slides: int
    slides: List[SlideIR] = Field(default_factory=list)
    global_relationships: List[ElementRelationship] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
