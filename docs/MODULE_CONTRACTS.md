# CLSG-IR Module Data Contracts

This document formalizes the input and output data models between all pipeline modules.

---

## Module 1: Content Extractor

- **Input**: Raw document file (`.pptx`, `.docx`, `.md`, `.txt`) or raw binary bytes with filename.
- **Output**: `CanonicalDocumentTree`
  ```json
  {
    "document_id": "doc_a1b2c3d4",
    "title": "Introduction to Convolutional Neural Networks",
    "source_type": "pptx",
    "source_filename": "intro_to_cnn.pptx",
    "total_sections": 5,
    "sections": [
      {
        "section_id": "S1",
        "title": "Introduction to Convolutional Neural Networks",
        "order": 1,
        "elements": [
          { "element_id": "S1_el_01", "type": "title", "text": "..." },
          { "element_id": "S1_el_02", "type": "bullet_point", "text": "..." }
        ],
        "raw_text": "..."
      }
    ],
    "extraction_time_ms": 3.8
  }
  ```

---

## Module 2: Instructional Planner

- **Input**: `CanonicalDocumentTree`, `PipelineConfig`
- **Output**: `LessonBlueprint`
  ```json
  {
    "blueprint_id": "bp_4f8e91a0",
    "document_id": "doc_a1b2c3d4",
    "lecture_title": "Introduction to Convolutional Neural Networks",
    "total_target_duration_sec": 180,
    "total_word_budget": 344,
    "pedagogical_strategy": "Scaffolded Cognitive Progression...",
    "sections": [
      {
        "section_id": "S1",
        "title": "Introduction to Convolutional Neural Networks",
        "order": 1,
        "pedagogical_function": "hook",
        "bloom_level": "Remember",
        "target_duration_sec": 27,
        "target_word_budget": 51,
        "key_concepts": ["Computer Vision", "Pixel Grids"],
        "instructional_goal": "Recall and state the foundational relevance of CNNs."
      }
    ]
  }
  ```

---

## Module 3: Expression Generator (3A, 3B, 3C)

- **Input**: `LessonBlueprint`, `CanonicalDocumentTree`, `PipelineConfig`
- **Submodule 3A (Narration)**: Produces spoken text matching `target_word_budget`.
- **Submodule 3B (Prosody & Pause)**: Produces `ProsodyPlan` with `WordPause` objects and W3C `<speak>` SSML.
- **Submodule 3C (Visual Intent)**: Produces `VisualCue` objects strictly categorized into 13 taxonomies with audio timestamp triggers.
- **Output**: `DraftCLSG_IR`

---

## Module 4: Quality & Visual Guard

- **Input**: `DraftCLSG_IR`, `LessonBlueprint`, `CanonicalDocumentTree`, `PipelineConfig`
- **Output**: `Tuple[QualityReport, VerifiedCLSG_IR]`
  ```json
  {
    "overall_status": "PASSED",
    "overall_quality_score": 0.939,
    "dar_p_ratio": 0.101,
    "duration_error_pct": 10.1,
    "checks": [
      { "check_id": "chk_dar_p", "category": "temporal_dar_p", "status": "PASSED", "score": 0.899 },
      { "check_id": "chk_taxonomy_validity", "category": "visual_coherence", "status": "PASSED", "score": 1.0 },
      { "check_id": "chk_visual_necessity", "category": "visual_coherence", "status": "PASSED", "score": 1.0 },
      { "check_id": "chk_factual_consistency", "category": "factual_consistency", "status": "PASSED", "score": 0.954 }
    ]
  }
  ```
