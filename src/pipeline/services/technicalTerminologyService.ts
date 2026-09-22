// src/pipeline/services/technicalTerminologyService.ts
/**
 * TechnicalTerminologyService
 * Implements Vietnamese-First Narration with English Technical Terminology Preservation
 * 
 * Responsibilities:
 * 1. Load canonical terminology dictionary from technical_terms.json
 * 2. Identify technical terms in generated content and preserve standard English
 * 3. Detect unnecessary English verbs/nouns and awkward code-switching
 * 4. Avoid awkward literal translations (e.g., "hạt nhân tích chập" -> "kernel", "hộp giới hạn" -> "bounding box")
 * 5. Provide terminology prompt guidance for LLM generation
 * 6. Validate generated narration (Sentence-level & Scene-level)
 * 7. Support targeted sentence-level rewriting and auto-regeneration
 * 8. Track decision trace explaining why terms were preserved or normalized
 */

import technicalTermsData from '../..//config/technical_terms.json';

export interface TermDefinition {
  canonical: string;
  category?: string;
  domain?: string;
  language?: string;
}

export interface ValidationTokenClassification {
  word: string;
  classification: 'CANONICAL_TECHNICAL_TERM' | 'PROPER_NOUN_MODEL' | 'CODE_METRIC_FORMULA' | 'UNNECESSARY_ENGLISH';
  status: 'PASS' | 'WARNING' | 'FAIL';
  replacement?: string;
  reason?: string;
}

export interface SentenceValidationResult {
  sentence: string;
  isValid: boolean;
  score: number; // 0.0 - 1.0
  tokens: ValidationTokenClassification[];
  unnecessaryEnglishFound: string[];
  preservedTerms: string[];
  normalizedTerms: string[];
  repairedSentence?: string;
  warnings: string[];
}

export interface NarrationValidationReport {
  overallValid: boolean;
  score: number;
  language: 'vi' | 'en';
  terminologyPolicy: 'en_canonical_preserved';
  totalSentences: number;
  validSentences: number;
  failedSentenceIndices: number[];
  sentenceResults: SentenceValidationResult[];
  decisionTraces: string[];
  status: 'PASSED' | 'WARNING' | 'FAILED';
}

export class TechnicalTerminologyService {
  private static instance: TechnicalTerminologyService;
  private termsMap: Map<string, TermDefinition> = new Map();
  private awkwardTranslations: Map<string, string> = new Map();
  private unnecessaryEnglishMap: Map<string, string> = new Map();
  private canonicalKeysSorted: string[] = [];

  constructor() {
    this.loadDictionary();
  }

  static getInstance(): TechnicalTerminologyService {
    if (!TechnicalTerminologyService.instance) {
      TechnicalTerminologyService.instance = new TechnicalTerminologyService();
    }
    return TechnicalTerminologyService.instance;
  }

  private loadDictionary() {
    const rawTerms = technicalTermsData.terms as Record<string, any>;
    for (const [key, val] of Object.entries(rawTerms)) {
      this.termsMap.set(key.toLowerCase(), {
        canonical: val.canonical,
        category: val.category,
        domain: val.domain,
        language: 'en'
      });
    }

    // Sort terms by length descending to match multi-word phrases first (e.g. 'convolution kernel' before 'kernel')
    this.canonicalKeysSorted = Array.from(this.termsMap.keys()).sort((a, b) => b.length - a.length);

    const awkward = technicalTermsData.vietnamese_awkward_translations as Record<string, string>;
    for (const [key, val] of Object.entries(awkward)) {
      this.awkwardTranslations.set(key.toLowerCase(), val);
    }

    const unnecessary = technicalTermsData.unnecessary_english_verbs_and_words as Record<string, string>;
    for (const [key, val] of Object.entries(unnecessary)) {
      this.unnecessaryEnglishMap.set(key.toLowerCase(), val);
    }
  }

  /**
   * Extends or overrides terminology with project-specific glossary
   */
  registerProjectTerminology(projectGlossary?: Record<string, { canonical: string; language: string }>) {
    if (!projectGlossary) return;
    for (const [term, meta] of Object.entries(projectGlossary)) {
      this.termsMap.set(term.toLowerCase(), {
        canonical: meta.canonical,
        category: 'project_specific',
        domain: 'project',
        language: meta.language
      });
    }
    this.canonicalKeysSorted = Array.from(this.termsMap.keys()).sort((a, b) => b.length - a.length);
  }

  /**
   * System Prompt Guidelines for LLM generation (Module 3A)
   */
  getSystemPromptGuidance(): string {
    return (
      "You are generating educational narration for a Vietnamese learner.\n" +
      "Write the narration primarily in natural Vietnamese.\n" +
      "Preserve established English technical terminology when appropriate (e.g., CNN, kernel, feature map, pooling, spatial dimensions, bounding box, IoU, Transformer, attention mechanism).\n" +
      "Do not translate technical terms literally into awkward Vietnamese (e.g., do NOT translate 'convolution kernel' to 'hạt nhân tích chập', do NOT translate 'bounding box' to 'hộp giới hạn').\n" +
      "Do not use English verbs or adjectives unnecessarily (e.g., use 'quét' instead of 'scan', use 'giảm' instead of 'reduce', use 'dự đoán' instead of 'predicts', use 'xử lý' instead of 'process', use 'ảnh' instead of 'image').\n" +
      "The result should sound like a Vietnamese AI lecturer naturally explaining a technical concept.\n" +
      "Strict Rule: Use Vietnamese sentence structure + English technical terminology."
    );
  }

  /**
   * Resolves, standardizes and preserves technical terminology in a sentence.
   * Also repairs common unnecessary English words and awkward translations.
   */
  resolveAndPreserveSentence(
    sentence: string,
    decisionTraces?: string[]
  ): { resolvedText: string; preserved: string[]; normalized: string[] } {
    let resolved = sentence;
    const preserved: string[] = [];
    const normalized: string[] = [];

    // Step 0: Normalize English pedagogical goal patterns into natural Vietnamese
    const goalPatterns: [RegExp, string][] = [
      [/recall and state the foundational relevance of/gi, 'nắm vững tầm quan trọng nền tảng của'],
      [/explain the mathematical and conceptual intuition behind/gi, 'hiểu rõ bản chất và trực giác khái niệm của'],
      [/demonstrate the algorithmic application and computational flow of/gi, 'vận dụng các bước thuật toán và quy trình xử lý của'],
      [/differentiate structural tradeoffs and data efficiency in/gi, 'phân biệt các đánh đổi về cấu trúc và hiệu quả của'],
      [/critique scaling bottlenecks and operational boundaries of/gi, 'đánh giá điểm nghẽn hiệu năng và giới hạn vận hành của'],
      [/synthesize novel pipeline architectures utilizing/gi, 'tổng hợp kiến trúc hệ thống mới dựa trên'],
      [/via an instructional \w+ narrative\.?/gi, ''],
      [/thông qua (bài học|bài giảng|nội dung) trọng tâm\.?/gi, ''],
      [/thông qua phần (dẫn nhập khởi động|giải thích định nghĩa|phân tích cơ chế|ví dụ thực tế|đối chiếu so sánh|tổng kết)\.?/gi, '']
    ];
    for (const [pat, repl] of goalPatterns) {
      if (pat.test(resolved)) {
        resolved = resolved.replace(pat, repl);
        if (repl) normalized.push(`Normalized pedagogical phrasing → ${repl}`);
      }
    }

    // Remove repetitive "Mục tiêu trọng tâm ... bài học trọng tâm" and double periods
    resolved = resolved
      .replace(/Mục tiêu trọng tâm của chúng ta trong phần này là/gi, 'Mục tiêu của chúng ta trong phần này là')
      .replace(/Mục tiêu trọng tâm của chúng ta là/gi, 'Mục tiêu của chúng ta là')
      .replace(/\s*thông qua bài học trọng tâm\.?/gi, '')
      .replace(/\s*thông qua bài giảng trọng tâm\.?/gi, '')
      .replace(/\s*thông qua nội dung trọng tâm\.?/gi, '')
      .replace(/\.{2,}/g, '.')
      .replace(/\s+\./g, '.')
      .replace(/\s+/g, ' ')
      .trim();

    // Step 1: Normalize awkward literal Vietnamese translations to canonical English
    for (const [awkwardPhrase, canonicalTerm] of this.awkwardTranslations.entries()) {
      const regex = new RegExp(`\\b${awkwardPhrase}\\b`, 'gi');
      if (regex.test(resolved)) {
        resolved = resolved.replace(regex, canonicalTerm);
        normalized.push(`${awkwardPhrase} → ${canonicalTerm}`);
        decisionTraces?.push(`Normalized awkward translation "${awkwardPhrase}" to canonical English term "${canonicalTerm}".`);
      }
    }

    // Step 2: Identify and preserve canonical technical terms
    for (const key of this.canonicalKeysSorted) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      if (regex.test(resolved)) {
        const canonical = this.termsMap.get(key)!.canonical;
        resolved = resolved.replace(regex, canonical);
        if (!preserved.includes(canonical)) {
          preserved.push(canonical);
          decisionTraces?.push(`Preserved canonical technical term "${canonical}" (standard AI/CV terminology).`);
        }
      }
    }

    // Step 3: Check and convert unnecessary English words/verbs if mixed into Vietnamese sentence
    for (const [engWord, viReplacement] of this.unnecessaryEnglishMap.entries()) {
      // Look for whole word English matches
      const regex = new RegExp(`\\b${engWord}\\b`, 'gi');
      if (regex.test(resolved)) {
        // Special check: ensure it's not part of a larger technical term already preserved
        let isPartOfTerm = false;
        for (const term of preserved) {
          if (term.toLowerCase().includes(engWord.toLowerCase())) {
            isPartOfTerm = true;
            break;
          }
        }

        if (!isPartOfTerm) {
          resolved = resolved.replace(regex, viReplacement);
          decisionTraces?.push(`Converted unnecessary English "${engWord} → ${viReplacement}" to preserve natural Vietnamese.`);
        }
      }
    }

    return { resolvedText: resolved, preserved, normalized };
  }

  /**
   * Validates a single sentence against the language policy:
   * 1. Vietnamese-first narration
   * 2. Canonical English technical terms preserved
   * 3. Disallowed unnecessary English words flagged
   */
  validateSentence(sentence: string): SentenceValidationResult {
    const trimmed = sentence.trim();
    const words = trimmed.split(/\s+/).map((w) => w.replace(/^[^a-zA-Z0-9À-ỹ]+|[^a-zA-Z0-9À-ỹ]+$/g, ''));
    const tokens: ValidationTokenClassification[] = [];
    const unnecessaryEnglishFound: string[] = [];
    const preservedTerms: string[] = [];
    const normalizedTerms: string[] = [];
    const warnings: string[] = [];

    // Check awkward literal translations
    for (const [awkwardPhrase, canonicalTerm] of this.awkwardTranslations.entries()) {
      if (sentence.toLowerCase().includes(awkwardPhrase)) {
        normalizedTerms.push(`${awkwardPhrase} → ${canonicalTerm}`);
        warnings.push(`Phát hiện bản dịch kỹ thuật cứng nhắc "${awkwardPhrase}", nên dùng "${canonicalTerm}".`);
      }
    }

    // Classify each word
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!word) continue;

      const lower = word.toLowerCase();

      // Check if it's pure Vietnamese (contains diacritics or common Vietnamese particle)
      const hasVietnameseDiacritic = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(word);
      const isCommonViWord = /^(là|và|của|cho|trong|để|với|các|những|một|này|được|có|không|như|khi|theo|từ|vào|ra|qua|giúp|tạo|quét|giảm|xử|lý|dự|đoán|mô|hình|thực|hiện|chúng|ta|bạn|nội|dung|bài|học|phần|pháp|toán)$/i.test(lower);

      if (hasVietnameseDiacritic || isCommonViWord) {
        continue; // Natural Vietnamese token
      }

      // Check multi-word technical term match
      let matchedTerm: string | null = null;
      for (const canonicalKey of this.canonicalKeysSorted) {
        if (canonicalKey.includes(' ')) {
          const phraseRegex = new RegExp(`\\b${canonicalKey}\\b`, 'i');
          if (phraseRegex.test(sentence)) {
            const canonical = this.termsMap.get(canonicalKey)!.canonical;
            if (!preservedTerms.includes(canonical)) preservedTerms.push(canonical);
            if (canonicalKey.toLowerCase().split(/\s+/).includes(lower)) {
              matchedTerm = canonical;
              break;
            }
          }
        }
      }

      if (matchedTerm) {
        tokens.push({
          word,
          classification: 'CANONICAL_TECHNICAL_TERM',
          status: 'PASS',
          reason: `Thuật ngữ chuẩn (${matchedTerm})`
        });
        continue;
      }

      // Check single-word technical term
      if (this.termsMap.has(lower)) {
        const canonical = this.termsMap.get(lower)!.canonical;
        if (!preservedTerms.includes(canonical)) preservedTerms.push(canonical);
        tokens.push({
          word,
          classification: 'CANONICAL_TECHNICAL_TERM',
          status: 'PASS',
          reason: `Thuật ngữ chuẩn: ${canonical}`
        });
        continue;
      }

      // Check acronym / model / architecture name (all caps 2-6 chars or common numbers)
      if (/^[A-Z0-9_\-]+$/.test(word) && word.length >= 2) {
        tokens.push({
          word,
          classification: 'PROPER_NOUN_MODEL',
          status: 'PASS',
          reason: 'Tên viết tắt/Model/Metric'
        });
        continue;
      }

      // Check code / formula / number
      if (/^\d+(\.\d+)?(%|x|px|ms|s)?$/i.test(word)) {
        tokens.push({
          word,
          classification: 'CODE_METRIC_FORMULA',
          status: 'PASS'
        });
        continue;
      }

      // Check unnecessary English word
      if (this.unnecessaryEnglishMap.has(lower)) {
        const vi = this.unnecessaryEnglishMap.get(lower)!;
        unnecessaryEnglishFound.push(word);
        tokens.push({
          word,
          classification: 'UNNECESSARY_ENGLISH',
          status: 'FAIL',
          replacement: vi,
          reason: `Từ tiếng Anh không cần thiết: "${word}" nên thay bằng "${vi}"`
        });
        continue;
      }

      // If word is pure English alphabet (non-Vietnamese) and not identified above
      if (/^[a-zA-Z]+$/.test(word) && word.length > 2) {
        // Unknown English word in Vietnamese sentence
        unnecessaryEnglishFound.push(word);
        tokens.push({
          word,
          classification: 'UNNECESSARY_ENGLISH',
          status: 'WARNING',
          reason: `Từ tiếng Anh ngoài danh mục: "${word}"`
        });
      }
    }

    // Check Vietnamese-first ratio
    const isMainlyVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(sentence);
    const hasExcessiveEnglish = unnecessaryEnglishFound.length > 0;

    let score = 1.0;
    if (!isMainlyVietnamese) score -= 0.6;
    if (unnecessaryEnglishFound.length > 0) score -= Math.min(0.5, unnecessaryEnglishFound.length * 0.2);
    if (normalizedTerms.length > 0) score -= 0.1;
    score = Math.max(0, Math.min(1.0, score));

    const isValid = isMainlyVietnamese && unnecessaryEnglishFound.length === 0;

    // Build repair sentence
    const repairedSentence = isValid
      ? sentence
      : this.resolveAndPreserveSentence(sentence).resolvedText;

    return {
      sentence,
      isValid,
      score,
      tokens,
      unnecessaryEnglishFound,
      preservedTerms,
      normalizedTerms,
      repairedSentence,
      warnings
    };
  }

  /**
   * Validates full narration text across all sentences and generates detailed report
   */
  validateNarration(narrationText: string): NarrationValidationReport {
    const rawSentences = narrationText.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    const sentenceResults: SentenceValidationResult[] = [];
    const failedIndices: number[] = [];
    const decisionTraces: string[] = [];

    let totalScore = 0;
    for (let i = 0; i < rawSentences.length; i++) {
      const res = this.validateSentence(rawSentences[i]);
      sentenceResults.push(res);
      totalScore += res.score;

      if (!res.isValid) {
        failedIndices.push(i);
      }

      // Collect traces
      for (const p of res.preservedTerms) {
        const trace = `"${p}" was preserved because it is a standard Computer Vision / AI technical term.`;
        if (!decisionTraces.includes(trace)) decisionTraces.push(trace);
      }
      for (const n of res.normalizedTerms) {
        const trace = `Awkward translation resolved: ${n}.`;
        if (!decisionTraces.includes(trace)) decisionTraces.push(trace);
      }
      for (const eng of res.unnecessaryEnglishFound) {
        const vi = this.unnecessaryEnglishMap.get(eng.toLowerCase());
        if (vi) {
          const trace = `Replaced unnecessary English "${eng} → ${vi}" for natural Vietnamese flow.`;
          if (!decisionTraces.includes(trace)) decisionTraces.push(trace);
        }
      }
    }

    const avgScore = rawSentences.length === 0 ? 1.0 : totalScore / rawSentences.length;
    const overallValid = failedIndices.length === 0;
    const status: 'PASSED' | 'WARNING' | 'FAILED' =
      avgScore >= 0.90 && failedIndices.length === 0
        ? 'PASSED'
        : avgScore >= 0.70
        ? 'WARNING'
        : 'FAILED';

    return {
      overallValid,
      score: Math.round(avgScore * 100) / 100,
      language: 'vi',
      terminologyPolicy: 'en_canonical_preserved',
      totalSentences: rawSentences.length,
      validSentences: rawSentences.length - failedIndices.length,
      failedSentenceIndices: failedIndices,
      sentenceResults,
      decisionTraces,
      status
    };
  }

  /**
   * Sentence-level targeted regeneration / repair (Section 18)
   * Only repairs affected sentences rather than regenerating the entire lesson.
   */
  repairNarrationTargeted(narrationText: string): { repairedText: string; repairsCount: number; traces: string[] } {
    const traces: string[] = [];
    const rawSentences = narrationText.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    let repairsCount = 0;

    const repairedSentences = rawSentences.map((sentence) => {
      const check = this.validateSentence(sentence);
      if (!check.isValid && check.repairedSentence && check.repairedSentence !== sentence) {
        repairsCount++;
        traces.push(`Repaired sentence: "${sentence}" → "${check.repairedSentence}"`);
        return check.repairedSentence;
      }
      return sentence;
    });

    return {
      repairedText: repairedSentences.join(' '),
      repairsCount,
      traces
    };
  }
}

export const technicalTerminologyService = TechnicalTerminologyService.getInstance();
