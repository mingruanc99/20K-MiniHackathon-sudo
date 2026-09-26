// src/pipeline/services/keywordExtractor.ts
/**
 * Weighted keyword extraction per page/slide (local, zero-LLM, <50 ms for 100 pages).
 *
 * - Vietnamese-aware tokenization: keeps diacritics, builds 1-3 syllable n-grams between stopwords
 *   (Vietnamese terms are multi-syllable: "mạng nơ-ron", "học sâu").
 * - Score = TF-IDF across pages x boosts (title, technical-term dictionary, OCR'd visuals, acronyms).
 * - Weights are normalized to 0..1 per page, then filtered by `minWeight` and capped at `maxPerPage`.
 * The dictionary is the same one the narration uses (technical_terms.json + project glossary),
 * so keywords and spoken terminology stay consistent.
 */
import { DocumentSection } from '../../types';
import { technicalTerminologyService } from './technicalTerminologyService';

export interface WeightedKeyword {
  term: string;
  weight: number;
  source: 'local' | 'llm' | 'user';
  /** 'focus' = added by study calibration (syllabus / quiz gaps). */
  kind?: 'concept' | 'term' | 'example' | 'formula' | 'entity' | 'focus';
}

export interface KeywordOptions {
  maxPerPage: number;
  minWeight: number;
}

const VI_STOP = new Set(
  (
    'và của là các có được cho trong với một những này đó khi để từ theo về như thì mà nên nhưng hay hoặc cũng đã sẽ đang ' +
    'rất nhiều ít hơn nhất vào ra lên xuống tại bởi vì nếu nào gì ai đâu sao bao không chưa chỉ còn lại đều cả ' +
    'mỗi mọi hết việc sự cái chiếc ta chúng tôi bạn họ nó mình đây kia ấy nào thêm qua trên dưới giữa ' +
    'sau trước bằng do nhằm cùng đến tới vậy tức dụ slide trang phần'
  ).split(/\s+/)
);

const EN_STOP = new Set(
  (
    'the a an and or of to in on for with by from as at is are was were be been being this that these those it its ' +
    'we you they he she our your their not no but if then than such can could will would should may might must ' +
    'do does did have has had using use used via into over under about between each which what when where who how ' +
    'all any some more most other also only just very page slide figure table'
  ).split(/\s+/)
);

const isStop = (tok: string) => VI_STOP.has(tok) || EN_STOP.has(tok) || /^\d+$/.test(tok) || tok.length < 2;

/** Splits text into lowercase tokens; keeps letters with diacritics, digits, and inner hyphens. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) || []).filter(Boolean);
}

/** Content tokens (stopwords and bare numbers removed) for similarity scoring. */
export function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => !isStop(t));
}

const hasDiacritic = (tok: string) => /[^\x00-\x7F]/.test(tok);

/** A Vietnamese syllable written without diacritics: onset + rhyme + final ("thao", "tin", "con", "nghia"). */
const VI_SYLLABLE = /^(ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|[bcdghklmnprstvx])?(uye|uya|uyu|ieu|yeu|uoi|uou|oai|oay|oeo|uay|uai|uau|ue|uy|oa|oe|oo|uo|ia|ie|ye|ua|ai|ao|au|ay|eo|eu|iu|oi|ui|uu|[aeiouy])(ch|ng|nh|[cmnpt])?$/;

/** Lowercased ASCII words written capitalized in the source ("Human", "Pose", "CNN"): English terms. */
function capitalizedLatin(text: string): Set<string> {
  // A capitalized word without diacritics can still be Vietnamese ("Thao tác", "So sánh", "Tin học"):
  // it counts as an English term only when it cannot be a Vietnamese syllable, is written like a term
  // (PyTorch, CNN) or is hyphenated (Top-Down).
  return new Set(
    (text.match(/\b[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*\b/g) || [])
      .filter((w) => /[A-Z].*[A-Z]|[0-9]|-/.test(w) || (w.length >= 3 && !VI_SYLLABLE.test(w.toLowerCase())))
      .map((w) => w.toLowerCase())
  );
}

/**
 * Candidate terms. A clause is cut into runs at stopwords and where English terms meet Vietnamese
 * syllables ("Giới thiệu về Human Pose Estimation Thị giác Máy tính" -> "giới thiệu" | "human pose
 * estimation" | "thị giác máy tính"), so no candidate glues pieces of two words together.
 *  - English runs: every 1-3 token n-gram (terms nest: "pose estimation" in "human pose estimation").
 *  - Vietnamese runs: the whole run when it has 2-4 syllables ("mạng nơ-ron tích chập"), plus its
 *    2-syllable compounds (most Vietnamese words), never a lone syllable.
 */
function candidates(text: string): string[] {
  const out: string[] = [];
  const latin = capitalizedLatin(text);
  const isEnglish = (t: string) => latin.has(t) && !hasDiacritic(t);
  // Split on punctuation first so candidates never cross clause boundaries.
  for (const clause of text.split(/[.,;:!?()\[\]{}"“”\n|→•&]+/)) {
    const runs: { en: boolean; toks: string[] }[] = [];
    for (const t of tokenize(clause)) {
      const last = runs[runs.length - 1];
      if (isStop(t)) {
        runs.push({ en: false, toks: [] });
        continue;
      }
      const en = isEnglish(t);
      if (last && last.toks.length && last.en === en) last.toks.push(t);
      else runs.push({ en, toks: [t] });
    }
    for (const { en, toks } of runs) {
      if (!toks.length) continue;
      if (en) {
        for (let i = 0; i < toks.length; i++) for (let n = 1; n <= 3 && i + n <= toks.length; n++) out.push(toks.slice(i, i + n).join(' '));
        continue;
      }
      if (toks.length >= 2 && toks.length <= 4) out.push(toks.join(' '));
      if (toks.length >= 3) for (let i = 0; i + 2 <= toks.length; i++) out.push(toks.slice(i, i + 2).join(' '));
      // Lowercase English words inside Vietnamese text ("kernel", "pooling") can stand alone.
      if (toks.length === 1 && !hasDiacritic(toks[0]) && toks[0].length >= 4) out.push(toks[0]);
    }
  }
  return out;
}

/** True when two n-grams overlap without one containing the other (sliding windows of one phrase). */
function partialOverlap(a: string, b: string): boolean {
  if (a.includes(b) || b.includes(a)) return false;
  const A = a.split(' ');
  const B = b.split(' ');
  for (let k = 1; k < Math.min(A.length, B.length) + 1; k++) {
    if (A.slice(-k).join(' ') === B.slice(0, k).join(' ') || B.slice(-k).join(' ') === A.slice(0, k).join(' ')) return true;
  }
  return false;
}

function displayForm(gram: string, original: string): string {
  const dict = technicalTerminologyService.getTermDictionary().get(gram);
  if (dict) return dict.canonical;
  // Recover original casing (acronyms like CNN, ReLU) from the source text.
  const esc = gram.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  const m = original.match(new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'iu'));
  return m ? m[0].replace(/\s+/g, ' ') : gram;
}

export interface PageText {
  section_id: string;
  title: string;
  body: string;
  /** Text read from tables/diagrams/charts on the page. */
  visualText?: string;
}

export function pageTextsFromSections(sections: DocumentSection[]): PageText[] {
  return sections.map((s) => ({
    section_id: s.section_id,
    title: s.title,
    body: s.elements
      .filter((e) => e.type !== 'title' && !e.region_id && e.type !== 'note')
      .map((e) => e.text)
      .join('\n'),
    visualText: s.elements
      .filter((e) => e.region_id && e.text)
      .map((e) => e.text)
      .join('\n')
  }));
}

/**
 * Extracts weighted keywords for every page. Returns a map section_id -> keywords (sorted desc).
 */
export function extractLocalKeywords(pages: PageText[], opts: KeywordOptions): Map<string, WeightedKeyword[]> {
  const dict = technicalTerminologyService.getTermDictionary();
  const df = new Map<string, number>();
  const pageGrams = pages.map((p) => {
    const titleGrams = new Set(candidates(p.title));
    const visualGrams = new Set(candidates(p.visualText || ''));
    const all = [...candidates(p.title), ...candidates(p.body), ...candidates(p.visualText || '')];
    const tf = new Map<string, number>();
    all.forEach((g) => tf.set(g, (tf.get(g) || 0) + 1));
    tf.forEach((_, g) => df.set(g, (df.get(g) || 0) + 1));
    return { tf, titleGrams, visualGrams, original: `${p.title}\n${p.body}\n${p.visualText || ''}` };
  });

  const N = Math.max(1, pages.length);
  const result = new Map<string, WeightedKeyword[]>();

  pages.forEach((p, idx) => {
    const { tf, titleGrams, visualGrams, original } = pageGrams[idx];
    const scored: { gram: string; score: number; count: number }[] = [];

    tf.forEach((count, gram) => {
      const nTok = gram.split(' ').length;
      const idf = Math.log(1 + N / (df.get(gram) || 1));
      let score = (1 + Math.log(count)) * idf * (1 + 0.35 * (nTok - 1)); // multi-syllable terms are more specific
      if (titleGrams.has(gram)) score *= 2.0;
      if (dict.has(gram)) score *= 1.8;
      if (visualGrams.has(gram)) score *= 1.2;
      if (/[A-Z]{2,}/.test(displayForm(gram, original))) score *= 1.3; // acronyms
      // A term that appears on almost every page is navigation/branding, not content.
      if (N >= 5 && (df.get(gram) || 0) / N > 0.7) score *= 0.2;
      scored.push({ gram, score, count });
    });

    scored.sort((a, b) => b.score - a.score);

    // Drop n-grams subsumed by a kept longer n-gram with the same frequency ("neural" inside "neural network").
    const kept: typeof scored = [];
    for (const s of scored) {
      const subsumed = kept.some((k) => k.gram.includes(s.gram) && k.count >= s.count);
      const subsumesKept = kept.findIndex((k) => s.gram.includes(k.gram) && s.count >= k.count);
      if (subsumed) continue;
      // A higher-scored window of the same phrase is already kept ("pose estimation thị" vs "human pose estimation").
      if (kept.some((k) => partialOverlap(k.gram, s.gram))) continue;
      if (subsumesKept >= 0 && s.score >= kept[subsumesKept].score * 0.6) kept.splice(subsumesKept, 1);
      kept.push(s);
      if (kept.length >= opts.maxPerPage * 3) break;
    }

    const max = kept[0]?.score || 1;
    const keywords = kept
      .map((k) => ({
        term: displayForm(k.gram, original),
        weight: Math.round((k.score / max) * 100) / 100,
        source: 'local' as const,
        kind: dict.has(k.gram) ? ('term' as const) : ('concept' as const)
      }))
      .filter((k) => k.weight >= opts.minWeight)
      .slice(0, opts.maxPerPage);

    result.set(p.section_id, keywords);
  });

  return result;
}

/** Merges LLM keywords (authoritative weights) with local ones (fill-ins), then re-filters. */
export function mergeKeywordLists(local: WeightedKeyword[], llm: WeightedKeyword[] | undefined, opts: KeywordOptions): WeightedKeyword[] {
  if (!llm?.length) return local.filter((k) => k.weight >= opts.minWeight).slice(0, opts.maxPerPage);
  const byTerm = new Map<string, WeightedKeyword>();
  llm.forEach((k) => byTerm.set(k.term.toLowerCase(), k));
  // Local terms the LLM missed are kept at a discount.
  local.forEach((k) => {
    const key = k.term.toLowerCase();
    if (!byTerm.has(key) && !Array.from(byTerm.keys()).some((t) => t.includes(key) || key.includes(t))) {
      byTerm.set(key, { ...k, weight: Math.round(k.weight * 0.7 * 100) / 100 });
    }
  });
  return Array.from(byTerm.values())
    .filter((k) => k.weight >= opts.minWeight)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, opts.maxPerPage);
}
