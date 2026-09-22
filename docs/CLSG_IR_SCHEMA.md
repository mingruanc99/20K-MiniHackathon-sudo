# Verified CLSG-IR JSON Schema Specification (v1.0.0)

The standard specification schema for Verified CLSG-IR, designed as an engine-agnostic intermediate representation.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "VerifiedCLSG_IR",
  "type": "object",
  "required": [
    "ir_version",
    "ir_id",
    "document_id",
    "blueprint_id",
    "lecture_title",
    "config",
    "total_scenes",
    "total_duration_sec",
    "total_words",
    "scenes",
    "quality_report",
    "verified_at"
  ],
  "properties": {
    "ir_version": { "type": "string", "default": "1.0.0" },
    "ir_id": { "type": "string" },
    "document_id": { "type": "string" },
    "blueprint_id": { "type": "string" },
    "lecture_title": { "type": "string" },
    "total_scenes": { "type": "integer" },
    "total_duration_sec": { "type": "number" },
    "total_words": { "type": "integer" },
    "scenes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "scene_id",
          "section_id",
          "title",
          "order",
          "pedagogical_function",
          "narration_text",
          "word_count",
          "prosody_plan",
          "visual_cues",
          "scene_start_time_sec",
          "scene_end_time_sec",
          "scene_duration_sec"
        ],
        "properties": {
          "scene_id": { "type": "string" },
          "pedagogical_function": {
            "type": "string",
            "enum": ["hook", "definition", "mechanism", "example", "comparison", "summary", "exercise"]
          },
          "narration_text": { "type": "string" },
          "word_count": { "type": "integer" },
          "scene_start_time_sec": { "type": "number" },
          "scene_end_time_sec": { "type": "number" },
          "scene_duration_sec": { "type": "number" },
          "prosody_plan": {
            "type": "object",
            "required": ["section_id", "sentences", "total_speaking_sec", "total_pause_sec", "effective_scene_duration_sec", "ssml_full"]
          },
          "visual_cues": {
            "type": "array",
            "items": {
              "type": "object",
              "required": [
                "cue_id",
                "trigger_timestamp_sec",
                "taxonomy_type",
                "element_target",
                "action",
                "visual_description",
                "necessity_justification"
              ],
              "properties": {
                "taxonomy_type": {
                  "type": "string",
                  "enum": [
                    "Diagram Animation",
                    "Step-by-Step Code Walkthrough",
                    "Mathematical Derivation Step",
                    "Geometric Spatial Transform",
                    "Timeline Progression",
                    "Data Chart Dynamic Trend",
                    "Concept Map Linkage",
                    "Physical World Metaphor",
                    "Architectural Block Highlight",
                    "Code Execution Trace",
                    "Component Zoom-in",
                    "Morphing Transition",
                    "Side-by-Side Comparison"
                  ]
                }
              }
            }
          }
        }
      }
    },
    "quality_report": { "type": "object" },
    "verified_at": { "type": "string", "format": "date-time" }
  }
}
```
