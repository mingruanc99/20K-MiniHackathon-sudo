// src/pipeline/export/scriptMarkdown.ts
/**
 * Studio script export: VerifiedCLSG_IR -> `kich-ban.md` in the Video Studio handoff format
 * (source/HANDOFF-TEAM-KICH-BAN.md), plus a linter for the same rules.
 *
 *   # <Mã bài> · <Tên bài>
 *   - **Mục tiêu:** / **Thời lượng dự kiến:** (in words) / **Giọng đọc:** (optional)
 *   ## <N> · <Tên phần>          one per page (consecutive pages with the same title merge)
 *   ### Câu <N>                  one spoken sentence = one visual scene
 *   - **Kiểu:** kể | giảng | thân mật | hỏi | chốt
 *   - **Lời:** verbatim TTS/caption text: no digits (spoken as words), no math symbols
 *   - **Trên màn hình:** what is shown: visual focus, numbers as written, formulas verbatim
 *   - **Thành phần:** the studio component to build the scene from (studioComponents.ts)
 *   quizzes: ### Câu (hỏi) -> ### Dừng N (- **Dừng:** 30 giây) -> ### Câu (chữa bài)
 *
 * `Thành phần` is our addition to the handoff format. Everything the narration says is kept; the only
 * rewrites are the ones the handoff requires for TTS (numbers to words, formulas moved on screen).
 */
import type { CLSGScene, LessonIndexEntry, StudioLine, StudioQuizItem, VerifiedCLSG_IR, VisualCue } from '../../types';
import { findFormulaSpans, isMathy } from '../services/formulaIntegrity';
import { integerToVietnamese, speakNumbers } from './vietnameseNumbers';
import { STUDIO_COMPONENT_IDS, StudioComponentId } from './studioComponents';

export type Delivery = 'kể' | 'giảng' | 'thân mật' | 'hỏi' | 'chốt';
const DELIVERIES: Delivery[] = ['kể', 'giảng', 'thân mật', 'hỏi', 'chốt'];
const MAX_SAME_DELIVERY = 5;
const QUIZ_PAUSE_SEC = 30;
const FORMULA_ON_SCREEN = 'công thức trên màn hình';

export interface ScriptLine {
  kind: 'line';
  n: number;
  delivery: Delivery;
  speech: string;
  screen: string;
  component: StudioComponentId;
  /** Planned pause after the sentence (prosody plan), shown as "Ngắt". */
  pause?: { ms: number; kind: string };
}
export interface ScriptPause {
  kind: 'pause';
  n: number;
  seconds: number;
  screen: string;
}
export interface ScriptChapter {
  title: string;
  items: (ScriptLine | ScriptPause)[];
}
export interface StudioScript {
  title: string;
  code: string;
  goal?: string;
  durationWords: string;
  voice?: string;
  chapters: ScriptChapter[];
}

export interface ScriptExportOptions {
  /** "D11-05"; defaults to the source file name. */
  lessonCode?: string;
  voice?: string;
  /** Review quizzes built from the lesson's definitions (the handoff asks for 3). */
  quizCount?: number;
}

// ---------------------------------------------------------------------------
// Sentence-level decisions
// ---------------------------------------------------------------------------
const CONCLUDE = /^(như vậy|tóm lại|do đó|vì vậy|nói cách khác|điều quan trọng|các bạn cần ghi nhớ|kết luận|tổng kết)|(chính là|mấu chốt|cốt lõi)\b/iu;
const STORY = /^(ví dụ|chẳng hạn|lấy ví dụ|hãy tưởng tượng|thử hình dung|trong thực tế|một ví dụ|giả sử)|(?<!\p{L})(ví dụ như|chẳng hạn như)(?!\p{L})/iu;
const ADVICE = /^(lưu ý|chú ý|mẹo|kinh nghiệm|bạn nên|các bạn nên|đừng|hãy nhớ)|(?<!\p{L})(nên tránh|cần cẩn thận)(?!\p{L})/iu;
const DIALOGUE = /[“"].{3,}[”"]|(?<!\p{L})(hỏi rằng|trả lời rằng|nói rằng)(?!\p{L})/iu;
const TERM_INTRO = /(?<!\p{L})(gọi là|hay còn gọi là|tức là|được gọi là)\s+\p{Lu}/u;
const COMPARE = /(?<!\p{L})(so với|trong khi|ngược lại|khác với|thay vì)(?!\p{L})/iu;
const QUANTITY_COMPARE = /(cao|thấp|lớn|nhỏ|nhiều|ít) nhất|(?<!\p{L})(so với|chiếm|tăng|giảm)(?!\p{L})/iu;
const SEQUENCE = /(?<!\p{L})(bước|lần lượt|đi qua|sau đó|tiếp theo|quy trình|luồng)(?!\p{L})|→/iu;

function deliveryOf(sentence: string, isLastOfScene: boolean, role?: string): Delivery {
  const s = sentence.trim();
  if (/\?\s*$/.test(s)) return 'hỏi';
  if (STORY.test(s) || role === 'EXAMPLE' || role === 'APPLICATION') return 'kể';
  if (ADVICE.test(s)) return 'thân mật';
  if (CONCLUDE.test(s) || (isLastOfScene && role === 'SUMMARY')) return 'chốt';
  return 'giảng';
}

/** Breaks runs of more than 5 identical deliveries (anti-monotone rule) with the closest fitting kind. */
function breakMonotone(lines: ScriptLine[]): void {
  let run = 0;
  for (let i = 0; i < lines.length; i++) {
    run = i > 0 && lines[i].delivery === lines[i - 1].delivery ? run + 1 : 1;
    if (run <= MAX_SAME_DELIVERY) continue;
    const s = lines[i].speech;
    lines[i].delivery = lines[i].delivery !== 'giảng' ? 'giảng' : / là |: /.test(s) ? 'chốt' : 'kể';
    run = 1;
  }
}

function cueForSentence(scene: CLSGScene, sentenceIdx: number, sentence: string): VisualCue | undefined {
  const cues = scene.visual_cues || [];
  const byWord = cues.find((c) => c.trigger_word && sentence.toLowerCase().includes(c.trigger_word.toLowerCase()));
  if (byWord) return byWord;
  // Time window of this sentence inside the scene.
  let t = scene.scene_start_time_sec;
  const sents = scene.narration.sentences || [];
  for (let i = 0; i < sentenceIdx && i < sents.length; i++) t += (sents[i].estimated_speaking_time_sec || 0) + (sents[i].prosody?.pause_after_ms || 0) / 1000;
  const cur = sents[sentenceIdx];
  const end = t + (cur?.estimated_speaking_time_sec || 0) + (cur?.prosody?.pause_after_ms || 0) / 1000;
  return cues.find((c) => c.trigger_timestamp_sec >= t - 0.05 && c.trigger_timestamp_sec < end);
}

function componentOf(sentence: string, delivery: Delivery, cue: VisualCue | undefined, ctx: { role?: string; lastOfScene: boolean; hasFormula: boolean; numbers: string[] }): StudioComponentId {
  if (delivery === 'hỏi') return 'QuestionCard';
  if (DIALOGUE.test(sentence)) return 'DialogueCard';
  if (ctx.role === 'SUMMARY' && ctx.lastOfScene) return 'Recap';
  if (ctx.hasFormula) return 'Card';
  // Bars only for quantities being compared, not for sizes in an example ("ảnh 32x32").
  if (ctx.numbers.some((n) => /%/.test(n)) || (ctx.numbers.length >= 2 && QUANTITY_COMPARE.test(sentence))) return 'ProbabilityBars';
  const vt = cue?.visual_type;
  if (vt === 'flowchart' || vt === 'process_visualization' || vt === 'timeline' || vt === 'concept_map' || vt === 'diagram' || SEQUENCE.test(sentence)) return 'Flow';
  if (vt === 'comparison' || vt === 'table' || COMPARE.test(sentence)) return 'GlassBox';
  if (vt === 'chart') return 'ProbabilityBars';
  if (delivery === 'kể' || vt === 'real_world_example') return 'Person';
  if (TERM_INTRO.test(sentence)) return 'TokenChip';
  return 'Card';
}

/** Screen line: formulas verbatim, numbers as written, then the visual focus of the cue. */
function screenLine(parts: { formulas: string[]; numbers: string[]; cue?: VisualCue; fallback: string }): string {
  const items: string[] = [];
  // Bare numbers need their context ("Kết quả thực nghiệm · 3 giờ").
  if (!parts.formulas.length && !(parts.cue?.content_focus || []).length && parts.numbers.length) items.push(parts.fallback);
  parts.formulas.forEach((f) => items.push(f));
  if (parts.numbers.length) items.push(parts.numbers.join(' · '));
  const focus = (parts.cue?.content_focus || []).filter((f) => f && !items.some((i) => i.includes(f))).slice(0, 3);
  items.push(...focus);
  if (!items.length) items.push(parts.fallback);
  return items.join(' · ').replace(/\s+/g, ' ').trim();
}

function splitSentences(scene: CLSGScene): string[] {
  const raw = scene.narration.sentences?.length
    ? scene.narration.sentences.map((s) => s.text.trim())
    : scene.narration.text.split(/(?<=[.!?…])\s+/).map((s) => s.trim());
  // "Hết." / "Vì sao?" are too short for a scene of their own: glue them to a neighbour.
  const out: string[] = [];
  for (const s of raw.filter(Boolean)) {
    if (out.length && s.split(/\s+/).length < 3) out[out.length - 1] = `${out[out.length - 1]} ${s}`;
    else if (out.length && out[out.length - 1].split(/\s+/).length < 3) out[out.length - 1] = `${out[out.length - 1]} ${s}`;
    else out.push(s);
  }
  return out;
}

/** TTS-safe speech: formulas leave the spoken line (they go on screen), numbers become words. */
function speechOf(sentence: string, formulasOfScene: string[]): { speech: string; formulas: string[]; numbers: string[] } {
  const formulas: string[] = [];
  let text = sentence;
  for (const span of findFormulaSpans(text).reverse()) {
    // Single symbols ("α") are spoken as written; whole formulas are shown, not read.
    if (span.text.length <= 2 && !/[=←→]/.test(span.text)) continue;
    const verbatim = formulasOfScene.find((f) => f.replace(/\s+/g, '') === span.text.replace(/\s+/g, '')) || span.text;
    formulas.unshift(verbatim);
    text = text.slice(0, span.start) + FORMULA_ON_SCREEN + text.slice(span.end);
  }
  const spoken = speakNumbers(text);
  const speech = spoken.text.replace(/\s+/g, ' ').trim();
  // "17 điểm..." becomes "mười bảy điểm...": the sentence still starts with a capital.
  return { speech: speech.charAt(0).toLocaleUpperCase('vi') + speech.slice(1), formulas, numbers: spoken.numbers };
}

const PAUSE_LABEL: Record<string, string> = {
  syntactic: 'ngắt nhẹ',
  emphasis: 'nhấn',
  semantic: 'ngắt ý',
  concept_boundary: 'chuyển ý',
  example_transition: 'sang ví dụ',
  section_transition: 'chuyển phần',
  natural: 'tự nhiên'
};

/** "0,6 giây" / "1,2 giây" / "0,25 giây" (Vietnamese decimal comma). */
function formatPause(ms: number): string {
  const s = ms / 1000;
  return `${(Math.round(s * 100) / 100).toString().replace('.', ',')} giây`;
}

/**
 * Pause after a script sentence, from the prosody plan (the same pauses the SSML carries). A script
 * sentence can glue several short prosody sentences, so the pause of the last one it ends with counts.
 */
function pauseAfter(scene: CLSGScene, sentence: string): ScriptLine['pause'] {
  const target = normSpeech(sentence);
  const hit = [...(scene.prosody_plan?.sentences || [])].reverse().find((p) => {
    const n = normSpeech(p.text);
    return n && (target === n || target.endsWith(n));
  });
  if (!hit) return undefined;
  return { ms: hit.prosody.pause_after_ms, kind: PAUSE_LABEL[hit.prosody.pause_type] || 'ngắt' };
}

const normSpeech = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * The LLM line a final sentence came from. Guard repairs (formula spelling, dropped connectives,
 * duplicate removal) can change a sentence slightly, so a close word overlap still counts.
 */
function authoredLine(scene: CLSGScene, sentence: string): StudioLine | undefined {
  if (!scene.studio_lines?.length) return undefined;
  const target = normSpeech(sentence);
  const exact = scene.studio_lines.find((l) => normSpeech(l.speech) === target);
  if (exact) return exact;
  const words = new Set(target.split(' '));
  let best: { line: StudioLine; score: number } | undefined;
  for (const l of scene.studio_lines) {
    const lw = normSpeech(l.speech).split(' ');
    const inter = lw.filter((w) => words.has(w)).length;
    const score = inter / Math.max(words.size, lw.length);
    if (!best || score > best.score) best = { line: l, score };
  }
  return best && best.score >= 0.7 ? best.line : undefined;
}

// ---------------------------------------------------------------------------
// Quizzes: written by the LLM with the script, else built from the lesson index
// ---------------------------------------------------------------------------
function quizFromLlm(quiz: StudioQuizItem[], startLine: number): ScriptChapter {
  const items: (ScriptLine | ScriptPause)[] = [];
  let n = startLine;
  quiz.forEach((q, qi) => {
    items.push({
      kind: 'line',
      n: n++,
      delivery: 'hỏi',
      speech: speakNumbers(q.question).text,
      screen: `Câu hỏi trắc nghiệm · A. ${q.options.A} · B. ${q.options.B} · C. ${q.options.C}`,
      component: 'QuestionCard'
    });
    items.push({ kind: 'pause', n: qi + 1, seconds: QUIZ_PAUSE_SEC, screen: `Giữ nguyên câu hỏi · Vòng tròn đếm ngược Countdown ${QUIZ_PAUSE_SEC} giây` });
    items.push({
      kind: 'line',
      n: n++,
      delivery: 'giảng',
      speech: speakNumbers(q.explanation).text,
      screen: `Phương án ${q.answer} sáng lên · ${q.options[q.answer]}`,
      component: 'QuestionCard'
    });
  });
  return { title: 'Trắc nghiệm củng cố kiến thức', items };
}

function buildQuizzes(entries: LessonIndexEntry[], count: number, startLine: number): ScriptChapter | null {
  const defs = entries.filter((e) => e.kind === 'definition' && e.term && !isMathy(e.text) && !isMathy(e.term));
  if (defs.length < 3 || count <= 0) return null;
  const items: (ScriptLine | ScriptPause)[] = [];
  const letters = ['A', 'B', 'C'];
  let n = startLine;
  defs.slice(0, count).forEach((d, qi) => {
    const others = defs.filter((o) => o !== d);
    const distractors = [others[qi % others.length], others[(qi + 1) % others.length]];
    const options = [...distractors];
    const correctPos = qi % 3;
    options.splice(correctPos, 0, d);
    const body = d.text.replace(/[.。]+$/, '');
    const bodyLower = body.charAt(0).toLowerCase() + body.slice(1);
    // Works whether the definition is a noun phrase or starts with a verb ("giúp mô hình...").
    const q = speakNumbers(`Khái niệm nào ứng với mô tả sau: ${bodyLower}?`);
    items.push({
      kind: 'line',
      n: n++,
      delivery: 'hỏi',
      speech: q.text,
      screen: `Câu hỏi trắc nghiệm · ${options.map((o, i) => `${letters[i]}. ${o.term}`).join(' · ')}`,
      component: 'QuestionCard'
    });
    items.push({ kind: 'pause', n: qi + 1, seconds: QUIZ_PAUSE_SEC, screen: `Giữ nguyên câu hỏi · Vòng tròn đếm ngược Countdown ${QUIZ_PAUSE_SEC} giây` });
    // First sentence after the pause is the model answer: no filler ("Hết giờ...").
    const a = speakNumbers(`Đáp án đúng là ${letters[correctPos]}, ${d.term}, khái niệm ứng với mô tả ${bodyLower}.`);
    items.push({
      kind: 'line',
      n: n++,
      delivery: 'giảng',
      speech: a.text,
      screen: `Phương án ${letters[correctPos]} sáng lên · ${d.term}: ${body}`,
      component: 'QuestionCard'
    });
  });
  return { title: 'Trắc nghiệm củng cố kiến thức', items };
}

// ---------------------------------------------------------------------------
// Build + render
// ---------------------------------------------------------------------------
function durationInWords(sec: number): string {
  const halfMinutes = Math.max(1, Math.round(sec / 30));
  const min = Math.floor(halfMinutes / 2);
  const half = halfMinutes % 2 === 1;
  if (min === 0) return 'khoảng nửa phút';
  return `khoảng ${integerToVietnamese(min)} phút${half ? ' rưỡi' : ''}`;
}

function buildStudioScript(ir: VerifiedCLSG_IR, opts: ScriptExportOptions & { sourceFileName?: string } = {}): StudioScript {
  const chapters: ScriptChapter[] = [];
  const lines: ScriptLine[] = [];
  let n = 1;
  ir.scenes.forEach((scene) => {
    const role = scene.slide_analysis?.slide_role;
    const sentences = splitSentences(scene);
    const items: ScriptLine[] = sentences.map((sentence, i) => {
      const lastOfScene = i === sentences.length - 1;
      const { speech, formulas, numbers } = speechOf(sentence, scene.formulas || []);
      // A formula shown on this page but only described in words still goes on screen with its sentence.
      const shown = formulas.length ? formulas : /công thức/i.test(sentence) ? (scene.formulas || []).slice(0, 1) : [];
      const authored = authoredLine(scene, sentence);
      if (authored) {
        // The LLM chose delivery, screen text and component; numbers/formulas the QA matches must still be there.
        const extra = [...shown, ...numbers].filter((x) => !authored.screen.includes(x));
        return {
          kind: 'line',
          n: n++,
          delivery: authored.delivery,
          speech,
          screen: [authored.screen || scene.topic, ...extra].join(' · '),
          component: STUDIO_COMPONENT_IDS.includes(authored.component as StudioComponentId) ? (authored.component as StudioComponentId) : 'Card',
          pause: pauseAfter(scene, sentence)
        };
      }
      const cue = cueForSentence(scene, i, sentence);
      const delivery = deliveryOf(sentence, lastOfScene, role);
      return {
        kind: 'line',
        n: n++,
        delivery,
        speech,
        screen: screenLine({ formulas: shown, numbers, cue, fallback: scene.topic }),
        component: componentOf(sentence, delivery, cue, { role, lastOfScene, hasFormula: shown.length > 0, numbers }),
        pause: pauseAfter(scene, sentence)
      };
    });
    lines.push(...items);
    const title = scene.topic.trim() || `Phần ${chapters.length + 1}`;
    const prev = chapters[chapters.length - 1];
    if (prev && prev.title === title) prev.items.push(...items);
    else chapters.push({ title, items });
  });
  breakMonotone(lines);

  const quiz = ir.studio_quiz?.length ? quizFromLlm(ir.studio_quiz, n) : buildQuizzes(ir.lesson_index?.entries || [], opts.quizCount ?? 3, n);
  if (quiz) chapters.push(quiz);

  const stem = (opts.sourceFileName || '').replace(/\.[^.]+$/, '');
  return {
    title: ir.lecture_title,
    code: (opts.lessonCode || stem || 'BAI').toUpperCase(),
    goal: ir.lesson_model?.lesson_goal || ir.scenes[0]?.learning_goal,
    durationWords: durationInWords(ir.total_duration_sec),
    voice: opts.voice,
    chapters
  };
}

function renderStudioScript(script: StudioScript): string {
  const out: string[] = [`# ${script.code} · ${script.title}`, ''];
  if (script.goal) out.push(`- **Mục tiêu:** ${speakNumbers(script.goal).text}`);
  out.push(`- **Thời lượng dự kiến:** ${script.durationWords}.`);
  if (script.voice) out.push(`- **Giọng đọc:** ${script.voice}`);
  script.chapters.forEach((ch, ci) => {
    out.push('', `## ${ci + 1} · ${ch.title}`);
    for (const item of ch.items) {
      out.push('');
      if (item.kind === 'pause') {
        out.push(`### Dừng ${item.n}`, `- **Dừng:** ${item.seconds} giây`, `- **Trên màn hình:** ${item.screen}`, `- **Thành phần:** Countdown`);
      } else {
        out.push(`### Câu ${item.n}`, `- **Kiểu:** ${item.delivery}`, `- **Lời:** ${item.speech}`, `- **Trên màn hình:** ${item.screen}`, `- **Thành phần:** ${item.component}`);
        if (item.pause) out.push(`- **Ngắt:** ${formatPause(item.pause.ms)} · ${item.pause.kind}`);
      }
    }
  });
  return `${out.join('\n')}\n`;
}

export function exportStudioScript(ir: VerifiedCLSG_IR, opts: ScriptExportOptions & { sourceFileName?: string } = {}): { markdown: string; issues: ScriptIssue[] } {
  const markdown = renderStudioScript(buildStudioScript(ir, opts));
  return { markdown, issues: lintStudioScript(markdown) };
}

// ---------------------------------------------------------------------------
// Linter (handoff §5 rules; works on any kich-ban.md, hand-edited or generated)
// ---------------------------------------------------------------------------
export interface ScriptIssue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

const NUMBER_WORDS = /(?<!\p{L})(phần trăm|phẩy|mươi|trăm|nghìn|triệu|tỷ)(?!\p{L})/iu;
const PHONETIZED = /(^|\s)(\p{Lu}\p{Ll}{0,2}[\s-]){2,}\p{Lu}\p{Ll}{0,2}(?=[\s,.!?]|$)|\p{Lu}\p{Ll}{1,3}(-\p{Ll}{1,4}){2,}/u;
const FILLER_AFTER_PAUSE = /^(hết giờ|thời gian đã hết|đã hết thời gian|time'?s up)/iu;

export function lintStudioScript(md: string): ScriptIssue[] {
  const issues: ScriptIssue[] = [];
  const lines = md.split(/\r?\n/);
  if (!/^# .+ · .+/.test(lines[0] || '')) issues.push({ level: 'error', where: 'dòng 1', message: 'thiếu tiêu đề "# <Mã bài> · <Tên bài>" ở dòng đầu' });
  if (!lines.some((l) => /^## /.test(l))) issues.push({ level: 'error', where: 'file', message: 'không có chương "## <Số> · <Tên phần>"' });

  type Block = { head: string; fields: Record<string, string>; line: number };
  const blocks: Block[] = [];
  lines.forEach((l, i) => {
    if (/^### /.test(l)) blocks.push({ head: l.slice(4).trim(), fields: {}, line: i + 1 });
    const f = l.match(/^- \*\*(.+?):\*\*\s*(.*)$/);
    if (f && blocks.length) blocks[blocks.length - 1].fields[f[1]] = f[2];
  });

  let expected = 1;
  let quizzes = 0;
  let run = 0;
  let prevDelivery = '';
  blocks.forEach((b, i) => {
    const where = `${b.head} (dòng ${b.line})`;
    const cau = b.head.match(/^Câu (\d+)$/);
    const dung = /^Dừng \d+$/.test(b.head);
    if (!cau && !dung) {
      issues.push({ level: 'error', where, message: 'mục "###" phải là "Câu N" hoặc "Dừng N"' });
      return;
    }
    if (dung) {
      const prev = blocks[i - 1];
      if (!prev || (prev.fields['Kiểu'] || '') !== 'hỏi') issues.push({ level: 'error', where, message: 'chỗ dừng không có câu hỏi ngay trước' });
      const next = blocks[i + 1];
      if (!next || !/^Câu /.test(next.head)) issues.push({ level: 'error', where, message: 'thiếu câu chữa bài ngay sau khoảng dừng' });
      else if (FILLER_AFTER_PAUSE.test(next.fields['Lời'] || '')) issues.push({ level: 'error', where: next.head, message: 'câu chữa bài nằm ngay sau khoảng chờ là câu đệm' });
      if (!/^\d+ giây$/.test(b.fields['Dừng'] || '')) issues.push({ level: 'error', where, message: 'thiếu dòng "- **Dừng:** N giây"' });
      else quizzes++;
      return;
    }
    if (+cau![1] !== expected) issues.push({ level: 'error', where, message: `đánh số không liên tục (mong đợi Câu ${expected})` });
    expected = +cau![1] + 1;

    const speech = b.fields['Lời'];
    const kind = b.fields['Kiểu'] || 'giảng';
    if (!speech) {
      issues.push({ level: 'error', where, message: 'thiếu dòng "- **Lời:**"' });
      return;
    }
    if (!DELIVERIES.includes(kind as Delivery)) issues.push({ level: 'error', where, message: `kiểu đọc "${kind}" không hợp lệ` });
    if (/\d/.test(speech)) {
      const loose = speech.replace(/[\p{L}_-]+\d[\p{L}\d_.-]*/gu, '');
      if (/\d/.test(loose)) issues.push({ level: 'error', where, message: 'lời đọc có số viết bằng chữ số' });
    }
    if (NUMBER_WORDS.test(speech) && !b.fields['Trên màn hình']) issues.push({ level: 'error', where, message: 'lời đọc có con số nhưng thiếu dòng Trên màn hình' });
    if (PHONETIZED.test(speech)) issues.push({ level: 'warning', where, message: 'có thể là tên riêng bị phiên âm từng chữ cái' });
    if (isMathy(speech.replace(/[_]/g, ''))) issues.push({ level: 'warning', where, message: 'lời đọc có ký hiệu toán (TTS sẽ đọc sai); đưa công thức lên Trên màn hình' });
    const words = speech.split(/\s+/).filter(Boolean).length;
    if (words > 45) issues.push({ level: 'warning', where, message: `câu quá dài (${words} từ > 45)` });
    if (words < 3) issues.push({ level: 'warning', where, message: `câu quá cụt (${words} từ)` });
    if (speech.split(/(?<=[.!?])\s+\p{Lu}/u).length > 2) issues.push({ level: 'warning', where, message: 'một mục Lời nên là một câu' });
    const comp = b.fields['Thành phần'];
    if (comp && !STUDIO_COMPONENT_IDS.includes(comp as StudioComponentId)) issues.push({ level: 'warning', where, message: `thành phần "${comp}" không có trong thư viện Studio` });
    run = kind === prevDelivery ? run + 1 : 1;
    prevDelivery = kind;
    if (run === MAX_SAME_DELIVERY + 1) issues.push({ level: 'error', where, message: `${run} câu liền cùng kiểu "${kind}"` });
  });
  if (quizzes < 3) issues.push({ level: 'warning', where: 'file', message: `có ${quizzes} bộ quiz (nên có 3)` });
  return issues;
}
