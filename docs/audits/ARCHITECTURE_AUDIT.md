# ARCHITECTURE AUDIT: CLSG-IR COST-EFFICIENT & LESSON-UNDERSTANDING-FIRST EVOLUTION
**Project:** CLSG-IR (Configurable Lecture Script & Visual Intent Representation)  
**Audit Date:** 2026-09-22  
**Role:** Senior AI Architect & Full-Stack Systems Engineer  
**Objective:** Transform from a slide-by-slide summarization pipeline into a holistic Lesson-Understanding-First, cost-optimized, pedagogically grounded AI system.

---

## 1. Executive Summary & Diagnostic Findings

After a systematic audit of both the TypeScript web pipeline (`src/`) and Python core engine (`app/`), the core diagnostic finding is:

> **The current system fundamentally processes lectures slide-by-slide:**  
> `Document -> Slide Extractor -> Per-Slide Heuristic Classification -> Per-Slide Narration Generation -> Prosody -> Visual Intent -> Guard`  
>  
> Instead of:  
> `Document -> Whole-Lesson Understanding -> Global Concept Model -> Content Prioritization (Core vs Supporting vs Example vs Context vs Noise) -> Learning Dependencies & Learning Needs -> Teaching Arc -> Multi-Slide Teaching Units -> Continuous Discourse Narration + Visual Intent -> Semantic Quality Guard -> Verified CLSG-IR`

While the user interface, Firebase/Cloudinary integration, Vercel deployment, deterministic duration calibration ($W_{\text{target}} = \text{Duration} \times \text{Target WPM}$), Vietnamese-first terminology engine, and 13 visual taxonomies are solid, the **reasoning backbone needs a major architectural shift**.

---

## 2. Comprehensive Component Audit

### 2.1 Current Architecture & Pipeline Modules
1. **Module 1 (Content Extractor)** (`src/pipeline/module1_extractor/`, `app/modules/extractor/`):
   - Deterministic parsers for PPTX, PDF, DOCX, Markdown.
   - Outputs `CanonicalDocumentTree` with sections and content elements.
   - **Verdict:** Highly efficient, deterministic, 0-LLM. **Preserve completely.**

2. **Module 2 (Instructional Planner)** (`src/pipeline/module2_planner/instructionalPlanner.ts`, `src/pipeline/services/narrativePlannerService.ts`):
   - Calculates mathematical duration budget, word budget $W_{\text{target}}$, and Bloom taxonomy levels.
   - Passes sections into `narrativePlannerService.ts` which uses title-based string matching and regexes (`titleLower.includes('what is')`, `instructionalText.includes('?')`) to assign slide roles (`INTRODUCTION`, `HOOK`, `CORE_CONCEPT`, etc.).
   - Computes local slide-to-slide pairs (`relationship_to_previous`, `relationship_to_next`).
   - **Defects:**
     - Treats slides as isolated teaching cards.
     - Lacks whole-lesson comprehension: does not know what the overarching thesis, problem statement, or concept hierarchy of the lesson is.
     - Lacks content prioritization: cannot categorize elements across the whole presentation into `CORE`, `SUPPORTING`, `EXAMPLE`, `CONTEXT`, and `NOISE`.
     - Lacks concept graphs, prerequisite mapping, and learning need detection ("What question naturally arises next?").
     - Forces $1 \text{ slide} = 1 \text{ teaching unit}$.
   - **Verdict:** **Refactor into the Lesson Semantic & Instructional Planner (M2.1 - M2.10).**

3. **Module 3 (Expression Generator)** (`src/pipeline/module3_generator/`):
   - **M3A Narration Generator** (`narrationGenerator.ts`):
     - Uses rule-based string templates and benchmark cases for CNN/Keypoint.
     - Loops slide-by-slide (`blueprint.sections.map(...)`).
   - **M3B Prosody Planner** (`prosodyPlanner.ts`):
     - Computes pre-TTS prosody intent (4 pause types, speaking rate, energy, SSML).
     - **Verdict:** Complies with Section 16 (metadata intent, no heavy TTS). **Preserve and enhance.**
   - **M3C Visual Intent Generator** (`visualIntentGenerator.ts`):
     - Generates visual intent cues across 13 taxonomies with pedagogical rationale.
     - **Verdict:** Complies with Section 17 (visual intent, not full video/storyboard). **Preserve and enhance.**

4. **Module 4 (Quality & Visual Guard)** (`src/pipeline/module4_guard/qualityGuard.ts`):
   - Verifies DAR-P temporal adherence ($\le 15\%$), 13 taxonomy validity, visual necessity, factual consistency, and terminology preservation.
   - Includes FOCUS_001 - FOCUS_007 rule-based checks.
   - **Defects:**
     - Does not semantically critique whether the narration actually satisfies the learner's learning need or if it introduces future concepts too early in the teaching arc.
   - **Verdict:** **Refactor to incorporate the Semantic Critic (M4).**

### 2.2 LLM & Provider Abstraction Audit
- **Current State:**
  - `app/core/provider.py` contains a minimal `BaseLLMProvider`, `DeterministicMockProvider`, and `OpenAIProvider`.
  - In `src/` (TypeScript client), there is currently **NO provider abstraction or live LLM integration**—it relied on deterministic templates and rule heuristics.
- **Defects:**
  - No model routing between reasoning tasks and formatting tasks.
  - No Gemini 2.5 Flash / Gemini 2.5 Flash-Lite integration.
  - No caching layer for expensive semantic reasoning results.
  - No structured JSON output schema enforcement.
- **Verdict:** **Add `/src/services/llm/` with `LLMProvider.ts`, `GeminiProvider.ts`, `MockLLMProvider.ts`, and `LLMRouter.ts`.**

### 2.3 Frontend & User Experience Flow
- **Current Flow:** Upload/Demo -> Overview -> Blueprint -> Narration -> Prosody -> Visual Intent -> Quality Guard -> CLSG-IR JSON.
- **Defect:** Jumps directly from document extraction to per-slide blueprints and narration. The user cannot see that the AI understands the whole lesson first!
- **Verdict:** **Update UI with a dedicated Lesson Understanding & Content Prioritization Inspector** displaying the Lesson Goal, Concept Graph, Content Prioritization (Core/Supporting/Example/Context/Noise), Learning Needs, Teaching Arc, and Teaching Units.

---

## 3. Explicit Gap & Architectural Analysis

### 3.1 What Should Be Preserved
1. **Deterministic Document Parsing (Module 1):** PPTX, PDF, DOCX, Markdown parsing without LLM cost.
2. **Deterministic Time & Budget Allocation:** $W_{\text{target}} = \text{Duration} \times \text{Target WPM}$ with prosody pause overhead (18%-24%).
3. **Vietnamese-First + English Technical Terminology Engine:** Preserves standard CV/AI terms (`CNN`, `kernel`, `feature map`, `bounding box`, `spatial locality`).
4. **13 Visual Taxonomy Intent Structure:** Clear learning support rationale, visual necessity checking.
5. **Prosody Intent (Module 3B):** Semantic pauses, rate, and energy without heavy TTS rendering.
6. **DAR-P Temporal Calibration & Quality Reporting:** Automatic repair for temporal variance.
7. **Production Stack:** React 18, Vite, TailwindCSS, Firebase Auth/Firestore, Cloudinary, Vercel deployment.

### 3.2 What Should Be Refactored
1. **Module 2 (Instructional Planner):** Transition from per-slide duration distributor into the **Semantic Core of CLSG-IR**:
   - M2.1 Content Analysis
   - M2.2 Global Lesson Understanding
   - M2.3 Concept Extraction
   - M2.4 Concept Relationship Modeling (Concept Graph)
   - M2.5 Content Prioritization (Core, Supporting, Example, Context, Noise)
   - M2.6 Learning Dependency Analysis
   - M2.7 Learning Need Detection ("What question naturally arises?")
   - M2.8 Teaching Arc Planning (Hook -> Problem -> Motivation -> Concept -> Mechanism -> Example -> Application -> Summary)
   - M2.9 Teaching Unit Construction (Multi-slide or single-slide units)
   - M2.10 Word Budget Allocation
2. **Module 3A (Narration Generator):** Receive the Global Lesson Model, current Teaching Unit, previous/current/next concepts, prioritized content, and learning needs rather than merely summarizing isolated slide text.
3. **Module 4 (Quality Guard):** Add Semantic Critic evaluating concept satisfaction, learning need closure, and teaching arc integrity.
4. **UI Pipeline Views:** Reflect the new semantic pipeline (Lesson Understanding, Concept Relationships, Prioritization, Teaching Units).

### 3.3 What Should Be Removed
1. **Slide-by-slide heuristic classification reliance:** Eliminating fragile cascades of if/else rules based on slide titles.
2. **Hardcoded slide-to-slide bridge phrases:** Removing static generic transitions like *"Ở slide trước..."*, *"Từ nền tảng này..."*.
3. **Assumption that $1 \text{ slide} = 1 \text{ teaching unit}$.**
4. **Duplicate or unnecessary per-slide LLM calls:** Avoiding N separate LLM calls when 1 structured global comprehension call does the job.
5. **Heavyweight/irrelevant components:** Strictly no TTS voice cloning, no video rendering, no vector databases, no custom Transformers.

### 3.4 What Should Be Added
1. **`LLMProvider` Abstraction:** TypeScript interfaces for `generateLessonUnderstanding()`, `generateContentPrioritization()`, `generateTeachingPlan()`, `generateNarration()`, `generateProsody()`, `generateVisualIntent()`, `semanticCritique()`.
2. **Cost-Optimized Model Routing (`LLMRouter`):**
   - **Gemini 2.5 Flash** (Primary reasoning): Global lesson understanding, concept relationships, learning dependencies, teaching arc, semantic critique.
   - **Gemini 2.5 Flash-Lite** (Fast/low-cost): Simple narration formatting, prosody/visual intent structure, noise classification.
   - **Deterministic/Rule-based Code**: Parsing, word counting, duration math, schema validation, metadata regex, terminology normalization.
   - **MockLLMProvider**: Guaranteed 100% offline, deterministic demo mode for hackathons and zero-cost offline evaluations.
3. **Lesson Model Schema (`LessonModel`):** Formally defining concepts, relationships, dependencies, and teaching units.
4. **Content Prioritization Schema (`ContentPrioritization`):** Tracking Core, Supporting, Example, Context, and Noise.
5. **Semantic Cache (`LLMCache`):** Keyed by `sha256(document_content + config + prompt_version)` to avoid re-running expensive LLM requests on unchanged inputs.
6. **Frontend Semantic Visualizer:** Interactive cards for Concept Graphs, Content Prioritization, Learning Needs, and Teaching Units.

---

## 4. Cost & Token Optimization Strategy

| Task | Traditional Naive Approach | CLSG-IR Optimized Architecture | Cost & Token Impact |
| :--- | :--- | :--- | :--- |
| **Document Understanding** | N independent LLM calls per slide (e.g. 20 calls) | **1 Global Lesson Comprehension call** on the entire document | **~75% reduction in prompt tokens & API round-trips** |
| **Model Selection** | Calling GPT-4o / Claude 3.5 Sonnet for all tasks ($3-$15 / MTok) | **Gemini 2.5 Flash** ($0.075 / MTok input) + **Flash-Lite** ($0.0375 / MTok input) | **>95% cheaper than proprietary high-end models** |
| **Deterministic Tasks** | LLM used for word count, duration, metadata detection, format checks | **Zero-LLM TypeScript algorithms** | **$0 cost for 40% of pipeline stages** |
| **Repeated Runs** | Re-calling LLMs on every project view or minor tweak | **In-memory + localStorage Hash-based Cache** | **$0 cost on cache hits** |
| **Demo / Benchmark** | Flaky live network calls during hackathon judging | **MockLLMProvider with Golden Cases** | **100% reliable, $0 cost, 0 latency** |

---

## 5. Architectural Blueprints for Refactored Modules

```
                    DOCUMENT (PPTX / PDF / DOCX / MD)
                                    │
                                    ▼
             ┌──────────────────────────────────────────────┐
             │ Module 1: Content Extractor (0-LLM Code)     │
             └──────────────────────┬───────────────────────┘
                                    │ CanonicalDocumentTree
                                    ▼
             ┌──────────────────────────────────────────────┐
             │ Module 2.1: Global Lesson Comprehension      │
             │ (Gemini 2.5 Flash / MockLLMProvider)         │
             │ - Lesson Goal & Main Problem                 │
             │ - Concept Extraction & Relationships         │
             │ - Learning Needs & Dependencies              │
             └──────────────────────┬───────────────────────┘
                                    │ LessonModel
                                    ▼
             ┌──────────────────────────────────────────────┐
             │ Module 2.2: Content Prioritization           │
             │ - Core (Must teach)                          │
             │ - Supporting (Mention briefly)               │
             │ - Example (Clarify)                          │
             │ - Context (Background)                       │
             │ - Noise (Filter metadata & boilerplate)      │
             └──────────────────────┬───────────────────────┘
                                    │ PrioritizedContent
                                    ▼
             ┌──────────────────────────────────────────────┐
             │ Module 2.3: Teaching Arc & Unit Construction │
             │ - Scaffolds Cognitive Arc (Hook -> Summary)   │
             │ - Groups slides into Multi-Slide Units       │
             │ - Calibrates W_target per unit               │
             └──────────────────────┬───────────────────────┘
                                    │ TeachingPlan
                                    ▼
             ┌──────────────────────────────────────────────┐
             │ Module 3: Expression Generator               │
             │ 3A: Knowledge-Driven Narration (Flash-Lite)  │
             │ 3B: Prosody Pause Intent (Code + Flash-Lite) │
             │ 3C: Visual Intent Cues (13 Taxonomies)       │
             └──────────────────────┬───────────────────────┘
                                    │ Draft CLSG Scenes
                                    ▼
             ┌──────────────────────────────────────────────┐
             │ Module 4: Quality & Semantic Critic          │
             │ - DAR-P Temporal Calibration (<= 15%)        │
             │ - 13 Taxonomy & Visual Necessity Guard       │
             │ - Learning Need Satisfaction Check           │
             │ - Premature Concept / Metadata Leak Check    │
             └──────────────────────┬───────────────────────┘
                                    │
                                    ▼
                           VERIFIED CLSG-IR
```

---

## 6. Implementation Readiness
With the audit complete, the system is ready to proceed to Phase 2 (LLM Provider Abstraction) through Phase 12 (Deployment Verification) without disturbing existing working features.
