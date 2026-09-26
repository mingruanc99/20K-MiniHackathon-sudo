// src/pipeline/module3_generator/llmScriptWriter.ts
/**
 * Module 3A (LLM mode): the LLM writes the studio script directly, in the handoff format
 * (source/HANDOFF-TEAM-KICH-BAN.md), for many pages per call.
 *
 * One call covers up to PAGES_PER_CALL pages (a 10-page deck is one call instead of one per page), so a
 * free-tier key with a few requests per minute can write a whole lecture, and the model sees the whole
 * lesson: transitions and logic run across pages instead of every page starting from scratch.
 *
 * Per page the model returns the formulas it copied and one entry per spoken sentence:
 *   { kieu (delivery), loi (speech), man_hinh (on screen), thanh_phan (studio component) }
 * plus three review quizzes for the lesson. The pipeline then applies the same discourse policies,
 * formula integrity and guard as for any narration; the export keeps the model's delivery, screen text
 * and component for every sentence that survived those repairs.
 */
import type { DocumentSection, LessonIndexEntry, SectionPlan, StudioLine, StudioQuizItem, UserConfiguration } from '../../types';
import { llmRouter } from '../../services/llm/LLMRouter';
import { contentPurifierService } from '../services/contentPurifierService';
import { extractSourceFormulas } from '../services/formulaIntegrity';
import { lessonIndexPromptBlock } from '../services/lessonIndex';
import { STUDIO_COMPONENT_IDS } from '../export/studioComponents';
import { stylePromptBlock } from './styleProfiles';

const PAGES_PER_CALL = 10;
const DELIVERIES = ['kể', 'giảng', 'thân mật', 'hỏi', 'chốt'] as const;

export interface ScriptPageInput {
  plan: SectionPlan;
  section?: DocumentSection;
  keywords: string[];
  /** Formulas/definitions from earlier pages that this page mentions (lesson index). */
  earlier?: LessonIndexEntry[];
  chapter?: { title: string; isFirstPage: boolean };
}

export interface ScriptPageResult {
  narration: string;
  lines: StudioLine[];
  formulas: string[];
}

export interface ScriptResult {
  pages: (ScriptPageResult | null)[];
  quiz: StudioQuizItem[];
  /** Why pages are missing (rate limit, bad JSON...), shown to the user instead of failing silently. */
  errors: string[];
}

const SYSTEM = `Bạn là biên kịch bài giảng video cho Video Studio của một trường đại học Việt Nam.
Bạn viết lời giảng bằng tiếng Việt nói tự nhiên, mạch lạc, đúng kiến thức trong tài liệu, theo đúng quy chuẩn kịch bản dưới đây.`;

const RULES = `QUY CHUẨN KỊCH BẢN (bắt buộc):
1. Mỗi trang là một chuỗi câu. MỖI CÂU = MỘT CẢNH, trường "loi" chỉ chứa ĐÚNG MỘT câu, 15–28 từ (không dưới 8, không quá 40).
2. "loi" là lời máy TTS đọc và phụ đề hiển thị:
   - KHÔNG viết chữ số 0-9: viết bằng chữ ("ba lớp", "năm hai nghìn không trăm hai mươi tư", "chín mươi hai phẩy năm phần trăm"). Con số gốc đưa lên "man_hinh".
   - Giữ nguyên thuật ngữ/tên riêng tiếng Anh (Pose Estimation, OpenPose, ReLU), KHÔNG phiên âm ("Ô-pừn-pốt" là sai).
   - Lần đầu nhắc một thuật ngữ tiếng Anh: nghĩa tiếng Việt đứng TRƯỚC, rồi "gọi là <thuật ngữ>" (ví dụ: "trường vector định hướng nối các chi, gọi là Part Affinity Fields").
   - Không đọc ký hiệu toán; mô tả công thức bằng lời, công thức nguyên văn đưa lên "man_hinh".
   - Không đọc tiêu đề trang, không nói "slide này", "trang tiếp theo", không chào lại ở các trang sau trang đầu.
3. Chỉ dùng kiến thức có trong nội dung trang và bài học. KHÔNG thêm số liệu, sự kiện, ví dụ cụ thể không có trong tài liệu.
   Câu lấp chỗ trong tài liệu (ví dụ "Tổng quan nội dung phần 3: cơ sở lý thuyết và ứng dụng thực tiễn") thì bỏ qua, không giảng.
   Nếu trang chỉ có tiêu đề và vài ý ngắn, hãy giảng ý nghĩa của các ý đó trong mạch bài học, ngắn gọn, không bịa chi tiết.
4. Mạch bài: nối ý giữa các trang (vì sao cần trang này sau trang trước), không lặp lại câu đã nói, mỗi ý nói một lần.
5. "kieu" là một trong: kể (ví dụ, bối cảnh), giảng (giải thích, mặc định), thân mật (lời khuyên, lưu ý), hỏi (câu hỏi gợi mở), chốt (đúc kết).
   Không để quá năm câu liền cùng một kiểu.
6. "man_hinh": thứ hiện trên màn hình cho câu đó, ngắn gọn, ngăn bằng " · ". BẮT BUỘC có khi câu nói số liệu (ghi số gốc, ví dụ "33 LANDMARKS"). Công thức chép nguyên văn.
7. "thanh_phan": một trong ${STUDIO_COMPONENT_IDS.join(', ')}.
   Card: một ý/định nghĩa/công thức · GlassBox: so sánh, bảng · Flow: quy trình, luồng, kiến trúc · ProbabilityBars: số liệu so sánh, phần trăm ·
   TokenChip: giới thiệu thuật ngữ · Person: ví dụ có người, tình huống · QuestionCard: câu hỏi · Recap: tổng kết · DialogueCard: đối thoại.
8. Tổng số từ trong "loi" của mỗi trang gần với NGÂN SÁCH TỪ của trang đó (±15%).`;

const EXAMPLE = `VÍ DỤ ĐỊNH DẠNG (chủ đề khác, chỉ tham khảo giọng văn và cách tách câu, KHÔNG dùng lại nội dung):
{"kieu": "giảng", "loi": "Để bắt đầu, chúng ta cần làm rõ bốn thuật ngữ nền tảng thường bị dùng lẫn lộn trong ngành an toàn trí tuệ nhân tạo.", "man_hinh": "AI SAFETY · 4 THUẬT NGỮ NỀN TẢNG", "thanh_phan": "Card"}
{"kieu": "giảng", "loi": "Thứ nhất là hoạt động chủ động đóng vai kẻ tấn công để tìm lỗ hổng trước khi triển khai, gọi là Red Teaming.", "man_hinh": "RED TEAMING · Kiểm thử đối kháng", "thanh_phan": "TokenChip"}
{"kieu": "chốt", "loi": "Việc căn chỉnh không phải bài toán giải một lần là xong, mỗi khi dữ liệu thay đổi chúng ta phải đánh giá lại.", "man_hinh": "ĐÁNH GIÁ LẠI ĐỊNH KỲ", "thanh_phan": "Recap"}`;

/** Voice of source/sample.md (presenter talking to "bạn"), for the lively styles. */
const EXAMPLE_VISUAL = `VÍ DỤ GIỌNG VĂN (chủ đề khác, chỉ tham khảo giọng và cách tách câu, KHÔNG dùng lại nội dung):
{"kieu": "hỏi", "loi": "Nếu muốn viết chương trình phân biệt ảnh chó và mèo bằng lập trình truyền thống, bạn sẽ phải viết bao nhiêu dòng lệnh điều kiện?", "man_hinh": "LẬP TRÌNH TRUYỀN THỐNG vs AI?", "thanh_phan": "QuestionCard"}
{"kieu": "kể", "loi": "Hãy hình dung bạn bị bịt mắt đứng trên đỉnh núi trong sương mù và muốn xuống đáy thung lũng, nơi sai số là thấp nhất.", "man_hinh": "ĐỒ THỊ HÀM MẤT MÁT · ĐỈNH NÚI → ĐÁY THUNG LŨNG", "thanh_phan": "Person"}
{"kieu": "giảng", "loi": "Bạn dò độ dốc dưới chân rồi bước một bước theo hướng dốc xuống, đó chính là thuật toán giảm theo đạo hàm, gọi là Gradient Descent.", "man_hinh": "GRADIENT DESCENT · θ ← θ − α∇J(θ)", "thanh_phan": "TokenChip"}
{"kieu": "chốt", "loi": "Hiểu được bản chất này, bạn sẽ không còn xem mô hình như một chiếc hộp đen bí ẩn nữa, cảm ơn bạn đã theo dõi!", "man_hinh": "TỔNG KẾT", "thanh_phan": "Recap"}`;

const exampleFor = (style?: UserConfiguration['narrationStyle']) =>
  style === 'engaging' || style === 'conversational' || style === 'meme' ? EXAMPLE_VISUAL : EXAMPLE;

function pageBlock(p: ScriptPageInput, index: number): string {
  const body = (p.section?.elements || [])
    .filter((e) => e.type !== 'title' && e.text)
    .map((e) => `${e.type === 'note' ? '[ghi chú giảng viên] ' : e.region_id ? `[${e.type} đọc từ hình] ` : '- '}${e.text}`)
    .join('\n')
    .slice(0, 2000);
  const formulas = extractSourceFormulas(p.section);
  return `=== TRANG ${p.plan.section_id} (thứ ${index}) ===
Tiêu đề: ${p.plan.title}
${p.chapter?.isFirstPage ? `Mở đầu chương: "${p.chapter.title}" (được nhắc tên chương một lần)\n` : ''}Vai trò: ${p.plan.slide_analysis?.slide_role || p.plan.pedagogical_function} · Mục tiêu: ${p.plan.instructional_goal}
Từ khóa: ${p.keywords.slice(0, 8).join(', ') || '(không có)'}
NGÂN SÁCH TỪ: khoảng ${p.plan.target_word_budget} từ
Nội dung:
${body || '(chỉ có tiêu đề)'}
${formulas.length ? `Công thức (chép nguyên văn vào "cong_thuc" và "man_hinh"):\n${formulas.map((f) => `- ${f}`).join('\n')}\n` : ''}${lessonIndexPromptBlock(p.earlier || [])}`;
}

function buildPrompt(chunk: ScriptPageInput[], offset: number, total: number, lessonTitle: string, config: UserConfiguration, withQuiz: boolean): string {
  const first = offset === 0;
  return `${RULES}

${stylePromptBlock(config.narrationStyle)}
(Quy chuẩn độ dài câu ở mục 1 được ưu tiên hơn nhịp câu của phong cách.)

${exampleFor(config.narrationStyle)}

BÀI HỌC: ${lessonTitle}
Người học: ${config.learnerLevel}. Đây là các trang ${offset + 1}–${offset + chunk.length} trên tổng ${total} trang.
${first ? 'Trang đầu tiên: mở bài ngắn gọn (một câu chào và một câu nêu mục tiêu bài học).' : 'Không chào lại, nối tiếp mạch từ các trang trước.'}
${offset + chunk.length === total ? 'Trang cuối cùng: kết bằng một câu chốt tổng kết bài.' : ''}

${chunk.map((p, i) => pageBlock(p, offset + i + 1)).join('\n\n')}

Trả về JSON đúng dạng:
{"pages": [{"id": "<mã trang>", "cong_thuc": ["..."], "cau": [{"kieu": "...", "loi": "...", "man_hinh": "...", "thanh_phan": "..."}]}]${
    withQuiz
      ? `,
 "quiz": [{"hoi": "câu hỏi (một câu, không chữ số)", "lua_chon": {"A": "...", "B": "...", "C": "..."}, "dap_an": "A|B|C", "giai_thich": "một câu chữa bài, bắt đầu bằng nội dung đáp án, không câu đệm kiểu 'Hết giờ'"}]`
      : ''
  }}
"pages" có đúng ${chunk.length} phần tử, theo thứ tự các trang trên.${withQuiz ? ' "quiz" có đúng 3 câu hỏi trắc nghiệm về kiến thức trọng tâm của CẢ bài học.' : ''}`;
}

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

function toLines(raw: any[]): StudioLine[] {
  return (Array.isArray(raw) ? raw : [])
    .map((c) => ({
      delivery: (DELIVERIES as readonly string[]).includes(clean(c?.kieu)) ? (clean(c.kieu) as StudioLine['delivery']) : 'giảng',
      speech: clean(c?.loi),
      screen: clean(c?.man_hinh),
      component: STUDIO_COMPONENT_IDS.includes(clean(c?.thanh_phan) as any) ? (clean(c.thanh_phan) as StudioLine['component']) : 'Card'
    }))
    .filter((l) => l.speech.split(/\s+/).length >= 3);
}

export async function writeStudioScript(inputs: ScriptPageInput[], lessonTitle: string, config: UserConfiguration): Promise<ScriptResult> {
  const result: ScriptResult = { pages: inputs.map(() => null), quiz: [], errors: [] };
  const provider = llmRouter.getOnlineProvider();
  if (!provider || !provider.hasApiKey()) {
    result.errors.push('Chưa có API key: dùng lời giảng theo mẫu.');
    return result;
  }
  // Sequential on purpose: free-tier keys allow a few requests per minute.
  for (let offset = 0; offset < inputs.length; offset += PAGES_PER_CALL) {
    const chunk = inputs.slice(offset, offset + PAGES_PER_CALL);
    const withQuiz = offset + chunk.length >= inputs.length;
    const budget = chunk.reduce((n, p) => n + p.plan.target_word_budget, 0);
    try {
      const res = await provider.generateJson<{ pages?: any[]; quiz?: any[] }>(
        buildPrompt(chunk, offset, inputs.length, lessonTitle, config, withQuiz),
        SYSTEM,
        'Module 3A: Studio Script',
        {
          // Vietnamese runs ~2 tokens per word; JSON keys and screen text roughly double it again.
          maxOutputTokens: Math.min(32768, Math.max(4096, budget * 6 + 1500)),
          temperature: config.narrationStyle === 'meme' || config.narrationStyle === 'engaging' ? 0.8 : 0.5,
          timeoutMs: 120000
        }
      );
      const pages = Array.isArray(res?.pages) ? res.pages : [];
      chunk.forEach((p, i) => {
        const page = pages.find((x) => clean(x?.id) === p.plan.section_id) || pages[i];
        const lines = toLines(page?.cau);
        if (!lines.length) return;
        const narration = contentPurifierService.purifyNarration(lines.map((l) => l.speech).join(' '), {
          title: p.plan.title,
          role: p.plan.slide_analysis?.slide_role
        }).cleanedText.trim();
        if (!narration) return;
        result.pages[offset + i] = {
          narration,
          lines,
          formulas: (Array.isArray(page?.cong_thuc) ? page.cong_thuc : []).map(clean).filter(Boolean)
        };
      });
      const missing = chunk.filter((_, i) => !result.pages[offset + i]).length;
      if (missing) result.errors.push(`AI bỏ trống ${missing} trang (trang ${offset + 1}–${offset + chunk.length}).`);
      if (withQuiz && Array.isArray(res?.quiz)) {
        result.quiz = res.quiz
          .map((q: any) => ({
            question: clean(q?.hoi),
            options: { A: clean(q?.lua_chon?.A), B: clean(q?.lua_chon?.B), C: clean(q?.lua_chon?.C) },
            answer: (['A', 'B', 'C'].includes(clean(q?.dap_an)) ? clean(q.dap_an) : 'A') as 'A' | 'B' | 'C',
            explanation: clean(q?.giai_thich)
          }))
          .filter((q: StudioQuizItem) => q.question && q.options.A && q.options.B && q.options.C && q.explanation)
          .slice(0, 3);
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      console.warn(`Studio script call failed for pages ${offset + 1}-${offset + chunk.length}:`, msg);
      result.errors.push(
        /429|giới hạn tốc độ|quota|RESOURCE_EXHAUSTED/i.test(msg)
          ? `Gemini báo hết lượt miễn phí (429) cho trang ${offset + 1}–${offset + chunk.length}. Chờ khoảng một phút rồi bấm "Tạo lại", hoặc đổi key.`
          : `Gọi AI thất bại cho trang ${offset + 1}–${offset + chunk.length}: ${msg.slice(0, 160)}`
      );
    }
  }
  return result;
}
