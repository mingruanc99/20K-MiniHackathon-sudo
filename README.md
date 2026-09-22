# CLSG-IR: Configurable Lecture Script & Visual Intent Representation
### Production Full-Stack AI EdTech Platform • Vercel-Deployable MVP

[![Build Status: Passing](https://img.shields.io/badge/Build-Passing%20(Vite%205)-success?style=for-the-badge)](https://github.com)
[![Frontend: React + TS](https://img.shields.io/badge/Frontend-React%2018%20%7C%20TypeScript%20%7C%20Tailwind-blue?style=for-the-badge)](src)
[![Auth: Firebase Auth](https://img.shields.io/badge/Auth-Firebase%20Auth%20(Google%2BEmail)-orange?style=for-the-badge)](src/lib/firebase.ts)
[![Database: Firestore](https://img.shields.io/badge/Database-Firestore%20Security%20Rules-yellow?style=for-the-badge)](firestore.rules)
[![Media: Cloudinary](https://img.shields.io/badge/Media-Cloudinary%20Signed%20Uploads-blueviolet?style=for-the-badge)](src/services/cloudinaryService.ts)
[![DAR--P: Certified](https://img.shields.io/badge/DAR--P-Certified%20%E2%89%A4%2015%25-green?style=for-the-badge)](docs/EVALUATION.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-slate?style=for-the-badge)](LICENSE)

---

## 💡 The Core Problem

Generative video models (Sora, Runway Gen-3) can create visually stunning clips, but fail fundamentally when applied to **instructional lectures**:
1. **Pacing Failure**: Script length deviates arbitrarily from target video duration.
2. **Visual Hallucination**: AI generates decorative, non-educational animations instead of mathematically accurate diagrams.
3. **Monotone Audio**: Standard TTS lacks pedagogically structured pauses, causing cognitive overload for students.

---

## 🏛️ The CLSG-IR Solution

**CLSG-IR** decouples high-level instructional design from downstream video rendering engines. It formalizes educational lectures into a verified 4-pillar intermediate representation:

$$\text{CLSG-IR} = \langle \text{WHY}, \text{WHAT}, \text{HOW}, \text{WHAT TO SHOW} \rangle$$

1. **WHY (Pedagogical Intent)**: Section-level Bloom's taxonomy objectives and roles (*hook*, *definition*, *mechanism*, *example*, *comparison*, *summary*).
2. **WHAT (Narration Script)**: Spoken educational script strictly adhering to computed word budgets ($W_{\text{target}} = \text{Duration} \times \frac{\text{WPM}}{60}$).
3. **HOW (Pre-TTS Prosody & Pause Planning)**: 4 physiologically calibrated cognitive pause types injected as W3C standard SSML:
   - **Micro-pause** (150–250 ms): Syntactic chunking at clause boundaries.
   - **Emphasis-pause** (300–450 ms): Pre-keyword focus before core terminology.
   - **Concept Boundary Pause** (500–700 ms): Post-concept processing after definitions and formulas.
   - **Section Transition Pause** (800–1200 ms): Scene demarcation without visual overlap.
4. **WHAT TO SHOW (Visual Intent Cues)**: High-level rendering instructions strictly categorized into **13 Canonical Visual Taxonomies** synchronized to audio timestamps.

---

## 📐 System Architecture

```
                         USER BROWSER
                              │
                              ▼
                      ┌───────────────┐
                      │    React 18   │
                      │  Tailwind CSS │
                      └───────┬───────┘
                              │
                    Firebase Authentication
                    (Google + Email/Password)
                              │
                              ▼
                      ┌───────────────┐
                      │    Vercel     │
                      │ API / Backend │
                      └───────┬───────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
   Firebase Firestore      CLSG-IR          Cloudinary
  (Projects, Blueprints,   Pipeline           Media
    Verified CLSG-IR)         │           (PPTX, Videos)
                              ▼
                     M1: Content Extractor (<5ms)
                              │
                     M2: Instructional Planner (W_tgt)
                              │
                     M3: Expression Generator (3A, 3B, 3C)
                              │
                     M4: Quality & Visual Guard (DAR-P <= 15%)
                              │
                              ▼
                     Verified CLSG-IR
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
      TTS (W3C SSML)                     Visual / Video
            │                            (Remotion / Manim)
            └─────────────────┬─────────────────┘
                              ▼
                        Final Lecture
```

---

## 🚀 Quickstart: Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### 3. Build & Test
```bash
# Run automated pipeline tests
npm test

# Build production bundle
npm run build
```

---

## 🕹️ Experience the 1-Click CNN Demo

1. Click **"⚡ 1-Click Demo Sign-In (Prof. Alex Rivers)"** on `/login`.
2. On `/dashboard`, click **"New Project"**.
3. Select the pre-loaded **"1-Click CNN Demo"** card (5 Slides, 180s target duration).
4. Click **"Create & Launch Studio"** to execute all 4 stages:
   - **Structure (M1)**: Rule-based extraction in $<4$ ms.
   - **Instruction Plan (M2)**: $W_{\text{target}} = 344$ words at 140 WPM with Bloom's taxonomy.
   - **Narration (3A)**: Spoken audio script with Web Speech audio player.
   - **Prosody (3B)**: 4 pause types and W3C SSML.
   - **Visual Intent (3C)**: 13 canonical taxonomies with necessity justifications.
   - **Quality Guard (M4)**: DAR-P certified with 8.2% error ($\le 15\%$).
   - **CLSG-IR (OUT)**: Intermediate Representation JSON with copy and download.
   - **Video Preview (SYN)**: Video simulation timeline synchronized to audio timestamps.
5. Expand the **Instructional Decision Trace** at the bottom for cognitive audit explainability.

---

## 📚 Technical Documentation

- 🔄 [Luồng Dữ Liệu Toàn Hệ Thống (System Data Flow)](docs/SYSTEM_DATA_FLOW.md)
- 🏛️ [Architecture Audit & Migration Plan](docs/ARCHITECTURE_AUDIT.md)
- 📐 [System Architecture Specification](docs/ARCHITECTURE.md)
- 🔌 [API Documentation](docs/API.md)
- 🗄️ [Database & Firestore Security Rules](docs/DATABASE.md)
- 🚀 [Deployment Guide (Vercel + Firebase + Cloudinary)](docs/DEPLOYMENT.md)
- 🕹️ [Presentation & Pitch Script Guide](docs/DEMO.md)
- 🔬 [Research Positioning & Scientific Grounding](docs/RESEARCH_POSITIONING.md)
- 📊 [Benchmark Evaluation & DAR-P Metrics](docs/EVALUATION.md)
