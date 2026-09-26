// src/pipeline/module3_generator/templateScriptWriter.ts
/**
 * Template mode (no LLM): turns the grounded page text from the template composer into a studio
 * script that reads like the reference scripts in source/ (kich-ban-goc.md, HANDOFF format).
 *
 * The page's own content sentences are kept as they are. Around them it adds spoken framing, picked
 * from phrase banks per narration style:
 *   - lesson opening (page 1): the lesson's parts, taken from the page titles
 *   - a bridge into every later page, a guiding question, a pointer to the table/diagram on screen,
 *     a short emphasis line, and a closing takeaway built from the page's own keywords
 *   - a lesson closing on the last page
 * Framing is added only while the page is under its word budget (it fills the time naturally instead
 * of padding) and never states a fact: only titles and keywords of the document are slotted in.
 * Phrases avoid the sentence-initial connectives the discourse policy would strip on a page opener, and
 * a phrase is used once per lecture.
 *
 * Each framing sentence gets its delivery, screen text and studio component (StudioLine); content
 * sentences are left to the export heuristics, which read their shape (list, numbers, question...).
 */
import type { NarrationStyle, SectionPlan, StudioLine } from '../../types';

type Slot = { topic: string; prev: string; next: string; kw: string; keywords: string; visual: string; parts: string; first: string; last: string; count: string };
type Bank = {
  /** Bridges that name what the previous page established ({prev}); used when there is one. */
  bridgePrev: string[];
  bridge: string[];
  question: string[];
  pointer: string[];
  emphasis: string[];
  takeaway: string[];
  openParts: string[];
  closing: string[];
  /** Second-pass framing, used only while a page is still short of its budget. */
  spotlight: string[];
  recapPrev: string[];
  previewNext: string[];
};

const ACADEMIC: Bank = {
  bridgePrev: [
    'Sau khi đã nắm được {prev}, chúng ta chuyển sang {topic}.',
    'Dựa trên {prev} vừa trình bày, phần này đi sâu vào {topic}.',
    'Từ {prev}, một câu hỏi tự nhiên được đặt ra là {topic} vận hành ra sao.'
  ],
  bridge: [
    'Từ những gì vừa trình bày, chúng ta chuyển sang {topic}, một nội dung gắn trực tiếp với các ý ở phần trước.',
    'Để hoàn thiện bức tranh chung của bài học, phần này tập trung vào {topic} và vai trò của nó.',
    'Ở phần kế tiếp của bài học, chúng ta cùng xem xét {topic} một cách có hệ thống hơn.',
    'Sau khi đã nắm được nền tảng ở phần trước, chúng ta tiếp tục với {topic}.'
  ],
  question: [
    'Vậy {topic} được hiểu như thế nào và vì sao nội dung này quan trọng trong bài học?',
    'Câu hỏi đặt ra lúc này là {topic} đóng vai trò gì trong toàn bộ vấn đề chúng ta đang tìm hiểu?',
    'Điều gì làm nên đặc điểm cốt lõi của {topic} mà chúng ta cần nắm vững?'
  ],
  pointer: [
    'Các bạn hãy quan sát {visual} trên màn hình để thấy rõ mối liên hệ giữa các thành phần vừa nêu.',
    'Nội dung này được thể hiện trực quan qua {visual} trên màn hình, các bạn có thể đối chiếu từng phần.'
  ],
  emphasis: [
    'Đây là ý quan trọng mà các bạn nên ghi nhớ trước khi chúng ta đi tiếp sang nội dung sau.',
    'Các bạn hãy dành một chút thời gian để nắm chắc ý này, vì nó giúp việc theo dõi các phần sau dễ dàng hơn.',
    'Nếu cần, các bạn có thể dừng lại một chút để ghi chú lại những điểm chính của phần này.'
  ],
  takeaway: [
    'Nói ngắn gọn, phần này giúp chúng ta nắm được {keywords}.',
    'Điểm cần ghi nhớ ở phần này là {keywords}.',
    'Ý chính của phần này xoay quanh {keywords}.'
  ],
  openParts: [
    'Bài học gồm {count} phần chính, đi từ {first} cho đến {last}.',
    'Chúng ta sẽ lần lượt đi qua {count} phần, bắt đầu với {first} và kết thúc ở {last}.'
  ],
  closing: [
    'Chúng ta đã cùng nhau đi qua các nội dung chính của bài học, từ {first} đến {last}. Cảm ơn các bạn đã theo dõi và hẹn gặp lại trong bài học tiếp theo.'
  ],
  spotlight: [
    'Các bạn hãy chú ý đến {kw}, vì đây là từ khoá chính của phần này.',
    'Trong phần này, {kw} là khái niệm cần được hiểu thật rõ.'
  ],
  recapPrev: [
    'Trước khi đi tiếp, hãy nhớ lại rằng ở phần trước chúng ta đã tìm hiểu {prev}.',
    'Nội dung này tiếp nối trực tiếp với {prev} mà chúng ta vừa đề cập.'
  ],
  previewNext: [
    'Những ý ở đây sẽ là nền tảng để chúng ta hiểu {next} ở phần sau.',
    'Nắm chắc phần này, việc tìm hiểu {next} tiếp theo sẽ dễ dàng hơn nhiều.'
  ]
};

const CONVERSATIONAL: Bank = {
  ...ACADEMIC,
  bridgePrev: ['Hiểu {prev} rồi thì mình cùng xem tiếp {topic} nhé.', 'Nắm được {prev} rồi, giờ mình chuyển qua {topic}.'],
  bridge: [
    'Từ những gì vừa nói, mình cùng chuyển sang {topic} nhé, phần này nối tiếp khá tự nhiên với ý trước.',
    'Giờ chúng ta cùng xem đến {topic}, một mảnh ghép quan trọng của bài học hôm nay.',
    'Đã nắm được phần trước rồi, giờ mình cùng tìm hiểu tiếp về {topic}.'
  ],
  question: [
    'Các bạn có bao giờ tự hỏi {topic} thực ra là gì và dùng vào việc gì không?',
    'Vậy thì {topic} có gì đặc biệt mà chúng ta cần dành riêng một phần để nói đến?'
  ],
  emphasis: [
    'Ý này khá quan trọng, các bạn nhớ giúp mình nhé, lát nữa chúng ta sẽ còn dùng đến.',
    'Nếu thấy hơi nhiều, các bạn cứ tạm dừng một chút để ghi lại những điểm chính.'
  ],
  takeaway: ['Nói ngắn gọn, phần này cho chúng ta thấy {keywords}.', 'Các bạn chỉ cần nhớ ý chính ở đây là {keywords}.']
};

/** Voice of source/sample.md: a presenter talking to "bạn", lively, questions answered right away. */
const ENGAGING: Bank = {
  bridgePrev: [
    'Sau khi đã hiểu {prev}, bạn sẽ thấy {topic} xuất hiện rất tự nhiên.',
    'Có {prev} trong tay rồi, giờ hãy cùng bước sang viên gạch tiếp theo: {topic}!',
    'Từ {prev}, câu chuyện dẫn bạn đến với {topic}.',
    'Nắm được {prev} rồi, nhưng làm sao đi tiếp đến {topic}?'
  ],
  bridge: [
    'Nền tảng đã có, giờ hãy cùng bước sang viên gạch tiếp theo: {topic}!',
    'Hiểu được phần vừa rồi, bạn sẽ thấy {topic} xuất hiện rất tự nhiên ở đây.',
    'Và đây là lúc {topic} bước lên sân khấu.',
    'Câu chuyện chưa dừng lại, nó dẫn bạn đến với {topic}.'
  ],
  question: [
    'Vậy {topic} thực chất là gì, và vì sao bạn cần hiểu nó?',
    'Làm sao để nắm được {topic} một cách dễ hiểu nhất?',
    'Nhưng nếu thiếu {topic} thì sao, điều gì sẽ xảy ra với bức tranh chung?'
  ],
  pointer: [
    'Hãy nhìn vào {visual} trên màn hình, mọi thứ sẽ rõ ràng hơn rất nhiều!',
    'Bạn hãy quan sát {visual} trên màn hình để thấy các thành phần ăn khớp với nhau thế nào.'
  ],
  emphasis: [
    'Đây chính là điểm mấu chốt, bạn hãy ghi nhớ thật kỹ nhé!',
    'Nghe có vẻ đơn giản, nhưng đây lại là chìa khoá để bạn theo kịp những phần tiếp theo.'
  ],
  takeaway: ['Tóm gọn lại, điều bạn cần nhớ ở đây chính là {keywords}.', 'Nói gọn trong một câu, phần này xoay quanh {keywords}.'],
  openParts: [
    'Trong bài học này, bạn sẽ đi qua {count} trạm, từ {first} cho đến {last}.',
    'Lộ trình của chúng ta gồm {count} trạm, hãy cùng bắt đầu với viên gạch đầu tiên: {first}!'
  ],
  closing: [
    'Hiểu được bản chất từ {first} đến {last}, bạn sẽ không còn thấy chủ đề này là một chiếc hộp đen bí ẩn nữa. Cảm ơn bạn đã theo dõi!'
  ],
  spotlight: [
    'Hãy để ý đến {kw}, đây chính là nhân vật chính của phần này!',
    'Nếu chỉ nhớ một điều ở đây, bạn hãy nhớ {kw}.'
  ],
  recapPrev: [
    'Bạn còn nhớ {prev} ở phần trước chứ? Nó sẽ giúp bạn hiểu phần này nhanh hơn nhiều.',
    'Hãy giữ {prev} trong đầu, vì phần này được xây ngay trên nền tảng đó.'
  ],
  previewNext: [
    'Và đây mới chỉ là bước đệm, phần sau {next} sẽ còn thú vị hơn nữa!',
    'Nắm chắc điều này, bạn sẽ thấy {next} ở phần sau dễ hiểu hơn rất nhiều.'
  ]
};

const MEME: Bank = {
  ...CONVERSATIONAL,
  bridgePrev: ['Xong màn {prev}, giờ tới lượt {topic} lên sóng.', 'Hết {prev} rồi, level up sang {topic} nào.'],
  bridge: ['Rồi, qua màn tiếp theo, nhân vật chính giờ là {topic}.', 'Level up một chút nào, giờ tới lượt {topic} lên sóng.', 'Xong phần khởi động, giờ vào việc chính với {topic}.'],
  question: ['{topic} là gì mà được dành hẳn một phần riêng, cùng soi thử xem?', 'Vậy {topic} có gì hay mà ai học phần này cũng phải biết?'],
  emphasis: ['Chỗ này là chìa khoá, nhớ kỹ giúp mình, lát nữa còn gặp lại.', 'Ý này mà quên là mấy phần sau khó theo lắm đấy.'],
  takeaway: ['Chốt nhanh, phần này gói gọn trong {keywords}.', 'Tóm cái ý: nhớ {keywords} là ổn.']
};

const ENGINEERING: Bank = {
  ...ACADEMIC,
  bridgePrev: ['Có {prev} rồi, bài toán tiếp theo cần giải quyết là {topic}.', 'Sau {prev}, thành phần cần xem xét tiếp theo là {topic}.'],
  bridge: ['Từ phần trước, bài toán tiếp theo cần giải quyết là {topic}.', 'Để hệ thống hoạt động đầy đủ, chúng ta cần xem xét thêm {topic}.'],
  question: ['Vấn đề đặt ra là {topic} giải quyết được điều gì và dùng trong trường hợp nào?', 'Khi triển khai thực tế, {topic} ảnh hưởng thế nào đến cách chúng ta thiết kế giải pháp?'],
  emphasis: ['Khi áp dụng thực tế, đây là điểm cần kiểm tra đầu tiên trước khi đi tiếp.', 'Các bạn nên ghi lại điểm này như một lưu ý khi triển khai.'],
  takeaway: ['Nói ngắn gọn, phần này cung cấp cho chúng ta {keywords}.', 'Điểm cần mang theo khi triển khai là {keywords}.']
};

const BANKS: Partial<Record<NarrationStyle, Bank>> = {
  academic: ACADEMIC,
  rigorous: ACADEMIC,
  conversational: CONVERSATIONAL,
  engaging: ENGAGING,
  meme: MEME,
  engineering: ENGINEERING
};

const EN_BANK: Bank = {
  bridgePrev: ['Now that we have covered {prev}, let us turn to {topic}.', 'Building on {prev}, the next part looks at {topic}.'],
  bridge: ['Building on what we just covered, we now turn to {topic}.', 'The next part of the lesson looks at {topic} in more detail.'],
  question: ['So what is {topic}, and why does it matter here?', 'What role does {topic} play in the bigger picture?'],
  pointer: ['Take a look at {visual} on screen to see how these parts fit together.'],
  emphasis: ['This is an important point to keep in mind as we move on.'],
  takeaway: ['In short, this part is about {keywords}.', 'The key idea here is {keywords}.'],
  openParts: ['The lesson has {count} main parts, from {first} to {last}.'],
  closing: ['We have covered the main ideas of the lesson, from {first} to {last}. Thank you for following along.'],
  spotlight: ['Pay close attention to {kw}, the key term of this part.'],
  recapPrev: ['Before we move on, remember that the previous part covered {prev}.'],
  previewNext: ['These ideas prepare us for {next} in the next part.']
};

export interface TemplatePageInput {
  /** Grounded page text from the template composer. */
  body: string;
  plan: SectionPlan;
  index: number;
  total: number;
  /** Page titles of the whole lecture, in order (lesson opening and closing). */
  titles: string[];
  /** Key concepts of the previous page (the bridge names one of them). */
  prevKeywords?: string[];
  /** Key concepts of the next page (the preview names one of them, never the full title). */
  nextKeywords?: string[];
  keywords: string[];
  style?: NarrationStyle;
  lang: 'vi' | 'en';
  /** Kind of visual the page shows after OCR ("bảng", "sơ đồ", "biểu đồ"), if any. */
  visualKind?: string;
  /** Phrases already used in this lecture (mutated). */
  used: Set<string>;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const splitSentences = (t: string) => t.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
const shortTitle = (t: string) =>
  t
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/^(giới thiệu|tổng quan|nhập môn)(\s+(chung\s+)?về)?\s+/i, '')
    // Cut a subtitle after ":" or a spaced dash, never inside a word ("nơ-ron", "Top-Down").
    .replace(/\s*(:|\s[—–-]\s).*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
/**
 * "Huấn luyện mô hình" -> "huấn luyện mô hình" mid-sentence. Terms keep their casing: acronyms and
 * mixed-case words ("CNN", "ReLU", "OpenPose") and English Title Case ("Human Pose Estimation").
 */
const lowerFirst = (s: string, lang: 'vi' | 'en') => {
  const first = s.split(/\s+/)[0] || '';
  const isTerm = /\p{Lu}.*\p{Lu}/u.test(first) || /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(s);
  return lang === 'vi' && /^\p{Lu}/u.test(s) && !isTerm ? s.charAt(0).toLocaleLowerCase('vi') + s.slice(1) : s;
};
const joinList = (xs: string[], lang: 'vi' | 'en') =>
  xs.length <= 1 ? xs[0] || '' : `${xs.slice(0, -1).join(', ')} ${lang === 'vi' ? 'và' : 'and'} ${xs[xs.length - 1]}`;

const fill = (tpl: string, slot: Slot) => tpl.replace(/\{(\w+)\}/g, (_, k: keyof Slot) => slot[k] || '');

export function dressTemplatePage(input: TemplatePageInput): { narration: string; lines: StudioLine[] } {
  const { plan, index, total, lang, used } = input;
  const bank = lang === 'vi' ? BANKS[input.style || 'academic'] || ACADEMIC : EN_BANK;
  const budget = Math.max(20, plan.target_word_budget);
  const topic = lowerFirst(shortTitle(plan.title), lang);
  // Two keywords that say different things: "chuẩn hóa" inside "chuẩn hóa định dạng", or "PAF" as the
  // initials of "Part Affinity Fields", would read as the same idea twice.
  const initials = (s: string) => s.split(/\s+/).map((w) => w.charAt(0)).join('').toLowerCase();
  const kws: string[] = [];
  // Only words the page actually says: element tags ("DIAGRAM", "TABLE") can leak into key concepts.
  const pageText = `${plan.title} ${input.body}`.toLowerCase();
  const spoken = (k: string) => pageText.includes(k.toLowerCase()) && !/^(diagram|table|image|picture|chart|figure|equation|code|slide)$/i.test(k);
  for (const k of input.keywords.map((x) => lowerFirst(x.trim(), lang)).filter((x) => x && spoken(x))) {
    const lk = k.toLowerCase();
    const clash = (o: string) => {
      const lo = o.toLowerCase();
      return lo.includes(lk) || lk.includes(lo) || initials(o) === lk || initials(k) === lo;
    };
    if (clash(topic) || kws.some(clash)) continue;
    kws.push(k);
    if (kws.length === 2) break;
  }
  const parts = input.titles.map((t) => lowerFirst(shortTitle(t), lang));
  const refTo = (title: string, keywords: string[] | undefined) => {
    if (!title) return '';
    const lowTitle = title.toLowerCase();
    const fromKeywords = (keywords || [])
      .map((k) => k.trim())
      // A name, not a generic word: an English term ("Heatmap Regression", "OpenPose", "CNN") or a Vietnamese
      // phrase of 3+ syllables ("mạng nơ-ron tích chập"); "kiến trúc" alone says nothing.
      .filter((k) => /\b[A-Z][A-Za-z0-9-]{2,}/.test(k) || k.split(/\s+/).length >= 3)
      .find((k) => k.length > 3 && lowTitle.includes(k.toLowerCase()) && !topic.toLowerCase().includes(k.toLowerCase()) && !/^(diagram|table|image|chart|figure)$/i.test(k));
    if (fromKeywords) return lowerFirst(fromKeywords, lang);
    const cut = shortTitle(title).split(/\s+(trong|với|cho|của|in|for|of)\s+/i)[0].trim();
    return cut && cut.toLowerCase() !== shortTitle(title).toLowerCase() ? lowerFirst(cut, lang) : '';
  };
  // What the neighbouring pages are about, as a short term ("Heatmap Regression"), never a full title:
  // the heading policy only lets a page title be spoken on its own page.
  const prevRef = index > 0 ? refTo(input.titles[index - 1] || '', input.prevKeywords) : '';
  const nextRef = index < total - 1 ? refTo(input.titles[index + 1] || '', input.nextKeywords) : '';
  const slot: Slot = {
    topic,
    prev: prevRef,
    next: nextRef,
    kw: kws[0] || '',
    keywords: joinList(kws.length ? kws : [topic], lang),
    visual: input.visualKind || (lang === 'vi' ? 'hình minh hoạ' : 'the figure'),
    parts: joinList(parts, lang),
    first: parts[0] || topic,
    last: parts[parts.length - 1] || topic,
    count: String(Math.max(1, total))
  };

  // The template's own "we start with <title>" is replaced by the bridge on later pages.
  let content = splitSentences(input.body).filter((s) => !(index > 0 && /^(chúng ta bắt đầu với|let us start with)\b/i.test(s)));
  // The presenter voice (sample.md) greets one viewer: "Chào mừng bạn đến với ...!"
  if (lang === 'vi' && input.style === 'engaging') {
    content = content.map((s) => s.replace(/^Chào mừng các bạn đến với (.+)\.$/, 'Chào mừng bạn đến với $1!'));
  }
  const lines: StudioLine[] = [];
  const before: string[] = [];
  const after: string[] = [];
  const add = (where: string[], text: string | undefined, meta: Omit<StudioLine, 'speech'>) => {
    if (!text) return;
    where.push(text);
    lines.push({ ...meta, speech: text });
  };
  const total_ = () => words([...before, ...content, ...after].join(' '));
  const seed = index * 7 + plan.order;
  const screenTopic = shortTitle(plan.title).toUpperCase();

  /**
   * Adds the first unused phrase of the bank that still fits the page budget (framing fills the time,
   * it never pushes the page past it). `slack` is the share of the budget the page may reach.
   */
  const tryAdd = (where: string[], list: string[], meta: Omit<StudioLine, 'speech'>, slack = 1.1) => {
    for (let i = 0; i < list.length; i++) {
      const phrase = list[(seed + i) % list.length];
      if (used.has(phrase)) continue;
      const text = fill(phrase, slot);
      if (total_() + words(text) > budget * slack) continue;
      used.add(phrase);
      add(where, text, meta);
      return;
    }
  };

  // Most useful framing first, each only while the page has room for it.
  const role = (plan.slide_analysis?.slide_role || '').toUpperCase();
  const asks = index > 0 && !content.some((s) => s.endsWith('?')) && !/SUMMARY|TRANSITION/.test(role);
  if (index === total - 1 && total > 1) {
    // The lesson closing matters more than exact timing on the last page.
    tryAdd(after, bank.closing, { delivery: 'chốt', screen: 'TỔNG KẾT BÀI HỌC', component: 'Recap' }, 1.6);
  }
  if (index === 0 && total > 2) {
    tryAdd(after, bank.openParts, { delivery: 'giảng', screen: `${slot.count} PHẦN · ${parts.slice(0, 5).join(' · ')}${parts.length > 5 ? ' · …' : ''}`, component: 'Flow' }, 1.3);
  }
  if (index > 0) {
    // Name the previous page's idea when there is one ("Sau khi đã hiểu Heatmap Regression, ..."),
    // else a generic bridge. Only one bridge per page either way.
    const before0 = before.length;
    if (prevRef && prevRef.toLowerCase() !== topic.toLowerCase()) {
      tryAdd(before, bank.bridgePrev, { delivery: 'giảng', screen: `${prevRef.toUpperCase()} → ${screenTopic}`, component: 'Flow' });
    }
    if (before.length === before0) tryAdd(before, bank.bridge, { delivery: 'giảng', screen: screenTopic, component: 'Card' });
  }
  if (asks) tryAdd(before, bank.question, { delivery: 'hỏi', screen: `${screenTopic}?`, component: 'QuestionCard' });
  if (input.visualKind) tryAdd(after, bank.pointer, { delivery: 'giảng', screen: `${slot.visual.toUpperCase()} · ${screenTopic}`, component: 'GlassBox' });
  if (index < total - 1) tryAdd(after, bank.takeaway, { delivery: 'chốt', screen: kws.join(' · ') || screenTopic, component: 'Recap' });
  if (index > 0 && index < total - 1) tryAdd(after, bank.emphasis, { delivery: 'thân mật', screen: screenTopic, component: 'Card' });

  // Second pass for pages still well short of their time: name the key term, recall the previous idea,
  // point at the next one. Each phrase is still used once per lecture and never overshoots the budget.
  const short = () => total_() < budget * 0.9;
  if (short() && kws[0]) tryAdd(after, bank.spotlight, { delivery: 'chốt', screen: kws[0].toUpperCase(), component: 'Card' });
  if (short() && prevRef && prevRef.toLowerCase() !== topic.toLowerCase()) {
    tryAdd(before, bank.recapPrev, { delivery: 'giảng', screen: `${prevRef.toUpperCase()} → ${screenTopic}`, component: 'Flow' });
  }
  if (short() && nextRef && nextRef.toLowerCase() !== topic.toLowerCase()) {
    tryAdd(after, bank.previewNext, { delivery: 'giảng', screen: `${screenTopic} → ${nextRef.toUpperCase()}`, component: 'Flow' });
  }
  if (short() && asks) tryAdd(before, bank.question, { delivery: 'hỏi', screen: `${screenTopic}?`, component: 'QuestionCard' });
  if (short() && index < total - 1) tryAdd(after, bank.takeaway, { delivery: 'chốt', screen: kws.join(' · ') || screenTopic, component: 'Recap' });
  if (short() && index > 0 && index < total - 1) tryAdd(after, bank.emphasis, { delivery: 'thân mật', screen: screenTopic, component: 'Card' });

  // One addition connective inside the page, never on its first sentence (discourse policy).
  const body = [...content];
  if (lang === 'vi' && body.length >= 3 && !/^(bên cạnh đó|ngoài ra|đồng thời|tuy nhiên|vì vậy)/i.test(body[body.length - 1])) {
    const last = body[body.length - 1];
    body[body.length - 1] = `Bên cạnh đó, ${lowerFirst(last, lang)}`;
  }

  // Closing text can hold two sentences: one studio line per sentence.
  const split = lines.flatMap((l) => {
    const ss = splitSentences(l.speech);
    return ss.length > 1 ? ss.map((s, i) => ({ ...l, speech: s, delivery: i === ss.length - 1 ? l.delivery : 'giảng' })) : [l];
  });
  return { narration: [...before, ...body, ...after].join(' ').replace(/\s+/g, ' ').trim(), lines: split as StudioLine[] };
}
