// src/pipeline/services/narrativeIntelligenceEngine.ts
/**
 * NARRATIVE INTELLIGENCE LAYER (NIL) ENGINE
 *
 * Plans narrative beats (curiosity, cognitive load, analogies, deictic visual pointers) and applies
 * them to draft narration SPARINGLY. Earlier versions wrapped every slide in the same lead marker,
 * question, analogy and "we now move to <next title>" bridge; that produced the overused connectives
 * and repeated headings users reported. Rules now:
 *  - curiosity questions come from the source (a question on the page), never a generic template,
 *    and are only voiced at a chapter start or on HOOK / INTRODUCTION / THINK scenes
 *  - a deictic pointer is voiced only when the page has a visual that was actually read (OCR/native)
 *  - each analogy is voiced at most once per lecture, and only when its concept is in the draft
 *  - no bridge-out sentences: transitions belong to the next scene's opening strategy
 */

import {
  CanonicalDocumentTree,
  LessonBlueprint,
  UserConfiguration,
  NarrativeIR,
  NarrativeBeat,
  EpistemicCuriosityGap,
  ListenerMentalState,
  AnalogyPoint,
  SpokenDiscourseBlueprint,
  ContentElement
} from '../../types';

export interface RevoiceContext {
  role?: string;
  isChapterStart?: boolean;
}

const QUESTION_ROLES = new Set(['HOOK', 'INTRODUCTION', 'THINK', 'QUESTION']);

class NarrativeIntelligenceEngine {
  private analogyCatalog: Record<string, AnalogyPoint & { cue: RegExp }> = {
    pose: {
      cue: /(pose|keypoint|khung xương)/i,
      source_domain: 'vẽ người que',
      target_concept: 'các keypoint của khung xương người',
      mapping_explanation: 'thay vì tô từng pixel, ta chỉ cần định vị đúng các khớp như khuỷu tay và đầu gối'
    },
    cnn: {
      cue: /(kernel|convolution|tích chập)/i,
      source_domain: 'rê một chiếc kính lúp qua bức tranh',
      target_concept: 'kernel trượt qua feature map',
      mapping_explanation: 'mỗi lần dừng lại, ta chỉ nhìn một vùng nhỏ và ghi lại đường nét ở đó'
    },
    matrix: {
      cue: /(ma trận|matrix|tensor)/i,
      source_domain: 'một bàn cờ chia ô',
      target_concept: 'ma trận số liệu',
      mapping_explanation: 'mỗi ô chứa một giá trị, ví dụ độ sáng của một điểm ảnh'
    }
  };

  generateNarrativeIR(
    docTree: CanonicalDocumentTree,
    blueprint: LessonBlueprint,
    config?: UserConfiguration
  ): NarrativeIR {
    const docMap = new Map(docTree.sections.map((s) => [s.section_id, s]));
    const beats: NarrativeBeat[] = [];
    let totalLoad = 0;
    let hooks = 0;

    blueprint.sections.forEach((plan, idx) => {
      const sec = docMap.get(plan.section_id);
      const elements = sec?.elements || [];
      const textEls = elements.filter((e) => e.type !== 'note' && e.type !== 'title');
      const allText = elements.map((e) => e.text).join(' ');

      const sourceQuestion = this.findSourceQuestion(elements);
      const gap: EpistemicCuriosityGap | undefined = sourceQuestion
        ? {
            hook_type: 'epistemic_conflict',
            prompt_question: sourceQuestion,
            known_anchor: '',
            unknown_frontier: '',
            intensity: 0.7,
            grounding_element_ids: textEls.slice(0, 2).map((e) => e.element_id)
          }
        : undefined;
      if (gap) hooks++;

      const readVisual = elements.find((e) => (e.type === 'diagram' || e.type === 'table' || e.type === 'image') && e.region_id && e.text);
      const conceptCount = textEls.length + (readVisual ? 1 : 0);
      const cogLoad = Math.min(0.9, 0.3 + conceptCount * 0.08);
      totalLoad += cogLoad;

      const mentalState: ListenerMentalState = {
        cognitive_load_score: Number(cogLoad.toFixed(2)),
        active_memory_items: Math.min(5, Math.max(2, conceptCount)),
        requires_digestive_pause: cogLoad > 0.65
      };

      const analogyKey = this.findAnalogyKey(`${plan.title} ${allText}`);
      const discourse: SpokenDiscourseBlueprint = {
        lead_marker: '',
        digestive_pause_sec: mentalState.requires_digestive_pause ? 1.2 : 0.8,
        conversational_questions: sourceQuestion ? [sourceQuestion] : [],
        deictic_visual_cues: readVisual
          ? [{ phrase: this.deicticPhrase(readVisual), target_id: readVisual.element_id }]
          : []
      };

      beats.push({
        beat_id: `beat_${String(idx + 1).padStart(2, '0')}_${plan.section_id}`,
        target_section_id: plan.section_id,
        timing_target_sec: plan.target_duration_sec,
        curiosity_gap: gap,
        cognitive_goal: mentalState,
        analogy: analogyKey ? this.stripCue(this.analogyCatalog[analogyKey]) : undefined,
        spoken_discourse: discourse,
        grounding_refs: elements.map((e) => e.element_id)
      });
    });

    return {
      lecture_narrative_id: `narr_${docTree.title.replace(/\s+/g, '_').toLowerCase()}`,
      source_document_id: docTree.source_filename,
      persona_archetype: 'insightful_mentor',
      overall_story_arc: 'problem_mystery_deconstruction_mastery',
      narrative_beats: beats,
      average_cognitive_load: Number((totalLoad / Math.max(1, beats.length)).toFixed(2)),
      total_curiosity_hooks: hooks,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Applies the beat to a draft under the rules in the file header. Never adds transitions.
   */
  revoiceDraft(draftText: string, beat: NarrativeBeat | undefined, isVietnamese: boolean, ctx: RevoiceContext): string {
    if (!draftText || !beat) return draftText;
    let text = draftText.trim();
    const role = (ctx.role || '').toUpperCase();

    // 1. Source question, only where a question belongs and the draft doesn't already ask one.
    const q = beat.curiosity_gap?.prompt_question;
    if (q && (ctx.isChapterStart || QUESTION_ROLES.has(role)) && !text.includes('?')) {
      text = `${q.replace(/\?*$/, '?')} ${text}`;
    }

    // 2. Deictic pointer, only for a visual that was read, and only if the draft doesn't point already.
    const cue = beat.spoken_discourse?.deictic_visual_cues?.[0];
    if (cue && isVietnamese && !/(sơ đồ|bảng|biểu đồ|hình|minh họa)/i.test(text)) {
      const sentences = text.split(/(?<=[.!?])\s+/);
      sentences.splice(Math.min(1, sentences.length), 0, `${cue.phrase}.`);
      text = sentences.join(' ');
    }

    // No analogy is spoken here: the catalog analogies are not in the user's document, so saying them
    // would present invented content as the lecture. beat.analogy stays in the Narrative IR as a hint.
    return text;
  }

  private findSourceQuestion(elements: ContentElement[]): string | null {
    for (const el of elements) {
      if (el.type === 'note') continue;
      const m = el.text.match(/[^.!?\n]{12,160}\?/);
      if (m) return m[0].trim().replace(/^[•\-*\d.)\s]+/, '');
    }
    return null;
  }

  private deicticPhrase(el: ContentElement): string {
    if (el.type === 'table') return el.subtype === 'chart' ? 'Hãy nhìn vào biểu đồ trên màn hình' : 'Hãy nhìn vào bảng trên màn hình';
    if (el.type === 'diagram') return 'Hãy quan sát sơ đồ trên màn hình';
    return 'Hãy quan sát hình minh họa';
  }

  private findAnalogyKey(text: string): string | undefined {
    return Object.keys(this.analogyCatalog).find((k) => this.analogyCatalog[k].cue.test(text));
  }

  private stripCue(a: AnalogyPoint & { cue: RegExp }): AnalogyPoint {
    const { cue, ...rest } = a;
    void cue;
    return rest;
  }
}

export const narrativeIntelligenceEngine = new NarrativeIntelligenceEngine();
