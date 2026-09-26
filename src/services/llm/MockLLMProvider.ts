// src/services/llm/MockLLMProvider.ts
/**
 * Deterministic, Zero-Network Mock LLM Provider for CLSG-IR Demo & Offline Testing
 * Guaranteed reproducible evaluation, zero API costs, zero flaky network calls.
 * Clearly identified as DEMO / MOCK per Section 23.
 */
import {
  CanonicalDocumentTree,
  UserConfiguration,
  LessonModel,
  ContentPrioritization,
  TeachingUnit,
  CLSGScene,
  SemanticCritiqueReport
} from '../../types';
import { ILLMProvider, NarrationContext } from './LLMProvider';
import { technicalTerminologyService } from '../../pipeline/services/technicalTerminologyService';

export class MockLLMProvider implements ILLMProvider {
  readonly providerId = 'mock';
  readonly isDemo = true;

  async generateLessonUnderstanding(
    docTree: CanonicalDocumentTree,
    config: UserConfiguration
  ): Promise<LessonModel> {

    // Generic Fallback Lesson Model for Arbitrary Presentations
    const concepts = docTree.sections.map((sec, idx) => ({
      concept_id: `C${String(idx + 1).padStart(2, '0')}`,
      name: sec.title.replace(/^[•\-\*\d\.\)]\s*/, ''),
      // No invented definitions: narration only speaks definitions that come from the document or an LLM.
      definition: '',
      importance: idx === 0 ? ('core' as const) : idx === docTree.total_sections - 1 ? ('supporting' as const) : ('core' as const),
      prerequisites: idx > 0 ? [`C${String(idx).padStart(2, '0')}`] : [],
      related_concepts: []
    }));

    return {
      lesson_goal: `Truyền tải trọn vẹn và bài bản chủ đề ${docTree.title}.`,
      main_problem: `Làm thế nào để người học nắm vững các nguyên lý then chốt của ${docTree.title} một cách logic và thực tiễn?`,
      target_audience: config.learnerLevel || 'undergraduate',
      core_concepts: concepts.slice(0, 3),
      supporting_concepts: concepts.slice(3),
      examples: [`Minh họa ứng dụng thực tiễn của ${docTree.title}`],
      applications: [`Triển khai giải quyết bài toán nghiệp vụ liên quan đến ${docTree.title}`],
      evidence: [`Các kết quả đo lường và đánh giá tiêu chuẩn trong lĩnh vực`],
      concept_relationships: concepts.slice(1).map((c, i) => ({
        source_concept_id: concepts[i].concept_id,
        target_concept_id: c.concept_id,
        relationship_type: 'continues' as const,
        explanation: `Phát triển tiếp nối mạch kiến thức từ ${concepts[i].name} sang ${c.name}.`
      })),
      learning_dependencies: [`Nắm vững khái niệm nền tảng trước khi đi vào chi tiết chuyên sâu`],
      // No invented learner questions (a canned "what comes next?" repeated on every page reads as filler).
      learning_needs: [],
      teaching_arc: ['ENTRY', 'CONCEPT', 'MECHANISM', 'EXAMPLE', 'SUMMARY'],
      teaching_units: [],
      slide_mapping: []
    };
  }

  async generateContentPrioritization(
    docTree: CanonicalDocumentTree,
    lessonModel: LessonModel
  ): Promise<ContentPrioritization> {
    const coreItems: any[] = [];
    const supportingItems: any[] = [];
    const exampleItems: any[] = [];
    const contextItems: any[] = [];
    const noiseItems: any[] = [];

    const noiseRegex = /\b(aicb-[a-z0-9]+|data track|vinuniversity|all rights reserved|copyright|ngày\s*\d+|chương\s*\d+|slide\s*\d+)\b/i;

    docTree.sections.forEach((sec) => {
      const lines = (sec.raw_text || sec.title).split('\n').map((l) => l.trim()).filter(Boolean);

      lines.forEach((line, lineIdx) => {
        const lineLower = line.toLowerCase();
        const itemId = `${sec.section_id}_item_${lineIdx + 1}`;

        if (noiseRegex.test(line)) {
          noiseItems.push({
            content_id: itemId,
            source_slide_id: sec.section_id,
            text: line,
            category: 'noise',
            importance_reason: 'Siêu dữ liệu hành chính, mã môn hoặc bản quyền không có giá trị sư phạm',
            required_for_understanding: false,
            can_be_omitted: true,
            narration_priority: 'low'
          });
        } else if (lineLower.includes('ví dụ') || lineLower.includes('example') || lineLower.includes('tài xế') || lineLower.includes('vô-lăng')) {
          exampleItems.push({
            content_id: itemId,
            source_slide_id: sec.section_id,
            text: line,
            category: 'example',
            importance_reason: 'Tình huống cụ thể làm sáng tỏ khái niệm lý thuyết',
            required_for_understanding: true,
            can_be_omitted: false,
            narration_priority: 'high'
          });
        } else if (lineLower.includes('định nghĩa') || lineLower.includes('khái niệm') || lineLower.includes('cơ chế') || lineLower.includes('kernel') || lineLower.includes('keypoint')) {
          coreItems.push({
            content_id: itemId,
            source_slide_id: sec.section_id,
            text: line,
            category: 'core',
            importance_reason: 'Khái niệm cốt lõi bắt buộc người học phải thấu hiểu',
            required_for_understanding: true,
            can_be_omitted: false,
            narration_priority: 'high'
          });
        } else if (sec.order === 1) {
          contextItems.push({
            content_id: itemId,
            source_slide_id: sec.section_id,
            text: line,
            category: 'context',
            importance_reason: 'Bối cảnh dẫn nhập giới thiệu chủ đề tổng quan',
            required_for_understanding: false,
            can_be_omitted: false,
            narration_priority: 'medium'
          });
        } else {
          supportingItems.push({
            content_id: itemId,
            source_slide_id: sec.section_id,
            text: line,
            category: 'supporting',
            importance_reason: 'Chi tiết bổ trợ làm phong phú thêm kiến thức',
            required_for_understanding: false,
            can_be_omitted: true,
            narration_priority: 'medium'
          });
        }
      });
    });

    return {
      total_items: coreItems.length + supportingItems.length + exampleItems.length + contextItems.length + noiseItems.length,
      core_items: coreItems,
      supporting_items: supportingItems,
      example_items: exampleItems,
      context_items: contextItems,
      noise_items: noiseItems,
      omitted_content_count: noiseItems.length
    };
  }

  async generateTeachingPlan(
    docTree: CanonicalDocumentTree,
    lessonModel: LessonModel,
    prioritization: ContentPrioritization,
    config: UserConfiguration
  ): Promise<TeachingUnit[]> {
    const totalSec = Math.max(60, config.targetDurationSeconds || 180);
    const wpm = config.targetWpm || 140;

    // Default 1-to-1 or 2-to-1 Multi-Slide Unit Grouping
    const units: TeachingUnit[] = [];
    const totalSlides = docTree.sections.length;
    let secIdx = 0;
    let unitCount = 1;

    while (secIdx < totalSlides) {
      const isFirst = secIdx === 0;
      const isLast = secIdx === totalSlides - 1;
      const sec = docTree.sections[secIdx];
      const slidesInUnit = [sec.section_id];

      let stage: any = 'CONCEPT';
      if (isFirst) stage = 'HOOK';
      else if (isLast) stage = 'SUMMARY';
      else if (sec.title.toLowerCase().includes('example') || sec.title.toLowerCase().includes('ví dụ')) stage = 'EXAMPLE';
      else if (sec.title.toLowerCase().includes('cơ chế') || sec.title.toLowerCase().includes('convolution')) stage = 'MECHANISM';

      const unitDuration = Math.round(totalSec / Math.ceil(totalSlides / 1.5));
      const unitWords = Math.round(unitDuration * 0.8 * (wpm / 60));

      units.push({
        unit_id: `TU${String(unitCount).padStart(2, '0')}`,
        title: sec.title,
        stage,
        slide_ids: slidesInUnit,
        primary_concept_id: lessonModel.core_concepts[0]?.concept_id || 'C01',
        supporting_concept_ids: [],
        learning_need: lessonModel.learning_needs[unitCount - 1],
        target_duration_sec: unitDuration,
        target_word_budget: unitWords,
        narration_focus: `Truyền tải thông điệp trọng tâm của ${sec.title}.`,
        key_talking_points: [sec.title],
        omitted_details: prioritization.noise_items.map((n) => n.text)
      });

      secIdx += 1;
      unitCount += 1;
    }

    return units;
  }

  async generateNarration(
    unit: TeachingUnit,
    lessonModel: LessonModel,
    context: NarrationContext,
    config: UserConfiguration
  ): Promise<string> {
    const isVi = (config.narration_language || config.language || 'vi') !== 'en';

    // Default Fallback Generator
    const cleanTitle = technicalTerminologyService.resolveAndPreserveSentence(unit.title).resolvedText;
    if (unit.learning_need) {
      return isVi
        ? `Để trả lời câu hỏi: ${unit.learning_need.natural_question.toLowerCase()} Chúng ta cùng phân tích ${cleanTitle}. Nội dung này giải thích cách các thành phần tương tác nhằm cấu trúc luồng thông tin của mô hình.`
        : `Addressing the question of ${unit.learning_need.natural_question}, we analyze ${cleanTitle}, establishing key architectural behaviors.`;
    }

    return isVi
      ? `Chúng ta cùng tìm hiểu nội dung về ${cleanTitle}. Đây là mắt xích quan trọng giúp hệ thống liên kết thông tin và tối ưu hóa biểu diễn dữ liệu.`
      : `Let us examine ${cleanTitle}, which establishes key architectural behaviors in the pipeline.`;
  }

  async semanticCritique(
    scenes: CLSGScene[],
    lessonModel: LessonModel,
    units: TeachingUnit[]
  ): Promise<SemanticCritiqueReport> {
    const issues: any[] = [];
    const repairs: string[] = [];

    scenes.forEach((scene) => {
      const text = scene.narration.text;
      // Check 1: Metadata leak
      if (/(aicb-[a-z0-9]+|ngày \d+|data track|vinuniversity)/i.test(text)) {
        issues.push({
          check_id: 'chk_semantic_metadata',
          severity: 'error',
          message: `Rò rỉ siêu dữ liệu tại phân cảnh ${scene.section_id}`,
          recommendation: 'Loại bỏ hoàn toàn các chuỗi metadata không có giá trị học tập.'
        });
        repairs.push(`Auto-repaired: Cắt bỏ metadata rò rỉ tại ${scene.section_id}`);
      }

      // Check 2: Slide reading
      if (/^(slide này (có tiêu đề|trình bày)|ở slide này)/i.test(text)) {
        issues.push({
          check_id: 'chk_slide_reading',
          severity: 'warning',
          message: `Diễn đạt đọc slide tại ${scene.section_id}`,
          recommendation: 'Chuyển sang lối giải thích chủ động.'
        });
        repairs.push(`Auto-repaired: Chuyển đổi đọc slide sang giảng giải chủ động tại ${scene.section_id}`);
      }
    });

    return {
      semantic_coherence_score: 0.96,
      learning_need_satisfaction_score: 0.98,
      premature_disclosure_score: 1.0,
      slide_reading_score: 0.95,
      metadata_leak_score: issues.some((i) => i.check_id === 'chk_semantic_metadata') ? 0.85 : 1.0,
      overall_semantic_status: issues.some((i) => i.severity === 'error') ? 'WARNING' : 'PASSED',
      issues,
      auto_repairs: repairs,
      needs_regeneration: false
    };
  }
}
