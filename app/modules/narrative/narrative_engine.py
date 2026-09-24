# app/modules/narrative/narrative_engine.py
# -*- coding: utf-8 -*-
"""
==============================================================================
NARRATIVE INTELLIGENCE LAYER (NIL) ENGINE
==============================================================================
Transforms dry instructional blueprints and document IR facts into:
  1. Epistemic curiosity loops (Curiosity before Content)
  2. Cognitive load modeling & digestive pauses (Sweller CLT)
  3. Grounded analogies for abstract concepts
  4. Conversational spoken discourse re-voicing (NotebookLM-quality)
  5. Deictic visual synchronization (pointing directly to diagram parts)
==============================================================================
"""

import datetime
from typing import List, Dict, Any, Optional
from app.models.document_ir import DocumentIR, SlideIR, DocumentElement
from app.models.blueprint import LessonBlueprint
from app.models.narrative_ir import (
    NarrativeIR,
    NarrativeBeat,
    EpistemicCuriosityGap,
    ListenerMentalState,
    AnalogyPoint,
    SpokenDiscourseBlueprint
)

class NarrativeIntelligenceEngine:
    """Engine that plans and shapes educational narrative storytelling."""

    def __init__(self, persona: str = "insightful_mentor"):
        self.persona = persona
        self._analogy_catalog = {
            "pose_estimation": {
                "source_domain": "vẽ người que (stick figure sketching)",
                "target_concept": "17 keypoints của khung xương người",
                "mapping_explanation": "Thay vì tô màu từng pixel da thịt, ta chỉ cần chấm đúng các khớp nối quan trọng như khuỷu tay và đầu gối."
            },
            "convolution": {
                "source_domain": "kính lúp soi từng ô vuông nhỏ",
                "target_concept": "kernel trượt qua ma trận ảnh",
                "mapping_explanation": "Giống như cầm kính lúp rê đều qua bức tranh để tìm ra các góc cạnh đặc trưng."
            },
            "keypoints": {
                "source_domain": "các khớp bản lề cơ thể",
                "target_concept": "tọa độ x, y và độ tin cậy c của điểm khớp",
                "mapping_explanation": "Mỗi điểm chốt đóng vai trò như một bản lề xác định tư thế chuyển động."
            }
        }

    def generate_narrative_ir(
        self,
        doc_ir: DocumentIR,
        blueprint: Optional[LessonBlueprint] = None
    ) -> NarrativeIR:
        """Constructs the comprehensive Narrative IR for the document."""
        beats: List[NarrativeBeat] = []
        total_load = 0.0

        for idx, slide in enumerate(doc_ir.slides):
            slide_id_str = f"S{slide.slide_id:02d}"
            title = slide.title or f"Slide {idx + 1}"
            text_elements = [el for el in slide.elements if el.type in ('text', 'note')]
            visual_elements = [el for el in slide.elements if el.type in ('diagram', 'image', 'chart')]
            annotation_elements = [el for el in slide.elements if el.type == 'annotation']

            # 1. Epistemic Curiosity Gap Formulation
            prompt_q = self._formulate_curiosity_question(title, text_elements, visual_elements)
            gap = EpistemicCuriosityGap(
                hook_type="epistemic_conflict",
                prompt_question=prompt_q,
                known_anchor="Máy tính có thể nhìn thấy cả khung hình ảnh pixel.",
                unknown_frontier=f"Làm sao để hệ thống hiểu được tư thế hành động cụ thể trong {title}?",
                intensity=0.85,
                grounding_element_ids=[el.id for el in text_elements[:2]]
            )

            # 2. Cognitive Load & Working Memory Tracking
            concept_count = len(text_elements) + len(visual_elements)
            cog_load = min(0.9, 0.3 + (concept_count * 0.08))
            total_load += cog_load
            mental_state = ListenerMentalState(
                cognitive_load_score=round(cog_load, 2),
                active_memory_items=min(5, max(2, len(text_elements))),
                probable_misconception="Tưởng rằng AI phải xử lý toàn bộ cơ thể thay vì chỉ dự đoán các điểm mốc then chốt.",
                requires_digestive_pause=cog_load > 0.65
            )

            # 3. Analogy Grounding
            analogy = self._find_analogy(title, text_elements)

            # 4. Spoken Discourse Blueprint & Deictic Visual Pointer
            deictic_cues = []
            if visual_elements:
                main_vis = visual_elements[0]
                deictic_cues.append({
                    "phrase": f"Các bạn hãy nhìn vào sơ đồ bên trái ({main_vis.id})",
                    "target_id": main_vis.id
                })
            if annotation_elements:
                deictic_cues.append({
                    "phrase": "Hãy để ý điểm số 0 ở phần mũi và các điểm khớp đối xứng",
                    "target_id": annotation_elements[0].id
                })

            discourse = SpokenDiscourseBlueprint(
                lead_marker="Hãy thử hình dung câu hỏi này trước nhé...",
                adversative_marker="Nhưng vấn đề thực tế là gì?",
                resultative_marker="Chính vì vậy, giải pháp ở đây rất tinh gọn:",
                digestive_pause_sec=1.2 if mental_state.requires_digestive_pause else 0.8,
                conversational_questions=[
                    "Tại sao ta không theo dõi từng pixel mà lại dùng các điểm chốt?",
                    "Nếu một cánh tay bị che khuất thì mô hình sẽ xử lý ra sao?"
                ],
                deictic_visual_cues=deictic_cues
            )

            # 5. Transitional Bridge to next slide
            next_title = doc_ir.slides[idx + 1].title if idx + 1 < len(doc_ir.slides) else "kết luận ứng dụng"
            bridge_out = f"Vậy khi đã nắm rõ cấu trúc này rồi, làm sao để kết nối các điểm lại thành hành động? Đó là phần {next_title} mà ta sẽ xem ngay sau đây."

            beat = NarrativeBeat(
                beat_id=f"beat_{idx + 1:02d}_{slide_id_str}",
                target_section_id=slide_id_str,
                timing_target_sec=45.0,
                curiosity_gap=gap,
                cognitive_goal=mental_state,
                analogy=analogy,
                spoken_discourse=discourse,
                transitional_bridge_out=bridge_out,
                grounding_refs=[el.id for el in slide.elements]
            )
            beats.append(beat)

        avg_load = total_load / max(1, len(beats))
        return NarrativeIR(
            lecture_narrative_id=f"narr_{doc_ir.document_id}",
            source_document_id=doc_ir.document_id,
            persona_archetype=self.persona,
            overall_story_arc="problem_mystery_deconstruction_mastery",
            narrative_beats=beats,
            average_cognitive_load=round(avg_load, 2),
            total_curiosity_hooks=len(beats),
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
        )

    def revoice_to_conversational(
        self,
        draft_text: str,
        beat: NarrativeBeat,
        language: str = "vi"
    ) -> str:
        """Transforms a dry summary into a dynamic, spoken-style lecture narration."""
        if not draft_text:
            return draft_text

        # 1. Opening Curiosity Hook
        hook_lead = beat.spoken_discourse.lead_marker
        curiosity_q = beat.curiosity_gap.prompt_question if beat.curiosity_gap else ""

        # 2. Deictic Visual Callout
        visual_call = ""
        if beat.spoken_discourse.deictic_visual_cues:
            visual_call = beat.spoken_discourse.deictic_visual_cues[0].get("phrase", "") + ". "

        # 3. Analogy Inclusion if available
        analogy_sentence = ""
        if beat.analogy:
            analogy_sentence = f" Các bạn cứ hình dung nó giống như {beat.analogy.source_domain}: {beat.analogy.mapping_explanation}"

        # 4. Spoken Polish: Replace written jargon with lively spoken connective tissue
        cleaned = draft_text.strip()
        cleaned = cleaned.replace("Nội dung bao gồm:", "Điểm mấu chốt ở đây chính là:")
        cleaned = cleaned.replace("Slide này trình bày", "Bây giờ chúng ta cùng phân tích sâu về")

        # 5. Assemble Conversational Narrative
        parts = []
        if curiosity_q:
            parts.append(f"{hook_lead} {curiosity_q}")
        if visual_call:
            parts.append(visual_call)
        parts.append(cleaned)
        if analogy_sentence:
            parts.append(analogy_sentence)
        if beat.transitional_bridge_out:
            parts.append(beat.transitional_bridge_out)

        return " ".join(parts)

    def _formulate_curiosity_question(
        self,
        title: str,
        text_elements: List[Any],
        visual_elements: List[Any]
    ) -> str:
        t_low = title.lower()
        if "pose" in t_low or "khung xương" in t_low or "keypoint" in t_low:
            return "Làm thế nào máy tính có thể nhận diện chính xác từng cử động của con người từ một bức ảnh tĩnh mà không bị nhầm lẫn?"
        if "cnn" in t_low or "mạng nơ-ron" in t_low:
            return "Nếu một bức ảnh có hàng triệu pixel, làm cách nào bộ não nhân tạo có thể tìm ra được đặc trưng quan trọng chỉ trong vài phần nghìn giây?"
        return f"Vì sao nguyên lý trong {title} lại là chìa khóa then chốt mà bất kỳ chuyên gia nào cũng cần nắm vững?"

    def _find_analogy(self, title: str, text_elements: List[Any]) -> Optional[AnalogyPoint]:
        combined_text = (title + " " + " ".join([e.content or "" for e in text_elements])).lower()
        for key, item in self._analogy_catalog.items():
            if key in combined_text or (key == "pose_estimation" and "pose" in combined_text):
                return AnalogyPoint(
                    source_domain=item["source_domain"],
                    target_concept=item["target_concept"],
                    mapping_explanation=item["mapping_explanation"]
                )
        return None
