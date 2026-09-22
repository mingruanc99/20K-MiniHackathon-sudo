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
|                             (.pptx, .docx, .md, .txt)                                   |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| MODULE 1: CONTENT EXTRACTOR                                                             |
| - Deterministic structural parsing (Zero-LLM, Zero-VLM, <50ms latency, $0 cost)          |
| - Emits: CanonicalDocumentTree                                                          |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| MODULE 2: INSTRUCTIONAL PLANNER                                                         |
| - Computes W_target, allocates section durations, assigns Bloom taxonomy levels         |
| - Emits: LessonBlueprint                                                                |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| MODULE 3: SCRIPT, PROSODY & VISUAL GENERATOR                                            |
| ├── Submodule 3A: Spoken Narration Script Generator                                      |
| ├── Submodule 3B: Prosody & Pause Planner (Pre-TTS Intent Layer, SSML)                   |
| └── Submodule 3C: Visual Intent Generator (13 Canonical Visual Taxonomies)              |
| - Emits: DraftCLSG_IR                                                                   |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| MODULE 4: QUALITY & VISUAL GUARD                                                        |
| - Temporal DAR-P Validation (|T_act - T_tgt| / T_tgt <= 15%)                             |
| - Visual Necessity Check, 13 Taxonomy Conformance, Factual Grounding                     |
| - Applies automatic temporal calibration if error is within 8% - 25%                    |
| - Emits: VerifiedCLSG_IR + QualityReport                                                |
+-----------------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------------+
| MULTI-TARGET EXPORT ENGINE                                                              |
| ├── Verified CLSG JSON                                                                  |
| ├── Remotion React Composition Props                                                    |
| ├── Manim Python Script Skeleton                                                        |
| └── W3C SSML Audio Files Bundle                                                         |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Pre-TTS Prosody & Pause Planning as an Instructional Layer

Traditional speech synthesis treats prosody as an audio post-processing effect. In CLSG-IR, prosody and pauses are **instructional cognitive tools** planned before audio synthesis:

### The 4 Instructional Pause Taxonomies
1. **Micro-pause (Syntactic Chunking)** [150–300 ms]:
   Inserted at syntactic clause boundaries, commas, and parentheticals to prevent cognitive saturation during dense sentences.
2. **Emphasis-pause (Pre-Keyword Focus)** [350–600 ms]:
   Inserted immediately prior to critical technical concepts, formulas, or terminology to induce an anticipatory cognitive spike.
3. **Cognitive-pause (Post-Concept Processing)** [600–1200 ms]:
   Inserted after key mathematical assertions or core definitions to allow working memory consolidation.
4. **Transition-pause (Inter-Scene Boundary)** [1200–2000 ms]:
   Inserted at scene conclusions to cleanly demarcate instructional blocks and allow visual scene changes without speech overlap.

---

## 3. The 13 Canonical Visual Taxonomies

To eliminate arbitrary generative hallucinations, visual intent is strictly constrained to 13 taxonomies:

| # | Taxonomy Type | Description | Representative Use Case |
|---|---|---|---|
| 1 | **Diagram Animation** | Dynamic flowcharts and entity relations | Forward pass tensor propagation |
| 2 | **Step-by-Step Code Walkthrough** | Progressive line execution and highlights | PyTorch Conv2d layer definitions |
| 3 | **Mathematical Derivation Step** | Stepwise algebraic and matrix reductions | Parameter explosion derivation |
| 4 | **Geometric Spatial Transform** | 2D/3D matrix rotations, sliding grids | 3x3 kernel sliding over 6x6 image |
| 5 | **Timeline Progression** | Chronological and developmental milestones | History from Perceptron to ResNet |
| 6 | **Data Chart Dynamic Trend** | Animated curve rendering and line updates | Training loss and validation convergence |
| 7 | **Concept Map Linkage** | Node graphs establishing semantic links | Prerequisite graph for backprop |
| 8 | **Physical World Metaphor** | Real-world grounding footage / HUD overlays | Autonomous driving pedestrian detection |
| 9 | **Architectural Block Highlight** | End-to-end multi-stage block highlighting | CNN: Conv -> ReLU -> Pool -> Dense |
| 10 | **Code Execution Trace** | Live variable watch and memory state | Memory allocation during pooling |
| 11 | **Component Zoom-in** | Spatial magnification into sub-regions | Zooming into 2x2 max-pool window |
| 12 | **Morphing Transition** | Continuous shape transformation | Vector flattening to 1D column |
| 13 | **Side-by-Side Comparison** | Split screen comparative visualization | Dense MLP vs Conv parameter count |

---

## 4. Mathematical Formulations & Quality Verification

### Word Budget Allocation
$$W_{\text{target}}^{(i)} = T_i \times (1 - \alpha_{\text{pause}}) \times \frac{\text{WPM}}{60}$$
Where $\alpha_{\text{pause}} \in [0.12, 0.22]$ is the instructional pause overhead factor.

### DAR-P (Duration Adherence Ratio with Prosody)
$$DAR\text{-}P = \frac{|T_{\text{actual}} - T_{\text{target}}|}{T_{\text{target}}} \times 100\%$$
- **PASSED**: $DAR\text{-}P \le 15\%$
- **WARNING**: $15\% < DAR\text{-}P \le 25\%$ (Automatic temporal calibration applied)
- **FAILED**: $DAR\text{-}P > 25\%$
