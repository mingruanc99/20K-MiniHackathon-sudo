// src/pipeline/module1_extractor/markdownExtractor.ts
/**
 * Rule-based Markdown Extractor for CLSG-IR Module 1
 */
import { CanonicalDocumentTree, DocumentSection, ContentElement } from '../../types';
import { contentPurifierService } from '../services/contentPurifierService';

export class MarkdownExtractor {
  extract(content: string, filename: string): CanonicalDocumentTree {
    const startTime = performance.now();
    const lines = content.split('\n');
    const sections: DocumentSection[] = [];

    let currentSecId = 'S1';
    let currentTitle = filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    let currentElements: ContentElement[] = [];
    let rawTexts: string[] = [];
    let secIdx = 1;
    let elIdx = 1;
    let inCodeBlock = false;
    let codeBuffer: string[] = [];

    for (const line of lines) {
      const stripped = line.trim();
      if (!stripped && !inCodeBlock) continue;

      if (stripped.startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          const codeText = codeBuffer.join('\n');
          currentElements.push({
            element_id: `${currentSecId}_el_${String(elIdx++).padStart(2, '0')}`,
            type: 'code',
            text: codeText
          });
          rawTexts.push(codeText);
          codeBuffer = [];
        } else {
          inCodeBlock = true;
          codeBuffer = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      const hMatch = stripped.match(/^(#{1,3})\s+(.*)$/);
      if (hMatch) {
        const hLevel = hMatch[1].length;
        const hText = contentPurifierService.cleanLine(hMatch[2]) || hMatch[2].trim();

        if (hLevel <= 2 && currentElements.length > 0) {
          sections.push({
            section_id: currentSecId,
            title: currentTitle,
            order: secIdx++,
            elements: currentElements,
            raw_text: rawTexts.join('\n')
          });
          currentSecId = `S${secIdx}`;
          currentElements = [];
          rawTexts = [];
          elIdx = 1;
        }

        currentTitle = hText;
        currentElements.push({
          element_id: `${currentSecId}_el_${String(elIdx++).padStart(2, '0')}`,
          type: 'heading',
          text: hText,
          level: hLevel
        });
        rawTexts.push(hText);
        continue;
      }

      if (stripped.match(/^([-*+•■□▪▫●◆▶◄►‣⁃∙·\u25A0-\u25FF\uE000-\uF8FF]|\d+\.)\s+/)) {
        const bulletText = contentPurifierService.cleanLine(stripped);
        if (bulletText) {
          currentElements.push({
            element_id: `${currentSecId}_el_${String(elIdx++).padStart(2, '0')}`,
            type: 'bullet_point',
            text: bulletText,
            level: 1
          });
          rawTexts.push(bulletText);
        }
      } else {
        const pText = contentPurifierService.cleanLine(stripped);
        if (pText) {
          currentElements.push({
            element_id: `${currentSecId}_el_${String(elIdx++).padStart(2, '0')}`,
            type: 'paragraph',
            text: pText
          });
          rawTexts.push(pText);
        }
      }
    }

    if (currentElements.length > 0) {
      sections.push({
        section_id: currentSecId,
        title: currentTitle,
        order: secIdx,
        elements: currentElements,
        raw_text: rawTexts.join('\n')
      });
    }

    const elapsedMs = performance.now() - startTime;

    return {
      document_id: `doc_${Date.now().toString(36)}`,
      title: sections[0]?.title || currentTitle,
      source_type: 'markdown',
      source_filename: filename,
      total_sections: sections.length,
      sections,
      extraction_time_ms: Math.round(elapsedMs * 10) / 10
    };
  }
}
