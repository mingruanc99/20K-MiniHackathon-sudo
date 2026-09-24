# app/modules/planner/planner.py
"""
Module 2: Instructional Planner
Transforms CanonicalDocumentTree + PipelineConfig into a structured LessonBlueprint.
Calculates strict per-section word budgets W_target, Bloom levels, and pedagogical roles.
"""
import uuid
from typing import List, Any, Optional, Dict
from app.models.document import CanonicalDocumentTree, DocumentSection
from app.models.config import PipelineConfig
from app.models.blueprint import LessonBlueprint, SectionPlan, BloomLevel, PedagogicalRole

class InstructionalPlanner:
    def plan(self, doc_tree: CanonicalDocumentTree, config: PipelineConfig) -> LessonBlueprint:
        inferred = config.compute_inferred()
        total_sec = config.presentation.target_duration_sec
        total_word_budget = inferred.calculated_word_budget

        num_sections = len(doc_tree.sections)
        if num_sections == 0:
            raise ValueError("Cannot create blueprint from an empty document tree.")

        # Assign pedagogical roles and duration distribution weights
        weights = self._calculate_section_weights(doc_tree.sections)
        
        # Calculate section durations ensuring sum equals total_sec exactly
        section_durations = self._distribute_durations(total_sec, weights)
        
        section_plans: List[SectionPlan] = []
        cumulative_concepts: List[str] = []

        for idx, (section, duration) in enumerate(zip(doc_tree.sections, section_durations), start=1):
            role = self._determine_pedagogical_role(idx, num_sections, section.title)
            bloom = self._determine_bloom_level(role, config.learner.target_audience)
            
            # W_target = duration * (1 - pause_overhead) * (wpm / 60)
            sec_word_budget = int(duration * (1.0 - inferred.target_pause_overhead_pct) * (config.presentation.baseline_wpm / 60.0))
            if sec_word_budget < 15:
                sec_word_budget = 15

            extracted_concepts = self._extract_key_concepts(section)
            prereqs = list(cumulative_concepts[:3]) if idx > 1 else []
            cumulative_concepts.extend(extracted_concepts)

            is_vi = config.learner.language != "en"
            goal = self._formulate_instructional_goal(section.title, role, bloom, is_vi=is_vi)

            # Match semantic chunks for this section
            matched_chunk_ids = [
                c.chunk_id for c in doc_tree.semantic_chunks
                if c.section_id == section.section_id or c.parent_id == section.section_id
            ]

            # Match primary visual element for this slide
            matching_visuals = [
                v.visual_id for v in doc_tree.visual_elements
                if v.source_slide == idx
            ]
            primary_vis = matching_visuals[0] if matching_visuals else None

            plan = SectionPlan(
                section_id=section.section_id,
                title=section.title,
                order=idx,
                pedagogical_function=role,
                bloom_level=bloom,
                target_duration_sec=duration,
                target_word_budget=sec_word_budget,
                key_concepts=extracted_concepts,
                prerequisite_concepts=prereqs,
                instructional_goal=goal,
                assigned_chunk_ids=matched_chunk_ids,
                primary_visual_id=primary_vis
            )
            section_plans.append(plan)

        blueprint_id = f"bp_{uuid.uuid4().hex[:8]}"

        return LessonBlueprint(
            blueprint_id=blueprint_id,
            document_id=doc_tree.document_id,
            lecture_title=doc_tree.title,
            total_target_duration_sec=total_sec,
            total_word_budget=sum(p.target_word_budget for p in section_plans),
            pedagogical_strategy=f"Scaffolded Cognitive Progression for {config.learner.target_audience.capitalize()} (Tone: {config.learner.tone.capitalize()})",
            sections=section_plans,
            metadata={
                "wpm": config.presentation.baseline_wpm,
                "pause_overhead_pct": inferred.target_pause_overhead_pct,
                "learner_persona": config.learner.model_dump()
            }
        )

    def plan_from_curriculum(
        self,
        curriculum: Any,
        doc_id: str,
        title: str,
        config: PipelineConfig
    ) -> LessonBlueprint:
        """
        Builds a LessonBlueprint from a duration-designed CurriculumIR.

        CRITICAL: The section order in this blueprint reflects the TOPOLOGICAL
        PREREQUISITE ORDER from the knowledge graph — NOT the original slide order.
        Different durations will produce different section sets and orderings.

        Each section carries TeachingDepth metadata specifying which cognitive
        layers the narration generator must produce for this concept at this tier.
        """
        section_plans: List[SectionPlan] = []

        role_map = {
            "epistemic_hook_reveal": "hook",
            "intuitive_analogy_walkthrough": "definition",
            "empirical_evidence_deconstruction": "mechanism",
            "comparative_tradeoff_analysis": "comparison",
            "synthesis_and_mastery": "summary"
        }

        # Resolve strategy name (handle both old and new field names)
        strategy_name = (
            getattr(curriculum, 'teaching_design_strategy', None)
            or getattr(curriculum, 'compression_strategy', 'standard_10m')
        )

        for idx, unit in enumerate(curriculum.teaching_trajectory, start=1):
            ped_role = role_map.get(unit.pedagogical_strategy, "mechanism")

            plan = SectionPlan(
                section_id=unit.unit_id,
                title=unit.unit_title,
                order=idx,
                pedagogical_function=ped_role,
                bloom_level=unit.bloom_level if unit.bloom_level in ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"] else "Understand",
                target_duration_sec=int(unit.target_duration_sec),
                target_word_budget=unit.target_word_budget,
                key_concepts=[unit.concept_id],
                prerequisite_concepts=unit.prerequisite_concept_ids,
                instructional_goal=unit.epistemic_goal,
                assigned_chunk_ids=[unit.concept_id],
                primary_visual_id=unit.primary_evidence_artifact_id
            )

            # Attach TeachingDepth as plan-level metadata if available
            depth = getattr(unit, 'depth', None)
            if depth is not None:
                plan.__dict__["teaching_depth"] = {
                    "narration_layers": depth.narration_layers,
                    "evidence_density": depth.evidence_density,
                    "bloom_ceiling": depth.bloom_ceiling,
                    "include_analogy": depth.include_analogy,
                    "include_misconception_inoculation": depth.include_misconception_inoculation,
                    "teaching_time_sec": depth.teaching_time_sec,
                }

            section_plans.append(plan)

        return LessonBlueprint(
            blueprint_id=f"bp_kcl_{uuid.uuid4().hex[:8]}",
            document_id=doc_id,
            lecture_title=title,
            total_target_duration_sec=int(curriculum.total_target_duration_sec),
            total_word_budget=sum(p.target_word_budget for p in section_plans),
            pedagogical_strategy=f"Knowledge-Centric Teaching Design ({str(strategy_name).upper()} - {curriculum.target_duration_min} min)",
            sections=section_plans,
            metadata={
                "curriculum_id": curriculum.curriculum_id,
                "teaching_design_strategy": strategy_name,
                "strategy": strategy_name,  # backward compat
                "design_rationale": getattr(curriculum, 'design_rationale', ''),
                "active_concepts": curriculum.active_concepts_count,
                "pruned_concepts": curriculum.pruned_concepts_count,
                "target_duration_min": curriculum.target_duration_min
            }
        )

    def _calculate_section_weights(self, sections: List[DocumentSection]) -> List[float]:
        n = len(sections)
        if n == 1:
            return [1.0]
        if n == 2:
            return [0.45, 0.55]
        if n == 3:
            return [0.25, 0.50, 0.25]
        
        # General n >= 4 heuristic:
        # First section (Hook/Intro): ~15%
        # Middle sections (Core mechanisms/Derivations): higher weights
        # Last section (Summary/Synthesis): ~15%
        weights = []
        for i in range(n):
            if i == 0:
                weights.append(0.15)
            elif i == n - 1:
                weights.append(0.15)
            else:
                # Distribute the remaining 70% evenly
                weights.append(0.70 / (n - 2))
        return weights

    def _distribute_durations(self, total_sec: int, weights: List[float]) -> List[int]:
        raw_durations = [w * total_sec for w in weights]
        int_durations = [max(15, int(round(d))) for d in raw_durations]
        diff = total_sec - sum(int_durations)
        
        # Adjust difference into the largest middle section
        if diff != 0:
            mid_idx = len(int_durations) // 2
            int_durations[mid_idx] += diff

        return int_durations

    def _determine_pedagogical_role(self, idx: int, total: int, title: str) -> PedagogicalRole:
        title_lower = title.lower()
        if "hook" in title_lower or "motivat" in title_lower or idx == 1:
            return "hook"
        if "summary" in title_lower or "conclusion" in title_lower or idx == total:
            return "summary"
        if "definition" in title_lower or "what is" in title_lower or "concept" in title_lower:
            return "definition"
        if "math" in title_lower or "equation" in title_lower or "algorithm" in title_lower or "mechanism" in title_lower:
            return "mechanism"
        if "vs" in title_lower or "compar" in title_lower or "difference" in title_lower:
            return "comparison"
        if "example" in title_lower or "case" in title_lower or "walkthrough" in title_lower:
            return "example"
        
        return "mechanism" if idx % 2 == 0 else "example"

    def _determine_bloom_level(self, role: PedagogicalRole, audience: str) -> BloomLevel:
        if role == "hook":
            return "Remember"
        if role == "definition":
            return "Understand"
        if role == "mechanism":
            return "Analyze" if audience in ["graduate", "professional"] else "Understand"
        if role == "example":
            return "Apply"
        if role == "comparison":
            return "Analyze"
        if role == "summary":
            return "Evaluate"
        return "Understand"

    def _extract_key_concepts(self, section: DocumentSection) -> List[str]:
        concepts = []
        # Pull meaningful capitalized or technical words from title and bullets
        candidates = [section.title] + [el.text for el in section.elements[:3]]
        for text in candidates:
            words = [w.strip(".,;:()[]{}'\"") for w in text.split()]
            for w in words:
                if len(w) > 3 and w.lower() not in ["with", "that", "this", "from", "into", "then", "slide", "section"]:
                    if w not in concepts and len(concepts) < 4:
                        concepts.append(w)
        return concepts or ["Core Concept", "Key Architecture"]

    def _formulate_instructional_goal(self, title: str, role: PedagogicalRole, bloom: BloomLevel, is_vi: bool = True) -> str:
        if not is_vi:
            verbs = {
                "Remember": "Recall and state the foundational relevance of",
                "Understand": "Explain the core mechanics and intuition behind",
                "Apply": "Demonstrate the mathematical or algorithmic application of",
                "Analyze": "Differentiate structural tradeoffs and data flow in",
                "Evaluate": "Synthesize performance criteria and critical limitations of",
                "Create": "Formulate new architectures using"
            }
            verb = verbs.get(bloom, "Explain")
            return f"{verb} {title} via an instructional {role} narrative."

        verbs_vi = {
            "Remember": "nắm vững tầm quan trọng nền tảng của",
            "Understand": "hiểu rõ bản chất và trực giác khái niệm của",
            "Apply": "vận dụng các bước thuật toán và quy trình xử lý của",
            "Analyze": "phân tích các đánh đổi về cấu trúc và hiệu quả của",
            "Evaluate": "đánh giá điểm nghẽn hiệu năng và giới hạn vận hành của",
            "Create": "tổng hợp kiến trúc hệ thống mới dựa trên"
        }
        verb_vi = verbs_vi.get(bloom, "hiểu rõ bản chất của")
        return f"{verb_vi} {title}"
