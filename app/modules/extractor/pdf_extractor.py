# app/modules/extractor/pdf_extractor.py
"""
Deterministic PDF Extractor for CLSG-IR Module 1.
Extracts slide/page titles, bullet points, paragraphs directly using PyMuPDF (Zero-LLM, Zero-VLM).
"""
import io
import time
import uuid
from typing import Union
from pathlib import Path
import fitz  # PyMuPDF
from app.models.document import CanonicalDocumentTree, DocumentSection, ContentElement
from app.modules.extractor.base import BaseExtractor

class PDFExtractor(BaseExtractor):
    def extract(self, source: Union[str, Path, bytes], filename: str) -> CanonicalDocumentTree:
        start_time = time.perf_counter()
        
        if isinstance(source, bytes):
            doc = fitz.open(stream=source, filetype="pdf")
        else:
            doc = fitz.open(str(source))
            
        doc_id = f"doc_{uuid.uuid4().hex[:8]}"
        sections = []
        overall_title = Path(filename).stem.replace("_", " ").title()

        for page_idx, page in enumerate(doc, start=1):
            sec_id = f"S{page_idx}"
            elements = []
            el_idx = 1
            raw_texts = []
            
            # Extract text blocks
            blocks = page.get_text("blocks")
            lines = []
            for b in blocks:
                # b: (x0, y0, x1, y1, text, block_no, block_type)
                if len(b) > 4 and b[6] == 0:  # text block
                    text = b[4].strip()
                    if text:
                        # Split block into non-empty lines
                        for line in text.split("\n"):
                            clean_l = line.strip()
                            if clean_l:
                                lines.append(clean_l)
            
            slide_title = f"Slide {page_idx}"
            if lines:
                # Pick first non-numeric line as title
                title_idx = 0
                while title_idx < len(lines) and lines[title_idx].isdigit():
                    title_idx += 1
                if title_idx < len(lines):
                    slide_title = lines[title_idx]
                    if page_idx == 1 and overall_title == Path(filename).stem.replace("_", " ").title():
                        overall_title = slide_title

                for i, line in enumerate(lines):
                    if i == title_idx:
                        elements.append(ContentElement(
                            element_id=f"{sec_id}_el_{el_idx:02d}",
                            type="title",
                            text=line,
                            level=1
                        ))
                    else:
                        is_bullet = line.startswith(("-", "*", "•")) or (len(line) > 2 and line[0].isdigit() and line[1] in [".", ")"])
                        clean_text = line.lstrip("-*•0123456789. ") if is_bullet else line
                        elements.append(ContentElement(
                            element_id=f"{sec_id}_el_{el_idx:02d}",
                            type="bullet_point" if is_bullet else "paragraph",
                            text=clean_text or line,
                            level=2
                        ))
                    el_idx += 1
                    raw_texts.append(line)

            if not elements:
                elements.append(ContentElement(
                    element_id=f"{sec_id}_el_01",
                    type="title",
                    text=f"Slide {page_idx}",
                    level=1
                ))
                raw_texts.append(f"Slide {page_idx}")

            sections.append(DocumentSection(
                section_id=sec_id,
                title=slide_title,
                order=page_idx,
                elements=elements,
                raw_text="\n".join(raw_texts)
            ))

        doc.close()
        extraction_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        return CanonicalDocumentTree(
            document_id=doc_id,
            title=overall_title,
            source_type="pdf",
            source_filename=filename,
            total_sections=len(sections),
            sections=sections,
            extraction_time_ms=extraction_time_ms
        )
