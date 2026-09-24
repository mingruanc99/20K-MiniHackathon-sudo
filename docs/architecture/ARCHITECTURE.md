# CLSG-IR System Architecture Specification
**Configurable Lecture Script & Visual Intent Representation**  
*Intermediate Representation for Instructional AI Video Synthesis*

---

## 1. System Overview & Philosophy

Current generative AI video models (Sora, Runway Gen-3, Pika) generate impressive aesthetic footage but fail fundamentally at **instructional rigor**, **temporal pacing**, and **visual-verbal synchronization**.

CLSG-IR solves this by decoupling high-level pedagogical intent from downstream rendering engines through a 4-pillar intermediate representation:

$$\text{CLSG-IR} = \langle \text{WHY}, \text{WHAT}, \text{HOW}, \text{WHAT TO SHOW} \rangle$$

1. **WHY (Pedagogical Intent)**: Target Bloom's taxonomy level, instructional function (*hook*, *definition*, *mechanism*, *example*, *comparison*, *summary*), and learning objectives.
2. **WHAT (Narration Script)**: Spoken educational script bounded by strict word count limits:
   $$W_{\text{target}} = T_{\text{net}} \times \frac{\text{WPM}}{60}$$
3. **HOW (Pre-TTS Prosody & Pause Intent)**: Structural speaking rate, pitch modulation, and 4 physiologically calibrated cognitive pause types represented via W3C compliant SSML.
4. **WHAT TO SHOW (Visual Intent Cues)**: High-level animation and rendering instructions categorized strictly into **13 Canonical Visual Taxonomies**, time-synchronized to audio seconds.

```
+-----------------------------------------------------------------------------------------+
|                                    INPUT MATERIALS                                      |
|                             (.pptx, .docx, .md, .pdf)                                   |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| MODULE 1: MULTIMODAL DOCUMENT REPRESENTATION & STRUCTURING                              |
| ├── Principle 1: DOCUMENT IR = SOURCE OF TRUTH (Elements, Layout, BBoxes, Graphs)       |
| ├── Principle 2: MARKDOWN = LLM-FRIENDLY VIEW ([TEXT: role], [IMAGE: role], etc.)       |
| ├── Principle 3: SEMANTIC CHUNK = UNIT OF REASONING (Text, Table, Chart, Multimodal)   |
| ├── 1. Element Classification (Decoupled Type & Role + Confidence + Low-Conf Fallback)   |
| ├── 2. Structured Table & Chart Extraction (Strict anti-hallucination, data: null)     |
| ├── 3. Text–Visual Association (Explicit relations: explains, describes, summarizes)   |
| ├── 4. Markdown Rendering (Semantic markers, no database bloating)                      |
| ├── 5. Hierarchical Slide-Aware Multimodal Chunking (Preserves table/chart integrity)   |
| └── Emits: CanonicalDocumentTree (with document_ir, sections[], semantic_chunks[])     |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| MODULE 2: INSTRUCTIONAL PLANNER (Preserving Global Context)                             |
| ├── Call 1: Holistic Lesson Understanding                                               |
| ├── Call 2: Content Prioritization                                                      |
| ├── Call 3: Teaching Arc Units (Bloom & Gagné Scaffolding)                              |
| ├── Optional Knowledge Augmentation (On-demand RAG for knowledge deficits)              |
| └── Emits: LessonBlueprint (with assigned_chunk_ids, primary_visual_id)                 |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| MODULE 3: SCRIPT, PROSODY & VISUAL GENERATOR                                            |
| ├── Submodule 3A: Spoken Narration Script Generator (Grounded in semantic chunks)       |
| ├── Submodule 3B: Prosody & Pause Planner (Pre-TTS Intent Layer, SSML)                   |
| ├── Submodule 3C: Visual Intent Generator (13 Canonical Visual Taxonomies)              |
| ├── Submodule 3D: Visual–Narration Alignment (Scene ──> Chunk ──> Slide ──> Visual)    |
| └── Emits: DraftCLSG_IR (DraftScene[] with SceneProvenanceTrace)                        |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| MODULE 4: QUALITY, EVALUATION & SAFETY                                                  |
| ├── A. Automated Quality Assurance & Decision Engine                                    |
| │   ├── 5 Dimensions: Content, Pedagogy, Narrative, Visual, Technical                   |
| │   ├── Structured QualityIssue[] with severity (critical, high, medium, low)          |
| │   ├── Decision Engine: [PASS] [AUTO_REPAIR] [NEEDS_REVIEW] [FAIL]                     |
| │   └── Auto-Repair Loop (temporal scaling, phrasing clean-up, max_attempts = 2)        |
| ├── B. Human-in-the-Loop Review Workspace                                               |
| │   ├── Conditional review trigger (severity high, score < 0.85, hallucination alert)   |
| │   ├── Actions: [APPROVE] [EDIT] [REGENERATE] [REJECT] [FLAG ISSUE]                    |
| │   └── 14-item Structured Issue Taxonomy checklist + severity + educator comments     |
| ├── C. User Feedback & Product Improvement Bridge                                       |
| │   ├── Behavioral Telemetry: Copy Rate, Regeneration Rate, Edit Rate, Abandonment      |
| │   ├── In-App Feedback Widget: 👍 Yes / 👎 No + complaint tags + comments              |
| │   └── Failure Pattern Aggregation: clusters error trends to continuously update model |
| ├── D. System / Cost Evaluation & Budget Guard                                          |
| │   ├── Tail Latency Monitor: P50, P95, P99 calculation                                 |
| │   ├── Cost Engine: Token economics & spend ceilings by User Tier (NORMAL vs VIP)      |
| │   └── Intelligent Model Router & 2-level Hash Invalidation Cache                      |
| ├── E. Privacy, Topic Guardrails & Golden Dataset Evaluation                            |
| │   ├── Scope & Tenant Isolation: blocks cross-user asset retrieval                     |
| │   ├── Prompt Injection Protection & Topic Guardrail with SecurityEvent logs           |
| │   └── Golden Evaluation Dataset & Regression Runner (Version N vs N+1 check)          |
| └── Emits: VerifiedCLSG_IR + Enriched QualityReport (Certified for Release)             |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| MULTI-TARGET EXPORT & OBSERVABILITY                                                     |
| ├── Verified CLSG JSON                                                                  |
| ├── Remotion React Composition Props                                                    |
| ├── Manim Python Script Skeleton                                                        |
| ├── W3C SSML Audio Files Bundle                                                         |
| └── Observability Traces (Langfuse-ready LLMTraceEvent telemetry)                       |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Module 1: Multimodal Extraction & Canonical Representation

Module 1 establishes the intermediate representation bridging heterogeneous source formats and downstream LLM reasoning:

### 2.1. Content Normalizer & Structured Markdown (Canonical IR)
Instead of feeding raw shape trees or PDF binary blocks to downstream agents, all inputs are normalized into **Structured Markdown with Domain Directives**:
```markdown
# Slide 12: YOLO Architecture Overview
> [SOURCE: doc=DOC01, slide=12, section_id=S12, type=pptx]

Object Detection is the task of locating and classifying objects simultaneously in an image.

![YOLO Architecture Diagram](assets/slide_12_img_01.png)
> [VISUAL_ROLE: role=Architecture Diagram | id=DOC01_S12_IMG01 | align=primary]

### Key Architectural Concepts
- Single regression pipeline directly from pixels to bounding box coordinates.
- S x S grid cell division predicting bounding boxes and class probabilities.

| Metric | YOLOv8 | Faster R-CNN |
| --- | --- | --- |
| mAP | 53.9 | 42.0 |
| FPS | 120 | 18 |

> [SPEAKER_NOTE: Highlight the latency difference and frame rate real-time suitability.]
```

### 2.2. Hierarchical + Semantic + Slide-Aware Chunking
Replaces naive fixed token-count splitting ($k = 500$ tokens) with instructional semantic units:
- **Slide/Page Boundary Preservation**: Chunks are never arbitrarily sliced across slide boundaries.
- **Pedagogical Chunk Classification**: `definition`, `concept`, `mechanism`, `example`, `comparison`, `code_walkthrough`, `mathematical_proof`, `summary`, `speaker_note`, `visual_explanation`.
- **Text–Visual Association**: Automatically links co-located visual elements to text chunks with association strength (`primary`, `supporting`, `contextual`).
- **Complete Provenance**: Every chunk carries `ChunkProvenance` tracking `document_id`, `source_slide`, `source_element_ids`, and line offsets.

---

## 3. Module 2: Instructional Planning & Pedagogical Scaffolding

Module 2 guarantees whole-lesson coherence before performing section-level breakdown:

1. **Global Lesson Understanding**: Reads the full canonical document tree to establish macro learning goals.
2. **Content Prioritization**: Filters core principles from auxiliary context based on the total target duration budget.
3. **Teaching Arc Construction**: Maps Gagné's 9 Instructional Events and Bloom's Revised Taxonomy levels.
4. **Deterministic Word Budgeting**:
   $$W_{\text{target}}^{(i)} = T_i \times (1 - \alpha_{\text{pause}}) \times \frac{\text{WPM}}{60}$$
   where $\alpha_{\text{pause}} \in [0.12, 0.22]$ is the cognitive pause overhead factor.
5. **Optional Knowledge Augmentation (On-demand RAG)**: Activated strictly when source materials exhibit knowledge deficits or require external definition verification.

---

## 4. Module 3: Expression Generation & Visual-Verbal Alignment

Module 3 coordinates spoken narration with temporal delivery and graphical cues:

- **Spoken Narration (3A)**: Generated strictly from assigned `SemanticChunk` references.
- **Pre-TTS Prosody & Pause Planning (3B)**: Calibrates 4 instructional pause types via W3C SSML:
  1. *Micro-pause* [150–300 ms]: Syntactic clause boundaries.
  2. *Emphasis-pause* [350–600 ms]: Pre-keyword cognitive focus spike.
  3. *Cognitive-pause* [600–1200 ms]: Post-definition consolidation.
  4. *Transition-pause* [1200–2000 ms]: Inter-scene demarcation.
- **Visual Intent Generation (3C)**: Constrained strictly to the **13 Canonical Visual Taxonomies**.
- **Visual–Narration Alignment (3D)**: Every scene records a `SceneProvenanceTrace` binding `scene_id` $\rightarrow$ `lesson_unit_id` $\rightarrow$ `chunk_ids` $\rightarrow$ `source_slide` $\rightarrow$ `associated_visual_ids`.

---

## 5. Module 4: Quality & Visual Guard Verification

Quality certification evaluates 8 pedagogical and technical dimensions:

| # | Quality Metric | Category | Passing Threshold | Description |
|---|---|---|---|---|
| 1 | **DAR-P** | `temporal_dar_p` | $\le 15\%$ (Auto-repair if 8%–25%) | Duration Adherence Ratio with Prosody |
| 2 | **13 Taxonomies** | `visual_coherence` | $100\%$ conformance | Strict adherence to canonical visual types |
| 3 | **Visual Necessity** | `visual_coherence` | $\ge 85\%$ | Anti-decorative cognitive justification check |
| 4 | **Factual Grounding**| `factual_consistency` | $\ge 85\%$ | Source entity retention ratio |
| 5 | **SSML Coherence** | `prosody_validity` | $\ge 90\%$ | Syntactic validity of SSML pause tags |
| 6 | **Content Fidelity** | `content_fidelity` | $\ge 85\%$ | Narration adherence to assigned semantic chunks |
| 7 | **Text-Visual Sync**| `text_visual_consistency` | $\ge 85\%$ | Semantic coherence between narration and visual cues |
| 8 | **Provenance Trace** | `provenance_traceability` | $\ge 90\%$ | End-to-end verifiability back to source slide/chunk |

---

## 6. LLM Gateway & Observability

CLSG-IR decouples business logic from specific model providers via `LLMGateway`:
- **Functional Abstractions**: `lesson_understanding()`, `content_prioritization()`, `teaching_arc_generation()`, `narration_generation()`, `optional_knowledge_augmentation()`.
- **Supported Providers**: Local offline models, OpenAI (`gpt-4o`), Gemini, and deterministic mock providers.
- **Langfuse Telemetry Ready**: Every LLM call records a structured `LLMTraceEvent` capturing `trace_id`, `document_id`, `chunk_id`, `lesson_unit_id`, `scene_id`, `model`, `latency_ms`, `token_estimate`, and `cost_usd`.
