# app/modules/extractor/pptx_extractor.py
"""
Deterministic PPTX Extractor for CLSG-IR Module 1.
Extracts slide titles, bullet points, tables, speaker notes, and shapes.
"""
import io
import time
import uuid
from typing import Union
from pathlib import Path
from pptx import Presentation
from app.models.document import CanonicalDocumentTree, DocumentSection, ContentElement
from app.modules.extractor.base import BaseExtractor, normalize_text_and_symbols, BULLET_REGEX_PATTERN

class PPTXExtractor(BaseExtractor):
    def extract(self, source: Union[str, Path, bytes], filename: str) -> CanonicalDocumentTree:
        start_time = time.perf_counter()
        
        if isinstance(source, bytes):
            prs = Presentation(io.BytesIO(source))
        else:
            prs = Presentation(str(source))
            
        doc_id = f"doc_{uuid.uuid4().hex[:8]}"
        sections = []
        overall_title = Path(filename).stem.replace("_", " ").title()

        for slide_idx, slide in enumerate(prs.slides, start=1):
            sec_id = f"S{slide_idx}"
            slide_title = None
            elements = []
            el_idx = 1
            raw_texts = []
            title_shape = None

            # 1. Check standard slide.shapes.title
            if slide.shapes.title and slide.shapes.title.text.strip():
                slide_title = slide.shapes.title.text.strip()
                title_shape = slide.shapes.title

            # 2. If standard title is missing, search first text shape
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

            elements.append(ContentElement(
                element_id=f"{sec_id}_el_{el_idx:02d}",
                type="title",
                text=slide_title,
                level=1
            ))
            raw_texts.append(slide_title)
            el_idx += 1

            # 3. Iterate through remaining shapes
            for shape in slide.shapes:
                if shape.has_text_frame:
                    is_title_shape = (shape == title_shape)
                    for p_idx, paragraph in enumerate(shape.text_frame.paragraphs):
                        p_text = paragraph.text.strip()
                        if not p_text:
                            continue
                        
                        # If this paragraph was used as the title, skip it
                        if is_title_shape and p_idx == 0 and p_text == slide_title:
                            continue

                        norm_text = normalize_text_and_symbols(p_text)
                        if not norm_text:
                            continue

                        is_bullet = (
                            paragraph.level > 0 or
                            bool(re.match(rf'^({BULLET_REGEX_PATTERN}|\d+\.|\([a-z0-9]+\))\s*', p_text, re.IGNORECASE))
                        )
                        clean_text = re.sub(rf'^({BULLET_REGEX_PATTERN}|\d+\.|\([a-z0-9]+\))\s*', '', norm_text, flags=re.IGNORECASE)
                        el_type = "bullet_point" if is_bullet else "paragraph"
                        elements.append(ContentElement(
                            element_id=f"{sec_id}_el_{el_idx:02d}",
                            type=el_type,
                            text=clean_text or norm_text,
                            level=paragraph.level + 1,
                            metadata={"shape_name": shape.name}
                        ))
                        raw_texts.append(norm_text)
                        el_idx += 1

                elif shape.has_table:
                    table = shape.table
                    table_rows = []
                    for row in table.rows:
                        row_vals = [cell.text.strip() for cell in row.cells]
                        table_rows.append(" | ".join(row_vals))
                    table_str = "\n".join(table_rows)
                    elements.append(ContentElement(
                        element_id=f"{sec_id}_el_{el_idx:02d}",
                        type="table",
                        text=table_str,
                        metadata={"rows": len(table.rows), "cols": len(table.columns)}
                    ))
                    raw_texts.append(table_str)
                    el_idx += 1

            # 4. Speaker Notes
            if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                notes_text = slide.notes_slide.notes_text_frame.text.strip()
                if notes_text:
                    elements.append(ContentElement(
                        element_id=f"{sec_id}_el_{el_idx:02d}",
                        type="note",
                        text=notes_text,
                        metadata={"source": "speaker_notes"}
                    ))
                    raw_texts.append(f"[Note: {notes_text}]")
                    el_idx += 1

            sections.append(DocumentSection(
                section_id=sec_id,
                title=slide_title,
                order=slide_idx,
                elements=elements,
                raw_text="\n".join(raw_texts)
            ))

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return CanonicalDocumentTree(
            document_id=doc_id,
            title=overall_title,
            source_type="pptx",
            source_filename=filename,
            total_sections=len(sections),
            sections=sections,
            extraction_time_ms=round(elapsed_ms, 2),
            metadata={"slide_count": len(sections)}
        )
