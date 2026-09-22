# app/modules/extractor/docx_extractor.py
"""
Deterministic DOCX Extractor for CLSG-IR Module 1.
Extracts document headings, paragraphs, bullet points, and tables.
"""
import io
import time
import uuid
from typing import Union
from pathlib import Path
from docx import Document
from app.models.document import CanonicalDocumentTree, DocumentSection, ContentElement
from app.modules.extractor.base import BaseExtractor

class DOCXExtractor(BaseExtractor):
    def extract(self, source: Union[str, Path, bytes], filename: str) -> CanonicalDocumentTree:
        start_time = time.perf_counter()
        
        if isinstance(source, bytes):
            doc = Document(io.BytesIO(source))
        else:
            doc = Document(str(source))
            
        doc_id = f"doc_{uuid.uuid4().hex[:8]}"
        overall_title = Path(filename).stem.replace("_", " ").title()

        sections = []
        current_sec_id = "S1"
        current_title = "Introduction"
        current_elements = []
        raw_texts = []
        el_idx = 1
        sec_idx = 1

        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue

            style_name = p.style.name.lower() if p.style else ""

            # Check if this paragraph represents a new section/heading
            if "heading 1" in style_name or "heading 2" in style_name:
                if current_elements:
                    sections.append(DocumentSection(
                        section_id=current_sec_id,
                        title=current_title,
                        order=sec_idx,
                        elements=current_elements,
                        raw_text="\n".join(raw_texts)
                    ))
                    sec_idx += 1
                    current_sec_id = f"S{sec_idx}"
                    current_elements = []
                    raw_texts = []
                    el_idx = 1
                
                current_title = text
                if sec_idx == 1 and overall_title == Path(filename).stem.replace("_", " ").title():
                    overall_title = text

                current_elements.append(ContentElement(
                    element_id=f"{current_sec_id}_el_{el_idx:02d}",
                    type="heading",
                    text=text,
                    level=1 if "heading 1" in style_name else 2
                ))
                raw_texts.append(text)
                el_idx += 1
            elif "list" in style_name or text.startswith(("-", "•", "*")):
                current_elements.append(ContentElement(
                    element_id=f"{current_sec_id}_el_{el_idx:02d}",
                    type="bullet_point",
                    text=text,
                    level=1
                ))
                raw_texts.append(text)
                el_idx += 1
            else:
                current_elements.append(ContentElement(
                    element_id=f"{current_sec_id}_el_{el_idx:02d}",
                    type="paragraph",
                    text=text
                ))
                raw_texts.append(text)
                el_idx += 1

        # Process any tables
        for table in doc.tables:
            table_rows = []
            for row in table.rows:
                table_rows.append(" | ".join(cell.text.strip() for cell in row.cells))
            table_str = "\n".join(table_rows)
            current_elements.append(ContentElement(
                element_id=f"{current_sec_id}_el_{el_idx:02d}",
                type="table",
                text=table_str,
                metadata={"rows": len(table.rows), "cols": len(table.columns)}
            ))
            raw_texts.append(table_str)
            el_idx += 1

        if current_elements:
            sections.append(DocumentSection(
                section_id=current_sec_id,
                title=current_title,
                order=sec_idx,
                elements=current_elements,
                raw_text="\n".join(raw_texts)
            ))

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return CanonicalDocumentTree(
            document_id=doc_id,
            title=overall_title,
            source_type="docx",
            source_filename=filename,
            total_sections=len(sections),
            sections=sections,
            extraction_time_ms=round(elapsed_ms, 2)
        )
