# CLSG-IR Studio Demo & Evaluation Guide

A walkthrough of the lecturer flow, from uploading slides to downloading a studio-ready script. For local setup see [SETUP.md](SETUP.md).

---

## 1. Sign in

Open `http://localhost:5173/login` and use a demo sign-in, Google, or email.

## 2. Create a lecture (`/lectures/new`)

1. Upload a deck. `data/demo/cnn_intro.pptx` and `data/demo/Pose_Estimation.pptx` are ready-made samples.
2. Choose content coverage, learner level and narration language.
3. Choose how the narration is written:
   - **Theo mẫu** (template): deterministic, 0 tokens.
   - **AI viết** (LLM): pick a style (academic, conversational, rigorous, engaging, meme, engineering). Facts and formulas never change with the style.

The scan extracts the slides, reads the located pictures/tables/diagrams (VietOCR or tesseract for text and tables, Gemini for diagrams, charts and formulas; every reading is cached per image) and builds the weighted knowledge tree.

## 3. Review and generate (`/lectures/:id`)

1. Check the structure and the per-page time, then generate.
2. The result shows the quality report: DAR-P, grounding, formula integrity, style conformance and the other checks in [EVALUATION.md](../specs/EVALUATION.md). The fix panel suggests one-click repairs (duration, engine, regenerate, edit scenes).
3. Play the narration with the browser's speech engine, or edit a scene and re-check.

## 4. Export

- **Kịch bản Studio (.md)**: Video Studio handoff format (`source/HANDOFF-TEAM-KICH-BAN.md`): numbered sentences with delivery, speech (numbers spelled out, formulas moved on screen), on-screen text and the studio component, plus three quizzes. The badge shows lint results.
- **Kịch bản (.txt)**, **SSML** for TTS, **CLSG-IR (.json)**.

## 5. Advanced (`/knowledge`)

The knowledge inspector shows the weighted tree and every located visual region with its OCR reading, and lets you re-run OCR per region with a chosen engine.
