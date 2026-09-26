# Quy Chuẩn Kịch Bản & Hợp Đồng Kỹ Thuật (Handoff Team Kịch Bản / Tool Dev)

> **Tài liệu bàn giao (Handoff Document)** dành cho:
> - **Biên kịch / Content Creator:** Quy chuẩn viết kịch bản bài giảng chuẩn studio.
> - **Kỹ sư phát triển Tool / Prompt Engineer:** Đặc tả kỹ thuật (Specification & Contract) để xây dựng công cụ / LLM Pipeline tự động sinh kịch bản.

---

## 1. Nguyên Tắc Cốt Lõi: Giọng Trước, Hình Sau (Voice-First)

Hệ thống sản xuất video bài giảng VinUni hoạt động theo nguyên tắc:
1. Lời đọc (`- **Lời:**`) được **khóa cứng nguyên văn (verbatim)**.
2. Lời đọc được nạp vào mô hình Text-To-Speech (OmniVoice / ElevenLabs) để thu giọng.
3. Pipeline đo đạc chính xác thời lượng từng âm tiết và mốc thời gian của từng từ bằng Whisper alignment.
4. Giao diện hình ảnh và hoạt ảnh (React / SVG) được dựng bám sát theo mốc thời gian thực tế đó.
5. Thanh phụ đề (burned-in captions) hiển thị trực tiếp từ lời đọc trong kịch bản.

> ⚠️ **Hệ quả kỹ thuật:** Bất kỳ sự thay đổi nào về câu chữ trong lời đọc sau khi thu âm đều dẫn đến việc phải thu lại giọng và căn chỉnh lại toàn bộ timeline video. Do đó, kịch bản đầu ra phải đạt chuẩn 100% trước khi bàn giao.

---

## 2. Cấu Trúc File Markdown Chuẩn (`kich-ban.md`)

Mỗi kịch bản là một file Markdown (`.md`) duy nhất, tuân thủ đúng phân cấp:

```markdown
# D11-05 · Khiên chắn đầu ra và Kiểm thử đối kháng

- **Mục tiêu:** Hết video người học phân biệt được Guardrails AI và NeMo, đồng thời biết cách áp dụng Red-teaming tự động.
- **Thời lượng dự kiến:** khoảng sáu phút rưỡi.
- **Giọng đọc:** Nhật Phong

## 1 · Mở đầu và Thách thức kiểm soát

### Câu 1
- **Kiểu:** kể
- **Lời:** Khi mô hình ngôn ngữ lớn đưa ra câu trả lời, chúng ta không thể đoán trước từng từ ngữ mà nó tạo ra.
- **Trên màn hình:** Mô hình LLM ở giữa · Hai luồng dữ liệu phân nhánh ra ngoài

### Câu 2
- **Kiểu:** chốt
- **Lời:** Do đó, khiên chắn đầu ra là lớp bảo vệ cuối cùng trước khi phản hồi đến tay người dùng.
- **Trên màn hình:** BẢO VỆ ĐẦU RA (OUTPUT GUARDRAILS) · Biểu tượng khiên chắn

## 2 · Khung kiểm tra Pydantic và Re-ask

### Câu 3
...
```

### Chi tiết các thành phần:

| Thành phần | Cú pháp | Tính bắt buộc | Ý nghĩa kỹ thuật |
|---|---|---|---|
| **Tiêu đề video** | `# <Mã bài> · <Tên bài>` | **Bắt buộc** | Dòng 1 của file, định danh bài học trên Video Studio. |
| **Mục tiêu** | `- **Mục tiêu:** <nội dung>` | **Nên có** | Tóm tắt kiến thức / kỹ năng người học đạt được. |
| **Thời lượng dự kiến** | `- **Thời lượng dự kiến:** khoảng X phút.` | Khuyến nghị | Viết bằng chữ (ví dụ: *khoảng năm phút*, *khoảng sáu phút rưỡi*). Không viết dạng số `05:30`. |
| **Giọng đọc** | `- **Giọng đọc:** <Tên voice>` | Tùy chọn | Chọn giọng trong danh mục studio (ví dụ: `Nhật Phong`, `Mai Chi`). |
| **Chương / Phần** | `## <Số> · <Tên phần>` | **Bắt buộc** | Trích xuất trực tiếp thành **Chapter** trên video player và file mục lục. Đặt tên có nghĩa, không đặt "Phần 1". |
| **Cảnh / Câu thoại** | `### Câu N` | **Bắt buộc** | Đánh số liên tục `1, 2, 3...` không nhảy cóc. **Mỗi câu tương ứng với 1 cảnh visual duy nhất**. |

---

## 3. Quy Tắc Nghiêm Ngặt Cho Từng Câu Thoại

Mỗi khối `### Câu N` chứa các trường dữ liệu:

### 3.1. Trường Lời Đọc (`- **Lời:**`) — BẮT BUỘC
Đây là phần máy TTS sẽ đọc và phụ đề sẽ hiển thị:

1. **Tuyệt đối KHÔNG viết chữ số (`0-9`):**
   - ❌ *Sai:* `Hệ thống có 3 lớp bảo vệ, áp dụng từ năm 2024 với tỷ lệ lỗi dưới 5%.`
   - ✅ *Đúng:* `Hệ thống có ba lớp bảo vệ, áp dụng từ năm hai nghìn không trăm hai mươi tư với tỷ lệ lỗi dưới năm phần trăm.`
   - *Lý do:* Máy TTS sẽ đọc số tùy tiện ("năm hai không hai bốn" hoặc "hai ngàn..."), làm hỏng phụ đề. Con số thực tế (`3`, `2024`, `< 5%`) sẽ hiển thị ở dòng `Trên màn hình:`.
2. **Tuyệt đối KHÔNG tự phiên âm tiếng Việt cho tên riêng / thuật ngữ tiếng Anh:**
   - ❌ *Sai:* `Pai-đan-tíc`, `Gít-scạt`, `Cồ-lăng`, `En-vi-đi-a`, `Gi-pi-ti`, `Gát-rêu-s ây ai`.
   - ✅ *Đúng:* `Pydantic`, `Giskard`, `Colang`, `NVIDIA`, `GPT-4`, `Guardrails AI`, `API`.
   - *Lý do:* Phụ đề của video lấy nguyên văn từ trường này. Nếu phiên âm, phụ đề sẽ sai chính tả chuyên ngành. Việc phát âm cho mô hình TTS đã có file cấu hình từ điển riêng (`pronounce.json`).
3. **Quy tắc giải thích thuật ngữ:**
   - Thuật ngữ chuyên ngành phải đi kèm nghĩa tiếng Việt, và **nghĩa tiếng Việt đặt TRƯỚC** ở lần nhắc đầu tiên:
   - *Ví dụ:* `"lược đồ kiểm tra dữ liệu, gọi là Pydantic schema"`, `"kỹ thuật kiểm thử đối kháng, gọi là red-teaming"`.
4. **Một mục là MỘT câu duy nhất:**
   - ❌ Không gom 2–3 câu vào 1 mục `Lời:` vì sẽ làm khung hình SVG bị quá tải thông tin.
   - ❌ Không ngắt các câu quá cụt (< 3 từ như *"Hết."*, *"Vì sao?"*).
   - 🎯 **Độ dài tối ưu:** **15 – 28 từ/câu** (trung bình 24 từ). Quá 45 từ sẽ bị linter cảnh báo.
5. **Không thêm timestamp thủ công:**
   - Không viết `00:12 - 00:25` vì thời lượng được pipeline tự động đo đạc sau khi thu âm (ước lượng: **~2,9 tiếng / giây**).

### 3.2. Trường Trên Màn Hình (`- **Trên màn hình:**`) — BẮT BUỘC KHI CÓ SỐ LIỆU
- Mô tả trực quan những gì xuất hiện trên slide/video.
- **Bắt buộc có** nếu trong câu thoại có phát ra con số hoặc tỷ lệ phần trăm (để hệ thống QA đối chiếu dữ liệu giữa tiếng nói và hình ảnh).
- Khuyến khích dùng thuật ngữ tiếng Anh viết hoa chuẩn kỹ thuật (ví dụ: `INPUT GUARDRAILS`, `ACCURACY: 98%`, `FLOWCHART: RE-ASK LOOP`).

### 3.3. Trường Kiểu Đọc (`- **Kiểu:**`) — TÙY CHỌN (Mặc định: `giảng`)
Hệ thống chỉ hỗ trợ **đúng 5 kiểu đọc** sau để điều phối nhịp độ:

| Kiểu đọc | Mã nội bộ | Tốc độ | Mục đích sử dụng |
|---|---|---|---|
| `kể` | `ke` | $\times 1.06$ | Kể chuyện, bối cảnh thực tế, ví dụ sinh động (nhanh, tươi). |
| `giảng` | `giang` | $\times 1.00$ | Trình bày lý thuyết, giải thích khái niệm (chuẩn mực). |
| `thân mật` | `nhe` | $\times 0.95$ | Lời khuyên, lưu ý cá nhân, chia sẻ kinh nghiệm thực tế. |
| `hỏi` | `hoi` | $\times 0.90$ | Đặt câu hỏi gợi mở, kích thích suy nghĩ. |
| `chốt` | `nhan` | $\times 0.86$ | Đúc kết nguyên tắc, kết luận quan trọng (chậm, rõ, nhấn mạnh). |

⚠️ **Quy tắc lướt giọng (Anti-monotone):** Không được để quá **5 câu liên tiếp cùng một kiểu đọc** (tránh làm người nghe buồn ngủ).

---

## 4. Quy Chuẩn Module Quiz Tương Tác

Để video vượt qua bài kiểm tra của Platform QA trường VinUni, mỗi video thường cần **3 bộ Quiz**. Mỗi bộ Quiz bắt buộc phải gồm **3 mẩu liền nhau không tách rời**:

```markdown
### Câu 24
- **Kiểu:** hỏi
- **Lời:** Điểm khác biệt cốt lõi trong cách tiếp cận giữa NeMo Guardrails và Guardrails AI là gì?
- **Trên màn hình:** Câu hỏi trắc nghiệm · Bốn phương án A, B, C, D

### Dừng 2
- **Dừng:** 30 giây
- **Trên màn hình:** Giữ nguyên câu hỏi · Vòng tròn đếm ngược Countdown 30 giây

### Câu 25
- **Kiểu:** giảng
- **Lời:** NeMo Guardrails kiểm soát luồng hội thoại theo kịch bản Colang, trong khi Guardrails AI tập trung vào cấu trúc dữ liệu Pydantic.
- **Trên màn hình:** Phương án B sáng lên · Bảng so sánh Colang và Pydantic
```

### Các lưu ý sống còn về Quiz:
1. **Mẩu 1 (Câu hỏi):** Dùng `Kiểu: hỏi`.
2. **Mẩu 2 (Khoảng dừng):** Bắt đầu bằng `### Dừng X`, bên dưới có dòng `- **Dừng:** N giây`. Đây là silent cue (không thu âm, không tốn credit), video sẽ tự chèn nhạc quiz và đồng hồ đếm ngược.
3. **Mẩu 3 (Chữa bài):** Câu giải thích đáp án đúng, đặt **ngay lập tức sau khoảng dừng**.
4. ❌ **CẤM TUYỆT ĐỐI:** Không chèn câu đệm như *"Hết giờ, đáp án là..."* ngay sau khoảng dừng! Platform QA tự động lấy câu đầu tiên sau khoảng dừng làm đáp án mẫu cho sinh viên. Nếu chèn câu đệm, sinh viên sẽ chỉ nhìn thấy đáp án là *"Hết giờ"*.

---

## 5. Công Cụ Kiểm Tra Tự Động (Linter & Validator)

Trước khi bàn giao kịch bản cho team video, kịch bản phải được kiểm tra bằng công cụ tích hợp trong repo:

```bash
# Kiểm tra định dạng và quy tắc kịch bản
node tools/script-check.mjs <duong-dan-file.md>

# Xuất kết quả dạng JSON (dành cho Tool tự động tích hợp)
node tools/script-check.mjs <duong-dan-file.md> --json
```

### Bảng Mã Lỗi Phổ Biến & Cách Sửa:

| Loại lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| `lời đọc có số viết bằng chữ số (20, 40%)` | Còn chữ số trong `- **Lời:**` | Đổi thành chữ: `hai mươi`, `bốn mươi phần trăm`. |
| `tên riêng bị phiên âm từng chữ cái` | Viết kiểu `Cát Gi Pi Ti`, `En Vi Đi A` | Đổi thành tên gốc tiếng Anh: `ChatGPT`, `NVIDIA`. |
| `lời đọc có con số nhưng thiếu dòng Trên màn hình` | Lời đọc nói số nhưng không có visual đối chiếu | Bổ sung dòng `- **Trên màn hình:**` chứa số đó. |
| `6 câu liền cùng kiểu "giảng"` | Lặp kiểu đọc quá 5 câu liên tiếp | Xen kẽ các kiểu `kể`, `chốt`, `thân mật` hoặc `hỏi`. |
| `chỗ dừng không có câu hỏi ngay trước` | Đặt mục `Dừng` sai vị trí | Đảm bảo thứ tự: `Câu hỏi` $\rightarrow$ `Dừng` $\rightarrow$ `Chữa bài`. |
| `câu chữa bài nằm ngay sau khoảng chờ là câu đệm` | Có câu "Hết giờ" sau khoảng dừng | Bỏ câu đệm hoặc chuyển lên trước khoảng dừng. |

---

## 6. Checklist Bàn Giao Nhanh (Quick Checklist)

- [ ] File Markdown có tiêu đề `#` ở dòng đầu tiên và các chương `##`.
- [ ] Các câu được đánh số liên tục `### Câu 1`, `### Câu 2`,...
- [ ] Không có bất kỳ chữ số (`0-9`) nào trong các dòng `- **Lời:**`.
- [ ] Thuật ngữ tiếng Anh giữ nguyên gốc, không phiên âm tiếng Việt.
- [ ] Đã có giải thích tiếng Việt trước thuật ngữ tiếng Anh ở lần xuất hiện đầu tiên.
- [ ] Mỗi câu thoại có độ dài vừa phải (15–28 từ), không ghép nhiều câu.
- [ ] Các câu có số liệu đều có dòng `- **Trên màn hình:**`.
- [ ] Kiểu đọc đa dạng, không bị lặp quá 5 câu cùng một kiểu.
- [ ] Đủ 3 bộ Quiz đúng cấu trúc 3 mẩu: `Câu hỏi` $\rightarrow$ `Dừng` $\rightarrow$ `Chữa bài`.
- [ ] Chạy `node tools/script-check.mjs` trả về kết quả `✓ ...: all checks passed` (Exit code: 0).
