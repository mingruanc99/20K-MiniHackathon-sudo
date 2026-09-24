# app/modules/extractor/normalizer.py
"""
Markdown Renderer for CLSG-IR Module 1.
Principle:
- DOCUMENT IR = SOURCE OF TRUTH
- MARKDOWN = LLM-FRIENDLY REPRESENTATION

Renders clean, structured Markdown views with clear semantic markers:
[TEXT: role], [IMAGE: role], [TABLE: role], [CHART: role], [NOTE: role]
Does NOT stuff database-heavy metadata into Markdown; leaves full fidelity in DocumentIR.
"""
from typing import List, Optional, Union
from app.models.document import DocumentSection, VisualElement
from app.models.document_ir import DocumentIR, SlideIR, DocumentElement

class ContentNormalizer:
    """
    Renders clean LLM-friendly Markdown representations from DocumentIR or SlideIR.
    """

    def render_from_document_ir(self, doc_ir: DocumentIR) -> str:
        md_lines: List[str] = []
        md_lines.append(f"# {doc_ir.title}")
        md_lines.append("")

        for slide in doc_ir.slides:
            md_lines.append("---")
            md_lines.append(f"slide_id: {slide.slide_id}")
            md_lines.append(f"title: {slide.title}")
            md_lines.append("---")
            md_lines.append("")
            md_lines.append(f"## Slide {slide.slide_id}: {slide.title}")
            md_lines.append("")

            # Sort elements by reading order
            sorted_elements = sorted(slide.elements, key=lambda e: e.reading_order)

            for el in sorted_elements:
                # Do NOT emit diagram annotations as standalone text paragraphs
                if el.type == "annotation" or el.source_type == "diagram_annotation":
                    continue

                if el.type == "text":
                    md_lines.append(f"[TEXT: {el.role}]")
                    md_lines.append(el.content or "")
                    md_lines.append("")
                elif el.type in ("image", "diagram"):
                    marker = "DIAGRAM" if el.type == "diagram" else "IMAGE"
                    md_lines.append(f"[{marker}: {el.role}]")
                    if el.type == "diagram":
                        md_lines.append(f"type: {el.type}")
                        md_lines.append(f"subtype: {el.subtype or 'unknown'}")
                        md_lines.append(f"role: {el.role}")
                        md_lines.append("")
                    img_path = el.asset_path or f"assets/slide_{slide.slide_id:02d}_{el.id}.png"
                    caption = el.caption or el.role
                    md_lines.append(f"![{caption}]({img_path})")
                    if el.description:
                        md_lines.append("")
                        md_lines.append(f"**Visual description:**\n{el.description}")
                    if el.structured_diagram and el.structured_diagram.node_count > 0:
                        md_lines.append("")
                        md_lines.append(f"**Diagram Structure:** {el.structured_diagram.node_count} nodes, {el.structured_diagram.edge_count} connections")
                    if el.caption:
                        md_lines.append("")
                        md_lines.append(f"[CAPTION]\n{el.caption}")
                    md_lines.append("")
                elif el.type == "table":
                    md_lines.append(f"[TABLE: {el.role}]")
                    if el.structured_table:
                        tbl = el.structured_table
                        headers = tbl.headers or tbl.columns
                        if headers:
                            md_lines.append("| " + " | ".join(headers) + " |")
                            md_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
                        for row in tbl.rows:
                            md_lines.append("| " + " | ".join(str(c) for c in row) + " |")
                    elif el.content:
                        md_lines.append(self._format_raw_table(el.content))
                    md_lines.append("")
                elif el.type == "chart":
                    md_lines.append(f"[CHART: {el.role}]")
                    if el.structured_chart:
                        ch = el.structured_chart
                        if ch.title:
                            md_lines.append(f"Title: {ch.title} (Type: {ch.chart_type})")
                        if ch.x_axis or ch.y_axis:
                            md_lines.append(f"Axes: X={ch.x_axis or 'N/A'}, Y={ch.y_axis or 'N/A'}")
                        if ch.data:
                            md_lines.append(f"Data: {str(ch.data)}")
                        if ch.image_path:
                            md_lines.append(f"![{ch.title or 'Chart'}]({ch.image_path})")
                    elif el.content:
                        md_lines.append(el.content)
                    md_lines.append("")
                elif el.type == "code":
                    md_lines.append(f"[CODE: {el.role}]")
                    md_lines.append("```python")
                    md_lines.append(el.content or "")
                    md_lines.append("```")
                    md_lines.append("")
                elif el.type == "equation":
                    md_lines.append(f"[EQUATION: {el.role}]")
                    md_lines.append(f"$$ {el.content or ''} $$")
                    md_lines.append("")
                elif el.type == "note":
                    md_lines.append(f"[NOTE: {el.role}]")
                    md_lines.append(el.content or "")
                    md_lines.append("")

            # Additional speaker notes if any
            if slide.speaker_notes:
                for note in slide.speaker_notes:
                    if not any(note in (el.content or "") for el in sorted_elements if el.type == "note"):
                        md_lines.append(f"[NOTE: reference]\n{note}\n")

            md_lines.append("")

        return "\n".join(md_lines)

    def normalize_to_markdown(
        self,
        doc_id: str,
        source_type: str,
        title: str,
        sections: List[DocumentSection],
        visual_elements: Optional[List[VisualElement]] = None
    ) -> str:
        """
        Legacy adapter: If raw DocumentSections are passed, converts them to clean Markdown.
        """
        visual_elements = visual_elements or []
        lines: List[str] = [f"# {title}", ""]

        for s in sections:
            lines.append("---")
            lines.append(f"slide_id: {s.order}")
            lines.append(f"title: {s.title}")
            lines.append("---")
            lines.append("")
            lines.append(f"## Slide {s.order}: {s.title}")
            lines.append("")

            # Visuals for this slide
            slide_vis = [v for v in visual_elements if v.source_slide == s.order]
            for vis in slide_vis:
                role_tag = vis.visual_role.lower().replace(" ", "_")
                lines.append(f"[IMAGE: {role_tag}]")
                lines.append(f"![{vis.caption or vis.visual_role}]({vis.storage_path or f'assets/{vis.visual_id}.png'})")
                if vis.caption:
                    lines.append(f"[CAPTION]\n{vis.caption}")
                lines.append("")

            for el in s.elements:
                if el.type == "title":
                    continue
                elif el.type == "bullet_point":
                    lines.append(f"[TEXT: concept]\n- {el.text}\n")
                elif el.type == "paragraph":
                    lines.append(f"[TEXT: concept]\n{el.text}\n")
                elif el.type == "table":
                    lines.append(f"[TABLE: comparison]\n{self._format_raw_table(el.text)}\n")
                elif el.type == "code":
                    lines.append(f"[CODE: code_walkthrough]\n```python\n{el.text}\n```\n")
                elif el.type == "equation":
                    lines.append(f"[EQUATION: mathematical_proof]\n$$ {el.text} $$\n")
                elif el.type == "note":
                    lines.append(f"[NOTE: reference]\n{el.text}\n")

            lines.append("")

        return "\n".join(lines)

    def _format_raw_table(self, table_text: str) -> str:
        rows = [r.strip() for r in table_text.strip().split("\n") if r.strip()]
        if not rows:
            return ""
        formatted = []
        for i, row in enumerate(rows):
            cells = [c.strip() for c in (row.split("|") if "|" in row else row.split("\t")) if c.strip()]
            if not cells:
                continue
            formatted.append("| " + " | ".join(cells) + " |")
            if i == 0:
                formatted.append("| " + " | ".join(["---"] * len(cells)) + " |")
        return "\n".join(formatted)
