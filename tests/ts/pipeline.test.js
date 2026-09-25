// tests/ts/pipeline.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getBuiltinCnnTree } from '../../src/pipeline/module1_extractor/extractorFactory.ts';
import { InstructionalPlanner } from '../../src/pipeline/module2_planner/instructionalPlanner.ts';
import { NarrationGenerator } from '../../src/pipeline/module3_generator/narrationGenerator.ts';
import { ProsodyPlanner } from '../../src/pipeline/module3_generator/prosodyPlanner.ts';
import { VisualIntentGenerator } from '../../src/pipeline/module3_generator/visualIntentGenerator.ts';
import { QualityVisualGuard } from '../../src/pipeline/module4_guard/qualityGuard.ts';
import { PipelineOrchestrator } from '../../src/pipeline/orchestrator.ts';
import { technicalTerminologyService } from '../../src/pipeline/services/technicalTerminologyService.ts';
import { contentPurifierService } from '../../src/pipeline/services/contentPurifierService.ts';
import { llmRouter } from '../../src/services/llm/LLMRouter.ts';
import { MockLLMProvider } from '../../src/services/llm/MockLLMProvider.ts';

// In automated test runner, use mock provider if no live Gemini key is provided in process.env
if (!process.env.GEMINI_API_KEY) {
  llmRouter.setProvider(new MockLLMProvider());
}

test('CLSG-IR Module 1: Content Extractor returns valid 5-slide CanonicalDocumentTree', () => {
  const tree = getBuiltinCnnTree();
  assert.equal(tree.total_sections, 5);
  assert.equal(tree.source_type, 'pptx');
  assert.equal(tree.sections[0].title, 'Introduction to Convolutional Neural Networks');
  assert.ok(tree.extraction_time_ms >= 0);
});

test('CLSG-IR Module 2: Instructional Planner computes correct duration and word budgets', async () => {
  const tree = getBuiltinCnnTree();
  const planner = new InstructionalPlanner();
  const blueprint = await planner.plan(tree, {
    language: 'en',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Linear algebra',
    targetDurationSeconds: 180,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  });

  assert.equal(blueprint.total_target_duration_sec, 180);
  assert.equal(blueprint.sections.length, 5);
  const totalAllocatedDuration = blueprint.sections.reduce((sum, s) => sum + s.target_duration_sec, 0);
  assert.equal(totalAllocatedDuration, 180);
  assert.equal(blueprint.sections[0].pedagogical_function, 'hook');
  assert.equal(blueprint.sections[4].pedagogical_function, 'summary');
});

test('CLSG-IR Module 3B & 3C: Prosody planning and 13 Visual Taxonomies', async () => {
  const tree = getBuiltinCnnTree();
  const planner = new InstructionalPlanner();
  const config = {
    language: 'en',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Linear algebra',
    targetDurationSeconds: 180,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };
  const blueprint = await planner.plan(tree, config);

  const narrationGen = new NarrationGenerator();
  const prosodyPlanner = new ProsodyPlanner();
  const visualGen = new VisualIntentGenerator();

  const sec = blueprint.sections[2]; // Convolution section
  const narration = narrationGen.generateNarration(sec, config);
  assert.ok(narration.length > 50);

  const prosody = prosodyPlanner.planProsody(narration, sec, config);
  assert.ok(prosody.ssml_full.startsWith('<speak'));
  assert.ok(prosody.ssml_full.endsWith('</speak>'));
  assert.ok(prosody.total_pause_sec > 0);

  const cues = visualGen.generateVisualCues(sec, prosody, config);
  assert.ok(cues.length > 0);
  for (const cue of cues) {
    assert.ok(VisualIntentGenerator.ALLOWED_TAXONOMIES.includes(cue.visual_type));
    assert.ok(cue.visual_purpose.length > 10);
    assert.ok(cue.learning_support.length > 15);
  }
});

test('CLSG-IR Module 4: Quality Guard evaluates DAR-P and certifies VerifiedCLSG_IR', async () => {
  const orchestrator = new PipelineOrchestrator();
  const config = {
    language: 'en',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Linear algebra',
    targetDurationSeconds: 180,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };

  const res = await orchestrator.runFullPipeline('cnn_intro.pptx', 'cnn_intro.pptx', config);
  // DAR-P is measured, not forced: it must equal the formula applied to the final scenes.
  const est = res.verifiedIr.scenes.reduce((s, sc) => s + sc.scene_duration_sec, 0);
  const expectedPct = Math.round((Math.abs(est - 180) / 180) * 1000) / 10;
  assert.ok(Math.abs(res.qualityReport.duration_error_pct - expectedPct) <= 0.2, `${res.qualityReport.duration_error_pct} vs ${expectedPct}`);
  const darCheck = res.qualityReport.checks.find((c) => c.check_id === 'chk_dar_p');
  assert.equal(darCheck.status, expectedPct <= 15 ? 'PASSED' : expectedPct <= 25 ? 'WARNING' : 'FAILED');
  // Speaking time is never scaled: every scene's speaking time matches its word count at the WPM.
  for (const sc of res.verifiedIr.scenes) {
    const words = sc.prosody_plan.sentences.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
    assert.ok(sc.prosody_plan.total_speaking_sec >= (words / (140 / 60)) * 0.99 - 0.2);
  }
  assert.equal(res.verifiedIr.total_scenes, 5);
  assert.ok(res.traceLogs.length >= 4);
});

test('Pipeline handles large presentations (e.g. 62 slides) accurately without truncation', async () => {
  const orchestrator = new PipelineOrchestrator();
  const numSlides = 62;
  const sections = Array.from({ length: numSlides }, (_, i) => ({
    section_id: `S${i + 1}`,
    title: `Slide ${i + 1}: Technical Lecture Topic ${i + 1}`,
    order: i + 1,
    elements: [
      { element_id: `S${i + 1}_el_01`, type: 'title', text: `Slide ${i + 1}: Technical Lecture Topic ${i + 1}`, level: 1 },
      { element_id: `S${i + 1}_el_02`, type: 'bullet_point', text: `Key concept detail for topic ${i + 1}`, level: 2 }
    ],
    raw_text: `Slide ${i + 1}: Technical Lecture Topic ${i + 1}\nKey concept detail for topic ${i + 1}`
  }));

  const docTree = {
    document_id: 'doc_pdf_62',
    title: 'Keypoint Pose Estimation',
    source_type: 'pdf',
    source_filename: 'day04-keypoint-pose-annotation.pdf',
    total_sections: numSlides,
    sections,
    extraction_time_ms: 15.2
  };

  const config = {
    language: 'vi',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Computer Vision Basics',
    targetDurationSeconds: numSlides * 45,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };

  const res = await orchestrator.runFullPipeline(docTree, 'day04-keypoint-pose-annotation.pdf', config);
  assert.equal(res.documentTree.total_sections, 62);
  assert.equal(res.blueprint.sections.length, 62);
  assert.equal(res.verifiedIr.scenes.length, 62);
  assert.equal(res.verifiedIr.total_scenes, 62);
});

test('Section 25 Language Policy & Technical Terminology Test Cases (1 through 6)', async () => {
  const { technicalTerminologyService } = await import('../../src/pipeline/services/technicalTerminologyService.ts');

  // Test 1: "CNN dùng kernel để quét qua ảnh." -> PASS (Vietnamese + kernel preserved)
  const t1 = technicalTerminologyService.validateSentence('CNN dùng kernel để quét qua ảnh.');
  assert.equal(t1.isValid, true);
  assert.ok(t1.preservedTerms.includes('CNN') || t1.preservedTerms.includes('kernel'));

  // Test 2: "CNN uses a kernel to scan the image." -> Converted naturally
  const t2 = technicalTerminologyService.resolveAndPreserveSentence('CNN uses a kernel to scan the image.');
  assert.ok(t2.resolvedText.includes('kernel'));
  assert.ok(t2.resolvedText.includes('quét') || t2.resolvedText.includes('ảnh') || t2.resolvedText.includes('dùng'));

  // Test 3: "CNN dùng kernel để scan image." -> Regenerate/normalized to "CNN dùng kernel để quét ảnh."
  const t3 = technicalTerminologyService.validateSentence('CNN dùng kernel để scan image.');
  assert.equal(t3.isValid, false);
  assert.ok(t3.unnecessaryEnglishFound.includes('scan') || t3.unnecessaryEnglishFound.includes('image'));
  const repairedT3 = technicalTerminologyService.resolveAndPreserveSentence('CNN dùng kernel để scan image.').resolvedText;
  assert.ok(repairedT3.includes('quét'));
  assert.ok(repairedT3.includes('ảnh'));
  assert.ok(repairedT3.includes('kernel'));

  // Test 4: "Object detection sử dụng bounding box." -> PASS
  const t4 = technicalTerminologyService.validateSentence('Object detection sử dụng bounding box.');
  assert.equal(t4.isValid, true);
  assert.ok(t4.preservedTerms.includes('object detection') || t4.preservedTerms.includes('bounding box'));

  // Test 5: "Object detection sử dụng hộp giới hạn." -> Normalizes to "Object detection sử dụng bounding box."
  const t5 = technicalTerminologyService.resolveAndPreserveSentence('Object detection sử dụng hộp giới hạn.');
  assert.ok(t5.resolvedText.includes('bounding box'));
  assert.ok(!t5.resolvedText.includes('hộp giới hạn'));

  // Test 6: "Model predicts the bounding box." -> Normalized to "Mô hình dự đoán bounding box." NOT "Model predicts"
  const t6 = technicalTerminologyService.resolveAndPreserveSentence('Model predicts the bounding box.');
  assert.ok(t6.resolvedText.includes('Mô hình dự đoán bounding box') || (t6.resolvedText.includes('dự đoán') && t6.resolvedText.includes('bounding box')));
  assert.ok(!t6.resolvedText.toLowerCase().includes('predicts'));
});

test('Section 26 Demo Example: Convolution topic produces exact narration, prosody, and visual intent', () => {
  const narrationGen = new NarrationGenerator();
  const prosodyPlanner = new ProsodyPlanner();
  const visualGen = new VisualIntentGenerator();

  const plan = {
    section_id: 'S3',
    title: 'Convolution Layer and Kernel',
    order: 3,
    pedagogical_function: 'mechanism',
    bloom_level: 'Apply',
    target_duration_sec: 40,
    target_word_budget: 15,
    key_concepts: ['kernel', 'convolution', 'feature map'],
    instructional_goal: 'Hiểu cơ chế kernel quét qua ảnh để tạo ra feature map'
  };

  const config = {
    language: 'vi',
    narration_language: 'vi',
    technical_terminology_language: 'en',
    preserve_technical_terms: true,
    natural_vietnamese: true,
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Linear algebra',
    targetDurationSeconds: 40,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };

  const inputConcept = 'CNN dùng kernel để quét qua từng vùng nhỏ của ảnh và tạo ra feature map.';
  const narration = narrationGen.generateNarration(plan, config, inputConcept);
  assert.equal(narration, 'CNN dùng kernel để quét qua từng vùng nhỏ của ảnh và tạo ra feature map.');

  const prosody = prosodyPlanner.planProsody(narration, plan, config);
  assert.ok(prosody.sentences.length >= 1);
  const firstSent = prosody.sentences[0];
  assert.equal(firstSent.prosody.pause_after_ms, 600);
  assert.equal(firstSent.prosody.pause_type, 'concept_boundary');
  assert.equal(firstSent.prosody.rate, 'slow');
  assert.equal(firstSent.prosody.energy, 'medium');

  const cues = visualGen.generateVisualCues(plan, prosody, config);
  assert.ok(cues.length >= 1);
  const cnnCue = cues.find((c) => c.visual_type === 'process_visualization');
  assert.ok(cnnCue);
  assert.equal(cnnCue.visual_need, true);
  assert.equal(cnnCue.visual_type, 'process_visualization');
  assert.equal(cnnCue.visual_purpose, 'Minh họa cách kernel quét qua từng vùng nhỏ của ảnh để tạo ra feature map.');
});

test('Instructional Planner & Narration Generator formulate goals in Vietnamese and sanitize legacy English goals', async () => {
  const planner = new InstructionalPlanner();
  const narrationGen = new NarrationGenerator();
  const tree = getBuiltinCnnTree();
  const config = {
    language: 'vi',
    narration_language: 'vi',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Linear algebra',
    targetDurationSeconds: 180,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };

  const bp = await planner.plan(tree, config);
  assert.ok(bp.sections[0].instructional_goal.includes('nắm vững tầm quan trọng nền tảng của'));
  assert.ok(bp.pedagogical_strategy.includes('Tiến trình nhận thức sư phạm'));

  // Test that even a legacy English goal is fully converted to Vietnamese
  const legacyPlan = {
    section_id: 'S1',
    title: 'Keypoint & Pose',
    order: 1,
    pedagogical_function: 'hook',
    bloom_level: 'Remember',
    target_duration_sec: 30,
    target_word_budget: 40,
    key_concepts: ['Keypoint', 'Pose'],
    instructional_goal: 'Recall and state the foundational relevance of keypoint & pose via an instructional hook narrative..'
  };

  const text = narrationGen.generateNarration(legacyPlan, config);
  assert.ok(!text.toLowerCase().includes('recall and state'));
  assert.ok(!text.toLowerCase().includes('instructional hook narrative'));
  assert.ok(text.includes('nắm vững tầm quan trọng nền tảng của'));
});

test('Section 30 Test Cases 1 through 8: Context-Aware Narrative Planning', async () => {
  const { narrativePlannerService } = await import('../../src/pipeline/services/narrativePlannerService.ts');
  const narrationGen = new NarrationGenerator();
  const config = {
    language: 'vi',
    narration_language: 'vi',
    technical_terminology_language: 'en',
    preserve_technical_terms: true,
    natural_vietnamese: true,
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Linear algebra',
    targetDurationSeconds: 180,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };

  // TEST 1: Input slide: "Input Image → Kernel → Feature Map"
  // Expected: list_strategy = NONE, narration should explain relationship, must NOT start with "Thứ nhất..."
  const test1Sec = {
    section_id: 'S_test1',
    title: 'Convolutional Process',
    order: 3,
    pedagogical_function: 'mechanism',
    bloom_level: 'Apply',
    target_duration_sec: 35,
    target_word_budget: 30,
    key_concepts: ['kernel', 'feature map', 'input image'],
    instructional_goal: 'Hiểu quá trình kernel quét qua ảnh tạo feature map'
  };
  const test1Doc = {
    section_id: 'S_test1',
    title: 'Convolutional Process',
    order: 3,
    elements: [],
    raw_text: 'Input Image → Kernel → Feature Map'
  };
  const { analyses: a1, plans: p1 } = narrativePlannerService.planNarrative([test1Sec], [test1Doc]);
  const plan1 = { ...test1Sec, slide_analysis: a1.get('S_test1'), narrative_plan: p1.get('S_test1') };
  assert.equal(plan1.narrative_plan?.list_strategy, 'NONE');
  const narration1 = narrationGen.generateNarration(plan1, config, test1Doc.raw_text);
  assert.ok(!narration1.startsWith('Thứ nhất'));
  assert.ok(!narration1.includes('Thứ 1'));

  // TEST 2: Input slide: "Three types of pooling:\n1. Max Pooling\n2. Average Pooling\n3. Global Average Pooling"
  // Expected: list_strategy = CATEGORY_LIST, enumeration allowed
  const test2Sec = {
    section_id: 'S_test2',
    title: 'Three Types of Pooling',
    order: 4,
    pedagogical_function: 'definition',
    bloom_level: 'Understand',
    target_duration_sec: 35,
    target_word_budget: 30,
    key_concepts: ['Max Pooling', 'Average Pooling', 'Global Average Pooling'],
    instructional_goal: 'Phân biệt các loại pooling'
  };
  const test2Doc = {
    section_id: 'S_test2',
    title: 'Three Types of Pooling',
    order: 4,
    elements: [],
    raw_text: 'Three types of pooling:\n1. Max Pooling\n2. Average Pooling\n3. Global Average Pooling'
  };
  const { analyses: a2, plans: p2 } = narrativePlannerService.planNarrative([test2Sec], [test2Doc]);
  const plan2 = { ...test2Sec, slide_analysis: a2.get('S_test2'), narrative_plan: p2.get('S_test2') };
  assert.equal(plan2.narrative_plan?.list_strategy, 'CATEGORY_LIST');

  // TEST 3: Example slide after a theory slide
  // Expected: slide_role = EXAMPLE, narration references previous concept, does not repeat full theory
  const test3Sec = {
    section_id: 'S_test3',
    title: 'Convolution Example',
    order: 4,
    pedagogical_function: 'example',
    bloom_level: 'Apply',
    target_duration_sec: 30,
    target_word_budget: 25,
    key_concepts: ['kernel', 'matrix multiplication'],
    instructional_goal: 'Quan sát ví dụ trực quan'
  };
  const test3Doc = {
    section_id: 'S_test3',
    title: 'Convolution Example',
    order: 4,
    elements: [],
    raw_text: 'A 3x3 kernel sliding across a 5x5 image matrix'
  };
  const { analyses: a3, plans: p3 } = narrativePlannerService.planNarrative([test3Sec], [test3Doc]);
  const plan3 = { ...test3Sec, slide_analysis: a3.get('S_test3'), narrative_plan: p3.get('S_test3') };
  assert.equal(plan3.slide_analysis?.slide_role, 'EXAMPLE');
  const narration3 = narrationGen.generateNarration(plan3, config, test3Doc.raw_text);
  assert.ok(narration3.includes('ví dụ cụ thể') || narration3.includes('hình dung rõ hơn'));
  assert.ok(!narration3.includes('Chào mừng các bạn'));

  // TEST 4: Decorative title slide
  // Expected: slide_role = DECORATIVE, instructional_value = LOW, requires_explanation = false, short narration
  const test4Sec = {
    section_id: 'S_test4',
    title: 'Part 2: Advanced Topics',
    order: 5,
    pedagogical_function: 'hook',
    bloom_level: 'Remember',
    target_duration_sec: 15,
    target_word_budget: 10,
    key_concepts: ['Advanced Topics'],
    instructional_goal: 'Chuyển phần'
  };
  const test4Doc = {
    section_id: 'S_test4',
    title: 'Part 2: Advanced Topics',
    order: 5,
    elements: [{ element_id: 'el_title', type: 'title', text: 'Part 2: Advanced Topics' }],
    raw_text: 'Part 2: Advanced Topics'
  };
  const { analyses: a4, plans: p4 } = narrativePlannerService.planNarrative([test4Sec], [test4Doc]);
  const plan4 = { ...test4Sec, slide_analysis: a4.get('S_test4'), narrative_plan: p4.get('S_test4') };
  assert.equal(plan4.slide_analysis?.slide_role, 'DECORATIVE');
  assert.equal(plan4.slide_analysis?.instructional_value, 'low');
  assert.equal(plan4.slide_analysis?.requires_explanation, false);
  const narration4 = narrationGen.generateNarration(plan4, config, test4Doc.raw_text);
  assert.ok(narration4.split(/\s+/).length <= 15);

  // TEST 5: Summary slide
  // Expected: narrative_function = SUMMARIZE, synthesizes without major new concept
  const test5Sec = {
    section_id: 'S_test5',
    title: 'Lecture Summary & Key Takeaways',
    order: 6,
    pedagogical_function: 'summary',
    bloom_level: 'Evaluate',
    target_duration_sec: 30,
    target_word_budget: 35,
    key_concepts: ['CNN', 'Convolution', 'Pooling'],
    instructional_goal: 'Tổng kết toàn bộ chuyên đề'
  };
  const test5Doc = {
    section_id: 'S_test5',
    title: 'Lecture Summary & Key Takeaways',
    order: 6,
    elements: [],
    raw_text: 'Convolution trích xuất đặc trưng; Pooling nén kích thước'
  };
  const { analyses: a5, plans: p5 } = narrativePlannerService.planNarrative([test5Sec], [test5Doc]);
  const plan5 = { ...test5Sec, slide_analysis: a5.get('S_test5'), narrative_plan: p5.get('S_test5') };
  assert.equal(plan5.narrative_plan?.narrative_function, 'SUMMARIZE');

  // TEST 6 & 7: Slide-to-slide relationships (DEEPENS & ILLUSTRATES)
  const prevSec = {
    section_id: 'S2',
    title: 'CNN Architecture',
    order: 2,
    pedagogical_function: 'mechanism',
    bloom_level: 'Understand',
    target_duration_sec: 40,
    target_word_budget: 40,
    key_concepts: ['Layers', 'Architecture'],
    instructional_goal: 'Hiểu cấu trúc CNN'
  };
  const currSec = {
    section_id: 'S3',
    title: 'Convolution Layer',
    order: 3,
    pedagogical_function: 'mechanism',
    bloom_level: 'Apply',
    target_duration_sec: 40,
    target_word_budget: 40,
    key_concepts: ['kernel', 'convolution'],
    instructional_goal: 'Hiểu convolution'
  };
  const exampleSec = {
    section_id: 'S4',
    title: 'Convolution Example',
    order: 4,
    pedagogical_function: 'example',
    bloom_level: 'Apply',
    target_duration_sec: 35,
    target_word_budget: 35,
    key_concepts: ['sample matrix', 'kernel'],
    instructional_goal: 'Minh họa convolution'
  };

  const docs = [
    { section_id: 'S2', title: 'CNN Architecture', order: 2, elements: [], raw_text: 'Layers and weights' },
    { section_id: 'S3', title: 'Convolution Layer', order: 3, elements: [], raw_text: 'Kernel sliding mechanics' },
    { section_id: 'S4', title: 'Convolution Example', order: 4, elements: [], raw_text: 'Concrete 3x3 kernel calculation' }
  ];

  const { plans: pMulti } = narrativePlannerService.planNarrative([prevSec, currSec, exampleSec], docs);
  // TEST 6: S2 -> S3 relationship is DEEPENS
  assert.equal(pMulti.get('S3')?.relationship_to_previous?.type, 'DEEPENS');
  // TEST 7: S3 -> S4 relationship is ILLUSTRATES
  assert.equal(pMulti.get('S4')?.relationship_to_previous?.type, 'ILLUSTRATES');

  // TEST 8: Vietnamese technical terminology preservation
  const test8Text = 'CNN dùng kernel để quét qua từng vùng nhỏ của ảnh và tạo ra feature map.';
  const termRes = technicalTerminologyService.validateSentence(test8Text);
  assert.equal(termRes.isValid, true);
  assert.ok(termRes.preservedTerms.includes('CNN'));
  assert.ok(termRes.preservedTerms.includes('kernel'));
  assert.ok(termRes.preservedTerms.includes('feature map'));
});

test('Section 28 & 29 Demo Flow: S1 through S7 produces verified role classification and continuous narrative', async () => {
  const { narrativePlannerService } = await import('../../src/pipeline/services/narrativePlannerService.ts');
  const narrationGen = new NarrationGenerator();

  const demoSections = [
    { section_id: 'S1', title: 'What is CNN?', order: 1, pedagogical_function: 'hook', bloom_level: 'Remember', target_duration_sec: 30, target_word_budget: 35, key_concepts: ['CNN', 'neural network'], instructional_goal: 'Giới thiệu CNN' },
    { section_id: 'S2', title: 'CNN Architecture', order: 2, pedagogical_function: 'mechanism', bloom_level: 'Understand', target_duration_sec: 35, target_word_budget: 40, key_concepts: ['layer', 'weights'], instructional_goal: 'Kiến trúc CNN' },
    { section_id: 'S3', title: 'Convolution', order: 3, pedagogical_function: 'mechanism', bloom_level: 'Apply', target_duration_sec: 40, target_word_budget: 45, key_concepts: ['kernel', 'feature map'], instructional_goal: 'Cơ chế convolution' },
    { section_id: 'S4', title: 'Convolution Example', order: 4, pedagogical_function: 'example', bloom_level: 'Apply', target_duration_sec: 35, target_word_budget: 40, key_concepts: ['sample matrix', 'kernel'], instructional_goal: 'Ví dụ convolution' },
    { section_id: 'S5', title: 'Pooling', order: 5, pedagogical_function: 'mechanism', bloom_level: 'Understand', target_duration_sec: 35, target_word_budget: 40, key_concepts: ['max pooling', 'downsampling'], instructional_goal: 'Kỹ thuật pooling' },
    { section_id: 'S6', title: 'Real-world Application', order: 6, pedagogical_function: 'example', bloom_level: 'Apply', target_duration_sec: 35, target_word_budget: 40, key_concepts: ['object detection', 'computer vision'], instructional_goal: 'Ứng dụng thực tế' },
    { section_id: 'S7', title: 'Summary', order: 7, pedagogical_function: 'summary', bloom_level: 'Evaluate', target_duration_sec: 30, target_word_budget: 35, key_concepts: ['convolution', 'pooling', 'predictions'], instructional_goal: 'Tổng kết bài học' }
  ];

  const demoDocs = demoSections.map((s) => ({
    section_id: s.section_id,
    title: s.title,
    order: s.order,
    elements: [],
    raw_text: `${s.title}\n${s.key_concepts.join(' ')}`
  }));

  const { analyses, plans } = narrativePlannerService.planNarrative(demoSections, demoDocs);

  // Expected roles (Section 28)
  assert.ok(['INTRODUCTION', 'CORE_CONCEPT'].includes(analyses.get('S1').slide_role));
  assert.equal(analyses.get('S2').slide_role, 'KEY_EXPLANATION');
  assert.ok(['CORE_CONCEPT', 'KEY_EXPLANATION'].includes(analyses.get('S3').slide_role));
  assert.equal(analyses.get('S4').slide_role, 'EXAMPLE');
  assert.equal(analyses.get('S5').slide_role, 'KEY_EXPLANATION');
  assert.equal(analyses.get('S6').slide_role, 'APPLICATION');
  assert.equal(analyses.get('S7').slide_role, 'SUMMARY');

  // Expected relationships (Section 28)
  assert.equal(plans.get('S3').relationship_to_previous?.type, 'DEEPENS');
  assert.equal(plans.get('S4').relationship_to_previous?.type, 'ILLUSTRATES');
  assert.equal(plans.get('S5').relationship_to_previous?.type, 'CONTINUES');
  assert.equal(plans.get('S6').relationship_to_previous?.type, 'APPLIES');
  assert.equal(plans.get('S7').relationship_to_previous?.type, 'SUMMARIZES');

  // Verify non-numbered continuous narration (Section 29)
  const config = {
    language: 'vi',
    narration_language: 'vi',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Linear algebra',
    targetDurationSeconds: 240,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };

  const s3Plan = { ...demoSections[2], slide_analysis: analyses.get('S3'), narrative_plan: plans.get('S3') };
  const s3Narration = narrationGen.generateNarration(s3Plan, config, demoDocs[2].raw_text);
  // Grounded in the page (no canned topic text), no slide-reading, no numbering.
  assert.ok(/kernel|feature map/i.test(s3Narration), s3Narration);
  assert.ok(!/slide/i.test(s3Narration));
  assert.ok(!s3Narration.includes('Thứ nhất'));
  // The page title is a heading, not narration content.
  assert.ok(!s3Narration.startsWith('Convolution.'));

  const s4Plan = { ...demoSections[3], slide_analysis: analyses.get('S4'), narrative_plan: plans.get('S4') };
  const s4Narration = narrationGen.generateNarration(s4Plan, config, demoDocs[3].raw_text);
  assert.ok(s4Narration.includes('ví dụ'), s4Narration);
});

test('Natural & Focused Narration Upgrade: S1 Title Slide & S2 Hook Slide (Problem A, B, C & Section 25)', async () => {
  const { narrativePlannerService } = await import('../../src/pipeline/services/narrativePlannerService.ts');
  const narrationGen = new NarrationGenerator();

  const sections = [
    {
      section_id: 'S1',
      title: 'Keypoint & Pose',
      order: 1,
      pedagogical_function: 'introduction',
      bloom_level: 'Remember',
      target_duration_sec: 25,
      target_word_budget: 30,
      key_concepts: ['keypoint', 'pose'],
      instructional_goal: 'Giới thiệu Keypoint & Pose'
    },
    {
      section_id: 'S2',
      title: 'HÃY SUY NGHĨ...',
      order: 2,
      pedagogical_function: 'hook',
      bloom_level: 'Understand',
      target_duration_sec: 25,
      target_word_budget: 30,
      key_concepts: ['driver', 'steering wheel'],
      instructional_goal: 'Câu hỏi gợi mở về keypoint'
    }
  ];

  const docs = [
    {
      section_id: 'S1',
      title: 'Keypoint & Pose',
      order: 1,
      elements: [],
      raw_text: 'Keypoint & Pose\naicb-p2t4 · ngày 04 · chương 1 · data track · vinuniversity'
    },
    {
      section_id: 'S2',
      title: 'HÃY SUY NGHĨ...',
      order: 2,
      elements: [],
      raw_text: 'HÃY SUY NGHĨ...\nảnh chụp tài xế từ bên phải, bạn có xác định được đâu là tay trái và tay phải không?'
    }
  ];

  const { analyses, plans } = narrativePlannerService.planNarrative(sections, docs);

  // S1 Checks:
  const s1Analysis = analyses.get('S1');
  assert.equal(s1Analysis.slide_role, 'INTRODUCTION');
  assert.notEqual(s1Analysis.slide_role, 'CORE_CONCEPT');
  assert.equal(s1Analysis.core_message, 'Giới thiệu chủ đề Keypoint & Pose.');
  assert.ok(s1Analysis.excluded_content.length > 0);
  assert.ok(s1Analysis.excluded_content.some((c) => c.includes('aicb-p2t4') || c.includes('ngày 04') || c.includes('data track')));

  const config = {
    language: 'vi',
    narration_language: 'vi',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Linear algebra',
    targetDurationSeconds: 120,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };

  const s1Plan = { ...sections[0], slide_analysis: s1Analysis, narrative_plan: plans.get('S1') };
  const s1Narration = narrationGen.generateNarration(s1Plan, config, docs[0].raw_text);

  // Assert S1 Narration is concise, focused, and free of metadata/filler
  assert.ok(s1Narration.includes('Chào mừng các bạn đến với bài học về Keypoint & Pose'));
  assert.ok(s1Narration.split(/\s+/).length <= 40, 'Intro stays short');
  assert.ok(!s1Narration.includes('aicb-p2t4'));
  assert.ok(!s1Narration.includes('ngày 04'));
  assert.ok(!s1Narration.includes('chương 1'));
  assert.ok(!s1Narration.includes('data track'));
  assert.ok(!s1Narration.includes('vinuniversity'));
  assert.ok(!s1Narration.includes('Đồng thời'));

  // S2 Checks:
  const s2Analysis = analyses.get('S2');
  assert.equal(s2Analysis.slide_role, 'HOOK');
  assert.notEqual(s2Analysis.slide_role, 'MECHANISM');
  assert.notEqual(s2Analysis.slide_role, 'KEY_EXPLANATION');
  assert.equal(s2Analysis.core_message, 'Đặt ra vấn đề về việc xác định keypoint và pose từ một góc nhìn cụ thể.');

  const s2Plan = { ...sections[1], slide_analysis: s2Analysis, narrative_plan: plans.get('S2') };
  const s2Narration = narrationGen.generateNarration(s2Plan, config, docs[1].raw_text);

  // Assert S2 Narration is an open curiosity question, without mechanical template repetitions
  assert.ok(!s2Narration.includes('Trước khi đi vào phần kỹ thuật'));
  assert.ok(s2Narration.includes('tay trái') && s2Narration.includes('tay phải'));
  assert.ok(!s2Narration.includes('Từ nền tảng này, chúng ta sẽ tiếp tục khám phá'));
  assert.ok(!s2Narration.includes('Đồng thời'));
});

test('Module 4 Quality Guard: detects metadata leak, overexplanation, and generic filler', () => {
  const guard = new QualityVisualGuard();
  const blueprint = {
    blueprint_id: 'bp_test',
    lecture_title: 'Keypoint & Pose',
    total_target_duration_sec: 60,
    total_word_budget: 70,
    sections: [
      {
        section_id: 'S1',
        title: 'Keypoint & Pose',
        order: 1,
        pedagogical_function: 'introduction',
        bloom_level: 'Remember',
        target_duration_sec: 30,
        target_word_budget: 35,
        key_concepts: ['keypoint', 'pose'],
        instructional_goal: 'Intro',
        slide_analysis: {
          slide_role: 'INTRODUCTION',
          importance: 'high',
          instructional_value: 'medium',
          content_type: 'title',
          core_message: 'Giới thiệu chủ đề Keypoint & Pose.',
          supporting_points: [],
          excluded_content: ['aicb-p2t4', 'ngày 04', 'chương 1'],
          requires_explanation: false,
          requires_transition: true
        }
      }
    ]
  };

  const docTree = {
    document_id: 'doc_test',
    source_type: 'pptx',
    source_filename: 'test.pptx',
    title: 'Keypoint & Pose',
    total_sections: 1,
    extraction_time_ms: 5,
    sections: [
      {
        section_id: 'S1',
        title: 'Keypoint & Pose',
        order: 1,
        elements: [],
        raw_text: 'aicb-p2t4 · ngày 04 · chương 1'
      }
    ]
  };

  const config = {
    language: 'vi',
    narration_language: 'vi',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Linear algebra',
    targetDurationSeconds: 60,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };

  // Leaked narration test input
  const dirtyScenes = [
    {
      section_id: 'S1',
      topic: 'Keypoint & Pose',
      order: 1,
      pedagogical_function: 'introduction',
      learning_goal: 'Intro',
      slide_analysis: blueprint.sections[0].slide_analysis,
      narrative_plan: {
        narrative_function: 'INTRODUCE',
        opening_strategy: 'DIRECT',
        body_strategy: 'BRIEF',
        closing_strategy: 'NONE',
        list_strategy: 'NONE',
        verbosity: 'minimal'
      },
      narration: {
        text: 'Chào mừng các bạn đến với Keypoint & Pose. Đồng thời, aicb-p2t4 · ngày 04 · chương 1...',
        word_count: 14,
        sentences: [{ id: 's1', text: 'Chào mừng các bạn đến với Keypoint & Pose. Đồng thời, aicb-p2t4 · ngày 04 · chương 1...', prosody: { pause_after_ms: 500, pause_type: 'semantic', rate: 'medium', energy: 'medium', emphasis: [] } }]
      },
      prosody_plan: {
        sentences: [{ id: 's1', text: 'Chào mừng các bạn đến với Keypoint & Pose. Đồng thời, aicb-p2t4 · ngày 04 · chương 1...', prosody: { pause_after_ms: 500, pause_type: 'semantic', rate: 'medium', energy: 'medium', emphasis: [] } }],
        total_speaking_sec: 25,
        total_pause_sec: 5,
        effective_scene_duration_sec: 30,
        ssml_full: '<speak>test</speak>'
      },
      visual_cues: [{ cue_id: 'c1', timestamp_sec: 1, visual_type: 'KEY_TEXT_EMPHASIS', visual_purpose: 'Introduce title', learning_support: 'Support learners understanding topic', visual_need: 'essential', display_duration_sec: 5, visual_content: {} }],
      section_summary: 'Intro',
      scene_start_time_sec: 0,
      scene_end_time_sec: 30,
      scene_duration_sec: 30
    }
  ];

  const { qualityReport, verifiedIr } = guard.validateAndCertify(dirtyScenes, blueprint, docTree, config);

  // Assert metadata was stripped by auto-repair
  const cleanScene = verifiedIr.scenes[0];
  assert.ok(!cleanScene.narration.text.includes('aicb-p2t4'));
  assert.ok(!cleanScene.narration.text.includes('ngày 04'));
  assert.ok(!cleanScene.narration.text.includes('chương 1'));
  assert.ok(!cleanScene.narration.text.includes('Đồng thời'));
  assert.ok(qualityReport.auto_repairs_applied.some((r) => r.includes('METADATA_LEAK')));
});

test('Whole-Lesson Understanding: generates LessonModel, ContentPrioritization, and TeachingUnits', async () => {
  const tree = getBuiltinCnnTree();
  const planner = new InstructionalPlanner();
  const config = {
    language: 'vi',
    narration_language: 'vi',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Python, Linear Algebra',
    targetDurationSeconds: 180,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };

  const bp = await planner.plan(tree, config);

  // 1. Verify LessonModel
  assert.ok(bp.lesson_model, 'LessonModel must be present in blueprint');
  assert.ok(bp.lesson_model.lesson_goal.length > 10);
  assert.ok(bp.lesson_model.core_concepts.length >= 2);
  assert.ok(bp.lesson_model.concept_relationships.length >= 1);
  assert.ok(bp.lesson_model.learning_needs.length >= 2);

  // 2. Verify ContentPrioritization
  assert.ok(bp.content_prioritization, 'ContentPrioritization must be present in blueprint');
  assert.ok(bp.content_prioritization.total_items >= 1);
  assert.ok(bp.content_prioritization.core_items.length >= 1);

  // 3. Verify TeachingUnits
  assert.ok(bp.teaching_units, 'TeachingUnits must be present in blueprint');
  assert.ok(bp.teaching_units.length >= 1);
  for (const unit of bp.teaching_units) {
    assert.ok(unit.unit_id);
    assert.ok(unit.slide_ids.length >= 1);
    assert.ok(unit.narration_focus);
  }
});

test('Pipeline Orchestrator propagates Whole-Lesson structures to VerifiedCLSG_IR', async () => {
  const orchestrator = new PipelineOrchestrator();
  const config = {
    language: 'vi',
    narration_language: 'vi',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Python, Linear Algebra',
    targetDurationSeconds: 180,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };

  const res = await orchestrator.runFullPipeline('cnn_intro.pptx', 'cnn_intro.pptx', config);
  assert.ok(res.verifiedIr.lesson_model, 'VerifiedCLSG_IR must have lesson_model');
  assert.ok(res.verifiedIr.content_prioritization, 'VerifiedCLSG_IR must have content_prioritization');
  assert.ok(res.verifiedIr.teaching_units, 'VerifiedCLSG_IR must have teaching_units');
  assert.equal(res.verifiedIr.teaching_units.length, res.blueprint.teaching_units?.length);
});

test('LLM Router and Cache: online router and cache hit validation', async () => {
  const { llmRouter } = await import('../../src/services/llm/LLMRouter.ts');
  const { GeminiProvider } = await import('../../src/services/llm/GeminiProvider.ts');

  // Verify online GeminiProvider instance
  const gemini = new GeminiProvider('test-api-key');
  assert.equal(gemini.providerId, 'multi_provider_llm');
  assert.equal(gemini.isDemo, false);

  const tree = getBuiltinCnnTree();
  const config = {
    language: 'vi',
    narration_language: 'vi',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Python',
    targetDurationSeconds: 180,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };

  // First call computes / retrieves
  const res1 = await llmRouter.generateLessonUnderstanding(tree, config);
  assert.ok(res1.lesson_goal);

  // Second call with same parameters hits memory cache instantly
  const start = Date.now();
  const res2 = await llmRouter.generateLessonUnderstanding(tree, config);
  const elapsed = Date.now() - start;

  assert.deepEqual(res1, res2);
  assert.ok(elapsed < 10, 'Cache hit should take under 10ms');
});

test('Anti-Repetition & 4-Stage Narrative Flow: S1 (Hook) -> S2 (Think) -> S3 (Example) -> S4 (Mechanism)', async () => {
  const { narrativePlannerService } = await import('../../src/pipeline/services/narrativePlannerService.ts');
  const narrationGen = new NarrationGenerator();
  const sections = [
    {
      section_id: 'S1',
      title: 'Nhận diện tư thế người',
      order: 1,
      pedagogical_function: 'hook',
      bloom_level: 'Remember',
      target_duration_sec: 25,
      target_word_budget: 30,
      key_concepts: ['Keypoint', 'Pose Estimation'],
      instructional_goal: 'Đặt vấn đề và tạo sự tò mò'
    },
    {
      section_id: 'S2',
      title: 'HÃY SUY NGHĨ...',
      order: 2,
      pedagogical_function: 'explanation',
      bloom_level: 'Understand',
      target_duration_sec: 25,
      target_word_budget: 30,
      key_concepts: ['Occlusion', 'Symmetry'],
      instructional_goal: 'Kích thích tư duy về độ khó'
    },
    {
      section_id: 'S3',
      title: 'Trường hợp thực tế',
      order: 3,
      pedagogical_function: 'example',
      bloom_level: 'Apply',
      target_duration_sec: 25,
      target_word_budget: 30,
      key_concepts: ['Che khuất', 'Keypoint xung quanh'],
      instructional_goal: 'Minh họa ví dụ cụ thể'
    },
    {
      section_id: 'S4',
      title: 'Cơ chế giải quyết',
      order: 4,
      pedagogical_function: 'mechanism',
      bloom_level: 'Analyze',
      target_duration_sec: 30,
      target_word_budget: 35,
      key_concepts: ['Mối quan hệ không gian', 'Đồ thị khung xương'],
      instructional_goal: 'Giải thích cơ chế giải quyết'
    }
  ];

  const docSections = [
    {
      section_id: 'S1',
      title: 'Nhận diện tư thế người',
      order: 1,
      elements: [],
      raw_text: 'Nhận diện tư thế người\nảnh chụp tài xế từ bên phải, góc nhìn nghiêng'
    },
    {
      section_id: 'S2',
      title: 'HÃY SUY NGHĨ...',
      order: 2,
      elements: [],
      raw_text: 'HÃY SUY NGHĨ...\nảnh chụp tài xế từ bên phải, bạn có xác định được đâu là tay trái và tay phải không?'
    },
    {
      section_id: 'S3',
      title: 'Trường hợp thực tế',
      order: 3,
      elements: [],
      raw_text: 'Trường hợp thực tế\nTrong hình này, cánh tay bị che một phần khi vô-lăng chắn tầm nhìn'
    },
    {
      section_id: 'S4',
      title: 'Cơ chế giải quyết',
      order: 4,
      elements: [],
      raw_text: 'Cơ chế giải quyết\nĐể giải quyết vấn đề này, mô hình học mối quan hệ không gian giữa các keypoint'
    }
  ];

  // 1. Narrative Planner
  const { analyses, plans } = narrativePlannerService.planNarrative(sections, docSections);

  assert.equal(analyses.get('S1').slide_role, 'HOOK', 'S1 must be classified as HOOK');
  assert.equal(analyses.get('S2').slide_role, 'THINK', 'S2 must be classified as THINK');
  assert.equal(analyses.get('S3').slide_role, 'EXAMPLE', 'S3 must be classified as EXAMPLE');
  assert.equal(analyses.get('S4').slide_role, 'MECHANISM', 'S4 must be classified as MECHANISM');

  // 2. Sequential Generator with GlobalNarrativeContext
  const config = {
    language: 'vi',
    narration_language: 'vi',
    learnerLevel: 'undergraduate',
    priorKnowledge: 'Linear algebra',
    targetDurationSeconds: 120,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  };

  const generatedNarrations = [];
  const usedOpenings = new Set();
  const usedPhrases = new Set();
  const usedConcepts = new Set();

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const docSec = docSections[i];
    const analysis = analyses.get(sec.section_id);
    const plan = plans.get(sec.section_id);

    const prevSectionsInfo = sections.slice(0, i).map((s, idx) => ({
      section_id: s.section_id,
      title: s.title,
      role: analyses.get(s.section_id)?.slide_role || 'KEY_EXPLANATION',
      core_message: analyses.get(s.section_id)?.core_message,
      opening_used: generatedNarrations[idx]?.split(/[.?!]/)[0]?.trim()
    }));

    const globalContext = {
      lesson_topic: 'Keypoint & Pose Estimation',
      previous_sections: prevSectionsInfo,
      current_section: {
        id: sec.section_id,
        type: analysis.slide_role
      },
      next_section: i < sections.length - 1 ? {
        id: sections[i + 1].section_id,
        type: analyses.get(sections[i + 1].section_id)?.slide_role || 'KEY_EXPLANATION'
      } : undefined,
      used_phrases: Array.from(usedPhrases),
      used_concepts: Array.from(usedConcepts),
      used_openings: Array.from(usedOpenings)
    };

    const narrationContext = {
      previousPlan: i > 0 ? { ...sections[i - 1], slide_analysis: analyses.get(sections[i - 1].section_id) } : undefined,
      nextPlan: i < sections.length - 1 ? { ...sections[i + 1], slide_analysis: analyses.get(sections[i + 1].section_id) } : undefined,
      globalContext,
      usedOpenings,
      usedPhrases,
      usedConcepts
    };

    const sPlan = { ...sec, slide_analysis: analysis, narrative_plan: plan };
    const narration = narrationGen.generateNarration(sPlan, config, docSec.raw_text, narrationContext);
    generatedNarrations.push(narration);

    const firstSentence = narration.split(/[.?!]/)[0]?.trim();
    if (firstSentence) usedOpenings.add(firstSentence.toLowerCase());
  }

  // 3. Assertions on Content Uniqueness & Flow
  const [s1Text, s2Text, s3Text, s4Text] = generatedNarrations;

  // Rule: NO repeated "Trước khi đi vào phần kỹ thuật"
  for (let i = 0; i < generatedNarrations.length; i++) {
    const text = generatedNarrations[i];
    assert.ok(
      !text.includes('Trước khi đi vào phần kỹ thuật'),
      `Section S${i + 1} must NOT contain 'Trước khi đi vào phần kỹ thuật'`
    );
    assert.ok(
      !text.includes('Sau khi đã nắm vững'),
      `Section S${i + 1} must NOT contain 'Sau khi đã nắm vững'`
    );
  }

  // Rule: Distinct openings across all 4 sections
  const openings = generatedNarrations.map((t) => t.split(/[.?!]/)[0]?.trim().toLowerCase());
  const uniqueOpenings = new Set(openings);
  assert.equal(
    uniqueOpenings.size,
    openings.length,
    'All section openings must be distinct; no mechanical templates copied'
  );

  // S1: Hook is grounded in its own page (no canned pose sentence)
  assert.ok(s1Text.includes('tài xế'), `S1 must use its page content: ${s1Text}`);
  assert.ok(!s1Text.includes('Bạn thử nhìn một người từ góc này'), 'No canned hook text');

  // S2: Think voices the page's own question
  assert.ok(s2Text.includes('xác định được đâu là'), 'S2 must stimulate reflection');

  // S3: Example gives concrete case
  assert.ok(
    s3Text.includes('cánh tay bị che một phần') || s3Text.includes('khớp khuỷu tay'),
    'S3 must illustrate with a concrete case study'
  );

  // S4: Mechanism explains how model resolves problem
  assert.ok(
    s4Text.includes('mối quan hệ không gian') || s4Text.includes('giải quyết vấn đề này'),
    'S4 must explain resolution mechanism'
  );

  // 4. Quality Guard anti-repetition audit passes with 0 violations
  const guard = new QualityVisualGuard();
  const bp = {
    blueprint_id: 'bp_test_narrative',
    lecture_title: 'Keypoint & Pose',
    total_target_duration_sec: 100,
    total_word_budget: 120,
    sections: sections.map((s) => ({
      ...s,
      slide_analysis: analyses.get(s.section_id),
      narrative_plan: plans.get(s.section_id)
    }))
  };

  const draftScenes = generatedNarrations.map((n, idx) => {
    const sec = sections[idx];
    const wordCount = n.split(/\s+/).length;
    return {
      section_id: sec.section_id,
      topic: sec.title,
      order: sec.order,
      pedagogical_function: sec.pedagogical_function,
      learning_goal: sec.instructional_goal,
      slide_analysis: analyses.get(sec.section_id),
      narrative_plan: plans.get(sec.section_id),
      narration: {
        text: n,
        word_count: wordCount,
        sentences: [{ id: `s${idx}_1`, text: n, prosody: { pause_after_ms: 300, pause_type: 'semantic', rate: 'medium', energy: 'medium', emphasis: [] } }]
      },
      prosody_plan: {
        sentences: [{ id: `s${idx}_1`, text: n, prosody: { pause_after_ms: 300, pause_type: 'semantic', rate: 'medium', energy: 'medium', emphasis: [] } }],
        total_speaking_sec: 22,
        total_pause_sec: 3,
        effective_scene_duration_sec: 25,
        ssml_full: `<speak>${n}</speak>`
      },
      visual_cues: [],
      section_summary: sec.title,
      scene_start_time_sec: idx * 25,
      scene_end_time_sec: (idx + 1) * 25,
      scene_duration_sec: 25
    };
  });

  const docTree = {
    document_id: 'doc_test_narrative',
    source_type: 'pptx',
    source_filename: 'pose_lesson.pptx',
    title: 'Keypoint & Pose',
    total_sections: 4,
    extraction_time_ms: 5,
    sections: docSections
  };

  const { qualityReport, verifiedIr } = guard.validateAndCertify(draftScenes, bp, docTree, config);
  assert.ok(qualityReport.overall_quality_score >= 0.80, `Quality score should be >= 0.80 (got ${qualityReport.overall_quality_score})`);
  assert.equal(
    verifiedIr.scenes.every((s) => !s.narration.text.includes('Trước khi đi vào phần kỹ thuật')),
    true,
    'Repaired scenes must not inject hardcoded templates'
  );
  assert.equal(
    verifiedIr.scenes.every((s) => !s.narration.text.includes('Sau khi đã nắm vững')),
    true,
    'Repaired scenes must not inject hardcoded bridge templates'
  );
});

test('Content Purification Engine: strictly separates Learning Content from Metadata, Labels, Pagination, and Fillers', () => {
  // 1. User's exact problematic test case:
  const rawInput =
    'Từ nền tảng của HÃY SUY NGHĨ, chúng ta đi sâu vào cơ chế chi tiết. Nội dung bài học. Qua đó, mô hình đọc pose thế nào, giúp đi sâu vào kiến trúc pose estimators và. chuẩn bị dữ liệu pose và kiểm tra chất lượng và giảng viên (thành phần chuyên sâu ở các phần cảnh sau) aicb · 1 / 52. chúng ta sẽ tiếp tục khám phá các bước tiếp theo trong bài giảng.';

  const result = contentPurifierService.purifyNarration(rawInput, {
    title: 'Cơ chế Pose Estimators',
    role: 'MECHANISM'
  });

  const cleaned = result.cleanedText;

  // Assertions against all forbidden elements
  assert.ok(!cleaned.includes('HÃY SUY NGHĨ'), 'Must NOT contain section label HÃY SUY NGHĨ');
  assert.ok(!cleaned.includes('Nội dung bài học'), 'Must NOT contain agenda header Nội dung bài học');
  assert.ok(!cleaned.includes('giảng viên'), 'Must NOT contain instructor notes prefix');
  assert.ok(!cleaned.includes('thành phần chuyên sâu'), 'Must NOT contain parenthetical developer notes');
  assert.ok(!cleaned.includes('aicb'), 'Must NOT contain course code aicb');
  assert.ok(!cleaned.includes('1 / 52'), 'Must NOT contain pagination 1 / 52');
  assert.ok(!cleaned.includes('chúng ta sẽ tiếp tục khám phá các bước tiếp theo'), 'Must NOT contain mechanical filler closing');
  assert.ok(!cleaned.includes('và.'), 'Must NOT contain broken dangling syntax và.');

  // Verify it passes all 8 validation checks
  const validation = contentPurifierService.validateNarration(cleaned);
  assert.equal(validation.isValid, true, `Purified output must pass all 8 validation checks, failures: ${validation.failures.join(', ')}`);

  // Verify teacher speech authenticity
  assert.ok(cleaned.length > 30, 'Cleaned text must maintain substantial instructional content');
  assert.ok(cleaned.toLowerCase().includes('mô hình') && cleaned.toLowerCase().includes('pose'), 'Must preserve key domain terminology');
});

test('Black Square Bullet & Malformed Range Normalization: eliminates ■ and converts 1^-4 to clean readable range', () => {
  // 1. User's exact reported case
  const userCase = 'nose — mũi, ■ 1^-4 mắt trái, mắt phải, tai trái, tai phải, ■ 5^-10 vai...';
  const purified = contentPurifierService.normalizeUnicodeAndSymbols(userCase);

  // Assertions
  assert.ok(!purified.includes('■'), 'Must NOT contain black square character ■');
  assert.ok(!purified.includes('1^-4'), 'Must NOT contain malformed token 1^-4');
  assert.ok(!purified.includes('5^-10'), 'Must NOT contain malformed token 5^-10');
  assert.ok(purified.includes('1–4: mắt trái'), 'Must convert 1^-4 to clean range 1–4:');
  assert.ok(purified.includes('5–10: vai'), 'Must convert 5^-10 to clean range 5–10:');
  assert.equal(
    purified,
    'nose — mũi, 1–4: mắt trái, mắt phải, tai trái, tai phải, 5–10: vai...'
  );

  // 2. Full purification pipeline validation
  const fullResult = contentPurifierService.purifyNarration(userCase);
  assert.ok(!fullResult.cleanedText.includes('■'), 'Purified narration must not contain ■');
  assert.ok(!fullResult.cleanedText.includes('1^-4'), 'Purified narration must not contain 1^-4');
  assert.ok(fullResult.passedValidation, `Validation must pass: ${fullResult.validationIssues.join(', ')}`);

  // 3. LaTeX formula preservation
  const mathInput = 'Trong công thức $10^{-4}$ và $E = mc^2$, các keypoint gồm ■ 1^-4 mắt trái.';
  const mathCleaned = contentPurifierService.normalizeUnicodeAndSymbols(mathInput);
  assert.ok(mathCleaned.includes('$10^{-4}$'), 'Must preserve LaTeX exponent formula $10^{-4}$');
  assert.ok(mathCleaned.includes('$E = mc^2$'), 'Must preserve LaTeX formula $E = mc^2$');
  assert.ok(!mathCleaned.includes('■'), 'Must strip ■ even when near math formulas');
  assert.ok(mathCleaned.includes('1–4: mắt trái'), 'Must convert 1^-4 to 1–4:');

  // 4. Private Use Area (PUA) & Replacement Character (\uFFFD) handling
  const puaInput = '\uF0A7 1^-4 mắt trái, tai phải \uFFFD 5^-10 vai';
  const puaCleaned = contentPurifierService.normalizeUnicodeAndSymbols(puaInput);
  assert.ok(!puaCleaned.includes('\uF0A7'), 'Must strip PUA Wingdings character');
  assert.ok(!puaCleaned.includes('\uFFFD'), 'Must strip Unicode replacement character');
  assert.ok(puaCleaned.includes('1–4: mắt trái'), 'Must normalize range with PUA prefix');
  assert.ok(puaCleaned.includes('5–10: vai'), 'Must normalize range with replacement char');

  // 5. Validation Check 9 catches raw glyphs
  const badValidation = contentPurifierService.validateNarration('Nội dung có ■ và 1^-4');
  assert.equal(badValidation.isValid, false);
  assert.ok(badValidation.failures.includes('CHECK_9_GLYPH_OR_MALFORMED_TOKEN_PRESENT'));
});

test('Admin Dashboard & RBAC: enforces role authorizations, bootstraps hkthien@husc.edu.vn, and verifies Langfuse integration', async () => {
  const { rbacService, BOOTSTRAP_ADMIN_EMAIL } = await import('../../src/services/rbacService.ts');
  const { adminTelemetryService } = await import('../../src/services/adminTelemetryService.ts');

  // 1. Root admin bootstrap verification
  const adminUser = {
    uid: 'u_admin_test',
    email: 'hkthien@husc.edu.vn',
    displayName: 'Huỳnh Khắc Thiên',
    role: 'admin'
  };
  assert.equal(rbacService.isAdmin(adminUser), true, 'hkthien@husc.edu.vn must be recognized as Admin');
  assert.equal(rbacService.hasPermission(adminUser, 'view_dashboard'), true);
  assert.equal(rbacService.hasPermission(adminUser, 'view_content_quality'), true);
  assert.equal(rbacService.hasPermission(adminUser, 'manage_prompts'), true);
  assert.equal(rbacService.hasPermission(adminUser, 'view_langfuse'), true);
  assert.equal(rbacService.getUserPermissions(adminUser).length, 10, 'Admin must possess all 10 RBAC permissions');

  // Case insensitivity
  const adminUpper = { uid: 'u2', email: 'HKTHIEN@HUSC.EDU.VN', displayName: 'Thien', role: 'instructor' };
  assert.equal(rbacService.isAdmin(adminUpper), true, 'Admin email check must be case-insensitive');

  // 2. Normal user rejection
  const normalUser = {
    uid: 'u_student',
    email: 'student@example.com',
    displayName: 'Student',
    role: 'student'
  };
  assert.equal(rbacService.isAdmin(normalUser), false, 'Normal student must NOT have admin access');
  assert.equal(rbacService.hasPermission(normalUser, 'view_dashboard'), false);
  assert.equal(rbacService.hasPermission(normalUser, 'manage_prompts'), false);

  const reqCheck = rbacService.validateAdminRequest(normalUser);
  assert.equal(reqCheck.authorized, false);
  assert.ok(reqCheck.error?.includes('FORBIDDEN_NOT_ADMIN'));

  // 3. Telemetry KPIs & Langfuse Deep Link Verification
  // With no real projects (the built-in demo does not count) KPIs must report "no data", not a fabricated score.
  const kpis = adminTelemetryService.getOverviewKPIs('7d');
  assert.equal(kpis.totalLessons, 0);
  assert.equal(kpis.contentQualityScore, 0);
  assert.equal(kpis.aiRequests, 0);

  const langfuseUrl = adminTelemetryService.getLangfuseTraceUrl('tr_test_123');
  assert.ok(langfuseUrl.includes('https://cloud.langfuse.com/project/') && langfuseUrl.includes('traces/tr_test_123'));

  const promptUrl = adminTelemetryService.getLangfusePromptUrl('section_generator', 'v2.1');
  assert.ok(promptUrl.includes('prompts/section_generator?v=v2.1'));

  // 4. Content vs Telemetry metadata isolation test (Rule 15)
  const qualityData = adminTelemetryService.getContentQualityData();
  assert.ok(Array.isArray(qualityData.issues));
  assert.ok(!qualityData.issues.some((iss) => iss.id.startsWith('iss_pose_')), 'no injected demo issues');
  qualityData.issues.forEach((iss) => {
    // Assert learner-facing cleaned output NEVER contains trace ID or metadata
    assert.ok(!iss.cleanedOutput.includes(iss.traceId || 'trace'), 'Learner content must not contain trace ID');
    assert.ok(!iss.cleanedOutput.includes('aicb'), 'Learner content must not contain administrative metadata');
    assert.ok(!iss.cleanedOutput.includes('■'), 'Learner content must not contain black square glyph');
  });
});




// ---------------------------------------------------------------------------
// Discourse policy, headings, keywords, knowledge tree, terminology regressions
// ---------------------------------------------------------------------------

test('Connective policy keeps only licensed connectives and caps density', async () => {
  const { applyConnectivePolicy, countLeadingConnectives } = await import('../../src/pipeline/services/discoursePolicy.ts');
  const scenes = [
    {
      text: 'Tuy nhiên, CNN xử lý ảnh bằng kernel. Vì vậy, kernel trượt qua ảnh. Mỗi vị trí cho ra một giá trị. Các giá trị tạo thành feature map.',
      ctx: { sceneId: 'S1', role: 'KEY_EXPLANATION' }
    },
    {
      text: 'Pooling không giữ vị trí chính xác của đặc trưng. Tuy nhiên, nó giúp mô hình bền vững hơn. Do đó, mô hình ít bị ảnh hưởng bởi dịch chuyển nhỏ. Kích thước feature map cũng giảm.',
      ctx: { sceneId: 'S2', role: 'KEY_EXPLANATION' }
    }
  ];
  const { texts, stats } = applyConnectivePolicy(scenes, 'vi');
  assert.ok(!texts[0].startsWith('Tuy nhiên'), 'no connective at scene start');
  assert.ok(texts[0].startsWith('CNN'), 'sentence re-capitalized');
  assert.ok(!/Vì vậy, kernel/.test(texts[0]), 'result connective without a stated cause is removed');
  // Scene 2: contrast is licensed ("không giữ")
  assert.ok(texts[1].includes('Tuy nhiên, nó giúp'), texts[1]);
  assert.ok(stats.removed.length >= 3);
  const after = countLeadingConnectives(texts.join(' '), 'vi');
  assert.ok(after.connectives / after.sentences <= 0.25 + 1e-9);
});

test('Heading policy speaks each heading once and drops heading-only transitions', async () => {
  const { applyHeadingPolicy, countHeadingMentions } = await import('../../src/pipeline/services/discoursePolicy.ts');
  const specs = [
    { sceneId: 'S1', sectionTitle: 'Mạng nơ-ron tích chập', chapterId: 'ch1', chapterTitle: 'Chương 1: Nền tảng thị giác máy', isChapterFirstPage: true },
    { sceneId: 'S2', sectionTitle: 'Phép toán pooling', chapterId: 'ch1', chapterTitle: 'Chương 1: Nền tảng thị giác máy', isChapterFirstPage: false }
  ];
  const texts = [
    'Chúng ta bắt đầu với Chương 1: Nền tảng thị giác máy. Mạng nơ-ron tích chập dùng kernel. Chúng ta cùng bước sang Phép toán pooling ngay sau đây.',
    'Phép toán pooling giảm kích thước feature map. Như đã nói trong Chương 1: Nền tảng thị giác máy, pooling rất phổ biến.'
  ];
  const before = countHeadingMentions(texts, specs);
  const { texts: out, stats } = applyHeadingPolicy(texts, specs, { language: 'vi' });
  const after = countHeadingMentions(out, specs);
  assert.ok(before.repeated > 0);
  assert.equal(after.repeated, 0, JSON.stringify(out));
  assert.ok(!out[0].includes('bước sang'), 'heading-only transition dropped');
  assert.ok(out[1].startsWith('Phép toán pooling'), 'own heading kept once');
  assert.ok(stats.sentencesDropped >= 1);
});

test('Keyword extractor keeps Vietnamese diacritics and weights title/dictionary terms', async () => {
  const { extractLocalKeywords } = await import('../../src/pipeline/services/keywordExtractor.ts');
  const pages = [
    { section_id: 'S1', title: 'Mạng nơ-ron tích chập', body: 'Mạng nơ-ron tích chập dùng kernel để tạo feature map. Kernel trượt trên ảnh.' },
    { section_id: 'S2', title: 'Pooling', body: 'Max pooling giảm kích thước feature map và giữ đặc trưng mạnh nhất.' },
    { section_id: 'S3', title: 'Huấn luyện', body: 'Backpropagation cập nhật trọng số bằng gradient descent.' }
  ];
  const kw = extractLocalKeywords(pages, { maxPerPage: 5, minWeight: 0.2 });
  const s1 = kw.get('S1').map((k) => k.term.toLowerCase());
  assert.ok(s1.some((t) => t.includes('tích chập')), `diacritics kept: ${s1}`);
  assert.equal(kw.get('S1')[0].weight, 1, 'weights normalized per page');
  assert.ok(kw.get('S3').some((k) => /gradient descent|backpropagation/i.test(k.term)));
  for (const list of kw.values()) assert.ok(list.length <= 5);
});

test('Knowledge tree: page edits sum up, chapter edits distribute down, locks and exclusions hold', async () => {
  const ops = await import('../../src/pipeline/services/knowledgeTreeOps.ts');
  const page = (id, sec) => ({ id, kind: 'page', title: id, section_id: id.replace('pg_', ''), duration_sec: sec, children: [] });
  const tree = {
    tree_id: 't',
    document_id: 'd',
    created_at: '',
    updated_at: '',
    model: 'local',
    settings: { min_keyword_weight: 0.3, max_keywords_per_page: 5, max_pages: 50, target_duration_sec: 120 },
    stats: {},
    root: {
      id: 'doc_root',
      kind: 'document',
      title: 'Doc',
      children: [
        { id: 'ch_1', kind: 'chapter', title: 'A', children: [page('pg_S1', 30), page('pg_S2', 30)] },
        { id: 'ch_2', kind: 'chapter', title: 'B', children: [page('pg_S3', 60)] }
      ]
    }
  };
  let t = ops.recompute(tree);
  assert.equal(t.root.duration_sec, 120);

  t = ops.setNodeDuration(t, 'pg_S1', 50);
  assert.equal(ops.findNode(t.root, 'ch_1').duration_sec, 80);
  assert.equal(t.root.duration_sec, 140);

  t = ops.toggleLock(t, 'pg_S1');
  t = ops.setNodeDuration(t, 'ch_1', 100);
  assert.equal(ops.findNode(t.root, 'pg_S1').duration_sec, 50, 'locked page keeps its time');
  assert.equal(ops.findNode(t.root, 'pg_S2').duration_sec, 50);

  t = ops.toggleExclude(t, 'pg_S3');
  assert.equal(t.root.duration_sec, t.settings.target_duration_sec, 'target kept after exclusion');
  const o = ops.treeToPipelineOverrides(t);
  assert.ok(o.excludedSections.has('S3'));
  assert.equal(o.chapterOf.S1.isFirstPage, true);
  assert.equal(o.chapterOf.S2.isFirstPage, false);
});

test('Terminology: "feature map" is not rewritten to "feature mAP"; English titles are not translated', () => {
  const r1 = technicalTerminologyService.resolveAndPreserveSentence('Kernel tạo ra feature map sau mỗi lần trượt.');
  assert.ok(r1.resolvedText.includes('feature map'), r1.resolvedText);
  assert.ok(!r1.resolvedText.includes('feature mAP'));
  const r2 = technicalTerminologyService.resolveAndPreserveSentence('Image Processing Model');
  assert.equal(r2.resolvedText, 'Image Processing Model');
});

test('Pipeline run emits a benchmark log with metrics and per-call token accounting', async () => {
  const orchestrator = new PipelineOrchestrator();
  const res = await orchestrator.runFullPipeline(getBuiltinCnnTree(), 'cnn_intro.pptx', {
    language: 'vi',
    narration_language: 'vi',
    learnerLevel: 'undergraduate',
    priorKnowledge: '',
    targetDurationSeconds: 180,
    targetWpm: 140,
    narrationStyle: 'academic',
    visualDensity: 'balanced'
  });
  const log = res.benchmark;
  assert.equal(log.kind, 'pipeline');
  assert.ok(log.metrics);
  assert.equal(log.metrics.dar_p_error_pct, res.qualityReport.duration_error_pct);
  assert.ok(log.metrics.connective_density <= 0.25 + 1e-9);
  assert.equal(log.metrics.heading_repeats, 0);
  assert.equal(log.tokens.calls, log.calls.length);
  assert.ok(log.timings.length >= 5);
  // Scores are measured, not floored: every dimension is within [0, 1]
  for (const v of Object.values(log.metrics.dimensions)) assert.ok(v >= 0 && v <= 1);
});

test('Study calibration: quiz gaps and syllabus shift time toward weak topics, keep total and locks', async () => {
  const fs = await import('node:fs');
  const { parseQuizResults } = await import('../../src/pipeline/services/studySignals.ts');
  const { calibrateWithStudySignals } = await import('../../src/pipeline/services/studyCalibration.ts');
  const ops = await import('../../src/pipeline/services/knowledgeTreeOps.ts');

  const quiz = parseQuizResults(fs.readFileSync('source/quiz_results_analysis.md', 'utf8'), 'quiz.md');
  assert.equal(quiz.quizzes.length, 2);
  assert.ok(quiz.gaps.some((g) => g.keyTerms.includes('np.vstack')));
  assert.ok(!quiz.gaps.some((g) => g.keyTerms.includes('Area')), 'no noise terms');

  const sections = [
    { section_id: 'S1', title: 'Mảng NumPy', raw_text: 'NumPy array, np.vstack, np.column_stack, ndim, shape, size', elements: [] },
    { section_id: 'S2', title: 'Pandas DataFrame', raw_text: 'df.drop axis=1 xoá cột, df.describe thống kê, df.count', elements: [] },
    { section_id: 'S3', title: 'Lịch sử trí tuệ nhân tạo', raw_text: 'Hội nghị Dartmouth 1956, mùa đông AI', elements: [] },
    { section_id: 'S4', title: 'Mạng nơ-ron tích chập', raw_text: 'CNN convolution pooling', elements: [] }
  ];
  const docTree = { document_id: 'd', title: 'AI', source_type: 'pptx', source_filename: 'ai.pptx', total_sections: 4, extraction_time_ms: 1, sections };
  const page = (s) => ({ id: `pg_${s.section_id}`, kind: 'page', title: s.title, section_id: s.section_id, duration_sec: 60, children: [] });
  let tree = {
    tree_id: 't', document_id: 'd', created_at: '', updated_at: '', model: 'local',
    settings: { min_keyword_weight: 0.3, max_keywords_per_page: 5, max_pages: 50, target_duration_sec: 240 },
    stats: {},
    root: { id: 'doc_root', kind: 'document', title: 'AI', children: [{ id: 'ch_1', kind: 'chapter', title: 'A', children: sections.map(page) }] }
  };
  tree = ops.recompute(tree);
  tree = ops.toggleLock(tree, 'pg_S4');

  const syllabus = {
    fileName: 'de-cuong.md',
    topics: [
      { id: 't1', number: '2.1', title: 'NumPy và thao tác mảng', level: 2, text: 'np.vstack ndim shape', keyTerms: ['NumPy'] },
      { id: 't2', number: '2.2', title: 'Pandas', level: 2, text: 'DataFrame drop describe', keyTerms: ['Pandas'] }
    ]
  };
  const res = await calibrateWithStudySignals(tree, docTree, { quiz, syllabus }, undefined, { useLLM: false });
  const dur = (id) => ops.findNode(res.tree.root, id).duration_sec;
  assert.equal(res.tree.root.duration_sec, 240, 'total kept');
  assert.equal(dur('pg_S4'), 60, 'locked page untouched');
  assert.ok(dur('pg_S1') > 60 && dur('pg_S2') > 60, `weak topics gain time: ${dur('pg_S1')}, ${dur('pg_S2')}`);
  assert.ok(dur('pg_S3') < 60, 'off-syllabus page loses time');
  assert.ok(ops.findNode(res.tree.root, 'pg_S1').children.some((c) => c.keyword?.kind === 'focus'), 'focus keywords added');
  assert.ok(res.unmatchedGaps.some((g) => /PyTorch|OPTICS|Unsupervised/.test(g.label)), 'gaps not covered by the deck are reported');
});

test('OCR preprocessing erases table rules and keeps their grid; letter stems survive', async () => {
  const { removeRules } = await import('../../src/pipeline/module1_extractor/visualRegionOcr.ts');
  const w = 400;
  const h = 200;
  const d = new Uint8ClampedArray(w * h * 4).fill(255);
  const ink = (x, y) => {
    const i = (y * w + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = 0;
  };
  // 3x2 cell table: horizontal rules at y=10,100,190 and vertical rules at x=10,200,390 (2px thick).
  for (const y of [10, 100, 190]) for (let x = 10; x <= 390; x++) { ink(x, y); ink(x, y + 1); }
  for (const x of [10, 200, 390]) for (let y = 10; y <= 191; y++) { ink(x, y); ink(x + 1, y); }
  // A "letter" stem inside a cell: 30px tall, shorter than 80% of a row.
  for (let y = 40; y < 70; y++) ink(60, y);

  const grid = removeRules(d, w, h);
  assert.equal(grid.rows.length, 3, `rows ${grid.rows}`);
  assert.equal(grid.cols.length, 3, `cols ${grid.cols}`);
  const at = (x, y) => d[(y * w + x) * 4];
  assert.equal(at(100, 10), 255, 'horizontal rule erased');
  assert.equal(at(200, 50), 255, 'vertical rule erased');
  assert.equal(at(60, 55), 0, 'letter stem kept');
});

test('OCR table grid puts words in cells by center, in line order', async () => {
  const { tableFromGrid, parseTsv } = await import('../../src/pipeline/module1_extractor/visualRegionOcr.ts');
  // level page block par line word left top width height conf text
  const row = (line, left, top, text) => `5\t1\t1\t1\t${line}\t1\t${left}\t${top}\t40\t20\t90\t${text}`;
  const tsv = [
    'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
    row(1, 70, 30, 'hình'), // same line as "Mô" but 2px higher (diacritics)
    row(1, 20, 32, 'Mô'),
    row(2, 220, 30, 'Tham'),
    row(2, 265, 31, 'số'),
    row(3, 20, 130, 'LeNet-5'),
    row(4, 220, 130, '60')
  ].join('\n');
  const table = tableFromGrid(parseTsv(tsv), { rows: [10, 100, 190], cols: [10, 200, 390] });
  assert.deepEqual(table, [['Mô hình', 'Tham số'], ['LeNet-5', '60']]);
  assert.deepEqual(tableFromGrid(parseTsv(tsv), { rows: [10, 190], cols: [10, 390] }), [], 'needs at least 2x2 cells');
});

test('OCR diagram labels split boxes on wide gaps and drop arrow noise', async () => {
  const { diagramLabels } = await import('../../src/pipeline/module1_extractor/visualRegionOcr.ts');
  assert.deepEqual(diagramLabels('Ảnh đầu vào            — Tích chập                — Pooling      —]  Kết nối đầy đủ\n→\n|'), [
    'Ảnh đầu vào',
    'Tích chập',
    'Pooling',
    'Kết nối đầy đủ'
  ]);
});

test('Template composer: line shapes', async () => {
  const { analyzeLine } = await import('../../src/pipeline/module3_generator/templateComposer.ts');
  const shape = (text, type, lang = 'vi') => analyzeLine({ text, level: 2, type }, lang)?.shape;
  assert.equal(shape('Kernel: ma trận trọng số nhỏ trượt trên ảnh'), 'definition');
  assert.equal(shape('Độ chính xác: 92,5%'), 'metric');
  assert.equal(shape('Stride = 2'), 'metric');
  assert.equal(shape('Số tham số – 1,2 triệu'), 'metric');
  assert.equal(shape('y = max(0, x)', 'equation'), 'formula');
  assert.equal(shape('loss = -sum(y * log(p))'), 'formula');
  assert.equal(shape('layer = nn.Conv2d(3, 16, 3)', 'code'), 'code');
  assert.equal(shape('Ưu điểm:'), 'heading');
  assert.equal(shape('Vì sao cần pooling?'), 'question');
  assert.equal(shape('Ví dụ: ảnh 32x32 qua kernel 3x3'), 'example');
  assert.equal(shape('Max pooling'), 'fragment');
  assert.equal(shape('ReLU giúp mô hình học phi tuyến'), 'sentence');
  assert.equal(shape('The kernel slides over the image', undefined, 'en'), 'sentence');
});

test('Template composer: grouped rendering stays grounded and never reads fragments one by one', async () => {
  const { composePage } = await import('../../src/pipeline/module3_generator/templateComposer.ts');
  const lines = (arr) => arr.map(([text, level]) => ({ text, level: level ?? 2 }));
  const vi = (arr, extra = {}) => composePage(lines(arr), [], { lang: 'vi', sceneKey: 'S', used: new Set(), ...extra }).body.join(' ');

  assert.equal(vi([['Các bước:'], ['Chuẩn hoá dữ liệu'], ['Huấn luyện'], ['Đánh giá']]), 'Các bước lần lượt là chuẩn hoá dữ liệu, huấn luyện và đánh giá.');
  assert.match(vi([['Quy trình huấn luyện:'], ['Chuẩn hoá'], ['Huấn luyện']]), /^Quy trình huấn luyện (gồm|diễn ra qua) hai bước: chuẩn hoá và huấn luyện.$/);
  assert.match(vi([['Ưu điểm:', 2], ['Nhanh', 3], ['Ít tham số', 3]]), /ưu điểm.*nhanh và ít tham số\./i);
  assert.match(vi([['Max pooling'], ['Average pooling']], { title: 'Các loại pooling' }), /^(Các loại pooling (gồm|bao gồm)|Với các loại pooling, ta có) max pooling và average pooling.$/);
  // Title is only used as a list subject once per scene, and never when it is a question.
  assert.doesNotMatch(vi([['Max pooling'], ['Average pooling']], { title: 'Vì sao cần pooling?' }), /Vì sao/);
  // Definitions whose body starts with a verb drop the copula.
  assert.equal(vi([['ReLU: giúp mô hình học phi tuyến']]), 'ReLU giúp mô hình học phi tuyến.');
  // Long step items are numbered with digits (ordinal words are stripped by the guard).
  assert.match(vi([['Quy trình:'], ['Dữ liệu được chuẩn hoá về khoảng từ 0 đến 1 trước khi đưa vào mạng'], ['Huấn luyện']]), /Ở bước 1, dữ liệu.*Bước 2 là huấn luyện\./);
  // More than 6 items: first 5 plus a count.
  assert.match(vi([['A1'], ['A2'], ['A3'], ['A4'], ['A5'], ['A6'], ['A7']]), /cùng 2 mục khác trên màn hình/);
  // Code is pointed to once, not read.
  const code = composePage([{ text: 'x = f(y);', level: 2, type: 'code' }, { text: 'return x;', level: 2, type: 'code' }], [], { lang: 'vi', sceneKey: 'C', used: new Set() }).body;
  assert.equal(code.length, 1);
  assert.doesNotMatch(code[0], /return/);

  const en = composePage(lines([['Advantages:'], ['Fast'], ['Few parameters']]), [], { lang: 'en', sceneKey: 'E', used: new Set() }).body.join(' ');
  assert.match(en, /fast and few parameters\./);
});

test('Template composer: tables state what is compared and the extremes of numeric columns', async () => {
  const { composePage, parseNumber } = await import('../../src/pipeline/module3_generator/templateComposer.ts');
  assert.equal(parseNumber('98,9%'), 98.9);
  assert.equal(parseNumber('60 triệu'), 60e6);
  assert.equal(parseNumber('1,234.5'), 1234.5);
  assert.equal(parseNumber('25k'), 25000);
  const table = 'Mô hình | Tham số | Độ chính xác\nLeNet-5 | 60 nghìn | 98,9%\nAlexNet | 60 triệu | 84,7%\nResNet-50 | 25 triệu | 92,1%';
  const res = composePage([], [{ kind: 'table', text: table }], { lang: 'vi', sceneKey: 'T', used: new Set() });
  const text = res.visuals.join(' ');
  assert.match(text, /3 mô hình .*tham số và độ chính xác/);
  assert.match(text, /AlexNet.*tham số lớn nhất.*60 triệu.*LeNet-5.*60 nghìn/);
  assert.match(text, /độ chính xác cao nhất.*LeNet-5.*98,9%.*AlexNet.*84,7%/i);
  assert.equal(res.extras.length, 3, 'row readouts kept for the word budget');
  const diagram = composePage([], [{ kind: 'diagram', text: 'Ảnh đầu vào → Tích chập → Pooling' }], { lang: 'vi', sceneKey: 'D', used: new Set() });
  assert.match(diagram.visuals[0], /ảnh đầu vào, tích chập và pooling/);
});

test('Template engine on a mixed deck: no canned filler, sentences capitalized', async () => {
  const { templateDeck } = await import('./fixtures/templateDeck.js');
  const res = await new PipelineOrchestrator().runFullPipeline(templateDeck, templateDeck.source_filename, {
    language: 'vi', learnerLevel: 'undergraduate', priorKnowledge: '', targetDurationSeconds: 300, targetWpm: 140,
    narrationStyle: 'academic', visualDensity: 'balanced', narrationEngine: 'template'
  });
  const all = res.verifiedIr.scenes.map((s) => s.narration.text).join('\n');
  assert.doesNotMatch(all, /nội dung cốt lõi|sau khi nắm vững|Một ý quan trọng là (chuẩn hoá|khởi tạo)/);
  assert.doesNotMatch(all, /(^|[.!?]\s+)\p{Ll}/mu, 'every sentence starts with a capital');
  assert.match(all, /Quy trình huấn luyện gồm năm bước/);
  assert.match(all, /Bảng .*3 mô hình/);
});

test('Content duration: 100% coverage is measured from the page content', async () => {
  const { estimatePageContent } = await import('../../src/pipeline/services/contentDuration.ts');
  const sec = (texts, notes = []) =>
    estimatePageContent(
      {
        section_id: 'P',
        title: 'Trang',
        order: 1,
        elements: [
          { element_id: 't', type: 'title', text: 'Trang' },
          ...texts.map((t, i) => ({ element_id: `b${i}`, type: 'bullet_point', text: t, level: 2 })),
          ...notes.map((t, i) => ({ element_id: `n${i}`, type: 'note', text: t }))
        ]
      },
      [],
      { wpm: 140, lang: 'vi' }
    );
  const empty = sec([]);
  assert.equal(empty.decorative, true);
  assert.equal(empty.full_sec, 5, 'title-only page is a 5 s transition');
  const short = sec(['Kernel: ma trận trọng số nhỏ trượt trên ảnh']);
  const long = sec(['Kernel: ma trận trọng số nhỏ trượt trên ảnh', 'Stride = 2', 'Padding: thêm viền số 0 quanh ảnh'], ['Giảng viên nhấn mạnh rằng kernel nhỏ giúp giảm số tham số và giữ thông tin cục bộ của ảnh đầu vào.']);
  assert.ok(short.full_sec >= 10, 'content page floor');
  assert.ok(long.full_sec > short.full_sec, `more content, more time (${long.full_sec} > ${short.full_sec})`);
  assert.ok(long.min_sec < long.full_sec, 'template minimum below the full length');
});

test('Content duration: coverage sizes the lecture and follows pages switched off', async () => {
  const { setCoverage, fullDurationOf, currentCoverage, toggleExcludeKeepingCoverage } = await import('../../src/pipeline/services/contentDuration.ts');
  const page = (id, full) => ({ id, kind: 'page', title: id, section_id: id, full_sec: full, min_sec: 5, duration_sec: full, children: [] });
  let tree = {
    tree_id: 't', document_id: 'd', created_at: '', updated_at: '', model: 'x',
    settings: { min_keyword_weight: 0.3, max_keywords_per_page: 8, max_pages: 100, target_duration_sec: 200 },
    stats: { pages_total: 3, pages_llm: 0, keywords_total: 0, regions_total: 0, regions_ocr_done: 0, scan_ms: 0, llm_calls: 0, total_tokens: 0, truncated: false, notes: [] },
    root: { id: 'doc', kind: 'document', title: 'D', children: [{ id: 'ch', kind: 'chapter', title: 'C', children: [page('a', 100), page('b', 60), page('c', 40)] }] }
  };
  assert.equal(fullDurationOf(tree), 200);
  tree = setCoverage(tree, 0.5);
  assert.equal(tree.root.duration_sec, 100);
  assert.equal(tree.settings.coverage, 0.5);
  const d = (id) => tree.root.children[0].children.find((p) => p.id === id).duration_sec;
  assert.deepEqual([d('a'), d('b'), d('c')], [50, 30, 20], 'pages keep their content proportions');
  tree = toggleExcludeKeepingCoverage(tree, 'a');
  assert.equal(fullDurationOf(tree), 100, 'full length counts active pages only');
  assert.equal(tree.root.duration_sec, 50, '50% of the remaining content');
  assert.ok(Math.abs(currentCoverage(tree) - 0.5) < 0.01);
});
