// src/pipeline/module3_generator/templateComposer.ts
/**
 * Universal template composer for zero-LLM narration.
 *
 * Slides are written as fragments ("Kernel 3x3", "Stride = 2", "Ưu điểm:"), so reading each bullet
 * back with a period sounds robotic. The composer works in three layers, all rule-based:
 *
 * 1. Shape of each line (first match wins)
 *    code        code element, or a line that looks like code          -> not read; one pointer per page
 *    question    ends with "?"                                         -> read as is
 *    heading     ends with ":" and <= 8 words                          -> heads the lines under it
 *    example     starts with "Ví dụ" / "VD" / "e.g." / "Example"       -> "Ví dụ, ..."
 *    metric      "X: 92%", "X = 2", "X – 60 triệu" (left <= 6 words, right a number/short value)
 *    formula     equation element, or "a = f(b)" with math symbols
 *    definition  "X: Y" / "X – Y" (left <= 6 words, right >= 2 words)
 *    sentence    >= 12 words (vi) / 8 (en), or contains a verb cue     -> read as is
 *    fragment    anything else (a short noun phrase)
 *
 * 2. Groups
 *    - a heading, or a line followed by deeper-indented lines, heads a group of those lines
 *    - consecutive top-level fragments form one flat list
 *    - a group's kind comes from its head: steps / pros / cons / examples / list
 *      (PROCESS scenes and sequential list strategies treat flat runs as steps)
 *
 * 3. Rendering conditions
 *    - short items (<= 12 words vi / 8 en) are never read one per sentence: 2+ become one enumeration
 *    - a lone short fragment (<= 5 words vi / 4 en) gets a frame ("Cần chú ý đến ..."); longer ones are read as is
 *      ("X gồm a, b và c"); more than 6 are cut to 5 plus a count of the rest
 *    - the page title may be the subject of a flat list only if it is a short noun phrase
 *      (<= 8 words, no "?" or ":"), and only once per scene (heading policy allows one mention)
 *    - "X là Y" is used only when Y does not already start with a verb; otherwise "X Y"
 *    - metrics use "đạt" only for scores/percentages, "bằng" after "=", else "là"
 *    - a formula is spoken only when short (<= 40 chars, one "="); otherwise it is pointed to
 *    - no sentence-initial connectives: sequence and grouping are carried by structure
 *      ("Quy trình gồm ba bước: ...", "Bước 2 là ..."), which the connective policy leaves alone;
 *      steps are numbered with digits because the guard strips ordinal words outside list scenes
 *    - tables: what is compared (row subject x columns), then the max/min of up to two numeric
 *      columns when there are >= 3 data rows; row-by-row readouts only as budget extras
 *    - diagrams: component list; "đi từ A đến B" only when edges were read
 *    - every phrase slot has several variants; the variant rotates across the lecture
 * Everything spoken comes from the page (text, notes, visual readings); templates only add the
 * syntactic frame around it.
 */
import { ContentElement } from '../../types';
import { technicalTerminologyService } from '../services/technicalTerminologyService';

export type Lang = 'vi' | 'en';

export type LineShape = 'code' | 'question' | 'heading' | 'example' | 'metric' | 'formula' | 'definition' | 'sentence' | 'fragment';

export interface SourceLine {
  text: string;
  level: number;
  type?: ContentElement['type'];
}

export interface AnalyzedLine {
  text: string;
  level: number;
  shape: LineShape;
  numbered: boolean;
  /** Left side of a definition/metric/formula. */
  term?: string;
  /** Right side of a definition/metric/formula, or the body of an example. */
  body?: string;
  sep?: string;
}

export type GroupKind = 'steps' | 'pros' | 'cons' | 'examples' | 'list';

export interface LineGroup {
  head?: AnalyzedLine;
  items: AnalyzedLine[];
  kind: GroupKind;
}

export interface ComposeOptions {
  lang: Lang;
  /** Scene role (SlideRole) and list strategy from the planner. */
  role?: string;
  listStrategy?: string;
  /** Page title (may become a list subject under the conditions above). */
  title?: string;
  /** Stable key for variant rotation (e.g. section id). */
  sceneKey: string;
  /** Lecture-wide set of used template variants (shared across scenes). */
  used?: Set<string>;
  /** Term normalization for Vietnamese narration. */
  resolve?: (s: string) => string;
}

// ---------------------------------------------------------------------------
// Layer 1: line shapes
// ---------------------------------------------------------------------------
const L = '\\p{L}';
const wordRe = (words: string[]) => new RegExp(`(?<![${L}])(?:${words.join('|')})(?![${L}])`, 'iu');

const VERB_VI = wordRe([
  'là', 'được', 'bị', 'có', 'không', 'giúp', 'cho phép', 'dùng', 'sử dụng', 'tạo', 'tạo ra', 'giảm', 'tăng', 'làm',
  'cần', 'phải', 'sẽ', 'đang', 'đã', 'để', 'nhằm', 'gồm', 'bao gồm', 'chứa', 'trả về', 'nhận', 'biến đổi', 'tính',
  'học', 'dự đoán', 'phân loại', 'xử lý', 'chuyển', 'đưa', 'lấy', 'tìm', 'giữ', 'loại bỏ', 'kết hợp', 'áp dụng',
  'phụ thuộc', 'quyết định', 'thể hiện', 'cho thấy', 'mô tả', 'đo', 'ảnh hưởng', 'tránh', 'hỗ trợ', 'đảm bảo'
]);
const VERB_EN = wordRe([
  'is', 'are', 'was', 'were', 'be', 'has', 'have', 'can', 'will', 'may', 'must', 'should', 'uses?', 'makes?',
  'allows?', 'reduces?', 'increases?', 'computes?', 'returns?', 'learns?', 'takes?', 'produces?', 'provides?',
  'helps?', 'requires?', 'contains?', 'maps?', 'applies', 'apply', 'depends?', 'shows?', 'avoids?', 'keeps?'
]);
/** Right-hand side that already starts with a verb: "ReLU: giúp mô hình ..." -> "ReLU giúp mô hình ...". */
const STARTS_WITH_VERB_VI = new RegExp(`^(?:${['là', 'được', 'có', 'giúp', 'cho phép', 'dùng', 'sử dụng', 'tạo', 'giảm', 'tăng', 'làm', 'cần', 'nhằm', 'gồm', 'bao gồm', 'chứa', 'trả về', 'nhận', 'biến đổi', 'tính', 'học', 'dự đoán', 'phân loại', 'xử lý', 'đo', 'thể hiện', 'cho thấy', 'mô tả', 'hỗ trợ', 'đảm bảo', 'loại bỏ', 'kết hợp', 'áp dụng'].join('|')})(?![${L}])`, 'iu');
const STARTS_WITH_VERB_EN = /^(?:is|are|can|will|uses?|makes?|allows?|reduces?|increases?|computes?|returns?|learns?|takes?|produces?|provides?|helps?|requires?|contains?|maps?|applies|depends?|shows?|avoids?|keeps?)\b/i;

const CODE_RE = /(^\s*(def|class|import|from|return|for|while|if|elif|else|try|except|const|let|var|function|public|private)\b.*[:({=])|[{};]\s*$|=>|\bconsole\.|\bprint\(|^\s*#include|^\s*\$ /;
const EXAMPLE_RE = /^(ví dụ|vd|chẳng hạn|e\.g\.|eg\.|example|for example|for instance)\s*[:.,-]?\s*/iu;
const NUMBER_VALUE_RE = /^[~≈<>≤≥]?\s*[-+]?\d[\d.,]*\s*(%|[a-zA-Zµ°/]{0,8}|nghìn|ngàn|triệu|tỷ|tỉ|giây|phút|giờ|ngày|lần)?(\s*\([^)]*\))?\.?$/iu;
const CITATION_TERM_RE = /^(nguồn|nguồn ảnh|nguồn tham khảo|tham khảo|trích dẫn|source|sources|credit|credits|reference|references|image credit)(\s*:|\s|$)/iu;
// Operators between single-letter operands only ("x - y", "a/b", "W*x"): "Top-Down" and
// "17 điểm / 19 cạnh" are words, not math.
const MATH_RE = /[\^_√∑∏∫∂∇≈≤≥×÷]|\b(log|exp|sin|cos|tan|max|min|argmax|argmin|softmax|sigmoid)\s*\(|\([^)]*[,+\-*/][^)]*\)|(?<!\p{L})[a-zA-Z]\s*[*/+\-]\s*[a-zA-Z0-9](?![\p{L}\p{N}])/u;
const SEPARATORS = [': ', ' – ', ' — ', ' - ', ' = ', ' => ', ' ≈ '];

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
/**
 * Word-count thresholds per language. Vietnamese words are syllables ("kết nối đầy đủ" = 4), so a
 * phrase needs about 1.5x the English count to carry the same content.
 */
const LONG_WORDS: Record<Lang, number> = { vi: 12, en: 8 };
const INLINE_MAX_WORDS: Record<Lang, number> = { vi: 12, en: 8 };
/** A lone fragment this long reads fine as its own statement; shorter ones get a frame. */
const FRAME_MAX_WORDS: Record<Lang, number> = { vi: 5, en: 4 };

export function analyzeLine(line: SourceLine, lang: Lang): AnalyzedLine | null {
  const numbered = /^\s*\d+[.)]\s+/.test(line.text);
  const text = line.text
    .trim()
    .replace(/^[•●○◦▪▫■□►▸‣⁃\-*+–—]\s*/, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim();
  if (text.length < 2) return null;
  const base: AnalyzedLine = { text, level: line.level, shape: 'fragment', numbered };

  if (line.type === 'code' || CODE_RE.test(text)) return { ...base, shape: 'code' };
  if (/\?\s*$/.test(text)) return { ...base, shape: 'question' };
  if (/:\s*$/.test(text) && wordCount(text) <= 8) return { ...base, shape: 'heading', text: text.replace(/\s*:\s*$/, '') };

  const ex = text.match(EXAMPLE_RE);
  if (ex && text.length > ex[0].length + 2) return { ...base, shape: 'example', body: text.slice(ex[0].length).trim() };

  if (line.type === 'equation') return { ...base, shape: 'formula', ...splitFormula(text) };

  for (const sep of SEPARATORS) {
    const i = text.indexOf(sep);
    if (i <= 0) continue;
    const term = text.slice(0, i).trim();
    const body = text.slice(i + sep.length).trim().replace(/\.+$/, '');
    if (!body || wordCount(term) > 6 || /^\d[\d.,\s]*$/.test(term)) continue;
    if (NUMBER_VALUE_RE.test(body) || (wordCount(body) <= 4 && /\d/.test(body) && !MATH_RE.test(body))) {
      return { ...base, shape: 'metric', term, body, sep: sep.trim() };
    }
    if (sep.trim() === '=' || sep.trim() === '≈' || MATH_RE.test(body)) return { ...base, shape: 'formula', term, body, sep: sep.trim() };
    // A term names something: "1–4: mắt, tai" is a numbered list item and "Nguồn: COCO" a citation, not definitions.
    if (wordCount(body) >= 2 && /\p{L}/u.test(term) && !CITATION_TERM_RE.test(term)) return { ...base, shape: 'definition', term, body, sep: sep.trim() };
  }

  if (/[=≈]/.test(text) && MATH_RE.test(text)) return { ...base, shape: 'formula', ...splitFormula(text) };
  if (wordCount(text) >= LONG_WORDS[lang] || (lang === 'vi' ? VERB_VI : VERB_EN).test(text)) return { ...base, shape: 'sentence' };
  // English clauses usually open with a determiner/pronoun ("The kernel slides over the image").
  if (lang === 'en' && wordCount(text) >= 5 && /^(the|a|an|this|these|those|it|we|they|each|every|our)\s/i.test(text)) return { ...base, shape: 'sentence' };
  return base;
}

function splitFormula(text: string): { term?: string; body?: string; sep?: string } {
  const m = text.match(/^(.{1,30}?)\s*(=|≈)\s*(.+)$/);
  return m ? { term: m[1].trim(), body: m[3].trim(), sep: m[2] } : {};
}

// ---------------------------------------------------------------------------
// Layer 2: groups
// ---------------------------------------------------------------------------
const KIND_RULES: { kind: GroupKind; re: RegExp }[] = [
  { kind: 'cons', re: /(nhược điểm|hạn chế|điểm yếu|khuyết điểm|thách thức|disadvantages?|cons\b|limitations?|drawbacks?|weakness(es)?|challenges?)/iu },
  { kind: 'pros', re: /(ưu điểm|lợi ích|điểm mạnh|advantages?|pros\b|benefits?|strengths?)/iu },
  { kind: 'steps', re: /(các bước|bước|quy trình|trình tự|thuật toán|cách làm|cách thực hiện|algorithm|steps?\b|process|procedure|pipeline|workflow|how to)/iu },
  { kind: 'examples', re: /(ví dụ|ứng dụng|examples?|applications?|use cases?)/iu }
];

function kindOf(head: AnalyzedLine | undefined, items: AnalyzedLine[], opts: ComposeOptions): GroupKind {
  if (head) {
    const rule = KIND_RULES.find((r) => r.re.test(head.text));
    if (rule) return rule.kind;
  }
  if (items.length >= 2 && items.every((i) => i.numbered)) return 'steps';
  if (!head && (opts.role === 'PROCESS' || opts.listStrategy === 'SEQUENTIAL_PROCESS')) return 'steps';
  return 'list';
}

function groupLines(lines: AnalyzedLine[], opts: ComposeOptions): (LineGroup | AnalyzedLine)[] {
  const out: (LineGroup | AnalyzedLine)[] = [];
  const hasLevels = new Set(lines.map((l) => l.level)).size > 1;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];
    const deeperFollows = hasLevels && next && next.level > line.level;

    if (line.shape === 'heading' || (deeperFollows && (line.shape === 'fragment' || line.shape === 'sentence'))) {
      const items: AnalyzedLine[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const l = lines[j];
        if (hasLevels ? l.level <= line.level : l.shape === 'heading') break;
        items.push(l);
        j++;
      }
      if (items.length) {
        out.push({ head: line, items, kind: kindOf(line, items, opts) });
        i = j;
        continue;
      }
      // A heading with nothing under it is still content: read it as a fragment.
      out.push({ ...line, shape: 'fragment' });
      i++;
      continue;
    }

    if (line.shape === 'fragment' || (line.shape === 'sentence' && opts.role === 'PROCESS')) {
      const run: AnalyzedLine[] = [];
      let j = i;
      while (j < lines.length && lines[j].shape === line.shape && !(hasLevels && lines[j + 1] && lines[j + 1].level > lines[j].level)) {
        run.push(lines[j]);
        j++;
      }
      if (run.length >= 2) {
        out.push({ items: run, kind: kindOf(undefined, run, opts) });
        i = j;
        continue;
      }
    }
    out.push(line);
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Layer 3: phrase banks and rendering
// ---------------------------------------------------------------------------
type Bank = Record<string, string[]>;

const VI: Bank = {
  list_titled: ['{S} gồm {L}.', '{S} bao gồm {L}.', 'Với {s}, ta có {L}.'],
  list_plain: ['Các ý chính gồm {L}.', 'Nội dung cần nắm gồm {L}.', 'Ở đây có {N} ý: {L}.'],
  list_head: ['{H} gồm {L}.', '{H} bao gồm {L}.', 'Với {h}, ta có {L}.'],
  steps_inline: ['{H} gồm {N} bước: {L}.', '{H} diễn ra qua {N} bước: {L}.'],
  steps_plain: ['Quy trình gồm {N} bước: {L}.', 'Các bước thực hiện lần lượt là {L}.'],
  steps_intro: ['{H} gồm {N} bước.', '{H} diễn ra qua {N} bước.'],
  // The head already says "bước" ("Các bước:"): don't repeat it ("Các bước gồm ba bước").
  steps_named: ['{H} lần lượt là {L}.'],
  steps_named_intro: ['Có {N} bước.'],
  // Digits, not "thứ nhất": the guard strips ordinal words outside list scenes.
  step_fragment: ['Bước {K} là {x}.'],
  step_sentence: ['Ở bước {K}, {x}'],
  pros: ['Về {h}, có thể kể đến {L}.', '{H} gồm {L}.'],
  cons: ['Về {h}, cần lưu ý {L}.', '{H} gồm {L}.'],
  examples: ['Một số ví dụ gồm {L}.', 'Có thể lấy ví dụ như {L}.'],
  head_sentences: ['Về {h}, {x}'],
  single: ['Cần chú ý đến {x}.', 'Một ý quan trọng là {x}.'],
  definition: ['{T} là {B}.', '{T} được hiểu là {B}.', 'Có thể hiểu {t} là {B}.'],
  definition_verb: ['{T} {B}.'],
  metric_score: ['{T} đạt {B}.'],
  metric_eq: ['{T} bằng {B}.'],
  metric: ['{T} là {B}.'],
  formula_short: ['Theo công thức trên màn hình, {T} bằng {B}.', 'Công thức cho biết {t} bằng {B}.'],
  formula_long: ['Công thức tương ứng được trình bày trên màn hình.'],
  example: ['Ví dụ, {x}', 'Lấy ví dụ, {x}'],
  code: ['Đoạn mã trên màn hình minh hoạ cách triển khai.', 'Hãy theo dõi đoạn mã trên màn hình.'],
  table_compare: ['Bảng so sánh {N} {s} theo {L}.', 'Bảng liệt kê {N} {s} cùng {L}.'],
  table_single: ['Bảng cho biết {L}.'],
  table_extreme: ['{A} có {c} {hi}, {va}', '{c} {hi} thuộc về {A}, {va}'],
  diagram: ['Sơ đồ gồm các thành phần {L}.', 'Sơ đồ thể hiện {L}.'],
  diagram_flow: ['Sơ đồ đi từ {A} đến {B}, qua {L}.']
};

const EN: Bank = {
  list_titled: ['{S} include {L}.', '{S} cover {L}.'],
  list_plain: ['The key points are {L}.', 'Here we have {N} points: {L}.'],
  list_head: ['{H} include {L}.', '{H} cover {L}.'],
  steps_inline: ['{H} takes {N} steps: {L}.'],
  steps_plain: ['The process has {N} steps: {L}.', 'The steps are {L}.'],
  steps_intro: ['{H} takes {N} steps.'],
  steps_named: ['{H} are {L}.'],
  steps_named_intro: ['There are {N} steps.'],
  step_fragment: ['Step {K} is {x}.'],
  step_sentence: ['In step {K}, {x}'],
  pros: ['The advantages include {L}.', '{H} include {L}.'],
  cons: ['The limitations include {L}.', '{H} include {L}.'],
  examples: ['Examples include {L}.'],
  head_sentences: ['On {h}, {x}'],
  single: ['Note {x}.', 'One key point is {x}.'],
  definition: ['{T} is {B}.', '{T} refers to {B}.'],
  definition_verb: ['{T} {B}.'],
  metric_score: ['{T} reaches {B}.'],
  metric_eq: ['{T} equals {B}.'],
  metric: ['{T} is {B}.'],
  formula_short: ['According to the formula on screen, {T} equals {B}.'],
  formula_long: ['The corresponding formula is shown on screen.'],
  example: ['For example, {x}'],
  code: ['The code on screen shows the implementation.'],
  table_compare: ['The table compares {N} {s} by {L}.'],
  table_single: ['The table gives {L}.'],
  table_extreme: ['{A} has the {hi} {c}, {va}'],
  diagram: ['The diagram shows {L}.'],
  diagram_flow: ['The diagram goes from {A} to {B}, through {L}.']
};

const NUM_VI = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'];
const NUM_EN = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

const isUpper = (ch: string | undefined) => Boolean(ch && ch !== ch.toLowerCase() && ch === ch.toUpperCase());

/** Any Vietnamese diacritic (tone or vowel mark, via NFD combining marks) or đ. */
const hasViMark = (w: string) => /[̀-ͯ]/.test(w.normalize('NFD')) || /đ/i.test(w);
/**
 * A line written in the other language (English slide, Vietnamese narration or vice versa).
 * Wrapping it in a frame produces hybrid grammar ("X là bridging the gap"), so it is read verbatim.
 * Short phrases (<= 2 words: "max pooling", "CNN") are terms and stay frameable.
 */
function isForeignLine(text: string, lang: Lang): boolean {
  const ws = text.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (ws.length < 3) return false;
  const marked = ws.filter(hasViMark).length;
  return lang === 'vi' ? marked === 0 : marked / ws.length >= 0.3;
}

const SCORE_RE = /(accuracy|precision|recall|f1|map|auc|bleu|rouge|score|độ chính xác|điểm|tỉ lệ|tỷ lệ|hiệu suất|độ đo)/iu;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

const endSentence = (s: string) => {
  const t = s.trim();
  return /[.!?…]$/.test(t) ? t : `${t.replace(/[:;,]+$/, '')}.`;
};

class Renderer {
  private bank: Bank;
  private usedTitle = false;
  private pointedCode = false;
  constructor(private opts: ComposeOptions) {
    this.bank = opts.lang === 'vi' ? VI : EN;
  }

  private r(s: string) {
    const t = s.trim().replace(/\.+$/, '');
    return this.opts.lang === 'vi' && this.opts.resolve ? this.opts.resolve(t) : t;
  }

  /** Lowercase the first letter unless it starts a term/acronym/proper name. */
  low(s: string): string {
    if (!s) return s;
    const words = s.split(/\s+/);
    const first = words[0];
    if (!isUpper(first[0])) return s;
    // Acronyms (CNN, ReLU), mixed case (ResNet), numbers in the word (LeNet-5).
    if (isUpper(first[1]) || /\p{Ll}\p{Lu}/u.test(first) || /\d/.test(first)) return s;
    const canon = technicalTerminologyService.getTermDictionary().get(first.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, ''));
    if (canon && /[A-Z]/.test(canon.canonical)) return s;
    if (words.length > 1 && isUpper(words[1][0])) return s; // proper names: "Google Colab", "Hà Nội"
    return first[0].toLowerCase() + s.slice(1);
  }

  up(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  num(n: number): string {
    const t = this.opts.lang === 'vi' ? NUM_VI : NUM_EN;
    return n < t.length ? t[n] : String(n);
  }

  list(items: string[], countLabel = true): string {
    const vi = this.opts.lang === 'vi';
    let xs = items.map((x) => this.low(this.r(x))).filter(Boolean);
    let rest = 0;
    if (xs.length > 6) {
      rest = xs.length - 5;
      xs = xs.slice(0, 5);
    }
    let joined: string;
    if (xs.length === 1) joined = xs[0];
    else if (vi) joined = `${xs.slice(0, -1).join(', ')} và ${xs[xs.length - 1]}`;
    else joined = `${xs.slice(0, -1).join(', ')}${xs.length > 2 ? ',' : ''} and ${xs[xs.length - 1]}`;
    if (rest && countLabel) joined = vi ? `${xs.join(', ')} cùng ${rest} mục khác trên màn hình` : `${xs.join(', ')}, plus ${rest} more on screen`;
    return joined;
  }

  /** Picks a variant for a slot, rotating so the same frame is not reused back to back in a lecture. */
  pick(slot: string, vars: Record<string, string>): string {
    const variants = this.bank[slot];
    const used = this.opts.used;
    let idx = hash(`${this.opts.sceneKey}|${slot}`) % variants.length;
    if (used && variants.length > 1) {
      const key = (i: number) => `tpl|${slot}|${i}`;
      let tries = 0;
      while (used.has(key(idx)) && tries < variants.length) {
        idx = (idx + 1) % variants.length;
        tries++;
      }
      if (tries === variants.length) variants.forEach((_, i) => used.delete(key(i)));
      used.add(key(idx));
    }
    let out = variants[idx];
    for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v);
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  /** The page title can carry a flat list once, if it reads as a short noun phrase. */
  private titleSubject(): string | null {
    const t = (this.opts.title || '').trim();
    if (this.usedTitle || !t || /[?:]/.test(t) || wordCount(t) > 8 || /^(slide|trang|page)\s*\d+/i.test(t)) return null;
    if ((this.opts.lang === 'vi' ? VERB_VI : VERB_EN).test(t)) return null;
    this.usedTitle = true;
    return this.r(t);
  }

  line(l: AnalyzedLine): string {
    if (l.shape !== 'code' && l.shape !== 'question' && l.shape !== 'formula' && isForeignLine(l.text, this.opts.lang)) {
      // Other-language content: keep its own grammar; definitions/metrics keep a label-colon form.
      return (l.shape === 'definition' || l.shape === 'metric') && l.term && l.body ? endSentence(`${this.up(l.term)}: ${l.body}`) : endSentence(this.up(l.text));
    }
    switch (l.shape) {
      case 'code':
        if (this.pointedCode) return '';
        this.pointedCode = true;
        return this.pick('code', {});
      case 'question':
        return endSentence(this.r(l.text).replace(/\?*$/, '?'));
      case 'example': {
        const body = this.r(l.body || '');
        return endSentence(this.pick('example', { x: this.low(body) }));
      }
      case 'definition': {
        const T = this.r(l.term || '');
        const B = this.r(l.body || '');
        const startsVerb = (this.opts.lang === 'vi' ? STARTS_WITH_VERB_VI : STARTS_WITH_VERB_EN).test(B);
        return this.pick(startsVerb ? 'definition_verb' : 'definition', { T: this.up(T), t: T, B: this.low(B) });
      }
      case 'metric': {
        const T = this.r(l.term || '');
        const B = (l.body || '').trim();
        const slot = l.sep === '=' ? 'metric_eq' : SCORE_RE.test(T) || /%/.test(B) ? 'metric_score' : 'metric';
        return this.pick(slot, { T: this.up(T), B });
      }
      case 'formula': {
        const short = l.term && l.body && `${l.term}${l.body}`.length <= 40 && !/[=≈].*[=≈]/.test(l.body);
        return short ? this.pick('formula_short', { T: l.term!, t: l.term!, B: l.body! }) : this.pick('formula_long', {});
      }
      case 'sentence':
        return endSentence(this.up(this.r(l.text)));
      case 'heading':
      case 'fragment':
      default:
        // Only a short noun phrase needs a frame ("Cần chú ý đến chia sẻ trọng số"); a longer one is a statement.
        return wordCount(l.text) > FRAME_MAX_WORDS[this.opts.lang]
          ? endSentence(this.up(this.r(l.text)))
          : this.pick('single', { x: this.low(this.r(l.text)) });
    }
  }

  /** Short items (<= 8 words: fragments, short sentences, metrics) can be enumerated in one sentence. */
  private isShort(i: AnalyzedLine): boolean {
    // Definitions stay as their own "X là Y" sentences; they lose meaning when enumerated.
    return (i.shape === 'fragment' || i.shape === 'sentence' || i.shape === 'metric') && wordCount(i.text) <= INLINE_MAX_WORDS[this.opts.lang];
  }

  private itemText(i: AnalyzedLine): string {
    return i.shape === 'metric' ? `${i.term} ${i.body}` : i.text;
  }

  group(g: LineGroup): string {
    const H = g.head ? this.r(g.head.text) : '';
    const N = this.num(g.items.length);

    if (g.kind === 'steps') {
      const named = /(bước|steps?\b)/iu.test(H);
      if (g.items.every((i) => this.isShort(i))) {
        const L = this.list(g.items.map((i) => this.itemText(i)));
        if (!H) return this.pick('steps_plain', { N, L });
        return this.pick(named ? 'steps_named' : 'steps_inline', { H: this.up(H), N, L });
      }
      const intro = H ? this.pick(named ? 'steps_named_intro' : 'steps_intro', { H: this.up(H), N }) : '';
      const steps = g.items.map((i, k) =>
        i.shape === 'sentence' && !this.isShort(i)
          ? endSentence(this.pick('step_sentence', { K: String(k + 1), x: this.low(this.r(i.text)) }))
          : this.pick('step_fragment', { K: String(k + 1), x: this.low(this.r(this.itemText(i))) })
      );
      return [intro, ...steps].filter(Boolean).join(' ');
    }

    // Enumerate the short items in one sentence (framed by the head / kind), then read long ones.
    const short = g.items.filter((i) => this.isShort(i));
    const long = g.items.filter((i) => !this.isShort(i));
    const out: string[] = [];
    if (short.length) {
      const L = this.list(short.map((i) => this.itemText(i)));
      if (g.kind === 'pros' || g.kind === 'cons') out.push(this.pick(g.kind, { H: this.up(H), h: this.low(H), L }));
      else if (g.kind === 'examples') out.push(this.pick('examples', { L }));
      else if (H) out.push(this.pick('list_head', { H: this.up(H), h: this.low(H), L }));
      else if (short.length === 1) out.push(this.line(short[0]));
      else {
        const S = this.titleSubject();
        out.push(S ? this.pick('list_titled', { S: this.up(S), s: this.low(S), L }) : this.pick('list_plain', { N: this.num(short.length), L }));
      }
    }
    const rendered = long.map((i) => this.line(i)).filter(Boolean);
    // Without a short-item sentence to carry it, the head is attached to the first long item.
    if (!short.length && H && rendered.length) rendered[0] = endSentence(this.pick('head_sentences', { h: this.low(H), x: this.low(rendered[0].replace(/\.$/, '')) }));
    return [...out, ...rendered].join(' ');
  }

  // --- visuals ---------------------------------------------------------------
  table(rows: string[][]): string[] {
    if (rows.length < 2 || rows[0].length < 2) return [];
    const [header, ...data] = rows;
    const cols = header.slice(1).map((c) => this.low(this.r(c))).filter(Boolean);
    const out: string[] = [];
    if (data.length === 1) {
      const pairs = header.slice(1).map((h, j) => `${this.low(this.r(h))} ${this.opts.lang === 'vi' ? 'là' : 'is'} ${data[0][j + 1] || ''}`.trim());
      out.push(this.pick('table_single', { L: this.list(pairs) }));
      return out;
    }
    const subjectRaw = (header[0] || '').trim();
    const subject = subjectRaw && wordCount(subjectRaw) <= 3 ? this.low(this.r(subjectRaw)) : this.opts.lang === 'vi' ? 'mục' : 'items';
    if (cols.length) out.push(this.pick('table_compare', { N: String(data.length), s: subject, L: this.list(cols) }));

    if (data.length >= 3) {
      let spoken = 0;
      for (let j = 1; j < header.length && spoken < 2; j++) {
        const vals = data.map((r) => parseNumber(r[j] || ''));
        if (vals.filter((v) => v !== null).length < Math.ceil(data.length * 0.8)) continue;
        const idx = vals.map((v, i) => ({ v, i })).filter((x) => x.v !== null) as { v: number; i: number }[];
        const max = idx.reduce((a, b) => (b.v > a.v ? b : a));
        const min = idx.reduce((a, b) => (b.v < a.v ? b : a));
        if (max.v === min.v || idx.filter((x) => x.v === max.v).length > 1) continue;
        const col = this.low(this.r(header[j] || ''));
        const score = SCORE_RE.test(col) || data.some((r) => /%/.test(r[j] || ''));
        const vi = this.opts.lang === 'vi';
        const hi = vi ? (score ? 'cao nhất' : 'lớn nhất') : score ? 'highest' : 'largest';
        const lo = vi ? (score ? 'thấp nhất' : 'nhỏ nhất') : score ? 'lowest' : 'smallest';
        const va = vi
          ? `${data[max.i][j]}; ${lo} là ${data[min.i][0]} với ${data[min.i][j]}.`
          : `${data[max.i][j]}; the ${lo} is ${data[min.i][0]} at ${data[min.i][j]}.`;
        out.push(this.pick('table_extreme', { A: data[max.i][0], c: col, hi, va }));
        spoken++;
      }
    }
    return out;
  }

  /** Row readouts, used only as budget extras ("LeNet-5 có tham số 60 nghìn, độ chính xác 98,9%."). */
  tableRows(rows: string[][]): string[] {
    if (rows.length < 3 || rows[0].length < 2) return [];
    const [header, ...data] = rows;
    const vi = this.opts.lang === 'vi';
    return data.slice(0, 8).map((r) => {
      const pairs = header.slice(1).map((h, j) => `${this.low(this.r(h))} ${r[j + 1] || '—'}`);
      return endSentence(`${r[0]} ${vi ? 'có' : 'has'} ${pairs.join(', ')}`);
    });
  }

  diagram(nodes: string[], edges: { from: string; to: string }[]): string {
    const clean = nodes.map((n) => n.trim()).filter((n) => n.length > 1);
    if (clean.length < 2) return '';
    if (edges.length >= clean.length - 1 && clean.length >= 3) {
      return this.pick('diagram_flow', { A: this.r(clean[0]), B: this.r(clean[clean.length - 1]), L: this.list(clean.slice(1, -1)) });
    }
    return this.pick('diagram', { L: this.list(clean) });
  }
}

/** Parses "98,9%", "60 triệu", "1.5M", "25k" to a number (Vietnamese and English conventions). */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  const m = s.match(/^[~≈]?\s*([-+]?\d[\d.,]*)\s*(%|k|m|b|nghìn|ngàn|triệu|tr|tỷ|tỉ)?/u);
  if (!m) return null;
  let num = m[1];
  // "98,9" and "1.234,5" -> decimal comma; "1,234.5" -> thousands comma.
  if (/,\d{1,2}$/.test(num) || (/\.\d{3}/.test(num) && /,/.test(num) && num.lastIndexOf(',') > num.lastIndexOf('.'))) num = num.replace(/\./g, '').replace(',', '.');
  else num = num.replace(/,/g, '');
  let v = Number(num);
  if (!Number.isFinite(v)) return null;
  const unit = m[2];
  if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') v *= 1e3;
  else if (unit === 'm' || unit === 'triệu' || unit === 'tr') v *= 1e6;
  else if (unit === 'b' || unit === 'tỷ' || unit === 'tỉ') v *= 1e9;
  return v;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface VisualReading {
  kind: string;
  text: string;
  summary?: string;
}

export interface ComposedPage {
  /** Body sentences built from the page's own lines. */
  body: string[];
  /** Sentences describing read tables/diagrams. */
  visuals: string[];
  /** Grounded material to use only if the scene is short of its word budget. */
  extras: string[];
  /** A question found on the page (for HOOK / THINK openings). */
  question?: string;
}

/** Parses a table reading ("a | b\nc | d") back into rows. */
function tableRowsFromText(text: string): string[][] {
  const rows = text
    .split('\n')
    .map((r) => r.split(' | ').map((c) => c.trim()))
    .filter((r) => r.length >= 2);
  if (rows.length < 2) return [];
  const width = rows[0].length;
  return rows.every((r) => r.length === width) ? rows : [];
}

export function composePage(lines: SourceLine[], visuals: VisualReading[], opts: ComposeOptions): ComposedPage {
  const renderer = new Renderer(opts);
  const analyzed = lines.map((l) => analyzeLine(l, opts.lang)).filter((l): l is AnalyzedLine => Boolean(l));
  const question = analyzed.find((l) => l.shape === 'question')?.text;

  const body = groupLines(analyzed, opts)
    .map((g) => ('items' in g ? renderer.group(g) : renderer.line(g)))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const visualSentences: string[] = [];
  const extras: string[] = [];
  for (const v of visuals) {
    if (v.summary) visualSentences.push(endSentence(opts.lang === 'vi' && opts.resolve ? opts.resolve(v.summary) : v.summary));
    const rows = tableRowsFromText(v.text || '');
    if (rows.length) {
      if (!v.summary) visualSentences.push(...renderer.table(rows));
      extras.push(...renderer.tableRows(rows));
      continue;
    }
    if (/diagram|chart|smartart/.test(v.kind) || v.text.includes(' → ')) {
      const [nodeLine, edgeLine] = v.text.split('\n');
      const nodes = nodeLine.split(' → ');
      const edges = (edgeLine || '')
        .split(';')
        .map((e) => e.split(' → '))
        .filter((p) => p.length === 2)
        .map(([from, to]) => ({ from, to }));
      const s = renderer.diagram(nodes, edges);
      if (s && !v.summary) visualSentences.push(s);
      continue;
    }
    if (v.text) extras.push(...v.text.split(/\n+/).map((t) => endSentence(t)).filter((t) => wordCount(t) >= 3));
  }
  return { body, visuals: visualSentences, extras, question };
}
