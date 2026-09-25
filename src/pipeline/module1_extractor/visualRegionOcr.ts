// src/pipeline/module1_extractor/visualRegionOcr.ts
/**
 * Region OCR: reads only the located visual regions (never whole documents).
 *
 * Engine routing (preference "auto"):
 * - tables, scanned pages, user-drawn regions -> tesseract.js first (free, exact characters).
 *     Tables are rebuilt into rows/cells from word boxes (TSV). If confidence is low and an LLM is
 *     available, Gemini re-reads the crop.
 * - diagrams, charts, pictures -> Gemini vision first (needs structure: nodes/edges, series,
 *     "is this decorative"). Without Gemini, tesseract reads the labels in sparse-text mode.
 * Preferences "tesseract" / "gemini" force one engine (with the other as fallback).
 * Native regions (PPTX tables, chart XML, SmartArt) already carry their data and are skipped.
 *
 * Before tesseract, crops are upscaled so text reaches ~30px x-height, converted to grayscale,
 * contrast-stretched, and Otsu-binarized when the background is colored.
 * tesseract.js is lazy-loaded from jsDelivr (pinned) and runs as a small worker pool.
 */
import { CanonicalDocumentTree, ContentElement, RegionOcrResult, VisualRegion } from '../../types';
import { llmRouter } from '../../services/llm/LLMRouter';
import type { LLMImageInput } from '../../services/llm/GeminiProvider';
import { regionAssetStore } from './regionAssets';

export type OcrPreference = 'auto' | 'tesseract' | 'gemini';

export interface RegionOcrOptions {
  concurrency: number;
  maxRegionsPerPage: number;
  maxRegionsTotal: number;
  /** Absolute timestamp (performance.now()) after which pending regions are skipped. */
  deadline: number;
  preference?: OcrPreference;
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

/**
 * Upscale small crops (tesseract wants ~300 dpi / 20-30px x-height), grayscale, stretch contrast,
 * and binarize with Otsu when the crop is not already near black-on-white.
 */
async function preprocessForTesseract(image: LLMImageInput): Promise<string> {
  const img = await loadImage(`data:${image.mimeType};base64,${image.data}`);
  const shortSide = Math.min(img.width, img.height);
  const scale = Math.max(1, Math.min(3, 1100 / Math.max(1, shortSide)));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return img.src;
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
  ctx.putImageData(px, 0, 0);
  return canvas.toDataURL('image/png');
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

function parseTsv(tsv: string): TsvWord[] {
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

async function ocrWithTesseract(image: LLMImageInput, region: VisualRegion): Promise<RegionOcrResult> {
  const t0 = performance.now();
  const scheduler = await getScheduler();
  const src = await preprocessForTesseract(image);
  // Page segmentation stays on tesseract's automatic mode (a worker-level parameter shared by the pool);
  // diagram labels are then read line by line as nodes.
  const sparse = region.kind === 'diagram' || region.kind === 'chart' || region.kind === 'picture';
  const { data } = await scheduler.addJob('recognize', src, {}, { text: true, tsv: true });
  const words = parseTsv(data?.tsv || '').filter((w) => w.conf >= 0);
  const text = String(data?.text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const meanConf = words.length ? words.reduce((s, w) => s + w.conf, 0) / words.length : 0;
  const table = region.kind === 'table' || region.kind === 'manual' ? rebuildTable(words) : [];
  const isTable = table.length >= 2 && table[0].length >= 2;
  const lines = sparse ? text.split('\n').map((l) => l.trim()).filter((l) => l.length > 1) : [];

  return {
    engine: 'tesseract',
    status: text ? 'done' : 'failed',
    content_type: isTable ? 'table' : sparse && lines.length ? 'diagram' : 'text',
    text,
    table: isTable ? table : undefined,
    nodes: sparse && lines.length ? lines.slice(0, 30) : undefined,
    confidence: Math.round(meanConf) / 100,
    error: text ? undefined : 'Không nhận diện được chữ',
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

const TEXT_FIRST_KINDS = new Set(['table', 'scanned_page', 'manual']);

async function ocrOneRegion(documentId: string, region: VisualRegion, preference: OcrPreference): Promise<RegionOcrResult> {
  const image = await regionAssetStore.getRegionImage(documentId, region);
  if (!image) {
    return { engine: 'native', status: 'skipped', error: 'Không cắt được ảnh vùng này (định dạng EMF/WMF hoặc thiếu file nguồn)' };
  }
  const tesseractFirst = preference === 'tesseract' || (preference === 'auto' && TEXT_FIRST_KINDS.has(region.kind));

  const tryGemini = async (): Promise<RegionOcrResult | null> => {
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

  if (tesseractFirst) {
    const t = await tryTesseract();
    const unreliable = !t || t.status !== 'done' || (t.confidence ?? 0) * 100 < LOW_CONFIDENCE;
    if (!unreliable || preference === 'tesseract') return t || { engine: 'tesseract', status: 'failed', error: 'tesseract không chạy được' };
    const g = await tryGemini();
    // Keep tesseract's characters as the reading if Gemini is unavailable.
    return g || t || { engine: 'tesseract', status: 'failed', error: 'Không đọc được vùng này' };
  }

  const g = await tryGemini();
  if (g) return g;
  return (await tryTesseract()) || { engine: 'tesseract', status: 'failed', error: 'Không đọc được vùng này' };
}

/** Picks which regions get OCR'd under the page/document caps (largest regions first). */
export function selectRegionsForOcr(regions: VisualRegion[], opts: Pick<RegionOcrOptions, 'maxRegionsPerPage' | 'maxRegionsTotal'>): VisualRegion[] {
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

  const worker = async () => {
    while (cursor < selected.length) {
      const region = selected[cursor++];
      if (performance.now() > opts.deadline) {
        results.set(region.region_id, { engine: region.ocr?.engine || 'gemini', status: 'skipped', error: 'Hết ngân sách thời gian quét' });
      } else {
        results.set(region.region_id, await ocrOneRegion(documentId, region, opts.preference || 'auto'));
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
