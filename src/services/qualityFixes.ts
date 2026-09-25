// src/services/qualityFixes.ts
/**
 * Turns failing quality checks into guidance a lecturer can act on:
 * why it failed (plain Vietnamese), how to fix it, which scenes are affected, and one-click actions.
 */
import { Project, CLSGScene, ValidationCheck } from '../types';
import { countLeadingConnectives, countHeadingMentions, splitSentences, HeadingSpec } from '../pipeline/services/discoursePolicy';
import { contentPurifierService } from '../pipeline/services/contentPurifierService';
import { technicalTerminologyService } from '../pipeline/services/technicalTerminologyService';

export type FixActionKind = 'set_duration' | 'switch_engine' | 'regenerate' | 'review_structure' | 'edit_scenes' | 'open_studio';

export interface FixAction {
  kind: FixActionKind;
  label: string;
  /** set_duration: seconds; switch_engine: engine id; edit_scenes: scene ids. */
  value?: number | string | string[];
  primary?: boolean;
}

export interface FixItem {
  checkId: string;
  title: string;
  why: string;
  how: string[];
  sceneIds: string[];
  actions: FixAction[];
  severity: 'FAILED' | 'WARNING';
}

const minutesLabel = (sec: number) => {
  const m = Math.max(1, Math.round(sec / 60));
  return `${m} phút`;
};

function scenesWith(scenes: CLSGScene[], pred: (s: CLSGScene) => boolean) {
  return scenes.filter((s) => s.narration.text && pred(s)).map((s) => s.section_id);
}

export function diagnoseLecture(project: Project): FixItem[] {
  const ir = project.clsgIr;
  const report = project.qualityReport || ir?.quality_report;
  if (!ir || !report) return [];
  const scenes = ir.scenes;
  const cfg = project.configuration;
  const isLlm = cfg.narrationEngine === 'llm';
  const lang = (cfg.narration_language || cfg.language) === 'en' ? 'en' : 'vi';
  const failing = report.checks.filter((c) => c.status !== 'PASSED');
  const items: FixItem[] = [];

  const push = (c: ValidationCheck, item: Omit<FixItem, 'checkId' | 'severity'>) =>
    items.push({ ...item, checkId: c.check_id, severity: c.status === 'FAILED' ? 'FAILED' : 'WARNING' });

  for (const c of failing) {
    switch (c.check_id) {
      case 'chk_dar_p': {
        const actual = report.actual_duration_sec;
        const target = report.target_duration_sec;
        if (actual < target) {
          push(c, {
            title: `Lời giảng ngắn hơn mục tiêu (${minutesLabel(actual)} so với ${minutesLabel(target)})`,
            why: 'Nội dung trên slide không đủ để nói hết thời lượng đã đặt. Hệ thống không thêm câu đệm, nên bài giảng ngắn hơn.',
            how: [
              `Giảm tổng thời lượng xuống khoảng ${minutesLabel(actual)} cho khớp với lượng nội dung.`,
              isLlm ? 'Thêm ghi chú giảng viên (speaker notes) vào slide rồi quét lại.' : 'Chuyển sang "AI viết" để có lời giảng giải thích chi tiết hơn.',
              'Hoặc bật lại những trang đã tắt ở bước duyệt cấu trúc.'
            ],
            sceneIds: [],
            actions: [
              { kind: 'set_duration', label: `Đặt thời lượng ${minutesLabel(actual)} và tạo lại`, value: Math.max(60, Math.round(actual / 60) * 60), primary: true },
              ...(isLlm ? [] : [{ kind: 'switch_engine' as const, label: 'Chuyển sang AI viết và tạo lại', value: 'llm' }]),
              { kind: 'review_structure', label: 'Mở bước duyệt cấu trúc' }
            ]
          });
        } else {
          push(c, {
            title: `Lời giảng dài hơn mục tiêu (${minutesLabel(actual)} so với ${minutesLabel(target)})`,
            why: 'Tổng số chữ cần nói vượt quá thời lượng đã đặt ở tốc độ đọc hiện tại.',
            how: [
              `Tăng tổng thời lượng lên khoảng ${minutesLabel(actual)}.`,
              'Hoặc tắt bớt các trang ít quan trọng (mục lục, trang cảm ơn, trang minh hoạ lặp) ở bước duyệt cấu trúc.',
              'Hoặc sửa bớt câu dài trong các cảnh bên dưới.'
            ],
            sceneIds: [],
            actions: [
              { kind: 'set_duration', label: `Đặt thời lượng ${minutesLabel(actual)} và tạo lại`, value: Math.round(actual / 60) * 60 || 60, primary: true },
              { kind: 'review_structure', label: 'Bỏ bớt trang' }
            ]
          });
        }
        break;
      }
      case 'chk_connective_density': {
        const ids = scenesWith(scenes, (s) => {
          const r = countLeadingConnectives(s.narration.text, lang);
          return r.sentences > 0 && r.connectives / r.sentences > 0.34;
        });
        push(c, {
          title: 'Dùng từ nối quá dày',
          why: `Quá nhiều câu mở đầu bằng "Tuy nhiên", "Vì vậy", "Ngoài ra"… (${String(c.actual_value).split('•')[0].trim()}). Nghe như văn viết, không tự nhiên.`,
          how: ['Bấm "Tạo lại": bộ lọc từ nối sẽ chạy lại.', 'Hoặc sửa trực tiếp các cảnh được đánh dấu: bỏ từ nối ở câu không thật sự đối lập hay nhân quả.'],
          sceneIds: ids,
          actions: [
            { kind: 'edit_scenes', label: `Sửa ${ids.length || ''} cảnh`.replace('  ', ' '), value: ids, primary: ids.length > 0 },
            { kind: 'regenerate', label: 'Tạo lại' }
          ]
        });
        break;
      }
      case 'chk_heading_repetition': {
        const specs: HeadingSpec[] = scenes.map((s) => ({ sceneId: s.section_id, sectionTitle: s.topic }));
        const ids = scenes
          .filter((s, i) => countHeadingMentions([s.narration.text], specs.filter((_, j) => j !== i)).mentions > 0)
          .map((s) => s.section_id);
        push(c, {
          title: 'Nhắc lại tiêu đề nhiều lần',
          why: 'Một số cảnh đọc lại tên mục của cảnh khác (thường là câu chuyển ý kiểu "tiếp theo là phần…").',
          how: ['Sửa các cảnh được đánh dấu: thay tên mục bằng ý chính của nội dung.', 'Hoặc bấm "Tạo lại" để bộ lọc tiêu đề chạy lại.'],
          sceneIds: ids,
          actions: [
            { kind: 'edit_scenes', label: 'Sửa các cảnh này', value: ids, primary: ids.length > 0 },
            { kind: 'regenerate', label: 'Tạo lại' }
          ]
        });
        break;
      }
      case 'chk_anti_repetition_flow': {
        const seen: string[] = [];
        const ids = scenesWith(scenes, (s) =>
          splitSentences(s.narration.text).some((sent) => {
            const n = sent.toLowerCase();
            const dup = n.length > 25 && seen.includes(n);
            seen.push(n);
            return dup;
          })
        );
        push(c, {
          title: 'Có câu lặp giữa các cảnh',
          why: 'Hai cảnh nói gần như cùng một câu, thường do slide lặp nội dung.',
          how: ['Sửa cảnh được đánh dấu để nói ý mới, hoặc tắt trang trùng ở bước duyệt cấu trúc.'],
          sceneIds: ids,
          actions: [
            { kind: 'edit_scenes', label: 'Sửa các cảnh này', value: ids, primary: true },
            { kind: 'review_structure', label: 'Tắt trang trùng' }
          ]
        });
        break;
      }
      case 'chk_factual_grounding':
        push(c, {
          title: 'Lời giảng ít bám sát tài liệu',
          why: `Chỉ ${String(c.actual_value).match(/\((\d+%)\)/)?.[1] || 'một phần'} từ nội dung trong lời giảng có trong tài liệu gốc.${isLlm ? ' AI có thể đã diễn giải quá xa slide.' : ''}`,
          how: isLlm
            ? ['Chuyển về "Theo mẫu" để bám sát chữ trên slide.', 'Hoặc đọc lại và sửa các đoạn không có trong tài liệu.']
            : ['Kiểm tra lại các cảnh có nội dung lấy từ OCR bảng/sơ đồ; sửa nếu đọc sai.'],
          sceneIds: [],
          actions: [
            ...(isLlm ? [{ kind: 'switch_engine' as const, label: 'Chuyển về Theo mẫu và tạo lại', value: 'template', primary: true }] : []),
            { kind: 'edit_scenes', label: 'Sửa lời giảng', value: scenes.map((s) => s.section_id) }
          ]
        });
        break;
      case 'chk_language_terminology': {
        const ids = scenesWith(scenes, (s) => technicalTerminologyService.validateNarration(s.narration.text).status === 'FAILED');
        push(c, {
          title: 'Chêm tiếng Anh không cần thiết',
          why: 'Một số câu dùng từ tiếng Anh thông thường (scan, image, process…) thay vì tiếng Việt; thuật ngữ chuẩn như CNN, kernel vẫn được giữ.',
          how: ['Sửa các cảnh được đánh dấu: thay từ tiếng Anh thông thường bằng tiếng Việt.'],
          sceneIds: ids,
          actions: [{ kind: 'edit_scenes', label: 'Sửa các cảnh này', value: ids, primary: true }]
        });
        break;
      }
      case 'chk_content_purification':
      case 'chk_unicode_glyph_integrity': {
        const ids = scenesWith(scenes, (s) => !contentPurifierService.validateNarration(s.narration.text).isValid);
        push(c, {
          title: c.check_id === 'chk_unicode_glyph_integrity' ? 'Còn ký tự lỗi trong lời giảng' : 'Lời giảng còn nhãn hoặc ghi chú nội bộ',
          why: 'Có đoạn không phải lời giảng (số trang, mã môn học, [ngoặc vuông], ký tự ■…) còn sót lại.',
          how: ['Sửa các cảnh được đánh dấu và xoá phần không đọc thành lời.'],
          sceneIds: ids,
          actions: [{ kind: 'edit_scenes', label: 'Sửa các cảnh này', value: ids, primary: true }]
        });
        break;
      }
      default:
        push(c, {
          title: c.rule_name,
          why: c.message,
          how: ['Xem chi tiết trong Studio đầy đủ.'],
          sceneIds: [],
          actions: [{ kind: 'open_studio', label: 'Mở Studio' }]
        });
    }
  }
  return items;
}
