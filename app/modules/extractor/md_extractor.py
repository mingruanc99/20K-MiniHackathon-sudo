# app/modules/extractor/md_extractor.py
"""
Deterministic Markdown / Plain Text Extractor for CLSG-IR Module 1.
Parses headers (#, ##), bullet points, and code blocks using regex.
"""
import re
import time
import uuid
from typing import Union
from pathlib import Path
from app.models.document import CanonicalDocumentTree, DocumentSection, ContentElement
from app.modules.extractor.base import BaseExtractor

class MarkdownExtractor(BaseExtractor):
    def extract(self, source: Union[str, Path, bytes], filename: str) -> CanonicalDocumentTree:
        start_time = time.perf_counter()
        
        if isinstance(source, bytes):
            content = source.decode("utf-8", errors="replace")
        elif isinstance(source, Path) or (isinstance(source, str) and "\n" not in source and Path(source).exists()):
            with open(source, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
        else:
            content = str(source)
            
        doc_id = f"doc_{uuid.uuid4().hex[:8]}"
        overall_title = Path(filename).stem.replace("_", " ").title()

        lines = content.splitlines()
        sections = []
        current_sec_id = "S1"
        current_title = "Overview"
        current_elements = []
        raw_texts = []
        el_idx = 1
        sec_idx = 1
        in_code_block = False
        code_buffer = []

        for line in lines:
            stripped = line.strip()
            if not stripped and not in_code_block:
                continue

            # Code block handling
            if stripped.startswith("```"):
                if in_code_block:
                    in_code_block = False
                    code_text = "\n".join(code_buffer)
                    current_elements.append(ContentElement(
                        element_id=f"{current_sec_id}_el_{el_idx:02d}",
                        type="code",
                        text=code_text
                    ))
                    raw_texts.append(code_text)
                    el_idx += 1
                    code_buffer = []
                else:
                    in_code_block = True
                    code_buffer = []
                continue

            if in_code_block:
                code_buffer.append(line)
                continue

            # Heading match (# or ## or ###)
            h_match = re.match(r"^(#{1,3})\s+(.*)$", stripped)
            if h_match:
                h_level = len(h_match.group(1))
                h_text = h_match.group(2).strip()

                if h_level <= 2 and current_elements:
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

                current_title = h_text
                if sec_idx == 1 and overall_title == Path(filename).stem.replace("_", " ").title():
                    overall_title = h_text

                current_elements.append(ContentElement(
                    element_id=f"{current_sec_id}_el_{el_idx:02d}",
                    type="heading",
                    text=h_text,
                    level=h_level
                ))
                raw_texts.append(h_text)
                el_idx += 1
                continue

            # Bullet list
            if stripped.startswith(("-", "*", "+", "•")) or re.match(r"^\d+\.\s+", stripped):
                bullet_text = re.sub(r"^([-*+•]|\d+\.)\s+", "", stripped)
                current_elements.append(ContentElement(
                    element_id=f"{current_sec_id}_el_{el_idx:02d}",
                    type="bullet_point",
                    text=bullet_text,
                    level=1
                ))
                raw_texts.append(bullet_text)
                el_idx += 1
            else:
                current_elements.append(ContentElement(
                    element_id=f"{current_sec_id}_el_{el_idx:02d}",
                    type="paragraph",
                    text=stripped
                ))
                raw_texts.append(stripped)
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
            source_type="markdown",
            source_filename=filename,
            total_sections=len(sections),
            sections=sections,
            extraction_time_ms=round(elapsed_ms, 2)
        )
