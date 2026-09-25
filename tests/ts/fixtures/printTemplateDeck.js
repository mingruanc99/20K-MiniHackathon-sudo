// Prints the template-engine narration for the fixture deck (manual inspection):
//   npx tsx tests/ts/fixtures/printTemplateDeck.js
import { PipelineOrchestrator } from '../../../src/pipeline/orchestrator.ts';
import { templateDeck } from './templateDeck.js';

const res = await new PipelineOrchestrator().runFullPipeline(templateDeck, templateDeck.source_filename, {
  language: 'vi',
  learnerLevel: 'undergraduate',
  priorKnowledge: 'Đại số tuyến tính cơ bản',
  targetDurationSeconds: 300,
  targetWpm: 140,
  narrationStyle: 'academic',
  visualDensity: 'balanced',
  narrationEngine: 'template'
});
for (const s of res.verifiedIr.scenes) {
  console.log(`\n[${s.order}] ${s.topic} (${s.pedagogical_function}, ${s.narration.word_count} từ)\n${s.narration.text}`);
}
