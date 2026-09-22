// src/pipeline/module1_extractor/pdfExtractor.ts
/**
 * Rule-based PDF Extractor for CLSG-IR Module 1
 * Parses PDF documents page-by-page directly in the browser (Zero-LLM, Zero-VLM).
 * Converts each page into a canonical slide section, extracting text hierarchy, headings, and bullet points.
 */
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { CanonicalDocumentTree, DocumentSection, ContentElement } from '../../types';
import { contentPurifierService } from '../services/contentPurifierService';

// Configure worker for Vite and fallback to reliable CDN if needed
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker || `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  }
}

export class PDFExtractor {
  async extract(fileData: ArrayBuffer | Blob | Uint8Array, filename: string): Promise<CanonicalDocumentTree> {
    const startTime = performance.now();

    let uint8Array: Uint8Array;
    if (fileData instanceof Uint8Array) {
      uint8Array = fileData;
    } else if (fileData instanceof ArrayBuffer) {
      uint8Array = new Uint8Array(fileData);
    } else {
      const buffer = await fileData.arrayBuffer();
      uint8Array = new Uint8Array(buffer);
    }

    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const sections: DocumentSection[] = [];
    let overallTitle = filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const secId = `S${pageNum}`;
      const elements: ContentElement[] = [];
      const rawTexts: string[] = [];
      let elIdx = 1;

      // Group text items by vertical line (y coordinate)
      const lineMap = new Map<number, { x: number; text: string }[]>();
      for (const item of textContent.items as any[]) {
        if (!item.str || !item.str.trim()) continue;
        const y = Math.round(item.transform[5]);
        const x = item.transform[4];
        let foundY = y;
        for (const existingY of lineMap.keys()) {
          if (Math.abs(existingY - y) <= 3) {
            foundY = existingY;
            break;
          }
        }
        if (!lineMap.has(foundY)) {
          lineMap.set(foundY, []);
        }
        lineMap.get(foundY)!.push({ x, text: item.str });
      }

      // Sort lines from top (highest Y) to bottom
      const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
      const lines: string[] = [];
      for (const y of sortedYs) {
        const row = lineMap.get(y)!;
        row.sort((a, b) => a.x - b.x);
        const lineStr = row.map((r) => r.text).join(' ').replace(/\s+/g, ' ').trim();
        if (lineStr) {
          lines.push(lineStr);
        }
      }

      let slideTitle = `Slide ${pageNum}`;
      if (lines.length > 0) {
        // Find best title line: first non-numeric header
        let titleIdx = 0;
        while (titleIdx < lines.length && /^\d+$/.test(lines[titleIdx])) {
          titleIdx++;
        }
        if (titleIdx < lines.length) {
          slideTitle = lines[titleIdx];
          if (pageNum === 1) {
            overallTitle = slideTitle;
          }
        }

        // Generate content elements with content purification
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (i === titleIdx) {
            elements.push({
              element_id: `${secId}_el_${String(elIdx++).padStart(2, '0')}`,
              type: 'title',
              text: line,
              level: 1
            });
            rawTexts.push(line);
          } else {
            // Check if line is purely metadata/pagination/instructor note
            if (contentPurifierService.isMetadataOrInstructionLine(line)) {
              continue;
            }
            const cleanText = contentPurifierService.cleanLine(line);
            if (!cleanText || cleanText.length < 3) {
              continue;
            }
            const isBullet = /^([-*+•]|\d+\.|\([a-z0-9]+\))\s+/i.test(line);
            elements.push({
              element_id: `${secId}_el_${String(elIdx++).padStart(2, '0')}`,
              type: isBullet ? 'bullet_point' : 'paragraph',
              text: cleanText,
              level: 2
            });
            rawTexts.push(cleanText);
          }
        }
      }

      // If page had no text (e.g. image-only slide), create fallback title element
      if (elements.length === 0) {
        elements.push({
          element_id: `${secId}_el_01`,
          type: 'title',
          text: `Slide ${pageNum}`,
          level: 1
        });
        rawTexts.push(`Slide ${pageNum}`);
      }

      sections.push({
        section_id: secId,
        title: slideTitle,
        order: pageNum,
        elements,
        raw_text: rawTexts.join('\n')
      });
    }

    const elapsedMs = performance.now() - startTime;

    return {
      document_id: `doc_${Date.now().toString(36)}`,
      title: overallTitle,
      source_type: 'pdf',
      source_filename: filename,
      total_sections: sections.length,
      sections,
      extraction_time_ms: Math.round(elapsedMs * 10) / 10
    };
  }
}
