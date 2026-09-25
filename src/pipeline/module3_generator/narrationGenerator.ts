// src/pipeline/module3_generator/narrationGenerator.ts
/**
 * Module 3A: Context-Aware Narration Generator (template engine, zero-LLM)
 *
 * Turns a SectionPlan + extracted page content into spoken narration.
 * Principles:
 * 1. Vietnamese-first narration, English technical terms preserved
 * 2. Page lines are composed by the universal template composer (templateComposer.ts): each line is
 *    read for its shape (definition, metric, step, fragment...), lines are grouped by indentation and
 *    headings, and each group gets a sentence frame whose use conditions are explicit
 * 3. Grounded only in page content: bullets, speaker notes, and OCR readings of tables/diagrams.
 *    No canned topic text and no generic filler sentences.
 * 4. Headings: the lesson title is spoken once (first scene), a chapter title once (its first page);
 *    a section title may only be the subject of one list sentence on its own page
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
  GlobalNarrativeContext,
  ContentElement
} from '../../types';
import { technicalTerminologyService } from '../services/technicalTerminologyService';
import { contentPurifierService } from '../services/contentPurifierService';
import { composePage, ComposedPage, SourceLine } from './templateComposer';

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
  /** The page's extracted elements (keeps bullet levels and element types for the composer). */
  elements?: ContentElement[];
}

const resolve = (s: string) => technicalTerminologyService.resolveAndPreserveSentence(s).resolvedText;
const lowerFirst = (s: string) => (s && !/^[A-Z]{2,}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const endSentence = (s: string) => (/[.!?…:]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const normKey = (s: string) => s.trim().toLowerCase().replace(/[.…:]+$/, '');
/** Term normalization can lower a sentence-initial word ("Stride" -> "stride"); restore the capital. */
const capitalizeSentences = (s: string) => s.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, p: string, c: string) => p + c.toUpperCase());

/** Element types whose text is not page body (headings, notes, or visuals read separately). */
const NON_BODY_TYPES = new Set(['title', 'note', 'table', 'diagram', 'image']);

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

    const listStrategy: ListStrategy = plan.narrative_plan?.list_strategy || plan.slide_analysis?.list_strategy || 'NONE';
    const composed = composePage(this.sourceLines(plan, rawText || '', context), context?.visualReadings || [], {
      lang: isVietnamese ? 'vi' : 'en',
      role,
      listStrategy,
      title: plan.title,
      sceneKey: plan.section_id,
      used: context?.usedPhrases,
      resolve: isVietnamese ? resolve : undefined
    });

    let script = this.frame(plan, role, composed, context, isVietnamese, targetWords);
    if (chapterIntro && !(plan.order === 1 && role === 'INTRODUCTION')) script = `${chapterIntro} ${script}`;

    if (isVietnamese) script = technicalTerminologyService.repairNarrationTargeted(script).repairedText;
    script = contentPurifierService.purifyNarration(script, { title: plan.title, role }).cleanedText;
    script = this.calibrateToWordBudget(script, targetWords, plan, role, context, isVietnamese, composed.extras);
    return capitalizeSentences(script.trim());
  }

  private chapterIntro(context: NarrationContext | undefined, isVi: boolean): string {
    const ch = context?.chapter;
    if (!ch || !ch.isFirstPage || ch.isOnlyChapter || !ch.title) return '';
    const title = resolve(ch.title);
    if (context?.lessonTitle && title.toLowerCase() === context.lessonTitle.toLowerCase()) return '';
    return isVi ? `Chúng ta bắt đầu với ${title}.` : `Let's start with ${title}.`;
  }

  /**
   * Page body lines for the composer: extracted elements when available (bullet levels, element types),
   * otherwise the raw text. Headings, notes, visuals, boilerplate and the page title are left out.
   */
  private sourceLines(plan: SectionPlan, rawText: string, context?: NarrationContext): SourceLine[] {
    const titleKey = normKey(plan.title || '');
    const excluded = (plan.slide_analysis?.excluded_content || []).filter((t) => t && t.trim());
    const fromElements = (context?.elements || [])
      .filter((e) => !NON_BODY_TYPES.has(e.type) && !e.region_id && e.text?.trim())
      .flatMap((e) =>
        e.text.split('\n').map((text) => ({
          // An in-slide heading heads the lines after it.
          text: e.type === 'heading' && !/:\s*$/.test(text) ? `${text}:` : text,
          level: e.level ?? 2,
          type: e.type
        }))
      );
    const raw: SourceLine[] = fromElements.length
      ? fromElements
      : rawText.split('\n').map((text) => ({ text, level: Math.floor((text.match(/^\s*/)?.[0].length || 0) / 2) }));

    const out: SourceLine[] = [];
    for (const line of raw) {
      let text = line.text;
      excluded.forEach((tok) => {
        text = text.replace(new RegExp(tok.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
      });
      const l = text.toLowerCase().trim();
      if (!l || l.includes('all rights reserved') || l.includes('copyright') || /^ngày\s*\d+/i.test(l) || /^\[note:/i.test(l) || /^slide\s\d/i.test(l)) continue;
      if (normKey(text) === titleKey) continue;
      if (line.type === 'code') {
        out.push({ ...line, text: text.trim() });
        continue;
      }
      const cleaned = contentPurifierService.cleanBulletPoints([text])[0];
      if (!cleaned) continue;
      // The purifier drops list markers and trailing colons that the composer needs.
      const numbered = text.match(/^\s*\d+[.)]\s+/)?.[0].trim() || '';
      const colon = /:\s*$/.test(text) && !/:\s*$/.test(cleaned) ? ':' : '';
      out.push({ ...line, text: `${numbered && !/^\d/.test(cleaned) ? `${numbered} ` : ''}${cleaned}${colon}` });
    }
    return out;
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

  /** Opening (by role) + composed body + visual descriptions. */
  private frame(plan: SectionPlan, role: SlideRole, composed: ComposedPage, context: NarrationContext | undefined, isVi: boolean, targetWords: number): string {
    const parts: string[] = [];
    let body = composed.body;
    const countWords = (xs: string[]) => xs.join(' ').split(/s+/).filter(Boolean).length;
    // Bridges are optional framing: they are only spoken if the page's own content leaves room for them.
    const roomForBridge = countWords([...body, ...composed.visuals]) < targetWords * 0.85;

    if (plan.order === 1 || role === 'INTRODUCTION') {
      const lesson = isVi ? resolve(context?.lessonTitle || plan.title) : context?.lessonTitle || plan.title;
      parts.push(isVi ? `Chào mừng các bạn đến với bài học về ${lesson}.` : `Welcome to this lecture on ${lesson}.`);
      // The generated goal sentence only fills in when the page itself has nothing to say.
      if (plan.instructional_goal && body.length === 0) {
        const goal = lowerFirst((isVi ? resolve(plan.instructional_goal) : plan.instructional_goal).replace(/\.+$/, ''));
        parts.push(isVi ? `Mục tiêu của phần mở đầu là ${goal}.` : `The goal of this part is to ${goal}.`);
      }
    } else if (role === 'HOOK' || role === 'THINK' || role === 'QUESTION') {
      // The page's own question leads the scene.
      const qi = body.findIndex((s) => s.endsWith('?'));
      if (qi > 0) body = [body[qi], ...body.slice(0, qi), ...body.slice(qi + 1)];
    } else if (roomForBridge) {
      const bridge = this.openingBridge(plan, role, context, isVi, body);
      if (bridge) parts.push(bridge);
    }

    parts.push(...body);
    parts.push(...composed.visuals);
    if (parts.length === 0 && plan.slide_analysis?.core_message) {
      parts.push(endSentence(isVi ? resolve(plan.slide_analysis.core_message) : plan.slide_analysis.core_message));
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Opening bridge from the previous page, only when the narrative plan says this page deepens it.
   * Uses the previous page's key concept, never its heading (headings are policed separately).
   */
  private openingBridge(plan: SectionPlan, role: SlideRole, context: NarrationContext | undefined, isVi: boolean, body: string[]): string {
    const used = context?.usedOpenings || new Set<string>();
    const relation = plan.narrative_plan?.relationship_to_previous?.type;
    // Only real terms make a natural bridge ("Từ kernel, ta đi sâu hơn vào feature map"); arbitrary
    // weighted n-grams ("Introduction to Convolutional") read as machine text, so they are skipped.
    const dict = technicalTerminologyService.getTermDictionary();
    const isTerm = (c?: string) => Boolean(c && dict.has(c.toLowerCase()));
    const prevConcept = context?.previousPlan?.key_concepts?.find(isTerm);
    const curConcept = plan.key_concepts?.find(isTerm);
    const bodyText = body.join(' ').toLowerCase();

    let bridge = '';
    if (role === 'EXAMPLE' && !/(ví dụ|example)/.test(bodyText)) bridge = isVi ? 'Hãy xem một ví dụ cụ thể.' : "Let's look at a concrete example.";
    else if (role === 'SUMMARY') bridge = isVi ? 'Như vậy, hãy nhìn lại những điểm chính.' : "Let's recap the key points.";
    else if (!isVi) bridge = '';
    else if (relation === 'DEEPENS' && prevConcept && curConcept && prevConcept.toLowerCase() !== curConcept.toLowerCase()) {
      bridge = `Từ ${resolve(prevConcept)}, ta đi sâu hơn vào ${resolve(curConcept)}.`;
    } else if (relation === 'CONTRASTS' && prevConcept) {
      bridge = `Khác với ${resolve(prevConcept)}, cách tiếp cận ở đây đặt trọng tâm khác.`;
    } else if (context?.teachingUnit?.learning_need?.natural_question) {
      bridge = endSentence(resolve(context.teachingUnit.learning_need.natural_question.trim().replace(/\?*$/, '?')));
    }
    return bridge && !used.has(bridge.toLowerCase()) ? bridge : '';
  }

  /**
   * Trims to the budget at a sentence boundary; when short, adds more *source* content
   * (speaker notes, then table rows / raw visual text). Never inserts generic filler.
   */
  private calibrateToWordBudget(
    script: string,
    targetWords: number,
    plan: SectionPlan,
    role: SlideRole,
    context: NarrationContext | undefined,
    isVi: boolean,
    visualExtras: string[] = []
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
    // speaker notes -> table rows / visual text -> this unit's talking points -> definitions of this
    // page's concepts (the last two come from the whole-lesson analysis of the same document).
    const extras: string[] = [];
    (context?.notes || []).forEach((n) => extras.push(...n.split(/(?<=[.!?])\s+/)));
    extras.push(...visualExtras);
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
    const hasVi = (s: string) => /[̀-ͯ]/.test(s.normalize('NFD')) || /đ/i.test(s);

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
