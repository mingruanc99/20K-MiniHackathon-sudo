// src/pipeline/module1_extractor/pdfExtractor.ts
/**
 * Vision AI-powered PDF Extractor for CLSG-IR Module 1.
 * 
 * Per page:
 * - Render PDF page to HTML5 Canvas
 * - Convert Canvas to Base64 Image
 * - Send all images to Vision LLM (Gemini 1.5 Pro / Flash)
 * - LLM returns a structured JSON identical to the legacy CanonicalDocumentTree
 * 
 * Without a Gemini key, or when the Vision call fails (quota exhausted, 429, timeout), the whole
 * document falls back to the rule-based text-layer extractor (pdfTextExtractor.ts): 0 tokens, and its
 * located picture/table/scan regions are read by VietOCR/tesseract later in the scan.
 */
import * as pdfjsLib from 'pdfjs-dist';
import { CanonicalDocumentTree, DocumentSection } from '../../types';
import { regionAssetStore } from './regionAssets';
import { llmRouter } from '../../services/llm/LLMRouter';
import { PdfTextExtractor } from './pdfTextExtractor';

export class PDFExtractor {
  async extract(fileData: ArrayBuffer | Blob | Uint8Array, filename: string): Promise<CanonicalDocumentTree> {
    let uint8Array: Uint8Array;
    if (fileData instanceof Uint8Array) uint8Array = fileData;
    else if (fileData instanceof ArrayBuffer) uint8Array = new Uint8Array(fileData);
    else uint8Array = new Uint8Array(await fileData.arrayBuffer());

    const online = llmRouter.getOnlineProvider();
    if (!online || !online.hasApiKey()) return new PdfTextExtractor().extract(uint8Array, filename);
    try {
      // pdf.js transfers the buffer it is given to its worker: hand it a copy so the fallback can still read the file.
      return await this.extractWithVision(uint8Array.slice(), filename, online);
    } catch (err: any) {
      console.warn('PDF Vision extraction failed, using the text layer instead:', err?.message || err);
      const tree = await new PdfTextExtractor().extract(uint8Array, filename);
      return { ...tree, metadata: { ...(tree.metadata || {}), vision_fallback: String(err?.message || err).slice(0, 200) } };
    }
  }

  private async extractWithVision(
    uint8Array: Uint8Array,
    filename: string,
    online: NonNullable<ReturnType<typeof llmRouter.getOnlineProvider>>
  ): Promise<CanonicalDocumentTree> {
    const startTime = performance.now();
    const pdfDoc = await pdfjsLib.getDocument({
      data: uint8Array,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
      password: '' // Suppress password prompts for RC4 encrypted PDFs with empty passwords
    }).promise;

    const documentId = `doc_${Date.now().toString(36)}`;
    regionAssetStore.setHandle(documentId, { kind: 'pdf', pdfDoc, pageCount: pdfDoc.numPages });

    const numPages = Math.min(pdfDoc.numPages, 50); // Giới hạn 50 trang
    const batchSize = 5; // Xử lý từng cụm 5 trang để tránh vượt quá Rate Limit của OpenAI
    let overallTitle = filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    const allSections: DocumentSection[] = [];

    const systemInstruction = "Bạn là một chuyên gia thiết kế sư phạm và trích xuất dữ liệu OCR xuất sắc. Bạn phân tích các slide bài giảng và trích xuất nội dung văn bản cũng như mô tả các biểu đồ một cách chính xác sang tiếng Việt và đóng gói vào cấu trúc JSON.";

    for (let batchStart = 1; batchStart <= numPages; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, numPages);
      const images: { mimeType: string; data: string }[] = [];

      // Chụp ảnh các slide trong lô hiện tại
      for (let i = batchStart; i <= batchEnd; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 }); // Giảm scale xuống 1.0 để nhẹ token
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // Nén 70%
          const base64Data = dataUrl.split(',')[1];
          images.push({ mimeType: 'image/jpeg', data: base64Data });
        }
      }

      const numImagesInBatch = images.length;
      const prompt = `Trích xuất toàn bộ văn bản và mô tả chi tiết biểu đồ/hình ảnh từ các slide PDF đính kèm (từ slide ${batchStart} đến ${batchEnd}).
Yêu cầu:
1. Đọc và trích xuất TOÀN BỘ chữ.
2. Nếu có hình ảnh/biểu đồ, mô tả lại ý nghĩa sư phạm bằng văn bản.
3. QUAN TRỌNG: Viết 100% bằng TIẾNG VIỆT. KHÔNG bỏ sót slide nào.

Trả về BẮT BUỘC dưới định dạng JSON:
{
  "title": "Tên bài giảng chung (Chỉ ghi nếu đây là slide đầu tiên, nếu không cứ để rỗng)",
  "sections": [
    {
      "title": "Tiêu đề của slide",
      "elements": [
        {
          "type": "paragraph",
          "text": "Nội dung văn bản (Bằng Tiếng Việt)..."
        }
      ]
    }
  ]
}
Lưu ý: Mảng 'sections' BẮT BUỘC phải có đúng ${numImagesInBatch} phần tử, tương ứng với ${numImagesInBatch} ảnh slide truyền vào.`;

      const resultJson = await online.generateJson<any>(
        prompt,
        systemInstruction,
        "PDF Vision Extraction",
        { images, timeoutMs: 120000, maxOutputTokens: 4096 }
      );

      if (batchStart === 1 && resultJson.title) {
        overallTitle = resultJson.title;
      }

      const batchSections: DocumentSection[] = (resultJson.sections || []).map((s: any, idx: number) => {
        const globalIdx = batchStart + idx;
        return {
          section_id: `S${globalIdx}`,
          title: s.title || `Trang ${globalIdx}`,
          order: globalIdx,
          elements: (s.elements || []).map((e: any, eIdx: number) => ({
            element_id: `S${globalIdx}_E${eIdx + 1}`,
            type: e.type || 'paragraph',
            text: e.text || ''
          }))
        };
      });
      allSections.push(...batchSections);
    }

    return {
      document_id: documentId,
      title: overallTitle,
      source_type: 'pdf',
      source_filename: filename,
      total_sections: allSections.length,
      sections: allSections,
      visual_regions: [], // Bỏ qua cơ chế OCR hình ảnh cũ vì LLM đã đọc hết thành text
      page_aspect: 16 / 9,
      extraction_time_ms: Math.round((performance.now() - startTime) * 10) / 10,
      metadata: { page_count: numPages, region_count: 0, vision_ai_extracted: true }
    };
  }
}
