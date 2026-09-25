// src/pipeline/services/documentScanner.ts
/**
 * Document scan: file -> CanonicalDocumentTree + weighted KnowledgeTree, inside a time budget
 * (default 55 s, so the whole scan fits the 60 s envelope users expect).
 *
 *   extract (rule-based, ~1 s)
 *     ├─ OCR of located visual regions (Gemini vision / tesseract)  ┐ in parallel
 *     ├─ keyword weighting per page, batched to Gemini               │
 *     └─ chapter grouping from page titles (1 small Gemini call)     ┘
 *   merge OCR text -> local keywords for visual text -> build tree -> distribute durations
 *
 * Everything degrades to local rules: no API key, a failed batch or an exhausted budget just
 * means those pages keep their locally-weighted keywords (recorded in stats.notes).
 */
import { CanonicalDocumentTree, KnowledgeTree, KnowledgeTreeNode, UserConfiguration, DocumentSection } from '../../types';
import { PPTXExtractor } from '../module1_extractor/pptxExtractor';
import { PDFExtractor } from '../module1_extractor/pdfExtractor';
import { MarkdownExtractor } from '../module1_extractor/markdownExtractor';
import { ocrVisualRegions, mergeRegionsIntoTree } from '../module1_extractor/visualRegionOcr';
import { regionAssetStore } from '../module1_extractor/regionAssets';
import {
  extractLocalKeywords,
  mergeKeywordLists,
  pageTextsFromSections,
  WeightedKeyword,
  PageText
} from './keywordExtractor';
import { keywordNode, rebalanceToTarget, propagateUp, applyKeywordFilter } from './knowledgeTreeOps';
import { llmRouter } from '../../services/llm/LLMRouter';
import { deriveScanLimits, ScanLimits, DEFAULT_MODEL } from '../../services/llm/modelCatalog';
import { usageMeter, summarizeCalls, LLMCallRecord } from '../../services/llm/usageMeter';
import { apiKeyService } from '../../services/llm/apiKeyService';

export interface ScanProgress {
  stage: 'extract' | 'analyze' | 'build' | 'done';
  message: string;
  percent: number;
  elapsedMs: number;
}

export interface ScanOptions {
  budgetMs?: number;
  useLLM?: boolean;
  minKeywordWeight?: number;
  maxKeywordsPerPage?: number;
  maxPages?: number;
  onProgress?: (p: ScanProgress) => void;
}

export interface ScanResult {
  documentTree: CanonicalDocumentTree;
  knowledgeTree: KnowledgeTree;
  limits: ScanLimits;
  llmCalls: LLMCallRecord[];
  timings: { extractMs: number; analyzeMs: number; buildMs: number; totalMs: number };
}

interface LlmPageAnalysis {
  section_id: string;
  importance: number;
  is_admin_or_decorative?: boolean;
  keywords: WeightedKeyword[];
}

const KEYWORD_SYSTEM =
  'You are an instructional designer weighting lecture content. Only use terms that literally appear in the given page text.';

function buildKeywordPrompt(pages: PageText[], local: Map<string, WeightedKeyword[]>, maxPerPage: number): string {
  const blocks = pages
    .map((p) => {
      const cands = (local.get(p.section_id) || []).slice(0, 12).map((k) => k.term).join('; ');
      const body = `${p.body}\n${p.visualText || ''}`.replace(/\s+/g, ' ').slice(0, 700);
      return `### ${p.section_id}\nTITLE: ${p.title}\nTEXT: ${body}\nLOCAL_CANDIDATES: ${cands}`;
    })
    .join('\n\n');
  return `For each page, pick at most ${maxPerPage} keywords that a lecturer must teach, and weight them.
weight 1.0 = the central concept of the page, 0.5 = supporting detail, <0.3 = incidental.
importance = how much lecture time this page deserves relative to a typical page (0..1).
Mark is_admin_or_decorative for agenda/title-only/thank-you/reference/admin pages.
Keep the original language and casing of terms (English technical terms stay English).

${blocks}

Return JSON: {"pages":[{"section_id":"S1","importance":0.7,"is_admin_or_decorative":false,"keywords":[{"term":"...","weight":0.9,"kind":"concept|term|example|formula|entity"}]}]}`;
}

function buildChapterPrompt(sections: DocumentSection[]): string {
  const lines = sections.map((s) => `${s.section_id}: ${s.title.slice(0, 90)}`).join('\n');
  return `Group these consecutive lecture pages into chapters (3-12 chapters, each a contiguous run of pages, in order).
Use section-divider pages ("Chương 2", "Part II", numbered headings) as chapter starts when present.
Give each chapter a short title in the document's language.

${lines}

Return JSON: {"chapters":[{"title":"...","start":"S1","end":"S5"}]}`;
}

/** Rule-based chapters: divider pages start a chapter; otherwise even groups of ~sqrt(n) pages. */
function localChapters(sections: DocumentSection[]): { title: string; ids: string[] }[] {
  const divider = /^(chương|chapter|phần|part|section|bài|module|unit|lecture)\s*[\divxlc]+\b|^[\divxlc]+\s*[.)]\s+\S/i;
  const chapters: { title: string; ids: string[] }[] = [];
  sections.forEach((s) => {
    const textEls = s.elements.filter((e) => e.type !== 'title' && e.type !== 'note').length;
    const isDivider = divider.test(s.title.trim()) && textEls <= 3;
    if (isDivider || chapters.length === 0) chapters.push({ title: s.title, ids: [s.section_id] });
    else chapters[chapters.length - 1].ids.push(s.section_id);
  });
  if (chapters.length >= 2 || sections.length <= 6) return chapters;

  // No dividers found: split evenly.
  const size = Math.max(3, Math.round(Math.sqrt(sections.length)));
  const even: { title: string; ids: string[] }[] = [];
  for (let i = 0; i < sections.length; i += size) {
    const group = sections.slice(i, i + size);
    even.push({ title: group[0].title, ids: group.map((s) => s.section_id) });
  }
  return even;
}

async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

export async function extractSourceFile(file: File | Blob, filename: string): Promise<CanonicalDocumentTree> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pptx') return new PPTXExtractor().extract(file, filename);
  if (ext === 'pdf') return new PDFExtractor().extract(file, filename);
  const text = await file.text();
  return new MarkdownExtractor().extract(text, filename);
}

/**
 * Re-opens the source file after a reload so the Inspector can render pages and crop regions.
 * Extraction is deterministic, so region ids match the stored ones; the handle is registered
 * under the stored document id.
 */
export async function reattachSource(file: File | Blob, filename: string, documentId: string): Promise<boolean> {
  const fresh = await extractSourceFile(file, filename);
  const handle = regionAssetStore.getHandle(fresh.document_id);
  if (!handle) return false;
  regionAssetStore.setHandle(documentId, handle);
  return true;
}

/** Fetches the uploaded source from its Cloudinary URL. */
export async function fetchSourceFile(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

/**
 * @param source the uploaded file, or an already-extracted document (e.g. a project created before
 *   the knowledge tree existed). In the latter case extraction is skipped and regions can only be
 *   OCR'd if the source was re-attached with `reattachSource`.
 */
export async function scanDocument(
  source: File | Blob | CanonicalDocumentTree,
  filename: string,
  config: UserConfiguration,
  opts: ScanOptions = {}
): Promise<ScanResult> {
  const t0 = performance.now();
  const provider = apiKeyService.getActiveProvider();
  const model = provider === 'gemini' ? apiKeyService.getActiveModel('gemini') : DEFAULT_MODEL;
  const limits = deriveScanLimits(model, opts.budgetMs ?? 55_000);
  if (opts.maxKeywordsPerPage) limits.maxKeywordsPerPage = opts.maxKeywordsPerPage;
  if (opts.maxPages) limits.maxPages = Math.min(limits.maxPages, opts.maxPages);
  const minWeight = opts.minKeywordWeight ?? 0.35;
  const deadline = t0 + limits.budgetMs;
  const notes: string[] = [];

  const runId = `scan_${Date.now().toString(36)}`;
  usageMeter.beginRun(runId);
  const progress = (stage: ScanProgress['stage'], message: string, percent: number) =>
    opts.onProgress?.({ stage, message, percent, elapsedMs: Math.round(performance.now() - t0) });

  try {
    // 1. Extract
    progress('extract', 'Đang đọc cấu trúc tài liệu...', 5);
    let docTree = 'sections' in source ? source : await extractSourceFile(source, filename);
    const tExtract = performance.now();
    const regions = docTree.visual_regions || [];
    progress('analyze', `Đã đọc ${docTree.total_sections} trang, ${regions.length} vùng hình ảnh. Đang phân tích...`, 20);

    const online = opts.useLLM !== false ? llmRouter.getOnlineProvider() : null;
    const canUseLLM = Boolean(online && online.hasApiKey());
    if (!canUseLLM) notes.push('Không có API key: keyword và chương được tính bằng luật cục bộ, OCR dùng tesseract.');

    // 2. Parallel analysis
    const pagesForText = pageTextsFromSections(docTree.sections);
    const localKw = extractLocalKeywords(pagesForText, { maxPerPage: 15, minWeight: 0 });
    const llmPages = new Map<string, LlmPageAnalysis>();
    let llmChapters: { title: string; ids: string[] }[] | null = null;

    let ocrDone = 0;
    let kwDone = 0;
    const llmTargetPages = pagesForText.slice(0, limits.maxPages);
    if (pagesForText.length > limits.maxPages) {
      notes.push(`Tài liệu có ${pagesForText.length} trang; ${limits.maxPages} trang đầu được Gemini chấm trọng số, phần còn lại dùng luật cục bộ.`);
    }
    const batches: PageText[][] = [];
    for (let i = 0; i < llmTargetPages.length; i += limits.pagesPerBatch) batches.push(llmTargetPages.slice(i, i + limits.pagesPerBatch));
    const totalWork = Math.max(1, regions.length + batches.length);
    const tick = () => progress('analyze', `Đang phân tích: ${kwDone}/${batches.length} lô keyword, ${ocrDone} vùng ảnh`, 20 + Math.round(((kwDone + ocrDone) / totalWork) * 65));

    const ocrTask = ocrVisualRegions(docTree.document_id, regions, {
      concurrency: Math.max(1, Math.floor(limits.concurrency / 2)),
      maxRegionsPerPage: limits.maxRegionsPerPage,
      maxRegionsTotal: canUseLLM ? limits.maxRegionsTotal : Math.min(limits.maxRegionsTotal, 12),
      deadline: deadline - 3000,
      onProgress: (d) => {
        ocrDone = d;
        tick();
      }
    });

    const keywordTask = canUseLLM
      ? runPool(batches, Math.max(1, Math.ceil(limits.concurrency / 2)), async (batch) => {
          if (performance.now() > deadline - 8000) {
            kwDone++;
            return;
          }
          try {
            const res = await online!.generateJson<{ pages: LlmPageAnalysis[] }>(
              buildKeywordPrompt(batch, localKw, limits.maxKeywordsPerPage),
              KEYWORD_SYSTEM,
              'Knowledge Scan: keyword weighting',
              { maxOutputTokens: Math.min(8192, batch.length * limits.maxKeywordsPerPage * 40 + 400), temperature: 0.1, timeoutMs: 20000 }
            );
            (res?.pages || []).forEach((p) => {
              if (!p?.section_id) return;
              llmPages.set(p.section_id, {
                section_id: p.section_id,
                importance: Math.max(0, Math.min(1, Number(p.importance) || 0.5)),
                is_admin_or_decorative: Boolean(p.is_admin_or_decorative),
                keywords: (p.keywords || [])
                  .filter((k) => k && k.term)
                  .map((k) => ({ term: String(k.term).trim(), weight: Math.max(0, Math.min(1, Number(k.weight) || 0)), source: 'llm' as const, kind: k.kind }))
              });
            });
          } catch (err) {
            console.warn('Keyword batch failed, keeping local weights:', err);
          }
          kwDone++;
          tick();
        })
      : Promise.resolve();

    const chapterTask = canUseLLM && docTree.sections.length > 6
      ? online!
          .generateJson<{ chapters: { title: string; start: string; end: string }[] }>(
            buildChapterPrompt(docTree.sections),
            'You structure lecture decks into chapters.',
            'Knowledge Scan: chapter grouping',
            { maxOutputTokens: 1500, temperature: 0, timeoutMs: 20000 }
          )
          .then((res) => {
            const order = docTree.sections.map((s) => s.section_id);
            const chapters = (res?.chapters || [])
              .map((c) => {
                const a = order.indexOf(c.start);
                const b = order.indexOf(c.end);
                return a >= 0 && b >= a ? { title: String(c.title || '').trim(), ids: order.slice(a, b + 1) } : null;
              })
              .filter(Boolean) as { title: string; ids: string[] }[];
            // Accept only a clean partition of the deck.
            const covered = chapters.flatMap((c) => c.ids);
            if (covered.length === order.length && new Set(covered).size === order.length) llmChapters = chapters;
          })
          .catch((err) => console.warn('Chapter grouping failed, using local rules:', err))
      : Promise.resolve();

    const [ocrRegions] = await Promise.all([ocrTask, keywordTask, chapterTask]);
    const tAnalyze = performance.now();

    // 3. Merge OCR text into the document, then weight keywords once more for pages with visuals.
    docTree = mergeRegionsIntoTree(docTree, ocrRegions);
    const pagesAfterOcr = pageTextsFromSections(docTree.sections);
    const localFinal = extractLocalKeywords(pagesAfterOcr, { maxPerPage: limits.maxKeywordsPerPage * 2, minWeight: 0 });

    const skippedOcr = ocrRegions.filter((r) => r.ocr?.status === 'skipped' && !r.excluded).length;
    if (skippedOcr) notes.push(`${skippedOcr} vùng hình ảnh chưa được OCR (giới hạn số vùng hoặc thời gian); có thể chạy lại trong Knowledge Inspector.`);

    // 4. Build tree
    progress('build', 'Đang dựng cây trọng số...', 90);
    const chapters = llmChapters || localChapters(docTree.sections);
    const sectionById = new Map(docTree.sections.map((s) => [s.section_id, s]));
    const targetSec = config.targetDurationSeconds || Math.max(60, docTree.sections.length * 40);

    const chapterNodes: KnowledgeTreeNode[] = chapters.map((ch, ci) => ({
      id: `ch_${ci + 1}`,
      kind: 'chapter',
      title: ch.title || `Chương ${ci + 1}`,
      children: ch.ids.map((sid) => {
        const sec = sectionById.get(sid)!;
        const llm = llmPages.get(sid);
        // Keep a reserve below the threshold so the Inspector slider can bring terms back.
        const kws = mergeKeywordLists(localFinal.get(sid) || [], llm?.keywords, {
          maxPerPage: limits.maxKeywordsPerPage * 2,
          minWeight: Math.min(0.15, minWeight)
        });
        const textLen = (sec.raw_text || '').length;
        // Importance: LLM when available, else text density (log-scaled) — drives the initial time split.
        const importance = llm ? llm.importance : Math.min(1, 0.25 + Math.log10(1 + textLen) / 4);
        const decorative = llm?.is_admin_or_decorative || (!llm && textLen < 40);
        const pageId = `pg_${sid}`;
        return {
          id: pageId,
          kind: 'page' as const,
          title: sec.title,
          section_id: sid,
          weight: Math.round(importance * 100) / 100,
          duration_sec: Math.max(5, Math.round((decorative ? 0.3 : 0.4 + importance) * 100)),
          children: kws.map((k, i) => keywordNode(pageId, k, i))
        };
      })
    }));

    const root: KnowledgeTreeNode = {
      id: 'doc_root',
      kind: 'document',
      title: docTree.title,
      children: chapterNodes
    };
    propagateUp(root);

    const calls = usageMeter.peek(runId);
    const summary = summarizeCalls(calls);
    let knowledgeTree: KnowledgeTree = {
      tree_id: `kt_${Date.now().toString(36)}`,
      document_id: docTree.document_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      model: canUseLLM ? `${provider}:${apiKeyService.getActiveModel(provider)}` : 'local-rules',
      settings: {
        min_keyword_weight: minWeight,
        max_keywords_per_page: limits.maxKeywordsPerPage,
        max_pages: limits.maxPages,
        target_duration_sec: targetSec
      },
      stats: {
        pages_total: docTree.sections.length,
        pages_llm: llmPages.size,
        keywords_total: chapterNodes.reduce((s, c) => s + c.children.reduce((a, p) => a + p.children.length, 0), 0),
        regions_total: ocrRegions.length,
        regions_ocr_done: ocrRegions.filter((r) => r.ocr?.status === 'done').length,
        scan_ms: 0,
        llm_calls: summary.calls - summary.cacheHits,
        total_tokens: summary.totalTokens,
        truncated: pagesForText.length > limits.maxPages || skippedOcr > 0 || (canUseLLM && llmPages.size < llmTargetPages.length),
        notes
      },
      root
    };
    // Scale the initial importance-based split to the configured lecture length.
    knowledgeTree = rebalanceToTarget(knowledgeTree, targetSec);
    knowledgeTree = applyKeywordFilter(knowledgeTree, minWeight, limits.maxKeywordsPerPage);

    const tEnd = performance.now();
    knowledgeTree.stats.scan_ms = Math.round(tEnd - t0);
    progress('done', `Hoàn tất trong ${((tEnd - t0) / 1000).toFixed(1)}s`, 100);

    return {
      documentTree: docTree,
      knowledgeTree,
      limits,
      llmCalls: usageMeter.endRun(runId),
      timings: {
        extractMs: Math.round(tExtract - t0),
        analyzeMs: Math.round(tAnalyze - tExtract),
        buildMs: Math.round(tEnd - tAnalyze),
        totalMs: Math.round(tEnd - t0)
      }
    };
  } catch (err) {
    usageMeter.endRun(runId);
    throw err;
  }
}
