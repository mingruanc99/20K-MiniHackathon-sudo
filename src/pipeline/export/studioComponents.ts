// src/pipeline/export/studioComponents.ts
/**
 * Video Studio component library (Lesson Style), as shown in the studio's plan screen
 * (source/825309678_…png). The script names one component per line so the scenes agent starts from
 * the right building block. Only the ten components whose names are readable there are listed;
 * the "Thêm trong Lesson Lab Style" row is unnamed in the screenshot. Add them here when known.
 */
export type StudioComponentId =
  | 'Card'
  | 'GlassBox'
  | 'Flow'
  | 'ProbabilityBars'
  | 'TokenChip'
  | 'Person'
  | 'QuestionCard'
  | 'Recap'
  | 'DialogueCard'
  | 'Countdown';

export interface StudioComponent {
  id: StudioComponentId;
  group: 'cards' | 'flow' | 'data' | 'figures' | 'beats';
  /** When the script picks it. */
  use: string;
}

const STUDIO_COMPONENTS: Record<StudioComponentId, StudioComponent> = {
  Card: { id: 'Card', group: 'cards', use: 'Một ý chính, định nghĩa hoặc công thức nổi bật (mặc định).' },
  GlassBox: { id: 'GlassBox', group: 'cards', use: 'So sánh hai phía, bảng hoặc khung nhiều ô.' },
  Flow: { id: 'Flow', group: 'flow', use: 'Quy trình, các bước, luồng dữ liệu, sơ đồ khối.' },
  ProbabilityBars: { id: 'ProbabilityBars', group: 'data', use: 'Tỷ lệ phần trăm, số liệu so sánh dạng thanh.' },
  TokenChip: { id: 'TokenChip', group: 'data', use: 'Thuật ngữ / token được giới thiệu lần đầu ("gọi là X").' },
  Person: { id: 'Person', group: 'figures', use: 'Ví dụ đời thực, tình huống có người, kể chuyện.' },
  QuestionCard: { id: 'QuestionCard', group: 'beats', use: 'Câu hỏi gợi mở, câu hỏi quiz và phần chữa bài.' },
  Recap: { id: 'Recap', group: 'beats', use: 'Tổng kết, đúc kết cuối phần.' },
  DialogueCard: { id: 'DialogueCard', group: 'figures', use: 'Đối thoại, trích lời, câu người dùng hỏi mô hình.' },
  Countdown: { id: 'Countdown', group: 'figures', use: 'Khoảng dừng quiz có đồng hồ đếm ngược.' }
};

export const STUDIO_COMPONENT_IDS = Object.keys(STUDIO_COMPONENTS) as StudioComponentId[];
