// src/pipeline/services/formulaIntegrity.ts
/**
 * Formula integrity: symbols and LaTeX from the source must reach the lecture character for character.
 *
 *  - Source formulas of a section = equation elements (incl. OCR'd formula regions) + inline/display
 *    LaTeX ($..$, $$..$$, \(..\), \[..\]) + "a = f(b)" lines with math symbols.
 *    They become the scene's on-screen `formulas`, verbatim.
 *  - In the narration, a formula may be described in words, but any span written with math symbols
 *    must appear verbatim in the section source. A span that matches a source formula up to spacing,
 *    dash/multiplication variants or LaTeX-vs-Unicode spelling is repaired to the source spelling;
 *    anything else is reported as an altered/invented formula.
 */
import type { DocumentSection } from '../../types';

/** Operators, arrows, calculus/set marks, Greek letters, LaTeX commands, TeX delimiters. */
const MATH_MARK = /[=≈≠≤≥←→⇒⇔∇∑∏∫√∂±×÷∈∉⊂∀∃∞^_$αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΦΨΩ]|\\[a-zA-Z]+/;
const TEX_INLINE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;

/** Whitespace-insensitive, NFC. The only normalization "verbatim" allows. */
export const squash = (s: string) => s.normalize('NFC').replace(/\s+/g, '');

const TEX_TO_UNICODE: [RegExp, string][] = [
  [/\\leftarrow|\\gets/g, '←'], [/\\rightarrow|\\to/g, '→'], [/\\Rightarrow/g, '⇒'], [/\\nabla/g, '∇'], [/\\sum/g, '∑'],
  [/\\prod/g, '∏'], [/\\int/g, '∫'], [/\\sqrt/g, '√'], [/\\partial/g, '∂'], [/\\times|\\cdot/g, '×'], [/\\pm/g, '±'],
  [/\\leq?/g, '≤'], [/\\geq?/g, '≥'], [/\\neq?/g, '≠'], [/\\approx/g, '≈'], [/\\in/g, '∈'], [/\\infty/g, '∞'],
  [/\\alpha/g, 'α'], [/\\beta/g, 'β'], [/\\gamma/g, 'γ'], [/\\delta/g, 'δ'], [/\\epsilon|\\varepsilon/g, 'ε'], [/\\eta/g, 'η'],
  [/\\theta/g, 'θ'], [/\\lambda/g, 'λ'], [/\\mu/g, 'μ'], [/\\pi/g, 'π'], [/\\sigma/g, 'σ'], [/\\phi|\\varphi/g, 'φ'], [/\\omega/g, 'ω'],
  [/\\Delta/g, 'Δ'], [/\\Sigma/g, 'Σ'], [/\\Theta/g, 'Θ'], [/\\Omega/g, 'Ω']
];

/**
 * Loose key used only to recognize the same formula written differently (never for acceptance):
 * TeX commands -> Unicode, dash/multiply variants unified, braces/$/spaces dropped, lower-cased.
 */
export function formulaKey(s: string): string {
  let t = s.normalize('NFC');
  for (const [re, u] of TEX_TO_UNICODE) t = t.replace(re, u);
  return t
    .replace(/\\(left|right|mathrm|mathbf|text|operatorname)\b/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/[*·⋅]/g, '×')
    .replace(/[{}$\s]/g, '')
    .toLowerCase();
}

export function isMathy(s: string): boolean {
  return MATH_MARK.test(s);
}

/** Verbatim formulas of a section, in document order, de-duplicated. */
export function extractSourceFormulas(section?: Pick<DocumentSection, 'elements' | 'raw_text'>): string[] {
  if (!section) return [];
  const out: string[] = [];
  const push = (f: string) => {
    const t = f.trim();
    if (t.length >= 3 && isMathy(t) && !out.some((o) => squash(o) === squash(t))) out.push(t);
  };
  for (const el of section.elements || []) {
    const text = (el.text || '').trim();
    if (!text) continue;
    let hadTex = false;
    for (const m of text.matchAll(TEX_INLINE)) {
      hadTex = true;
      push(m[0]);
    }
    if (hadTex) continue;
    if (el.type === 'equation') {
      text.split('\n').forEach(push);
      continue;
    }
    // "a = f(b)" lines: short, one relation sign, and more math than prose.
    for (const line of text.split('\n')) {
      const l = line.replace(/^[•●○◦▪■►\-*+–—\d.)\s]+/, '').trim();
      const words = l.split(/\s+/).filter((w) => /\p{L}{3,}/u.test(w) && !isMathy(w)).length;
      const mathBody = isMathy(l.replace(/=/g, '')) || /(^|[^\p{L}])\p{L}\([\p{L}\p{N}_,\s]{1,12}\)/u.test(l); // f(x), g(z)
      if (l.length <= 120 && /[=≈←]/.test(l) && mathBody && words <= 4) push(l.replace(/^[^:=]{1,40}:\s*(?=\S+\s*=)/u, ''));
    }
  }
  return out;
}

export interface FormulaSpan {
  text: string;
  start: number;
  end: number;
}

/** Math-written spans of a narration: runs of mathy tokens, bridged by short operand/operator tokens. */
export function findFormulaSpans(narration: string): FormulaSpan[] {
  const tokens = Array.from(narration.matchAll(/\S+/g)).map((m) => ({ text: m[0], start: m.index!, end: m.index! + m[0].length }));
  const spans: FormulaSpan[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!isMathy(tokens[i].text)) {
      i++;
      continue;
    }
    // Short operand/operator tokens ("x", "+", "b'", "1)") can sit inside a formula but are not math alone.
    const isBridge = (t: string) => t.length <= 4 && /^[\p{L}\p{N}()[\]+\-−*/|,.'’]+$/u.test(t) && !/^\(?\p{L}{2,}[),.]?$/u.test(t);
    // "L = ..." : take the left operand too.
    if (i > 0 && /^[=≈←]/.test(tokens[i].text) && isBridge(tokens[i - 1].text) && !(spans.length && spans[spans.length - 1].end >= tokens[i - 1].start)) i--;
    let j = i;
    while (j + 1 < tokens.length) {
      if (isMathy(tokens[j + 1].text)) {
        j++;
        continue;
      }
      // Up to 3 bridges, absorbed when math follows them or when the span ends on an operator that needs an operand.
      let k = j + 1;
      while (k < tokens.length && k - j <= 3 && isBridge(tokens[k].text)) k++;
      const bridged = k - j - 1;
      if (!bridged) break;
      if (k < tokens.length && isMathy(tokens[k].text)) j = k;
      else if (/[=+\-−×*/←→≤≥≈]$/.test(tokens[j].text) || /^[+\-−×*/]$/.test(tokens[j + 1].text)) j = k - 1;
      else break;
    }
    const raw = narration.slice(tokens[i].start, tokens[j].end);
    const lead = raw.match(/^["“'‘]*/)![0].length;
    const text = raw.slice(lead).replace(/["”,.;:!?]+$/, ''); // keep primes: W'x + b'
    const start = tokens[i].start + lead;
    spans.push({ text, start, end: start + text.length });
    i = j + 1;
  }
  return spans;
}

export interface FormulaCheck {
  text: string;
  repaired: { from: string; to: string }[];
  altered: string[];
  spans: number;
}

/**
 * Keeps verbatim spans, rewrites near-miss spans to the source spelling, and reports the rest.
 * `source` is the whole section text (so symbols quoted mid-sentence on the slide are accepted).
 */
export function enforceFormulaIntegrity(narration: string, source: string, sourceFormulas: string[]): FormulaCheck {
  const src = squash(source);
  const byKey = new Map(sourceFormulas.map((f) => [formulaKey(f), f]));
  const repaired: { from: string; to: string }[] = [];
  const altered: string[] = [];
  const spans = findFormulaSpans(narration);
  let text = narration;
  for (const span of [...spans].reverse()) {
    if (src.includes(squash(span.text))) continue;
    const key = formulaKey(span.text);
    const match = byKey.get(key) || sourceFormulas.find((f) => formulaKey(f).includes(key) && key.length >= 5 && formulaKey(f).length - key.length <= 2);
    if (match) {
      text = text.slice(0, span.start) + match + text.slice(span.end);
      repaired.push({ from: span.text, to: match });
    } else {
      altered.push(span.text);
    }
  }
  return { text, repaired: repaired.reverse(), altered: altered.reverse(), spans: spans.length };
}

/** Share of source formulas the model copied verbatim into its `formulas` list. */
export function formulaCopyFidelity(modelFormulas: string[] | undefined, sourceFormulas: string[]): { copied: number; total: number } {
  const given = new Set((modelFormulas || []).map(squash));
  return { copied: sourceFormulas.filter((f) => given.has(squash(f))).length, total: sourceFormulas.length };
}
