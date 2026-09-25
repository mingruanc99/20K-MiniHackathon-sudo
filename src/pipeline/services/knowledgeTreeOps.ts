// src/pipeline/services/knowledgeTreeOps.ts
/**
 * Pure (immutable) operations on the weighted knowledge tree.
 *
 * Duration semantics follow the kit/slide_to_video mind-map:
 * - editing a page sets it and re-sums every ancestor
 * - editing a chapter/document distributes its time down: locked children keep their value,
 *   the rest is split in proportion to their current durations (evenly if they are all equal),
 *   with a 5 s floor per child
 * - excluding a node frees its time; `rebalanceToTarget` hands it to the remaining unlocked pages
 *   so the lecture keeps its target length
 */
import { KnowledgeTree, KnowledgeTreeNode } from '../../types';
import { WeightedKeyword } from './keywordExtractor';

export const MIN_NODE_SEC = 5;

const isDurationNode = (n: KnowledgeTreeNode) => n.kind !== 'keyword';
const durationChildren = (n: KnowledgeTreeNode) => n.children.filter(isDurationNode);
/** A node can receive time only if it is not excluded and (for chapters) still has an active page. */
const isActive = (n: KnowledgeTreeNode): boolean => {
  if (n.excluded) return false;
  const kids = durationChildren(n);
  return kids.length === 0 || kids.some(isActive);
};

export function findNode(root: KnowledgeTreeNode, id: string): KnowledgeTreeNode | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

export function findParent(root: KnowledgeTreeNode, id: string): KnowledgeTreeNode | null {
  for (const c of root.children) {
    if (c.id === id) return root;
    const hit = findParent(c, id);
    if (hit) return hit;
  }
  return null;
}

function mapTree(node: KnowledgeTreeNode, fn: (n: KnowledgeTreeNode) => KnowledgeTreeNode): KnowledgeTreeNode {
  const mapped = fn(node);
  return { ...mapped, children: mapped.children.map((c) => mapTree(c, fn)) };
}

function cloneTree(node: KnowledgeTreeNode): KnowledgeTreeNode {
  return { ...node, children: node.children.map(cloneTree) };
}

/** Bottom-up: a structural node's duration is the sum of its active children. */
export function propagateUp(node: KnowledgeTreeNode): number {
  const kids = durationChildren(node);
  if (kids.length === 0) return node.excluded ? 0 : node.duration_sec || 0;
  let sum = 0;
  kids.forEach((k) => {
    const d = propagateUp(k);
    if (!k.excluded) sum += d;
  });
  node.duration_sec = sum;
  return node.excluded ? 0 : sum;
}

/** Top-down: splits `total` seconds across the active children of `node` (mutates the clone). */
function distributeDown(node: KnowledgeTreeNode, total: number) {
  node.duration_sec = Math.round(total);
  const kids = durationChildren(node).filter(isActive);
  if (kids.length === 0) return;

  const locked = kids.filter((k) => k.locked);
  const free = kids.filter((k) => !k.locked);
  const lockedSum = locked.reduce((s, k) => s + (k.duration_sec || 0), 0);
  const available = Math.max(free.length * MIN_NODE_SEC, total - lockedSum);
  if (free.length === 0) return;

  const current = free.map((k) => k.duration_sec || 0);
  const sumFree = current.reduce((a, b) => a + b, 0);
  const allEqual = current.every((v) => v === current[0]);

  let shares: number[];
  if (sumFree <= 0 || allEqual) {
    const base = Math.floor(available / free.length);
    let rem = available - base * free.length;
    shares = free.map(() => base + (rem-- > 0 ? 1 : 0));
  } else {
    shares = current.map((v) => Math.max(MIN_NODE_SEC, Math.round((v / sumFree) * available)));
    // Last child absorbs rounding so the parent total stays exact.
    const drift = available - shares.reduce((a, b) => a + b, 0);
    shares[shares.length - 1] = Math.max(MIN_NODE_SEC, shares[shares.length - 1] + drift);
  }

  free.forEach((k, i) => {
    if (durationChildren(k).length) distributeDown(k, shares[i]);
    else k.duration_sec = shares[i];
  });
}

export function setNodeDuration(tree: KnowledgeTree, id: string, seconds: number): KnowledgeTree {
  const root = cloneTree(tree.root);
  const node = findNode(root, id);
  if (!node || node.kind === 'keyword') return tree;
  const sec = Math.max(MIN_NODE_SEC, Math.round(seconds));
  if (durationChildren(node).length) distributeDown(node, sec);
  else node.duration_sec = sec;
  propagateUp(root);
  return touch({ ...tree, root, settings: { ...tree.settings, target_duration_sec: root.duration_sec || tree.settings.target_duration_sec } });
}

/** Keeps the document at `targetSec` by redistributing across unlocked, active nodes. */
export function rebalanceToTarget(tree: KnowledgeTree, targetSec = tree.settings.target_duration_sec): KnowledgeTree {
  const root = cloneTree(tree.root);
  distributeDown(root, targetSec);
  propagateUp(root);
  return touch({ ...tree, root, settings: { ...tree.settings, target_duration_sec: targetSec } });
}

export function toggleLock(tree: KnowledgeTree, id: string): KnowledgeTree {
  return touch({ ...tree, root: mapTree(tree.root, (n) => (n.id === id ? { ...n, locked: !n.locked } : n)) });
}

export function toggleExclude(tree: KnowledgeTree, id: string, keepTarget = true): KnowledgeTree {
  const next = touch({ ...tree, root: mapTree(tree.root, (n) => (n.id === id ? { ...n, excluded: !n.excluded } : n)) });
  const node = findNode(next.root, id);
  if (node?.kind === 'keyword') return next;
  return keepTarget ? rebalanceToTarget(next) : recompute(next);
}

export function recompute(tree: KnowledgeTree): KnowledgeTree {
  const root = cloneTree(tree.root);
  propagateUp(root);
  return { ...tree, root };
}

export function renameNode(tree: KnowledgeTree, id: string, title: string): KnowledgeTree {
  return touch({ ...tree, root: mapTree(tree.root, (n) => (n.id === id ? { ...n, title } : n)) });
}

export function setKeywordWeight(tree: KnowledgeTree, id: string, weight: number): KnowledgeTree {
  const w = Math.max(0, Math.min(1, Math.round(weight * 100) / 100));
  return touch({
    ...tree,
    root: mapTree(tree.root, (n) =>
      n.id === id && n.keyword ? { ...n, weight: w, keyword: { ...n.keyword, weight: w, source: 'user' } } : n
    )
  });
}

export function addKeyword(tree: KnowledgeTree, pageId: string, term: string, weight = 0.8): KnowledgeTree {
  const clean = term.trim();
  if (!clean) return tree;
  return touch({
    ...tree,
    root: mapTree(tree.root, (n) => {
      if (n.id !== pageId) return n;
      if (n.children.some((c) => c.keyword?.term.toLowerCase() === clean.toLowerCase())) return n;
      const kw: WeightedKeyword = { term: clean, weight, source: 'user', kind: 'concept' };
      return { ...n, children: [...n.children, keywordNode(pageId, kw, n.children.length)] };
    })
  });
}

export function removeKeyword(tree: KnowledgeTree, id: string): KnowledgeTree {
  const prune = (n: KnowledgeTreeNode): KnowledgeTreeNode => ({ ...n, children: n.children.filter((c) => c.id !== id).map(prune) });
  return touch({ ...tree, root: prune(tree.root) });
}

/** Re-applies the keyword weight threshold and per-page cap (UI sliders). */
export function applyKeywordFilter(tree: KnowledgeTree, minWeight: number, maxPerPage: number): KnowledgeTree {
  const next = mapTree(tree.root, (n) => {
    if (n.kind !== 'page') return n;
    const ranked = n.children
      .filter((c) => c.kind === 'keyword')
      .sort((a, b) => (b.weight || 0) - (a.weight || 0));
    return {
      ...n,
      children: ranked.map((c, i) => ({
        ...c,
        // User-added keywords are never filtered away automatically.
        excluded: c.keyword?.source === 'user' ? c.excluded : (c.weight || 0) < minWeight || i >= maxPerPage
      }))
    };
  });
  return touch({ ...tree, root: next, settings: { ...tree.settings, min_keyword_weight: minWeight, max_keywords_per_page: maxPerPage } });
}

export function keywordNode(pageId: string, kw: WeightedKeyword, idx: number): KnowledgeTreeNode {
  return {
    id: `${pageId}__kw${idx}_${kw.term.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 24)}`,
    kind: 'keyword',
    title: kw.term,
    weight: kw.weight,
    keyword: kw,
    children: []
  };
}

function touch(tree: KnowledgeTree): KnowledgeTree {
  return { ...tree, updated_at: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Tree -> pipeline
// ---------------------------------------------------------------------------

export interface TreePipelineOverrides {
  excludedSections: Set<string>;
  /** Seconds per section (only active sections). */
  sectionDurations: Record<string, number>;
  /** Active keywords per section, by descending weight. */
  sectionKeywords: Record<string, string[]>;
  /** Chapter membership, used to speak each chapter heading once, at its first page. */
  chapterOf: Record<string, { chapterId: string; chapterTitle: string; isFirstPage: boolean }>;
  totalDurationSec: number;
}

export function treeToPipelineOverrides(tree: KnowledgeTree): TreePipelineOverrides {
  const out: TreePipelineOverrides = {
    excludedSections: new Set(),
    sectionDurations: {},
    sectionKeywords: {},
    chapterOf: {},
    totalDurationSec: tree.root.duration_sec || tree.settings.target_duration_sec
  };

  const walk = (n: KnowledgeTreeNode, ancestorExcluded: boolean, chapter?: KnowledgeTreeNode) => {
    const excluded = ancestorExcluded || Boolean(n.excluded);
    if (n.kind === 'page' && n.section_id) {
      if (excluded) {
        out.excludedSections.add(n.section_id);
      } else {
        out.sectionDurations[n.section_id] = n.duration_sec || MIN_NODE_SEC;
        out.sectionKeywords[n.section_id] = n.children
          .filter((c) => c.kind === 'keyword' && !c.excluded)
          .sort((a, b) => (b.weight || 0) - (a.weight || 0))
          .map((c) => c.title);
        if (chapter) {
          const firstActive = chapter.children.find((c) => c.kind === 'page' && !c.excluded);
          out.chapterOf[n.section_id] = {
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            isFirstPage: firstActive?.id === n.id
          };
        }
      }
      return;
    }
    n.children.forEach((c) => walk(c, excluded, n.kind === 'chapter' ? n : chapter));
  };
  walk(tree.root, false);
  return out;
}
