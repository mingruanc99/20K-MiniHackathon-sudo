# app/modules/extractor/pptx_extractor.py
"""
Deterministic PPTX Extractor for CLSG-IR Module 1.
Implements the Multimodal Document Representation architecture:
- DOCUMENT IR = SOURCE OF TRUTH (DocumentElement with type, role, bbox, StructuredTable, StructuredChart, ElementRelationship)
- MARKDOWN = LLM-FRIENDLY VIEW
- SEMANTIC CHUNK = UNIT OF REASONING
"""
import io
import re
import time
import uuid
from typing import Union, List, Dict, Any, Optional
from pathlib import Path
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

from app.models.document import (
    CanonicalDocumentTree,
    DocumentSection,
    ContentElement,
    VisualElement,
    VisualRoleType
)
from app.models.document_ir import (
    DocumentIR,
    SlideIR,
    DocumentElement,
    StructuredTable,
    StructuredChart,
    ElementRelationship
)
from app.modules.extractor.base import BaseExtractor, normalize_text_and_symbols, parse_list_item, BULLET_REGEX_PATTERN
from app.modules.extractor.element_classifier import ElementClassifier
from app.modules.extractor.diagram_recognizer import DiagramRecognizer
from app.modules.extractor.relationship_builder import RelationshipBuilder
from app.modules.extractor.normalizer import ContentNormalizer
from app.modules.extractor.chunker import SemanticChunker

def _flatten_shapes(shapes):
    """Recursively flattens shapes, including shapes nested within grouped shapes (MSO_SHAPE_TYPE.GROUP)."""
    for s in shapes:
        if getattr(s, "shape_type", None) == MSO_SHAPE_TYPE.GROUP and hasattr(s, "shapes"):
            for child in _flatten_shapes(s.shapes):
                yield child
        else:
            yield s

class PPTXExtractor(BaseExtractor):
    def __init__(self):
        self.classifier = ElementClassifier()
        self.diagram_recognizer = DiagramRecognizer()
        self.rel_builder = RelationshipBuilder()
        self.normalizer = ContentNormalizer()
        self.chunker = SemanticChunker()

    def extract(self, source: Union[str, Path, bytes], filename: str) -> CanonicalDocumentTree:
        start_time = time.perf_counter()
        
        if isinstance(source, bytes):
            prs = Presentation(io.BytesIO(source))
        else:
            prs = Presentation(str(source))
            
        doc_id = f"doc_{uuid.uuid4().hex[:8]}"
        slides_ir: List[SlideIR] = []
        legacy_sections: List[DocumentSection] = []
        visual_elements_registry: List[VisualElement] = []
        overall_title = Path(filename).stem.replace("_", " ").title()

        prs_width = prs.slide_width if hasattr(prs, "slide_width") else 9144000
        prs_height = prs.slide_height if hasattr(prs, "slide_height") else 5143500

        for slide_idx, slide in enumerate(prs.slides, start=1):
            sec_id = f"S{slide_idx}"
            slide_title = None
            slide_elements: List[DocumentElement] = []
            legacy_elements: List[ContentElement] = []
            speaker_notes: List[str] = []
            reading_order = 1
            raw_texts = []
            title_shape = None

            # 1. Title detection
            if slide.shapes.title and slide.shapes.title.text.strip():
                slide_title = slide.shapes.title.text.strip()
                title_shape = slide.shapes.title

            if not slide_title:
                for s in slide.shapes:
                    if s.has_text_frame and s.text_frame.text.strip():
                        first_p = s.text_frame.paragraphs[0].text.strip()
                        if first_p:
                            slide_title = first_p
                            title_shape = s
                            break

            if not slide_title:
                slide_title = f"Slide {slide_idx}"

            if slide_idx == 1 and overall_title == Path(filename).stem.replace("_", " ").title():
                overall_title = slide_title

            # Title DocumentElement
            slide_elements.append(DocumentElement(
                id=f"{doc_id}_S{slide_idx:02d}_el{reading_order:02d}",
                type="text",
                role="concept",
                classification_confidence=1.0,
                reading_order=reading_order,
                content=slide_title,
                source_slide=slide_idx
            ))
            legacy_elements.append(ContentElement(
                element_id=f"{sec_id}_el_{reading_order:02d}",
                type="title",
                text=slide_title,
                level=1
            ))
            raw_texts.append(slide_title)
            reading_order += 1

            # 2. Iterate Shapes (including flattened grouped shapes)
            for shape in _flatten_shapes(slide.shapes):
                # Calculate normalized bbox [x1, y1, x2, y2]
                bbox = None
                if hasattr(shape, "left") and hasattr(shape, "top") and hasattr(shape, "width") and hasattr(shape, "height"):
                    x1 = max(0.0, min(1.0, shape.left / prs_width))
                    y1 = max(0.0, min(1.0, shape.top / prs_height))
                    x2 = max(0.0, min(1.0, (shape.left + shape.width) / prs_width))
                    y2 = max(0.0, min(1.0, (shape.top + shape.height) / prs_height))
                    bbox = [round(x1, 3), round(y1, 3), round(x2, 3), round(y2, 3)]

                # Determine layout region based on normalized coordinates
                layout_reg = "main"
                if bbox:
                    bx1, by1, bx2, by2 = bbox
                    if by1 < 0.20:
                        layout_reg = "top_title"
                    elif by1 >= 0.82:
                        layout_reg = "bottom_caption"
                    elif bx1 < 0.48:
                        layout_reg = "left_diagram"
                    else:
                        layout_reg = "right_text"

                # A. Text shapes
                if shape.has_text_frame:
                    is_title_shape = (shape == title_shape)
                    for p_idx, paragraph in enumerate(shape.text_frame.paragraphs):
                        p_text = paragraph.text.strip()
                        if not p_text:
                            continue
                        if is_title_shape and p_idx == 0 and p_text == slide_title:
                            continue

                        norm_text = normalize_text_and_symbols(p_text)
                        if not norm_text:
                            continue

                        is_bullet, marker, clean_text = parse_list_item(norm_text)
                        el_text = clean_text or norm_text

                        el_type, el_role, conf = self.classifier.classify_text_element(el_text)

                        slide_elements.append(DocumentElement(
                            id=f"{doc_id}_S{slide_idx:02d}_el{reading_order:02d}",
                            type=el_type,
                            role=el_role,
                            classification_confidence=conf,
                            reading_order=reading_order,
                            bbox=bbox,
                            content=el_text,
                            raw_text=p_text,
                            normalized_text=norm_text,
                            marker=marker,
                            layout_region=layout_reg,
                            source_slide=slide_idx,
                            provenance={
                                "source_file": filename,
                                "slide_number": slide_idx,
                                "shape_name": getattr(shape, "name", ""),
                                "p_idx": p_idx
                            }
                        ))
                        reading_order += 1

                # B. Table shapes
                elif shape.has_table:
                    tbl = shape.table
                    headers: List[str] = []
                    rows_data: List[List[str]] = []

                    for r_idx, row in enumerate(tbl.rows):
                        vals = [cell.text.strip() for cell in row.cells]
                        if r_idx == 0:
                            headers = vals
                        rows_data.append(vals)

                    table_text = "\n".join(" | ".join(r) for r in rows_data)
                    el_type, el_role, conf = self.classifier.classify_table_element(headers, rows_data, slide_title)

                    st_table = StructuredTable(
                        table_id=f"tbl_{doc_id}_S{slide_idx:02d}_{reading_order:02d}",
                        columns=headers,
                        rows=rows_data,
                        headers=headers
                    )

                    slide_elements.append(DocumentElement(
                        id=f"{doc_id}_S{slide_idx:02d}_el{reading_order:02d}",
                        type=el_type,
                        role=el_role,
                        classification_confidence=conf,
                        reading_order=reading_order,
                        bbox=bbox,
                        content=table_text,
                        structured_table=st_table,
                        source_slide=slide_idx
                    ))
                    legacy_elements.append(ContentElement(
                        element_id=f"{sec_id}_el_{reading_order:02d}",
                        type="table",
                        text=table_text,
                        metadata={"rows": len(rows_data), "cols": len(headers)}
                    ))
                    raw_texts.append(table_text)
                    reading_order += 1

                # C. Visual shapes (Pictures, Charts, Media, Diagrams)
                elif shape.shape_type in (MSO_SHAPE_TYPE.PICTURE, MSO_SHAPE_TYPE.MEDIA, MSO_SHAPE_TYPE.CHART):
                    el_type, el_role, conf = self.classifier.classify_visual_element(
                        name=shape.name,
                        shape_type_str=str(shape.shape_type),
                        context_hints={"slide_title": slide_title}
                    )

                    st_chart = None
                    if el_type == "chart":
                        # Attempt chart structure extraction without hallucination
                        st_chart = StructuredChart(
                            chart_id=f"chart_{doc_id}_S{slide_idx:02d}_{reading_order:02d}",
                            chart_type="bar" if "bar" in shape.name.lower() else "unknown",
                            title=shape.name,
                            data=None,  # Zero hallucination: raw numbers unextractable from binary shape
                            classification_confidence=conf
                        )

                    vis_id = f"{doc_id}_S{slide_idx:02d}_el{reading_order:02d}"
                    asset_path = f"assets/slide_{slide_idx:02d}_{reading_order:02d}.png"

                    slide_elements.append(DocumentElement(
                        id=vis_id,
                        type=el_type,
                        role=el_role,
                        classification_confidence=conf,
                        reading_order=reading_order,
                        bbox=bbox,
                        caption=f"{shape.name} on {slide_title}",
                        structured_chart=st_chart,
                        asset_path=asset_path,
                        source_slide=slide_idx
                    ))

                    # Registry for visual elements
                    visual_elements_registry.append(VisualElement(
                        visual_id=vis_id,
                        source_document=doc_id,
                        source_slide=slide_idx,
                        visual_role="Architecture Diagram" if el_type == "diagram" else "Data Chart" if el_type == "chart" else "Conceptual Illustration",
                        caption=f"{shape.name} on {slide_title}",
                        storage_path=asset_path
                    ))
                    reading_order += 1

            # 3. Speaker Notes
            if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                notes_text = slide.notes_slide.notes_text_frame.text.strip()
                if notes_text:
                    speaker_notes.append(notes_text)
                    slide_elements.append(DocumentElement(
                        id=f"{doc_id}_S{slide_idx:02d}_el{reading_order:02d}",
                        type="note",
                        role="reference",
                        classification_confidence=1.0,
                        reading_order=reading_order,
                        content=notes_text,
                        source_slide=slide_idx
                    ))
                    legacy_elements.append(ContentElement(
                        element_id=f"{sec_id}_el_{reading_order:02d}",
                        type="note",
                        text=notes_text,
                        metadata={"source": "speaker_notes"}
                    ))
                    raw_texts.append(f"[Note: {notes_text}]")
                    reading_order += 1

            # 4. Diagram Understanding & Vector Graph Reconstruction
            slide_elements = self.diagram_recognizer.analyze_slide(
                slide_elements, slide_title, slide_idx, doc_id
            )

            # Reconstruct clean legacy_elements & raw_texts filtering out diagram annotations
            clean_legacy_elements: List[ContentElement] = []
            clean_raw_texts: List[str] = []
            for el in slide_elements:
                if el.source_type == "diagram_annotation" or el.type == "annotation":
                    # Do NOT pollute slide text or legacy elements with diagram annotations!
                    continue
                if el.type == "text":
                    is_title = (el.reading_order == 1 or el.content == slide_title)
                    is_bullet = (el.role in ("example", "evidence") or (el.content and el.content.startswith("-")))
                    clean_legacy_elements.append(ContentElement(
                        element_id=f"{sec_id}_el_{el.reading_order:02d}",
                        type="title" if is_title else "bullet_point" if is_bullet else "paragraph",
                        text=el.content or "",
                        level=1 if not is_bullet else 2
                    ))
                    clean_raw_texts.append(el.content or "")
                elif el.type == "table":
                    clean_legacy_elements.append(ContentElement(
                        element_id=f"{sec_id}_el_{el.reading_order:02d}",
                        type="table",
                        text=el.content or "",
                        metadata={"type": "table"}
                    ))
                    clean_raw_texts.append(el.content or "")
                elif el.type in ("image", "diagram"):
                    vis_role_str = (
                        "Architecture Diagram" if el.type == "diagram"
                        else "Data Chart" if el.type == "chart"
                        else "Conceptual Illustration"
                    )
                    visual_elements_registry.append(VisualElement(
                        visual_id=el.id,
                        source_document=doc_id,
                        source_slide=slide_idx,
                        visual_role=vis_role_str,
                        caption=el.caption or el.description or slide_title,
                        storage_path=el.asset_path or f"assets/slide_{slide_idx:02d}_{el.id}.png"
                    ))
                    clean_legacy_elements.append(ContentElement(
                        element_id=f"{sec_id}_el_{el.reading_order:02d}",
                        type="paragraph",
                        text=f"[{el.type.upper()}: {el.role}] {el.description or el.caption or ''}",
                        level=1
                    ))
                    clean_raw_texts.append(f"[{el.type.upper()}: {el.description or el.caption or ''}]")
                elif el.type == "note":
                    clean_legacy_elements.append(ContentElement(
                        element_id=f"{sec_id}_el_{el.reading_order:02d}",
                        type="note",
                        text=el.content or "",
                        metadata={"source": "speaker_notes"}
                    ))
                    clean_raw_texts.append(f"[Note: {el.content or ''}]")

            # 5. Build explicit relationships for this slide
            relationships = self.rel_builder.build_slide_relationships(slide_elements)

            slides_ir.append(SlideIR(
                slide_id=slide_idx,
                section_id=sec_id,
                title=slide_title,
                elements=slide_elements,
                relationships=relationships,
                speaker_notes=speaker_notes,
                dimensions={"width": prs_width / 914400.0, "height": prs_height / 914400.0}
            ))

            legacy_sections.append(DocumentSection(
                section_id=sec_id,
                title=slide_title,
                order=slide_idx,
                elements=clean_legacy_elements,
                raw_text="\n".join(clean_raw_texts)
            ))

        # 5. Assemble DocumentIR (SOURCE OF TRUTH)
        doc_ir = DocumentIR(
            document_id=doc_id,
            title=overall_title,
            source_type="pptx",
            source_filename=filename,
            total_slides=len(slides_ir),
            slides=slides_ir
        )

        # 6. Render LLM-Friendly Markdown View from DocumentIR
        canonical_markdown = self.normalizer.render_from_document_ir(doc_ir)

        # 7. Generate Multimodal Semantic Chunks from DocumentIR
        semantic_chunks = self.chunker.chunk_from_document_ir(doc_ir)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return CanonicalDocumentTree(
            document_id=doc_id,
            title=overall_title,
            source_type="pptx",
            source_filename=filename,
            total_sections=len(legacy_sections),
            sections=legacy_sections,
            extraction_time_ms=round(elapsed_ms, 2),
            metadata={"slide_count": len(legacy_sections)},
            canonical_markdown=canonical_markdown,
            semantic_chunks=semantic_chunks,
            visual_elements=visual_elements_registry,
            document_ir=doc_ir
        )
