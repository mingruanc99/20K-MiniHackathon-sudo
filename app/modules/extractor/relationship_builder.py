# app/modules/extractor/relationship_builder.py
"""
Text-Visual and Inter-Element Relationship Builder for CLSG-IR Module 1.
Analyzes layout adjacency, reading order, and pedagogical roles to build explicit
relationships between DocumentElements (explains, describes, summarizes, illustrates, compares).
"""
from typing import List
from app.models.document_ir import DocumentElement, ElementRelationship

class RelationshipBuilder:
    """
    Constructs explicit, directional semantic links between elements on the same slide.
    """

    def build_slide_relationships(self, elements: List[DocumentElement]) -> List[ElementRelationship]:
        relationships: List[ElementRelationship] = []
        if len(elements) < 2:
            return relationships

        # Partition elements by broad type
        text_elements = [el for el in elements if el.type in ("text", "equation", "code") and el.source_type != "diagram_annotation"]
        visual_elements = [el for el in elements if el.type in ("image", "diagram")]
        annotation_elements = [el for el in elements if el.type == "annotation" or el.source_type == "diagram_annotation"]
        table_elements = [el for el in elements if el.type == "table"]
        chart_elements = [el for el in elements if el.type == "chart"]

        # 1. Text -> Visual / Diagram (explains, describes, illustrates)
        for vis in visual_elements:
            # Check text elements on the same slide
            for txt in text_elements:
                txt_content = (txt.content or "").lower()
                vis_desc = (vis.description or vis.caption or "").lower()
                vis_subtype = (vis.subtype or "").lower()

                # Check if text explains this visual/diagram
                is_explanatory = (
                    txt.role in ("definition", "concept", "process") or
                    any(k in txt_content for k in ["điểm", "đường nối", "keypoint", "pose", "skeleton", "nose", "mũi", "mắt", "vai", "hông", "gối", "chân"]) or
                    any(k in txt_content for k in ["sơ đồ", "diagram", "kiến trúc", "flowchart", "step", "bước"])
                )

                if is_explanatory:
                    rel_type = "explains"
                    conf = 0.95
                else:
                    rel_type = "describes"
                    conf = 0.85

                # Connect text to visual
                relationships.append(ElementRelationship(
                    source_id=txt.id,
                    target_id=vis.id,
                    relation=rel_type,
                    confidence=conf
                ))

        # 2. Annotations -> Diagram (annotates)
        for anno in annotation_elements:
            target_id = anno.diagram_ref or (visual_elements[0].id if visual_elements else None)
            if target_id:
                relationships.append(ElementRelationship(
                    source_id=anno.id,
                    target_id=target_id,
                    relation="annotates",
                    confidence=1.0
                ))

        # 2. Text -> Table (summarizes, compares)
        for tbl in table_elements:
            for txt in text_elements:
                if abs(txt.reading_order - tbl.reading_order) <= 2:
                    rel_type = "compares" if tbl.role == "comparison" or txt.role == "comparison" else "summarizes"
                    relationships.append(ElementRelationship(
                        source_id=txt.id,
                        target_id=tbl.id,
                        relation=rel_type,
                        confidence=0.85
                    ))

        # 3. Text -> Chart (describes, summarizes)
        for ch in chart_elements:
            for txt in text_elements:
                if abs(txt.reading_order - ch.reading_order) <= 2:
                    relationships.append(ElementRelationship(
                        source_id=txt.id,
                        target_id=ch.id,
                        relation="describes",
                        confidence=0.85
                    ))

        return relationships

    def build_relationships(self, elements: List[DocumentElement]) -> List[ElementRelationship]:
        return self.build_slide_relationships(elements)
