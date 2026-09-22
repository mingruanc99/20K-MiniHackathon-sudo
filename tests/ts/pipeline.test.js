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
  assert.ok(['PASSED', 'WARNING'].includes(res.qualityReport.overall_status));
  assert.ok(res.qualityReport.duration_error_pct <= 15.0);
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
  assert.ok(s3Narration.includes('Ở slide trước, chúng ta đã thấy'));
  assert.ok(s3Narration.includes('CNN dùng kernel để quét qua từng vùng nhỏ của ảnh và tạo ra feature map'));
  assert.ok(!s3Narration.includes('Thứ nhất'));

  const s4Plan = { ...demoSections[3], slide_analysis: analyses.get('S4'), narrative_plan: plans.get('S4') };
  const s4Narration = narrationGen.generateNarration(s4Plan, config, demoDocs[3].raw_text);
  assert.ok(s4Narration.includes('Để hình dung rõ hơn cơ chế này, chúng ta thử nhìn vào một ví dụ cụ thể'));
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
  assert.ok(s1Narration.includes('mô hình biểu diễn các điểm đặc trưng và tư thế của con người'));
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
  assert.equal(gemini.providerId, 'gemini');
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

  // S1: Hook creates curiosity
  assert.ok(
    s1Text.includes('Bạn thử nhìn một người từ góc này') || s1Text.includes('xác định chính xác'),
    'S1 must pose curiosity question'
  );

  // S2: Think stimulates reasoning
  assert.ok(
    s2Text.includes('Nếu chỉ nhìn một người từ góc này') || s2Text.includes('xác định được đâu là'),
    'S2 must stimulate reflection'
  );

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
