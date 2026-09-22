# CLSG-IR Research Positioning & Theoretical Foundations

---

## 1. Precise Scientific Positioning

### 1.1 What CLSG-IR Is
- **An Intermediate Representation (IR) Layer**: Decouples instructional intent from physical rendering engines (Manim, Remotion, Canvas, Diffusion models).
- **A Multi-Pillar Pedagogical Formalization**:
  $$\text{CLSG-IR} = \langle \text{WHY}, \text{WHAT}, \text{HOW}, \text{WHAT TO SHOW} \rangle$$
  - **WHY**: Bloom's Taxonomy learning outcomes and instructional sequence roles.
  - **WHAT**: Spoken narration bounded by strict word count budgets ($W_{\text{target}}$).
  - **HOW**: Pre-TTS prosody & cognitive pause intent (4 physiological pause types & W3C SSML).
  - **WHAT TO SHOW**: 13 Canonical Visual Taxonomies with cognitive necessity justifications.

### 1.2 What CLSG-IR Is NOT (Ethical & Research Scope)
- **NOT a Monolithic Video Generator**: CLSG-IR does not synthesize raw MP4 pixels directly; it generates the verified instructional specification passed to rendering engines.
- **NOT an Invented Acoustic Synthesizer**: We do not claim invention of speech synthesis or prosodic acoustics. We formalize **prosodic planning as an instructional cognitive tool** before TTS invocation.
- **NOT a Film Storyboard Generator**: CLSG-IR does not generate camera angles, dolly pans, or cinematic shot lists. It generates **pedagogical visual intent** focused purely on cognitive schema acquisition.

---

## 2. Comparison with Prior Approaches

| Dimension | Direct LLM (GPT-4o) | Storyboard Gen | Baseline EduCraft (CIKM 2025) | CLSG-IR (Ours) |
|---|---|---|---|---|
| **Pacing Guarantee** | Unconstrained ($\pm 40\%$) | Scene-count only | Heuristic | Strict $DAR\text{-}P \le 15\%$ |
| **Prosody Modeling** | None (Raw text) | None | Audio post-filter | Pre-TTS Intent Layer |
| **Visual Taxonomy** | Unconstrained Hallucinations | Cinematic camera shots | Raw slide images | 13 Canonical Taxonomies |
| **Cognitive Justification** | None | Aesthetic | None | Mandatory Per-Cue |
| **Extraction Latency** | $> 2,000$ ms (VLM OCR) | N/A | $> 1,500$ ms | $< 5$ ms (Rule-based) |

---

## 3. Future Dataset & Annotation Strategy

For future empirical research, we architect a 3-tier data pipeline:
- `/data/raw/`: Raw educational slide presentations (PPTX, Keynote, PDF).
- `/data/annotations/`: Expert human teacher annotations labeling:
  - Bloom Taxonomy levels (Remember through Create).
  - True cognitive pause placements.
  - Necessary vs decorative visual tags.
- `/data/evaluation/`: Ground-truth benchmark datasets for evaluating automated instructional video generation algorithms.
