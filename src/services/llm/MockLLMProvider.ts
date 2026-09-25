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
    const titleLower = docTree.title.toLowerCase();

    // Golden Case 1: Keypoint & Pose (Section 25 & 32)
    if (titleLower.includes('keypoint') || titleLower.includes('pose')) {
      return {
        lesson_goal: 'Nắm vững bản chất của Keypoint và cách cấu trúc đồ thị các điểm đặc trưng để biểu diễn Pose của con người.',
        main_problem: 'Làm thế nào để hệ thống thị giác máy tính nhận diện và định vị chính xác tư thế người từ các góc nhìn che khuất mơ hồ?',
        target_audience: config.learnerLevel || 'undergraduate',
        core_concepts: [
          {
            concept_id: 'C01',
            name: 'Keypoint',
            definition: 'Tọa độ điểm đặc trưng xác định vị trí giải phẫu học của các bộ phận cơ thể (như mắt, vai, khuỷu tay, cổ tay).',
            importance: 'core',
            prerequisites: [],
            introduced_by: ['S1', 'S2'],
            explained_by: ['S3'],
            related_concepts: ['C02', 'C03']
          },
          {
            concept_id: 'C02',
            name: 'Pose Representation',
            definition: 'Mô hình biểu diễn không gian toàn diện kết nối các keypoint theo cấu trúc đồ thị khung xương (skeleton topology).',
            importance: 'core',
            prerequisites: ['C01'],
            introduced_by: ['S3'],
            explained_by: ['S4'],
            related_concepts: ['C01', 'C04']
          }
        ],
        supporting_concepts: [
          {
            concept_id: 'C03',
            name: '17 Body Keypoints',
            definition: 'Tập hợp 17 điểm tọa độ giải phẫu học chuẩn hóa theo định dạng COCO dataset.',
            importance: 'supporting',
            prerequisites: ['C01'],
            related_concepts: ['C01']
          },
          {
            concept_id: 'C04',
            name: 'Spatial Locality & Skeleton Topology',
            definition: 'Ràng buộc hình học giữa các khớp nối sinh học nhằm hạn chế các cấu hình tư thế phi thực tế.',
            importance: 'supporting',
            prerequisites: ['C02'],
            related_concepts: ['C02']
          }
        ],
        examples: [
          'Tình huống tài xế cầm vô-lăng nhìn từ góc chụp bên phải',
          'Vận động viên nhảy cao với các khớp tay và chân uốn cong phức tạp'
        ],
        applications: [
          'Phân tích hành vi lái xe an toàn (Driver Monitoring Systems)',
          'Phục hồi chức năng y tế và theo dõi chuyển động thể thao'
        ],
        evidence: [
          'Độ chính xác định vị khớp xương đạt chuẩn mAP trên COCO Keypoint Benchmark'
        ],
        concept_relationships: [
          {
            source_concept_id: 'C01',
            target_concept_id: 'C02',
            relationship_type: 'enables',
            explanation: 'Keypoint là các điểm mốc nguyên tử cấu thành nên mô hình Pose hoàn chỉnh.'
          }
        ],
        learning_dependencies: [
          'Hiểu tọa độ 2D của điểm đơn lẻ trước khi mô hình hóa đồ thị liên kết nhiều điểm'
        ],
        learning_needs: [
          {
            after_concept_id: 'C01',
            natural_question: 'Khi đã định vị được các điểm đặc trưng riêng lẻ, làm thế nào để mô hình kết nối chúng thành một tư thế hoàn chỉnh?',
            resolved_by_concept_id: 'C02',
            pedagogical_hook: 'Từ các điểm rời rạc sang hình dáng toàn vẹn'
          }
        ],
        teaching_arc: ['ENTRY', 'HOOK', 'CONCEPT', 'MECHANISM', 'EXAMPLE', 'APPLICATION', 'SUMMARY'],
        teaching_units: [],
        slide_mapping: []
      };
    }

    // Golden Case 2: Introduction to Convolutional Neural Networks (CNN)
    if (titleLower.includes('convolutional') || titleLower.includes('cnn') || titleLower.includes('neural network')) {
      return {
        lesson_goal: 'Hiểu kiến trúc CNN, cơ chế quét kernel trích xuất feature map và kỹ thuật pooling giảm chiều không gian.',
        main_problem: 'Làm thế nào để mạng neural xử lý hình ảnh 2D hiệu quả mà không bị bùng nổ số lượng tham số như mạng dense truyền thống?',
        target_audience: config.learnerLevel || 'undergraduate',
        core_concepts: [
          {
            concept_id: 'C01',
            name: 'CNN',
            definition: 'Kiến trúc neural network chuyên biệt cho dữ liệu dạng lưới 2D/3D bằng cách sử dụng các phép toán tích chập cục bộ.',
            importance: 'core',
            prerequisites: [],
            introduced_by: ['S1'],
            explained_by: ['S2', 'S3'],
            related_concepts: ['C02', 'C03']
          },
          {
            concept_id: 'C02',
            name: 'Convolution & Kernel Mechanics',
            definition: 'Phép nhân ma trận trọng số (kernel) trượt qua từng receptive field cục bộ để sinh ra feature map.',
            importance: 'core',
            prerequisites: ['C01'],
            introduced_by: ['S2'],
            explained_by: ['S3'],
            related_concepts: ['C01', 'C03']
          },
          {
            concept_id: 'C03',
            name: 'Pooling',
            definition: 'Phép giảm kích thước không gian (downsampling) giúp giảm chi phí tính toán và tạo tính bất biến dịch chuyển.',
            importance: 'core',
            prerequisites: ['C02'],
            introduced_by: ['S3'],
            explained_by: ['S4'],
            related_concepts: ['C02']
          }
        ],
        supporting_concepts: [
          {
            concept_id: 'C04',
            name: 'Parameter Explosion in Dense Networks',
            definition: 'Sự gia tăng hàm mũ số lượng weights khi làm phẳng ảnh 2D thành vector 1D.',
            importance: 'supporting',
            prerequisites: [],
            related_concepts: ['C01']
          },
          {
            concept_id: 'C05',
            name: 'Spatial Locality',
            definition: 'Tính chất các pixel lân cận mang mối tương quan ngữ nghĩa chặt chẽ hơn các pixel ở xa.',
            importance: 'supporting',
            prerequisites: ['C01'],
            related_concepts: ['C02']
          }
        ],
        examples: [
          'Trượt kernel 3x3 trên ma trận ảnh 5x5 để tính toán giá trị feature map',
          'Áp dụng Max Pooling 2x2 giữ lại điểm kích hoạt lớn nhất'
        ],
        applications: [
          'Image Classification trong chuẩn đoán X-Quang y tế',
          'Object Detection trong xe tự hành'
        ],
        evidence: [
          'Giảm hơn 90% số lượng parameters so với mạng MLP cùng độ sâu'
        ],
        concept_relationships: [
          {
            source_concept_id: 'C01',
            target_concept_id: 'C02',
            relationship_type: 'deepens',
            explanation: 'Convolution là phép toán cốt lõi hiện thực hóa khả năng bảo toàn tính spatial locality của CNN.'
          },
          {
            source_concept_id: 'C02',
            target_concept_id: 'C03',
            relationship_type: 'enables',
            explanation: 'Feature map sinh ra từ convolution được nén không gian thông qua pooling.'
          }
        ],
        learning_dependencies: [
          'Hiểu vấn đề bùng nổ tham số trước khi học cơ chế convolution',
          'Hiểu feature map trước khi tìm hiểu kỹ thuật pooling'
        ],
        learning_needs: [
          {
            after_concept_id: 'C01',
            natural_question: 'Nếu mạng dày đặc bị bùng nổ tham số, phép toán nào có thể quét cục bộ mà vẫn bảo toàn cấu trúc không gian?',
            resolved_by_concept_id: 'C02',
            pedagogical_hook: 'Giải pháp tích chập cục bộ'
          },
          {
            after_concept_id: 'C02',
            natural_question: 'Sau khi trích xuất được feature map, làm thế nào để giảm tải tính toán mà không làm mất đặc trưng quan trọng?',
            resolved_by_concept_id: 'C03',
            pedagogical_hook: 'Nén chiều không gian qua pooling'
          }
        ],
        teaching_arc: ['HOOK', 'PROBLEM', 'CONCEPT', 'MECHANISM', 'EXAMPLE', 'APPLICATION', 'SUMMARY'],
        teaching_units: [],
        slide_mapping: []
      };
    }

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
    const titleLower = docTree.title.toLowerCase();
    const totalSec = Math.max(60, config.targetDurationSeconds || 180);
    const wpm = config.targetWpm || 140;

    // Golden Case 1: Keypoint & Pose (Grouping slides into multi-slide teaching units!)
    if (titleLower.includes('keypoint') || titleLower.includes('pose')) {
      return [
        {
          unit_id: 'TU01',
          title: 'Khởi đầu & Vấn đề Tư duy (Motivation Hook)',
          stage: 'HOOK',
          slide_ids: ['S1', 'S2'],
          primary_concept_id: 'C01',
          supporting_concept_ids: [],
          learning_need: {
            after_concept_id: 'C00',
            natural_question: 'Nếu nhìn một người từ góc chụp bị che khuất, máy tính làm thế nào để biết đâu là tay trái hay tay phải?',
            resolved_by_concept_id: 'C01',
            pedagogical_hook: 'Khơi gợi sự tò mò về sự mơ hồ của tư thế 2D'
          },
          target_duration_sec: Math.round(totalSec * 0.25),
          target_word_budget: Math.round(totalSec * 0.25 * 0.8 * (wpm / 60)),
          narration_focus: 'Giới thiệu chủ đề Keypoint & Pose và đặt ra câu hỏi đố vui về tài xế cầm vô-lăng mà không đưa ra lời giải ngay.',
          key_talking_points: [
            'Chào mừng đến với bài học về Keypoint & Pose.',
            'Tình huống góc nhìn: bạn có xác định được đâu là tay trái và tay phải?'
          ],
          omitted_details: ['aicb-p2t4', 'ngày 04', 'chương 1', 'vinuniversity']
        },
        {
          unit_id: 'TU02',
          title: 'Bản chất của Keypoint (Core Mechanism)',
          stage: 'CONCEPT',
          slide_ids: docTree.sections.length > 2 ? ['S3'] : ['S1'],
          primary_concept_id: 'C01',
          supporting_concept_ids: ['C03'],
          learning_need: lessonModel.learning_needs[0],
          target_duration_sec: Math.round(totalSec * 0.40),
          target_word_budget: Math.round(totalSec * 0.40 * 0.8 * (wpm / 60)),
          narration_focus: 'Định nghĩa keypoint là các điểm tọa độ đặc trưng định vị giải phẫu học cơ thể người.',
          key_talking_points: [
            'Keypoint xác định vị trí khớp xương và bộ phận giải phẫu.',
            'Tập hợp 17 keypoint tạo nền tảng định vị.'
          ],
          omitted_details: []
        },
        {
          unit_id: 'TU03',
          title: 'Mô hình Biểu diễn Pose & Đồ thị Khung xương',
          stage: 'MECHANISM',
          slide_ids: docTree.sections.length > 3 ? ['S4'] : ['S2'],
          primary_concept_id: 'C02',
          supporting_concept_ids: ['C04'],
          target_duration_sec: Math.round(totalSec * 0.35),
          target_word_budget: Math.round(totalSec * 0.35 * 0.8 * (wpm / 60)),
          narration_focus: 'Kết nối các keypoint thành đồ thị không gian phản ánh tư thế hoàn chỉnh.',
          key_talking_points: [
            'Pose representation liên kết các keypoint thành khung xương logic.',
            'Bảo toàn ràng buộc hình học giúp loại bỏ cấu hình phi lý.'
          ],
          omitted_details: []
        }
      ];
    }

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
    const focusLower = unit.narration_focus.toLowerCase();
    const titleLower = unit.title.toLowerCase();

    // Keypoint & Pose Golden Cases
    if (titleLower.includes('khởi đầu') || titleLower.includes('hook') || focusLower.includes('tài xế')) {
      return isVi
        ? 'Chào mừng các bạn đến với bài học về Keypoint & Pose. Bạn hãy thử nhìn một người từ góc này: liệu mô hình có thể xác định chính xác đâu là tay trái và tay phải?'
        : 'Welcome to the lesson on Keypoint & Pose. Try looking at a person from this angle: can the model accurately distinguish between their left hand and right hand?';
    }

    if (titleLower.includes('bản chất của keypoint') || focusLower.includes('định nghĩa keypoint')) {
      return isVi
        ? 'Để giải quyết câu hỏi này, trước tiên chúng ta cần hiểu khái niệm nền tảng: Keypoint. Trong computer vision, keypoint là các điểm tọa độ đặc trưng định vị vị trí giải phẫu học của các bộ phận cơ thể, chẳng hạn như vai, khuỷu tay và cổ tay.'
        : 'To resolve this challenge, we first examine the foundational building block: Keypoint. In computer vision, a keypoint defines the spatial coordinates of anatomical body landmarks such as shoulders, elbows, and wrists.';
    }

    if (titleLower.includes('pose') || focusLower.includes('đồ thị khung xương')) {
      return isVi
        ? 'Khi đã có các keypoint riêng lẻ, câu hỏi đặt ra là làm thế nào để mô hình hiểu được tư thế toàn diện? Đây là lúc Pose Representation phát huy tác dụng, kết nối các điểm mốc thành một đồ thị khung xương hoàn chỉnh với các ràng buộc hình học chặt chẽ.'
        : 'Having identified individual keypoints, how do we represent the complete human posture? Pose representation connects these landmarks into a coherent skeleton graph, enforcing spatial locality constraints.';
    }

    // Benchmark CNN Cases
    if (titleLower.includes('what is cnn') || titleLower.includes('convolutional neural network')) {
      return isVi
        ? 'CNN, hay Convolutional Neural Network, là một kiến trúc neural network được thiết kế đặc biệt để xử lý dữ liệu dạng grid như hình ảnh. Trong computer vision, mô hình tự động trích xuất các đặc trưng thị giác từ đơn giản đến phức tạp.'
        : 'A Convolutional Neural Network, or CNN, is a deep architecture engineered to process grid-structured data like images by learning hierarchical visual features.';
    }

    if (titleLower.includes('convolution') && !titleLower.includes('example')) {
      const bridge = context.previousConceptName ? `Ở phần trước, chúng ta đã phân tích ${context.previousConceptName}. ` : '';
      return isVi
        ? `${bridge}Vậy convolution layer thực sự làm gì với hình ảnh? CNN dùng kernel để quét qua từng vùng nhỏ của ảnh và tạo ra feature map. Qua quá trình này, mô hình bảo toàn tính spatial locality và phát hiện đặc trưng hiệu quả.`
        : `${bridge}How does convolution operate on images? The kernel slides across receptive fields to generate rich feature maps while preserving spatial locality.`;
    }

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
