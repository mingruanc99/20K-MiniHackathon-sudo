// src/pipeline/module1_extractor/pdfExtractor.ts
/**
 * Rule-based PDF Extractor for CLSG-IR Module 1 (zero-LLM).
 *
 * Per page:
 * - text lines with normalized bounding boxes; the title is the largest-font line near the top
 * - image regions from the operator list (paintImageXObject & co.) with their real placement
 * - vector-graphics clusters (tables drawn with rules, flowcharts) found by merging path bounds
 * - pages without a text layer (scans) become one full-page region for OCR
 * Regions are only located here; OCR runs later on the crops (see visualRegionOcr.ts).
 */
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { CanonicalDocumentTree, DocumentSection, ContentElement, VisualRegion, VisualRegionKind } from '../../types';
import { contentPurifierService } from '../services/contentPurifierService';
import { regionAssetStore } from './regionAssets';

if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker || `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  }
}

type Rect = { x1: number; y1: number; x2: number; y2: number }; // normalized, top-left origin
type Matrix = [number, number, number, number, number, number];

const MAX_SEGMENTS_PER_PAGE = 4000;

const mul = (m1: Matrix, m2: Matrix): Matrix => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
];

const applyPt = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const area = (r: Rect) => Math.max(0, r.x2 - r.x1) * Math.max(0, r.y2 - r.y1);
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const toBbox = (r: Rect) => [round3(Math.max(0, r.x1)), round3(Math.max(0, r.y1)), round3(Math.min(1, r.x2)), round3(Math.min(1, r.y2))];

function overlapsOrNear(a: Rect, b: Rect, gap: number) {
  return a.x1 - gap <= b.x2 && b.x1 - gap <= a.x2 && a.y1 - gap <= b.y2 && b.y1 - gap <= a.y2;
}

/** Transforms a rect given in user space through CTM and viewport into normalized page space. */
function projectRect(ctm: Matrix, vp: Matrix, w: number, h: number, x1: number, y1: number, x2: number, y2: number): Rect {
  const m = mul(vp, ctm);
  const pts = [applyPt(m, x1, y1), applyPt(m, x2, y1), applyPt(m, x1, y2), applyPt(m, x2, y2)];
  const xs = pts.map((p) => p[0] / w);
  const ys = pts.map((p) => p[1] / h);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

interface PageGraphics {
  images: Rect[];
  paths: { rect: Rect; axisLine: boolean }[];
}

async function scanPageGraphics(page: any, viewport: any): Promise<PageGraphics> {
  const OPS = (pdfjsLib as any).OPS;
  const opList = await page.getOperatorList();
  const vp = viewport.transform as Matrix;
  const w = viewport.width;
  const h = viewport.height;

  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const images: Rect[] = [];
  const paths: { rect: Rect; axisLine: boolean }[] = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, args as Matrix);
    else if (fn === OPS.paintFormXObjectBegin && args?.[0]) {
      stack.push(ctm);
      ctm = mul(ctm, args[0] as Matrix);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || ctm;
    else if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintInlineImageXObjectGroup ||
      fn === OPS.paintImageXObjectRepeat ||
      fn === OPS.paintImageMaskXObject ||
      fn === OPS.paintJpegXObject
    ) {
      // Images are drawn into the unit square of the current CTM.
      images.push(projectRect(ctm, vp, w, h, 0, 0, 1, 1));
    } else if (fn === OPS.constructPath && paths.length < MAX_SEGMENTS_PER_PAGE) {
      // pdf.js merges consecutive path ops into one constructPath, so walk the sub-ops to get
      // one rect per rectangle/segment (a whole table grid is often a single constructPath).
      const subOps: number[] = args?.[0] || [];
      const coords: number[] = args?.[1] || [];
      let ci = 0;
      let cx = 0;
      let cy = 0;
      const push = (x1: number, y1: number, x2: number, y2: number) => {
        const rect = projectRect(ctm, vp, w, h, Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2));
        const thin = rect.x2 - rect.x1 < 0.004 || rect.y2 - rect.y1 < 0.004;
        paths.push({ rect, axisLine: thin });
      };
      for (const op of subOps) {
        if (op === OPS.rectangle) {
          const [x, y, rw, rh] = coords.slice(ci, ci + 4);
          ci += 4;
          push(x, y, x + rw, y + rh);
        } else if (op === OPS.moveTo) {
          cx = coords[ci++];
          cy = coords[ci++];
        } else if (op === OPS.lineTo) {
          const nx = coords[ci++];
          const ny = coords[ci++];
          push(cx, cy, nx, ny);
          cx = nx;
          cy = ny;
        } else if (op === OPS.curveTo) {
          const pts = coords.slice(ci, ci + 6);
          ci += 6;
          push(Math.min(cx, pts[0], pts[2], pts[4]), Math.min(cy, pts[1], pts[3], pts[5]), Math.max(cx, pts[0], pts[2], pts[4]), Math.max(cy, pts[1], pts[3], pts[5]));
          cx = pts[4];
          cy = pts[5];
        } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
          const pts = coords.slice(ci, ci + 4);
          ci += 4;
          push(Math.min(cx, pts[0], pts[2]), Math.min(cy, pts[1], pts[3]), Math.max(cx, pts[0], pts[2]), Math.max(cy, pts[1], pts[3]));
          cx = pts[2];
          cy = pts[3];
        }
        if (paths.length >= MAX_SEGMENTS_PER_PAGE) break;
      }
    }
  }
  return { images, paths };
}

/** Greedy merge of nearby path bounds into candidate figure/table regions. */
function clusterPaths(paths: { rect: Rect; axisLine: boolean }[]): { rect: Rect; count: number; lines: number }[] {
  const usable = paths.filter((p) => area(p.rect) < 0.85 && p.rect.x2 - p.rect.x1 < 0.98);
  const clusters: { rect: Rect; count: number; lines: number }[] = [];
  for (const p of usable) {
    let target = clusters.find((c) => overlapsOrNear(c.rect, p.rect, 0.015));
    if (!target) {
      target = { rect: { ...p.rect }, count: 0, lines: 0 };
      clusters.push(target);
    }
    target.rect = {
      x1: Math.min(target.rect.x1, p.rect.x1),
      y1: Math.min(target.rect.y1, p.rect.y1),
      x2: Math.max(target.rect.x2, p.rect.x2),
      y2: Math.max(target.rect.y2, p.rect.y2)
    };
    target.count++;
    if (p.axisLine) target.lines++;
  }
  // Second pass: clusters that grew into each other.
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (overlapsOrNear(clusters[i].rect, clusters[j].rect, 0.01)) {
          const a = clusters[i];
          const b = clusters[j];
          a.rect = { x1: Math.min(a.rect.x1, b.rect.x1), y1: Math.min(a.rect.y1, b.rect.y1), x2: Math.max(a.rect.x2, b.rect.x2), y2: Math.max(a.rect.y2, b.rect.y2) };
          a.count += b.count;
          a.lines += b.lines;
          clusters.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return clusters.filter((c) => c.count >= 6 && area(c.rect) >= 0.04);
}

interface Line {
  text: string;
  rect: Rect;
  fontSize: number;
}

export class PDFExtractor {
  async extract(fileData: ArrayBuffer | Blob | Uint8Array, filename: string): Promise<CanonicalDocumentTree> {
    const startTime = performance.now();

    let uint8Array: Uint8Array;
    if (fileData instanceof Uint8Array) uint8Array = fileData;
    else if (fileData instanceof ArrayBuffer) uint8Array = new Uint8Array(fileData);
    else uint8Array = new Uint8Array(await fileData.arrayBuffer());

    const pdfDoc = await pdfjsLib.getDocument({
      data: uint8Array,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
      password: '' // Suppress password prompts for RC4 encrypted PDFs with empty passwords
    }).promise;

    const documentId = `doc_${Date.now().toString(36)}`;
    regionAssetStore.setHandle(documentId, { kind: 'pdf', pdfDoc, pageCount: pdfDoc.numPages });

    const numPages = pdfDoc.numPages;
    let overallTitle = filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    let pageAspect = 16 / 9;

    // Pages are independent: process them concurrently (pdf.js worker serializes internally, but
    // text + operator-list requests pipeline well).
    const pageResults = await Promise.all(
      Array.from({ length: numPages }, (_, idx) => this.extractPage(pdfDoc, idx + 1))
    );

    const sections: DocumentSection[] = [];
    const regions: VisualRegion[] = [];
    pageResults.forEach((res, idx) => {
      if (idx === 0) {
        pageAspect = res.aspect;
        if (res.hasTitle) overallTitle = res.section.title;
      }
      sections.push(res.section);
      regions.push(...res.regions);
    });

    return {
      document_id: documentId,
      title: overallTitle,
      source_type: 'pdf',
      source_filename: filename,
      total_sections: sections.length,
      sections,
      visual_regions: regions,
      page_aspect: pageAspect,
      extraction_time_ms: Math.round((performance.now() - startTime) * 10) / 10,
      metadata: { page_count: numPages, region_count: regions.length }
    };
  }

  private async extractPage(pdfDoc: any, pageNum: number) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const W = viewport.width;
    const H = viewport.height;
    const secId = `S${pageNum}`;

    const [textContent, graphics] = await Promise.all([page.getTextContent(), scanPageGraphics(page, viewport).catch(() => ({ images: [], paths: [] }))]);

    // --- Text lines with bounding boxes ---
    const rows: { y: number; items: { x: number; text: string; rect: Rect; size: number }[] }[] = [];
    let charCount = 0;
    for (const item of textContent.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      charCount += item.str.trim().length;
      const [, , , d, e, f] = item.transform;
      const size = Math.abs(d) || item.height || 10;
      const x1 = e / W;
      const yTop = (H - f - size) / H;
      const rect: Rect = { x1, y1: yTop, x2: (e + (item.width || 0)) / W, y2: (H - f) / H };
      const yKey = (H - f) / H;
      let row = rows.find((r) => Math.abs(r.y - yKey) <= 3 / H);
      if (!row) {
        row = { y: yKey, items: [] };
        rows.push(row);
      }
      row.items.push({ x: e, text: item.str, rect, size });
    }
    rows.sort((a, b) => a.y - b.y);
    const lines: Line[] = rows
      .map((r) => {
        r.items.sort((a, b) => a.x - b.x);
        return {
          text: r.items.map((it) => it.text).join(' ').replace(/\s+/g, ' ').trim(),
          rect: {
            x1: Math.min(...r.items.map((it) => it.rect.x1)),
            y1: Math.min(...r.items.map((it) => it.rect.y1)),
            x2: Math.max(...r.items.map((it) => it.rect.x2)),
            y2: Math.max(...r.items.map((it) => it.rect.y2))
          },
          fontSize: Math.max(...r.items.map((it) => it.size))
        };
      })
      .filter((l) => l.text);

    // Title: the largest font in the top 40% of the page (ties -> higher on the page).
    let titleIdx = -1;
    let best = 0;
    lines.forEach((l, i) => {
      if (l.rect.y1 > 0.4 || /^\d+$/.test(l.text) || l.text.length < 2) return;
      if (l.fontSize > best * 1.05) {
        best = l.fontSize;
        titleIdx = i;
      }
    });
    if (titleIdx < 0) titleIdx = lines.findIndex((l) => !/^\d+$/.test(l.text));

    const elements: ContentElement[] = [];
    let elIdx = 1;
    const nextId = () => `${secId}_el_${String(elIdx++).padStart(2, '0')}`;
    const slideTitle = titleIdx >= 0 ? contentPurifierService.cleanLine(lines[titleIdx].text) || lines[titleIdx].text : `Slide ${pageNum}`;

    elements.push({ element_id: nextId(), type: 'title', text: slideTitle, level: 1, bbox: titleIdx >= 0 ? toBbox(lines[titleIdx].rect) : undefined });

    lines.forEach((line, i) => {
      if (i === titleIdx) return;
      if (contentPurifierService.isMetadataOrInstructionLine(line.text)) return;
      const clean = contentPurifierService.cleanLine(line.text);
      if (!clean || clean.length < 3) return;
      const isBullet = /^([-*+•■□▪▫●◆▶◄►‣⁃∙·■-◿-]|\d+\.|\([a-z0-9]+\))\s+/i.test(line.text);
      elements.push({ element_id: nextId(), type: isBullet ? 'bullet_point' : 'paragraph', text: clean, level: 2, bbox: toBbox(line.rect) });
    });

    // --- Visual regions ---
    const regions: VisualRegion[] = [];
    let rIdx = 1;
    const addRegion = (kind: VisualRegionKind, rect: Rect, source: VisualRegion['source']) => {
      const region: VisualRegion = {
        region_id: `${secId}_rg_${String(rIdx++).padStart(2, '0')}`,
        section_id: secId,
        page_number: pageNum,
        kind,
        bbox: toBbox(rect),
        source,
        ocr: { engine: kind === 'scanned_page' ? 'tesseract' : 'gemini', status: 'pending' }
      };
      regions.push(region);
      elements.push({
        element_id: nextId(),
        type: kind === 'table' ? 'table' : kind === 'diagram' ? 'diagram' : 'image',
        text: '',
        bbox: region.bbox,
        region_id: region.region_id
      });
    };

    const textless = charCount < 20;
    const bigImages = graphics.images.filter((r) => area(r) >= 0.03);
    if (textless) {
      addRegion('scanned_page', { x1: 0, y1: 0, x2: 1, y2: 1 }, 'pdf_textless_page');
    } else {
      bigImages
        .filter((r) => area(r) < 0.9) // full-bleed backgrounds carry no content of their own
        .forEach((r) => addRegion('picture', r, 'pdf_image_op'));

      clusterPaths(graphics.paths)
        .filter((c) => !bigImages.some((img) => overlapsOrNear(img, c.rect, 0) && area(img) >= area(c.rect) * 0.8))
        .forEach((c) => addRegion(c.lines / c.count > 0.6 ? 'table' : 'diagram', c.rect, 'pdf_vector_cluster'));
    }

    const section: DocumentSection = {
      section_id: secId,
      title: slideTitle,
      order: pageNum,
      elements,
      raw_text: elements.filter((e) => e.text).map((e) => e.text).join('\n')
    };

    return { section, regions, aspect: W / H, hasTitle: titleIdx >= 0 };
  }
}
