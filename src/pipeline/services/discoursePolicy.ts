// src/pipeline/services/discoursePolicy.ts
/**
 * Discourse policy for spoken narration: when a connective may be used, and how often a
 * chapter/section heading may be spoken.
 *
 * Connective rules (a sentence-initial connective survives only if ALL hold):
 *  1. Licensed by content: the connective's relation is actually present
 *     - contrast  ("Tuy nhiên", "Nhưng", "Ngược lại")  -> the sentence or the previous one carries a contrast cue
 *     - result    ("Vì vậy", "Do đó", "Nhờ đó")        -> the previous sentence states a cause/mechanism
 *     - addition  ("Ngoài ra", "Bên cạnh đó", "Đồng thời") -> not scene-initial, max 1 per scene
 *     - sequence  ("Tiếp theo", "Sau đó", "Cuối cùng")  -> only inside PROCESS / sequential content
 *     - summary   ("Như vậy", "Tóm lại")                -> only in SUMMARY scenes or a chapter's last scene
 *     - filler    ("Hãy thử hình dung", "Ngay bây giờ, hãy cùng xem") -> max once per lecture
 *  2. Not the first sentence of a scene (scene openers are handled by the opening strategy),
 *     except summary connectives in SUMMARY scenes
 *  3. The previous sentence did not also start with a connective
 *  4. Scene density <= 1 connective per 3 sentences; lecture density <= 25% of sentences
 *  5. The same connective is not reused within the next 5 sentences and at most
 *     ceil(total_sentences / 15) times in the whole lecture
 * A rejected connective is removed and the sentence re-capitalized (content is never deleted).
 *
 * Heading rules:
 *  - a section title is spoken at most `maxSectionTitleMentions` (default 1) times, only in its own section
 *  - a chapter title is spoken at most once, on the chapter's first active page
 *  - pure transition sentences that only announce a heading ("Chúng ta cùng bước sang X") are
 *    dropped when they would repeat it; other sentences get the title replaced by a short reference
 */

export type ConnectiveRelation = 'contrast' | 'result' | 'addition' | 'sequence' | 'summary' | 'filler' | 'example';

interface ConnectiveDef {
  phrase: string;
  relation: ConnectiveRelation;
}

const CONNECTIVES_VI: ConnectiveDef[] = [
  // longer phrases first so "Chính vì vậy" wins over "Vì vậy"
  { phrase: 'Ngay bây giờ, hãy cùng xem', relation: 'filler' },
  { phrase: 'Hãy thử hình dung một câu hỏi thú vị trước nhé', relation: 'filler' },
  { phrase: 'Các bạn cứ hình dung nó tương tự như', relation: 'filler' },
  { phrase: 'Nối tiếp cấu trúc tổng quan từ phân cảnh trước', relation: 'filler' },
  { phrase: 'Và chính vì vậy', relation: 'result' },
  { phrase: 'Chính vì vậy', relation: 'result' },
  { phrase: 'Chính vì thế', relation: 'result' },
  { phrase: 'Kết quả là', relation: 'result' },
  { phrase: 'Vì vậy', relation: 'result' },
  { phrase: 'Vì thế', relation: 'result' },
  { phrase: 'Do đó', relation: 'result' },
  { phrase: 'Do vậy', relation: 'result' },
  { phrase: 'Nhờ đó', relation: 'result' },
  { phrase: 'Qua đó', relation: 'result' },
  { phrase: 'Tuy nhiên', relation: 'contrast' },
  { phrase: 'Tuy vậy', relation: 'contrast' },
  { phrase: 'Ngược lại', relation: 'contrast' },
  { phrase: 'Trái lại', relation: 'contrast' },
  { phrase: 'Nhưng', relation: 'contrast' },
  { phrase: 'Bên cạnh đó', relation: 'addition' },
  { phrase: 'Ngoài ra', relation: 'addition' },
  { phrase: 'Thêm vào đó', relation: 'addition' },
  { phrase: 'Hơn nữa', relation: 'addition' },
  { phrase: 'Đồng thời', relation: 'addition' },
  { phrase: 'Cụ thể hơn', relation: 'addition' },
  { phrase: 'Cụ thể', relation: 'addition' },
  { phrase: 'Trước hết', relation: 'sequence' },
  { phrase: 'Đầu tiên', relation: 'sequence' },
  { phrase: 'Tiếp theo', relation: 'sequence' },
  { phrase: 'Sau đó', relation: 'sequence' },
  { phrase: 'Cuối cùng', relation: 'sequence' },
  { phrase: 'Nói tóm lại', relation: 'summary' },
  { phrase: 'Tóm lại', relation: 'summary' },
  { phrase: 'Như vậy', relation: 'summary' },
  { phrase: 'Ví dụ như', relation: 'example' },
  { phrase: 'Chẳng hạn', relation: 'example' }
];

const CONNECTIVES_EN: ConnectiveDef[] = [
  { phrase: 'However', relation: 'contrast' },
  { phrase: 'In contrast', relation: 'contrast' },
  { phrase: 'But', relation: 'contrast' },
  { phrase: 'Therefore', relation: 'result' },
  { phrase: 'As a result', relation: 'result' },
  { phrase: 'Thus', relation: 'result' },
  { phrase: 'Hence', relation: 'result' },
  { phrase: 'Moreover', relation: 'addition' },
  { phrase: 'Furthermore', relation: 'addition' },
  { phrase: 'In addition', relation: 'addition' },
  { phrase: 'Additionally', relation: 'addition' },
  { phrase: 'Next', relation: 'sequence' },
  { phrase: 'Then', relation: 'sequence' },
  { phrase: 'Finally', relation: 'sequence' },
  { phrase: 'In summary', relation: 'summary' },
  { phrase: 'To summarize', relation: 'summary' },
  { phrase: 'For example', relation: 'example' }
];

const CONTRAST_CUES = /(không|chưa|hạn chế|nhược điểm|khác với|khác biệt|thay vì|trong khi|ngược|tuy|nhưng|lại|thách thức|vấn đề|khó khăn|đánh đổi|trade-?off|\bvs\b|however|but|unlike|instead|limitation|drawback)/i;
const CAUSE_CUES = /(vì|do|bởi|giúp|cho phép|khiến|dẫn đến|tạo ra|làm cho|nhờ|nên|bằng cách|cơ chế|because|since|allows|enables|causes|leads to|by )/i;

export interface SceneDiscourseContext {
  sceneId: string;
  role?: string;
  /** PROCESS / sequential list content licenses sequence connectives. */
  isSequential?: boolean;
  isChapterLastScene?: boolean;
}

export interface ConnectiveStats {
  sentences: number;
  connectivesBefore: number;
  connectivesKept: number;
  removed: { sceneId: string; phrase: string; reason: string }[];
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function matchLeadingConnective(sentence: string, lexicon: ConnectiveDef[]): { def: ConnectiveDef; rest: string } | null {
  const trimmed = sentence.trim();
  for (const def of lexicon) {
    const esc = def.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Also matches a sentence that is nothing but the filler ("Hãy thử hình dung ... nhé."): rest is then empty.
    const m = trimmed.match(new RegExp(`^${esc}(?:\\s*\\.\\.\\.|\\s*[,:.!?…])?(?:\\s+|$)`, 'i'));
    if (m) return { def, rest: trimmed.slice(m[0].length) };
  }
  return null;
}

function licensed(def: ConnectiveDef, sentence: string, prev: string | undefined, ctx: SceneDiscourseContext, addedInScene: number): string | null {
  const role = (ctx.role || '').toUpperCase();
  switch (def.relation) {
    case 'contrast':
      return CONTRAST_CUES.test(sentence) || (prev && CONTRAST_CUES.test(prev)) || role === 'COMPARISON' ? null : 'không có quan hệ đối lập trong nội dung';
    case 'result':
      return prev && CAUSE_CUES.test(prev) ? null : 'câu trước không nêu nguyên nhân/cơ chế';
    case 'addition':
      return addedInScene === 0 ? null : 'đã dùng từ nối bổ sung trong cảnh này';
    case 'sequence':
      return ctx.isSequential || role === 'PROCESS' ? null : 'nội dung không phải quy trình tuần tự';
    case 'summary':
      return role === 'SUMMARY' || ctx.isChapterLastScene ? null : 'chỉ dùng ở cảnh tổng kết';
    case 'example':
      return role === 'EXAMPLE' || /ví dụ|minh họa|trường hợp|example/i.test(sentence) ? null : 'không phải nội dung ví dụ';
    case 'filler':
      return 'từ nối đệm không mang nghĩa';
  }
}

/**
 * Applies the connective rules across all scenes (in lecture order).
 * Returns the rewritten texts plus statistics for the benchmark.
 */
export function applyConnectivePolicy(
  scenes: { text: string; ctx: SceneDiscourseContext }[],
  language: 'vi' | 'en' = 'vi'
): { texts: string[]; stats: ConnectiveStats } {
  const lexicon = language === 'en' ? CONNECTIVES_EN : CONNECTIVES_VI;
  const allSentences = scenes.map((s) => splitSentences(s.text));
  const totalSentences = allSentences.reduce((n, arr) => n + arr.length, 0);
  const lectureCap = Math.max(1, Math.floor(totalSentences * 0.25));
  const perPhraseCap = Math.max(1, Math.ceil(totalSentences / 15));

  const stats: ConnectiveStats = { sentences: totalSentences, connectivesBefore: 0, connectivesKept: 0, removed: [] };
  const lastUsedAt = new Map<string, number>();
  const usesPerPhrase = new Map<string, number>();
  let globalIdx = 0;
  let prevStartedWithConnective = false;

  const texts = scenes.map((scene, sIdx) => {
    const sentences = allSentences[sIdx];
    const sceneCap = Math.max(1, Math.floor(sentences.length / 3));
    let keptInScene = 0;
    let additionInScene = 0;
    prevStartedWithConnective = false;

    const out = sentences.map((sentence, i) => {
      const idx = globalIdx++;
      const hit = matchLeadingConnective(sentence, lexicon);
      if (!hit) {
        prevStartedWithConnective = false;
        return sentence;
      }
      stats.connectivesBefore++;
      const key = hit.def.phrase.toLowerCase();
      const prev = i > 0 ? sentences[i - 1] : undefined;
      const summaryOpener = i === 0 && hit.def.relation === 'summary' && (scene.ctx.role || '').toUpperCase() === 'SUMMARY';

      let reason: string | null = null;
      if (i === 0 && !summaryOpener) reason = 'không mở đầu cảnh bằng từ nối';
      else if (prevStartedWithConnective) reason = 'hai câu liên tiếp cùng mở đầu bằng từ nối';
      else if (keptInScene >= sceneCap) reason = 'vượt mật độ 1 từ nối / 3 câu trong cảnh';
      else if (stats.connectivesKept >= lectureCap) reason = 'vượt mật độ 25% toàn bài';
      else if (idx - (lastUsedAt.get(key) ?? -99) <= 5) reason = 'lặp lại trong 5 câu gần nhất';
      else if ((usesPerPhrase.get(key) || 0) >= perPhraseCap) reason = `đã dùng "${hit.def.phrase}" đủ ${perPhraseCap} lần`;
      else reason = licensed(hit.def, hit.rest, prev, scene.ctx, additionInScene);

      if (reason) {
        stats.removed.push({ sceneId: scene.ctx.sceneId, phrase: hit.def.phrase, reason });
        prevStartedWithConnective = false;
        return capitalize(hit.rest);
      }

      stats.connectivesKept++;
      keptInScene++;
      if (hit.def.relation === 'addition') additionInScene++;
      lastUsedAt.set(key, idx);
      usesPerPhrase.set(key, (usesPerPhrase.get(key) || 0) + 1);
      prevStartedWithConnective = true;
      return sentence;
    });

    return out.filter((x) => x.trim()).join(' ');
  });

  return { texts, stats };
}

/** Counts sentence-initial connectives (benchmark metric; no rewriting). */
export function countLeadingConnectives(text: string, language: 'vi' | 'en' = 'vi'): { sentences: number; connectives: number; byPhrase: Record<string, number> } {
  const lexicon = language === 'en' ? CONNECTIVES_EN : CONNECTIVES_VI;
  const byPhrase: Record<string, number> = {};
  let connectives = 0;
  const sentences = splitSentences(text);
  sentences.forEach((s) => {
    const hit = matchLeadingConnective(s, lexicon);
    if (hit) {
      connectives++;
      byPhrase[hit.def.phrase] = (byPhrase[hit.def.phrase] || 0) + 1;
    }
  });
  return { sentences: sentences.length, connectives, byPhrase };
}

// ---------------------------------------------------------------------------
// Heading repetition
// ---------------------------------------------------------------------------

export interface HeadingSpec {
  sceneId: string;
  sectionTitle: string;
  chapterId?: string;
  chapterTitle?: string;
  isChapterFirstPage?: boolean;
}

export interface HeadingStats {
  mentionsBefore: number;
  mentionsAfter: number;
  repeatsRemoved: number;
  sentencesDropped: number;
  details: { sceneId: string; heading: string; action: 'dropped_sentence' | 'replaced' }[];
}

const normalizeForMatch = (s: string) =>
  s
    .toLowerCase()
    .replace(/[“”"'`()[\]{}:;,.!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Titles too generic to police ("Slide 3", "Giới thiệu" alone is still policed if >= 2 words). */
function isPoliceableTitle(t: string): boolean {
  const n = normalizeForMatch(t);
  if (!n || /^(slide|trang|page)\s*\d+$/.test(n)) return false;
  return n.split(' ').length >= 2 || n.length >= 8;
}

const TRANSITION_ONLY = [
  /^(tiếp theo|kế tiếp|sau đây|bây giờ|ngay sau đây)?[, ]*(là phần|chúng ta (sẽ )?(cùng )?(bước sang|chuyển sang|đến với|tìm hiểu|phân tích|đi vào))\b/i,
  /^chúng ta cùng bước sang\b/i,
  /^(next|now),? (we )?(move|turn|go) (on )?to\b/i,
  /ngay sau đây\.?$/i
];

function isTransitionOnly(sentence: string, heading: string): boolean {
  const rest = normalizeForMatch(sentence).replace(normalizeForMatch(heading), '').trim();
  return TRANSITION_ONLY.some((p) => p.test(sentence.trim())) && rest.split(' ').length <= 12;
}

function replaceHeading(sentence: string, heading: string, reference: string): string {
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return sentence.replace(new RegExp(`["“]?${esc}["”]?`, 'i'), reference);
}

/**
 * Enforces heading mention limits across the lecture. Scenes are in order and aligned with `specs`.
 */
export function applyHeadingPolicy(
  texts: string[],
  specs: HeadingSpec[],
  opts: { maxSectionTitleMentions?: number; language?: 'vi' | 'en' } = {}
): { texts: string[]; stats: HeadingStats } {
  const maxSection = opts.maxSectionTitleMentions ?? 1;
  const isEn = opts.language === 'en';
  const stats: HeadingStats = { mentionsBefore: 0, mentionsAfter: 0, repeatsRemoved: 0, sentencesDropped: 0, details: [] };

  // Headings to police: every section title + every chapter title.
  type H = { text: string; ownerScene?: string; chapterId?: string; allowedScene?: string; max: number; used: number };
  const headings: H[] = [];
  specs.forEach((s) => {
    if (isPoliceableTitle(s.sectionTitle)) headings.push({ text: s.sectionTitle, ownerScene: s.sceneId, max: maxSection, used: 0 });
    if (s.chapterTitle && s.isChapterFirstPage && isPoliceableTitle(s.chapterTitle) && normalizeForMatch(s.chapterTitle) !== normalizeForMatch(s.sectionTitle)) {
      headings.push({ text: s.chapterTitle, chapterId: s.chapterId, allowedScene: s.sceneId, max: 1, used: 0 });
    }
  });
  // Longest first so "Mạng CNN cơ bản" is handled before "CNN cơ bản".
  headings.sort((a, b) => b.text.length - a.text.length);

  const out = texts.map((text, sIdx) => {
    const sceneId = specs[sIdx]?.sceneId;
    const kept: string[] = [];
    for (const sentence of splitSentences(text)) {
      let current = sentence;
      let drop = false;
      for (const h of headings) {
        const hn = normalizeForMatch(h.text);
        if (!normalizeForMatch(current).includes(hn)) continue;
        stats.mentionsBefore++;
        const inOwnScene = h.ownerScene ? h.ownerScene === sceneId : h.allowedScene === sceneId;
        if (inOwnScene && h.used < h.max) {
          h.used++;
          stats.mentionsAfter++;
          continue;
        }
        stats.repeatsRemoved++;
        if (isTransitionOnly(current, h.text)) {
          drop = true;
          stats.sentencesDropped++;
          stats.details.push({ sceneId, heading: h.text, action: 'dropped_sentence' });
          break;
        }
        const ownIdx = specs.findIndex((s) => s.sceneId === h.ownerScene);
        const reference = isEn
          ? ownIdx === sIdx ? 'this topic' : ownIdx > sIdx ? 'the next part' : 'the earlier part'
          : ownIdx === sIdx ? 'nội dung này' : ownIdx > sIdx ? 'phần tiếp theo' : 'phần trước';
        current = replaceHeading(current, h.text, reference);
        // The heading may have opened the sentence: "Các loại pooling bao gồm..." -> "Nội dung này bao gồm..."
        current = current.charAt(0).toLocaleUpperCase(isEn ? 'en' : 'vi') + current.slice(1);
        stats.details.push({ sceneId, heading: h.text, action: 'replaced' });
      }
      if (!drop) kept.push(current);
    }
    return kept.join(' ');
  });

  return { texts: out, stats };
}

/** Counts how many times each heading is spoken (benchmark metric; no rewriting). */
export function countHeadingMentions(texts: string[], specs: HeadingSpec[]): { mentions: number; repeated: number } {
  let mentions = 0;
  let repeated = 0;
  const titles = new Set<string>();
  specs.forEach((s) => {
    if (isPoliceableTitle(s.sectionTitle)) titles.add(normalizeForMatch(s.sectionTitle));
    if (s.chapterTitle && isPoliceableTitle(s.chapterTitle)) titles.add(normalizeForMatch(s.chapterTitle));
  });
  const all = texts.map(normalizeForMatch).join(' \n ');
  titles.forEach((t) => {
    const count = all.split(t).length - 1;
    mentions += count;
    if (count > 1) repeated += count - 1;
  });
  return { mentions, repeated };
}
