// src/pipeline/services/studyCalibration.ts
/**
 * Re-weights the knowledge tree for exam review from a syllabus and quiz results.
 *
 *   final_p = α · slide_p + β · syllabus_p + γ · quizGap_p        (each term normalized to 0..1)
 *
 * slide_p     current share of lecture time of page p (what the deck itself emphasizes)
 * syllabus_p  best TF-IDF cosine between the page and a syllabus topic (+ bonus for its bold key terms)
 * quizGap_p   Σ gap.weight · similarity(page, gap): where the learner actually failed
 * Page durations are then set proportional to final_p (locked pages keep theirs) and the tree is
 * rebalanced to the same total length. Gaps matched to a page add "focus" keywords there; gaps that
 * match no page are reported (the deck does not cover them).
 * When an LLM is available it maps topics/gaps to pages as well, which helps when the syllabus is
 * Vietnamese and the slides are English; the stronger of the two scores wins.
 */
import { CanonicalDocumentTree, KnowledgeTree, KnowledgeTreeNode } from '../../types';
import { contentTokens } from './keywordExtractor';
import { keywordNode, propagateUp, rebalanceToTarget } from './knowledgeTreeOps';
import { StudySignals, QuizGap, SyllabusTopic } from './studySignals';
import { llmRouter } from '../../services/llm/LLMRouter';

export interface CalibrationWeights {
  slide: number;
  syllabus: number;
  quiz: number;
}

export const DEFAULT_CALIBRATION: CalibrationWeights = { slide: 0.4, syllabus: 0.3, quiz: 0.3 };

export interface PageChange {
  pageId: string;
  sectionId: string;
  title: string;
  before: number;
  after: number;
  reasons: string[];
}

export interface CalibrationResult {
  tree: KnowledgeTree;
  changes: PageChange[];
  unmatchedGaps: QuizGap[];
  unmatchedTopics: SyllabusTopic[];
  usedLLM: boolean;
}

type Vec = Map<string, number>;

function buildIdf(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  docs.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const n = docs.length || 1;
  const idf = new Map<string, number>();
  df.forEach((v, k) => idf.set(k, Math.log(1 + n / v)));
  return idf;
}

function vectorize(tokens: string[], idf: Map<string, number>): Vec {
  const v: Vec = new Map();
  tokens.forEach((t) => v.set(t, (v.get(t) || 0) + 1));
  v.forEach((tf, t) => v.set(t, (1 + Math.log(tf)) * (idf.get(t) ?? Math.log(2))));
  return v;
}

function cosine(a: Vec, b: Vec): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  a.forEach((x, k) => {
    na += x * x;
    const y = b.get(k);
    if (y) dot += x * y;
  });
  b.forEach((y) => (nb += y * y));
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function pagesOf(tree: KnowledgeTree): KnowledgeTreeNode[] {
  const out: KnowledgeTreeNode[] = [];
  const walk = (n: KnowledgeTreeNode, off: boolean) => {
    const ex = off || Boolean(n.excluded);
    if (n.kind === 'page') {
      if (!ex) out.push(n);
      return;
    }
    n.children.forEach((c) => walk(c, ex));
  };
  walk(tree.root, false);
  return out;
}

interface LlmMap {
  topics: Record<string, { section_id: string; relevance: number }[]>;
  gaps: Record<string, { section_id: string; relevance: number }[]>;
}

async function llmMapping(pages: { id: string; title: string; text: string }[], signals: StudySignals): Promise<LlmMap | null> {
  const provider = llmRouter.getOnlineProvider();
  if (!provider || !provider.hasApiKey()) return null;
  const topics = signals.syllabus?.topics.map((t) => ({ id: t.id, title: `${t.number ? t.number + ' ' : ''}${t.title}`, terms: t.keyTerms.slice(0, 6) })) || [];
  const gaps = signals.quiz?.gaps.map((g) => ({ id: g.id, label: g.label, terms: g.keyTerms })) || [];
  const prompt = `Map study items to the lecture pages that teach them.
PAGES:
${pages.map((p) => `${p.id}: ${p.title} — ${p.text.slice(0, 220)}`).join('\n')}

SYLLABUS TOPICS: ${JSON.stringify(topics)}
QUIZ GAPS (what the learner got wrong): ${JSON.stringify(gaps)}

For every topic and gap list at most 3 page ids that teach it, with relevance 0..1. Use [] when no page covers it.
Return JSON: {"topics":{"<topic id>":[{"section_id":"S1","relevance":0.8}]},"gaps":{"<gap id>":[{"section_id":"S2","relevance":0.9}]}}`;
  try {
    return await provider.generateJson<LlmMap>(prompt, 'You align course syllabi and quiz mistakes with lecture slides. Only map when the page really covers the item.', 'Study calibration: topic/gap mapping', {
      maxOutputTokens: 4000,
      temperature: 0,
      timeoutMs: 30000
    });
  } catch (err) {
    console.warn('LLM study mapping failed, using lexical similarity only:', err);
    return null;
  }
}

export async function calibrateWithStudySignals(
  tree: KnowledgeTree,
  docTree: CanonicalDocumentTree,
  signals: StudySignals,
  weights: CalibrationWeights = DEFAULT_CALIBRATION,
  opts: { useLLM?: boolean } = {}
): Promise<CalibrationResult> {
  const pages = pagesOf(tree);
  const secText = new Map(docTree.sections.map((s) => [s.section_id, `${s.title}\n${s.raw_text || ''}`]));
  const pageDocs = pages.map((p) => {
    const kw = p.children.filter((c) => c.kind === 'keyword').map((c) => c.title).join(' ');
    return contentTokens(`${p.title} ${p.title} ${secText.get(p.section_id || '') || ''} ${kw}`);
  });
  const topics = signals.syllabus?.topics || [];
  const gaps = signals.quiz?.gaps || [];
  const idf = buildIdf([...pageDocs, ...topics.map((t) => contentTokens(`${t.title} ${t.text}`)), ...gaps.map((g) => contentTokens(g.text))]);
  const pageVecs = pageDocs.map((d) => vectorize(d, idf));

  const llm = opts.useLLM === false ? null : await llmMapping(
    pages.map((p) => ({ id: p.section_id || p.id, title: p.title, text: (secText.get(p.section_id || '') || '').replace(/\s+/g, ' ') })),
    signals
  );
  const llmScore = (map: Record<string, { section_id: string; relevance: number }[]> | undefined, id: string, sectionId?: string) =>
    Math.max(0, ...(map?.[id] || []).filter((m) => m.section_id === sectionId).map((m) => Number(m.relevance) || 0));

  const pageTextLower = pages.map((p) => `${p.title} ${secText.get(p.section_id || '') || ''}`.toLowerCase());
  const reasons = pages.map(() => [] as { label: string; score: number }[]);

  // Syllabus coverage per page
  const syl = pages.map(() => 0);
  const topicHit = topics.map(() => 0);
  topics.forEach((t, ti) => {
    const tv = vectorize(contentTokens(`${t.title} ${t.title} ${t.text}`), idf);
    pages.forEach((p, pi) => {
      const termBonus = t.keyTerms.filter((k) => k.length > 2 && pageTextLower[pi].includes(k.toLowerCase())).length * 0.05;
      const s = Math.max(cosine(tv, pageVecs[pi]) + Math.min(0.3, termBonus), llmScore(llm?.topics, t.id, p.section_id));
      if (s > syl[pi]) syl[pi] = s;
      topicHit[ti] = Math.max(topicHit[ti], s);
      if (s >= 0.18) reasons[pi].push({ label: `Đề cương ${t.number || ''} ${t.title}`.replace(/\s+/g, ' ').trim(), score: s });
    });
  });

  // Quiz gaps per page
  const quiz = pages.map(() => 0);
  const gapHit = gaps.map(() => 0);
  const gapBest = gaps.map(() => -1);
  gaps.forEach((g, gi) => {
    const gv = vectorize(contentTokens(g.text), idf);
    pages.forEach((p, pi) => {
      const termHit = g.keyTerms.some((k) => k.length > 2 && pageTextLower[pi].includes(k.toLowerCase())) ? 0.25 : 0;
      const s = Math.max(cosine(gv, pageVecs[pi]) + termHit, llmScore(llm?.gaps, g.id, p.section_id));
      if (s >= 0.15) {
        quiz[pi] += g.weight * s;
        reasons[pi].push({ label: `Quiz sai: ${g.label}`, score: s * g.weight });
      }
      if (s > gapHit[gi]) {
        gapHit[gi] = s;
        gapBest[gi] = pi;
      }
    });
  });

  const norm = (xs: number[]) => {
    const m = Math.max(...xs, 0);
    return m > 0 ? xs.map((x) => x / m) : xs.map(() => 0);
  };
  const before = pages.map((p) => p.duration_sec || 0);
  const slideN = norm(before);
  const sylN = norm(syl);
  const quizN = norm(quiz);
  const wSum = (topics.length ? weights.syllabus : 0) + (gaps.length ? weights.quiz : 0) + weights.slide || 1;
  const final = pages.map(
    (_, i) => (weights.slide * slideN[i] + (topics.length ? weights.syllabus * sylN[i] : 0) + (gaps.length ? weights.quiz * quizN[i] : 0)) / wSum
  );

  // Apply: set page durations proportional to final (locked pages untouched), keep total.
  const target = tree.root.duration_sec || tree.settings.target_duration_sec;
  const clone = (n: KnowledgeTreeNode): KnowledgeTreeNode => ({ ...n, children: n.children.map(clone) });
  const root = clone(tree.root);
  const byId = new Map<string, KnowledgeTreeNode>();
  const index = (n: KnowledgeTreeNode) => {
    byId.set(n.id, n);
    n.children.forEach(index);
  };
  index(root);

  pages.forEach((p, i) => {
    const node = byId.get(p.id)!;
    if (!node.locked) node.duration_sec = Math.max(5, Math.round(final[i] * 1000));
  });
  // Focus keywords from matched gaps
  gaps.forEach((g, gi) => {
    if (gapBest[gi] < 0 || gapHit[gi] < 0.2) return;
    const node = byId.get(pages[gapBest[gi]].id)!;
    g.keyTerms.slice(0, 3).forEach((term) => {
      if (node.children.some((c) => c.kind === 'keyword' && c.title.toLowerCase() === term.toLowerCase())) return;
      node.children = [...node.children, keywordNode(node.id, { term, weight: 0.95, source: 'user', kind: 'focus' }, node.children.length)];
    });
  });
  propagateUp(root);
  let next: KnowledgeTree = rebalanceToTarget({ ...tree, root }, target);
  next = {
    ...next,
    calibration: {
      syllabus: signals.syllabus?.fileName,
      quiz: signals.quiz?.fileName,
      weights,
      applied_at: new Date().toISOString(),
      used_llm: Boolean(llm)
    }
  };

  const afterById = new Map<string, number>();
  const collect = (n: KnowledgeTreeNode) => {
    if (n.kind === 'page') afterById.set(n.id, n.duration_sec || 0);
    n.children.forEach(collect);
  };
  collect(next.root);

  const changes = pages
    .map((p, i) => ({
      pageId: p.id,
      sectionId: p.section_id || '',
      title: p.title,
      before: before[i],
      after: afterById.get(p.id) || 0,
      reasons: reasons[i].sort((a, b) => b.score - a.score).slice(0, 3).map((r) => r.label)
    }))
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before));

  return {
    tree: next,
    changes,
    unmatchedGaps: gaps.filter((_, gi) => gapHit[gi] < 0.15),
    unmatchedTopics: topics.filter((_, ti) => topicHit[ti] < 0.12 && topics[ti].level <= 2),
    usedLLM: Boolean(llm)
  };
}
