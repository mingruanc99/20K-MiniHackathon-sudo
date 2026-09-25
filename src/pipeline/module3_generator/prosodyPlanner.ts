// src/pipeline/module3_generator/prosodyPlanner.ts
/**
 * Module 3B: Prosody & Pause Planner
 * Pre-TTS Instructional Intent Layer.
 * Injects physiologically and pedagogically calibrated pauses:
 * - syntactic (150-250ms)
 * - emphasis (300-450ms)
 * - concept_boundary (500-700ms)
 * - section_transition (800-1200ms)
 * Generates valid W3C SSML for commercial TTS engines.
 */
import {
  SectionPlan,
  UserConfiguration,
  ProsodyPlan,
  NarrationSentence,
  WordPause,
  PauseType
} from '../../types';
import { technicalTerminologyService } from '../services/technicalTerminologyService';

const escapeXml = (w: string) => w.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class ProsodyPlanner {
  private technicalKeywords = new Set([
    'convolution',
    'kernel',
    'filter',
    'stride',
    'padding',
    'pooling',
    'max',
    'activation',
    'relu',
    'flattening',
    'spatial',
    'locality',
    'invariance',
    'parameters',
    'tensor',
    'gradient',
    'matrix',
    'dense'
  ]);

  planProsody(
    narrationText: string,
    plan: SectionPlan,
    config: UserConfiguration
  ): ProsodyPlan {
    const rawSentences = this.splitSentences(narrationText);
    // Emphasis targets: single-word dictionary terms + this page's weighted key concepts.
    const emphasisTerms = new Set<string>(this.technicalKeywords);
    technicalTerminologyService.getTermDictionary().forEach((_, key) => {
      if (!key.includes(' ') && key.length > 2) emphasisTerms.add(key);
    });
    (plan.key_concepts || []).forEach((k) => {
      if (!k.includes(' ')) emphasisTerms.add(k.toLowerCase());
    });
    const wpm = config.targetWpm || 140;

    const sentences: NarrationSentence[] = [];
    let totalWords = 0;
    let totalSpeakingSec = 0;
    let totalPauseMs = 0;
    const ssmlSentences: string[] = [];

    rawSentences.forEach((sText, sIdx) => {
      const isLast = sIdx === rawSentences.length - 1;
      const words = sText.split(/\s+/);
      const sWordCount = words.length;
      totalWords += sWordCount;

      const rate = plan.pedagogical_function === 'mechanism' ? 'slow' : 'medium';
      const energy = plan.pedagogical_function === 'hook' ? 'medium' : 'medium';
      const rateFactor = rate === 'slow' ? 1.15 : 1.0;

      const speakingSec = (sWordCount / (wpm / 60)) * rateFactor;

      // Plan intra-sentence and post-sentence pauses
      const { pauses, ssmlBody, postPauseMs, postPauseType, emphasisList } = this.planPausesForSentence(
        sText,
        words,
        isLast,
        emphasisTerms
      );

      const sPauseMs = pauses.reduce((sum, p) => sum + p.duration_ms, 0) + postPauseMs;
      totalPauseMs += sPauseMs;
      totalSpeakingSec += speakingSec;

      const sId = `${plan.section_id}_${String(sIdx + 1).padStart(2, '0')}`;
      sentences.push({
        id: sId,
        text: sText,
        prosody: {
          pause_after_ms: postPauseMs,
          pause_type: postPauseType,
          rate,
          energy,
          emphasis: emphasisList
        },
        word_pauses: pauses,
        estimated_speaking_time_sec: Math.round(speakingSec * 10) / 10
      });

      ssmlSentences.push(
        `<prosody rate="${rate}">${ssmlBody}<break time="${postPauseMs}ms"/></prosody>`
      );
    });

    const totalPauseSec = totalPauseMs / 1000;
    const effectiveSec = totalSpeakingSec + totalPauseSec;

    const fullSsml =
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${config.language || 'en'}">\n` +
      ssmlSentences.map((s) => `  ${s}`).join('\n') +
      '\n</speak>';

    return {
      section_id: plan.section_id,
      sentences,
      total_words: totalWords,
      total_speaking_sec: Math.round(totalSpeakingSec * 10) / 10,
      total_pause_sec: Math.round(totalPauseSec * 10) / 10,
      effective_scene_duration_sec: Math.round(effectiveSec * 10) / 10,
      ssml_full: fullSsml
    };
  }

  private splitSentences(text: string): string[] {
    const parts = text.split(/(?<=[.!?])\s+/);
    return parts.map((p) => p.trim()).filter(Boolean);
  }

  private planPausesForSentence(
    text: string,
    words: string[],
    isLastSentence: boolean,
    emphasisTerms: Set<string> = this.technicalKeywords
  ) {
    let lastEmphasisIdx = -10;
    const pauses: WordPause[] = [];
    const ssmlTokens: string[] = [];
    const emphasisList: string[] = [];

    words.forEach((w, idx) => {
      const clean = w.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '');

      // Emphasis pause before a technical term (at most one every 6 words so speech doesn't stutter)
      if (emphasisTerms.has(clean) && idx > 0 && idx - lastEmphasisIdx >= 6) {
        lastEmphasisIdx = idx;
        emphasisList.push(w);
        pauses.push({
          pause_id: `p_emp_${idx}`,
          pause_type: 'emphasis',
          after_word: words[idx - 1],
          word_index: idx - 1,
          duration_ms: 380,
          justification: `Nhấn giọng và ngắt nhẹ trước thuật ngữ kỹ thuật trọng tâm "${w}"`
        });
        ssmlTokens.push('<break time="380ms"/>');
      }

      ssmlTokens.push(escapeXml(w));

      // Check syntactic micro-pause after clause boundary (comma, semicolon)
      if (w.endsWith(',') || w.endsWith(';') || w.endsWith(':')) {
        pauses.push({
          pause_id: `p_syn_${idx}`,
          pause_type: 'syntactic',
          after_word: w,
          word_index: idx,
          duration_ms: 220,
          justification: 'Ngắt nhịp cú pháp tại ranh giới mệnh đề nhằm giảm tải nhận thức'
        });
        ssmlTokens.push('<break time="220ms"/>');
      }
    });

    // Terminal pause: concept_boundary (600ms per Section 26 specification)
    let postPauseMs = 600;
    let postPauseType: PauseType = 'concept_boundary';

    if (isLastSentence && (text.toLowerCase().includes('tổng kết') || text.toLowerCase().includes('in summary') || text.toLowerCase().includes('kết luận'))) {
      postPauseMs = 1000;
      postPauseType = 'section_transition';
    }

    return {
      pauses,
      ssmlBody: ssmlTokens.join(' '),
      postPauseMs,
      postPauseType,
      emphasisList
    };
  }
}
