// src/pipeline/module3_generator/styleProfiles.ts
/**
 * Narration style profiles: the "stylistic wrapper" put around the same semantic core.
 *
 * The LLM writes the studio script in the chosen style and copies the formulas verbatim
 * (llmScriptWriter). What the style may
 * change: vocabulary, sentence length/rhythm, metaphors. What it may never change: facts from the
 * page, and formulas/symbols (formulaIntegrity).
 *
 * The guard measures the measurable parts of a profile on the final narration: banned phrases and
 * the average sentence length range (qualityGuard, chk_style_conformance).
 * Styles only apply to the LLM engine; the template engine has one fixed voice.
 */
import type { NarrationStyle } from '../../types';

export interface StyleProfile {
  id: NarrationStyle;
  /** Short Vietnamese label for the UI. */
  label: string;
  /** What the style is for (prompt + UI hint). */
  intent: string;
  vocabulary: string;
  rhythm: string;
  metaphors: string;
  formulas: string;
  /** Average words per sentence the guard accepts for this style. */
  sentenceWords: [number, number];
  /** Case-insensitive phrases that must not appear (checked by the guard). */
  banned: string[];
  /** Tone-only examples on a topic unlikely to be the lecture's (never reuse their facts). */
  examples: string[];
}

/** Openers every style bans: they carry no content and are what listeners skip. */
const UNIVERSAL_BANNED = [
  'hôm nay chúng ta sẽ tìm hiểu',
  'trong bài giảng này, chúng ta sẽ',
  'hãy cùng tìm hiểu',
  'như chúng ta đã biết',
  'không phải ai cũng biết',
  "in today's lecture we will",
  "let's dive into"
];

const INTERNET_SLANG = ['gigachad', 'quay xe', 'ăn liền', 'bay màu', 'khét lẹt', 'đỉnh nóc', 'kịch trần', 'xịn xò', 'hết nước chấm'];

export const STYLE_PROFILES: Record<NarrationStyle, StyleProfile> = {
  academic: {
    id: 'academic',
    label: 'Học thuật',
    intent: 'Chính xác, trung lập, như một bài giảng đại học chuẩn mực.',
    vocabulary: 'Thuật ngữ chuẩn hoá, trung tính ("suy giảm", "bão hoà", "triệt tiêu"). Không tiếng lóng, không cảm thán.',
    rhythm: 'Câu hoàn chỉnh, có liên từ logic (nhân quả, tương phản) khi quan hệ đó thật sự tồn tại.',
    metaphors: 'Hạn chế ẩn dụ; nếu cần, dùng hình ảnh toán học hoặc đồ thị.',
    formulas: 'Phát biểu công thức, rồi giải thích ý nghĩa từng ký hiệu.',
    sentenceWords: [12, 28],
    banned: [...UNIVERSAL_BANNED, ...INTERNET_SLANG],
    examples: [
      'Khi hệ số ma sát tăng, quãng đường trượt của vật giảm tương ứng. Nói cách khác, ma sát chuyển động năng thành nhiệt nhanh hơn.'
    ]
  },
  conversational: {
    id: 'conversational',
    label: 'Trò chuyện',
    intent: 'Như giảng viên nói chuyện trực tiếp với sinh viên: gần gũi nhưng vẫn chuẩn xác.',
    vocabulary: 'Từ ngữ đời thường, xưng "chúng ta"; giữ thuật ngữ chuẩn.',
    rhythm: 'Câu vừa phải, thỉnh thoảng một câu hỏi tu từ để dẫn ý.',
    metaphors: 'Ví dụ đời thường ngắn, chỉ khi nó làm rõ cơ chế.',
    formulas: 'Đọc công thức rồi nói ngay nó có nghĩa gì trong thực tế.',
    sentenceWords: [8, 22],
    banned: [...UNIVERSAL_BANNED, ...INTERNET_SLANG],
    examples: ['Vì sao phanh gấp trên đường ướt lại nguy hiểm? Vì ma sát giảm, nên xe cần quãng đường dài hơn mới dừng được.']
  },
  rigorous: {
    id: 'rigorous',
    label: 'Chặt chẽ',
    intent: 'Toán học chặt chẽ: định nghĩa, giả thiết, hệ quả.',
    vocabulary: 'Thuật ngữ toán chính xác; không dùng từ mơ hồ ("kiểu như", "đại khái", "gần như là").',
    rhythm: 'Định nghĩa trước, điều kiện sau, kết luận cuối. Mỗi câu một mệnh đề logic.',
    metaphors: 'Không dùng ẩn dụ.',
    formulas: 'Nêu công thức, điều kiện áp dụng có trong tài liệu, và vai trò từng ký hiệu.',
    sentenceWords: [12, 30],
    banned: [...UNIVERSAL_BANNED, ...INTERNET_SLANG, 'kiểu như', 'đại khái', 'gần như là'],
    examples: ['Gọi μ là hệ số ma sát. Với lực pháp tuyến N không đổi, lực ma sát trượt bằng μN và có chiều ngược với vận tốc.']
  },
  engaging: {
    id: 'engaging',
    // Voice of source/sample.md: a presenter talking to "bạn", visual and lively, moderate pace.
    label: 'Trực quan, cuốn hút',
    intent: 'Như người dẫn chương trình giáo dục: nói chuyện với "bạn", gợi hình, đặt câu hỏi rồi tự trả lời, nhịp vừa phải.',
    vocabulary: 'Xưng "bạn"; động từ mạnh, hình ảnh cụ thể ("Hãy tưởng tượng…", "Hãy hình dung…"); chốt thuật ngữ bằng "Đó chính là …"; giữ thuật ngữ chuẩn.',
    rhythm: 'Đặt câu hỏi ("Bạn làm gì?", "Làm sao biết…?", "Nhưng nếu … thì sao?") rồi trả lời ngay; xen câu cảm thán ngắn để nhấn; mở bằng lời chào, kết bằng "Cảm ơn bạn đã theo dõi!".',
    metaphors: 'Một hình ảnh đời thực khớp đúng cơ chế (leo núi trong sương mù cho Gradient Descent); không dùng nếu không khớp.',
    formulas: 'Nói công thức làm gì bằng lời, đưa công thức nguyên văn lên màn hình, rồi chốt ý nghĩa của nó.',
    sentenceWords: [8, 24],
    banned: [...UNIVERSAL_BANNED, ...INTERNET_SLANG],
    examples: [
      'Làm sao biết đường thẳng nào là chuẩn nhất? Ta tính khoảng cách từ mỗi điểm tới đường dự đoán, bình phương lên rồi lấy trung bình, đó chính là hàm mất mát MSE.',
      'Hãy hình dung bạn bị bịt mắt đứng trên đỉnh núi trong sương mù và muốn xuống đáy thung lũng, bạn sẽ dò độ dốc dưới chân rồi bước một bước theo hướng dốc xuống!'
    ]
  },
  meme: {
    id: 'meme',
    label: 'Meme / video ngắn',
    intent: 'Nhịp nhanh kiểu TikTok/Shorts, hài hước, dễ nhớ, nhưng kiến thức và công thức phải đúng tuyệt đối.',
    vocabulary:
      'Được dùng tiếng lóng mạng vừa phải ("quay xe", "ăn liền", "GigaChad", "bay màu"). Tránh văn hàn lâm ("do đó", "tiến hành", "nhằm mục đích").',
    rhythm: 'Câu ngắn, ngắt nhịp liên tục, cấu trúc gài bẫy rồi chốt (set-up → punchline). Vào thẳng trọng tâm, không chào hỏi dài.',
    metaphors:
      'Nhân hoá mạnh, ghép khái niệm với meme quen thuộc khi cơ chế khớp 1-1: Drake (chọn cái đơn giản, từ chối cái phức tạp), Galaxy Brain (tưởng phức tạp hoá ra đơn giản), Uno Reverse (đảo chiều dòng chảy), cú búng tay Thanos (biến mất ngẫu nhiên một nửa), Cheems vs GigaChad (yếu ớt vs mạnh mẽ). Không ghép khiên cưỡng.',
    formulas: 'Biến công thức thành "chiêu thức", nhưng ký hiệu phải chép nguyên văn, hoặc tả bằng lời; không bao giờ viết lại ký hiệu theo cách khác.',
    sentenceWords: [4, 13],
    banned: [...UNIVERSAL_BANNED, 'chào các bạn', 'tiến hành khảo sát', 'nhằm mục đích', 'như đã đề cập ở trên'],
    examples: [
      'Đường ướt. Đạp phanh. Xe vẫn trôi như chưa hề có cuộc chia ly. Thủ phạm? Ma sát bay màu. Công thức chốt hạ: lực ma sát bằng μN, μ nhỏ là ăn hành.'
    ]
  },
  engineering: {
    id: 'engineering',
    label: 'Kỹ sư',
    intent: 'Thực dụng: vấn đề, nguyên nhân, cách xử lý, đánh đổi.',
    vocabulary: 'Từ kỹ thuật chính xác, hành động trực tiếp ("tối ưu", "nút thắt", "đánh đổi"). Không cảm thán, không tiếng lóng.',
    rhythm: 'Vấn đề → nguyên nhân → giải pháp. Câu gọn, mỗi câu một ý hành động.',
    metaphors: 'Ẩn dụ cơ khí/hệ thống: đường ống, nút thắt cổ chai, bộ đệm.',
    formulas: 'Nêu công thức kèm ràng buộc hoặc chi phí tính toán nếu tài liệu có ghi; không tự thêm độ phức tạp không có trong nguồn.',
    sentenceWords: [7, 18],
    banned: [...UNIVERSAL_BANNED, ...INTERNET_SLANG, 'vô cùng tuyệt vời', 'thật tuyệt vời'],
    examples: ['Xe trượt dài trên đường ướt vì hệ số ma sát giảm. Cách xử lý: giảm tốc sớm hơn, hoặc dùng lốp có rãnh thoát nước để giữ μ.']
  }
};

export const STYLE_IDS = Object.keys(STYLE_PROFILES) as NarrationStyle[];

export function getStyleProfile(style?: NarrationStyle): StyleProfile {
  return STYLE_PROFILES[style || 'academic'] || STYLE_PROFILES.academic;
}

/** Prompt block for the LLM narration call. */
export function stylePromptBlock(style?: NarrationStyle): string {
  const p = getStyleProfile(style);
  return `STYLE: ${p.label}: ${p.intent}
- Vocabulary: ${p.vocabulary}
- Rhythm: ${p.rhythm} Aim for about ${p.sentenceWords[0]}-${p.sentenceWords[1]} words per sentence on average.
- Metaphors: ${p.metaphors}
- Formulas: ${p.formulas}
- Never use: ${p.banned.map((b) => `"${b}"`).join(', ')}
TONE EXAMPLE (different topic, copy the voice only, never its facts):
${p.examples.map((e) => `"${e}"`).join('\n')}`;
}

export interface StyleMeasure {
  bannedHits: string[];
  avgSentenceWords: number;
  sentences: number;
}

export function measureStyle(text: string, style?: NarrationStyle): StyleMeasure {
  const p = getStyleProfile(style);
  const lower = text.toLowerCase();
  const sentences = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter((s) => /\p{L}/u.test(s));
  const words = sentences.reduce((n, s) => n + s.split(/\s+/).length, 0);
  return {
    bannedHits: p.banned.filter((b) => lower.includes(b.toLowerCase())),
    avgSentenceWords: sentences.length ? words / sentences.length : 0,
    sentences: sentences.length
  };
}
