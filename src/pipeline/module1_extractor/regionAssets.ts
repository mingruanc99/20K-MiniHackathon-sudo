// src/pipeline/module1_extractor/regionAssets.ts
/**
 * In-memory handles to the source document, used to crop region images for OCR and
 * to draw page previews in the Knowledge Inspector.
 *
 * Nothing here is persisted: images stay in the browser and only OCR text reaches Firestore.
 * After a reload the Inspector re-opens the source file (Cloudinary URL or re-upload).
 */
import type JSZip from 'jszip';
import { VisualRegion } from '../../types';
import type { LLMImageInput } from '../../services/llm/GeminiProvider';

export type DocumentHandle =
  | { kind: 'pdf'; pdfDoc: any; pageCount: number }
  | { kind: 'pptx'; zip: JSZip; slideWidthEmu: number; slideHeightEmu: number };

const MAX_OCR_DIM = 1600;

class RegionAssetStore {
  private handles = new Map<string, DocumentHandle>();

  setHandle(documentId: string, handle: DocumentHandle) {
    this.handles.set(documentId, handle);
  }

  getHandle(documentId: string): DocumentHandle | undefined {
    return this.handles.get(documentId);
  }

  /** Crops the region out of the source document and returns an OCR-ready JPEG/PNG. */
  async getRegionImage(documentId: string, region: VisualRegion): Promise<LLMImageInput | null> {
    const handle = this.handles.get(documentId);
    if (!handle || typeof document === 'undefined') return null;

    if (handle.kind === 'pptx') {
      if (!region.asset_ref) return null;
      const file = handle.zip.file(region.asset_ref);
      if (!file) return null;
      const ext = region.asset_ref.split('.').pop()?.toLowerCase() || '';
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'bmp' ? 'image/bmp' : 'image/jpeg';
      if (!['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(ext)) return null; // EMF/WMF/SVG can't be rasterized reliably
      const blob = new Blob([await file.async('arraybuffer')], { type: mime });
      return blobToImageInput(blob, MAX_OCR_DIM);
    }

    // Render so the crop is ~1400px wide: small regions (a table in a corner) get more pixels.
    const page = await handle.pdfDoc.getPage(region.page_number);
    const pageWidthPt = page.getViewport({ scale: 1 }).width;
    const cropFraction = Math.max(0.05, region.bbox[2] - region.bbox[0]);
    const scale = Math.max(2, Math.min(4, 1400 / (pageWidthPt * cropFraction)));
    const canvas = await this.renderPdfPage(documentId, region.page_number, Math.round(scale * 2) / 2);
    if (!canvas) return null;
    return cropCanvas(canvas, region.bbox, MAX_OCR_DIM);
  }

  /** Renders a PDF page to a canvas (cached per page+scale for the session). */
  private pageCache = new Map<string, HTMLCanvasElement>();

  async renderPdfPage(documentId: string, pageNumber: number, scale = 1.5): Promise<HTMLCanvasElement | null> {
    const handle = this.handles.get(documentId);
    if (!handle || handle.kind !== 'pdf' || typeof document === 'undefined') return null;
    const cacheKey = `${documentId}:${pageNumber}:${scale}`;
    const cached = this.pageCache.get(cacheKey);
    if (cached) return cached;

    const page = await handle.pdfDoc.getPage(pageNumber);
    let viewport = page.getViewport({ scale });
    // Cap canvas size so very large pages don't blow up memory.
    const maxSide = 4000;
    if (Math.max(viewport.width, viewport.height) > maxSide) {
      viewport = page.getViewport({ scale: (scale * maxSide) / Math.max(viewport.width, viewport.height) });
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;
    this.pageCache.set(cacheKey, canvas);
    return canvas;
  }

  /** Object URL for a PPTX media file (for the Inspector's slide preview). */
  async getMediaUrl(documentId: string, assetRef: string): Promise<string | null> {
    const handle = this.handles.get(documentId);
    if (!handle || handle.kind !== 'pptx') return null;
    const file = handle.zip.file(assetRef);
    if (!file) return null;
    const blob = new Blob([await file.async('arraybuffer')]);
    return URL.createObjectURL(blob);
  }
}

export const regionAssetStore = new RegionAssetStore();

function canvasToImageInput(canvas: HTMLCanvasElement): LLMImageInput {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  return { mimeType: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

function cropCanvas(source: HTMLCanvasElement, bbox: number[], maxDim: number): LLMImageInput | null {
  const [x1, y1, x2, y2] = bbox;
  const pad = 0.01;
  const sx = Math.max(0, Math.floor((x1 - pad) * source.width));
  const sy = Math.max(0, Math.floor((y1 - pad) * source.height));
  const sw = Math.min(source.width - sx, Math.ceil((x2 - x1 + pad * 2) * source.width));
  const sh = Math.min(source.height - sy, Math.ceil((y2 - y1 + pad * 2) * source.height));
  if (sw < 8 || sh < 8) return null;
  const ratio = Math.min(1, maxDim / Math.max(sw, sh));
  const out = document.createElement('canvas');
  out.width = Math.round(sw * ratio);
  out.height = Math.round(sh * ratio);
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return canvasToImageInput(out);
}

async function blobToImageInput(blob: Blob, maxDim: number): Promise<LLMImageInput | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff'; // flatten transparent PNGs so OCR sees dark-on-light text
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvasToImageInput(canvas);
  } catch {
    return null;
  }
}
