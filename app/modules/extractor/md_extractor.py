# app/modules/extractor/md_extractor.py
"""
Deterministic Markdown / Plain Text Extractor for CLSG-IR Module 1.
Implements Multimodal Document Representation:
- DOCUMENT IR = SOURCE OF TRUTH (DocumentElement, SlideIR, ElementRelationship)
- MARKDOWN = LLM-FRIENDLY VIEW
- SEMANTIC CHUNK = UNIT OF REASONING
"""
import re
import time
import uuid
from typing import Union, List
from pathlib import Path

from app.models.document import CanonicalDocumentTree, DocumentSection, ContentElement, VisualElement
from app.models.document_ir import DocumentIR, SlideIR, DocumentElement
from app.modules.extractor.base import BaseExtractor
from app.modules.extractor.element_classifier import ElementClassifier
from app.modules.extractor.relationship_builder import RelationshipBuilder
from app.modules.extractor.normalizer import ContentNormalizer
from app.modules.extractor.chunker import SemanticChunker

class MarkdownExtractor(BaseExtractor):
    def __init__(self):
        self.classifier = ElementClassifier()
        self.rel_builder = RelationshipBuilder()
        self.normalizer = ContentNormalizer()
        self.chunker = SemanticChunker()

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
        slides_ir: List[SlideIR] = []
        legacy_sections: List[DocumentSection] = []

        current_sec_id = "S1"
        current_title = "Overview"
        current_elements: List[DocumentElement] = []
        legacy_elements: List[ContentElement] = []
        raw_texts: List[str] = []
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
                    current_elements.append(DocumentElement(
                        id=f"{doc_id}_S{sec_idx:02d}_el{el_idx:02d}",
                        type="code",
                        role="code_walkthrough",
                        classification_confidence=1.0,
                        reading_order=el_idx,
                        content=code_text,
                        source_slide=sec_idx
                    ))
                    legacy_elements.append(ContentElement(
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

            # Heading 1 (#) or Heading 2 (##) triggers new slide section
            if stripped.startswith("#"):
                header_match = re.match(r"^(#{1,3})\s+(.*)$", stripped)
                if not header_match:
                    continue
                hashes, h_text = header_match.groups()
                h_level = len(hashes)

                if h_level in (1, 2):
                    if current_elements:
                        relationships = self.rel_builder.build_slide_relationships(current_elements)
                        slides_ir.append(SlideIR(
                            slide_id=sec_idx,
                            section_id=current_sec_id,
                            title=current_title,
                            elements=current_elements,
                            relationships=relationships
                        ))
                        legacy_sections.append(DocumentSection(
                            section_id=current_sec_id,
                            title=current_title,
                            order=sec_idx,
                            elements=legacy_elements,
                            raw_text="\n".join(raw_texts)
                        ))
                        sec_idx += 1
                        current_sec_id = f"S{sec_idx}"
                        current_elements = []
                        legacy_elements = []
                        raw_texts = []
                        el_idx = 1

                    current_title = h_text
                    if sec_idx == 1 and h_level == 1:
                        overall_title = h_text

                el_type, el_role, conf = self.classifier.classify_text_element(h_text, is_title=True)
                current_elements.append(DocumentElement(
                    id=f"{doc_id}_S{sec_idx:02d}_el{el_idx:02d}",
                    type=el_type,
                    role=el_role,
                    classification_confidence=conf,
                    reading_order=el_idx,
                    content=h_text,
                    source_slide=sec_idx
                ))
                legacy_elements.append(ContentElement(
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
                el_type, el_role, conf = self.classifier.classify_text_element(bullet_text)
                current_elements.append(DocumentElement(
                    id=f"{doc_id}_S{sec_idx:02d}_el{el_idx:02d}",
                    type=el_type,
                    role=el_role,
                    classification_confidence=conf,
                    reading_order=el_idx,
                    content=bullet_text,
                    source_slide=sec_idx
                ))
                legacy_elements.append(ContentElement(
                    element_id=f"{current_sec_id}_el_{el_idx:02d}",
                    type="bullet_point",
                    text=bullet_text,
                    level=1
                ))
                raw_texts.append(bullet_text)
                el_idx += 1
            else:
                el_type, el_role, conf = self.classifier.classify_text_element(stripped)
                current_elements.append(DocumentElement(
                    id=f"{doc_id}_S{sec_idx:02d}_el{el_idx:02d}",
                    type=el_type,
                    role=el_role,
                    classification_confidence=conf,
                    reading_order=el_idx,
                    content=stripped,
                    source_slide=sec_idx
                ))
                legacy_elements.append(ContentElement(
                    element_id=f"{current_sec_id}_el_{el_idx:02d}",
                    type="paragraph",
                    text=stripped
                ))
                raw_texts.append(stripped)
                el_idx += 1

        if current_elements:
            relationships = self.rel_builder.build_slide_relationships(current_elements)
            slides_ir.append(SlideIR(
                slide_id=sec_idx,
                section_id=current_sec_id,
                title=current_title,
                elements=current_elements,
                relationships=relationships
            ))
            legacy_sections.append(DocumentSection(
                section_id=current_sec_id,
                title=current_title,
                order=sec_idx,
                elements=legacy_elements,
                raw_text="\n".join(raw_texts)
            ))

        doc_ir = DocumentIR(
            document_id=doc_id,
            title=overall_title,
            source_type="markdown",
            source_filename=filename,
            total_slides=len(slides_ir),
            slides=slides_ir
        )

        canonical_markdown = self.normalizer.render_from_document_ir(doc_ir)
        semantic_chunks = self.chunker.chunk_from_document_ir(doc_ir)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return CanonicalDocumentTree(
            document_id=doc_id,
            title=overall_title,
            source_type="markdown",
            source_filename=filename,
            total_sections=len(legacy_sections),
            sections=legacy_sections,
            extraction_time_ms=round(elapsed_ms, 2),
            canonical_markdown=canonical_markdown,
            semantic_chunks=semantic_chunks,
            visual_elements=[],
            document_ir=doc_ir
        )
