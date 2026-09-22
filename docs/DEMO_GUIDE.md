# CLSG-IR Studio Demo & Evaluation Guide

This guide walks through running the CLSG-IR MVP application locally and testing its pipeline features.

---

## 1. Quickstart: Launching the App

Run the single-command entrypoint:
```bash
python app.py
```
Open your browser at:
```
http://127.0.0.1:8000
```

---

## 2. Walkthrough: 1-Click CNN Demo

1. Click the **"⚡ 1-Click CNN Demo"** button in the top navigation bar.
2. The system loads the pre-generated `app/data/intro_to_cnn.pptx` (5 slides) and executes all 4 pipeline stages in under 1 second:
   - **Module 1**: Extracts 5 slides, shapes, bullets, and speaker notes deterministically in ~4 ms.
   - **Module 2**: Allocates an instructional blueprint targeting 180s (3 minutes) and ~340 words at 140 WPM.
   - **Module 3**: Generates narration, injects 4 pause types + SSML, and generates visual cues from the 13 canonical taxonomies.
   - **Module 4**: Evaluates $DAR\text{-}P$ (achieving ~10% error, well under the 15% threshold), certifies quality, and emits `VerifiedCLSG_IR`.
3. In the **Left Column**, select any scene (S1 to S5):
   - Notice the pedagogical function badges (`HOOK`, `MECHANISM`, `EXAMPLE`, `SUMMARY`).
4. In the **Center Workspace**:
   - Inspect the **Narration & Prosody box** with color-coded pause pills (`Micro`, `Emphasis`, `Cognitive`, `Transition`).
   - Click **"▶ Spoken Narration"**: The browser's Web Speech API speaks the script aloud while observing the exact duration of each cognitive pause tag!
   - Scroll down to review the **Visual Intent Cues**, verifying that each cue belongs to one of the 13 canonical visual taxonomies with explicit instructional necessity justifications.
5. In the **Right Column**:
   - Inspect the **Quality Guard** metrics: DAR-P gauge, 100% taxonomy strictness, and live pipeline stage execution traces.

---

## 3. Testing Custom Documents

1. Click **"📁 Upload PPTX / DOCX / MD"** in the top navigation bar.
2. Select any local lecture presentation or notes file (e.g., `.pptx`, `.docx`, `.md`).
3. The server extracts the content without external LLM dependencies, plans the lecture, generates the prosody and visual cues, and presents the certified studio workspace immediately.

---

## 4. Multi-Target Export Verification

Click **"📥 Export Targets ▾"** in the top navigation bar to download:
- **Verified CLSG JSON**: The complete intermediate representation.
- **Remotion Props**: Ready-to-use JSON props for React Remotion compositions.
- **Manim Python Code**: Executable Python script utilizing `from manim import *`.
- **SSML Audio Bundle**: Formatted SSML XML files ready for commercial TTS engines (Amazon Polly, Azure Cognitive Services, ElevenLabs).
