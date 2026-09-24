# app/modules/extractor/pdf_extractor.py
"""
Deterministic PDF Extractor for CLSG-IR Module 1.
Extracts slide/page titles, blocks, tables, and images directly using PyMuPDF (Zero-LLM, Zero-VLM).
Implements Multimodal Document Representation:
- DOCUMENT IR = SOURCE OF TRUTH (DocumentElement, StructuredTable, StructuredChart, ElementRelationship)
- MARKDOWN = LLM-FRIENDLY VIEW
- SEMANTIC CHUNK = UNIT OF REASONING
"""
import io
import re
import time
import uuid
from typing import Union, List, Dict, Any, Optional
from pathlib import Path
import fitz  # PyMuPDF

from app.models.document import (
    CanonicalDocumentTree,
    DocumentSection,
    ContentElement,
    VisualElement
)
from app.models.document_ir import (
    DocumentIR,
    SlideIR,
    DocumentElement,
    StructuredTable,
    StructuredChart,
    ElementRelationship
)
from app.modules.extractor.base import BaseExtractor, normalize_text_and_symbols, BULLET_REGEX_PATTERN
from app.modules.extractor.element_classifier import ElementClassifier
from app.modules.extractor.relationship_builder import RelationshipBuilder
from app.modules.extractor.normalizer import ContentNormalizer
from app.modules.extractor.chunker import SemanticChunker

class PDFExtractor(BaseExtractor):
    def __init__(self):
        self.classifier = ElementClassifier()
        self.rel_builder = RelationshipBuilder()
        self.normalizer = ContentNormalizer()
        self.chunker = SemanticChunker()

    def extract(self, source: Union[str, Path, bytes], filename: str) -> CanonicalDocumentTree:
        start_time = time.perf_counter()
        
        if isinstance(source, bytes):
            doc = fitz.open(stream=source, filetype="pdf")
        else:
            doc = fitz.open(str(source))
            
        doc_id = f"doc_{uuid.uuid4().hex[:8]}"
        slides_ir: List[SlideIR] = []
        legacy_sections: List[DocumentSection] = []
        visual_elements_registry: List[VisualElement] = []
        overall_title = Path(filename).stem.replace("_", " ").title()

        for page_idx, page in enumerate(doc, start=1):
            sec_id = f"S{page_idx}"
            slide_elements: List[DocumentElement] = []
            legacy_elements: List[ContentElement] = []
            reading_order = 1
            raw_texts = []
            rect = page.rect
            page_w, page_h = rect.width or 612.0, rect.height or 792.0

            # 1. Extract text blocks with coordinates
            blocks = page.get_text("blocks")
            lines = []
            slide_title = f"Slide {page_idx}"

            # Find first suitable text line as title
            for b in blocks:
                if len(b) > 4 and b[6] == 0:
                    b_text = b[4].strip()
                    if b_text and not b_text.isdigit() and slide_title == f"Slide {page_idx}":
                        first_line = b_text.split("\n")[0].strip()
                        if first_line:
                            slide_title = first_line

            if page_idx == 1 and overall_title == Path(filename).stem.replace("_", " ").title():
                overall_title = slide_title

            # Title DocumentElement
            slide_elements.append(DocumentElement(
                id=f"{doc_id}_S{page_idx:02d}_el{reading_order:02d}",
                type="text",
                role="concept",
                classification_confidence=1.0,
                reading_order=reading_order,
                content=slide_title,
                source_slide=page_idx
            ))
            legacy_elements.append(ContentElement(
                element_id=f"{sec_id}_el_{reading_order:02d}",
                type="title",
                text=slide_title,
                level=1
            ))
            raw_texts.append(slide_title)
            reading_order += 1

            # 2. Extract block text with bboxes
            for b in blocks:
                if len(b) > 4 and b[6] == 0:
                    text = b[4].strip()
                    if not text:
                        continue
                    
                    bbox = [
                        round(max(0.0, min(1.0, b[0] / page_w)), 3),
                        round(max(0.0, min(1.0, b[1] / page_h)), 3),
                        round(max(0.0, min(1.0, b[2] / page_w)), 3),
                        round(max(0.0, min(1.0, b[3] / page_h)), 3)
                    ]

                    for line in text.split("\n"):
                        clean_l = normalize_text_and_symbols(line)
                        if not clean_l or clean_l == slide_title:
                            continue

                        is_bullet = bool(re.match(rf'^({BULLET_REGEX_PATTERN}|\d+\.|\([a-z0-9]+\))\s*', line, re.IGNORECASE))
                        clean_text = re.sub(rf'^({BULLET_REGEX_PATTERN}|\d+\.|\([a-z0-9]+\))\s*', '', clean_l, flags=re.IGNORECASE)
                        el_text = clean_text or clean_l

                        el_type, el_role, conf = self.classifier.classify_text_element(el_text)

                        slide_elements.append(DocumentElement(
                            id=f"{doc_id}_S{page_idx:02d}_el{reading_order:02d}",
                            type=el_type,
                            role=el_role,
                            classification_confidence=conf,
                            reading_order=reading_order,
                            bbox=bbox,
                            content=el_text,
                            source_slide=page_idx
                        ))
                        legacy_elements.append(ContentElement(
                            element_id=f"{sec_id}_el_{reading_order:02d}",
                            type="bullet_point" if is_bullet else "paragraph",
                            text=el_text,
                            level=2 if is_bullet else 1
                        ))
                        raw_texts.append(el_text)
                        reading_order += 1

            # 3. Extract Tables if available via PyMuPDF find_tables
            try:
                tables = page.find_tables()
                if tables and tables.tables:
                    for tbl_idx, tab in enumerate(tables.tables):
                        extracted_df = tab.extract()
                        if extracted_df and len(extracted_df) >= 2:
                            headers = [str(c or '').strip() for c in extracted_df[0]]
                            rows = [[str(c or '').strip() for c in r] for r in extracted_df[1:]]
                            table_text = "\n".join(" | ".join(r) for r in extracted_df)

                            st_table = StructuredTable(
                                table_id=f"tbl_{doc_id}_S{page_idx:02d}_{reading_order:02d}",
                                columns=headers,
                                rows=rows,
                                headers=headers
                            )

                            slide_elements.append(DocumentElement(
                                id=f"{doc_id}_S{page_idx:02d}_el{reading_order:02d}",
                                type="table",
                                role="comparison",
                                classification_confidence=0.95,
                                reading_order=reading_order,
                                content=table_text,
                                structured_table=st_table,
                                source_slide=page_idx
                            ))
                            legacy_elements.append(ContentElement(
                                element_id=f"{sec_id}_el_{reading_order:02d}",
                                type="table",
                                text=table_text,
                                metadata={"rows": len(rows), "cols": len(headers)}
                            ))
                            raw_texts.append(table_text)
                            reading_order += 1
            except Exception:
                pass

            # 4. Extract Images
            img_list = page.get_images(full=True)
            for img_idx, img_info in enumerate(img_list, start=1):
                vis_id = f"{doc_id}_S{page_idx:02d}_el{reading_order:02d}"
                asset_path = f"assets/pdf_p{page_idx:02d}_img{img_idx:02d}.png"
                el_type, el_role, conf = self.classifier.classify_visual_element(
                    name=f"figure_{img_idx}",
                    context_hints={"slide_title": slide_title}
                )

                slide_elements.append(DocumentElement(
                    id=vis_id,
                    type=el_type,
                    role=el_role,
                    classification_confidence=conf,
                    reading_order=reading_order,
                    caption=f"Figure {img_idx} on {slide_title}",
                    asset_path=asset_path,
                    source_slide=page_idx
                ))

                visual_elements_registry.append(VisualElement(
                    visual_id=vis_id,
                    source_document=doc_id,
                    source_slide=page_idx,
                    visual_role="Architecture Diagram" if el_type == "diagram" else "Conceptual Illustration",
                    caption=f"Figure {img_idx} on {slide_title}",
                    storage_path=asset_path
                ))
                reading_order += 1

            # Build relationships for this slide
            relationships = self.rel_builder.build_slide_relationships(slide_elements)

            slides_ir.append(SlideIR(
                slide_id=page_idx,
                section_id=sec_id,
                title=slide_title,
                elements=slide_elements,
                relationships=relationships,
                dimensions={"width": page_w, "height": page_h}
            ))

            legacy_sections.append(DocumentSection(
                section_id=sec_id,
                title=slide_title,
                order=page_idx,
                elements=legacy_elements,
                raw_text="\n".join(raw_texts)
            ))

        doc.close()

        # 5. Assemble DocumentIR
        doc_ir = DocumentIR(
            document_id=doc_id,
            title=overall_title,
            source_type="pdf",
            source_filename=filename,
            total_slides=len(slides_ir),
            slides=slides_ir
        )

        # 6. Render clean Markdown view & Multimodal Chunks
        canonical_markdown = self.normalizer.render_from_document_ir(doc_ir)
        semantic_chunks = self.chunker.chunk_from_document_ir(doc_ir)

        extraction_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return CanonicalDocumentTree(
            document_id=doc_id,
            title=overall_title,
            source_type="pdf",
            source_filename=filename,
            total_sections=len(legacy_sections),
            sections=legacy_sections,
            extraction_time_ms=extraction_time_ms,
            canonical_markdown=canonical_markdown,
            semantic_chunks=semantic_chunks,
            visual_elements=visual_elements_registry,
            document_ir=doc_ir
        )
