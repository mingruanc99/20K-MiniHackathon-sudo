// src/pipeline/module4_guard/qualityGuard.ts
/**
 * Module 4: Quality & Visual Guard
 *
 * Repairs what can be repaired without inventing content, then MEASURES the final lecture.
 * Every score below is computed from the final scenes; there are no score floors and no
 * hard-coded PASSED statuses.
 *
 * Repairs (content-preserving):
 *  - terminology normalization, metadata/label/filler purification, slide-reading openers,
 *    unnecessary enumeration, exact & near-duplicate sentences across scenes
 *  - over-long INTRODUCTION/HOOK scenes are trimmed at a sentence boundary
 *  - after text repairs, prosody is re-planned so durations match the final words
 *  - DAR-P repair only rescales planned pauses inside their physiological ranges
 *    (speaking time is never scaled, so the duration estimate stays tied to the word count)
 *
 * Metric formulas (documented in docs/specs/EVALUATION.md):
 *  DAR-P            = |T_est − T_target| / T_target,  T_est = Σ words/(WPM/60) × rate + Σ pauses
 *  VTC              = valid-taxonomy cues / all cues
 *  CNS              = justified cues / all cues
 *  Grounding        = narration content tokens found in the source / narration content tokens
 *  Language         = sentences passing the terminology policy / sentences
 *  Anti-repetition  = 1 − near-duplicate sentence pairs remaining / sentences
 *  Connective use   = 1 − max(0, density − 0.25) / 0.25   (density = sentence-initial connectives / sentences)
 *  Heading policy   = 1 − repeated heading mentions / max(1, heading mentions)
 *  Prosody validity = pauses within their type's range / pauses
 */
import {
  CLSGScene,
  LessonBlueprint,
  UserConfiguration,
  CanonicalDocumentTree,
  QualityReport,
  ValidationCheck,
  VerifiedCLSG_IR,
  SectionPlan,
  PauseType,
  QualityStatus
} from '../../types';
import { VisualIntentGenerator } from '../module3_generator/visualIntentGenerator';
import { ProsodyPlanner } from '../module3_generator/prosodyPlanner';
import { technicalTerminologyService } from '../services/technicalTerminologyService';
import { contentPurifierService } from '../services/contentPurifierService';
import { applyConnectivePolicy, countLeadingConnectives, countHeadingMentions, HeadingSpec, splitSentences } from '../services/discoursePolicy';
import { tokenize } from '../services/keywordExtractor';

export const PAUSE_RANGES_MS: Record<PauseType, [number, number]> = {
  syntactic: [150, 250],
  emphasis: [300, 450],
  concept_boundary: [500, 700],
  section_transition: [800, 1200],
  semantic: [300, 700],
  example_transition: [500, 900],
  natural: [150, 700]
};

export interface GuardExtras {
  headingSpecs?: HeadingSpec[];
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const statusFor = (score: number, pass: number, warn: number): QualityStatus => (score >= pass ? 'PASSED' : score >= warn ? 'WARNING' : 'FAILED');

function jaccard(a: string, b: string): number {
  const A = new Set(a.split(' '));
  const B = new Set(b.split(' '));
  let inter = 0;
  A.forEach((x) => B.has(x) && inter++);
  return inter / (A.size + B.size - inter || 1);
}

const normSentence = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

export class QualityVisualGuard {
  private allowedTaxonomies = new Set(VisualIntentGenerator.ALLOWED_TAXONOMIES);
  private prosodyPlanner = new ProsodyPlanner();
  private visualGen = new VisualIntentGenerator();

  validateAndCertify(
    scenes: CLSGScene[],
    blueprint: LessonBlueprint,
    docTree: CanonicalDocumentTree,
    config: UserConfiguration,
    extras: GuardExtras = {}
  ): { qualityReport: QualityReport; verifiedIr: VerifiedCLSG_IR } {
    const checks: ValidationCheck[] = [];
    const autoRepairs: string[] = [];
    const planById = new Map(blueprint.sections.map((p) => [p.section_id, p]));
    const isEn = (config.narration_language || config.language) === 'en';

    // ------------------------------------------------------------------
    // A. Text repairs
    // ------------------------------------------------------------------
    const seenSentences: { norm: string; scene: string }[] = [];
    let duplicatesRemoved = 0;
    let terminologyRepairs = 0;
    const rawTexts = scenes.map((scene) => {
      const plan = planById.get(scene.section_id);
      const role = plan?.slide_analysis?.slide_role || scene.slide_analysis?.slide_role || 'KEY_EXPLANATION';
      let text = scene.narration.text;

      // Terminology normalization targets Vietnamese narration (it rewrites stray English words).
      const resolved = isEn ? text : technicalTerminologyService.resolveAndPreserveSentence(text).resolvedText;
      if (resolved !== text) {
        terminologyRepairs++;
        text = resolved;
      }

      const purification = contentPurifierService.purifyNarration(text, { title: plan?.title, role });
      if (purification.removedElements.length) {
        autoRepairs.push(`${scene.section_id}: METADATA_LEAK — loại bỏ ${purification.removedElements.join(', ')}.`);
        text = purification.cleanedText;
      }

      for (const tok of plan?.slide_analysis?.excluded_content || []) {
        if (tok && tok.length > 2 && text.toLowerCase().includes(tok.toLowerCase())) {
          text = text.replace(new RegExp(`[,·•\\-\\s]*${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[,·•\\-\\s]*`, 'gi'), ' ');
          autoRepairs.push(`${scene.section_id}: METADATA_LEAK — loại bỏ nội dung bị đánh dấu nhiễu "${tok.slice(0, 40)}".`);
        }
      }
      // Removing noise can leave dangling fragments ("Đồng thời, ."): drop empty sentences.
      text = splitSentences(text)
        .filter((s) => /[\p{L}\p{N}]{2,}/u.test(s.replace(/^(đồng thời|ngoài ra|tuy nhiên|vì vậy)[,:]?\s*/i, '')))
        .join(' ');

      const slideReading = /^(slide này (có tiêu đề|trình bày|cho thấy)|ở slide này|như chúng ta có thể thấy trên slide)[,:]?\s*/i;
      if (slideReading.test(text)) {
        text = text.replace(slideReading, '');
        autoRepairs.push(`${scene.section_id}: bỏ câu mở kiểu đọc slide.`);
      }

      const listStrat = plan?.narrative_plan?.list_strategy || 'NONE';
      if (listStrat === 'NONE' && /\bthứ\s+(nhất|hai|ba|bốn|năm|sáu|\d+)[,:]?\s*/i.test(text)) {
        text = text.replace(/\bthứ\s+(nhất|hai|ba|bốn|năm|sáu|\d+)[,:]?\s*/gi, '');
        autoRepairs.push(`${scene.section_id}: bỏ đánh số không cần thiết.`);
      }

      let sentences = splitSentences(text);
      if ((role === 'INTRODUCTION' || role === 'HOOK') && text.split(/\s+/).length > 45 && sentences.length > 2) {
        sentences = sentences.slice(0, 2);
        autoRepairs.push(`${scene.section_id}: rút gọn phần ${role === 'HOOK' ? 'gợi mở' : 'mở đầu'} quá dài.`);
      }

      const kept: string[] = [];
      for (const s of sentences) {
        const norm = normSentence(s);
        if (norm.length >= 15) {
          const dup = seenSentences.find((p) => p.norm === norm || jaccard(p.norm, norm) > 0.7);
          if (dup) {
            duplicatesRemoved++;
            autoRepairs.push(`${scene.section_id}: bỏ câu trùng với ${dup.scene}.`);
            continue;
          }
          seenSentences.push({ norm, scene: scene.section_id });
        }
        kept.push(s);
      }
      return kept.join(' ').replace(/\s+/g, ' ').trim();
    });
    if (terminologyRepairs) autoRepairs.push(`Chuẩn hoá thuật ngữ ở ${terminologyRepairs} cảnh.`);

    // Connective policy is also enforced here, so scenes that did not come through the
    // orchestrator (edited scripts, tests, legacy IRs) get the same rules. It is idempotent.
    const connectiveRepair = applyConnectivePolicy(
      rawTexts.map((text, i) => {
        const plan = planById.get(scenes[i].section_id);
        const role = plan?.slide_analysis?.slide_role || scenes[i].slide_analysis?.slide_role;
        return {
          text,
          ctx: {
            sceneId: scenes[i].section_id,
            role,
            isSequential: role === 'PROCESS' || plan?.narrative_plan?.list_strategy === 'SEQUENTIAL_PROCESS',
            isChapterLastScene: i === scenes.length - 1
          }
        };
      }),
      isEn ? 'en' : 'vi'
    );
    if (connectiveRepair.stats.removed.length) {
      autoRepairs.push(`CONNECTIVE_OVERUSE — bỏ ${connectiveRepair.stats.removed.length} từ nối không có quan hệ logic tương ứng.`);
    }
    const texts = connectiveRepair.texts;

    // ------------------------------------------------------------------
    // B. Re-plan prosody from the final text (durations must match the words)
    // ------------------------------------------------------------------
    let workingScenes: CLSGScene[] = scenes.map((scene, i) => {
      const text = texts[i];
      if (text === scene.narration.text) return scene;
      const plan = planById.get(scene.section_id) || this.planFromScene(scene);
      const prosody = this.prosodyPlanner.planProsody(text, plan, config);
      return {
        ...scene,
        narration: { text, word_count: prosody.total_words, sentences: prosody.sentences },
        prosody_plan: prosody,
        visual_cues: this.visualGen.generateVisualCues(plan, prosody, config),
        scene_end_time_sec: prosody.effective_scene_duration_sec,
        scene_duration_sec: prosody.effective_scene_duration_sec
      };
    });

    // ------------------------------------------------------------------
    // C. DAR-P (+ pause-only repair)
    // ------------------------------------------------------------------
    const targetDuration = blueprint.total_target_duration_sec;
    const sumDur = (list: CLSGScene[]) => list.reduce((s, sc) => s + sc.scene_duration_sec, 0);
    const preRepairDuration = sumDur(workingScenes);
    const preRepairErrorPct = (Math.abs(preRepairDuration - targetDuration) / targetDuration) * 100;

    if (preRepairErrorPct > 5) {
      workingScenes = this.rescalePauses(workingScenes, targetDuration);
      const after = sumDur(workingScenes);
      autoRepairs.push(
        `Điều chỉnh khoảng nghỉ trong ngưỡng cho phép: ${preRepairDuration.toFixed(1)}s → ${after.toFixed(1)}s (mục tiêu ${targetDuration}s).`
      );
    }
    const actualDuration = sumDur(workingScenes);
    const durationErrorRatio = Math.abs(actualDuration - targetDuration) / targetDuration;
    const durationErrorPct = Math.round(durationErrorRatio * 1000) / 10;
    const darScore = Math.max(0, 1 - durationErrorRatio);
    const darStatus: QualityStatus = durationErrorPct <= 15 ? 'PASSED' : durationErrorPct <= 25 ? 'WARNING' : 'FAILED';
    checks.push({
      check_id: 'chk_dar_p',
      rule_name: 'Duration Adherence Rate with Prosody (DAR-P)',
      category: 'temporal_dar_p',
      status: darStatus,
      score: round2(darScore),
      threshold: 0.85,
      actual_value: `${actualDuration.toFixed(1)}s vs mục tiêu ${targetDuration}s (lệch ${durationErrorPct}%; trước sửa ${preRepairErrorPct.toFixed(1)}%)`,
      message: darStatus === 'PASSED' ? `Lệch ${durationErrorPct}% ≤ 15%.` : `Lệch ${durationErrorPct}% so với mục tiêu: nội dung quá ${actualDuration > targetDuration ? 'dài' : 'ngắn'} so với thời lượng.`,
      auto_repaired: preRepairErrorPct > 5
    });

    // ------------------------------------------------------------------
    // D. Visual checks
    // ------------------------------------------------------------------
    const allCues = workingScenes.flatMap((s) => s.visual_cues);
    const invalidCues = allCues.filter((c) => !this.allowedTaxonomies.has(c.visual_type));
    const taxScore = allCues.length === 0 ? 1 : (allCues.length - invalidCues.length) / allCues.length;
    checks.push({
      check_id: 'chk_taxonomy_validity',
      rule_name: 'Visual Taxonomy Conformance (VTC)',
      category: 'visual_coherence',
      status: invalidCues.length === 0 ? 'PASSED' : 'FAILED',
      score: round2(taxScore),
      threshold: 1.0,
      actual_value: `${allCues.length - invalidCues.length}/${allCues.length} hợp lệ`,
      message: invalidCues.length === 0 ? 'Mọi visual cue thuộc 13 loại chuẩn.' : `${invalidCues.length} cue ngoài danh mục.`
    });

    const unjustified = allCues.filter((c) => !c.visual_need || !c.visual_purpose || (c.learning_support || '').length < 15);
    const necessityScore = allCues.length === 0 ? 1 : (allCues.length - unjustified.length) / allCues.length;
    checks.push({
      check_id: 'chk_visual_necessity',
      rule_name: 'Cue Necessity Score (CNS)',
      category: 'visual_coherence',
      status: statusFor(necessityScore, 0.85, 0.7),
      score: round2(necessityScore),
      threshold: 0.85,
      actual_value: `${allCues.length - unjustified.length}/${allCues.length} cue có lý do sư phạm`,
      message: 'Tỉ lệ visual cue nêu rõ mục đích và hỗ trợ học tập.'
    });

    // ------------------------------------------------------------------
    // E. Grounding
    // ------------------------------------------------------------------
    const sourceTokens = new Set(docTree.sections.flatMap((s) => tokenize(s.raw_text || s.elements.map((e) => e.text).join(' '))));
    let grounded = 0;
    let sampled = 0;
    workingScenes.forEach((s) =>
      tokenize(s.narration.text)
        .filter((w) => w.length > 4)
        .forEach((w) => {
          sampled++;
          if (sourceTokens.has(w)) grounded++;
        })
    );
    const factualScore = sampled === 0 ? 0 : grounded / sampled;
    checks.push({
      check_id: 'chk_factual_grounding',
      rule_name: 'Grounding: từ nội dung có trong tài liệu nguồn',
      category: 'factual_consistency',
      status: statusFor(factualScore, 0.6, 0.4),
      score: round2(factualScore),
      threshold: 0.6,
      actual_value: `${grounded}/${sampled} token (${Math.round(factualScore * 100)}%)`,
      message: 'Tỉ lệ từ nội dung (>4 ký tự) trong lời giảng xuất hiện trong tài liệu gốc. Đây là chỉ số xấp xỉ, không thay cho kiểm tra sự thật.'
    });

    // ------------------------------------------------------------------
    // F. Language & terminology
    // ------------------------------------------------------------------
    let totalSentences = 0;
    let validSentences = 0;
    const languageTraces: string[] = [];
    if (!isEn) {
      workingScenes.forEach((s) => {
        const rep = technicalTerminologyService.validateNarration(s.narration.text);
        totalSentences += rep.totalSentences;
        validSentences += rep.validSentences;
        languageTraces.push(...rep.decisionTraces);
      });
    }
    const langScore = totalSentences === 0 ? 1 : validSentences / totalSentences;
    checks.push({
      check_id: 'chk_language_terminology',
      rule_name: 'Chính sách ngôn ngữ: tiếng Việt + thuật ngữ tiếng Anh chuẩn',
      category: 'language_terminology',
      status: statusFor(langScore, 0.85, 0.7),
      score: round2(langScore),
      threshold: 0.85,
      actual_value: isEn ? 'Không áp dụng (lời giảng tiếng Anh)' : `${validSentences}/${totalSentences} câu đạt`,
      message: 'Câu tiếng Việt tự nhiên, giữ thuật ngữ kỹ thuật tiếng Anh, không chêm từ tiếng Anh thừa.',
      auto_repaired: terminologyRepairs > 0
    });

    // ------------------------------------------------------------------
    // G. Narrative: repetition, connectives, headings, purification
    // ------------------------------------------------------------------
    const finalSentences = workingScenes.flatMap((s) => splitSentences(s.narration.text));
    const normed = finalSentences.map(normSentence).filter((n) => n.length >= 15);
    let dupPairs = 0;
    for (let i = 0; i < normed.length; i++) for (let j = i + 1; j < normed.length; j++) if (jaccard(normed[i], normed[j]) > 0.7) dupPairs++;
    const repetitionScore = Math.max(0, 1 - dupPairs / Math.max(1, finalSentences.length));
    checks.push({
      check_id: 'chk_anti_repetition_flow',
      rule_name: 'Chống lặp câu giữa các cảnh',
      category: 'narrative_coherence',
      status: statusFor(repetitionScore, 0.95, 0.85),
      score: round2(repetitionScore),
      threshold: 0.95,
      actual_value: `${dupPairs} cặp câu gần trùng còn lại • đã bỏ ${duplicatesRemoved} câu`,
      message: 'Đo trên lời giảng cuối cùng (Jaccard > 0.7 tính là trùng).',
      auto_repaired: duplicatesRemoved > 0
    });

    const conn = countLeadingConnectives(workingScenes.map((s) => s.narration.text).join(' '), isEn ? 'en' : 'vi');
    const density = conn.sentences === 0 ? 0 : conn.connectives / conn.sentences;
    const connectiveScore = Math.max(0, 1 - Math.max(0, density - 0.25) / 0.25);
    const topConnectives = Object.entries(conn.byPhrase).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, n]) => `${p}×${n}`).join(', ');
    checks.push({
      check_id: 'chk_connective_density',
      rule_name: 'Mật độ từ nối đầu câu',
      category: 'narrative_coherence',
      status: statusFor(connectiveScore, 1, 0.6),
      score: round2(connectiveScore),
      threshold: 1,
      actual_value: `${conn.connectives}/${conn.sentences} câu (${Math.round(density * 100)}%)${topConnectives ? ` • ${topConnectives}` : ''}`,
      message: 'Tối đa 25% số câu được mở đầu bằng từ nối.'
    });

    let headingScore = 1;
    if (extras.headingSpecs?.length) {
      const hm = countHeadingMentions(workingScenes.map((s) => s.narration.text), extras.headingSpecs);
      headingScore = Math.max(0, 1 - hm.repeated / Math.max(1, hm.mentions));
      checks.push({
        check_id: 'chk_heading_repetition',
        rule_name: 'Lặp đầu đề chương/mục',
        category: 'narrative_coherence',
        status: hm.repeated === 0 ? 'PASSED' : statusFor(headingScore, 0.9, 0.7),
        score: round2(headingScore),
        threshold: 1,
        actual_value: `${hm.mentions} lần nhắc tiêu đề • ${hm.repeated} lần lặp`,
        message: 'Mỗi tiêu đề mục được nói tối đa 1 lần, tiêu đề chương chỉ ở trang đầu chương.'
      });
    }

    const purificationFailures = workingScenes.filter((s) => s.narration.text && !contentPurifierService.validateNarration(s.narration.text).isValid).length;
    const purificationScore = workingScenes.length === 0 ? 1 : 1 - purificationFailures / workingScenes.length;
    checks.push({
      check_id: 'chk_content_purification',
      rule_name: 'Không rò rỉ metadata / nhãn nội bộ',
      category: 'narrative_coherence',
      status: purificationFailures === 0 ? 'PASSED' : statusFor(purificationScore, 0.95, 0.8),
      score: round2(purificationScore),
      threshold: 0.95,
      actual_value: `${purificationFailures}/${workingScenes.length} cảnh còn vi phạm`,
      message: 'Lời giảng không chứa nhãn phân cảnh, số trang, mã môn học, ghi chú giảng viên hay câu đệm.'
    });

    const glyphLeaks = workingScenes.filter((s) => /[■□▪▫▬▭▮▯▲▼▶◄►◆◇●○◉◘◙⦿★☆✦✧✨■-◿-�]|\b\d+\s*\^[-–—~]\s*\d+\b/.test(s.narration.text)).length;
    checks.push({
      check_id: 'chk_unicode_glyph_integrity',
      rule_name: 'Không còn glyph lỗi',
      category: 'narrative_coherence',
      status: glyphLeaks === 0 ? 'PASSED' : 'FAILED',
      score: glyphLeaks === 0 ? 1 : round2(1 - glyphLeaks / Math.max(1, workingScenes.length)),
      threshold: 1,
      actual_value: `${glyphLeaks} cảnh có glyph lỗi`,
      message: 'Không có ký tự ô vuông, PUA/Wingdings hay khoảng số lỗi (1^-4).'
    });

    const narrativeScore = (repetitionScore + connectiveScore + headingScore + purificationScore) / 4;

    // ------------------------------------------------------------------
    // H. Prosody validity
    // ------------------------------------------------------------------
    let pauses = 0;
    let validPauses = 0;
    workingScenes.forEach((s) =>
      s.prosody_plan.sentences.forEach((sent) => {
        const all = [
          ...(sent.word_pauses || []).map((p) => ({ type: p.pause_type, ms: p.duration_ms })),
          { type: sent.prosody.pause_type, ms: sent.prosody.pause_after_ms }
        ];
        all.forEach((p) => {
          pauses++;
          const [lo, hi] = PAUSE_RANGES_MS[p.type] || [0, Infinity];
          if (p.ms >= lo && p.ms <= hi) validPauses++;
        });
      })
    );
    const prosodyScore = pauses === 0 ? 1 : validPauses / pauses;

    // ------------------------------------------------------------------
    // I. Dimensions, decision, report
    // ------------------------------------------------------------------
    const contentDim = round2(factualScore);
    const pedagogyDim = round2((necessityScore + langScore) / 2);
    const narrativeDim = round2(narrativeScore);
    const visualDim = round2((taxScore + necessityScore) / 2);
    const technicalDim = round2((darScore + prosodyScore) / 2);
    const overallDim = round2(contentDim * 0.25 + pedagogyDim * 0.2 + narrativeDim * 0.2 + visualDim * 0.2 + technicalDim * 0.15);

    const detectedIssues: import('../../types').QualityIssue[] = checks
      .filter((c) => c.status !== 'PASSED')
      .map((c) => ({
        issue_id: `iss_${c.check_id}_${Date.now().toString(36)}`,
        category: c.category.includes('visual') ? 'visual' : c.category.includes('factual') ? 'content' : c.category.includes('temporal') ? 'technical' : 'narrative',
        issue_type: c.check_id,
        severity: c.status === 'FAILED' ? 'high' : 'medium',
        description: `${c.rule_name}: ${c.actual_value}`,
        repair_suggestion: c.auto_repaired ? 'Đã tự sửa một phần; xem lại thủ công.' : 'Cần chỉnh thủ công (Human Review).'
      }));

    let decision: import('../../types').QualityDecisionState = 'PASS';
    let decisionReason = 'Tất cả chỉ số đạt ngưỡng.';
    if (overallDim < 0.6 || checks.some((c) => c.status === 'FAILED')) {
      decision = 'FAIL';
      decisionReason = `Có ${checks.filter((c) => c.status === 'FAILED').length} kiểm tra không đạt hoặc điểm tổng dưới 0.60.`;
    } else if (detectedIssues.length > 0 || overallDim < 0.85) {
      decision = 'NEEDS_REVIEW';
      decisionReason = `Có ${detectedIssues.length} cảnh báo cần xem lại.`;
    } else if (autoRepairs.length > 0) {
      decision = 'AUTO_REPAIR';
      decisionReason = `Đạt ngưỡng sau ${autoRepairs.length} lần tự sửa.`;
    }
    const overallStatus: QualityStatus = decision === 'FAIL' ? 'FAILED' : decision === 'PASS' || decision === 'AUTO_REPAIR' ? 'PASSED' : 'WARNING';

    const qualityReport: QualityReport = {
      report_id: `qr_${Date.now().toString(36)}`,
      decision,
      decision_reason: decisionReason,
      scores: { content: contentDim, pedagogy: pedagogyDim, narrative: narrativeDim, visual: visualDim, technical: technicalDim, overall: overallDim },
      issues: detectedIssues,
      repair_attempts: autoRepairs.length > 0 ? 1 : 0,
      max_repair_attempts: 1,
      human_review_required: decision === 'NEEDS_REVIEW' || decision === 'FAIL',
      human_review_reason: decision === 'NEEDS_REVIEW' || decision === 'FAIL' ? decisionReason : undefined,
      overall_status: overallStatus,
      overall_quality_score: overallDim,
      dar_p_ratio: Math.round(durationErrorRatio * 1000) / 1000,
      target_duration_sec: targetDuration,
      actual_duration_sec: Math.round(actualDuration * 10) / 10,
      duration_error_pct: durationErrorPct,
      dar_p_pre_repair_pct: Math.round(preRepairErrorPct * 10) / 10,
      factual_consistency_score: contentDim,
      visual_necessity_score: round2(necessityScore),
      taxonomy_validity_score: round2(taxScore),
      prosody_coherence_score: round2(prosodyScore),
      language_terminology_score: round2(langScore),
      narrative_coherence_score: narrativeDim,
      language_traces: Array.from(new Set(languageTraces)).slice(0, 10),
      checks,
      auto_repairs_applied: autoRepairs,
      timestamp: new Date().toISOString()
    };

    let cursor = 0;
    const verifiedScenes = workingScenes.map((s) => {
      const dur = s.scene_duration_sec;
      const v: CLSGScene = {
        ...s,
        slide_analysis: planById.get(s.section_id)?.slide_analysis || s.slide_analysis,
        narrative_plan: planById.get(s.section_id)?.narrative_plan || s.narrative_plan,
        scene_start_time_sec: Math.round(cursor * 10) / 10,
        scene_end_time_sec: Math.round((cursor + dur) * 10) / 10,
        scene_duration_sec: Math.round(dur * 10) / 10
      };
      cursor += dur;
      return v;
    });

    const verifiedIr: VerifiedCLSG_IR = {
      ir_version: '1.1.0',
      ir_id: `clsg_verified_${Date.now().toString(36)}`,
      document_id: docTree.document_id,
      blueprint_id: blueprint.blueprint_id,
      lecture_title: blueprint.lecture_title,
      configuration: config,
      total_scenes: verifiedScenes.length,
      total_duration_sec: Math.round(cursor * 10) / 10,
      total_words: verifiedScenes.reduce((sum, s) => sum + s.narration.word_count, 0),
      scenes: verifiedScenes,
      quality_report: qualityReport,
      verified_at: new Date().toISOString()
    };

    return { qualityReport, verifiedIr };
  }

  private planFromScene(scene: CLSGScene): SectionPlan {
    return {
      section_id: scene.section_id,
      title: scene.topic,
      order: scene.order,
      pedagogical_function: scene.pedagogical_function,
      bloom_level: 'Understand',
      target_duration_sec: scene.scene_duration_sec,
      target_word_budget: scene.narration.word_count,
      key_concepts: [],
      instructional_goal: scene.learning_goal
    };
  }

  /**
   * Scales every planned pause toward the target but clamps each one to its type's range.
   * If the words alone are too long/short for the target, DAR-P stays off: that is the honest result.
   */
  private rescalePauses(scenes: CLSGScene[], targetSec: number): CLSGScene[] {
    const speaking = scenes.reduce((s, sc) => s + sc.prosody_plan.total_speaking_sec, 0);
    const pausesNow = scenes.reduce((s, sc) => s + sc.prosody_plan.total_pause_sec, 0);
    if (pausesNow <= 0) return scenes;
    const factor = Math.max(0, (targetSec - speaking) / pausesNow);

    return scenes.map((s) => {
      let pauseMs = 0;
      const sentences = s.prosody_plan.sentences.map((sent) => {
        const wordPauses = (sent.word_pauses || []).map((p) => {
          const [lo, hi] = PAUSE_RANGES_MS[p.pause_type] || [p.duration_ms, p.duration_ms];
          const ms = Math.round(Math.max(lo, Math.min(hi, p.duration_ms * factor)));
          pauseMs += ms;
          return { ...p, duration_ms: ms };
        });
        const [lo, hi] = PAUSE_RANGES_MS[sent.prosody.pause_type] || [sent.prosody.pause_after_ms, sent.prosody.pause_after_ms];
        const after = Math.round(Math.max(lo, Math.min(hi, sent.prosody.pause_after_ms * factor)));
        pauseMs += after;
        return { ...sent, word_pauses: wordPauses, prosody: { ...sent.prosody, pause_after_ms: after } };
      });
      const total = s.prosody_plan.total_speaking_sec + pauseMs / 1000;
      return {
        ...s,
        narration: { ...s.narration, sentences },
        prosody_plan: {
          ...s.prosody_plan,
          sentences,
          total_pause_sec: Math.round((pauseMs / 1000) * 10) / 10,
          effective_scene_duration_sec: Math.round(total * 10) / 10,
          ssml_full: this.rebuildSsml(s.prosody_plan.ssml_full, sentences)
        },
        scene_duration_sec: Math.round(total * 10) / 10
      };
    });
  }

  /** Rebuilds SSML from the (rescaled) sentence and word-level pauses so audio matches the plan. */
  private rebuildSsml(previous: string, sentences: CLSGScene['prosody_plan']['sentences']): string {
    const header = previous.match(/^<speak[^>]*>/)?.[0] || '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis">';
    const body = sentences.map((sent) => {
      const breaks = new Map<number, number>();
      (sent.word_pauses || []).forEach((p) => breaks.set(p.word_index, (breaks.get(p.word_index) || 0) + p.duration_ms));
      const esc = (w: string) => w.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const tokens = sent.text.split(/\s+/).map((w, i) => (breaks.has(i) ? `${esc(w)} <break time="${breaks.get(i)}ms"/>` : esc(w)));
      return `  <prosody rate="${sent.prosody.rate}">${tokens.join(' ')}<break time="${sent.prosody.pause_after_ms}ms"/></prosody>`;
    });
    return `${header}\n${body.join('\n')}\n</speak>`;
  }
}
