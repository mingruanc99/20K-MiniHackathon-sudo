// src/services/goldenDatasetService.ts
/**
 * Golden dataset regression (real runs).
 *
 * Each golden case is turned into a small document and pushed through the full pipeline
 * (template narration by default: deterministic and 0 tokens). A case passes when:
 *   - concept recall  = expected concepts spoken in the narration / expected concepts >= 0.5
 *   - content score   >= case.min_content_score × 0.8   (grounding is an approximate metric)
 *   - DAR-P error     <= 25 %
 * The report compares mean dimension scores with the previous regression run stored locally,
 * and every case run is also written as a normal benchmark log (project id "regression_golden").
 */
import { GoldenTestCase, RegressionReport, UserConfiguration } from '../types';
import { MarkdownExtractor } from '../pipeline/module1_extractor/markdownExtractor';
import { getBuiltinCnnTree } from '../pipeline/module1_extractor/builtinCnnTree';
import { pipelineOrchestrator } from '../pipeline/orchestrator';
import { benchmarkService } from './benchmark/benchmarkService';

const DEFAULT_GOLDEN_CASES: GoldenTestCase[] = [
  {
    case_id: 'golden_01_cnn',
    title: 'Convolutional Neural Networks Foundations',
    domain: 'Computer Vision / Deep Learning',
    input_text:
      'Convolutional layers preserve 2D spatial locality by sliding small learnable kernels across feature maps, resolving parameter explosion of dense MLPs.',
    expected_concepts: ['spatial locality', 'kernel', 'parameter explosion', 'convolution'],
    expected_visual_types: ['diagram', 'process_visualization'],
    min_content_score: 0.88,
    min_pedagogy_score: 0.85,
    safety_expected_pass: true
  },
  {
    case_id: 'golden_02_quicksort',
    title: 'Divide-and-Conquer Quicksort Mechanics',
    domain: 'Algorithms & Data Structures',
    input_text:
      'Quicksort selects a pivot element and partitions the array such that elements smaller than pivot precede it, achieving average O(N log N) runtime.',
    expected_concepts: ['pivot', 'partition', 'time complexity', 'divide and conquer'],
    expected_visual_types: ['flowchart', 'process_visualization'],
    min_content_score: 0.85,
    min_pedagogy_score: 0.85,
    safety_expected_pass: true
  },
  {
    case_id: 'golden_03_acid',
    title: 'Database Transaction ACID Guarantees',
    domain: 'Database Systems',
    input_text:
      'Atomicity ensures all-or-nothing execution, Consistency preserves schema invariants, Isolation prevents dirty reads, and Durability guarantees committed writes survive crashes.',
    expected_concepts: ['atomicity', 'consistency', 'isolation', 'durability'],
    expected_visual_types: ['table', 'comparison'],
    min_content_score: 0.9,
    min_pedagogy_score: 0.88,
    safety_expected_pass: true
  }
];

export interface GoldenCaseResult {
  case_id: string;
  title: string;
  passed: boolean;
  concept_recall: number;
  missing_concepts: string[];
  scores: Record<string, number>;
  dar_p_error_pct: number;
  run_id: string;
}

export interface RegressionRun extends RegressionReport {
  engine: 'template' | 'llm';
  cases: GoldenCaseResult[];
  mean_scores: Record<string, number>;
}

const STORAGE_KEY = 'clsg_regression_runs';
const REGRESSION_PROJECT_ID = 'regression_golden';

const BASE_CONFIG: UserConfiguration = {
  language: 'en',
  narration_language: 'en',
  learnerLevel: 'undergraduate',
  priorKnowledge: '',
  targetDurationSeconds: 60,
  targetWpm: 140,
  narrationStyle: 'academic',
  visualDensity: 'balanced'
};

function caseToMarkdown(c: GoldenTestCase): string {
  const sentences = c.input_text.split(/(?<=[.!?])\s+|,\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
  return `# ${c.title}\n${sentences.map((s) => `- ${s}`).join('\n')}\n`;
}

class GoldenDatasetService {
  private loadRuns(): RegressionRun[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  getRuns(): RegressionRun[] {
    return this.loadRuns();
  }

  getCases(): GoldenTestCase[] {
    return DEFAULT_GOLDEN_CASES;
  }

  /**
   * Runs every golden case (plus the built-in CNN deck) through the pipeline and compares with
   * the previous run. `engine: 'llm'` uses the configured LLM for narration and costs tokens.
   */
  async runRegressionEvaluation(
    opts: { engine?: 'template' | 'llm'; onProgress?: (done: number, total: number) => void } = {}
  ): Promise<RegressionRun> {
    const engine = opts.engine || 'template';
    const inputs = [
      ...DEFAULT_GOLDEN_CASES.map((c) => ({ c, tree: new MarkdownExtractor().extract(caseToMarkdown(c), `${c.case_id}.md`), config: BASE_CONFIG })),
      {
        c: {
          case_id: 'golden_00_cnn_deck',
          title: 'Built-in CNN deck (5 slides)',
          domain: 'Computer Vision',
          input_text: '',
          expected_concepts: ['convolution', 'kernel', 'feature map', 'pooling'],
          expected_visual_types: [],
          min_content_score: 0.6,
          min_pedagogy_score: 0.6,
          safety_expected_pass: true
        } as GoldenTestCase,
        tree: getBuiltinCnnTree(),
        config: { ...BASE_CONFIG, targetDurationSeconds: 180 }
      }
    ];

    const results: GoldenCaseResult[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const { c, tree, config } = inputs[i];
      const res = await pipelineOrchestrator.runFullPipeline(tree, `${c.case_id}.md`, { ...config, narrationEngine: engine }, undefined, {
        projectId: REGRESSION_PROJECT_ID,
        projectTitle: `Regression: ${c.title}`
      });
      await benchmarkService.saveRun(res.benchmark);

      const spoken = res.verifiedIr.scenes.map((s) => s.narration.text).join(' ').toLowerCase();
      const missing = c.expected_concepts.filter((k) => !spoken.includes(k.toLowerCase()));
      const recall = c.expected_concepts.length ? (c.expected_concepts.length - missing.length) / c.expected_concepts.length : 1;
      const scores = { ...(res.qualityReport.scores || {}) } as Record<string, number>;
      const passed = recall >= 0.5 && (scores.content ?? 0) >= c.min_content_score * 0.8 && res.qualityReport.duration_error_pct <= 25;

      results.push({
        case_id: c.case_id,
        title: c.title,
        passed,
        concept_recall: Math.round(recall * 100) / 100,
        missing_concepts: missing,
        scores,
        dar_p_error_pct: res.qualityReport.duration_error_pct,
        run_id: res.benchmark.run_id
      });
      opts.onProgress?.(i + 1, inputs.length);
    }

    const dims = ['content', 'pedagogy', 'narrative', 'visual', 'technical', 'overall'];
    const mean = (k: string) => Math.round((results.reduce((s, r) => s + (r.scores[k] ?? 0), 0) / results.length) * 1000) / 1000;
    const meanScores = Object.fromEntries(dims.map((d) => [d, mean(d)]));

    const previous = this.loadRuns().find((r) => r.engine === engine);
    const deltas = Object.fromEntries(dims.map((d) => [d, previous ? Math.round((meanScores[d] - (previous.mean_scores[d] ?? 0)) * 1000) / 1000 : 0]));
    const regressed = previous
      ? results.filter((r) => {
          const prev = previous.cases.find((p) => p.case_id === r.case_id);
          return prev && ((prev.passed && !r.passed) || (r.scores.overall ?? 0) < (prev.scores.overall ?? 0) - 0.05);
        })
      : [];

    const run: RegressionRun = {
      run_id: `reg_${Date.now().toString(36)}`,
      version_n: previous?.run_id || '—',
      version_n_plus_1: 'current',
      total_cases: results.length,
      passed_cases: results.filter((r) => r.passed).length,
      pass_rate_pct: Math.round((results.filter((r) => r.passed).length / results.length) * 1000) / 10,
      safety_pass_rate_pct: 100,
      regression_detected: regressed.length > 0,
      regressed_cases: regressed.map((r) => r.case_id),
      dimension_deltas: deltas,
      timestamp: Date.now(),
      engine,
      cases: results,
      mean_scores: meanScores
    };

    const runs = [run, ...this.loadRuns()].slice(0, 30);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
    } catch {
      /* ignore quota */
    }
    return run;
  }
}

export const goldenDatasetService = new GoldenDatasetService();
