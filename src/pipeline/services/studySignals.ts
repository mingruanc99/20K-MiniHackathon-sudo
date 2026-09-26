// src/pipeline/services/studySignals.ts
/**
 * Parsers for the two study signals used to re-weight a lecture for review (ôn luyện):
 *  - a syllabus / outline (đề cương): DOCX, Markdown or plain text
 *  - quiz results: the "QUIZ_RESULTS_AND_ANALYSIS_EXPORT" Markdown (summary table, weak areas,
 *    ```json missed questions), a bare JSON export, or plain text lists of missed questions
 * Parsing is rule-based and local; nothing is sent anywhere.
 */
import JSZip from 'jszip';

export interface SyllabusTopic {
  id: string;
  /** "1", "1.2", ... when numbered. */
  number?: string;
  title: string;
  level: number;
  text: string;
  /** Bold / emphasized terms inside the topic (docx runs with <w:b/>, **md**). */
  keyTerms: string[];
}

export interface QuizGap {
  id: string;
  label: string;
  /** Question + correct answer + analysis (or weak-area bullets): what the learner got wrong. */
  text: string;
  /** Short terms worth adding as focus keywords (code identifiers, concept names). */
  keyTerms: string[];
  /** Error mass: 1 per missed question, scaled by how badly that quiz went. */
  weight: number;
  source: 'weak_area' | 'missed_question';
}

export interface StudySignals {
  syllabus?: { fileName: string; topics: SyllabusTopic[] };
  quiz?: { fileName: string; averageScore?: number; quizzes: { title: string; score?: number; category?: string }[]; gaps: QuizGap[] };
}

const NUMBERED = /^(\d+(?:\.\d+)*)[.)]?\s+(.{2,160})$/;

/** Splits "…ma trận:1.2. Thuật toán Euclidean…" into separate numbered chunks. */
function splitInlineNumbering(text: string): string[] {
  return text
    .replace(/([^\d\s.])\s*(\d+\.\d+\.)\s+/g, '$1\n$2 ')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function topicsFromLines(lines: { text: string; heading?: number; bold?: string[] }[]): SyllabusTopic[] {
  const topics: SyllabusTopic[] = [];
  let cur: SyllabusTopic | null = null;
  const open = (title: string, level: number, number?: string) => {
    cur = { id: `t${topics.length + 1}`, number, title: title.replace(/[:：]\s*$/, '').trim(), level, text: '', keyTerms: [] };
    topics.push(cur);
  };
  for (const line of lines) {
    for (const piece of splitInlineNumbering(line.text)) {
      const m = piece.match(NUMBERED);
      const firstChunk = piece === splitInlineNumbering(line.text)[0];
      if (line.heading && firstChunk) {
        const num = piece.match(NUMBERED);
        open(num ? num[2] : piece, line.heading, num?.[1]);
      } else if (m && m[2].length < 120 && /^[A-ZÀ-Ỹa-zà-ỹ]/.test(m[2])) {
        // "1.1. Đại số tuyến tính và Ma trận  Dữ liệu và…": title is up to the double space / colon.
        const [title, ...rest] = m[2].split(/\s{2,}|:\s/);
        open(title, m[1].split('.').length, m[1]);
        if (rest.length && cur) (cur as SyllabusTopic).text += `${rest.join(' ')} `;
      } else if (cur) {
        (cur as SyllabusTopic).text += `${piece} `;
      } else {
        open('Giới thiệu', 1);
        (cur as unknown as SyllabusTopic).text += `${piece} `;
      }
    }
    if (cur && line.bold?.length) {
      const c = cur as SyllabusTopic;
      c.keyTerms.push(...line.bold.filter((b) => b.length > 1 && b.length < 60));
    }
  }
  const cleaned = topics
    .map((t) => ({ ...t, text: t.text.trim(), keyTerms: Array.from(new Set(t.keyTerms.map((k) => k.replace(/[:：]\s*$/, '').trim()).filter(Boolean))) }))
    .filter((t) => t.title || t.text);
  // The document's own title ("# Đề cương ôn tập cuối kỳ" with the chapters below it) is not a topic.
  const first = cleaned[0];
  if (first && cleaned.length > 1 && !first.text && !first.keyTerms.length && cleaned[1].level > first.level) return cleaned.slice(1);
  return cleaned;
}

async function parseDocx(buf: ArrayBuffer): Promise<SyllabusTopic[]> {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml')?.async('text');
  if (!xml) throw new Error('File .docx không có word/document.xml');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const paras = Array.from(doc.getElementsByTagNameNS('*', 'p'));
  const lines = paras.map((p) => {
    const style = Array.from(p.getElementsByTagNameNS('*', 'pStyle'))[0]?.getAttribute('w:val') || '';
    const heading = /heading\s*(\d)|^Heading(\d)|^Title$/i.exec(style);
    const runs = Array.from(p.getElementsByTagNameNS('*', 'r'));
    const bold: string[] = [];
    const text = runs
      .map((r) => {
        const t = Array.from(r.getElementsByTagNameNS('*', 't')).map((x) => x.textContent || '').join('');
        const rPr = Array.from(r.children).find((c) => c.localName === 'rPr');
        if (rPr && Array.from(rPr.children).some((c) => c.localName === 'b' && c.getAttribute('w:val') !== '0') && t.trim()) bold.push(t.trim());
        return t;
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    return { text, heading: heading ? Number(heading[1] || heading[2] || 1) : undefined, bold };
  });
  return topicsFromLines(lines.filter((l) => l.text));
}

function parseMarkdownOutline(text: string): SyllabusTopic[] {
  const lines = text.split('\n').map((raw) => {
    const h = raw.match(/^(#{1,6})\s+(.*)$/);
    const bold = Array.from(raw.matchAll(/\*\*([^*]+)\*\*/g)).map((m) => m[1]);
    const clean = (h ? h[2] : raw).replace(/\*\*|__|`/g, '').replace(/^[-*+]\s+/, '').trim();
    return { text: clean, heading: h ? h[1].length : undefined, bold };
  });
  return topicsFromLines(lines.filter((l) => l.text));
}

export async function parseSyllabusFile(file: File): Promise<{ fileName: string; topics: SyllabusTopic[] }> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const topics = ext === 'docx' ? await parseDocx(await file.arrayBuffer()) : parseMarkdownOutline(await file.text());
  if (!topics.length) throw new Error('Không tìm thấy mục nào trong đề cương.');
  return { fileName: file.name, topics };
}

// ---------------------------------------------------------------------------
// Quiz results
// ---------------------------------------------------------------------------
/**
 * Terms worth pinning as focus keywords: `code spans`, dotted identifiers (np.vstack, df.drop) and
 * technical names written in caps or camel case (OPTICS, DBSCAN, PyTorch, NumPy). Plain capitalized
 * words ("Area", "Concept", "Trong") are ignored.
 */
const codeTerms = (s: string) => {
  const found = [
    ...(s.match(/`([^`]{2,40})`/g) || []).map((m) => m.slice(1, -1)),
    ...(s.match(/\b[a-z]{1,8}\.[a-zA-Z_]+/g) || []),
    ...(s.match(/\b[a-z_]+=\w+/g) || []),
    ...(s.match(/\b(?:[A-Z]{2,}[A-Za-z0-9]*|[A-Z][a-z]+[A-Z][A-Za-z0-9]*)\b/g) || [])
  ];
  const seen = new Set<string>();
  return found
    .map((t) => t.replace(/[(\s)]+$/g, '').replace(/^\.+/, '').trim())
    .filter((t) => {
      const k = t.toLowerCase();
      if (t.length < 2 || t.length > 40 || seen.has(k) || /^(na|ok|ai)$/i.test(t)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 6);
};

export function parseQuizResults(text: string, fileName = 'quiz'): NonNullable<StudySignals['quiz']> {
  const quizzes: { title: string; score?: number; category?: string }[] = [];
  const gaps: QuizGap[] = [];

  // Summary table rows: | **Name** | Category | 60% | 6 / 10 | ...
  for (const row of text.matchAll(/^\|\s*\**([^|*]+?)\**\s*\|\s*([^|]*)\|\s*(\d{1,3})\s*%\s*\|/gm)) {
    quizzes.push({ title: row[1].trim(), category: row[2].trim(), score: Number(row[3]) });
  }

  // Weak areas: "### Area A: Title" followed by bullets until the next heading.
  const areaRe = /^#{2,4}\s*(?:Area\s+\w+\s*[:：]\s*|Vùng\s+\w+\s*[:：]\s*)?(.+)$/gim;
  const weakSection = text.split(/^##\s*\d*\.?\s*(?:Identified Weak Areas|Weak Areas|Lỗ hổng|Điểm yếu)[^\n]*$/im)[1]?.split(/^##\s/m)[0];
  if (weakSection) {
    const chunks = weakSection.split(/^###\s*/m).slice(1);
    chunks.forEach((chunk, i) => {
      const [head, ...body] = chunk.split('\n');
      const label = head.replace(/^(?:Area|Vùng)\s+\w+\s*[:：]\s*/i, '').trim();
      const bodyText = body.join(' ').replace(/[*`$]/g, ' ').replace(/\s+/g, ' ').trim();
      gaps.push({ id: `area_${i + 1}`, label, text: `${label}. ${bodyText}`, keyTerms: codeTerms(chunk), weight: 1, source: 'weak_area' });
    });
  }
  void areaRe;

  // Missed questions from any JSON array in the file (```json blocks or a raw JSON export).
  const jsonCandidates = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1]);
  if (!jsonCandidates.length && /^\s*[[{]/.test(text)) jsonCandidates.push(text);
  for (const raw of jsonCandidates) {
    try {
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : [data];
      list.forEach((q: any) => {
        const score = typeof q.score_percentage === 'number' ? q.score_percentage : undefined;
        if (q.quiz_title && !quizzes.some((x) => x.title === q.quiz_title)) quizzes.push({ title: q.quiz_title, score });
        const severity = score !== undefined ? Math.max(0.3, 1 - score / 100) * 1.5 : 1;
        (q.missed_questions || q.incorrect || []).forEach((m: any, j: number) => {
          const t = [m.question, m.correct_answer && `Đáp án đúng: ${m.correct_answer}`, m.analysis].filter(Boolean).join(' ');
          gaps.push({
            id: `q_${gaps.length + 1}_${j}`,
            label: String(m.question || '').slice(0, 90),
            text: t,
            keyTerms: codeTerms(`${m.correct_answer || ''} ${m.user_answer || ''} ${m.question || ''} ${m.analysis || ''}`),
            weight: severity,
            source: 'missed_question'
          });
        });
      });
    } catch {
      /* not JSON */
    }
  }

  const avg = text.match(/overall_average_score:\s*([\d.]+)/)?.[1];
  if (!gaps.length) throw new Error('Không tìm thấy câu sai hoặc vùng kiến thức yếu trong file kết quả quiz.');
  return { fileName, averageScore: avg ? Number(avg) : undefined, quizzes, gaps };
}

export async function parseQuizFile(file: File) {
  return parseQuizResults(await file.text(), file.name);
}
