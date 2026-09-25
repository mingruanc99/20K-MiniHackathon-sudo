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
 * Replaces the brittle rule-based vector path extraction.
 */
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { CanonicalDocumentTree, DocumentSection, ContentElement } from '../../types';
import { regionAssetStore } from './regionAssets';
import { llmRouter } from '../../services/llm/LLMRouter';
import { apiKeyService } from '../../services/llm/apiKeyService';

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

    const online = llmRouter.getOnlineProvider();
    const canUseLLM = Boolean(online && online.hasApiKey());

    if (!canUseLLM) {
      throw new Error('Chưa cấu hình API Key. PDFExtractor phiên bản Vision AI bắt buộc phải có API Key để quét ảnh.');
    }

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

    const numPages = Math.min(pdfDoc.numPages, 30); // Giới hạn 30 trang để tránh vượt quá token limit
    const images: { mimeType: string; data: string }[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64Data = dataUrl.split(',')[1];
        images.push({ mimeType: 'image/jpeg', data: base64Data });
      }
    }

    const prompt = `Trích xuất toàn bộ văn bản và mô tả chi tiết các biểu đồ/hình ảnh từ các slide PDF được đính kèm (theo thứ tự từ trang 1 đến trang ${numPages}).
Yêu cầu:
1. Đọc và trích xuất TOÀN BỘ chữ trên từng slide.
2. Nếu slide có hình ảnh, biểu đồ, lưu đồ: HÃY mô tả lại ý nghĩa sư phạm của chúng bằng văn bản.
3. KHÔNG bỏ sót bất kỳ slide nào.
4. QUAN TRỌNG: Toàn bộ quá trình bóc tách và mô tả phải được viết 100% bằng TIẾNG VIỆT. Không dịch sang tiếng Anh.

Trả về dữ liệu BẮT BUỘC dưới định dạng JSON có cấu trúc sau:
{
  "title": "Tên bài giảng chung (Dựa vào slide đầu tiên)",
  "sections": [
    {
      "title": "Tiêu đề của slide",
      "elements": [
        {
          "type": "paragraph",
          "text": "Nội dung văn bản, mô tả chi tiết biểu đồ (Bằng Tiếng Việt)..."
        }
      ]
    }
  ]
}
Lưu ý: Mảng 'sections' phải có đúng ${numPages} phần tử, tương ứng với ${numPages} hình ảnh slide được đính kèm. Nếu slide chỉ có hình, hãy để tiêu đề là 'Slide [số]' và phần text là mô tả hình đó.`;

    const systemInstruction = "Bạn là một chuyên gia thiết kế sư phạm và trích xuất dữ liệu OCR xuất sắc. Bạn có nhiệm vụ phân tích các slide bài giảng và trích xuất nội dung văn bản cũng như mô tả các biểu đồ một cách chính xác sang tiếng Việt và đóng gói vào cấu trúc JSON.";

    const resultJson = await online!.generateJson<any>(
      prompt,
      systemInstruction,
      "PDF Vision Extraction",
      { images, timeoutMs: 120000, maxOutputTokens: 8192 }
    );

    const sections: DocumentSection[] = (resultJson.sections || []).map((s: any, idx: number) => ({
      section_id: `S${idx + 1}`,
      title: s.title || `Trang ${idx + 1}`,
      order: idx + 1,
      elements: (s.elements || []).map((e: any, eIdx: number) => ({
        element_id: `S${idx + 1}_E${eIdx + 1}`,
        type: e.type || 'paragraph',
        text: e.text || ''
      }))
    }));

    return {
      document_id: documentId,
      title: resultJson.title || filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
      source_type: 'pdf',
      source_filename: filename,
      total_sections: sections.length,
      sections,
      visual_regions: [], // Bỏ qua cơ chế OCR hình ảnh cũ vì LLM đã đọc hết thành text
      page_aspect: 16 / 9,
      extraction_time_ms: Math.round((performance.now() - startTime) * 10) / 10,
      metadata: { page_count: numPages, region_count: 0, vision_ai_extracted: true }
    };
  }
}
