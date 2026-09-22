// src/pipeline/services/contentPurifierService.ts
/**
 * Content Purification & Validation Engine for CLSG-IR System
 * 
 * Strict Separation of Data:
 * A. LEARNING CONTENT: Only "WHAT THE TEACHER WOULD ACTUALLY SAY"
 * B. GENERATION METADATA / INTERNAL CONTEXT: Section type, IDs, instructor notes, context
 * C. UI METADATA: Badges, timestamps, pagination (S1, 1 / 52, 00:37)
 * 
 * Pipeline:
 * RAW INPUT -> STRUCTURE PARSER -> CONTENT EXTRACTION -> METADATA REMOVAL
 *   -> INSTRUCTION REMOVAL -> DUPLICATE CHECK -> SEMANTIC CLEANUP -> FINAL CONTENT
 */

export interface PurificationResult {
  cleanedText: string;
  removedElements: string[];
  passedValidation: boolean;
  validationIssues: string[];
}

export interface ValidationReport {
  isValid: boolean;
  failures: string[];
}

export class ContentPurifierService {
  // 1. Pagination & Page Numbering Patterns (e.g., "1 / 52", "p. 10", "page 2 of 50")
  private paginationPatterns: RegExp[] = [
    /\b\d+\s*[/|]\s*\d+\b/g,
    /\b(?:page|trang|slide|p\.)\s*\d+(?:\s*(?:of|\/)\s*\d+)?\b/gi,
    /^\s*\d+\s*$/gm
  ];

  // 2. Course Codes, Academic Affiliations, Watermarks & Administrative Metadata
  private administrativePatterns: RegExp[] = [
    /\b(?:aicb(?:-[a-z0-9]+)?|data track|vinuniversity|stanford|mit|harvard|cmu|coursera)\b/gi,
    /\b(?:ngày\s*\d+|day\s*\d+|chương\s*\d+|chapter\s*\d+|phần\s*\d+|part\s*\d+)\b/gi,
    /\b(?:all rights reserved|bản quyền|copyright|confidential|proprietary)\b/gi,
    /https?:\/\/[^\s]+/gi,
    /\b(?:v\d+\.\d+(?:\.\d+)?|version\s*\d+)\b/gi
  ];

  // 3. Section Role Badges, Prompt Directives & Internal Section Labels
  private sectionLabelPatterns: RegExp[] = [
    /\b(?:hãy suy nghĩ|hãy thử suy nghĩ|suy nghĩ một chút)\b/gi,
    /\b(?:s[1-9]\d*|slide\s*\d+|section\s*\d+|phân cảnh\s*\d+)\b/gi,
    /\b(?:hook|mechanism|example|technical|core_concept|key_explanation|summary|application|comparison|evidence|transition|decorative)\b/gi,
    /\b(?:s1\s*[-–:]\s*hook|s2\s*[-–:]\s*think|s3\s*[-–:]\s*example|s4\s*[-–:]\s*mechanism)\b/gi
  ];

  // 4. Instructor Notes, Speaker Cues & Parenthetical Internal Directives
  private instructorNotePatterns: RegExp[] = [
    /\((?:thành phần chuyên sâu[^)]*|lưu ý[^)]*|ghi chú[^)]*|giảng viên[^)]*|hướng dẫn[^)]*|note[^)]*|internal[^)]*|developer[^)]*)\)/gi,
    /\[(?:note|ghi chú|giảng viên|instructor)[^\]]*\]/gi,
    /\b(?:giảng viên|lưu ý giảng viên|ghi chú giảng viên|instructor notes?|speaker notes?)\b[:\s-]*/gi
  ];

  // 5. Agenda & Outline Headers that should never be spoken as content
  private agendaHeaderPatterns: RegExp[] = [
    /^(?:nội dung bài học|mục lục|agenda|table of contents|nội dung chính|tổng quan bài giảng|overview)[.:\s-]*/gi,
    /\b(?:nội dung bài học|mục lục|table of contents)\b/gi
  ];

  // 6. Mechanical Low-Density Boilerplate Fillers
  private boilerplateFillerPatterns: RegExp[] = [
    /(?:từ nền tảng này,?\s*)?chúng ta sẽ tiếp tục khám phá các bước tiếp theo(?: trong bài giảng)?[.:]?/gi,
    /chúng ta sẽ cùng tìm hiểu (?:trong phần tiếp theo|ở các slide tiếp theo)[.:]?/gi,
    /ở phần tiếp theo chúng ta sẽ(?: cùng)?[^.!?]+[.!?]/gi,
    /như chúng ta đã (?:biết|đề cập ở trên)[,:.]?\s*/gi,
    /^trước khi đi vào phần kỹ thuật,?\s*(?:hãy thử suy nghĩ một chút[.:,]?\s*(?:theo bạn[.:,]?\s*)?)?/gi,
    /^sau khi đã nắm vững[^,.!?]+[,.]\s*/gi
  ];

  /**
   * Evaluates whether a candidate string or bullet is purely administrative metadata or an internal label.
   */
  isMetadataOrInstructionLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) return true;

    // Check pagination
    if (/^\d+\s*[/|]\s*\d+$/.test(trimmed)) return true;
    if (/^(?:page|trang|slide)\s*\d+/i.test(trimmed)) return true;

    // Check course codes or admin
    if (/^(?:aicb|vinuniversity|all rights reserved|copyright)/i.test(trimmed)) return true;

    // Check instructor notes
    if (/^(?:giảng viên|instructor note|ghi chú|note:)/i.test(trimmed)) return true;

    // Check section badges
    if (/^(?:hãy suy nghĩ|hook|mechanism|example|technical|s[1-9]\d*)$/i.test(trimmed)) return true;

    // Check agenda headers
    if (/^(?:nội dung bài học|mục lục|agenda|table of contents)$/i.test(trimmed)) return true;

    return false;
  }

  /**
   * Sanitizes an individual bullet or raw line by removing inline metadata, parentheticals, and pagination.
   */
  cleanLine(line: string): string {
    let text = line.trim();
    if (!text) return '';

    // Remove parenthetical instructor notes
    for (const pat of this.instructorNotePatterns) {
      text = text.replace(pat, ' ');
    }

    // Remove pagination tokens (e.g., "aicb · 1 / 52", "1 / 52")
    for (const pat of this.paginationPatterns) {
      text = text.replace(pat, ' ');
    }

    // Remove administrative metadata tokens
    for (const pat of this.administrativePatterns) {
      text = text.replace(pat, ' ');
    }

    // Remove inline agenda tokens
    for (const pat of this.agendaHeaderPatterns) {
      text = text.replace(pat, ' ');
    }

    // Clean bullets / dashes / numbering prefix
    text = text.replace(/^[•\-\*·\d\.\)]\s*/, '');

    // Clean up excessive punctuation and spacing
    text = text.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();

    return text;
  }

  /**
   * Cleans an array of bullet points extracted from slides.
   * Strips out agenda headers, instructor notes, pagination, and empty items.
   */
  cleanBulletPoints(bullets: string[]): string[] {
    const cleaned: string[] = [];

    for (const raw of bullets) {
      if (this.isMetadataOrInstructionLine(raw)) {
        continue;
      }
      const sanitized = this.cleanLine(raw);
      if (sanitized.length >= 3 && !this.isMetadataOrInstructionLine(sanitized)) {
        // Strip trailing periods so callers can format naturally
        cleaned.push(sanitized.replace(/\.+$/, ''));
      }
    }

    return cleaned;
  }

  /**
   * Sanitizes a title used in narrative bridges to prevent internal role labels from leaking into spoken lecture.
   * E.g. "HÃY SUY NGHĨ" -> "" (so bridge falls back to natural context)
   *      "S1 - HOOK" -> ""
   *      "Keypoint & Pose" -> "Keypoint & Pose"
   */
  sanitizeTitleForSpeech(title?: string): string {
    if (!title) return '';
    const trimmed = title.trim();

    // Check if title is merely an internal label
    const isLabelOnly =
      /^(?:hãy suy nghĩ|hãy thử suy nghĩ|hook|mechanism|example|technical|core_concept|s[1-9]\d*|slide\s*\d+|phân cảnh\s*\d+|nội dung bài học)$/i.test(
        trimmed
      );

    if (isLabelOnly) {
      return '';
    }

    // Remove prefix like "S1 - " or "Slide 1: "
    let clean = trimmed.replace(/^(?:s[1-9]\d*|slide\s*\d+)\s*[-–:]\s*/i, '');

    // Remove internal tags in parentheses
    clean = clean.replace(/\((?:hook|think|mechanism|example|technical)\)/gi, '').trim();

    return clean;
  }

  /**
   * CONTENT PURIFICATION PIPELINE (Section 6 of User Request):
   * Transforms raw generation output into ONLY_LEARNING_CONTENT.
   */
  purifyNarration(
    rawNarration: string,
    context?: {
      title?: string;
      role?: string;
      previousConcept?: string;
    }
  ): PurificationResult {
    const removedElements: string[] = [];
    let text = rawNarration || '';

    // Step 1: Detect and transform broken template bridges like "Từ nền tảng của [LABEL], chúng ta đi sâu..."
    // If the label is an internal badge ("HÃY SUY NGHĨ", "HOOK", "S1"), rewrite gracefully to natural teacher speech.
    const brokenBridgeRegex = /từ nền tảng của\s+(hãy suy nghĩ|hãy thử suy nghĩ|hook|mechanism|example|s[1-9]\d*|slide\s*\d+|chủ đề này)[,.]?\s*(chúng ta đi sâu vào cơ chế chi tiết[.:]?)?/gi;
    if (brokenBridgeRegex.test(text)) {
      removedElements.push('BROKEN_BRIDGE_WITH_INTERNAL_LABEL');
      text = text.replace(
        brokenBridgeRegex,
        'Tiếp theo, chúng ta đi sâu vào cơ chế chi tiết.'
      );
    }

    // Step 2: Strip Instructor Notes & Parenthetical Directions
    for (const pat of this.instructorNotePatterns) {
      if (pat.test(text)) {
        removedElements.push('INSTRUCTOR_NOTES');
        text = text.replace(pat, ' ');
      }
    }

    // Step 3: Strip Pagination & Page Numbering Tokens
    for (const pat of this.paginationPatterns) {
      if (pat.test(text)) {
        removedElements.push('PAGINATION');
        text = text.replace(pat, ' ');
      }
    }

    // Step 4: Strip Administrative Metadata Tokens
    for (const pat of this.administrativePatterns) {
      if (pat.test(text)) {
        removedElements.push('ADMIN_METADATA');
        text = text.replace(pat, ' ');
      }
    }

    // Step 5: Strip Agenda & Outline Header Tokens
    for (const pat of this.agendaHeaderPatterns) {
      if (pat.test(text)) {
        removedElements.push('AGENDA_HEADER');
        text = text.replace(pat, ' ');
      }
    }

    // Step 6: Strip Mechanical Boilerplate Fillers
    for (const pat of this.boilerplateFillerPatterns) {
      if (pat.test(text)) {
        removedElements.push('FILLER_TRANSITION');
        text = text.replace(pat, ' ');
      }
    }

    // Step 7: Clean Isolated Internal Role Badges (e.g. standalone "HÃY SUY NGHĨ.", "HOOK.", "S2.")
    text = text.replace(/(?:^|[.!?\n]\s*)(?:hãy suy nghĩ|hãy thử suy nghĩ|hook|mechanism|example|technical)\s*([.!?])/gi, '$1');
    text = text.replace(/\b(?:s[1-9]\d*|slide\s*\d+)\b/gi, ' ');

    // Step 8: Grammatical Cohesion & Conjunction Repair
    // Fix dangling conjunctions and orphaned punctuation like: "và. ", "và,", "và và", ", .", ",,", "·", "•"
    text = text.replace(/[·•|]/g, ' ');
    text = text.replace(/\s+và\s*([.,;!?])/gi, '$1');
    text = text.replace(/\s+(?:và|cũng như)\s+(?:và|cũng như)\s+/gi, ' và ');
    text = text.replace(/\s*,\s*,+/g, ',');
    text = text.replace(/\s*\.\s*\.+/g, '.');
    text = text.replace(/,\s*\./g, '.');
    text = text.replace(/\s+([.,;:!?])/g, '$1');
    text = text.replace(/\s+/g, ' ').trim();

    // Ensure proper capitalization of sentences
    text = text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => {
        const s = sentence.trim();
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
      })
      .filter(Boolean)
      .join(' ');

    // Step 9: Run Validation Suite
    const validation = this.validateNarration(text);

    return {
      cleanedText: text,
      removedElements: Array.from(new Set(removedElements)),
      passedValidation: validation.isValid,
      validationIssues: validation.failures
    };
  }

  /**
   * VALIDATION SUITE (Section 9 of User Request)
   * 8 rigorous checks ensuring ONLY pure lecture content reaches the student.
   */
  validateNarration(text: string): ValidationReport {
    const failures: string[] = [];

    if (!text || text.trim().length === 0) {
      return { isValid: false, failures: ['CONTENT_EMPTY'] };
    }

    // CHECK 1: Metadata Check (aicb, copyright, vinuni, course dates)
    for (const pat of this.administrativePatterns) {
      pat.lastIndex = 0;
      if (pat.test(text)) {
        failures.push('CHECK_1_METADATA_PRESENT');
        break;
      }
    }

    // CHECK 2: Section Label Check (HÃY SUY NGHĨ, HOOK, MECHANISM, S1, S2)
    const labelMatches = text.match(/\b(hãy suy nghĩ|hãy thử suy nghĩ|s[1-9]\d*|slide\s*\d+)\b/i);
    if (labelMatches) {
      failures.push(`CHECK_2_SECTION_LABEL_PRESENT: "${labelMatches[0]}"`);
    }

    // CHECK 3: UI Information & Pagination Check (1 / 52, 00:37, word count)
    for (const pat of this.paginationPatterns) {
      pat.lastIndex = 0;
      if (pat.test(text)) {
        failures.push('CHECK_3_UI_PAGINATION_PRESENT');
        break;
      }
    }

    // CHECK 4: Instruction & Instructor Notes Check (giảng viên, note, developer instruction)
    for (const pat of this.instructorNotePatterns) {
      pat.lastIndex = 0;
      if (pat.test(text)) {
        failures.push('CHECK_4_INSTRUCTOR_NOTE_PRESENT');
        break;
      }
    }

    // CHECK 5: Placeholder Check ([placeholder], <todo>, etc.)
    if (/(\[.*?\]|<.*?>|todo|placeholder)/i.test(text)) {
      failures.push('CHECK_5_PLACEHOLDER_PRESENT');
    }

    // CHECK 6: Agenda & Navigation Check (Nội dung bài học, Mục lục)
    if (/\b(nội dung bài học|mục lục|table of contents)\b/i.test(text)) {
      failures.push('CHECK_6_AGENDA_HEADER_PRESENT');
    }

    // CHECK 7: Filler Sentence Check
    if (/chúng ta sẽ tiếp tục khám phá các bước tiếp theo/i.test(text)) {
      failures.push('CHECK_7_FILLER_BOILERPLATE_PRESENT');
    }

    // CHECK 8: Teacher Speech Authenticity (Must not contain dangling syntax or empty sentences)
    if (/\b(?:và\.|giúp\s*\.|qua đó\s*\.)/i.test(text)) {
      failures.push('CHECK_8_DANGLING_CONJUNCTION_SYNTAX');
    }

    return {
      isValid: failures.length === 0,
      failures
    };
  }
}

export const contentPurifierService = new ContentPurifierService();
