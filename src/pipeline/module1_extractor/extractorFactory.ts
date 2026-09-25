// src/pipeline/module1_extractor/extractorFactory.ts
/**
 * Extractor Factory for Module 1
 * Auto-detects extension and dispatches to PPTX or Markdown extractor.
 * Provides deterministic built-in extraction for the 1-Click CNN Demo.
 */
import { CanonicalDocumentTree } from '../../types';
import { PPTXExtractor } from './pptxExtractor';
import { MarkdownExtractor } from './markdownExtractor';
import { PDFExtractor } from './pdfExtractor';
import { getBuiltinCnnTree } from './builtinCnnTree';

export { getBuiltinCnnTree };

export async function extractDocument(
  source: File | Blob | string | CanonicalDocumentTree,
  filename: string
): Promise<CanonicalDocumentTree> {
  // If already parsed, return directly
  if (source && typeof source === 'object' && 'sections' in source && Array.isArray((source as any).sections)) {
    return source as CanonicalDocumentTree;
  }

  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (filename === 'cnn_intro.pptx' || filename === 'intro_to_cnn.pptx' || filename.includes('demo')) {
    return getBuiltinCnnTree();
  }

  if (ext === 'pptx' || ext === 'ppt') {
    if (typeof source === 'string') {
      return getBuiltinCnnTree();
    }
    const extractor = new PPTXExtractor();
    return await extractor.extract(source as Blob, filename);
  }

  if (ext === 'pdf') {
    if (typeof source === 'string') {
      try {
        const res = await fetch(source);
        const blob = await res.blob();
        const extractor = new PDFExtractor();
        return await extractor.extract(blob, filename);
      } catch {
        // if fetch fails, pass to markdown fallback
      }
    } else {
      const extractor = new PDFExtractor();
      return await extractor.extract(source as Blob, filename);
    }
  }

  if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
    const textContent = typeof source === 'string' ? source : await (source as Blob).text();
    const extractor = new MarkdownExtractor();
    return extractor.extract(textContent, filename);
  }

  // Fallback to text parsing
  const textContent = typeof source === 'string' ? source : await (source as Blob).text();
  const extractor = new MarkdownExtractor();
  return extractor.extract(textContent, filename);
}
