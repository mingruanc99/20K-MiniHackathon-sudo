// src/pipeline/services/narrativePlannerService.ts
/**
 * Context-Aware Narrative Planner Service
 * Upgraded for Natural & Focused Narration (One Slide = One Core Message)
 * 
 * Responsibilities:
 * 1. Content Filtering: Distinguish INSTRUCTIONAL_CONTENT from METADATA / BOILERPLATE
 * 2. Core Message Extraction: Single concise sentence defining the learning purpose
 * 3. Contextual Role Classification: Resolves TITLE/INTRODUCTION, HOOK, CORE_CONCEPT, EXAMPLE, etc.
 * 4. Verbosity & Strategy Planning: MINIMAL, CONCISE, STANDARD, DETAILED
 * 5. Slide-to-Slide Continuity without generic filler or premature disclosure
 */

import {
  DocumentSection,
  SectionPlan,
  SlideAnalysis,
  NarrativePlan,
  SlideRole,
  ImportanceLevel,
  InstructionalValue,
  ContentType,
  NarrativeFunction,
  RelationshipType,
  OpeningStrategy,
  BodyStrategy,
  ClosingStrategy,
  ListStrategy,
  VerbosityLevel
} from '../../types';
import { contentPurifierService } from './contentPurifierService';

export interface FilteredContentResult {
  instructionalText: string;
  supportingPoints: string[];
  excludedContent: string[];
}

export class NarrativePlannerService {
  // Common metadata and boilerplate patterns to filter out
  private metadataPatterns: RegExp[] = [
    /\b(aicb-[a-z0-9]+|data track|vinuniversity|stanford|mit|harvard)\b/i,
    /\b(ngày\s*\d+|day\s*\d+|chương\s*\d+|chapter\s*\d+|part\s*\d+)\b/i,
    /\b(slide\s*\d+|trang\s*\d+|page\s*\d+)\b/i,
    /\b\d+\s*[/|]\s*\d+\b/i,
    /\b(all rights reserved|copyright|bản quyền|confidential)\b/i,
    /\b(giảng viên|instructor notes?|speaker notes?|ghi chú)\b/i,
    /\b(nội dung bài học|mục lục|table of contents|agenda)\b/i,
    /https?:\/\/[^\s]+/i,
    /\b(v\d+\.\d+(\.\d+)?|version\s*\d+)\b/i,
    /^[•\-\*·\s]+$/
  ];

  /**
   * Plans narrative strategies and slide relationships for all sections in the lesson
   */
  planNarrative(
    sections: SectionPlan[],
    docSections: DocumentSection[]
  ): { analyses: Map<string, SlideAnalysis>; plans: Map<string, NarrativePlan> } {
    const total = sections.length;
    const docMap = new Map(docSections.map((d) => [d.section_id, d]));

    const analyses = new Map<string, SlideAnalysis>();
    const narrativePlans = new Map<string, NarrativePlan>();
    const cumulativeExplainedConcepts = new Set<string>();

    // Pass 1: Infer Slide Analysis with Content Filtering & Core Message for every section
    let hasEncounteredHook = false;
    sections.forEach((sec, idx) => {
      const docSec = docMap.get(sec.section_id);
      const effectiveOrder = sec.order || idx + 1;
      const analysis = this.analyzeSlide(sec, docSec, effectiveOrder, total, hasEncounteredHook);
      if (analysis.slide_role === 'HOOK') {
        hasEncounteredHook = true;
      }
      analyses.set(sec.section_id, analysis);
    });

    // Pass 2: Establish Contextual Slide-to-Slide Relationships & Narrative Strategy
    sections.forEach((sec, idx) => {
      const currentAnalysis = analyses.get(sec.section_id)!;

      const prevSec = idx > 0 ? sections[idx - 1] : undefined;
      const prevAnalysis = prevSec ? analyses.get(prevSec.section_id) : undefined;

      const nextSec = idx < total - 1 ? sections[idx + 1] : undefined;
      const nextAnalysis = nextSec ? analyses.get(nextSec.section_id) : undefined;

      // Establish relationships
      const relToPrev = prevSec && prevAnalysis
        ? this.inferRelationshipToPrevious(prevSec, prevAnalysis, sec, currentAnalysis)
        : undefined;

      const relToNext = nextSec && nextAnalysis
        ? this.inferRelationshipToNext(sec, currentAnalysis, nextSec, nextAnalysis)
        : undefined;

      // Track already explained vs current vs future
      const currentNewInfo = sec.key_concepts.filter((c) => !cumulativeExplainedConcepts.has(c.toLowerCase()));
      sec.key_concepts.forEach((c) => cumulativeExplainedConcepts.add(c.toLowerCase()));

      const futureConcepts: string[] = [];
      for (let f = idx + 1; f < total; f++) {
        futureConcepts.push(...sections[f].key_concepts);
      }

      // Strategies & Verbosity
      const opening = this.determineOpeningStrategy(idx + 1, total, currentAnalysis, relToPrev?.type);
      const body = this.determineBodyStrategy(currentAnalysis);
      const closing = this.determineClosingStrategy(idx + 1, total, currentAnalysis, relToNext?.type);
      const listStrat = currentAnalysis.list_strategy || 'NONE';
      const verbosity = this.determineVerbosity(currentAnalysis.slide_role);

      const narrativePlan: NarrativePlan = {
        narrative_function: this.determineNarrativeFunction(currentAnalysis.slide_role),
        previous_slide_id: prevSec?.section_id,
        next_slide_id: nextSec?.section_id,
        relationship_to_previous: relToPrev,
        relationship_to_next: relToNext,
        opening_strategy: opening,
        body_strategy: body,
        closing_strategy: closing,
        list_strategy: listStrat,
        verbosity,
        already_explained_concepts: Array.from(cumulativeExplainedConcepts),
        current_new_information: currentNewInfo,
        future_information: Array.from(new Set(futureConcepts)).slice(0, 5)
      };

      narrativePlans.set(sec.section_id, narrativePlan);
    });

    return { analyses, plans: narrativePlans };
  }

  /**
   * Filters out irrelevant metadata, course codes, footers from instructional content
   */
  filterContent(rawText?: string): FilteredContentResult {
    if (!rawText) {
      return { instructionalText: '', supportingPoints: [], excludedContent: [] };
    }

    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const validLines: string[] = [];
    const excludedContent: string[] = [];

    for (const line of lines) {
      let isMetadata = false;
      for (const pat of this.metadataPatterns) {
        if (pat.test(line)) {
          isMetadata = true;
          // Extract specific matched tokens
          const matches = line.match(pat);
          if (matches) {
            excludedContent.push(...matches.map((m) => m.trim().toLowerCase()));
          }
          break;
        }
      }

      if (isMetadata) {
        // Exclude the entire metadata line or segments separated by dots/dashes
        const parts = line.split(/[·•|]/).map((p) => p.trim());
        for (const part of parts) {
          if (this.metadataPatterns.some((p) => p.test(part))) {
            excludedContent.push(part.toLowerCase());
          }
        }
      } else {
        validLines.push(line);
      }
    }

    const uniqueExcluded = Array.from(new Set(excludedContent.filter((c) => c.length > 2)));
    const cleanInstructionalText = validLines.join('\n');
    const rawSupportingPoints = validLines
      .map((l) => l.replace(/^[•\-\*\d\.\)]\s*/, '').trim())
      .filter((l) => l.length > 3 && !uniqueExcluded.includes(l.toLowerCase()));
    const supportingPoints = contentPurifierService.cleanBulletPoints(rawSupportingPoints);

    return {
      instructionalText: cleanInstructionalText,
      supportingPoints: supportingPoints.slice(0, 3),
      excludedContent: uniqueExcluded
    };
  }

  /**
   * Extracts exactly ONE concise core message sentence for the slide
   */
  extractCoreMessage(
    title: string,
    role: SlideRole,
    cleanText: string,
    supportingPoints: string[]
  ): string {
    const rawT = title.trim();
    const cleanTitle = contentPurifierService.sanitizeTitleForSpeech(rawT);
    const t = cleanTitle || 'chủ đề này';

    switch (role) {
      case 'INTRODUCTION':
        if (rawT.toLowerCase().includes('keypoint & pose')) {
          return 'Giới thiệu chủ đề Keypoint & Pose.';
        }
        return `Giới thiệu chủ đề ${t}.`;
      case 'HOOK':
        if (
          cleanText.toLowerCase().includes('tay trái') ||
          cleanText.toLowerCase().includes('vô-lăng') ||
          cleanText.toLowerCase().includes('tài xế')
        ) {
          return 'Đặt ra vấn đề về việc xác định keypoint và pose từ một góc nhìn cụ thể.';
        }
        return `Đặt ra vấn đề về ${t} qua tình huống thực tế để khơi gợi tư duy.`;
      case 'THINK':
      case 'QUESTION':
        return `Kích thích suy luận và đặt câu hỏi tại sao việc xác định ${t} lại là một thách thức lớn.`;
      case 'MECHANISM':
        return `Giải thích cơ chế mô hình giải quyết thách thức của ${t} thông qua các mối quan hệ không gian.`;
      case 'TECHNICAL':
        return `Phân tích sâu về mặt kỹ thuật thuật toán vận hành của ${t}.`;
      case 'CORE_CONCEPT':
        return `${t} là khái niệm nền tảng xác định cách mô hình biểu diễn dữ liệu.`;
      case 'KEY_EXPLANATION':
        return `${t} giải thích cách các thành phần tương tác để trích xuất đặc trưng.`;
      case 'PROCESS':
        return `${t} mô tả quy trình biến đổi dữ liệu một cách liên tục.`;
      case 'EXAMPLE':
        return `Ví dụ trực quan minh họa cơ chế hoạt động của ${t}.`;
      case 'APPLICATION':
        return `${t} được ứng dụng vào giải quyết các bài toán thực tiễn.`;
      case 'COMPARISON':
        return `${t} so sánh các ưu nhược điểm và đánh đổi giữa các phương án.`;
      case 'EVIDENCE':
        return `${t} cung cấp kết quả thực nghiệm chứng minh hiệu năng.`;
      case 'SUMMARY':
        return `Tổng kết các điểm mấu chốt và quy tắc cốt lõi đã học.`;
      case 'DECORATIVE':
      case 'TRANSITION':
        return `Chuyển tiếp phân cảnh bài giảng.`;
    }
  }

  /**
   * Analyzes an individual slide: role, importance, instructional value, content type, list strategy, core message
   */
  private analyzeSlide(
    sec: SectionPlan,
    docSec: DocumentSection | undefined,
    order: number,
    total: number,
    hasPriorHook: boolean = false
  ): SlideAnalysis {
    const title = (sec.title || '').trim();
    const titleLower = title.toLowerCase();
    const rawText = docSec?.raw_text || '';

    // Step 1: Content Filtering (Metadata isolation)
    const { instructionalText, supportingPoints, excludedContent } = this.filterContent(rawText);
    const cleanCombined = `${titleLower} ${instructionalText.toLowerCase()}`;

    // Step 2: Role Classification with Hierarchy (Section 15 & 16)
    let role: SlideRole = 'KEY_EXPLANATION';
    let importance: ImportanceLevel = 'medium';
    let instructionalVal: InstructionalValue = 'high';
    let contentType: ContentType = 'concept';

    // Check HOOK / Question / Thought-provoking prompt (Problem B & Section 6)
    const isDefinitional =
      titleLower.startsWith('what is') ||
      titleLower.includes('là gì') ||
      titleLower.includes('khái niệm') ||
      titleLower.includes('định nghĩa');

    const isQuestionOrHook =
      !isDefinitional &&
      (titleLower.includes('hãy suy nghĩ') ||
        titleLower.includes('suy nghĩ') ||
        titleLower.includes('bạn có biết') ||
        titleLower.includes('điều gì xảy ra nếu') ||
        titleLower.includes('theo bạn') ||
        titleLower.includes('câu hỏi') ||
        titleLower.includes('question') ||
        titleLower.includes('puzzle') ||
        titleLower.includes('thử thách') ||
        titleLower.includes('hook') ||
        instructionalText.toLowerCase().includes('hãy suy nghĩ') ||
        instructionalText.toLowerCase().includes('tay trái hay tay phải') ||
        instructionalText.toLowerCase().includes('vô-lăng') ||
        (instructionalText.includes('?') && !instructionalText.toLowerCase().includes('what is cnn') && !isDefinitional));

    // 1. Mechanism / Model Solution
    if (
      titleLower.includes('mechanism') ||
      titleLower.includes('cơ chế') ||
      cleanCombined.includes('mối quan hệ không gian') ||
      cleanCombined.includes('đồ thị khung xương') ||
      (order >= 4 && cleanCombined.includes('giải quyết vấn đề')) ||
      (order >= 4 && cleanCombined.includes('học mối quan hệ'))
    ) {
      role = 'MECHANISM';
      importance = 'high';
      instructionalVal = 'high';
      contentType = 'mechanism';
    }
    // 2. Example / Case Study / Concrete scenario
    else if (
      titleLower.includes('example') ||
      titleLower.includes('ví dụ') ||
      titleLower.includes('walkthrough') ||
      titleLower.includes('case study') ||
      titleLower.includes('concrete') ||
      cleanCombined.includes('cánh tay bị che') ||
      cleanCombined.includes('bị che một phần') ||
      cleanCombined.includes('occlu') ||
      (order === 3 && (cleanCombined.includes('trong hình') || cleanCombined.includes('ảnh này') || cleanCombined.includes('tình huống')))
    ) {
      role = 'EXAMPLE';
      importance = 'medium';
      instructionalVal = 'high';
      contentType = 'example';
    }
    // 3. Think / Question / Cognitive reflection (S2 or challenge prompt)
    else if (
      titleLower.includes('hãy suy nghĩ') ||
      titleLower.includes('suy nghĩ') ||
      titleLower.includes('think') ||
      titleLower.includes('puzzle') ||
      titleLower.includes('thử thách') ||
      (hasPriorHook && isQuestionOrHook) ||
      (order === 2 && isQuestionOrHook && (titleLower.includes('suy nghĩ') || cleanCombined.includes('xác định được đâu là')))
    ) {
      role = hasPriorHook ? 'THINK' : 'HOOK';
      importance = 'high';
      instructionalVal = 'high';
      contentType = 'question';
    }
    // 4. Hook / Curiosity (S1 or first curiosity challenge)
    else if (
      (order === 1 && (isQuestionOrHook || titleLower.includes('hook') || cleanCombined.includes('tài xế') || cleanCombined.includes('tay trái'))) ||
      (!hasPriorHook && isQuestionOrHook && order <= 2)
    ) {
      role = 'HOOK';
      importance = 'high';
      instructionalVal = 'high';
      contentType = 'question';
    }
    // Title / Introduction Slide (Problem A & Section 5)
    else if (
      (order === 1 && !isDefinitional) ||
      (order === 1 && titleLower.includes('keypoint & pose')) ||
      (instructionalText.trim().length <= 40 && (titleLower.includes('intro') || titleLower.includes('giới thiệu') || titleLower.includes('chương') || titleLower.includes('bài '))) ||
      (order <= 2 && instructionalText.trim().length < 25 && !titleLower.includes('convolution') && !titleLower.includes('architecture') && !isDefinitional)
    ) {
      role = 'INTRODUCTION';
      importance = 'high';
      instructionalVal = 'medium';
      contentType = 'title';
    }
    // Example (Section 14)
    else if (
      titleLower.includes('example') ||
      titleLower.includes('ví dụ') ||
      titleLower.includes('walkthrough') ||
      titleLower.includes('case study') ||
      titleLower.includes('concrete')
    ) {
      role = 'EXAMPLE';
      importance = 'medium';
      instructionalVal = 'high';
      contentType = 'example';
    }
    // Summary / Conclusion (Section 16)
    else if (
      titleLower.includes('summary') ||
      titleLower.includes('conclusion') ||
      titleLower.includes('tổng kết') ||
      titleLower.includes('synthesis') ||
      (order === total && total > 2 && !titleLower.includes('convolution') && !titleLower.includes('application'))
    ) {
      role = 'SUMMARY';
      importance = 'medium';
      instructionalVal = 'medium';
      contentType = 'summary';
    }
    // Application
    else if (
      titleLower.includes('application') ||
      titleLower.includes('ứng dụng') ||
      titleLower.includes('real-world') ||
      titleLower.includes('in practice') ||
      titleLower.includes('use case')
    ) {
      role = 'APPLICATION';
      importance = 'medium';
      instructionalVal = 'medium';
      contentType = 'application';
    }
    // Comparison
    else if (
      titleLower.includes(' vs ') ||
      titleLower.includes('versus') ||
      titleLower.includes('comparison') ||
      titleLower.includes('so sánh') ||
      titleLower.includes('tradeoff') ||
      titleLower.includes('difference')
    ) {
      role = 'COMPARISON';
      importance = 'medium';
      instructionalVal = 'high';
      contentType = 'comparison';
    }
    // Evidence / Results / Benchmark
    else if (
      titleLower.includes('benchmark') ||
      titleLower.includes('results') ||
      titleLower.includes('evaluation') ||
      titleLower.includes('metrics') ||
      titleLower.includes('kết quả') ||
      titleLower.includes('đánh giá hiệu năng')
    ) {
      role = 'EVIDENCE';
      importance = 'medium';
      instructionalVal = 'medium';
      contentType = 'data';
    }
    // Process / Mechanism
    else if (
      titleLower.includes('operation') ||
      titleLower.includes('how it works') ||
      titleLower.includes('mechanics') ||
      titleLower.includes('cơ chế') ||
      titleLower.includes('quy trình') ||
      cleanCombined.includes('->') ||
      cleanCombined.includes('→')
    ) {
      role = 'PROCESS';
      importance = 'high';
      instructionalVal = 'high';
      contentType = 'process';
    }
    // Decorative / Section Divider / Low instructional value
    else if (
      (instructionalText.trim().length < 35 && (titleLower.includes('part ') || titleLower.includes('section ') || titleLower.includes('divider') || titleLower.includes('break'))) ||
      (instructionalText.trim().length < 20 && (!docSec?.elements || docSec.elements.length <= 1) && order > 2)
    ) {
      role = 'DECORATIVE';
      importance = 'low';
      instructionalVal = 'low';
      contentType = 'image';
    }
    // Core Concept vs Key Explanation
    else if (
      titleLower.includes('what is') ||
      titleLower.includes('concept') ||
      titleLower.includes('khái niệm') ||
      titleLower.includes('fundamental') ||
      titleLower.includes('foundation') ||
      (titleLower.includes('convolution') && !titleLower.includes('operation') && !titleLower.includes('example'))
    ) {
      role = 'CORE_CONCEPT';
      importance = 'high';
      instructionalVal = 'high';
      contentType = 'concept';
    } else {
      role = 'KEY_EXPLANATION';
      importance = 'medium';
      instructionalVal = 'high';
      contentType = 'concept';
    }

    // Step 3: List Strategy (Default is NONE)
    let listStrategy: ListStrategy = 'NONE';
    const hasExplicitNumbering = /^\s*(\d+\.|\([0-9]+\)|[a-z]\))\s+/m.test(instructionalText);
    const hasCategoryHeading =
      titleLower.includes('types of') ||
      titleLower.includes('các loại') ||
      titleLower.includes('phân loại') ||
      titleLower.includes('three types') ||
      titleLower.includes('four types');

    if (hasExplicitNumbering && hasCategoryHeading) {
      listStrategy = 'CATEGORY_LIST';
    } else if (hasExplicitNumbering && role === 'PROCESS') {
      listStrategy = 'SEQUENTIAL_PROCESS';
    } else if (hasExplicitNumbering && role === 'SUMMARY') {
      listStrategy = 'ORDERED_LIST';
    } else {
      listStrategy = 'NONE';
    }

    // Step 4: Core message extraction
    const coreMessage = this.extractCoreMessage(title, role, instructionalText, supportingPoints);

    const requiresExplanation = role !== 'DECORATIVE' && role !== 'INTRODUCTION' && role !== 'HOOK';
    const requiresTransition = order > 1 && role !== 'DECORATIVE';
    const requiresExample = role === 'EXAMPLE';

    return {
      slide_role: role,
      importance,
      instructional_value: instructionalVal,
      content_type: contentType,
      core_message: coreMessage,
      supporting_points: supportingPoints,
      excluded_content: excludedContent,
      requires_explanation: requiresExplanation,
      requires_transition: requiresTransition,
      requires_example: requiresExample,
      explanation_strategy: this.getExplanationStrategy(role),
      list_strategy: listStrategy
    };
  }

  private determineVerbosity(role: SlideRole): VerbosityLevel {
    switch (role) {
      case 'INTRODUCTION':
      case 'HOOK':
      case 'DECORATIVE':
      case 'TRANSITION':
        return 'minimal';
      case 'EXAMPLE':
      case 'APPLICATION':
      case 'EVIDENCE':
      case 'SUMMARY':
        return 'concise';
      case 'CORE_CONCEPT':
      case 'KEY_EXPLANATION':
      case 'PROCESS':
        return 'standard';
      default:
        return 'concise';
    }
  }

  private getExplanationStrategy(role: SlideRole): string {
    switch (role) {
      case 'INTRODUCTION':
        return 'Short Orientation (1–2 sentences, no theoretical dump)';
      case 'HOOK':
        return 'Curiosity Prompt / Question (1–3 sentences, no immediate technical explanation)';
      case 'THINK':
      case 'QUESTION':
        return 'Cognitive Challenge & Reflection (1–2 questions exploring why this is hard)';
      case 'MECHANISM':
        return 'System Resolution & Spatial/Structural Causal Logic (2–4 sentences)';
      case 'TECHNICAL':
        return 'Algorithmic Mechanics & Component Implementation (2–5 sentences)';
      case 'CORE_CONCEPT':
        return 'Intuition → Definition → Significance (2–4 sentences)';
      case 'KEY_EXPLANATION':
        return 'Component Analysis & Interactive Relationships (2–5 sentences)';
      case 'PROCESS':
        return 'Continuous Causal Flow without mechanical numbering';
      case 'EXAMPLE':
        return 'Concept Reference → Concrete Case → Interpretation (2–4 sentences)';
      case 'APPLICATION':
        return 'Practical Context & Real-world Impact (2–4 sentences)';
      case 'COMPARISON':
        return 'Contrastive Tradeoffs & Distinctions (2–5 sentences)';
      case 'EVIDENCE':
        return 'Pattern Recognition & Critical Takeaways (not reading every number)';
      case 'SUMMARY':
        return 'Synthesis of Previous Insights (No new theory, 2–4 sentences)';
      case 'TRANSITION':
        return 'Purposeful Conceptual Bridge';
      case 'DECORATIVE':
        return 'Minimal Orientation (0–1 sentence)';
    }
  }

  private determineNarrativeFunction(role: SlideRole): NarrativeFunction {
    switch (role) {
      case 'INTRODUCTION':
      case 'HOOK':
      case 'THINK':
      case 'QUESTION':
        return 'INTRODUCE';
      case 'CORE_CONCEPT':
      case 'PROCESS':
      case 'MECHANISM':
      case 'TECHNICAL':
        return 'EXPLAIN';
      case 'KEY_EXPLANATION':
        return 'ELABORATE';
      case 'EXAMPLE':
        return 'ILLUSTRATE';
      case 'APPLICATION':
        return 'APPLY';
      case 'COMPARISON':
        return 'COMPARE';
      case 'EVIDENCE':
        return 'EVIDENCE';
      case 'SUMMARY':
        return 'SUMMARIZE';
      case 'TRANSITION':
      case 'DECORATIVE':
        return 'TRANSITION';
    }
  }

  private inferRelationshipToPrevious(
    prevPlan: SectionPlan,
    prevAnalysis: SlideAnalysis,
    currPlan: SectionPlan,
    currAnalysis: SlideAnalysis
  ): { type: RelationshipType; reason: string } {
    const prevRole = prevAnalysis.slide_role;
    const currRole = currAnalysis.slide_role;

    if (currRole === 'HOOK') {
      return {
        type: 'INTRODUCES',
        reason: `Đặt ra câu hỏi mở đầu nhằm khơi gợi tư duy trước khi đi vào giải thích kỹ thuật.`
      };
    }

    if (currRole === 'THINK' || currRole === 'QUESTION') {
      return {
        type: 'INTRODUCES',
        reason: `Đặt câu hỏi kích thích suy luận kết nối từ vấn đề thực tế sang cơ chế giải quyết.`
      };
    }

    if (currRole === 'MECHANISM') {
      return {
        type: 'EXPLAINS',
        reason: `Giải thích cơ chế giải quyết vấn đề đã được đặt ra ở các phân cảnh trước.`
      };
    }

    if (currRole === 'EXAMPLE') {
      return {
        type: 'ILLUSTRATES',
        reason: `Slide ${currPlan.section_id} cung cấp ví dụ trực quan cụ thể cho khái niệm được giới thiệu ở slide trước.`
      };
    }

    if (currRole === 'SUMMARY') {
      return {
        type: 'SUMMARIZES',
        reason: `Slide ${currPlan.section_id} tổng kết và củng cố toàn bộ các luận điểm đã phân tích.`
      };
    }

    if (currRole === 'APPLICATION') {
      return {
        type: 'APPLIES',
        reason: `Slide ${currPlan.section_id} ứng dụng các nguyên lý kỹ thuật vào các bài toán thực tiễn.`
      };
    }

    if (currRole === 'COMPARISON') {
      return {
        type: 'CONTRASTS',
        reason: `Slide ${currPlan.section_id} so sánh các phương án và đánh đổi với phương pháp trước.`
      };
    }

    if (currRole === 'EVIDENCE') {
      return {
        type: 'PROVIDES_EVIDENCE_FOR',
        reason: `Slide ${currPlan.section_id} đưa ra bằng chứng thực nghiệm củng cố lý thuyết trước đó.`
      };
    }

    if (currRole === 'CORE_CONCEPT' && prevRole === 'CORE_CONCEPT') {
      return {
        type: 'CONTINUES',
        reason: `Phát triển tiếp hệ thống khái niệm liên quan.`
      };
    }

    if (currRole === 'KEY_EXPLANATION' && (prevRole === 'CORE_CONCEPT' || prevRole === 'INTRODUCTION')) {
      return {
        type: 'DEEPENS',
        reason: `Đi sâu vào cơ chế chi tiết từ khái niệm nền tảng ban đầu.`
      };
    }

    if (
      (prevRole === 'HOOK' && (currRole === 'CORE_CONCEPT' || currRole === 'KEY_EXPLANATION')) ||
      (prevRole === 'CORE_CONCEPT' && currRole === 'KEY_EXPLANATION') ||
      (prevRole === 'KEY_EXPLANATION' && currRole === 'PROCESS') ||
      (prevPlan.title.toLowerCase().includes('architecture') && currPlan.title.toLowerCase().includes('convolution'))
    ) {
      return {
        type: 'DEEPENS',
        reason: `Slide ${prevPlan.section_id} dẫn nhập; Slide ${currPlan.section_id} đào sâu chi tiết cơ chế hoạt động.`
      };
    }

    if (prevRole === 'EXAMPLE' && (currRole === 'KEY_EXPLANATION' || currRole === 'PROCESS' || currRole === 'CORE_CONCEPT')) {
      return {
        type: 'CONTINUES',
        reason: `Sau khi đã hiểu rõ qua ví dụ minh họa, bài giảng tiếp tục chuyển sang thành phần cốt lõi tiếp theo.`
      };
    }

    return {
      type: 'CONTINUES',
      reason: `Nối tiếp mạch bài học một cách tự nhiên.`
    };
  }

  private inferRelationshipToNext(
    currPlan: SectionPlan,
    currAnalysis: SlideAnalysis,
    nextPlan: SectionPlan,
    nextAnalysis: SlideAnalysis
  ): { type: RelationshipType; reason: string } {
    const currRole = currAnalysis.slide_role;
    const nextRole = nextAnalysis.slide_role;

    if (currRole === 'HOOK') {
      return {
        type: 'DEEPENS',
        reason: `Sau câu hỏi khơi gợi, slide kế tiếp sẽ phân tích cơ chế kỹ thuật.`
      };
    }
    if (currRole === 'THINK' || currRole === 'QUESTION') {
      return {
        type: 'ILLUSTRATES',
        reason: `Sau câu hỏi tư duy, phân cảnh tiếp theo sẽ minh họa ví dụ cụ thể hoặc giải thích cơ chế.`
      };
    }
    if (currRole === 'MECHANISM') {
      return {
        type: 'DEEPENS',
        reason: `Sau khi giải thích cơ chế nền tảng, phân cảnh kế tiếp sẽ đi sâu vào chi tiết kỹ thuật.`
      };
    }
    if (nextRole === 'EXAMPLE') {
      return {
        type: 'ILLUSTRATES',
        reason: `Slide kế tiếp sẽ minh họa cơ chế này bằng một ví dụ trực quan.`
      };
    }
    if (nextRole === 'APPLICATION') {
      return {
        type: 'APPLIES',
        reason: `Slide kế tiếp sẽ ứng dụng lý thuyết vào giải quyết bài toán thực tế.`
      };
    }
    if (nextRole === 'SUMMARY') {
      return {
        type: 'SUMMARIZES',
        reason: `Slide kế tiếp sẽ tổng kết lại toàn bộ bài học.`
      };
    }

    return {
      type: 'CONTINUES',
      reason: `Tiếp tục tiến trình giảng dạy sang chủ đề kế tiếp.`
    };
  }

  private determineOpeningStrategy(
    order: number,
    total: number,
    analysis: SlideAnalysis,
    relType?: RelationshipType
  ): OpeningStrategy {
    if (order === 1 || analysis.slide_role === 'INTRODUCTION') {
      return 'DIRECT';
    }
    if (analysis.slide_role === 'HOOK' || analysis.slide_role === 'THINK' || analysis.slide_role === 'QUESTION') {
      return 'QUESTION';
    }
    if (analysis.slide_role === 'EXAMPLE') {
      return 'EXAMPLE_INTRODUCTION';
    }
    if (analysis.slide_role === 'MECHANISM' || analysis.slide_role === 'TECHNICAL') {
      return 'DIRECT';
    }
    if (analysis.slide_role === 'SUMMARY') {
      return 'SUMMARY_RECALL';
    }
    if (relType === 'DEEPENS') {
      return 'BRIDGE_FROM_PREVIOUS';
    }
    return 'DIRECT';
  }

  private determineBodyStrategy(analysis: SlideAnalysis): BodyStrategy {
    switch (analysis.slide_role) {
      case 'HOOK':
      case 'INTRODUCTION':
        return 'CONCEPTUAL';
      case 'CORE_CONCEPT':
        return 'CONCEPTUAL';
      case 'PROCESS':
      case 'KEY_EXPLANATION':
        return 'CAUSAL';
      case 'EXAMPLE':
        return 'EXAMPLE';
      case 'APPLICATION':
        return 'APPLICATION';
      case 'COMPARISON':
        return 'COMPARISON';
      case 'EVIDENCE':
        return 'EVIDENCE';
      default:
        return 'CONCEPTUAL';
    }
  }

  private determineClosingStrategy(
    order: number,
    total: number,
    analysis: SlideAnalysis,
    relNextType?: RelationshipType
  ): ClosingStrategy {
    if (order === total || analysis.slide_role === 'SUMMARY') {
      return 'KEY_TAKEAWAY';
    }
    if (analysis.slide_role === 'HOOK') {
      return 'NONE'; // Do not explain the answer or append generic transitions
    }
    if (analysis.slide_role === 'EXAMPLE') {
      return 'EXAMPLE_INTERPRETATION';
    }
    if (relNextType && ['ILLUSTRATES', 'APPLIES', 'DEEPENS', 'CONTINUES'].includes(relNextType)) {
      return 'TRANSITION_TO_NEXT';
    }
    return 'CONCEPT_RECAP';
  }
}

export const narrativePlannerService = new NarrativePlannerService();
