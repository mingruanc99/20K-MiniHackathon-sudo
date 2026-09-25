// Current benchmark figures for the pitch deck (template engine, 100% content coverage, no API calls):
//   npx tsx tests/ts/fixtures/pitchMetrics.js
import { scanDocument } from '../../../src/pipeline/services/documentScanner.ts';
import { setCoverage, fullDurationOf } from '../../../src/pipeline/services/contentDuration.ts';
import { PipelineOrchestrator } from '../../../src/pipeline/orchestrator.ts';
import { getBuiltinCnnTree } from '../../../src/pipeline/module1_extractor/builtinCnnTree.ts';
import { templateDeck } from './templateDeck.js';

const config = {
  language: 'vi', learnerLevel: 'undergraduate', priorKnowledge: '', targetDurationSeconds: 300, targetWpm: 140,
  narrationStyle: 'academic', visualDensity: 'balanced', narrationEngine: 'template', contentCoverage: 1
};
const pct = (v) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);

const en = { ...config, language: 'en', narration_language: 'en' };
for (const [name, doc, cfg] of [['CNN 5 slide (EN→EN)', getBuiltinCnnTree(), en], ['CNN 5 slide (EN→VI)', getBuiltinCnnTree(), config], ['Bộ tiếng Việt 10 trang', templateDeck, config]]) {
  const scan = await scanDocument(doc, doc.source_filename, cfg, { useLLM: false });
  const tree = setCoverage(scan.knowledgeTree, 1);
  const t0 = performance.now();
  const res = await new PipelineOrchestrator().runFullPipeline(scan.documentTree, doc.source_filename, { ...cfg, targetDurationSeconds: tree.root.duration_sec }, undefined, { knowledgeTree: tree });
  const ms = Math.round(performance.now() - t0);
  const m = res.benchmark.metrics;
  console.log(JSON.stringify({
    deck: name,
    full_content_sec: fullDurationOf(scan.knowledgeTree),
    target_sec: m.target_duration_sec,
    estimated_sec: Math.round(m.estimated_duration_sec),
    dar_p: `${m.dar_p_error_pct.toFixed(1)}%`,
    grounding: pct(m.grounding),
    connective_density: pct(m.connective_density),
    heading_repeats: m.heading_repeats,
    keyword_coverage: pct(m.keyword_coverage),
    visual_coverage: pct(m.visual_coverage),
    overall: m.dimensions.overall,
    decision: m.decision,
    pipeline_ms: ms
  }));
}
