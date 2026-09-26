// src/pipeline/services/boilerplate.ts
/**
 * Removes template boilerplate: a line that repeats on many pages with only its numbers changed
 * ("Tổng quan nội dung phần 3: Cơ sở lý thuyết và ứng dụng thực tiễn.", footers, course codes).
 * It says nothing about the page, and narrating it once per page makes the lecture read like a template.
 *
 * Topic-agnostic: a line counts as boilerplate when its digit-normalized form appears on at least
 * MIN_PAGES pages and on at least MIN_SHARE of all pages. Titles, notes and visual-region readings
 * are never removed.
 */
import type { CanonicalDocumentTree } from '../../types';

const MIN_PAGES = 3;
const MIN_SHARE = 0.4;

const shape = (text: string) =>
  text
    .normalize('NFC')
    .toLowerCase()
    .replace(/\d+/g, '#')
    .replace(/[^\p{L}#]+/gu, ' ')
    .trim();

export function dropBoilerplate(tree: CanonicalDocumentTree): { tree: CanonicalDocumentTree; removed: string[] } {
  const pages = tree.sections.length;
  if (pages < MIN_PAGES) return { tree, removed: [] };
  const pagesByShape = new Map<string, Set<string>>();
  for (const sec of tree.sections) {
    for (const el of sec.elements) {
      if (el.type === 'title' || el.type === 'note' || el.region_id || !el.text) continue;
      const key = shape(el.text);
      if (key.split(' ').length < 3) continue; // short labels ("Ví dụ", "#") are content markers, not boilerplate
      pagesByShape.set(key, (pagesByShape.get(key) || new Set()).add(sec.section_id));
    }
  }
  const boiler = new Set(
    Array.from(pagesByShape.entries())
      .filter(([, secs]) => secs.size >= MIN_PAGES && secs.size / pages >= MIN_SHARE)
      .map(([key]) => key)
  );
  if (!boiler.size) return { tree, removed: [] };

  const removed = new Set<string>();
  const sections = tree.sections.map((sec) => {
    const elements = sec.elements.filter((el) => {
      const drop = !(el.type === 'title' || el.type === 'note' || el.region_id) && boiler.has(shape(el.text || ''));
      if (drop) removed.add(el.text);
      return !drop;
    });
    if (elements.length === sec.elements.length) return sec;
    return {
      ...sec,
      elements,
      raw_text: elements
        .filter((e) => e.text)
        .map((e) => (e.type === 'note' ? `[Note: ${e.text}]` : e.text))
        .join('\n')
    };
  });
  return { tree: { ...tree, sections }, removed: Array.from(removed) };
}
