// src/pipeline/module3_generator/narrationGenerator.ts
/**
 * Module 3A: Context-Aware Narration Generator (template engine, zero-LLM)
 *
 * Turns a SectionPlan + extracted page content into spoken narration.
 * Principles:
 * 1. Vietnamese-first narration, English technical terms preserved
 * 2. Role-based generation (CORE_CONCEPT, PROCESS, EXAMPLE, SUMMARY, DECORATIVE...)
 * 3. Grounded only in page content: bullets, speaker notes, and OCR readings of tables/diagrams.
 *    No canned topic text and no generic filler sentences.
 * 4. Headings: the lesson title is spoken once (first scene), a chapter title once (its first page),
 *    a section title is not announced by the template at all
 * 5. Connectives are added only when the content licenses them (see discoursePolicy.ts)
 * 6. Calibrated to the word budget by adding more source content, never filler
 */

import {
  SectionPlan,
  UserConfiguration,
  SlideRole,
  ListStrategy,
  LessonModel,
  TeachingUnit,
  GlobalNarrativeContext
} from '../../types';
import { technicalTerminologyService } from '../services/technicalTerminologyService';
import { contentPurifierService } from '../services/contentPurifierService';

export interface NarrationContext {
  previousPlan?: SectionPlan;
  nextPlan?: SectionPlan;
  alreadyExplainedConcepts?: string[];
  lessonModel?: LessonModel;
  teachingUnit?: TeachingUnit;
  globalContext?: GlobalNarrativeContext;
  usedOpenings?: Set<string>;
  usedPhrases?: Set<string>;
  /** Chapter membership from the knowledge tree. */
  chapter?: { title: string; isFirstPage: boolean; isOnlyChapter?: boolean };
  /** Readings of tables/diagrams/charts on this page (OCR or native). */
  visualReadings?: { kind: string; text: string; summary?: string }[];
  /** Speaker notes on this page. */
  notes?: string[];
  lessonTitle?: string;
}

const resolve = (s: string) => technicalTerminologyService.resolveAndPreserveSentence(s).resolvedText;
const lowerFirst = (s: string) => (s && !/^[A-Z]{2,}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const endSentence = (s: string) => (/[.!?…:]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

export class NarrationGenerator {
  generateNarration(plan: SectionPlan, config: UserConfiguration, rawText?: string, context?: NarrationContext): string {
    const role: SlideRole = plan.slide_analysis?.slide_role || this.inferFallbackRole(plan);
    const targetWords = Math.max(15, plan.target_word_budget || 70);
    const narrationLang = config.narration_language || config.language_policy?.narration_language || config.language || 'vi';
    const isVietnamese = narrationLang !== 'en';

    const chapterIntro = this.chapterIntro(context, isVietnamese);

    // Decorative pages (title-only, agenda, thank-you) get no narration of their own.
    if (role === 'DECORATIVE' || (role !== 'INTRODUCTION' && role !== 'HOOK' && role !== 'THINK' && plan.slide_analysis?.requires_explanation === false)) {
      return chapterIntro;
    }

    // The page title is a heading, not content: never read it back as a body sentence.
    const titleKey = (plan.title || '').trim().toLowerCase().replace(/[.…:]+$/, '');
    const cleanRawText = this.cleanRaw(rawText || '', plan.slide_analysis?.excluded_content || [])
      .split('\n')
      .filter((line) => line.trim().toLowerCase().replace(/[.…:]+$/, '') !== titleKey)
      .join('\n');
    const bullets = this.extractBulletPoints(cleanRawText).map((b) => (isVietnamese ? resolve(b.replace(/\.+$/, '')) : b.replace(/\.+$/, '')));

    let script = isVietnamese
      ? this.generateVietnamese(plan, role, bullets, cleanRawText, context)
      : this.generateEnglish(plan, role, bullets, context);

    if (chapterIntro && !(plan.order === 1 && role === 'INTRODUCTION')) script = `${chapterIntro} ${script}`;

    if (isVietnamese) script = technicalTerminologyService.repairNarrationTargeted(script).repairedText;
    script = contentPurifierService.purifyNarration(script, { title: plan.title, role }).cleanedText;
    script = this.calibrateToWordBudget(script, targetWords, plan, role, context, isVietnamese);
    return script.trim();
  }

  private chapterIntro(context: NarrationContext | undefined, isVi: boolean): string {
    const ch = context?.chapter;
    if (!ch || !ch.isFirstPage || ch.isOnlyChapter || !ch.title) return '';
    const title = resolve(ch.title);
    if (context?.lessonTitle && title.toLowerCase() === context.lessonTitle.toLowerCase()) return '';
    return isVi ? `Chúng ta bắt đầu với ${title}.` : `Let's start with ${title}.`;
  }

  private cleanRaw(rawText: string, excluded: string[]): string {
    let text = rawText;
    excluded.forEach((tok) => {
      if (tok && tok.trim()) text = text.replace(new RegExp(tok.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    });
    return text
      .split('\n')
      .filter((line) => {
        const l = line.toLowerCase().trim();
        return l && !l.includes('all rights reserved') && !l.includes('copyright') && !/^ngày\s*\d+/i.test(l) && !/^\[note:/i.test(l);
      })
      .join('\n');
  }

  private inferFallbackRole(plan: SectionPlan): SlideRole {
    const title = (plan.title || '').toLowerCase();
    if (/(summary|conclusion|tổng kết|kết luận)/.test(title)) return 'SUMMARY';
    if (/(example|ví dụ|walkthrough|minh họa)/.test(title)) return 'EXAMPLE';
    if (/(application|ứng dụng|real-world)/.test(title)) return 'APPLICATION';
    if (/( vs |comparison|so sánh)/.test(title)) return 'COMPARISON';
    if (/(results|benchmark|evaluation|kết quả|đánh giá)/.test(title)) return 'EVIDENCE';
    if (/(mechanism|cơ chế|quy trình|process|pipeline)/.test(title)) return 'MECHANISM';
    if (/(suy nghĩ|puzzle|câu hỏi)/.test(title)) return plan.order > 1 ? 'THINK' : 'HOOK';
    if (plan.order === 1) return 'INTRODUCTION';
    return 'KEY_EXPLANATION';
  }

  private extractBulletPoints(rawText: string): string[] {
    const lines = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 3)
      .map((line) => line.replace(/^[•\-*\d.)]\s*/, ''))
      .filter((line) => !/^slide\s/i.test(line));
    return contentPurifierService.cleanBulletPoints(lines);
  }

  private generateVietnamese(plan: SectionPlan, role: SlideRole, bullets: string[], rawText: string, context?: NarrationContext): string {
    const parts: string[] = [];
    const listStrategy: ListStrategy = plan.narrative_plan?.list_strategy || plan.slide_analysis?.list_strategy || 'NONE';

    // Opening
    if (plan.order === 1 || role === 'INTRODUCTION') {
      const lesson = resolve(context?.lessonTitle || plan.title);
      parts.push(`Chào mừng các bạn đến với bài học về ${lesson}.`);
      // The generated goal sentence only fills in when the page itself has nothing to say.
      if (plan.instructional_goal && bullets.length === 0) {
        parts.push(`Mục tiêu của phần mở đầu là ${lowerFirst(resolve(plan.instructional_goal).replace(/\.+$/, ''))}.`);
      }
    } else if (role === 'HOOK' || role === 'THINK' || role === 'QUESTION') {
      const q = rawText.match(/[^.!?\n]{10,}\?/);
      if (q) parts.push(resolve(q[0].trim().replace(/^[•\-*\d.)]\s*/, '')));
    } else {
      const bridge = this.openingBridge(plan, role, context);
      if (bridge) parts.push(bridge);
    }

    // Body
    const body = this.body(role, bullets, listStrategy, plan);
    if (body) parts.push(body);

    // Visual readings (tables/diagrams/charts) are part of the page's content.
    for (const v of context?.visualReadings || []) {
      if (v.summary) parts.push(endSentence(resolve(v.summary)));
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Opening bridge from the previous page, only when the narrative plan says this page deepens it.
   * Uses the previous page's key concept, never its heading (headings are policed separately).
   */
  private openingBridge(plan: SectionPlan, role: SlideRole, context?: NarrationContext): string {
    const used = context?.usedOpenings || new Set<string>();
    const relation = plan.narrative_plan?.relationship_to_previous?.type;
    // Only real terms make a natural bridge ("Từ kernel, ta đi sâu hơn vào feature map"); arbitrary
    // weighted n-grams ("Introduction to Convolutional") read as machine text, so they are skipped.
    const dict = technicalTerminologyService.getTermDictionary();
    const isTerm = (c?: string) => Boolean(c && dict.has(c.toLowerCase()));
    const prevConcept = context?.previousPlan?.key_concepts?.find(isTerm);
    const curConcept = plan.key_concepts?.find(isTerm);

    let bridge = '';
    if (role === 'EXAMPLE') bridge = 'Hãy xem một ví dụ cụ thể.';
    else if (role === 'SUMMARY') bridge = 'Như vậy, hãy nhìn lại những điểm chính.';
    else if (relation === 'DEEPENS' && prevConcept && curConcept && prevConcept.toLowerCase() !== curConcept.toLowerCase()) {
      bridge = `Từ ${resolve(prevConcept)}, ta đi sâu hơn vào ${resolve(curConcept)}.`;
    } else if (relation === 'CONTRASTS' && prevConcept) {
      bridge = `Khác với ${resolve(prevConcept)}, cách tiếp cận ở đây đặt trọng tâm khác.`;
    } else if (context?.teachingUnit?.learning_need?.natural_question) {
      bridge = endSentence(resolve(context.teachingUnit.learning_need.natural_question.trim().replace(/\?*$/, '?')));
    }
    return bridge && !used.has(bridge.toLowerCase()) ? bridge : '';
  }

  private body(role: SlideRole, bullets: string[], listStrategy: ListStrategy, plan: SectionPlan): string {
    const sentences = contentPurifierService.cleanBulletPoints(bullets).map((b) => endSentence(b));
    if (sentences.length === 0) return plan.slide_analysis?.core_message ? endSentence(resolve(plan.slide_analysis.core_message)) : '';

    if (role === 'COMPARISON' && sentences.length >= 2) {
      return `${sentences[0]} Trong khi đó, ${lowerFirst(sentences[1])} ${sentences.slice(2).join(' ')}`.trim();
    }
    if (role === 'EXAMPLE') {
      return `Trong ví dụ này, ${lowerFirst(sentences[0])} ${sentences.slice(1).join(' ')}`.trim();
    }
    if (listStrategy === 'SEQUENTIAL_PROCESS' || role === 'PROCESS') {
      const steps = sentences.slice(0, 5);
      return steps.map((s, i) => (i === 0 ? `Đầu tiên, ${lowerFirst(s)}` : i === steps.length - 1 && steps.length > 2 ? `Cuối cùng, ${lowerFirst(s)}` : s)).join(' ');
    }
    return sentences.join(' ');
  }

  private generateEnglish(plan: SectionPlan, role: SlideRole, bullets: string[], context?: NarrationContext): string {
    const parts: string[] = [];
    if (plan.order === 1 || role === 'INTRODUCTION') parts.push(`Welcome to this lecture on ${context?.lessonTitle || plan.title}.`);
    if (role === 'EXAMPLE') parts.push("Let's look at a concrete example.");
    if (role === 'SUMMARY') parts.push("Let's recap the key points.");
    parts.push(...bullets.map(endSentence));
    for (const v of context?.visualReadings || []) if (v.summary) parts.push(endSentence(v.summary));
    if (parts.length === 0 && plan.slide_analysis?.core_message) parts.push(endSentence(plan.slide_analysis.core_message));
    return parts.join(' ');
  }

  /**
   * Trims to the budget at a sentence boundary; when short, adds more *source* content
   * (speaker notes, then raw visual text). Never inserts generic filler.
   */
  private calibrateToWordBudget(
    script: string,
    targetWords: number,
    plan: SectionPlan,
    role: SlideRole,
    context: NarrationContext | undefined,
    isVi: boolean
  ): string {
    const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

    if (words(script) > Math.round(targetWords * 1.15)) {
      const sentences = script.split(/(?<=[.!?])\s+/);
      const out: string[] = [];
      for (const s of sentences) {
        if (words(out.join(' ')) + words(s) > targetWords && out.length > 0) break;
        out.push(s);
      }
      return out.join(' ');
    }

    if (role === 'DECORATIVE' || plan.narrative_plan?.verbosity === 'minimal') return script;

    // Source-derived material only, in order of closeness to the page:
    // speaker notes -> read visuals -> this unit's talking points -> definitions of this page's concepts
    // (the last two come from the whole-lesson analysis of the same document).
    const extras: string[] = [];
    (context?.notes || []).forEach((n) => extras.push(...n.split(/(?<=[.!?])\s+/)));
    (context?.visualReadings || []).forEach((v) => {
      if (v.text) extras.push(isVi ? `${v.kind === 'table' ? 'Số liệu trong bảng gồm' : 'Các thành phần gồm'}: ${v.text.replace(/\n/g, '; ').slice(0, 280)}.` : v.text);
    });
    (context?.teachingUnit?.key_talking_points || []).forEach((p) => extras.push(p));
    const pageText = `${plan.title} ${(plan.key_concepts || []).join(' ')}`.toLowerCase();
    [...(context?.lessonModel?.core_concepts || []), ...(context?.lessonModel?.supporting_concepts || [])]
      .filter((c) => c.name && c.definition && pageText.includes(c.name.toLowerCase()))
      .forEach((c) => {
        const def = c.definition.replace(/\.+$/, '');
        if (def.toLowerCase().startsWith(c.name.toLowerCase())) extras.push(def);
        else extras.push(isVi ? `${c.name} là ${lowerFirst(def)}` : `${c.name}: ${def}`);
      });

    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const titleNorm = norm(plan.title || '');
    const hasVi = (s: string) => /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i.test(s);

    let result = script;
    for (const e of extras) {
      if (words(result) >= targetWords * 0.85) break;
      // Never read a heading back as content, and keep the lecture in one language.
      if (norm(e) === titleNorm || titleNorm.includes(norm(e))) continue;
      if (!isVi && hasVi(e)) continue;
      const clean = isVi ? resolve(e.trim()) : e.trim();
      if (clean && !result.toLowerCase().includes(clean.toLowerCase().slice(0, 40))) result = `${result} ${endSentence(clean)}`;
    }
    return result;
  }
}

export const narrationGenerator = new NarrationGenerator();
