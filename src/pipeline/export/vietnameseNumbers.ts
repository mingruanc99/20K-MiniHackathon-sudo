// src/pipeline/export/vietnameseNumbers.ts
/**
 * Numbers in spoken Vietnamese, the way the studio TTS and captions need them
 * ("2025" -> "hai nghìn không trăm hai mươi lăm", "92,5%" -> "chín mươi hai phẩy năm phần trăm").
 * Only standalone numbers are spoken as words: digits inside names (GPT-4, ResNet-50, Conv2d) stay.
 */
const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const SCALES = ['', 'nghìn', 'triệu', 'tỷ'];

function belowThousand(n: number, full: boolean): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const out: string[] = [];
  if (h || full) out.push(DIGITS[h], 'trăm');
  if (t === 0) {
    if (u && (h || full)) out.push('linh');
    if (u) out.push(DIGITS[u]);
  } else if (t === 1) {
    out.push('mười');
    if (u) out.push(u === 5 ? 'lăm' : DIGITS[u]);
  } else {
    out.push(DIGITS[t], 'mươi');
    if (u) out.push(u === 1 ? 'mốt' : u === 4 ? 'tư' : u === 5 ? 'lăm' : DIGITS[u]);
  }
  return out.join(' ');
}

export function integerToVietnamese(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `âm ${integerToVietnamese(-n)}`;
  if (n < 10) return DIGITS[n];
  const groups: number[] = [];
  let rest = Math.floor(n);
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  if (groups.length > SCALES.length) return String(n).split('').map((d) => DIGITS[+d]).join(' ');
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    // Groups after the leading one read all three places ("hai nghìn không trăm hai mươi lăm").
    parts.push(belowThousand(g, i < groups.length - 1), SCALES[i]);
  }
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** "92,5" / "1.000" / "3.14" (Vietnamese: "." groups thousands, "," is the decimal mark). */
function numberToVietnamese(raw: string): string {
  let s = raw.trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if (/^\d+\.\d+$/.test(s)) s = s.replace('.', ',');
  const [int, dec] = s.split(',');
  const intWords = integerToVietnamese(parseInt(int.replace(/\D/g, '') || '0', 10));
  if (!dec) return intWords;
  // Decimals with a leading zero are read digit by digit ("không phẩy không năm").
  const decWords = /^0/.test(dec) ? dec.split('').map((d) => DIGITS[+d]).join(' ') : integerToVietnamese(parseInt(dec, 10));
  return `${intWords} phẩy ${decWords}`;
}

const NUM = String.raw`\d+(?:[.,]\d+)*`;
const UNITS = 'nghìn|ngàn|triệu|tỷ|giờ|phút|giây|ngày|tuần|tháng|năm|lần|lớp|bước|epoch|GB|MB|KB|ms|px|USD|đồng';
/** Not glued to a letter/digit/hyphen on either side (GPT-4, ResNet-50, 3x3 handled separately). */
const EDGE_L = String.raw`(?<![\p{L}\d\-_/])`;
const EDGE_R = String.raw`(?![\p{L}\d_])`;

/**
 * Rewrites standalone numbers as words. Returns the numbers found (as written) so the caller can
 * show them on screen: the studio QA matches spoken numbers against the screen line.
 */
export function speakNumbers(text: string): { text: string; numbers: string[] } {
  const numbers: string[] = [];
  // Big-O is read aloud "O của N" / "O của một" (the screen keeps "O(1)").
  let out = text.replace(/\bO\(\s*([^()]{1,16}?)\s*\)/g, (m, inner) => {
    numbers.push(m);
    return `O của ${/^\d+$/.test(inner) ? numberToVietnamese(inner) : inner}`;
  });
  // 32x32, 3 x 3 -> "ba mươi hai nhân ba mươi hai"
  out = out.replace(new RegExp(`${EDGE_L}(${NUM})\\s*[x×]\\s*(${NUM})${EDGE_R}`, 'gu'), (m, a, b) => {
    numbers.push(m);
    return `${numberToVietnamese(a)} nhân ${numberToVietnamese(b)}`;
  });
  // 3-5, 2020–2025 -> "ba đến năm"
  out = out.replace(new RegExp(`${EDGE_L}(${NUM})\\s*[-–]\\s*(${NUM})(\\s?%)?${EDGE_R}`, 'gu'), (m, a, b, pct) => {
    numbers.push(m);
    return `${numberToVietnamese(a)} đến ${numberToVietnamese(b)}${pct ? ' phần trăm' : ''}`;
  });
  // The unit right after the number stays on screen with it ("60 triệu", "3 giờ"); it is already a word.
  out = out.replace(new RegExp(`${EDGE_L}(${NUM})(\\s?%)?${EDGE_R}(\\s+(?:${UNITS})(?!\\p{L})(?!\\s*\\d))?`, 'gu'), (m, a, pct, unit) => {
    numbers.push(m.trim());
    return `${numberToVietnamese(a)}${pct ? ' phần trăm' : ''}${unit || ''}`;
  });
  return { text: out, numbers };
}
