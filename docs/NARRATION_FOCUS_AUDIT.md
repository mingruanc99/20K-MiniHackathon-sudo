# CLSG-IR: Natural & Focused Narration Audit

> **Báo cáo kiểm toán trọng tâm tự sự, phân loại vai trò slide và lọc siêu dữ liệu (Natural & Focused Narration Audit)**  
> *Hệ thống:* CLSG-IR (Configurable Lecture Script & Visual Intent Representation)  
> *Phiên bản:* 1.2.0  
> *Trạng thái:* Completed Audit — Ready for Implementation

---

## 1. Hiện Trạng Luồng Sinh Lời Giảng (Current Narration Generation Flow)

Trong kiến trúc CLSG-IR hiện tại:
1. **M1 (Extractor)** trích xuất text từ slide hoặc tài liệu thành `raw_text` và danh sách `elements`.
2. **M2 (Instructional Planner)** xác định cấu trúc thời lượng, ngân sách từ $W_{\text{target}}$ và gọi `narrativePlannerService.planNarrative`.
3. **`narrativePlannerService`** phân tích vai trò slide (`analyzeSlide`) và thiết lập mối quan hệ kế thừa (`relationship_to_previous`, `relationship_to_next`).
4. **M3A (`NarrationGenerator`)** nhận `SectionPlan`, `UserConfiguration`, `rawText` và `context` (previous/next slide).
5. **M3B & M3C** gán prosody ngắt nghỉ và xác định visual cues.
6. **M4 (`QualityVisualGuard`)** kiểm định DAR-P, tính tuân thủ 13 taxonomies, ngôn ngữ và tính mạch lạc tự sự.

---

## 2. Vị Trí Suy Luận Vai Trò Slide & Điểm Yếu Phân Loại (Where Slide Role is Inferred & Weaknesses)

### Vị trí mã nguồn:
`src/pipeline/services/narrativePlannerService.ts` -> `analyzeSlide(...)`

### Các điểm yếu cụ thể:
1. **Slide Tiêu Đề / Mở Đầu bị nhận diện nhầm thành `CORE_CONCEPT` (Problem A)**:
   - Các slide như `"Keypoint & Pose"` hoặc tiêu đề chuyên đề ngắn chỉ gồm 1-2 dòng tiêu đề thường bị gán vai trò `CORE_CONCEPT` vì tiêu đề chứa thuật ngữ kỹ thuật.
   - Kết quả: Hệ thống cố gắng giải thích toàn bộ lý thuyết ngay từ giây đầu tiên thay vì chỉ chào mừng và định hướng tổng quan ngắn gọn (1–2 câu).
2. **Slide Câu Hỏi / Tình Huống / Khơi Gợi (Hook) bị nhận diện nhầm thành `KEY_EXPLANATION` hoặc `PROCESS` (Problem B)**:
   - Các slide mang tính khơi gợi như `"HÃY SUY NGHĨ... ảnh chụp tài xế từ bên phải... tay đang cầm vô-lăng là tay trái hay tay phải?"` chứa câu hỏi thực tế nhưng bị ép vào vai trò giải thích kỹ thuật.
   - Hệ thống thiếu vai trò tường minh `HOOK` trong `SlideRole` và quy tắc phân loại dựa trên câu hỏi / kịch bản suy nghĩ.
3. **Phân loại cục bộ chưa tận dụng vị trí phân cảnh (Context-Insensitive Classification)**:
   - Một slide câu hỏi xuất hiện ngay sau slide tiêu đề cần được định danh ngay là `HOOK`, chứ không phải là `MECHANISM`.

---

## 3. Vị Trí Siêu Dữ Liệu Rò Rỉ Vào Lời Giảng (Where Metadata Enters Narration)

### Vị trí mã nguồn:
- `src/pipeline/module3_generator/narrationGenerator.ts` -> `extractBulletPoints(rawText)` và `buildRoleBasedBodyVi`.

### Cơ chế rò rỉ:
- `rawText` trích xuất từ slide thường chứa các chuỗi chân trang (footer), mã học phần, ngày tháng, thông tin tổ chức:  
  `"aicb-p2t4 · ngày 04 · chương 1 · data track · vinuniversity"`
- Hiện tại, `extractBulletPoints` chỉ lọc các dòng bắt đầu bằng `slide ` hoặc `[note:`. Toàn bộ các dòng metadata còn lại bị coi là luận điểm giảng dạy (`bullets`) và được đưa vào lời giảng:  
  *“Đồng thời, aicb-p2t4 · ngày 04 · chương 1...”*
- **Giải pháp:** Cần xây dựng tầng **Content Filtering** phân loại văn bản thành `INSTRUCTIONAL_CONTENT`, `SUPPORTING_CONTENT`, `METADATA`, `DECORATIVE_TEXT`, và tạo danh sách loại trừ tường minh `excluded_content`.

---

## 4. Vị Trí Phát Sinh Độ Dài Dư Thừa & Giọng Văn Báo Cáo (Where Verbosity & Mechanical Tone is Introduced)

### Vị trí mã nguồn:
- `narrationGenerator.ts` -> `calibrateToWordBudget`, `buildContextualBridgeVi`, `buildRoleBasedBodyVi`.

### Nguyên nhân:
1. **Thiếu Khái Niệm "Một Slide = Một Thông Điệp Cốt Lõi" (One Slide = One Core Message)**:
   - Hệ thống cố gắng diễn giải mọi từ ngữ xuất hiện trên slide.
   - Chưa có trường `core_message` (1 câu cô đọng duy nhất) để làm trọng tâm định hướng câu thoại.
2. **Cơ chế Calibrate Word Budget cưỡng ép thêm văn bản mẫu (Padding Overhead)**:
   - Khi độ dài ngắn hơn $W_{\text{target}}$, hệ thống tự động chèn các câu đệm chung chung như:  
     *“Cụ thể hơn, việc kết nối chặt chẽ giữa các thành phần giúp tối ưu hóa hiệu quả tính toán của mô hình... Đồng thời, từ nền tảng này...”*  
   - Điều này vi phạm nguyên tắc **Minimum Sufficient Explanation** (Chỉ nói lượng thông tin tối thiểu cần thiết để người học hiểu thông điệp cốt lõi).
3. **Lạm dụng các cụm từ nối rập khuôn (Generic Filler)**:
   - Các cụm từ lặp: *"Trong phần này..."*, *"Đồng thời..."*, *"Từ nền tảng này..."*, *"Tiếp theo chúng ta sẽ..."* tạo cảm giác máy móc như đang đọc báo cáo chứ không phải một giảng viên đang nói chuyện tự nhiên.

---

## 5. Vị Trí Ngữ Cảnh Slide Trước Được Tiêm Vào (Where Previous-Slide Context is Injected)

### Vị trí mã nguồn:
- `src/pipeline/orchestrator.ts` (truyền `prevPlan`, `nextPlan` vào `generateNarration`).
- `src/pipeline/module3_generator/narrationGenerator.ts` -> `buildContextualBridgeVi`.

### Điểm cần cải tiến:
- Cầu nối ngữ cảnh hiện tại đôi khi bị dập khuôn máy móc:  
  *“Ở slide trước, chúng ta đã nắm được nền tảng của Keypoint & Pose. Bây giờ, chúng ta sẽ đi sâu vào cơ chế chi tiết. HÃY SUY NGHĨ...”*
- Cần điều chỉnh để chỉ chèn cầu nối khi nó thực sự phục vụ việc liên kết khái niệm logic (ví dụ: chuyển từ kiến trúc sang lớp convolution), và tuyệt đối không chèn cầu nối kỹ thuật trước một câu hỏi tình huống (`HOOK`).

---

## 6. Danh Sách Các File Cần Nâng Cấp (Files to Modify)

1. **`src/types/index.ts`**:
   - Thêm `'HOOK'` vào `SlideRole`.
   - Thêm `core_message`, `supporting_points`, `excluded_content` vào `SlideAnalysis`.
   - Thêm `verbosity: 'minimal' | 'concise' | 'standard' | 'detailed'` vào `NarrativePlan`.
   - Bổ sung các mã kiểm tra chất lượng M4: `MULTIPLE_CORE_MESSAGES`, `METADATA_LEAK`, `OVEREXPLANATION`, `SLIDE_READING`, `FILLER_OVERUSE`.

2. **`src/pipeline/services/narrativePlannerService.ts`**:
   - Thêm hàm lọc siêu dữ liệu (`filterMetadataAndContent`).
   - Thêm bộ trích xuất thông điệp cốt lõi (`extractCoreMessage`).
   - Tinh chỉnh phân loại vai trò slide: nhận diện chính xác `HOOK` (câu hỏi, suy nghĩ, tình huống) và `INTRODUCTION` (slide tiêu đề mở đầu).
   - Thiết lập `verbosity` theo vai trò slide.

3. **`src/pipeline/module3_generator/narrationGenerator.ts`**:
   - Áp dụng nguyên tắc **One Slide = One Core Message** và **Minimum Sufficient Explanation**.
   - Loại bỏ hoàn toàn việc đọc siêu dữ liệu bị loại trừ (`excluded_content`).
   - Sinh câu thoại tự nhiên, ngắn gọn, đàm thoại, không lạm dụng filler (*"Đồng thời..."*, *"Từ nền tảng này..."*).
   - Xử lý chuyên biệt cho slide Tiêu đề (ngắn 1–2 câu) và slide Hook (đặt câu hỏi gợi mở, không giải thích cơ chế ngay).
   - Không tự động ép số lượng từ (padding) cho slide tiêu đề, hook, trang trí.

4. **`src/pipeline/module4_guard/qualityGuard.ts`**:
   - Bổ sung 5 quy tắc kiểm tra FOCUS:
     - `FOCUS_001`: Phát hiện rò rỉ siêu dữ liệu (`METADATA_LEAK`).
     - `FOCUS_002`: Phát hiện diễn giải quá dài (`OVEREXPLANATION`).
     - `FOCUS_003`: Phát hiện lạm dụng từ đệm rập khuôn (`FILLER_OVERUSE`).
     - `FOCUS_004`: Phát hiện lệch vai trò (`NARRATIVE_ROLE_MISMATCH`).
   - Tự động Targeted Repair cắt bỏ siêu dữ liệu hoặc nén câu thoại khi phát hiện vi phạm.

5. **`src/components/pipeline/PlanViewer.tsx`**:
   - Hiển thị `Core Message`, `Excluded Content (Metadata)` và `Verbosity` trong Narrative Strategy Inspector.

6. **`tests/ts/pipeline.test.js`**:
   - Thêm test case cho việc lọc metadata (S1 "Keypoint & Pose" với chuỗi metadata "aicb-p2t4...").
   - Thêm test case cho việc phân loại và sinh lời giảng cho slide Hook (S2 "HÃY SUY NGHĨ...").
