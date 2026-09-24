# app/modules/extractor/element_classifier.py
"""
Element Classifier for CLSG-IR Module 1.
Decouples:
- What the element physically IS (ElementType: text, image, table, chart, diagram, equation, code, shape, note)
- What pedagogical PURPOSE it serves (ElementRole: concept, definition, example, comparison, process, evidence, etc.)
- Assigns classification_confidence. If confidence is low, falls back gracefully without hallucinating.
"""
import re
from typing import Tuple, Optional, Any, Dict
from app.models.document_ir import ElementType, ElementRole

class ElementClassifier:
    """
    Deterministic rule-based element classifier analyzing syntax, layout cues, and vocabulary.
    """

    def classify_text_element(self, text: str, is_title: bool = False, is_note: bool = False) -> Tuple[ElementType, ElementRole, float]:
        if is_note:
            return "note", "reference", 1.0

        if not text or not text.strip():
            return "text", "decoration", 0.5

        t = text.strip()
        tl = t.lower()

        # 1. Code detection
        if (
            t.startswith("```") or
            re.search(r"\b(def |import |class |torch\.|nn\.|return |const |function )\b", t) or
            ("{" in t and "}" in t and ";" in t)
        ):
            return "code", "code_walkthrough", 0.95

        # 2. Equation detection
        if (
            t.startswith("$$") or t.startswith("$") or
            re.search(r"[∑∫√∂±×÷≤≥≠≈∈ℝ]|\bW_\{\w+\}|\b\w+\^\d+|\b\w+_\{\w+\}", t)
        ):
            return "equation", "mathematical_proof", 0.90

        # 3. Definition role
        if any(w in tl for w in ["is defined as", "refers to", "được định nghĩa là", "là một", "means that"]):
            return "text", "definition", 0.90

        # 4. Example role
        if any(w in tl for w in ["for example", "e.g.", "ví dụ", "such as", "consider an example"]):
            return "text", "example", 0.90

        # 5. Comparison role
        if any(w in tl for w in ["versus", "vs.", "so sánh", "compare", "tradeoff", "trade-off", "in contrast", "differ"]):
            return "text", "comparison", 0.90

        # 6. Process / Mechanism role
        if any(w in tl for w in ["step 1", "step 2", "pipeline", "quá trình", "cơ chế", "mechanism", "algorithm", "workflow"]):
            return "text", "process", 0.85

        # 7. Summary role
        if any(w in tl for w in ["in summary", "to conclude", "tóm lại", "kết luận", "takeaway", "recap"]):
            return "text", "summary", 0.90

        # 8. Title / Heading / Default concept
        if is_title:
            return "text", "concept", 0.95

        return "text", "concept", 0.85

    def classify_visual_element(
        self,
        name: str,
        shape_type_str: str = "",
        ocr_text: Optional[str] = None,
        context_hints: Optional[Dict[str, Any]] = None
    ) -> Tuple[ElementType, ElementRole, float]:
        name_lower = (name or "").lower()
        ocr_lower = (ocr_text or "").lower()
        hints = context_hints or {}
        combined = f"{name_lower} {ocr_lower} {str(hints).lower()}"

        # 1. Chart detection
        if any(k in combined for k in ["chart", "graph", "histogram", "bar plot", "line plot", "scatter plot", "biểu đồ"]):
            if "bar" in combined:
                return "chart", "performance_comparison", 0.95
            return "chart", "evidence", 0.90

        # 2. Architecture / Diagram detection
        if any(k in combined for k in ["architecture", "diagram", "pipeline", "schema", "flowchart", "sơ đồ", "kiến trúc"]):
            if "architecture" in combined or "pipeline" in combined:
                return "diagram", "architecture_diagram", 0.95
            return "diagram", "conceptual_diagram", 0.90

        # 3. Code / UI Screenshot
        if any(k in combined for k in ["screenshot", "terminal", "console", "ui", "giao diện"]):
            return "image", "real_world_example", 0.85

        # 4. Generic illustration vs photo
        if any(k in combined for k in ["photo", "camera", "real world", "vehicle", "pedestrian"]):
            return "image", "real_world_example", 0.80

        # 5. Low confidence fallback: do NOT guess randomly
        if len(name_lower.strip()) <= 3 or name_lower.startswith("picture") or name_lower.startswith("image"):
            return "image", "illustration", 0.60

        return "image", "illustration", 0.75

    def classify_table_element(
        self,
        headers: list,
        rows: list,
        context_title: str = ""
    ) -> Tuple[ElementType, ElementRole, float]:
        all_cells = " ".join(str(h) for h in headers) + " " + " ".join(" ".join(str(c) for c in r) for r in rows)
        combined = (all_cells + " " + context_title).lower()
        if any(k in combined for k in ["vs", "compare", "accuracy", "model", "fps", "latency", "benchmark", "performance", "so sánh"]):
            return "table", "comparison", 0.95
        if len(headers) >= 3 or (rows and len(rows[0]) >= 3):
            return "table", "comparison", 0.90
        return "table", "evidence", 0.85

    def classify_text(self, text: str, is_title: bool = False, is_note: bool = False) -> Tuple[ElementType, ElementRole, float]:
        return self.classify_text_element(text, is_title=is_title, is_note=is_note)

    def classify_table(self, table_content: Any, context_title: str = "") -> Tuple[ElementType, ElementRole, float]:
        if isinstance(table_content, str):
            lines = [l.strip() for l in table_content.split("\n") if l.strip()]
            headers = [h.strip() for h in lines[0].split("|") if h.strip()] if lines else []
            rows = [[c.strip() for c in l.split("|") if c.strip()] for l in lines[1:]]
            return self.classify_table_element(headers, rows, context_title=context_title)
        return "table", "comparison", 0.90
