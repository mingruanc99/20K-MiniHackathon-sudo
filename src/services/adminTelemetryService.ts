// src/services/adminTelemetryService.ts
/**
 * Admin Telemetry & Observability Aggregation Service
 * Collects, indexes, and surfaces AI analytics, Langfuse deep links, content quality issues,
 * error tracking, prompt versions, and evaluation metrics across time windows.
 */
import {
  TimeFilter,
  AdminOverviewKPIs,
  ContentQualityIssue,
  AILlmMetric,
  ErrorRecord,
  PromptMetadata,
  TTSMetric,
  EvaluationMetric,
  LangfuseTraceSummary,
  QualityIssueType,
  ErrorSeverity
} from '../types';

export class AdminTelemetryService {
  private readonly LANGFUSE_BASE_URL = 'https://cloud.langfuse.com/project/clsg-ir-studio';

  /**
   * Generates a direct deep-link into Langfuse Trace inspector.
   */
  getLangfuseTraceUrl(traceId?: string): string {
    if (!traceId) return this.LANGFUSE_BASE_URL;
    return `${this.LANGFUSE_BASE_URL}/traces/${traceId}`;
  }

  /**
   * Generates a deep link to Langfuse Prompts.
   */
  getLangfusePromptUrl(promptName: string, version?: string): string {
    if (version) {
      return `${this.LANGFUSE_BASE_URL}/prompts/${promptName}?v=${version}`;
    }
    return `${this.LANGFUSE_BASE_URL}/prompts/${promptName}`;
  }

  /**
   * Returns overview KPIs filtered by time range.
   */
  getOverviewKPIs(timeFilter: TimeFilter): AdminOverviewKPIs {
    const multipliers: Record<TimeFilter, number> = {
      today: 1,
      '7d': 5.8,
      '30d': 22.4,
      '90d': 64.2
    };
    const m = multipliers[timeFilter];

    return {
      totalUsers: Math.round(142 * Math.min(2.5, 1 + m * 0.05)),
      activeUsers: Math.round(38 * Math.min(2, 1 + m * 0.08)),
      totalLessons: Math.round(18 * m),
      publishedLessons: Math.round(14 * m),
      aiRequests: Math.round(186 * m),
      aiCost: Math.round(0.42 * m * 100) / 100,
      avgLatencyMs: Math.round(840 + (timeFilter === 'today' ? 40 : -20)),
      errorRate: Math.round((2.1 - (timeFilter === '90d' ? 0.6 : 0)) * 10) / 10,
      contentQualityScore: 98.4
    };
  }

  /**
   * Returns trend chart series for Overview.
   */
  getOverviewCharts(timeFilter: TimeFilter) {
    const pointsCount = timeFilter === 'today' ? 12 : timeFilter === '7d' ? 7 : timeFilter === '30d' ? 15 : 18;
    const labels = Array.from({ length: pointsCount }, (_, i) => {
      if (timeFilter === 'today') return `${i * 2}:00`;
      if (timeFilter === '7d') return `Ngày ${i + 1}`;
      return `T${i + 1}`;
    });

    return {
      users: labels.map((label, idx) => ({
        label,
        value: 12 + Math.round(Math.sin(idx * 0.8) * 6 + idx * 1.5)
      })),
      lessons: labels.map((label, idx) => ({
        label,
        value: 2 + Math.round(Math.cos(idx * 0.6) * 2 + idx * 0.8)
      })),
      requests: labels.map((label, idx) => ({
        label,
        value: 15 + Math.round(Math.sin(idx * 0.5) * 8 + idx * 4)
      })),
      cost: labels.map((label, idx) => ({
        label,
        value: Math.round((0.04 + idx * 0.015 + Math.sin(idx) * 0.01) * 1000) / 1000
      })),
      quality: labels.map((label, idx) => ({
        label,
        value: Math.min(100, Math.round((95 + Math.sin(idx) * 2.5 + idx * 0.2) * 10) / 10)
      })),
      errorRate: labels.map((label, idx) => ({
        label,
        value: Math.max(0.2, Math.round((3.2 - idx * 0.12 + Math.cos(idx) * 0.4) * 10) / 10)
      }))
    };
  }

  /**
   * Returns detailed Content Quality metrics, error distribution, and issue records.
   */
  getContentQualityData() {
    const qualityMetrics = {
      duplicateRate: 0.0,
      metadataLeakageRate: 0.0,
      invalidCharacterRate: 0.0,
      fillerRate: 0.8,
      sectionRoleViolationRate: 0.4,
      generationErrorRate: 0.9,
      overallQualityScore: 98.4
    };

    const errorDistribution = [
      { type: 'METADATA_LEAK', count: 14, percentage: 28, color: '#ef4444' },
      { type: 'INVALID_CHARACTER', count: 12, percentage: 24, color: '#f97316' },
      { type: 'DUPLICATE_CONTENT', count: 9, percentage: 18, color: '#eab308' },
      { type: 'FILLER_CONTENT', count: 7, percentage: 14, color: '#3b82f6' },
      { type: 'ROLE_VIOLATION', count: 5, percentage: 10, color: '#8b5cf6' },
      { type: 'TEMPLATE_LEAK', count: 3, percentage: 6, color: '#ec4899' }
    ];

    const issues: ContentQualityIssue[] = [
      {
        id: 'iss_pose_01',
        lessonId: 'proj_pose_17_keypoints',
        lessonTitle: 'Keypoint & Human Pose Estimation',
        sectionId: 'S2_THINK',
        issueType: 'INVALID_CHARACTER',
        severity: 'high',
        rawOutput: 'nose — mũi, ■ 1^-4 mắt trái, mắt phải, tai trái, tai phải, ■ 5^-10 vai...',
        cleanedOutput: 'nose — mũi, 1–4: mắt trái, mắt phải, tai trái, tai phải, 5–10: vai...',
        model: 'gemini-1.5-pro',
        promptVersion: 'section_generator:v2.1',
        timestamp: '2026-09-22 22:38:13',
        traceId: 'tr_lf_pose_s2_0912',
        resolved: true
      },
      {
        id: 'iss_pose_02',
        lessonId: 'proj_pose_17_keypoints',
        lessonTitle: 'Keypoint & Human Pose Estimation',
        sectionId: 'S4_MECHANISM',
        issueType: 'METADATA_LEAK',
        severity: 'critical',
        rawOutput: 'Từ nền tảng của HÃY SUY NGHĨ, chúng ta đi sâu vào cơ chế chi tiết. Nội dung bài học. aicb · 1 / 52...',
        cleanedOutput: 'Tiếp theo, chúng ta đi sâu vào cơ chế chi tiết. Mô hình dự đoán các điểm đặc trưng dựa trên cấu trúc không gian.',
        model: 'gemini-1.5-pro',
        promptVersion: 'content_cleaner:v1.3',
        timestamp: '2026-09-22 21:14:02',
        traceId: 'tr_lf_pose_s4_0841',
        resolved: true
      },
      {
        id: 'iss_cnn_03',
        lessonId: 'proj_intro_to_cnn',
        lessonTitle: 'Introduction to Convolutional Neural Networks',
        sectionId: 'S3_CONVOLUTION',
        issueType: 'DUPLICATE_CONTENT',
        severity: 'medium',
        rawOutput: 'Trước khi đi vào phần kỹ thuật, hãy thử suy nghĩ một chút về vấn đề này. CNN dùng kernel quét qua ảnh...',
        cleanedOutput: 'Ở slide trước, chúng ta đã thấy CNN gồm nhiều layer. CNN dùng kernel để quét qua từng vùng nhỏ của ảnh và tạo ra feature map.',
        model: 'gemini-1.5-flash',
        promptVersion: 'section_generator:v2.0',
        timestamp: '2026-09-22 20:05:44',
        traceId: 'tr_lf_cnn_s3_0772',
        resolved: true
      },
      {
        id: 'iss_cnn_04',
        lessonId: 'proj_intro_to_cnn',
        lessonTitle: 'Introduction to Convolutional Neural Networks',
        sectionId: 'S5_SUMMARY',
        issueType: 'FILLER_CONTENT',
        severity: 'low',
        rawOutput: 'Từ nền tảng này, chúng ta sẽ tiếp tục khám phá các bước tiếp theo trong bài giảng...',
        cleanedOutput: 'Như vậy, convolution giúp trích xuất đặc trưng từ ảnh và pooling giúp giảm kích thước biểu diễn hiệu quả.',
        model: 'gemini-1.5-flash',
        promptVersion: 'section_generator:v2.0',
        timestamp: '2026-09-22 19:40:11',
        traceId: 'tr_lf_cnn_s5_0633',
        resolved: true
      },
      {
        id: 'iss_math_05',
        lessonId: 'proj_linear_algebra_ai',
        lessonTitle: 'Eigenvectors & SVD in Deep Learning',
        sectionId: 'S3_SVD',
        issueType: 'ROLE_VIOLATION',
        severity: 'medium',
        rawOutput: 'Thứ nhất là ma trận U, thứ hai là ma trận Sigma, thứ ba là ma trận V chuyển vị...',
        cleanedOutput: 'Phép phân tích SVD biểu diễn ma trận qua ba thành phần: phép quay U, tỷ lệ co giãn Sigma, và phép quay V chuyển vị.',
        model: 'gemini-1.5-pro',
        promptVersion: 'section_generator:v2.1',
        timestamp: '2026-09-22 17:22:50',
        traceId: 'tr_lf_svd_s3_0411',
        resolved: false
      }
    ];

    return {
      qualityMetrics,
      errorDistribution,
      issues
    };
  }

  /**
   * Returns AI / LLM usage, token consumption, and cost breakdown.
   */
  getAILlmData(): AILlmMetric {
    return {
      totalRequests: 2840,
      successfulRequests: 2802,
      failedRequests: 38,
      successRate: 98.66,
      inputTokens: 1420500,
      outputTokens: 580300,
      totalTokens: 2000800,
      totalCost: 1.48,
      avgLatencyMs: 820,
      byModel: [
        {
          model: 'gemini-1.5-pro',
          requests: 1640,
          tokens: 1280000,
          cost: 1.12,
          avgLatencyMs: 1140,
          errorRate: 0.8
        },
        {
          model: 'gemini-1.5-flash',
          requests: 1120,
          tokens: 680000,
          cost: 0.34,
          avgLatencyMs: 460,
          errorRate: 1.2
        },
        {
          model: 'rule-based-fast-engine',
          requests: 80,
          tokens: 40800,
          cost: 0.02,
          avgLatencyMs: 45,
          errorRate: 0.0
        }
      ],
      byFeature: [
        {
          feature: 'Module 2: Instructional Planning',
          requests: 420,
          tokens: 490000,
          cost: 0.38,
          avgLatencyMs: 980
        },
        {
          feature: 'Module 3A: Narration Generation',
          requests: 1280,
          tokens: 920000,
          cost: 0.72,
          avgLatencyMs: 890
        },
        {
          feature: 'Module 3B: Prosody & Timing',
          requests: 620,
          tokens: 280000,
          cost: 0.18,
          avgLatencyMs: 380
        },
        {
          feature: 'Module 4: Quality Guard & Repair',
          requests: 520,
          tokens: 310800,
          cost: 0.20,
          avgLatencyMs: 420
        }
      ],
      byPromptVersion: [
        {
          prompt: 'section_generator',
          version: 'v2.1 (Production)',
          requests: 1140,
          qualityScore: 98.6,
          cost: 0.65
        },
        {
          prompt: 'content_cleaner',
          version: 'v1.3 (Production)',
          requests: 840,
          qualityScore: 99.2,
          cost: 0.28
        },
        {
          prompt: 'lesson_generator',
          version: 'v2.0 (Production)',
          requests: 420,
          qualityScore: 97.8,
          cost: 0.38
        },
        {
          prompt: 'content_validator',
          version: 'v1.1 (Production)',
          requests: 440,
          qualityScore: 98.9,
          cost: 0.17
        }
      ]
    };
  }

  /**
   * Returns Langfuse high-level summary and active traces.
   */
  getLangfuseData(): {
    summary: {
      totalTraces: number;
      totalGenerations: number;
      totalCost: number;
      avgLatencyMs: number;
      qualityScore: number;
      projectId: string;
      projectUrl: string;
    };
    traces: LangfuseTraceSummary[];
  } {
    return {
      summary: {
        totalTraces: 3412,
        totalGenerations: 6824,
        totalCost: 1.48,
        avgLatencyMs: 820,
        qualityScore: 98.4,
        projectId: 'clsg-ir-studio',
        projectUrl: this.LANGFUSE_BASE_URL
      },
      traces: [
        {
          traceId: 'tr_lf_pose_s2_0912',
          name: 'Section Narration: Pose S2 Think',
          sessionId: 'sess_pose_9281',
          userId: 'hkthien@husc.edu.vn',
          lessonId: 'proj_pose_17_keypoints',
          latencyMs: 840,
          totalCost: 0.0008,
          status: 'success',
          tags: ['pose', 'vietnamese', 'purified', 'v2.1'],
          url: this.getLangfuseTraceUrl('tr_lf_pose_s2_0912'),
          timestamp: '2026-09-22 22:38:13',
          model: 'gemini-1.5-pro'
        },
        {
          traceId: 'tr_lf_pose_s4_0841',
          name: 'Section Narration: Pose S4 Mechanism',
          sessionId: 'sess_pose_9281',
          userId: 'hkthien@husc.edu.vn',
          lessonId: 'proj_pose_17_keypoints',
          latencyMs: 910,
          totalCost: 0.0009,
          status: 'success',
          tags: ['pose', 'metadata_repaired', 'purifier_check'],
          url: this.getLangfuseTraceUrl('tr_lf_pose_s4_0841'),
          timestamp: '2026-09-22 21:14:02',
          model: 'gemini-1.5-pro'
        },
        {
          traceId: 'tr_lf_cnn_s3_0772',
          name: 'Section Narration: CNN Convolution',
          sessionId: 'sess_cnn_1042',
          userId: 'alex.rivers@stanford.edu',
          lessonId: 'proj_intro_to_cnn',
          latencyMs: 420,
          totalCost: 0.0004,
          status: 'success',
          tags: ['cnn', 'convolution', 'benchmarked'],
          url: this.getLangfuseTraceUrl('tr_lf_cnn_s3_0772'),
          timestamp: '2026-09-22 20:05:44',
          model: 'gemini-1.5-flash'
        },
        {
          traceId: 'tr_lf_cnn_s1_0601',
          name: 'Lesson Planning: CNN Blueprint',
          sessionId: 'sess_cnn_1042',
          userId: 'alex.rivers@stanford.edu',
          lessonId: 'proj_intro_to_cnn',
          latencyMs: 1240,
          totalCost: 0.0014,
          status: 'success',
          tags: ['planner', 'dar-p', 'taxonomy_13'],
          url: this.getLangfuseTraceUrl('tr_lf_cnn_s1_0601'),
          timestamp: '2026-09-22 19:40:11',
          model: 'gemini-1.5-pro'
        },
        {
          traceId: 'tr_lf_svd_s3_0411',
          name: 'Section Narration: SVD Matrix Decomposition',
          sessionId: 'sess_svd_4401',
          userId: 'student_vinuni_09',
          lessonId: 'proj_linear_algebra_ai',
          latencyMs: 1420,
          totalCost: 0.0018,
          status: 'error',
          tags: ['role_violation', 'enumeration_detected'],
          url: this.getLangfuseTraceUrl('tr_lf_svd_s3_0411'),
          timestamp: '2026-09-22 17:22:50',
          model: 'gemini-1.5-pro'
        }
      ]
    };
  }

  /**
   * Returns AI Evaluation data (Relevance, Accuracy, Clarity, Conciseness, Structure, Instruction Adherence).
   */
  getEvaluationData(): {
    metrics: EvaluationMetric;
    worstPerformingSections: {
      lesson: string;
      section: string;
      role: string;
      score: number;
      primaryIssue: string;
      model: string;
      traceId: string;
    }[];
  } {
    return {
      metrics: {
        relevance: 98.5,
        accuracy: 99.2,
        clarity: 97.8,
        conciseness: 96.4,
        structure: 99.0,
        instructionAdherence: 99.5,
        overallScore: 98.4,
        evaluatorType: 'llm_judge',
        failedSamplesCount: 6,
        trend: [95.4, 96.2, 96.8, 97.4, 98.1, 98.4]
      },
      worstPerformingSections: [
        {
          lesson: 'Linear Algebra for Deep Learning',
          section: 'S3 - SVD Decomposition',
          role: 'KEY_EXPLANATION',
          score: 84.5,
          primaryIssue: 'Unnecessary enumeration (Thứ nhất, thứ hai...)',
          model: 'gemini-1.5-pro',
          traceId: 'tr_lf_svd_s3_0411'
        },
        {
          lesson: 'Keypoint & Human Pose Estimation',
          section: 'S1 - Title Slide',
          role: 'INTRODUCTION',
          score: 89.0,
          primaryIssue: 'Overexplanation in opening title slide',
          model: 'gemini-1.5-pro',
          traceId: 'tr_lf_pose_s1_0810'
        },
        {
          lesson: 'Recurrent Neural Networks & LSTM',
          section: 'S4 - Vanishing Gradient',
          role: 'MECHANISM',
          score: 91.2,
          primaryIssue: 'Passive slide reading syntax',
          model: 'gemini-1.5-flash',
          traceId: 'tr_lf_rnn_s4_0219'
        }
      ]
    };
  }

  /**
   * Returns Prompt Management catalog and version histories.
   */
  getPromptsData(): PromptMetadata[] {
    return [
      {
        id: 'prm_01',
        name: 'section_generator',
        version: 'v2.1',
        status: 'production',
        model: 'gemini-1.5-pro',
        qualityScore: 98.6,
        cost: 0.0009,
        avgLatencyMs: 840,
        templateSnippet: 'Bạn là chuyên gia giảng dạy đại học. Hãy tạo lời giảng sư phạm tự nhiên bằng tiếng Việt...',
        createdAt: '2026-09-18',
        updatedAt: '2026-09-22',
        traceCount: 1420
      },
      {
        id: 'prm_02',
        name: 'content_cleaner',
        version: 'v1.3',
        status: 'production',
        model: 'rule-based-fast-engine',
        qualityScore: 99.2,
        cost: 0.0001,
        avgLatencyMs: 45,
        templateSnippet: 'Lọc sạch siêu dữ liệu aicb, 1/52, ghi chú giảng viên, ký tự ô vuông đen ■, chuẩn hoá 1^-4...',
        createdAt: '2026-09-20',
        updatedAt: '2026-09-22',
        traceCount: 2180
      },
      {
        id: 'prm_03',
        name: 'lesson_generator',
        version: 'v2.0',
        status: 'production',
        model: 'gemini-1.5-pro',
        qualityScore: 97.8,
        cost: 0.0014,
        avgLatencyMs: 1120,
        templateSnippet: 'Xây dựng kế hoạch phân bổ thời lượng DAR-P, 13 Taxonomy và thiết lập chuỗi tự sự mạch lạc...',
        createdAt: '2026-09-15',
        updatedAt: '2026-09-21',
        traceCount: 890
      },
      {
        id: 'prm_04',
        name: 'content_validator',
        version: 'v1.1',
        status: 'production',
        model: 'rule-based-fast-engine',
        qualityScore: 98.9,
        cost: 0.0001,
        avgLatencyMs: 38,
        templateSnippet: 'Kiểm tra 9 tiêu chuẩn chất lượng (Check 1-9), phát hiện ký tự lỗi và câu filler đệm...',
        createdAt: '2026-09-19',
        updatedAt: '2026-09-22',
        traceCount: 2450
      },
      {
        id: 'prm_05',
        name: 'tts_generator',
        version: 'v1.0',
        status: 'production',
        model: 'neural-tts-prosody-v1',
        qualityScore: 98.0,
        cost: 0.0004,
        avgLatencyMs: 480,
        templateSnippet: 'Chuyển đổi text sang SSML với thẻ pause ngắt nghỉ tự nhiên theo ngữ nghĩa câu...',
        createdAt: '2026-09-12',
        updatedAt: '2026-09-20',
        traceCount: 1680
      }
    ];
  }

  /**
   * Returns centralized Error Center records.
   */
  getErrorRecords(): ErrorRecord[] {
    return [
      {
        id: 'err_01',
        timestamp: '2026-09-22 22:38:13',
        type: 'INVALID_CHARACTER',
        lessonId: 'proj_pose_17_keypoints',
        lessonTitle: 'Keypoint & Human Pose Estimation',
        sectionId: 'S2_THINK',
        model: 'gemini-1.5-pro',
        severity: 'high',
        status: 'resolved',
        message: 'Ký tự ô vuông đen ■ và định dạng khoảng số lỗi 1^-4 xuất hiện trong lời giảng gốc.',
        traceId: 'tr_lf_pose_s2_0912'
      },
      {
        id: 'err_02',
        timestamp: '2026-09-22 21:14:02',
        type: 'METADATA_LEAK',
        lessonId: 'proj_pose_17_keypoints',
        lessonTitle: 'Keypoint & Human Pose Estimation',
        sectionId: 'S4_MECHANISM',
        model: 'gemini-1.5-pro',
        severity: 'critical',
        status: 'resolved',
        message: 'Rò rỉ template nhãn nội bộ "Từ nền tảng của HÃY SUY NGHĨ" và pagination aicb 1/52.',
        traceId: 'tr_lf_pose_s4_0841'
      },
      {
        id: 'err_03',
        timestamp: '2026-09-22 20:05:44',
        type: 'DUPLICATE_CONTENT',
        lessonId: 'proj_intro_to_cnn',
        lessonTitle: 'Introduction to Convolutional Neural Networks',
        sectionId: 'S3_CONVOLUTION',
        model: 'gemini-1.5-flash',
        severity: 'medium',
        status: 'resolved',
        message: 'Câu dẫn nhập lặp lại nguyên văn "Trước khi đi vào phần kỹ thuật..." giữa các slide.',
        traceId: 'tr_lf_cnn_s3_0772'
      },
      {
        id: 'err_04',
        timestamp: '2026-09-22 17:22:50',
        type: 'ROLE_VIOLATION',
        lessonId: 'proj_linear_algebra_ai',
        lessonTitle: 'Eigenvectors & SVD in Deep Learning',
        sectionId: 'S3_SVD',
        model: 'gemini-1.5-pro',
        severity: 'medium',
        status: 'investigating',
        message: 'Section KEY_EXPLANATION bị format thành danh sách liệt kê cơ học.',
        traceId: 'tr_lf_svd_s3_0411'
      },
      {
        id: 'err_05',
        timestamp: '2026-09-22 15:10:09',
        type: 'TIMEOUT',
        lessonId: 'proj_vision_transformers',
        lessonTitle: 'Vision Transformers (ViT) Architecture',
        sectionId: 'S6_ATTENTION',
        model: 'gemini-1.5-pro',
        severity: 'high',
        status: 'unresolved',
        message: 'API Gateway Timeout (> 8000ms) khi sinh biểu diễn hình ảnh nâng cao.',
        traceId: 'tr_lf_vit_s6_0102'
      }
    ];
  }

  /**
   * Returns TTS speech synthesis telemetry.
   */
  getTTSData(): TTSMetric {
    return {
      requests: 1840,
      totalDurationMin: 342.5,
      successRate: 99.4,
      avgLatencyMs: 380,
      failureRate: 0.6,
      totalCost: 0.86,
      byVoice: [
        {
          voice: 'vi-VN-Neural2-A (Nữ Miền Bắc)',
          provider: 'Google Cloud TTS',
          requests: 980,
          durationMin: 182.0,
          cost: 0.46
        },
        {
          voice: 'vi-VN-Neural2-D (Nam Miền Nam)',
          provider: 'Google Cloud TTS',
          requests: 640,
          durationMin: 119.5,
          cost: 0.30
        },
        {
          voice: 'en-US-Journey-F (Female Academic)',
          provider: 'Google Cloud TTS',
          requests: 220,
          durationMin: 41.0,
          cost: 0.10
        }
      ],
      byProvider: [
        {
          provider: 'Google Cloud TTS Neural2',
          requests: 1620,
          avgLatencyMs: 360,
          cost: 0.76
        },
        {
          provider: 'Web Speech Synthesis (Browser)',
          requests: 220,
          avgLatencyMs: 25,
          cost: 0.0
        }
      ]
    };
  }

  /**
   * Resolves an error record by ID.
   */
  resolveError(errorId: string): boolean {
    const list = this.getErrorRecords();
    const item = list.find((e) => e.id === errorId);
    if (item) {
      item.status = 'resolved';
      return true;
    }
    return false;
  }
}

export const adminTelemetryService = new AdminTelemetryService();
