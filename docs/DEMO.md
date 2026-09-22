# CLSG-IR Live Presentation & Demo Guide
**Step-by-Step Evaluator & Pitch Script**

---

## 1. Demo Prerequisites
- Start local dev server: `npm run dev` or open production Vercel URL.
- Open browser at `http://localhost:5173`.
- No external API key required (system runs in certified Deterministic Demo Mode).

---

## 2. The 12-Step Presentation Script

### STEP 1: Academic Authentication
1. On `/login`, click **"⚡ 1-Click Demo Sign-In (Prof. Alex Rivers)"** or Sign in with Google.
2. Observe instant authentication, role attribution (`Instructor / EdTech AI Lab`), and transition to the main dashboard.

### STEP 2: Dashboard & Project Creation
1. View the main dashboard showing project metrics (Total Projects, Verified IRs, Synthesizable Duration).
2. Click **"New Project"**.

### STEP 3: Selecting Educational Material
1. In the New Project form, select the **"1-Click CNN Demo (Introduction to CNN, 5 Slides)"** card.
2. Review the pre-filled pedagogical parameters:
   - Target Duration: 180s (3 minutes).
   - Target WPM: 140 WPM.
   - Learner Level: Undergraduate University.
   - Tone: Academic & Precise.
3. Click **"Create & Launch Studio"**.

### STEP 4: Launching the Studio
1. The system loads the project and initiates the pipeline orchestrator.
2. The interactive 9-stage Stepper appears at the top.

### STEP 5: Inspecting Module 1 (Content Extractor)
1. Click stage **"Structure (M1)"**.
2. **Explain to evaluators**:
   > *"Module 1 extracts the structural hierarchy of the learning material without relying on expensive Vision-Language Models. In under 4 milliseconds, it maps slides, headings, bullet points, tables, and speaker notes into a Canonical Document Tree at zero dollar cost."*

### STEP 6: Inspecting Module 2 (Instructional Planner)
1. Click stage **"Instruction Plan (M2)"**.
2. Review the calculated word budget ($W_{\text{target}} = 344$ words) and section breakdown table.
3. **Explain to evaluators**:
   > *"Module 2 plans HOW to teach. It allocates durations according to pedagogical function (Hook: 15%, Mechanism: 50%, Summary: 15%) and maps each section to a Bloom's Taxonomy cognitive outcome."*

### STEP 7: Inspecting Module 3A (Spoken Narration)
1. Click stage **"Narration (3A)"**.
2. Click **"Speak Scene"** on Scene 3 (Convolution Operation).
3. **Explain to evaluators**:
   > *"Module 3A determines WHAT TO SAY. Rather than reading bullet points verbatim, it generates a spoken academic narrative strictly bounded by the section's word budget."*

### STEP 8: Inspecting Module 3B (Prosody & Pause Planning)
1. Click stage **"Prosody (3B)"**.
2. Review the sentence breakdown table showing the 4 pause types:
   - *Micro-pause (Syntactic)*: 150–250 ms.
   - *Emphasis-pause (Pre-Keyword)*: 300–450 ms.
   - *Concept Boundary Pause*: 500–700 ms.
   - *Section Transition Pause*: 800–1200 ms.
3. Click **"Copy SSML"** to view the W3C standard markup.
4. **Explain to evaluators**:
   > *"Module 3B is our core innovation: pre-TTS prosody planning as an instructional cognitive tool, not an audio post-processor."*

### STEP 9: Inspecting Module 3C (Visual Intent Generator)
1. Click stage **"Visual Intent (3C)"**.
2. Review the visual cards categorized into the 13 canonical taxonomies (*Process Visualization*, *Comparison*, *Diagram*).
3. **Explain to evaluators**:
   > *"Module 3C determines WHAT TO SHOW. It is strictly constrained to 13 pedagogical taxonomies. Notice that every visual cue contains an explicit cognitive necessity justification. If an animation is purely decorative, the system sets visual_need to false."*

### STEP 10: Inspecting Module 4 (Quality & Visual Guard)
1. Click stage **"Quality Guard (M4)"**.
2. Observe the quality score (94%) and the DAR-P duration adherence gauge ($8.2\%$ error $\le 15\%$).
3. **Explain to evaluators**:
   > *"Module 4 evaluates whether the generated lecture meets duration, factual grounding, and taxonomy constraints. When minor duration drift occurs, it applies automatic temporal calibration to ensure exact video pacing."*

### STEP 11: Inspecting Verified CLSG-IR Artifact
1. Click stage **"CLSG-IR (OUT)"**.
2. Review the syntax-highlighted JSON payload.
3. Click **"Download JSON"** to save `clsg_ir_verified.json`.
4. **Explain to evaluators**:
   > *"This intermediate representation is engine-agnostic. It can be fed into Remotion, Manim, ElevenLabs, or Sora with mathematically guaranteed timing."*

### STEP 12: Video Preview & Multi-Target Downstream
1. Click stage **"Video Preview (SYN)"**.
2. Click **"Play Timeline"** to watch the synchronized video simulation with dynamic visual cue transitions and captions.
3. Expand the **Instructional Decision Trace** drawer at the bottom to demonstrate complete cognitive explainability.
