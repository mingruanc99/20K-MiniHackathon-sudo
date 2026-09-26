// src/pipeline/module1_extractor/visualRegionOcr.ts
/**
 * Region OCR: reads only the located visual regions (never whole documents).
 *
 * Engine routing (preference "auto"):
 *   - diagrams / charts: Gemini vision first (structure, not just labels), within the scan's small
 *     vision budget (`maxLlmCalls`); the text engine reads their labels once the budget is spent.
 *   - text, tables, scanned pages, manual regions, pictures: the text engine first. That is VietOCR
 *     (ocr_server/, trained for Vietnamese diacritics, table structure model) when VITE_VIETOCR_URL is
 *     set and the server answers, else tesseract.js. Gemini re-reads a crop only when the text engine
 *     failed, is unsure, or the reading looks like a formula (neither text engine reads math), and
 *     never for plain pictures.
 * Preferences "vietocr" / "tesseract" / "gemini" force one engine (with the others as fallback).
 * Every Gemini/VietOCR reading is cached by crop hash (regionOcrCache), so an image is paid for once.
 * Native regions (PPTX tables, chart XML, SmartArt) already carry their data and are skipped.
 *
 * Before tesseract, crops are upscaled so text reaches ~30px x-height, converted to grayscale,
 * contrast-stretched, Otsu-binarized when the background is colored, and stripped of table rules
 * and box borders (they wreck tesseract's layout analysis). The rule positions are kept and used as
 * the table grid: each recognized word goes to the cell its center falls in.
 * tesseract.js is lazy-loaded from jsDelivr (pinned) and runs as a small worker pool; call
 * `warmUpTesseract()` early (e.g. on the upload page) so its first-load download is off the scan clock.
 */
import { CanonicalDocumentTree, ContentElement, RegionOcrResult, VisualRegion } from '../../types';
import { llmRouter } from '../../services/llm/LLMRouter';
import type { LLMImageInput } from '../../services/llm/GeminiProvider';
import { regionAssetStore } from './regionAssets';
import { getCachedReading, putCachedReading, regionImageKey } from './regionOcrCache';

export type OcrPreference = 'auto' | 'vietocr' | 'tesseract' | 'gemini';

export interface RegionOcrOptions {
  concurrency: number;
  maxRegionsPerPage: number;
  maxRegionsTotal: number;
  /** Absolute timestamp (performance.now()) after which pending regions are skipped. */
  deadline: number;
  preference?: OcrPreference;
  /** Max Gemini vision calls in this run (fallback re-reads under "auto"). Default 3. */
  maxLlmCalls?: number;
  onProgress?: (done: number, total: number) => void;
}

const OCR_SYSTEM =
  'You read one cropped region of a lecture slide or page. Transcribe faithfully; never invent content that is not visible.';

const OCR_PROMPT = `Classify and transcribe this image region from a lecture document.
Return JSON:
{
  "content_type": "table" | "diagram" | "chart" | "text" | "formula" | "photo",
  "is_decorative": boolean,            // true for logos, stock photos, backgrounds with no teachable content
  "text": "all readable text in reading order",
  "table": [["header1","header2"],["r1c1","r1c2"]],   // only for tables or charts with data; [] otherwise
  "nodes": ["box/label text"],                         // only for diagrams/flowcharts; [] otherwise
  "edges": [{"from":"node text","to":"node text","label":"optional"}],
  "summary": "one sentence in Vietnamese: what this visual shows and why it matters for the lesson",
  "confidence": 0.0-1.0
}
Keep original language and technical terms. Keep numbers exactly.`;

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const TESSERACT_POOL = 2;
/** Below this mean word confidence (0-100) a tesseract reading is considered unreliable. */
const LOW_CONFIDENCE = 62;
/** Below this mean line probability (0-1) a VietOCR reading is considered unreliable. */
const VIETOCR_LOW_CONFIDENCE = 0.8;
const VIETOCR_URL = (import.meta.env?.VITE_VIETOCR_URL || '').replace(/\/+$/, '');
const VIETOCR_TIMEOUT_MS = 45_000;
/** After a failed health check, wait this long before trying the server again. */
const VIETOCR_RETRY_MS = 60_000;

// ---------------------------------------------------------------------------
// VietOCR service (ocr_server/)
// ---------------------------------------------------------------------------
let vietOcrHealth: { at: number; up: Promise<boolean>; ok?: boolean } | null = null;

/** Health check, shared by all regions of a scan; also wakes a sleeping free-tier host. */
function vietOcrAvailable(): Promise<boolean> {
  if (!VIETOCR_URL) return Promise.resolve(false);
  const now = Date.now();
  if (!vietOcrHealth || (vietOcrHealth.ok === false && now - vietOcrHealth.at > VIETOCR_RETRY_MS)) {
    const health: { at: number; up: Promise<boolean>; ok?: boolean } = {
      at: now,
      up: fetch(`${VIETOCR_URL}/health`, { signal: AbortSignal.timeout(VIETOCR_TIMEOUT_MS) })
        .then((r) => r.ok)
        .catch(() => false)
    };
    health.up.then((ok) => {
      health.ok = ok;
      if (!ok) {
        console.warn(`VietOCR server ${VIETOCR_URL} unreachable, using tesseract`);
        getScheduler().catch(() => undefined);
      }
    });
    vietOcrHealth = health;
  }
  return vietOcrHealth.up;
}

/**
 * Warms the OCR engines before a scan: pings VietOCR (wakes a sleeping host) and only downloads
 * tesseract (~20 MB) when VietOCR is not configured or not answering.
 */
export function warmUpOcr(): void {
  if (typeof window === 'undefined') return;
  if (VIETOCR_URL) vietOcrAvailable();
  else warmUpTesseract();
}

async function ocrWithVietOcr(image: LLMImageInput, region: VisualRegion): Promise<RegionOcrResult> {
  const t0 = performance.now();
  const mode = region.kind === 'table' || region.kind === 'manual' ? 'table' : 'text';
  const res = await fetch(`${VIETOCR_URL}/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: image.data, mode }),
    signal: AbortSignal.timeout(VIETOCR_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`VietOCR HTTP ${res.status}`);
  const data: { text?: string; lines?: { text: string }[]; table?: string[][]; confidence?: number } = await res.json();

  const table = Array.isArray(data.table) ? data.table.filter((r) => Array.isArray(r) && r.some((c) => c)) : [];
  const isTable = table.length >= 2 && table[0].length >= 2;
  const sparse = region.kind === 'diagram' || region.kind === 'chart' || region.kind === 'picture';
  const lineTexts = (data.lines || []).map((l) => l.text.trim()).filter((t) => t && !NOISE_TOKEN.test(t));
  const nodes = sparse && !isTable ? lineTexts.filter((t) => t.length > 1) : [];
  const text = isTable ? table.map((r) => r.join(' | ')).join('\n') : lineTexts.join('\n');
  const noTextPicture = !text && region.kind === 'picture';
  return {
    engine: 'vietocr',
    status: text || noTextPicture ? 'done' : 'failed',
    content_type: isTable ? 'table' : nodes.length ? 'diagram' : noTextPicture ? 'photo' : 'text',
    text,
    table: isTable ? table : undefined,
    nodes: nodes.length ? nodes.slice(0, 30) : undefined,
    confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
    error: text || noTextPicture ? undefined : 'Không nhận diện được chữ',
    latency_ms: Math.round(performance.now() - t0)
  };
}

/**
 * Math that a line-based text engine mangles: operators next to letters/Greek, sub/superscripts,
 * fraction or summation marks. Short readings only; a paragraph that mentions "x = 1" is still prose.
 */
export function looksLikeFormula(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 220) return false;
  const mathMarks = (t.match(/[=≈≠≤≥∑∏∫√∂∇±×÷^_∈∀∃→←⇒αβγδεηθλμπσφωΣΔΘΛΠΦΩ]/g) || []).length;
  const letters = (t.match(/\p{L}/gu) || []).length;
  return mathMarks >= 2 && mathMarks / Math.max(1, letters) > 0.15;
}

// ---------------------------------------------------------------------------
// tesseract.js (lazy CDN load, small scheduler pool)
// ---------------------------------------------------------------------------
let schedulerPromise: Promise<any> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Không tải được ${src}`));
    document.head.appendChild(s);
  });
}

async function getScheduler(): Promise<any> {
  if (!schedulerPromise) {
    schedulerPromise = (async () => {
      await loadScript(TESSERACT_CDN);
      const T = (window as any).Tesseract;
      if (!T) throw new Error('tesseract.js không khả dụng');
      const scheduler = T.createScheduler();
      const workers = await Promise.all(
        Array.from({ length: TESSERACT_POOL }, async () => {
          const w = await T.createWorker('vie+eng');
          await w.setParameters({ preserve_interword_spaces: '1' });
          return w;
        })
      );
      workers.forEach((w: any) => scheduler.addWorker(w));
      return scheduler;
    })().catch((err) => {
      schedulerPromise = null;
      throw err;
    });
  }
  return schedulerPromise;
}

/**
 * Starts loading tesseract (core + vie/eng traineddata) in the background. The first load downloads
 * ~20 MB and takes ~20 s; later loads come from the browser cache in well under a second.
 */
function warmUpTesseract(): void {
  if (typeof window === 'undefined') return;
  getScheduler().catch((err) => console.warn('tesseract warm-up failed:', err));
}

// ---------------------------------------------------------------------------
// Preprocessing
// ---------------------------------------------------------------------------
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không đọc được ảnh vùng'));
    img.src = src;
  });
}

/** Rule positions (in preprocessed-image pixels) found and erased before OCR. */
interface RuleGrid {
  rows: number[];
  cols: number[];
}

/**
 * Finds long horizontal/vertical dark runs (table rules, box borders), erases them with a small halo,
 * and returns their clustered positions. Vertical rules are only looked for in a ruled context
 * (>= 2 horizontal rules) and must span most of the tightest row, so letter stems are never taken.
 */
export function removeRules(d: Uint8ClampedArray, w: number, h: number): RuleGrid {
  const ink = new Uint8Array(w * h);
  for (let i = 0, p = 0; p < w * h; i += 4, p++) ink[p] = d[i] < 128 ? 1 : 0;
  const line = new Uint8Array(w * h);

  const cluster = (vals: number[]) => {
    const out: number[] = [];
    let start = -1;
    let prev = -10;
    for (const v of vals) {
      if (v - prev > 3) {
        if (start >= 0) out.push(Math.round((start + prev) / 2));
        start = v;
      }
      prev = v;
    }
    if (start >= 0) out.push(Math.round((start + prev) / 2));
    return out;
  };

  const minH = Math.max(40, Math.round(w * 0.1));
  const hRows: number[] = [];
  for (let y = 0; y < h; y++) {
    let run = 0;
    let found = false;
    for (let x = 0; x <= w; x++) {
      if (x < w && ink[y * w + x]) {
        run++;
        continue;
      }
      if (run >= minH) {
        for (let k = x - run; k < x; k++) line[y * w + k] = 1;
        found = true;
      }
      run = 0;
    }
    if (found) hRows.push(y);
  }
  const rows = cluster(hRows);

  let cols: number[] = [];
  if (rows.length >= 2) {
    let minGap = Infinity;
    for (let i = 1; i < rows.length; i++) if (rows[i] - rows[i - 1] > 8) minGap = Math.min(minGap, rows[i] - rows[i - 1]);
    const minV = Math.max(40, Math.round((Number.isFinite(minGap) ? minGap : h) * 0.8));
    const vCols: number[] = [];
    for (let x = 0; x < w; x++) {
      let run = 0;
      let found = false;
      for (let y = 0; y <= h; y++) {
        if (y < h && ink[y * w + x]) {
          run++;
          continue;
        }
        if (run >= minV) {
          for (let k = y - run; k < y; k++) line[k * w + x] = 1;
          found = true;
        }
        run = 0;
      }
      if (found) vCols.push(x);
    }
    cols = cluster(vCols);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!line[y * w + x]) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
          const i = (yy * w + xx) * 4;
          d[i] = d[i + 1] = d[i + 2] = 255;
        }
      }
    }
  }
  return { rows, cols };
}

/**
 * Upscale small crops (tesseract wants ~300 dpi / 20-30px x-height), grayscale, stretch contrast,
 * binarize with Otsu when the crop is not already near black-on-white, and erase rules/borders.
 */
async function preprocessForTesseract(image: LLMImageInput): Promise<{ src: string; grid: RuleGrid }> {
  const img = await loadImage(`data:${image.mimeType};base64,${image.data}`);
  const shortSide = Math.min(img.width, img.height);
  const scale = Math.max(1, Math.min(3, 1100 / Math.max(1, shortSide)));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { src: img.src, grid: { rows: [], cols: [] } };
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h);
  const d = px.data;

  const hist = new Array(256).fill(0);
  let chroma = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    chroma += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  const n = w * h;
  // Contrast stretch between the 1st and 99th percentile.
  let lo = 0;
  let hi = 255;
  for (let acc = 0, v = 0; v < 256; v++) if ((acc += hist[v]) > n * 0.01) { lo = v; break; }
  for (let acc = 0, v = 255; v >= 0; v--) if ((acc += hist[v]) > n * 0.01) { hi = v; break; }
  const span = Math.max(1, hi - lo);

  // Otsu threshold (on the stretched values) for colored / low-contrast backgrounds.
  const colored = chroma / n > 18;
  let threshold = -1;
  if (colored || span < 160) {
    const sh = new Array(256).fill(0);
    for (let v = 0; v < 256; v++) sh[Math.max(0, Math.min(255, Math.round(((v - lo) * 255) / span)))] += hist[v];
    let sum = 0;
    for (let v = 0; v < 256; v++) sum += v * sh[v];
    let sumB = 0;
    let wB = 0;
    let best = 0;
    for (let v = 0; v < 256; v++) {
      wB += sh[v];
      if (!wB) continue;
      const wF = n - wB;
      if (!wF) break;
      sumB += v * sh[v];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) {
        best = between;
        threshold = v;
      }
    }
  }

  // Light text on a dark background reads better inverted.
  let dark = 0;
  for (let v = 0; v < 128; v++) dark += hist[v];
  const invert = dark > n * 0.6;

  for (let i = 0; i < d.length; i += 4) {
    let v = Math.max(0, Math.min(255, Math.round(((d[i] - lo) * 255) / span)));
    if (threshold >= 0) v = v > threshold ? 255 : 0;
    if (invert) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  const grid = removeRules(d, w, h);
  ctx.putImageData(px, 0, 0);
  return { src: canvas.toDataURL('image/png'), grid };
}

// ---------------------------------------------------------------------------
// Tesseract reading + table reconstruction
// ---------------------------------------------------------------------------
interface TsvWord {
  line: string;
  left: number;
  top: number;
  width: number;
  height: number;
  conf: number;
  text: string;
}

export function parseTsv(tsv: string): TsvWord[] {
  const out: TsvWord[] = [];
  for (const row of (tsv || '').split('\n').slice(1)) {
    const c = row.split('\t');
    if (c.length < 12 || c[0] !== '5') continue; // level 5 = word
    const text = c.slice(11).join('\t').trim();
    if (!text) continue;
    out.push({
      line: `${c[2]}_${c[3]}_${c[4]}`,
      left: +c[6],
      top: +c[7],
      width: +c[8],
      height: +c[9],
      conf: +c[10],
      text
    });
  }
  return out;
}

/** Rows = tesseract lines; cells = words separated by gaps wider than ~2 character widths; columns aligned by x. */
function rebuildTable(words: TsvWord[]): string[][] {
  const lines = new Map<string, TsvWord[]>();
  words.forEach((w) => lines.set(w.line, [...(lines.get(w.line) || []), w]));
  const rows = Array.from(lines.values())
    .map((ws) => ws.sort((a, b) => a.left - b.left))
    .sort((a, b) => a[0].top - b[0].top);
  const charW = words.reduce((s, w) => s + w.width / Math.max(1, w.text.length), 0) / Math.max(1, words.length);

  const cellRows = rows.map((ws) => {
    const cells: { x: number; text: string }[] = [];
    ws.forEach((w, i) => {
      const prev = ws[i - 1];
      if (!prev || w.left - (prev.left + prev.width) > charW * 2.2) cells.push({ x: w.left, text: w.text });
      else cells[cells.length - 1].text += ` ${w.text}`;
    });
    return cells;
  });

  // Column anchors from all cell starts (greedy clustering by x).
  const anchors: number[] = [];
  cellRows.flat().map((c) => c.x).sort((a, b) => a - b).forEach((x) => {
    if (!anchors.length || x - anchors[anchors.length - 1] > charW * 4) anchors.push(x);
  });
  if (anchors.length < 2) return [];
  return cellRows.map((cells) => {
    const row = new Array(anchors.length).fill('');
    cells.forEach((c) => {
      let idx = 0;
      anchors.forEach((a, i) => {
        if (Math.abs(c.x - a) < Math.abs(c.x - anchors[idx])) idx = i;
      });
      row[idx] = row[idx] ? `${row[idx]} ${c.text}` : c.text;
    });
    return row;
  });
}

/**
 * Table from the erased rules: rows between consecutive horizontal rules, columns between vertical
 * rules; each word goes to the cell holding its center. Words inside a cell keep tesseract's line
 * order, then left to right (sorting by raw `top` would scramble words whose diacritics differ).
 */
export function tableFromGrid(words: TsvWord[], grid: RuleGrid): string[][] {
  const { rows, cols } = grid;
  if (rows.length < 3 || cols.length < 3) return [];
  const slot = (edges: number[], v: number) => {
    for (let i = 0; i < edges.length - 1; i++) if (v >= edges[i] && v < edges[i + 1]) return i;
    return -1;
  };
  const lineTop = new Map<string, number>();
  words.forEach((w) => lineTop.set(w.line, Math.min(lineTop.get(w.line) ?? Infinity, w.top)));
  const cells: TsvWord[][][] = Array.from({ length: rows.length - 1 }, () => Array.from({ length: cols.length - 1 }, () => []));
  for (const w of words) {
    const r = slot(rows, w.top + w.height / 2);
    const c = slot(cols, w.left + w.width / 2);
    if (r >= 0 && c >= 0) cells[r][c].push(w);
  }
  return cells
    .map((row) =>
      row.map((ws) =>
        ws
          .sort((a, b) => (lineTop.get(a.line)! - lineTop.get(b.line)!) || a.left - b.left)
          .map((w) => w.text)
          .join(' ')
      )
    )
    .filter((row) => row.some((t) => t));
}

/** Arrows and rule leftovers that tesseract reads as dashes/brackets. */
const NOISE_TOKEN = /^[\s\-–—_=~|\\/<>»«→←↑↓\[\](){}.,:;'"`*+•·]+$/;

/** Diagram labels: tesseract keeps wide gaps between separate boxes on one line (preserve_interword_spaces). */
export function diagramLabels(text: string): string[] {
  return text
    .split('\n')
    .flatMap((l) => l.split(/\s{3,}/))
    .map((l) => l.replace(/^[\s\-–—_=~|>»→·•\[\]]+|[\s\-–—_=~|<«←·•\[\]]+$/g, '').trim())
    .filter((l) => l.length > 1 && !NOISE_TOKEN.test(l));
}

async function ocrWithTesseract(image: LLMImageInput, region: VisualRegion): Promise<RegionOcrResult> {
  const t0 = performance.now();
  const scheduler = await getScheduler();
  const { src, grid } = await preprocessForTesseract(image);
  const sparse = region.kind === 'diagram' || region.kind === 'chart' || region.kind === 'picture';
  const { data } = await scheduler.addJob('recognize', src, {}, { text: true, tsv: true });
  const words = parseTsv(data?.tsv || '').filter((w) => w.conf >= 0 && !NOISE_TOKEN.test(w.text));
  const meanConf = words.length ? words.reduce((s, w) => s + w.conf, 0) / words.length : 0;

  let table: string[][] = [];
  // Whole scanned pages mix prose with tables; only located table/manual regions become grids.
  if (region.kind === 'table' || region.kind === 'manual') {
    table = tableFromGrid(words, grid);
    if (!table.length) table = rebuildTable(words);
  }
  const isTable = table.length >= 2 && table[0].length >= 2;
  const rawText = String(data?.text || '');
  const nodes = sparse && !isTable ? diagramLabels(rawText) : [];
  const text = isTable
    ? table.map((r) => r.join(' | ')).join('\n')
    : rawText
        .split('\n')
        .map((l) => l.replace(/[ \t]+/g, ' ').trim())
        .filter((l) => l && !NOISE_TOKEN.test(l))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');

  // A picture without text is a finished reading (nothing to transcribe), not a failure to retry.
  const noTextPicture = !text && region.kind === 'picture';
  return {
    engine: 'tesseract',
    status: text || noTextPicture ? 'done' : 'failed',
    content_type: isTable ? 'table' : nodes.length ? 'diagram' : noTextPicture ? 'photo' : 'text',
    text,
    table: isTable ? table : undefined,
    nodes: nodes.length ? nodes.slice(0, 30) : undefined,
    confidence: Math.round(meanConf) / 100,
    error: text || noTextPicture ? undefined : 'Không nhận diện được chữ',
    latency_ms: Math.round(performance.now() - t0)
  };
}

async function ocrWithGemini(image: LLMImageInput): Promise<RegionOcrResult> {
  const provider = llmRouter.getOnlineProvider();
  if (!provider || !provider.hasApiKey()) throw new Error('NO_ONLINE_PROVIDER');
  const t0 = performance.now();
  const res = await provider.generateJson<any>(OCR_PROMPT, OCR_SYSTEM, 'Module 1: Region OCR (vision)', {
    images: [image],
    maxOutputTokens: 2048,
    temperature: 0,
    timeoutMs: 30000
  });
  const table = Array.isArray(res?.table) ? res.table.filter((r: any) => Array.isArray(r)).map((r: any[]) => r.map((c) => String(c ?? ''))) : [];
  const nodes = Array.isArray(res?.nodes) ? res.nodes.map((n: any) => String(n)) : [];
  const edges = Array.isArray(res?.edges)
    ? res.edges.filter((e: any) => e && e.from && e.to).map((e: any) => ({ from: String(e.from), to: String(e.to), label: e.label ? String(e.label) : undefined }))
    : [];
  return {
    engine: 'gemini',
    status: 'done',
    content_type: res?.content_type,
    is_decorative: Boolean(res?.is_decorative),
    text: String(res?.text || '').trim(),
    table: table.length ? table : undefined,
    nodes: nodes.length ? nodes : undefined,
    edges: edges.length ? edges : undefined,
    summary: res?.summary ? String(res.summary) : undefined,
    confidence: typeof res?.confidence === 'number' ? res.confidence : undefined,
    latency_ms: Math.round(performance.now() - t0)
  };
}

async function ocrOneRegion(
  documentId: string,
  region: VisualRegion,
  preference: OcrPreference,
  takeLlmCall: () => boolean
): Promise<RegionOcrResult> {
  const image = await regionAssetStore.getRegionImage(documentId, region);
  if (!image) {
    return { engine: 'native', status: 'skipped', error: 'Không cắt được ảnh vùng này (định dạng EMF/WMF hoặc thiếu file nguồn)' };
  }
  const cacheKey = await regionImageKey(image).catch(() => null);
  const cached = await getCachedReading(cacheKey);
  // A forced engine only reuses that engine's reading (the user asked for a re-read with it).
  if (cached && (preference === 'auto' || preference === cached.engine)) return { ...cached, cached: true, latency_ms: 0 };

  const tryGemini = async (): Promise<RegionOcrResult | null> => {
    if (!takeLlmCall()) return null;
    try {
      return await ocrWithGemini(image);
    } catch (err: any) {
      if (err?.message !== 'NO_ONLINE_PROVIDER') console.warn(`Gemini OCR failed for ${region.region_id}:`, err);
      return null;
    }
  };
  const tryTesseract = async (): Promise<RegionOcrResult | null> => {
    try {
      return await ocrWithTesseract(image, region);
    } catch (err: any) {
      console.warn(`tesseract failed for ${region.region_id}:`, err);
      return null;
    }
  };
  /** VietOCR when the server is up, else tesseract (unless tesseract was explicitly excluded). */
  const tryTextEngine = async (): Promise<RegionOcrResult | null> => {
    if (preference !== 'tesseract' && (await vietOcrAvailable())) {
      try {
        return await ocrWithVietOcr(image, region);
      } catch (err: any) {
        console.warn(`VietOCR failed for ${region.region_id}, using tesseract:`, err);
      }
    }
    return tryTesseract();
  };
  const isUnreliable = (r: RegionOcrResult | null) => {
    if (!r || r.status !== 'done') return true;
    if (!r.text) return false;
    const conf = r.confidence ?? 0;
    return (r.engine === 'vietocr' ? conf < VIETOCR_LOW_CONFIDENCE : conf * 100 < LOW_CONFIDENCE) || looksLikeFormula(r.text);
  };
  const failed = (): RegionOcrResult => ({ engine: 'tesseract', status: 'failed', error: 'Không đọc được vùng này' });

  let result: RegionOcrResult;
  const visualFirst = preference === 'gemini' || (preference === 'auto' && (region.kind === 'diagram' || region.kind === 'chart'));
  if (visualFirst) {
    result = (await tryGemini()) || (await tryTextEngine()) || failed();
  } else {
    const t = await tryTextEngine();
    // Pictures rarely hold teachable text; they never spend the vision budget under "auto".
    if (!isUnreliable(t) || preference !== 'auto' || region.kind === 'picture') {
      result = t || failed();
    } else {
      // Keep the text engine's characters as the reading if Gemini is unavailable.
      result = (await tryGemini()) || t || failed();
    }
  }
  // An unsure VietOCR reading (vision budget spent this run) must stay eligible for a Gemini re-read later.
  if (result.engine === 'gemini' || !isUnreliable(result)) await putCachedReading(cacheKey, result);
  return result;
}

/** Picks which regions get OCR'd under the page/document caps (largest regions first). */
function selectRegionsForOcr(regions: VisualRegion[], opts: Pick<RegionOcrOptions, 'maxRegionsPerPage' | 'maxRegionsTotal'>): VisualRegion[] {
  const needs = regions.filter((r) => !r.excluded && (!r.ocr || r.ocr.status === 'pending' || r.ocr.status === 'failed') && r.ocr?.engine !== 'native');
  const byPage = new Map<number, VisualRegion[]>();
  needs.forEach((r) => byPage.set(r.page_number, [...(byPage.get(r.page_number) || []), r]));
  const areaOf = (r: VisualRegion) => (r.bbox[2] - r.bbox[0]) * (r.bbox[3] - r.bbox[1]);
  const picked: VisualRegion[] = [];
  byPage.forEach((list) => picked.push(...list.sort((a, b) => areaOf(b) - areaOf(a)).slice(0, opts.maxRegionsPerPage)));
  return picked.sort((a, b) => areaOf(b) - areaOf(a)).slice(0, opts.maxRegionsTotal);
}

/**
 * OCRs the selected regions in parallel. Returns a new regions array (inputs are not mutated).
 */
export async function ocrVisualRegions(
  documentId: string,
  regions: VisualRegion[],
  opts: RegionOcrOptions
): Promise<VisualRegion[]> {
  const selected = selectRegionsForOcr(regions, opts);
  const results = new Map<string, RegionOcrResult>();
  let done = 0;
  let cursor = 0;
  // An explicit "gemini" choice (user asked for it on specific regions) is not rationed.
  let llmLeft = opts.preference === 'gemini' ? Infinity : opts.maxLlmCalls ?? 3;
  const takeLlmCall = () => {
    if (llmLeft <= 0) return false;
    llmLeft--;
    return true;
  };

  const worker = async () => {
    while (cursor < selected.length) {
      const region = selected[cursor++];
      if (performance.now() > opts.deadline) {
        results.set(region.region_id, { engine: region.ocr?.engine || 'gemini', status: 'skipped', error: 'Hết ngân sách thời gian quét' });
      } else {
        results.set(region.region_id, await ocrOneRegion(documentId, region, opts.preference || 'auto', takeLlmCall));
      }
      opts.onProgress?.(++done, selected.length);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency, selected.length)) }, worker));

  return regions.map((r) => {
    const res = results.get(r.region_id);
    if (res) return { ...r, ocr: res };
    if (!r.ocr || r.ocr.status === 'pending') {
      return { ...r, ocr: { engine: r.ocr?.engine || 'gemini', status: 'skipped', error: r.excluded ? 'Người dùng đã tắt vùng này' : 'Vượt giới hạn số vùng OCR' } };
    }
    return r;
  });
}

/** Human-readable reading of an OCR result, used as narration/keyword source text. */
export function regionReadingText(region: VisualRegion): string {
  const o = region.ocr;
  if (!o || o.status !== 'done' || o.is_decorative) return '';
  const parts: string[] = [];
  if (o.summary) parts.push(o.summary);
  if (o.table?.length) parts.push(o.table.map((row) => row.join(' | ')).join('\n'));
  else if (o.nodes?.length) {
    parts.push(o.nodes.join(' → '));
    if (o.edges?.length) parts.push(o.edges.map((e) => `${e.from} → ${e.to}${e.label ? ` (${e.label})` : ''}`).join('; '));
  } else if (o.text) parts.push(o.text);
  return parts.join('\n').trim();
}

/**
 * Writes OCR readings back into the document tree: fills the placeholder elements created by the
 * extractors, drops decorative ones, and rebuilds each section's raw_text.
 */
export function mergeRegionsIntoTree(tree: CanonicalDocumentTree, regions: VisualRegion[]): CanonicalDocumentTree {
  const byId = new Map(regions.map((r) => [r.region_id, r]));
  const sections = tree.sections.map((sec) => {
    const elements: ContentElement[] = [];
    for (const el of sec.elements) {
      if (!el.region_id) {
        elements.push(el);
        continue;
      }
      const region = byId.get(el.region_id);
      if (!region || region.excluded || region.ocr?.is_decorative) continue;
      const reading = region.ocr?.engine === 'native' ? el.text || regionReadingText(region) : regionReadingText(region);
      if (!reading) {
        // Keep the located (but unread) visual so downstream knows a figure exists.
        elements.push({ ...el, text: el.text || '' });
        continue;
      }
      const ct = region.ocr?.content_type;
      elements.push({
        ...el,
        type: ct === 'table' || ct === 'chart' ? 'table' : ct === 'diagram' ? 'diagram' : ct === 'formula' ? 'equation' : el.type === 'table' ? 'table' : el.type,
        text: reading,
        description: region.ocr?.summary,
        metadata: { ...(el.metadata || {}), ocr_engine: region.ocr?.engine, ocr_confidence: region.ocr?.confidence }
      });
    }
    // Scanned pages: the OCR text is the page content; use its first line as a title if we had none.
    let title = sec.title;
    const scanned = regions.find((r) => r.section_id === sec.section_id && r.kind === 'scanned_page' && r.ocr?.status === 'done');
    if (scanned && /^Slide \d+$/i.test(title)) {
      const firstLine = (scanned.ocr?.text || '').split('\n').map((l) => l.trim()).find((l) => l.length > 3);
      if (firstLine) title = firstLine.slice(0, 120);
    }
    return {
      ...sec,
      title,
      elements,
      raw_text: elements
        .filter((e) => e.text)
        .map((e) => (e.type === 'note' ? `[Note: ${e.text}]` : e.text))
        .join('\n')
    };
  });
  return { ...tree, sections, visual_regions: regions };
}
