# CLSG-IR Setup & Installation Guide

How to run CLSG-IR locally on Windows, macOS, or Linux. Firebase, Cloudinary and Vercel configuration are covered in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 1. Prerequisites

- Node.js 18+ and npm 10+
- A modern browser (Chrome, Edge, Firefox)
- Optional: Python 3.12 for the VietOCR region OCR service (`ocr_server/`)

---

## 2. Install and run

```bash
npm install
cp .env.example .env.local   # then fill in the Firebase / Cloudinary values
npm run dev
```

Open `http://localhost:5173`. The whole pipeline runs in the browser. `api/` only holds the Gemini proxy and the Langfuse relay, which run on Vercel (`npx vercel dev` serves them locally).

---

## 3. Optional: VietOCR for text and tables

Without it, region OCR uses tesseract.js in the browser. With it, Vietnamese text and tables are read by VietOCR. Setup is in [ocr_server/README.md](../../ocr_server/README.md). Then set:

```env
VITE_VIETOCR_URL=http://localhost:8765
```

---

## 4. Tests and build

```bash
npm test         # pipeline test suite (tests/ts/pipeline.test.js)
npm run build    # type-check + production bundle in dist/
```
