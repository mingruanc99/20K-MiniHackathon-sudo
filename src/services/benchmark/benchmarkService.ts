// src/services/benchmark/benchmarkService.ts
/**
 * Benchmark run logging.
 *
 * Each pipeline run (and each document scan) produces a BenchmarkRunLog with:
 *  - metrics recomputed from the final lecture (see qualityGuard.ts / EVALUATION.md)
 *  - per-stage timings
 *  - every LLM call with the token counts returned by the API (estimates are flagged)
 * Logs are written to Firestore at projects/{projectId}/runs/{runId}, mirrored to localStorage
 * (last 100) and printed to the browser console. They can be downloaded as JSON.
 */
import { collection, doc, getDocs, setDoc, query, orderBy, limit as fsLimit } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../../lib/firebase';
import { CanonicalDocumentTree, KnowledgeTree, QualityReport, VerifiedCLSG_IR, UserConfiguration } from '../../types';
import { LLMCallRecord, summarizeCalls } from '../llm/usageMeter';
import { countHeadingMentions, countLeadingConnectives, HeadingSpec, ConnectiveStats, HeadingStats, splitSentences } from '../../pipeline/services/discoursePolicy';
import { tokenize } from '../../pipeline/services/keywordExtractor';
import { BenchmarkMetrics, BenchmarkRunLog, BenchmarkRunSummary, BenchmarkTiming } from './benchmarkTypes';

const APP_VERSION = 'clsg-ir@1.1.0';
const LOCAL_KEY = 'clsg_benchmark_runs';
const LOCAL_MAX = 100;

const checkScore = (report: QualityReport, id: string): number => report.checks.find((c) => c.check_id === id)?.score ?? 0;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function computeBenchmarkMetrics(
  ir: VerifiedCLSG_IR,
  report: QualityReport,
  docTree: CanonicalDocumentTree,
  headingSpecs: HeadingSpec[],
  tree?: KnowledgeTree,
  preRepairErrorPct?: number
): BenchmarkMetrics {
  const texts = ir.scenes.map((s) => s.narration.text);
  const all = texts.join(' ');
  const language = (ir.configuration.narration_language || ir.configuration.language) === 'en' ? 'en' : 'vi';
  const conn = countLeadingConnectives(all, language);
  const heads = countHeadingMentions(texts, headingSpecs);
  const spoken = new Set(tokenize(all));
  const spokenLower = all.toLowerCase();

  // Keyword coverage: top-3 active keywords of every active page.
  let kwCoverage: number | null = null;
  if (tree) {
    let want = 0;
    let said = 0;
    const walk = (n: KnowledgeTree['root'], excluded: boolean) => {
      const ex = excluded || Boolean(n.excluded);
      if (n.kind === 'page') {
        if (ex) return;
        n.children
          .filter((c) => c.kind === 'keyword' && !c.excluded)
          .sort((a, b) => (b.weight || 0) - (a.weight || 0))
          .slice(0, 3)
          .forEach((k) => {
            want++;
            if (spokenLower.includes(k.title.toLowerCase())) said++;
          });
        return;
      }
      n.children.forEach((c) => walk(c, ex));
    };
    walk(tree.root, false);
    kwCoverage = want ? round3(said / want) : null;
  }

  // Visual coverage: regions that were read and whose reading shows up in the narration.
  const regions = (docTree.visual_regions || []).filter((r) => !r.excluded && !r.ocr?.is_decorative);
  let visualCoverage: number | null = null;
  if (regions.length) {
    const covered = regions.filter((r) => {
      const words = tokenize(`${r.ocr?.summary || ''} ${r.ocr?.text || ''}`).filter((w) => w.length > 4);
      if (!words.length) return false;
      return words.filter((w) => spoken.has(w)).length / words.length >= 0.2;
    }).length;
    visualCoverage = round3(covered / regions.length);
  }

  return {
    scenes: ir.total_scenes,
    words_total: ir.total_words,
    sentences_total: texts.reduce((n, t) => n + splitSentences(t).length, 0),
    target_duration_sec: report.target_duration_sec,
    estimated_duration_sec: report.actual_duration_sec,
    dar_p_error_pct: report.duration_error_pct,
    dar_p_pre_repair_pct: preRepairErrorPct ?? report.duration_error_pct,
    vtc: checkScore(report, 'chk_taxonomy_validity'),
    cns: checkScore(report, 'chk_visual_necessity'),
    grounding: checkScore(report, 'chk_factual_grounding'),
    language: checkScore(report, 'chk_language_terminology'),
    anti_repetition: checkScore(report, 'chk_anti_repetition_flow'),
    connective_density: conn.sentences ? round3(conn.connectives / conn.sentences) : 0,
    heading_mentions: heads.mentions,
    heading_repeats: heads.repeated,
    prosody_validity: report.prosody_coherence_score,
    keyword_coverage: kwCoverage,
    visual_coverage: visualCoverage,
    dimensions: report.scores || { content: 0, pedagogy: 0, narrative: 0, visual: 0, technical: 0, overall: report.overall_quality_score },
    decision: report.decision || report.overall_status
  };
}

export function buildPipelineRunLog(input: {
  runId: string;
  projectId: string;
  projectTitle: string;
  config: UserConfiguration;
  model: string;
  timings: BenchmarkTiming[];
  totalMs: number;
  metrics: BenchmarkMetrics;
  connectiveStats: ConnectiveStats;
  headingStats: HeadingStats;
  calls: LLMCallRecord[];
  usedTree: boolean;
  notes?: string[];
}): BenchmarkRunLog {
  return {
    run_id: input.runId,
    kind: 'pipeline',
    app_version: APP_VERSION,
    project_id: input.projectId,
    project_title: input.projectTitle,
    created_at: new Date().toISOString(),
    model: input.model,
    config: {
      target_duration_sec: input.config.targetDurationSeconds,
      wpm: input.config.targetWpm,
      narration_language: input.config.narration_language || input.config.language,
      narration_engine: input.config.narrationEngine || 'template',
      learner_level: input.config.learnerLevel,
      used_knowledge_tree: input.usedTree
    },
    timings: input.timings,
    total_ms: input.totalMs,
    metrics: input.metrics,
    discourse: {
      connectives_before: input.connectiveStats.connectivesBefore,
      connectives_kept: input.connectiveStats.connectivesKept,
      connectives_removed: input.connectiveStats.removed.length,
      heading_mentions_before: input.headingStats.mentionsBefore,
      heading_repeats_removed: input.headingStats.repeatsRemoved,
      transition_sentences_dropped: input.headingStats.sentencesDropped
    },
    tokens: summarizeCalls(input.calls),
    calls: input.calls,
    notes: input.notes || []
  };
}

export function buildScanRunLog(input: {
  runId: string;
  projectId: string;
  projectTitle: string;
  config: UserConfiguration;
  tree: KnowledgeTree;
  timings: BenchmarkTiming[];
  totalMs: number;
  calls: LLMCallRecord[];
}): BenchmarkRunLog {
  return {
    run_id: input.runId,
    kind: 'scan',
    app_version: APP_VERSION,
    project_id: input.projectId,
    project_title: input.projectTitle,
    created_at: new Date().toISOString(),
    model: input.tree.model,
    config: {
      target_duration_sec: input.config.targetDurationSeconds,
      wpm: input.config.targetWpm,
      narration_language: input.config.narration_language || input.config.language,
      narration_engine: input.config.narrationEngine || 'template',
      learner_level: input.config.learnerLevel,
      used_knowledge_tree: true
    },
    timings: input.timings,
    total_ms: input.totalMs,
    scan: {
      pages: input.tree.stats.pages_total,
      pages_llm: input.tree.stats.pages_llm,
      regions: input.tree.stats.regions_total,
      regions_ocr_done: input.tree.stats.regions_ocr_done,
      keywords: input.tree.stats.keywords_total,
      truncated: input.tree.stats.truncated
    },
    tokens: summarizeCalls(input.calls),
    calls: input.calls,
    notes: input.tree.stats.notes
  };
}

export function summarizeRun(log: BenchmarkRunLog): BenchmarkRunSummary {
  return {
    run_id: log.run_id,
    kind: log.kind,
    created_at: log.created_at,
    model: log.model,
    narration_engine: log.config.narration_engine,
    overall_quality: log.metrics?.dimensions.overall,
    dar_p_error_pct: log.metrics?.dar_p_error_pct,
    connective_density: log.metrics?.connective_density,
    heading_repeats: log.metrics?.heading_repeats,
    total_tokens: log.tokens.totalTokens,
    cost_usd: Math.round(log.tokens.costUsd * 1e6) / 1e6,
    cost_complete: log.tokens.costComplete,
    estimated_calls: log.tokens.estimatedCalls,
    total_ms: log.total_ms
  };
}

function readLocal(): BenchmarkRunLog[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeLocal(list: BenchmarkRunLog[]) {
  if (typeof window === 'undefined') return;
  // Drop per-call detail from older entries first if storage is tight.
  for (let keep = list.length; keep > 0; keep = Math.floor(keep * 0.7)) {
    try {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, keep)));
      return;
    } catch {
      /* quota: retry with fewer runs */
    }
  }
}

const clean = (v: any) => JSON.parse(JSON.stringify(v, (_, x) => (x === undefined ? null : x)));

export const benchmarkService = {
  /** Persists a run log (Firestore + localStorage) and prints it to the console. */
  async saveRun(log: BenchmarkRunLog): Promise<{ savedToFirestore: boolean }> {
    const local = readLocal().filter((r) => r.run_id !== log.run_id);
    local.unshift(log);
    writeLocal(local.slice(0, LOCAL_MAX));

    // eslint-disable-next-line no-console
    console.groupCollapsed(`[benchmark] ${log.kind} ${log.run_id} • ${log.tokens.totalTokens} tokens • ${(log.total_ms / 1000).toFixed(1)}s`);
    // eslint-disable-next-line no-console
    console.table(log.calls.map((c) => ({ feature: c.feature, model: c.model, status: c.status, prompt: c.promptTokens, output: c.completionTokens, thoughts: c.thoughtsTokens, estimated: c.tokensEstimated, ms: c.latencyMs })));
    // eslint-disable-next-line no-console
    if (log.metrics) console.table(log.metrics);
    // eslint-disable-next-line no-console
    console.groupEnd();

    // Only real projects have a Firestore doc (and rules) to hang runs under.
    const canUseFirestore = Boolean(isFirebaseConfigured && auth?.currentUser && log.project_id?.startsWith('proj_') && !log.project_id.startsWith('proj_demo'));
    if (!canUseFirestore) return { savedToFirestore: false };
    try {
      await setDoc(doc(db, 'projects', log.project_id, 'runs', log.run_id), clean(log));
      return { savedToFirestore: true };
    } catch (err) {
      console.warn('Benchmark log: Firestore write failed, kept in localStorage.', err);
      return { savedToFirestore: false };
    }
  },

  /** Runs for one project (Firestore when available, merged with local), newest first. */
  async listRuns(projectId?: string, max = 50): Promise<BenchmarkRunLog[]> {
    const byId = new Map<string, BenchmarkRunLog>();
    readLocal()
      .filter((r) => !projectId || r.project_id === projectId)
      .forEach((r) => byId.set(r.run_id, r));

    if (projectId && isFirebaseConfigured && auth?.currentUser && projectId.startsWith('proj_') && !projectId.startsWith('proj_demo')) {
      try {
        const snap = await getDocs(query(collection(db, 'projects', projectId, 'runs'), orderBy('created_at', 'desc'), fsLimit(max)));
        snap.forEach((d) => byId.set(d.id, d.data() as BenchmarkRunLog));
      } catch (err) {
        console.warn('Benchmark log: Firestore read failed, showing local runs only.', err);
      }
    }
    return Array.from(byId.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, max);
  },

  download(log: BenchmarkRunLog | BenchmarkRunLog[], filename?: string) {
    const data = JSON.stringify(log, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || (Array.isArray(log) ? `clsg-benchmark-${Date.now()}.json` : `clsg-benchmark-${log.kind}-${log.run_id}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
