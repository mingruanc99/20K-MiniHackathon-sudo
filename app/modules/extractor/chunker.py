# app/modules/extractor/chunker.py
"""
Multimodal Semantic Chunker for CLSG-IR Module 1.
Principle:
- SEMANTIC CHUNK = UNIT OF REASONING

Rules:
1. Preserves slide & section boundaries
2. Preserves table and chart integrity (never slice tables across chunks)
3. Preserves text-visual relationships (creates multimodal chunks when elements are linked)
4. Produces typed chunks: text, visual, table, chart, multimodal
5. Full provenance chain back to Document IR elements, Slide, and Source File.
"""
from typing import List, Dict, Any, Optional
from app.models.document import (
    DocumentSection,
    ContentElement,
    VisualElement,
    SemanticChunk,
    ChunkProvenance,
    TextVisualLink,
    ChunkType
)
from app.models.document_ir import DocumentIR, SlideIR, DocumentElement
from app.modules.extractor.element_classifier import ElementClassifier
from app.modules.extractor.relationship_builder import RelationshipBuilder

class SemanticChunker:
    """
    Constructs multimodal semantic reasoning units from DocumentIR.
    """

    def chunk_from_document_ir(self, doc_ir: DocumentIR) -> List[SemanticChunk]:
        chunks: List[SemanticChunk] = []

        for slide in doc_ir.slides:
            slide_id = slide.slide_id
            sec_id = slide.section_id

            # Map relationships for this slide
            rel_map: Dict[str, List[str]] = {}
            for r in slide.relationships:
                rel_map.setdefault(r.source_id, []).append(r.relation)
                rel_map.setdefault(r.target_id, []).append(r.relation)

            chunk_idx = 1
            processed_element_ids = set()
            notes = list(slide.speaker_notes or [])
            for el in slide.elements:
                if el.type == "note" and el.content and el.content not in notes:
                    notes.append(el.content)
            speaker_notes_str = " | ".join(notes) if notes else None

            # Sort elements by reading order
            sorted_elements = sorted(slide.elements, key=lambda e: e.reading_order)

            # Step 1: Detect multimodal units (Text directly explaining a Visual/Table/Chart)
            for r in slide.relationships:
                source_el = next((e for e in sorted_elements if e.id == r.source_id), None)
                target_el = next((e for e in sorted_elements if e.id == r.target_id), None)

                if source_el and target_el and source_el.id not in processed_element_ids and target_el.id not in processed_element_ids:
                    # Construct Multimodal Chunk
                    c_id = f"{doc_ir.document_id}-S{slide_id:02d}-C{chunk_idx:02d}"
                    chunk_idx += 1

                    combined_content = f"{source_el.content or ''}\n\n[{target_el.type.upper()}: {target_el.role}] {target_el.caption or target_el.content or ''}".strip()
                    words = len(combined_content.split())

                    v_links: List[TextVisualLink] = []
                    chart_refs = []
                    table_refs = []
                    vis_refs = []

                    if target_el.type in ("image", "diagram"):
                        vis_refs.append(target_el.id)
                        v_links.append(TextVisualLink(
                            visual_id=target_el.id,
                            association_strength="primary",
                            alignment_reason=f"Text {r.relation} {target_el.type}"
                        ))
                    elif target_el.type == "chart":
                        chart_refs.append(target_el.id)
                        v_links.append(TextVisualLink(
                            visual_id=target_el.id,
                            association_strength="primary",
                            alignment_reason=f"Text {r.relation} chart"
                        ))
                    elif target_el.type == "table":
                        table_refs.append(target_el.id)

                    if target_el.type == "table" and (target_el.role == "comparison" or r.relation == "compares"):
                        c_type = "comparison"
                    elif target_el.type == "chart" and target_el.role in ("performance_comparison", "comparison"):
                        c_type = "comparison"
                    else:
                        c_type = self._map_role_to_chunk_type(source_el.role)

                    chunks.append(SemanticChunk(
                        chunk_id=c_id,
                        document_id=doc_ir.document_id,
                        parent_id=sec_id,
                        section_id=sec_id,
                        chunk_category="multimodal",
                        chunk_type=c_type,
                        content=combined_content,
                        text_refs=[source_el.id],
                        visual_refs=v_links,
                        table_refs=table_refs,
                        chart_refs=chart_refs,
                        relations=[r.relation],
                        speaker_notes=speaker_notes_str,
                        word_count=words,
                        token_estimate=int(words * 1.3),
                        provenance=ChunkProvenance(
                            document_id=doc_ir.document_id,
                            source_slide=slide_id,
                            source_file_type=doc_ir.source_type,
                            source_element_ids=[source_el.id, target_el.id]
                        )
                    ))
                    processed_element_ids.add(source_el.id)
                    processed_element_ids.add(target_el.id)

            # Step 2: Process remaining elements individually preserving integrity
            for el in sorted_elements:
                if el.id in processed_element_ids:
                    continue
                # Skip diagram annotations so they do not produce noisy chunks
                if el.type == "annotation" or el.source_type == "diagram_annotation":
                    continue

                c_id = f"{doc_ir.document_id}-S{slide_id:02d}-C{chunk_idx:02d}"
                chunk_idx += 1

                if el.type == "table":
                    # Table chunk preserving full matrix
                    tbl_content = f"Table ({el.role}):\n"
                    if el.structured_table:
                        tbl = el.structured_table
                        headers = tbl.headers or tbl.columns
                        if headers:
                            tbl_content += " | ".join(headers) + "\n"
                        for row in tbl.rows:
                            tbl_content += " | ".join(str(c) for c in row) + "\n"
                    else:
                        tbl_content += el.content or ""

                    words = len(tbl_content.split())
                    chunks.append(SemanticChunk(
                        chunk_id=c_id,
                        document_id=doc_ir.document_id,
                        parent_id=sec_id,
                        section_id=sec_id,
                        chunk_category="table",
                        chunk_type="comparison",
                        content=tbl_content.strip(),
                        text_refs=[],
                        table_refs=[el.id],
                        speaker_notes=speaker_notes_str,
                        word_count=words,
                        token_estimate=int(words * 1.3),
                        provenance=ChunkProvenance(
                            document_id=doc_ir.document_id,
                            source_slide=slide_id,
                            source_file_type=doc_ir.source_type,
                            source_element_ids=[el.id]
                        )
                    ))
                    processed_element_ids.add(el.id)

                elif el.type == "chart":
                    # Chart chunk preserving metadata without hallucination
                    ch_content = f"Chart ({el.role}): {el.caption or ''}\n"
                    if el.structured_chart:
                        ch = el.structured_chart
                        if ch.title:
                            ch_content += f"Title: {ch.title} | Type: {ch.chart_type}\n"
                        if ch.x_axis or ch.y_axis:
                            ch_content += f"Axes: X={ch.x_axis or 'N/A'}, Y={ch.y_axis or 'N/A'}\n"
                        if ch.data:
                            ch_content += f"Data: {str(ch.data)}\n"

                    words = len(ch_content.split())
                    chunks.append(SemanticChunk(
                        chunk_id=c_id,
                        document_id=doc_ir.document_id,
                        parent_id=sec_id,
                        section_id=sec_id,
                        chunk_category="chart",
                        chunk_type="comparison" if "comparison" in el.role else "concept",
                        content=ch_content.strip(),
                        text_refs=[],
                        chart_refs=[el.id],
                        visual_refs=[TextVisualLink(visual_id=el.id, association_strength="primary", alignment_reason=el.role)],
                        speaker_notes=speaker_notes_str,
                        word_count=words,
                        token_estimate=int(words * 1.3),
                        provenance=ChunkProvenance(
                            document_id=doc_ir.document_id,
                            source_slide=slide_id,
                            source_file_type=doc_ir.source_type,
                            source_element_ids=[el.id]
                        )
                    ))
                    processed_element_ids.add(el.id)

                elif el.type in ("image", "diagram"):
                    desc = el.description or el.caption or el.role
                    vis_content = f"{el.type.capitalize()} ({el.role}): {desc}"
                    words = len(vis_content.split())
                    chunks.append(SemanticChunk(
                        chunk_id=c_id,
                        document_id=doc_ir.document_id,
                        parent_id=sec_id,
                        section_id=sec_id,
                        chunk_category="visual",
                        chunk_type="visual_explanation",
                        content=vis_content,
                        text_refs=[],
                        visual_refs=[TextVisualLink(visual_id=el.id, association_strength="primary", alignment_reason=el.role)],
                        speaker_notes=speaker_notes_str,
                        word_count=words,
                        token_estimate=int(words * 1.3),
                        provenance=ChunkProvenance(
                            document_id=doc_ir.document_id,
                            source_slide=slide_id,
                            source_file_type=doc_ir.source_type,
                            source_element_ids=[el.id]
                        )
                    ))
                    processed_element_ids.add(el.id)

                elif el.type in ("text", "equation", "code", "note"):
                    content_str = el.content or ""
                    words = len(content_str.split())
                    c_type = self._map_role_to_chunk_type(el.role)

                    chunks.append(SemanticChunk(
                        chunk_id=c_id,
                        document_id=doc_ir.document_id,
                        parent_id=sec_id,
                        section_id=sec_id,
                        chunk_category="text",
                        chunk_type=c_type,
                        content=content_str,
                        text_refs=[el.id],
                        speaker_notes=speaker_notes_str,
                        word_count=words,
                        token_estimate=int(words * 1.3),
                        provenance=ChunkProvenance(
                            document_id=doc_ir.document_id,
                            source_slide=slide_id,
                            source_file_type=doc_ir.source_type,
                            source_element_ids=[el.id]
                        )
                    ))
                    processed_element_ids.add(el.id)

            # If slide was completely empty
            if chunk_idx == 1 and not slide.elements:
                c_id = f"{doc_ir.document_id}-S{slide_id:02d}-C01"
                chunks.append(SemanticChunk(
                    chunk_id=c_id,
                    document_id=doc_ir.document_id,
                    parent_id=sec_id,
                    section_id=sec_id,
                    chunk_category="text",
                    chunk_type="concept",
                    content=slide.title,
                    text_refs=[],
                    speaker_notes=speaker_notes_str,
                    word_count=len(slide.title.split()),
                    token_estimate=int(len(slide.title.split()) * 1.3),
                    provenance=ChunkProvenance(
                        document_id=doc_ir.document_id,
                        source_slide=slide_id,
                        source_file_type=doc_ir.source_type,
                        source_element_ids=[]
                    )
                ))

        return chunks

    def _map_role_to_chunk_type(self, role: str) -> ChunkType:
        if role in ("definition", "concept", "mechanism", "example", "comparison", "summary"):
            return role  # type: ignore
        if role in ("architecture_diagram", "conceptual_diagram"):
            return "visual_explanation"
        if role == "code_walkthrough":
            return "code_walkthrough"
        if role == "mathematical_proof":
            return "mathematical_proof"
        if role == "reference":
            return "speaker_note"
        return "concept"

    def chunk_document(
        self,
        doc_id: str,
        source_type: str,
        sections: List[DocumentSection],
        visual_elements: Optional[List[VisualElement]] = None
    ) -> List[SemanticChunk]:
        """
        Legacy adapter for extractors still passing DocumentSections.
        Builds a lightweight DocumentIR and chunks it.
        """
        classifier = ElementClassifier()
        rel_builder = RelationshipBuilder()
        slides: List[SlideIR] = []
        for s in sections:
            elements: List[DocumentElement] = []
            el_order = 1
            for el in s.elements:
                if el.type == "table":
                    el_type, el_role, _ = classifier.classify_table(el.text)
                elif el.type == "code":
                    el_type = "code"
                    el_role = "code_walkthrough"
                elif el.type == "equation":
                    el_type = "equation"
                    el_role = "concept"
                elif el.type == "note":
                    el_type = "note"
                    el_role = "reference"
                else:
                    el_type, el_role, _ = classifier.classify_text(el.text)

                elements.append(DocumentElement(
                    id=f"{s.section_id}_{el.element_id}",
                    type=el_type,
                    role=el_role,
                    reading_order=el_order,
                    content=el.text,
                    source_slide=s.order
                ))
                el_order += 1

            # Match visuals
            if visual_elements:
                for v in visual_elements:
                    if v.source_slide == s.order:
                        v_role = v.visual_role.lower().replace(" ", "_") if v.visual_role else "illustration"
                        elements.append(DocumentElement(
                            id=v.visual_id,
                            type="image",
                            role=v_role,
                            reading_order=el_order,
                            caption=v.caption,
                            asset_path=v.storage_path,
                            source_slide=s.order
                        ))
                        el_order += 1

            relationships = rel_builder.build_relationships(elements)

            slides.append(SlideIR(
                slide_id=s.order,
                section_id=s.section_id,
                title=s.title,
                elements=elements,
                relationships=relationships
            ))

        doc_ir = DocumentIR(
            document_id=doc_id,
            title=sections[0].title if sections else "Untitled",
            source_type=source_type,
            source_filename=f"{doc_id}.{source_type}",
            total_slides=len(slides),
            slides=slides
        )
        return self.chunk_from_document_ir(doc_ir)
