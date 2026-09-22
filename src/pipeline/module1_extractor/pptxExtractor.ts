// src/pipeline/module1_extractor/pptxExtractor.ts
/**
 * Rule-based PPTX Extractor (Zero-LLM, Zero-VLM)
 * Extracts slides, titles, shapes, bullets, tables, and notes directly from PowerPoint XML.
 * Compatible with MS PowerPoint, Google Slides, Canva, Keynote exports.
 */
import JSZip from 'jszip';
import { CanonicalDocumentTree, DocumentSection, ContentElement } from '../../types';

export class PPTXExtractor {
  async extract(fileData: ArrayBuffer | Blob, filename: string): Promise<CanonicalDocumentTree> {
    const startTime = performance.now();
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(fileData);

    const sections: DocumentSection[] = [];
    let overallTitle = filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

    const zipKeys = Object.keys(loadedZip.files);

    // Find all slide files regardless of casing or directory formatting (supports unlimited slides)
    let slidePaths = zipKeys.filter((k) => /(?:ppt\/slides\/|slides\/)slide[-_]?\d+\.xml$/i.test(k));

    if (slidePaths.length === 0) {
      // General fallback for any slide XML files
      slidePaths = zipKeys.filter(
        (k) =>
          /slides\/[^/]+\.xml$/i.test(k) &&
          !k.includes('_rels') &&
          !k.includes('slideLayout') &&
          !k.includes('slideMaster')
      );
    }

    // Natural sort slides numerically: slide1.xml, slide2.xml ... slide100.xml
    slidePaths.sort((a, b) => {
      const numA = parseInt(a.match(/slide[-_]?(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide[-_]?(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

    for (let i = 0; i < slidePaths.length; i++) {
      const slidePath = slidePaths[i];
      const slideFile = loadedZip.file(slidePath);
      if (!slideFile) continue;

      const slideXml = await slideFile.async('text');
      const slideNum = i + 1;
      const secId = `S${slideNum}`;
      let slideTitle = `Slide ${slideNum}`;
      const elements: ContentElement[] = [];
      const rawTexts: string[] = [];
      let elIdx = 1;

      // Extract paragraphs by scanning <a:p> tags
      const paragraphs: string[] = [];
      const pMatches = [...slideXml.matchAll(/<a:p[^>]*>([\s\S]*?)<\/a:p>/gi)];

      for (const pMatch of pMatches) {
        const pContent = pMatch[1];
        const tMatches = [...pContent.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)];
        const pText = tMatches.map((m) => m[1]).join('').trim();
        if (pText) {
          paragraphs.push(pText);
        }
      }

      // Fallback: if no <a:p> wrapper, scan direct <a:t>
      if (paragraphs.length === 0) {
        const directTMatches = [...slideXml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)];
        paragraphs.push(...directTMatches.map((m) => m[1].trim()).filter(Boolean));
      }

      let isFirst = true;
      for (const pText of paragraphs) {
        if (isFirst) {
          slideTitle = pText;
          if (slideNum === 1) overallTitle = pText;
          isFirst = false;

          elements.push({
            element_id: `${secId}_el_${String(elIdx++).padStart(2, '0')}`,
            type: 'title',
            text: pText,
            level: 1
          });
          rawTexts.push(pText);
        } else {
          const isBullet = pText.startsWith('•') || pText.startsWith('-') || pText.startsWith('*');
          elements.push({
            element_id: `${secId}_el_${String(elIdx++).padStart(2, '0')}`,
            type: isBullet ? 'bullet_point' : 'paragraph',
            text: pText,
            level: 2
          });
          rawTexts.push(pText);
        }
      }

      // Check for speaker notes: ppt/notesSlides/notesSlide{N}.xml
      const notesPathMatch = zipKeys.find((k) => new RegExp(`notesSlide${slideNum}\\.xml$`, 'i').test(k));
      if (notesPathMatch) {
        try {
          const notesFile = loadedZip.file(notesPathMatch);
          if (notesFile) {
            const notesXml = await notesFile.async('text');
            const noteTMatches = [...notesXml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)];
            const noteText = noteTMatches.map((m) => m[1]).join(' ').trim();
            if (noteText && !noteText.match(/^Slide \d+$/i)) {
              elements.push({
                element_id: `${secId}_el_${String(elIdx++).padStart(2, '0')}`,
                type: 'note',
                text: noteText
              });
              rawTexts.push(`[Note: ${noteText}]`);
            }
          }
        } catch {
          // ignore notes failure
        }
      }

      // If slide had no text elements, add placeholder
      if (elements.length === 0) {
        elements.push({
          element_id: `${secId}_el_01`,
          type: 'title',
          text: `Slide ${slideNum}`,
          level: 1
        });
        rawTexts.push(`Slide ${slideNum}`);
      }

      sections.push({
        section_id: secId,
        title: slideTitle,
        order: slideNum,
        elements,
        raw_text: rawTexts.join('\n')
      });
    }

    // Fallback: If no slides could be parsed from zip, create at least 1 default section
    if (sections.length === 0) {
      sections.push({
        section_id: 'S1',
        title: overallTitle,
        order: 1,
        elements: [
          { element_id: 'S1_el_01', type: 'title', text: overallTitle, level: 1 },
          { element_id: 'S1_el_02', type: 'paragraph', text: 'Tài liệu bài giảng đã tải lên', level: 2 }
        ],
        raw_text: overallTitle
      });
    }

    const elapsedMs = performance.now() - startTime;

    return {
      document_id: `doc_${Date.now().toString(36)}`,
      title: overallTitle,
      source_type: 'pptx',
      source_filename: filename,
      total_sections: sections.length,
      sections,
      extraction_time_ms: Math.round(elapsedMs * 10) / 10,
      metadata: { slide_count: sections.length }
    };
  }
}
