# VietOCR region OCR service

Replaces tesseract.js for **text, tables and scanned pages** in Module 1. Diagrams, charts and formulas stay on Gemini vision. The client routes regions and falls back to tesseract when this server is unreachable (`src/pipeline/module1_extractor/visualRegionOcr.ts`).

| Stage | Model |
|---|---|
| Text detection | PP-OCR `det.onnx` (via [deepdoc_vietocr](https://github.com/hoaivannguyen/deepdoc_vietocr), Apache-2.0 code from InfiniFlow/RAGFlow) |
| Text recognition | VietOCR `vgg_seq2seq` (pip `vietocr`), with real per-line probabilities |
| Table structure | deepdoc `tsr.onnx` + `TableStructureRecognizer.construct_table` |

Upstream deepdoc_vietocr cannot run as-is outside the author's machine. This server works around that:
- `vietocr/tool/predictor.py` is missing from the repo, so the recognizer comes from the pip `vietocr` package.
- The weight path is a Windows-only relative path. The server sets it from `DEEPDOC_DIR`.
- Line confidence is hard-coded to `1.0`. The server returns VietOCR's own `return_prob` instead.
- `cnn.pretrained=True` downloads ImageNet VGG weights (~550 MB) that get overwritten anyway. The server disables it.
- Some imports are missing from its `requirements.txt` (`vietocr`, `pycryptodomex`, `filelock`, `requests`, `StrEnum`). They are listed in ours.

Two changes to recognition itself:
- **Long lines are cut at word gaps** (width/height <= 8) before recognition. VietOCR squeezes every crop to 512 px wide, so a full slide line loses words and invents others. On our test lines this took CER from 15% to 2%.
- **Pieces are batched** (padded to one width, one decode pass) and the probability stops at each piece's own end-of-sequence token. vietocr's `translate()` averages junk steps after the end token into the probability.

## Measured (synthetic Vietnamese slide crops, CPU, 12 threads)

| Crop | CER | Confidence | Latency |
|---|---|---|---|
| 4 lines of text, 28 px, white background | 1.9% | 0.86 | ~1.0 s |
| Same, white text on blue | 2.4% | 0.86 | ~1.0 s |
| Same, half size + blur + JPEG q45 | 9.0% | 0.84 | ~1.0 s |
| Ruled table 4×3 (`mode: "table"`) | 0.0%, grid 4×3 | 0.86 | ~0.9 s |

Confidence does not separate good readings from poor ones well: 0.86 for clean text, 0.84 for the degraded crop. The client's 0.8 threshold (`VIETOCR_LOW_CONFIDENCE`) only catches really bad reads, so calibrate it on real slides. Requests run one at a time (lock around the models), so 40 regions take ~40 s.

## Run locally

```bash
git clone https://github.com/hoaivannguyen/deepdoc_vietocr.git ../deepdoc_vietocr   # ~400 MB (git-lfs)
python -m venv .venv && .venv/Scripts/activate      # Windows; source .venv/bin/activate elsewhere
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
DEEPDOC_DIR=../deepdoc_vietocr uvicorn server:app --port 8765
```

Then set `VITE_VIETOCR_URL=http://localhost:8765` in `.env` and restart `npm run dev`.

## Deploy

`docker build -t clsg-vietocr ocr_server && docker run -p 8765:8765 clsg-vietocr`

CPU is enough (~2 vCPU / 2 GB RAM). Hosts such as Hugging Face Spaces (Docker), Render or Railway work. Set `ALLOWED_ORIGINS` to the app origin, e.g. `https://clsg-ir-studio.vercel.app`, and `VITE_VIETOCR_URL` on Vercel to the public URL. Free tiers sleep when idle. The app pings `/health` as soon as a file is picked (`warmUpOcr`), but the first scan after a long idle can still hit a cold start of 30 s or more.

## API

`GET /health` returns `{ ok, engine, weights }`.

`POST /ocr` takes `{ image: "<base64 png/jpeg>", mode: "text" | "table" }` and returns:

```json
{ "text": "line 1\nline 2", "lines": [{ "text": "...", "prob": 0.97, "bbox": [x0, y0, x1, y1] }],
  "table": [["h1", "h2"], ["a", "b"]], "confidence": 0.95, "latency_ms": 840 }
```

`table` is `[]` unless `mode` is `"table"` and a grid with at least 2 rows and 2 columns was found. `confidence` is the mean line probability. The client treats readings below 0.8 as unsure and gives them to Gemini when the vision budget allows.
