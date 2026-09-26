// src/pipeline/services/contentDuration.ts
/**
 * Full-content duration: how long it takes to present everything on a page.
 *
 * "100% coverage" is measured, not guessed: each page is rendered by the same template composer the
 * zero-LLM narration uses (page lines, read tables/diagrams, table row readouts) plus its speaker
 * notes, and the spoken words are converted to seconds at the lecture's WPM, with a short pause per
 * sentence (the prosody planner's typical sentence-boundary pause). A lecture at X% coverage gives
 * each page X% of its full length (before any manual nudges or study calibration).
 *
 * Minimum (template engine): the page's first sentence, at least 15 words, plus ~2.5 s of scene
 * overhead; below the sum of these the template lecture runs longer than the target.
 *
 * Floors: a page with (almost) nothing to say, e.g. a title or thank-you slide, gets 5 s for the
 * transition; any page with content gets at least 10 s.
 */
import { CanonicalDocumentTree, DocumentSection, KnowledgeTree, KnowledgeTreeNode, UserConfiguration, VisualRegion } from '../../types';
import { composePage, Lang, SourceLine, VisualReading } from '../module3_generator/templateComposer';
import { regionReadingText } from '../module1_extractor/visualRegionOcr';
import { MIN_NODE_SEC, rebalanceToTarget, toggleExclude } from './knowledgeTreeOps';

export const COVERAGE_PRESETS = [0.25, 0.5, 0.75, 1, 1.25];

const PAUSE_PER_SENTENCE_SEC = 0.5;
const DECORATIVE_SEC = 5;
const MIN_CONTENT_SEC = 10;
/** The narration generator never budgets a scene below 15 words. */
const MIN_SCENE_WORDS = 15;
/** Scene-boundary pause and opening that every generated scene carries (measured on the fixture decks). */
const SCENE_OVERHEAD_SEC = 2.5;
/**
 * Spoken framing a lecturer adds around a page (a bridge into it, a guiding question or a takeaway):
 * about one sentence. Without it the whole length goes to reading the slide text and the narration can
 * only recite it (templateScriptWriter fills this room; the LLM uses it to explain).
 */
const FRAMING_SEC = 8;

const NON_BODY = new Set(['title', 'note', 'table', 'diagram', 'image']);
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => (s.match(/[.!?](\s|$)/g) || []).length || (s.trim() ? 1 : 0);

export interface PageContentEstimate {
  section_id: string;
  words: number;
  sentences: number;
  full_sec: number;
  /** Shortest the template engine can make the page: its first sentence (it never drops a page's only sentence). */
  min_sec: number;
  decorative: boolean;
}

function pageLines(sec: DocumentSection): SourceLine[] {
  const titleKey = sec.title.trim().toLowerCase();
  const fromElements = sec.elements
    .filter((e) => !NON_BODY.has(e.type) && !e.region_id && e.text?.trim())
    .flatMap((e) => e.text.split('\n').map((text) => ({ text: e.type === 'heading' && !/:\s*$/.test(text) ? `${text}:` : text, level: e.level ?? 2, type: e.type })));
  const lines = fromElements.length ? fromElements : (sec.raw_text || '').split('\n').map((text) => ({ text, level: 0 }));
  return lines.filter((l) => l.text.trim() && l.text.trim().toLowerCase() !== titleKey);
}

export function estimatePageContent(
  sec: DocumentSection,
  regions: VisualRegion[],
  opts: { wpm: number; lang: Lang }
): PageContentEstimate {
  const visuals: VisualReading[] = regions
    .filter((r) => r.section_id === sec.section_id && !r.excluded && r.ocr?.status === 'done' && !r.ocr.is_decorative)
    .map((r) => ({ kind: r.ocr?.content_type || r.kind, text: regionReadingText(r), summary: r.ocr?.summary }))
    .filter((v) => v.text || v.summary);
  const composed = composePage(pageLines(sec), visuals, { lang: opts.lang, sceneKey: sec.section_id, used: new Set(), title: sec.title });
  const notes = sec.elements.filter((e) => e.type === 'note').map((e) => e.text);
  const spoken = [...composed.body, ...composed.visuals, ...composed.extras, ...notes].join(' ');
  const w = words(spoken);
  const s = sentences(spoken);
  const decorative = w < 6;
  const secOf = (text: string) => (words(text) / Math.max(60, opts.wpm)) * 60 + sentences(text) * PAUSE_PER_SENTENCE_SEC;
  const raw = secOf(spoken);
  const full = decorative ? DECORATIVE_SEC : Math.max(MIN_CONTENT_SEC, Math.round(raw + FRAMING_SEC));
  const first = [...composed.body, ...composed.visuals][0] || '';
  return {
    section_id: sec.section_id,
    words: w,
    sentences: s,
    full_sec: full,
    min_sec: decorative
      ? DECORATIVE_SEC
      : Math.min(full, Math.round(Math.max(secOf(first), (MIN_SCENE_WORDS / Math.max(60, opts.wpm)) * 60) + SCENE_OVERHEAD_SEC)),
    decorative
  };
}

export function estimateDocumentContent(doc: CanonicalDocumentTree, config: Pick<UserConfiguration, 'targetWpm' | 'language' | 'narration_language'>): Map<string, PageContentEstimate> {
  const lang: Lang = (config.narration_language || config.language) === 'en' ? 'en' : 'vi';
  const wpm = config.targetWpm || 140;
  const regions = doc.visual_regions || [];
  return new Map(doc.sections.map((s) => [s.section_id, estimatePageContent(s, regions, { wpm, lang })]));
}

// ---------------------------------------------------------------------------
// Coverage on the knowledge tree
// ---------------------------------------------------------------------------
const pagesOf = (node: KnowledgeTreeNode, parentExcluded = false): { page: KnowledgeTreeNode; active: boolean }[] =>
  node.kind === 'page'
    ? [{ page: node, active: !parentExcluded && !node.excluded }]
    : node.children.flatMap((c) => (c.kind === 'keyword' ? [] : pagesOf(c, parentExcluded || Boolean(node.excluded))));

/** Seconds needed to present all content of the pages that are still switched on. Null if unknown. */
export function fullDurationOf(tree: KnowledgeTree): number | null {
  const pages = pagesOf(tree.root);
  if (!pages.length || pages.some((p) => typeof p.page.full_sec !== 'number')) return null;
  return pages.filter((p) => p.active).reduce((s, p) => s + (p.page.full_sec || 0), 0);
}

/**
 * Lowest coverage the template engine can honour (every active page keeps one sentence), or null.
 * Below it the template lecture runs longer than the target; the LLM engine or switching pages off helps.
 */
export function minTemplateCoverage(tree: KnowledgeTree): number | null {
  const full = fullDurationOf(tree);
  const active = pagesOf(tree.root).filter((p) => p.active);
  if (!full || active.some((p) => typeof p.page.min_sec !== 'number')) return null;
  return active.reduce((s, p) => s + (p.page.min_sec || 0), 0) / full;
}

/** Current lecture length as a share of the full content length (null for trees without estimates). */
export function currentCoverage(tree: KnowledgeTree): number | null {
  const full = fullDurationOf(tree);
  return full ? (tree.root.duration_sec || 0) / full : null;
}

/** Fills `full_sec` on pages of trees built before content estimates existed. */
export function withContentEstimates(tree: KnowledgeTree, doc: CanonicalDocumentTree, config: Pick<UserConfiguration, 'targetWpm' | 'language' | 'narration_language'>): KnowledgeTree {
  if (fullDurationOf(tree) !== null) return tree;
  const est = estimateDocumentContent(doc, config);
  const fill = (n: KnowledgeTreeNode): KnowledgeTreeNode => ({
    ...n,
    full_sec: n.kind === 'page' && n.section_id ? est.get(n.section_id)?.full_sec ?? n.full_sec : n.full_sec,
    min_sec: n.kind === 'page' && n.section_id ? est.get(n.section_id)?.min_sec ?? n.min_sec : n.min_sec,
    children: n.children.map(fill)
  });
  return { ...tree, root: fill(tree.root) };
}

/**
 * Sizes the lecture to `coverage` x the full content length of the active pages. Pages keep their
 * current proportions (content share, plus any nudges or study calibration); locked pages keep their time.
 */
export function setCoverage(tree: KnowledgeTree, coverage: number): KnowledgeTree {
  const full = fullDurationOf(tree);
  if (!full) return tree;
  const next = rebalanceToTarget(tree, Math.max(MIN_NODE_SEC, Math.round(full * coverage)));
  return { ...next, settings: { ...next.settings, coverage } };
}

/**
 * Switching a page/chapter off or on under a coverage setting changes the lecture length with it
 * (75% of less content is less time); trees sized in minutes keep their total instead.
 */
export function toggleExcludeKeepingCoverage(tree: KnowledgeTree, id: string): KnowledgeTree {
  const coverage = tree.settings.coverage;
  if (!coverage || fullDurationOf(tree) === null) return toggleExclude(tree, id);
  return setCoverage(toggleExclude(tree, id, false), coverage);
}
