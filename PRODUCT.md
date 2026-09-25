# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences (confirmed 2026-09-25):

- **Lecturers and instructors** (university and K-12) turning their own slide decks and lesson documents into lecture scripts and lecture videos. They know their subject but are not video producers or prompt engineers. They need a lecture that fits a target length, suits their audience level, and keeps technical terms correct. They can also re-weight a lecture toward what their class got wrong.
- **Self-learners preparing for review/exams (người tự ôn)**, who upload slides, a syllabus (đề cương) and their own quiz results to get a review lecture weighted toward their weak topics.

Secondary audiences:
- **Platform admins**, who use the admin console (`/admin`) for users, content quality, LLM/TTS settings, prompts, evaluation and Langfuse telemetry.
- **Hackathon judges**, who watch the live demo. This is the near-term context, not the audience to design for.

## Product Purpose

The product takes raw teaching material (PPTX, PDF, Markdown) and compiles it into **CLSG-IR**, a checked teaching representation with four parts:

- **WHY**: pedagogical intent. Each section gets a Bloom's level and a role: hook, definition, mechanism, example, comparison or summary.
- **WHAT**: a spoken narration script that stays within a word budget, W_target = Duration × WPM / 60.
- **HOW**: prosody planned before TTS. Four kinds of cognitive pause are written out as W3C SSML.
- **WHAT TO SHOW**: visual cues from 13 standard visual types. Each cue has to state why it's needed and is synced to audio timestamps.

Rendering engines such as TTS, Manim, Remotion or video models then use this IR. Success means a lecture of the right length and level, time spent where the syllabus and the learner's gaps say it matters, no decorative visuals, and teaching decisions the user can see and trust.

## Positioning

A compiler for education, not a video generator:
- Slides are read by a rule-based parser that also locates pictures, tables, charts and diagrams. Only those located regions go to OCR (tesseract.js first for tables, scans and text; Gemini vision for diagrams, charts and pictures), never whole documents.
- Lecture time is a visible, editable weight tree (chapter → page → keyword) that can be recalibrated from a syllabus and quiz mistakes.
- Pacing is measured by DAR-P (target ≤ 15%) on the final script; every run logs its metrics and real API token usage.
- Pause intent is planned before TTS, and every visual cue must justify itself.

The comparison baseline is EduCraft (CIKM 2025). The product does **not** claim to produce raw video pixels, to have invented speech synthesis, or to make cinematic storyboards (see `docs/specs/RESEARCH_POSITIONING.md`).

## Operating Context

- Flow: sign in (Firebase, Google or email) → lecture board (columns: Đã tải lên / Cần duyệt cấu trúc / Đã tạo / Cần xem lại) → new lecture (upload, length, audience, language, writing mode; scan ≤ ~60 s) → review structure & time (optionally calibrate with syllabus + quiz results) → generate → read, listen, fix flagged issues, download script / SSML / CLSG-IR.
- "Nâng cao" (for every user) holds the full studio: M1–M4 stepper, Knowledge Inspector (weight diagram, visual regions, OCR), detailed project creation, benchmark logs.
- The main demo is the one-click CNN lesson (`data/demo/cnn_intro.pptx`, 5 slides, 180 s target).
- **Planned:** quizzes taken inside VideoLearn. The current quiz input (`QUIZ_RESULTS_AND_ANALYSIS_EXPORT` Markdown, see `source/quiz_results_analysis.md`) is a temporary sample format.

## Capabilities and Constraints

- Stack: React 18 + TypeScript + Vite + Tailwind, Firebase Auth and Firestore, Cloudinary for media, deployed on Vercel (static app + serverless functions in `api/`). The LLM is Gemini (default `gemini-3.6-flash`) behind a router, with a mock provider and a cache; users may bring their own Gemini/Claude/OpenAI/OpenRouter key. The FastAPI backend in `app/` is not deployed.
- Secrets live only on the server (`GEMINI_API_KEY`, `LANGFUSE_*` via `api/llm/gemini.js`, `api/telemetry/langfuse.js`); nothing key-like may be compiled into the browser bundle (no `VITE_` secrets).
- **The interface is Vietnamese first.** Generated content can be Vietnamese while standard English technical terms are kept (`config/technical_terms.json`).
- Terms that must stay consistent: CLSG-IR, M1–M4 module names, DAR-P, W_target, WPM, Bloom's taxonomy levels, the four pause types (micro, emphasis, concept boundary, section transition), the 13 visual taxonomies.

## Brand Commitments

- **Product name: VideoLearn** (user decision, 2026-09-25). CLSG-IR stays the name of the representation/engine.
- The visual world of the lecturer/learner surfaces may be replaced, colors and type included (user decision, 2026-09-25); the user asked that it not look like generic AI-generated UI. The "Nâng cao" studio and admin console may keep the older look.

## Evidence on Hand

- Demo lesson: `data/demo/cnn_intro.pptx`, `data/demo/cnn_demo.json`, `app/data/intro_to_cnn.pptx`.
- Sample syllabus and quiz export: `source/AI.docx`, `source/quiz_results_analysis.md`.
- Architecture and method docs: `docs/architecture/`, `docs/assets/clsg_pipeline_architecture.png`, `docs/reports/Bao_Cao_Phuong_Phap_De_Xuat_CLSG.docx`.
- Reference papers: `references/EduCraft.pdf`, `references/Prosodic.pdf`.
- Evaluation spec and run logs: `docs/specs/EVALUATION.md`, `/admin/evaluation`.
- **Missing, and must not be made up:** real user testimonials, named customer institutions, validated cost and time savings (the playbook's "$500 → < $0.50, 3 days → 30 s" figures are pitch targets, not measured results), pricing and licensing terms, Gemini 3.6 Flash pricing.

## Product Principles

1. **Show the teaching decisions.** Every generated choice (role, time weight, pause, visual cue) can be traced and explained.
2. **Teaching over decoration.** A visual or effect is justified only by what it does for the learner's understanding.
3. **Keep pacing and correctness honest.** Word budgets, the DAR-P limit, token counts and technical terminology are real measurements, never cosmetic numbers.
4. **The author stays in control.** The system compiles and suggests; the lecturer or learner configures, reviews, fixes and owns the result.
5. **Vietnamese first, precise terminology.** Serve Vietnamese users natively without translating away standard English technical terms.
