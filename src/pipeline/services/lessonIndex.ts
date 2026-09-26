// src/pipeline/services/lessonIndex.ts
/**
 * Lesson index: every formula and definition of the whole document, with the page it first appears on.
 *
 * Built once per run from the document tree, domain- and language-independent (it only reads the
 * shapes the template composer already recognizes: "Term: definition" lines and formulas).
 *  - Narration (LLM): each page gets the entries from EARLIER pages that it mentions, so it can refer
 *    back ("như công thức ở trang 2") instead of re-defining or re-typesetting them.
 *  - Guard: a formula written on page 5 is grounded if it appears verbatim on any page of the lesson,
 *    not only on page 5.
 *  - Script export: definitions seed the review quizzes.
 */
import type { CanonicalDocumentTree, DocumentSection, LessonIndex, LessonIndexEntry } from '../../types';
import { analyzeLine } from '../module3_generator/templateComposer';
import { extractSourceFormulas, formulaKey, squash } from './formulaIntegrity';

export type { LessonIndex, LessonIndexEntry };

const FORMULA_LHS = /^(.{1,30}?)\s*(=|≈|←|\\leftarrow)\s*/;

function sectionLines(section: DocumentSection) {
  return (section.elements || [])
    .filter((e) => e.type !== 'title' && e.type !== 'note' && e.text)
    .flatMap((e) => e.text.split('\n').map((text) => ({ text, level: e.level ?? 2, type: e.type })));
}

export function buildLessonIndex(tree: Pick<CanonicalDocumentTree, 'sections'>, lang: 'vi' | 'en' = 'vi'): LessonIndex {
  const entries: LessonIndexEntry[] = [];
  const seenFormula = new Set<string>();
  const seenTerm = new Set<string>();
  const sections = [...tree.sections].sort((a, b) => a.order - b.order);
  sections.forEach((sec, i) => {
    const order = i + 1;
    for (const f of extractSourceFormulas(sec)) {
      const key = formulaKey(f);
      if (seenFormula.has(key)) continue;
      seenFormula.add(key);
      const lhs = f.replace(/^\$+|\$+$/g, '').match(FORMULA_LHS)?.[1]?.trim();
      entries.push({ kind: 'formula', text: f, term: lhs, section_id: sec.section_id, order });
    }
    for (const line of sectionLines(sec)) {
      const a = analyzeLine(line as any, lang);
      if (!a || a.shape !== 'definition' || !a.term || !a.body) continue;
      const term = a.term.trim();
      const key = term.toLowerCase();
      // Terms are names (short, not sentences); bodies are real explanations.
      if (seenTerm.has(key) || term.split(/\s+/).length > 5 || a.body.split(/\s+/).length < 3) continue;
      seenTerm.add(key);
      entries.push({ kind: 'definition', text: a.body.trim(), term, section_id: sec.section_id, order });
    }
  });
  return { entries };
}

const norm = (s: string) => s.normalize('NFC').toLowerCase();

/** Entries introduced before `order` that this page mentions (by term, or by a formula's left-hand side). */
export function referencedEarlierEntries(index: LessonIndex | undefined, section: DocumentSection | undefined, order: number, limit = 6): LessonIndexEntry[] {
  if (!index || !section) return [];
  const text = norm(section.raw_text || section.elements.map((e) => e.text).join('\n'));
  const flat = squash(text);
  return index.entries
    .filter((e) => e.order < order)
    .filter((e) => {
      if (e.kind === 'formula') {
        // A left-hand side of 3+ chars ("σ(z)", "J(θ)") is distinctive; a single letter only counts as "y =".
        const lhs = e.term ? squash(norm(e.term)) : '';
        return (lhs.length >= 3 ? flat.includes(lhs) : Boolean(lhs) && flat.includes(`${lhs}=`)) || flat.includes(squash(norm(e.text)));
      }
      return Boolean(e.term) && new RegExp(`(^|[^\\p{L}])${norm(e.term!).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u').test(text);
    })
    .slice(0, limit);
}

/** All formulas of the lesson, verbatim (guard grounding across pages). */
export function lessonFormulas(index: LessonIndex | undefined): string[] {
  return (index?.entries || []).filter((e) => e.kind === 'formula').map((e) => e.text);
}

/** Prompt block for the LLM: what earlier pages already established. */
export function lessonIndexPromptBlock(entries: LessonIndexEntry[]): string {
  if (!entries.length) return '';
  return `ALREADY INTRODUCED ON EARLIER PAGES (refer back briefly, do not re-define; formulas stay verbatim):
${entries.map((e) => (e.kind === 'formula' ? `- [page ${e.order}] formula: ${e.text}` : `- [page ${e.order}] ${e.term}: ${e.text}`)).join('\n')}`;
}
