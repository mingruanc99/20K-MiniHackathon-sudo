"""
VietOCR region OCR service for CLSG-IR (Module 1).

Reads one cropped region per request (text blocks, tables, scanned pages) and returns the lines in
reading order, plus a cell grid for tables. Diagrams, charts and formulas stay on Gemini vision in
the client; this service only replaces tesseract.

Engine:
  - text detection: PP-OCR det.onnx, via deepdoc_vietocr's TextDetector (Apache-2.0, InfiniFlow)
  - text recognition: VietOCR vgg_seq2seq (pip `vietocr`) with real per-line probabilities
    (upstream deepdoc_vietocr hard-codes 1.0 and loads weights from a Windows-only path)
  - table structure: deepdoc tsr.onnx + TableStructureRecognizer.construct_table

Run:
  DEEPDOC_DIR=/path/to/deepdoc_vietocr uvicorn server:app --port 8765
"""
import base64
import logging
import os
import re
import sys
import threading
import time

import cv2
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

DEEPDOC_DIR = os.path.abspath(os.environ.get("DEEPDOC_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "deepdoc_vietocr")))
WEIGHTS = os.environ.get("VIETOCR_WEIGHTS", os.path.join(DEEPDOC_DIR, "vietocr", "weight", "vgg_seq2seq.pth"))
MAX_SIDE = int(os.environ.get("OCR_MAX_SIDE", "2200"))
# Regions are ~1 slide at most; a larger payload is a client bug or abuse.
MAX_B64_BYTES = 12 * 1024 * 1024

sys.path.insert(0, DEEPDOC_DIR)
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("vietocr-server")

import module.ocr as deepdoc_ocr  # noqa: E402
from vietocr.tool.config import Cfg  # noqa: E402  (pip package, not the repo's partial copy)
from vietocr.tool.predictor import Predictor  # noqa: E402
from vietocr.tool.translate import process_input  # noqa: E402


# VietOCR squeezes every crop to <= 512 px wide at 32 px high (aspect ratio 16). A full slide line is
# far wider, so it loses words and invents others. Pieces are cut to this ratio at word gaps instead.
# Measured on synthetic Vietnamese slide lines: CER 15% (whole line) -> 3% (ratio 8).
MAX_PIECE_RATIO = 8
# A 1-2 character piece the model is unsure of is JPEG noise between words, not text.
JUNK_PIECE_PROB = 0.6
BATCH_SIZE = 32


def ink_profile(pil: Image.Image) -> np.ndarray:
    gray = np.array(pil.convert("L"))
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if (bw == 0).mean() > 0.5:  # light text on a dark background
        bw = 255 - bw
    return (bw == 0).sum(0)


def split_line(pil: Image.Image, max_ratio: int = MAX_PIECE_RATIO):
    """Cuts a line crop at its quietest columns (word gaps) so each piece is at most max_ratio wide."""
    w, h = pil.size
    if w <= h * max_ratio:
        return [pil]
    ink = ink_profile(pil)
    smooth = np.convolve(ink, np.ones(3) / 3, mode="same")
    spans, start = [], 0
    while w - start > h * max_ratio:
        lo, hi = start + int(h * max_ratio * 0.4), min(w - 1, start + int(h * max_ratio * 0.9))
        quiet = smooth[lo:hi] <= smooth[lo:hi].min() + 0.5
        # Middle of the longest quiet run: a word gap rather than the thin waist of a letter.
        best, run_start = (0, lo), None
        for i, q in enumerate(list(quiet) + [False]):
            if q and run_start is None:
                run_start = i
            elif not q and run_start is not None:
                if i - run_start > best[0]:
                    best = (i - run_start, lo + (run_start + i) // 2)
                run_start = None
        spans.append((start, best[1]))
        start = best[1]
    spans.append((start, w))
    pieces = [pil.crop((a, 0, b, h)) for a, b in spans if (ink[a:b] > 0).sum() >= max(3, h * 0.3)]
    return pieces or [pil]


class VietOcrRecognizer:
    """Drop-in for deepdoc's TextRecognizer: long lines are split, and VietOCR's own probability is returned."""

    def __init__(self, model_dir=None, device_id=None):
        config = Cfg.load_config_from_name("vgg_seq2seq")
        config["weights"] = WEIGHTS
        config["cnn"]["pretrained"] = False  # weights are loaded right after; skip the ImageNet download
        config["device"] = "cpu"
        self.predictor = Predictor(config)

    def _predict_pieces(self, pieces):
        """One seq2seq pass per BATCH_SIZE pieces: each is resized to 32 px high, then right-padded
        with its own background to a common width (predict_batch only groups identical widths)."""
        ds = self.predictor.config["dataset"]
        tensors = [process_input(p, ds["image_height"], ds["image_min_width"], ds["image_max_width"]) for p in pieces]
        out = []
        for i in range(0, len(tensors), BATCH_SIZE):
            chunk = tensors[i:i + BATCH_SIZE]
            width = max(t.shape[-1] for t in chunk)
            padded = [torch.nn.functional.pad(t, (0, width - t.shape[-1]), value=float(t[0, :, :, -1].median())) for t in chunk]
            out.extend(self._greedy_decode(torch.cat(padded, 0).to(self.predictor.device)))
        return out

    def _greedy_decode(self, batch, max_len=128, sos=1, eos=2):
        """vietocr's translate() keeps decoding finished rows until the whole batch ends and averages
        those junk steps into the probability. Here each row stops counting at its own EOS."""
        model = self.predictor.model
        model.eval()
        with torch.no_grad():
            memory = model.transformer.forward_encoder(model.cnn(batch))
            n = batch.shape[0]
            tokens = [[sos] * n]
            prob_sum = np.zeros(n)
            prob_cnt = np.zeros(n)
            done = np.zeros(n, dtype=bool)
            for _ in range(max_len):
                output, memory = model.transformer.forward_decoder(torch.LongTensor(tokens).to(batch.device), memory)
                values, indices = torch.softmax(output, dim=-1)[:, -1].max(-1)
                idx, val = indices.cpu().numpy(), values.cpu().numpy()
                live = ~done & (idx > 3)  # 0-3 are pad/sos/eos/mask
                prob_sum[live] += val[live]
                prob_cnt[live] += 1
                done |= idx == eos
                tokens.append(idx.tolist())
                if done.all():
                    break
        texts = self.predictor.vocab.batch_decode(np.asarray(tokens).T.tolist())
        return [(t, float(s / c) if c else 0.0) for t, s, c in zip(texts, prob_sum, prob_cnt)]

    def __call__(self, img_list):
        pieces, owner = [], []
        for idx, img in enumerate(img_list):
            if isinstance(img, np.ndarray):
                img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
            if img.width < 4 or img.height < 4:
                continue
            for p in split_line(img):
                pieces.append(p)
                owner.append(idx)
        parts = [[] for _ in img_list]
        for i, (text, prob) in zip(owner, self._predict_pieces(pieces) if pieces else []):
            text = text.strip()
            if text and not (len(text) <= 2 and prob < JUNK_PIECE_PROB):
                parts[i].append((text, float(prob)))
        results = []
        for kept in parts:
            # Character-weighted, so a short unsure piece does not sink a long confident line.
            prob = sum(p * len(t) for t, p in kept) / max(1, sum(len(t) for t, _ in kept)) if kept else 0.0
            results.append((" ".join(t for t, _ in kept), prob))
        return results, 0.0


deepdoc_ocr.TextRecognizer = VietOcrRecognizer

from module import LayoutRecognizer, TableStructureRecognizer  # noqa: E402

t0 = time.time()
OCR = deepdoc_ocr.OCR()
OCR.drop_score = 0.0  # keep every line; the client decides what "unsure" means
TSR = TableStructureRecognizer()
log.info("models loaded in %.1fs", time.time() - t0)
# onnxruntime sessions are thread-safe, the VietOCR torch predictor is not guaranteed to be.
LOCK = threading.Lock()

app = FastAPI(title="CLSG VietOCR")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class OcrRequest(BaseModel):
    image: str  # base64, no data: prefix
    mode: str = "text"  # "text" | "table"


def decode_image(b64: str) -> np.ndarray:
    if len(b64) > MAX_B64_BYTES:
        raise HTTPException(413, "image too large")
    try:
        buf = np.frombuffer(base64.b64decode(b64, validate=True), dtype=np.uint8)
    except Exception:
        raise HTTPException(400, "invalid base64")
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR) if buf.size else None
    if img is None:
        raise HTTPException(400, "unreadable image")
    h, w = img.shape[:2]
    # Small crops: text needs ~32px line height for VietOCR; large pages are capped for latency.
    scale = min(2.0, max(1.0, 600 / max(1, min(h, w))))
    if max(h, w) * scale > MAX_SIDE:
        scale = MAX_SIDE / max(h, w)
    if abs(scale - 1.0) > 0.05:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA)
    return img


def read_lines(img_bgr: np.ndarray):
    res = OCR(img_bgr)
    if not res or not isinstance(res, list):
        return []
    lines = []
    for box, (text, prob) in res:
        text = (text or "").strip()
        if not text:
            continue
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        lines.append({"text": text, "prob": prob, "bbox": [min(xs), min(ys), max(xs), max(ys)]})
    return lines


def markdown_to_rows(md: str):
    rows = []
    for line in md.splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue  # caption / blank
        cells = [c.strip() for c in line.strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", c) for c in cells if c):
            continue
        rows.append(cells)
    return rows


def read_table(img_bgr: np.ndarray, lines):
    """Adapted from deepdoc_vietocr full_pipeline.extract_table_markdown (Apache-2.0)."""
    if len(lines) < 4:
        return []
    pil = Image.fromarray(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
    tb_cpns = TSR([pil])[0]
    mean_h = np.mean([l["bbox"][3] - l["bbox"][1] for l in lines]) / 3
    boxes = LayoutRecognizer.sort_Y_firstly(
        [{"x0": l["bbox"][0], "x1": l["bbox"][2], "top": l["bbox"][1], "bottom": l["bbox"][3],
          "text": l["text"], "layout_type": "table", "page_number": 0} for l in lines],
        mean_h,
    )

    def gather(kwd, fzy=10, ption=0.6):
        eles = LayoutRecognizer.sort_Y_firstly([r for r in tb_cpns if re.match(kwd, r["label"])], fzy)
        eles = LayoutRecognizer.layouts_cleanup(boxes, eles, 5, ption)
        return LayoutRecognizer.sort_Y_firstly(eles, 0)

    headers = gather(r".*header$")
    rows = gather(r".* (row|header)")
    spans = gather(r".*spanning")
    clmns = sorted([r for r in tb_cpns if re.match(r"table column$", r["label"])], key=lambda x: x["x0"])
    clmns = LayoutRecognizer.layouts_cleanup(boxes, clmns, 5, 0.5)
    if not rows or len(clmns) < 2:
        return []

    for b in boxes:
        ii = LayoutRecognizer.find_overlapped_with_threashold(b, rows, thr=0.3)
        if ii is not None:
            b["R"], b["R_top"], b["R_bott"] = ii, rows[ii]["top"], rows[ii]["bottom"]
        ii = LayoutRecognizer.find_overlapped_with_threashold(b, headers, thr=0.3)
        if ii is not None:
            b.update(H=ii, H_top=headers[ii]["top"], H_bott=headers[ii]["bottom"], H_left=headers[ii]["x0"], H_right=headers[ii]["x1"])
        ii = LayoutRecognizer.find_horizontally_tightest_fit(b, clmns)
        if ii is not None:
            b.update(C=ii, C_left=clmns[ii]["x0"], C_right=clmns[ii]["x1"])
        ii = LayoutRecognizer.find_overlapped_with_threashold(b, spans, thr=0.3)
        if ii is not None:
            b.update(SP=ii, H_top=spans[ii]["top"], H_bott=spans[ii]["bottom"], H_left=spans[ii]["x0"], H_right=spans[ii]["x1"])

    md = TableStructureRecognizer.construct_table(boxes, markdown=True)
    table = markdown_to_rows(md) if isinstance(md, str) else []
    return table if len(table) >= 2 and max(len(r) for r in table) >= 2 else []


@app.get("/health")
def health():
    return {"ok": True, "engine": "vietocr-vgg_seq2seq + ppocr-det", "weights": os.path.basename(WEIGHTS)}


@app.post("/ocr")
def ocr(req: OcrRequest):
    start = time.time()
    img = decode_image(req.image)
    with LOCK:
        lines = read_lines(img)
        table = []
        if req.mode == "table":
            try:
                table = read_table(img, lines)
            except Exception as err:  # construct_table asserts on odd layouts; fall back to plain lines
                log.warning("table reconstruction failed: %s", err)
    conf = float(np.mean([l["prob"] for l in lines])) if lines else 0.0
    return {
        "text": "\n".join(l["text"] for l in lines),
        "lines": lines,
        "table": table,
        "confidence": round(conf, 4),
        "latency_ms": int((time.time() - start) * 1000),
    }
