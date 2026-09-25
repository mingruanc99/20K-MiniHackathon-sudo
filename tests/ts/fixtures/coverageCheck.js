// Measures content-based sizing on the fixture decks (manual inspection):
//   npx tsx tests/ts/fixtures/coverageCheck.js
import { scanDocument } from '../../../src/pipeline/services/documentScanner.ts';
import { setCoverage, fullDurationOf, minTemplateCoverage } from '../../../src/pipeline/services/contentDuration.ts';
import { PipelineOrchestrator } from '../../../src/pipeline/orchestrator.ts';
import { getBuiltinCnnTree } from '../../../src/pipeline/module1_extractor/builtinCnnTree.ts';
import { templateDeck } from './templateDeck.js';

const config = {
  language: 'vi', learnerLevel: 'undergraduate', priorKnowledge: '', targetDurationSeconds: 300, targetWpm: 140,
  narrationStyle: 'academic', visualDensity: 'balanced', narrationEngine: 'template', contentCoverage: 1
};

for (const [name, doc] of [['fixture 10 trang', templateDeck], ['CNN 5 slide', getBuiltinCnnTree()]]) {
  const scan = await scanDocument(doc, doc.source_filename, config, { useLLM: false });
  const full = fullDurationOf(scan.knowledgeTree);
  console.log(`\n=== ${name}: 100% nội dung = ${full}s (${(full / 60).toFixed(1)} phút), tối thiểu theo mẫu ${Math.round(minTemplateCoverage(scan.knowledgeTree) * 100)}%`);
  for (const cov of [1, 0.5, 0.25]) {
    const tree = setCoverage(scan.knowledgeTree, cov);
    const res = await new PipelineOrchestrator().runFullPipeline(scan.documentTree, doc.source_filename, { ...config, targetDurationSeconds: tree.root.duration_sec }, undefined, { knowledgeTree: tree });
    const q = res.qualityReport;
    console.log(`  ${Math.round(cov * 100)}%: mục tiêu ${tree.root.duration_sec}s, thực tế ${Math.round(q.actual_duration_sec)}s, DAR-P ${(Math.abs(q.actual_duration_sec - tree.root.duration_sec) / tree.root.duration_sec * 100).toFixed(1)}%`);
  }
}
