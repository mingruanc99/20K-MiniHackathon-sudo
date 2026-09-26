// src/pipeline/module3_generator/visualIntentGenerator.ts
/**
 * Module 3C: Visual Intent Generator
 * Strictly constrained to 13 Canonical Visual Taxonomies.
 * Guarantees every cue has pedagogical necessity justification and content focus.
 * Supports both domain-specific triggers and generalized pedagogical fallbacks for any uploaded material.
 */
import {
  SectionPlan,
  ProsodyPlan,
  UserConfiguration,
  VisualCue,
  VisualTaxonomy
} from '../../types';

export class VisualIntentGenerator {
  static readonly ALLOWED_TAXONOMIES: VisualTaxonomy[] = [
    'diagram',
    'flowchart',
    'comparison',
    'infographic',
    'chart',
    'table',
    'screenshot',
    'illustration',
    'real_world_example',
    'timeline',
    'equation',
    'process_visualization',
    'concept_map'
  ];

  generateVisualCues(
    plan: SectionPlan,
    prosodyPlan: ProsodyPlan,
    config: UserConfiguration
  ): VisualCue[] {
    const cues: VisualCue[] = [];
    const sentences = prosodyPlan.sentences;
    let cumulativeSec = 0;

    sentences.forEach((sent, sIdx) => {
      const sDuration = (sent.estimated_speaking_time_sec || 5) + sent.prosody.pause_after_ms / 1000;
      const text = sent.text.toLowerCase();

      // Determine visual intent based on instructional content
      const cueSpec = this.selectCueForSentence(text, plan.pedagogical_function, sIdx, plan);

      if (cueSpec) {
        const triggerTime = cumulativeSec + sDuration * 0.25;
        cues.push({
          cue_id: `vc_${plan.section_id}_${sIdx + 1}`,
          section_id: plan.section_id,
          trigger_timestamp_sec: Math.round(triggerTime * 10) / 10,
          trigger_word: cueSpec.triggerWord,
          visual_need: true,
          visual_type: cueSpec.visualType,
          visual_purpose: cueSpec.visualPurpose,
          content_focus: cueSpec.contentFocus,
          learning_support: cueSpec.learningSupport,
          importance_level: cueSpec.importance,
          element_target: cueSpec.elementTarget,
          action: cueSpec.action,
          renderer_hints: cueSpec.rendererHints
        });
      }

      cumulativeSec += sDuration;
    });

    // Guarantee: Every scene must have at least 1 pedagogical visual cue
    if (cues.length === 0 && sentences.length > 0) {
      const fallbackSpec = this.createPedagogicalFallbackCue(plan, 0);
      cues.push({
        cue_id: `vc_${plan.section_id}_01`,
        section_id: plan.section_id,
        trigger_timestamp_sec: 1.5,
        trigger_word: plan.title.split(' ')[0] || 'concept',
        visual_need: true,
        visual_type: fallbackSpec.visualType,
        visual_purpose: fallbackSpec.visualPurpose,
        content_focus: fallbackSpec.contentFocus,
        learning_support: fallbackSpec.learningSupport,
        importance_level: fallbackSpec.importance,
        element_target: fallbackSpec.elementTarget,
        action: fallbackSpec.action,
        renderer_hints: fallbackSpec.rendererHints
      });
    }

    return cues;
  }

  private selectCueForSentence(
    text: string,
    role: string,
    sIdx: number,
    plan: SectionPlan
  ): {
    visualType: VisualTaxonomy;
    visualPurpose: string;
    contentFocus: string[];
    learningSupport: string;
    importance: 'low' | 'medium' | 'high';
    elementTarget: string;
    action: string;
    triggerWord?: string;
    rendererHints?: Record<string, any>;
  } | null {
    // 1. Domain-specific keywords for CNN / Deep Learning Demo
    if (text.includes('flattening') || text.includes('120 million') || text.includes('parameter explosion') || text.includes('bùng nổ')) {
      return {
        visualType: 'comparison',
        visualPurpose: 'So sánh sự bùng nổ tham số giữa các lớp dense truyền thống và tính tinh gọn của convolution',
        contentFocus: ['Dense MLP Matrix (120M weights)', 'Convolutional Kernel (9 weights)'],
        learningSupport: 'Giúp người học phân biệt trực quan sự tăng trưởng tham số theo hàm mũ so với cơ chế chia sẻ trọng số',
        importance: 'high',
        elementTarget: 'dense_vs_cnn_comparison_card',
        action: 'transform',
        triggerWord: 'explodes',
        rendererHints: { split: 'side-by-side', leftLabel: 'Dense MLP', rightLabel: 'CNN Kernel' }
      };
    }

    if (text.includes('kernel') || text.includes('convolution') || text.includes('slides smoothly') || text.includes('quét qua')) {
      return {
        visualType: 'process_visualization',
        visualPurpose: 'Minh họa cách kernel quét qua từng vùng nhỏ của ảnh để tạo ra feature map.',
        contentFocus: ['Input Matrix 6x6', 'Sliding Kernel 3x3', 'Dot-Product Accumulator', 'Output Feature Map'],
        learningSupport: 'Giúp người học trực quan hóa phép nhân phần tử và phép trượt trên pixel grid',
        importance: 'high',
        elementTarget: 'kernel_sliding_animation_canvas',
        action: 'draw',
        triggerWord: 'slides',
        rendererHints: { kernelSize: [3, 3], stride: 1, tensorDim: [6, 6] }
      };
    }

    if (text.includes('pooling') || text.includes('max pooling') || text.includes('downsampling')) {
      return {
        visualType: 'diagram',
        visualPurpose: 'Giải thích cơ chế cửa sổ trượt max pooling chọn giá trị kích hoạt lớn nhất và giảm spatial dimensions',
        contentFocus: ['2x2 Sliding Patch', 'Peak Value Selection', 'Downsampled 3x3 Map'],
        learningSupport: 'Làm rõ việc giảm kích thước không gian và duy trì tính bất biến vị trí của mô hình',
        importance: 'high',
        elementTarget: 'max_pool_window_diagram',
        action: 'zoom',
        triggerWord: 'halves',
        rendererHints: { windowSize: [2, 2], stride: 2 }
      };
    }

    if (text.includes('autonomous vehicle') || text.includes('pedestrian') || text.includes('photo gallery') || text.includes('xe tự hành')) {
      return {
        visualType: 'real_world_example',
        visualPurpose: 'Kết nối lý thuyết thị giác máy tính với bài toán xe tự hành và nhận diện đối tượng thực tế',
        contentFocus: ['Autonomous driving camera feed', 'Pedestrian Bounding Box', 'Class Confidence 99%'],
        learningSupport: 'Gắn kết ma trận điểm ảnh lý thuyết với các bài toán thực tiễn trong thế giới thực',
        importance: 'medium',
        elementTarget: 'hud_bounding_box_feed',
        action: 'overlay',
        triggerWord: 'autonomous'
      };
    }

    if (text.includes('architecture') || text.includes('summary') || text.includes('hierarchical') || text.includes('tổng kết')) {
      return {
        visualType: 'flowchart',
        visualPurpose: `Tổng hợp toàn bộ pipeline kiến trúc và quy trình xử lý cho ${plan.title}`,
        contentFocus: plan.key_concepts.length > 0 ? plan.key_concepts : ['Giai đoạn 1: Input', 'Giai đoạn 2: Trích xuất đặc trưng', 'Giai đoạn 3: Phân loại'],
        learningSupport: 'Cung cấp góc nhìn tổng quan và hệ thống hóa kiến thức toàn bộ bài giảng',
        importance: 'high',
        elementTarget: 'full_architecture_flowchart',
        action: 'pulse',
        triggerWord: 'summary'
      };
    }

    // 2. Generalized Pedagogical Taxonomies for any uploaded slides
    if (sIdx === 0) {
      return this.createPedagogicalFallbackCue(plan, sIdx);
    }

    if (sIdx === 1 && (role === 'mechanism' || role === 'definition')) {
      return {
        visualType: 'concept_map',
        visualPurpose: `Sơ đồ hóa các mối quan hệ khái niệm trọng tâm cho ${plan.title}`,
        contentFocus: plan.key_concepts.length > 0 ? plan.key_concepts : ['Định nghĩa cốt lõi', 'Đặc tính vận hành', 'Điều kiện biên'],
        learningSupport: 'Giúp sinh viên xây dựng sơ đồ tư duy có cấu trúc và hiểu rõ sự phụ thuộc giữa các thành phần',
        importance: 'medium',
        elementTarget: 'concept_relationship_canvas',
        action: 'reveal',
        triggerWord: 'mechanism'
      };
    }

    return null;
  }

  private createPedagogicalFallbackCue(plan: SectionPlan, sIdx: number): {
    visualType: VisualTaxonomy;
    visualPurpose: string;
    contentFocus: string[];
    learningSupport: string;
    importance: 'low' | 'medium' | 'high';
    elementTarget: string;
    action: string;
    triggerWord?: string;
    rendererHints?: Record<string, any>;
  } {
    const role = plan.pedagogical_function;
    const title = plan.title;
    const concepts = plan.key_concepts.length > 0 ? plan.key_concepts : [title, 'Nguyên lý cốt lõi', 'Ý nghĩa then chốt'];

    if (role === 'hook' || plan.order === 1) {
      return {
        visualType: 'infographic' as VisualTaxonomy,
        visualPurpose: `Định hướng trực quan cho người học về bối cảnh tổng quan và mục tiêu của ${title}`,
        contentFocus: concepts,
        learningSupport: 'Khơi gợi hứng thú nhận thức ban đầu và thiết lập bối cảnh liên quan cho bài học',
        importance: 'high' as const,
        elementTarget: 'intro_orientation_infographic',
        action: 'reveal',
        triggerWord: 'introduction'
      };
    }

    if (role === 'mechanism') {
      return {
        visualType: 'diagram' as VisualTaxonomy,
        visualPurpose: `Minh họa chi tiết từng bước vận hành và luồng dữ liệu của ${title}`,
        contentFocus: concepts,
        learningSupport: 'Làm rõ quan hệ nhân quả và trình tự các bước xử lý trong thuật toán',
        importance: 'high' as const,
        elementTarget: 'mechanism_structural_diagram',
        action: 'draw',
        triggerWord: 'operation'
      };
    }

    if (role === 'example' || role === 'comparison') {
      return {
        visualType: 'comparison' as VisualTaxonomy,
        visualPurpose: `Cung cấp bảng so sánh và phân tích thực tiễn cho ${title}`,
        contentFocus: concepts,
        learningSupport: 'Làm sâu sắc thêm khả năng phân tích thông qua đối chiếu các phương án tối ưu',
        importance: 'medium' as const,
        elementTarget: 'application_comparison_matrix',
        action: 'transform',
        triggerWord: 'application'
      };
    }

    if (role === 'summary') {
      return {
        visualType: 'flowchart' as VisualTaxonomy,
        visualPurpose: `Tổng hợp tất cả phát hiện chính, kết quả then chốt và kinh nghiệm thực hành cho ${title}`,
        contentFocus: concepts,
        learningSupport: 'Củng cố trí nhớ dài hạn thông qua việc tổng hợp kiến thức một cách có hệ thống',
        importance: 'high' as const,
        elementTarget: 'summary_synthesis_flowchart',
        action: 'pulse',
        triggerWord: 'conclusion'
      };
    }

    // Default definition
    return {
      visualType: 'concept_map' as VisualTaxonomy,
      visualPurpose: `Làm rõ ranh giới lý thuyết và phân loại thuật ngữ của ${title}`,
      contentFocus: concepts,
      learningSupport: 'Định hình các thuật ngữ chuyên ngành và thuộc tính phân loại vào bộ nhớ làm việc',
      importance: 'medium' as const,
      elementTarget: 'definition_schema_map',
      action: 'reveal',
      triggerWord: 'concept'
    };
  }
}
