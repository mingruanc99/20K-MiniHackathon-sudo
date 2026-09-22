# CLSG-IR: Context-Aware Narrative Planning Audit

> **Tài liệu kiểm toán kiến trúc và đề xuất nâng cấp hệ thống lập kế hoạch tự sự học tập theo ngữ cảnh (Context-Aware Instructional Narrative Upgrade)**  
> *Phiên bản:* 1.1.0  
> *Trạng thái:* Completed Audit — Ready for Implementation

---

## 1. Hiện Trạng Kiến Trúc CLSG-IR (Current Architecture)

Hệ thống CLSG-IR (Configurable Lecture Script & Visual Intent Representation) hiện tại hoạt động theo mô hình tuần tự 4 module:

```
[ Tài liệu học tập (PPTX / PDF / MD) ]
                 ↓
[ M1 — Trích xuất Cấu trúc (Content Extractor) ]
                 ↓ CanonicalDocumentTree
[ M2 — Lập kế hoạch Sư phạm (Instructional Planner) ]
                 ↓ LessonBlueprint
[ M3 — Sinh Biểu diễn Giảng dạy (Expression Generator) ]
       ├── M3A: Narration Script Generator
       ├── M3B: Prosody & Pause Planner (Pre-TTS SSML)
       └── M3C: Visual Intent Generator (13 Taxonomies)
                 ↓ CLSGScene[] (Draft Scenes)
[ M4 — Cổng Kiểm định Chất lượng (Quality & Visual Guard) ]
                 ↓ VerifiedCLSG_IR (DAR-P <= 15%, Language Policy, Taxonomy Valid)
[ UI Studio / Export / Audio Synthesis / Video Preview ]
```

### Các thành phần hiện diện trong mã nguồn:
1. **M1 — Content Extractor (`src/pipeline/module1_extractor/`)**:
   - `pptxExtractor.ts`, `pdfExtractor.ts`, `markdownExtractor.ts`, `extractorFactory.ts`.
   - Phân giải cấu trúc tài liệu thành `CanonicalDocumentTree` (sections, elements, raw_text).
   - Có tích hợp sẵn dữ liệu trích xuất mẫu cho 1-Click CNN Demo (5 slides: S1 đến S5).

2. **M2 — Instructional Planner (`src/pipeline/module2_planner/instructionalPlanner.ts`)**:
   - Tính toán ngân sách từ mục tiêu $W_{\text{target}}$, thời lượng từng phân cảnh dựa trên cấu hình người học (`learnerLevel`, `targetDurationSeconds`, `targetWpm`, `narrationStyle`).
   - Gán vai trò sư phạm sơ bộ (`hook`, `definition`, `mechanism`, `example`, `comparison`, `summary`, `exercise`) dựa trên từ khóa trong tiêu đề slide.
   - Xác định cấp độ nhận thức Bloom (`Remember`, `Understand`, `Apply`, `Analyze`, `Evaluate`, `Create`).

3. **M3A — Narration Generator (`src/pipeline/module3_generator/narrationGenerator.ts`)**:
   - Sinh kịch bản lời giảng theo cấu trúc 4 phần cứng nhắc: (1) Mở đầu, (2) Luận điểm trích xuất (`Thứ nhất... Thứ hai...`), (3) Làm sâu theo vai trò, (4) Tổng kết phân cảnh.
   - Hỗ trợ chính sách tiếng Việt tự nhiên + bảo toàn thuật ngữ tiếng Anh chuẩn thông qua `TechnicalTerminologyService`.

4. **M3B & M3C — Prosody Planner & Visual Intent Generator (`src/pipeline/module3_generator/`)**:
   - `prosodyPlanner.ts`: Gán nhãn ngữ điệu, thời gian ngắt nghỉ (syntactic, semantic, concept_boundary...) và sinh thẻ SSML.
   - `visualIntentGenerator.ts`: Xác định nhu cầu thị giác trên 13 phân loại chuẩn (canonical taxonomies: `process_visualization`, `flowchart`, `diagram`...).

5. **M4 — Quality & Visual Guard (`src/pipeline/module4_guard/qualityGuard.ts`)**:
   - Kiểm định sai số thời lượng DAR-P ($\le 15\%$), tính tuân thủ 13 phân loại thị giác, tính thiết yếu sư phạm của visual, tính trung thực dữ liệu gốc và chính sách ngôn ngữ.

---

## 2. Luồng Xử Lý Lời Giảng Hiện Tại (Current Narration Flow)

Trong `NarrationGenerator.generateVietnameseNarration`:
1. **Mở đầu cứng (Orientation)**: Kiểm tra `order === 1` hoặc `pedagogical_function === 'hook'` -> ghép câu *"Chào mừng các bạn đến với bài học về... Mục tiêu của chúng ta trong phần mở đầu này là..."* hoặc *"Tiếp theo, chúng ta cùng tìm hiểu..."*.
2. **Liệt kê tuần tự (Content Breakdown)**:
   ```ts
   // Mặc định luôn liệt kê mọi bullet trích xuất thành danh sách đánh số
   const bulletSummary = bullets.slice(0, 4).map((b, idx) => `Thứ ${idx + 1}, ${resolvedB}`).join('. ');
   parts.push(`Khi phân tích tài liệu bài giảng, các luận điểm cốt lõi bao gồm: ${bulletSummary}.`);
   ```
3. **Đoạn văn mở rộng theo vai trò (Role Deepening)**: Ghép đoạn văn mẫu chung chung cho `mechanism`, `example` hoặc `definition`.
4. **Kết bài cố định (Synthesis)**: *"Việc nắm bắt chính xác các khía cạnh trên sẽ tạo tiền đề vững vàng để chúng ta tiếp tục khám phá..."*.

---

## 3. Điểm Yếu Cần Khắc Phục (Current Weaknesses)

Dựa trên thực tế vận hành và phản hồi người dùng, 3 vấn đề cốt lõi được xác định:

1. **Vấn đề 1: Lời giảng lạm dụng liệt kê ("Thứ nhất...", "Thứ hai...", "Thứ ba...")**:
   - Ngay cả với slide diễn giải quy trình/quan hệ (ví dụ: `Input Image → Kernel → Feature Map`), hệ thống vẫn tách các thực thể và liệt kê dạng `"Thứ nhất là input image. Thứ hai là kernel. Thứ ba là feature map."` thay vì diễn giải quan hệ nhân quả/vận hành liên tục: *"CNN dùng kernel để quét qua từng vùng nhỏ của ảnh và tạo ra feature map."*
   - Gặp lỗi lặp từ ngữ mẫu câu như: `"Mục tiêu trọng tâm của chúng ta trong phần này là nắm vững tầm quan trọng nền tảng của keypoint & pose thông qua bài học trọng tâm.."`.

2. **Vấn đề 2: Chưa phân biệt sâu vai trò thực sự của Slide (Slide Roles)**:
   - Hệ thống hiện tại chỉ có 7 vai trò chung chung (`hook`, `definition`, `mechanism`, `example`, `comparison`, `summary`, `exercise`).
   - Thiếu các vai trò sư phạm đặc thù: `CORE_CONCEPT`, `KEY_EXPLANATION`, `PROCESS`, `EXAMPLE`, `APPLICATION`, `EVIDENCE`, `DECORATIVE`, `TRANSITION`.
   - Slide hình ảnh/trang trí (`DECORATIVE`) vẫn bị ép sinh lời giảng dài đầy đủ; slide ví dụ (`EXAMPLE`) lại lặp lại toàn bộ định nghĩa lý thuyết thay vì tập trung vào minh họa ca cụ thể và liên hệ ngược lại khái niệm.

3. **Vấn đề 3: Đứt gãy tính mạch lạc giữa các slide (Weak Continuity)**:
   - Các slide được xử lý gần như độc lập cục bộ: $S_1 \to S_2 \to S_3$, thiếu hẳn cầu nối ngữ cảnh (Contextual Bridge) và nhận thức về:
     - Khái niệm đã giảng ở slide trước (`already_explained_concepts`).
     - Tri thức mới cần truyền tải ở slide hiện tại (`current_new_information`).
     - Thông tin chưa được tiết lộ sớm của slide tiếp theo (`future_information`).
   - Thiếu quan hệ tường minh giữa các slide lân cận (`relationship_to_previous`, `relationship_to_next`: `DEEPENS`, `ILLUSTRATES`, `CONTINUES`, `APPLIES`, `SUMMARIZES`...).

---

## 4. Các Module & File Cần Nâng Cấp (Files & Modules to Modify)

1. **`src/types/index.ts`**:
   - Mở rộng schema CLSG-IR với `SlideAnalysis` (`slide_role`, `importance`, `instructional_value`, `content_type`, `requires_explanation`, `requires_transition`, `requires_example`).
   - Bổ sung `NarrativePlan` (`narrative_function`, `previous_slide_id`, `next_slide_id`, `relationship_to_previous`, `relationship_to_next`, `opening_strategy`, `body_strategy`, `closing_strategy`, `list_strategy`).
   - Cập nhật `CLSGScene` để nhúng `slide_analysis` và `narrative_plan` mà không phá vỡ tính tương thích ngược.
   - Thêm các mã lỗi kiểm tra mới cho M4: `UNNECESSARY_ENUMERATION`, `EXAMPLE_REPEATS_THEORY`, `DECORATIVE_OVEREXPLANATION`, `MISSING_TRANSITION`, `REDUNDANT_EXPLANATION`, `PREMATURE_INFORMATION`, `NARRATIVE_ROLE_MISMATCH`.

2. **`src/pipeline/module2_planner/instructionalPlanner.ts`**:
   - Nâng cấp M2 để suy luận đầy đủ: `slide_role` (11 roles), `importance` (`high`/`medium`/`low`), `instructional_value` (`high`/`medium`/`low`), `content_type`, `narrative_function`.
   - Phân tích mối quan hệ giữa các slide kế tiếp nhau (`relationship_to_previous`, `relationship_to_next`).
   - Lập chiến lược mở đầu (`opening_strategy`), thân bài (`body_strategy`), kết bài (`closing_strategy`) và chiến lược danh sách (`list_strategy`: mặc định `NONE`, chỉ dùng khi slide thực sự là danh sách có thứ tự).

3. **`src/pipeline/services/narrativePlannerService.ts` (Mới)**:
   - Dịch vụ chuyên trách tính toán Context-Aware Narrative Plan giữa M2 và M3.
   - Cung cấp ngữ cảnh 3 chiều: Slide Trước (Previous) — Slide Hiện Tại (Current) — Slide Kế Tiếp (Next).
   - Kiểm soát khái niệm đã giảng để ngăn ngừa trùng lặp và rò rỉ tri thức tương lai.

4. **`src/pipeline/module3_generator/narrationGenerator.ts`**:
   - Nhận `NarrativePlan` và thực thi kịch bản giảng dạy theo vai trò:
     - `CORE_CONCEPT`: Giải thích bản chất khái niệm, trực giác.
     - `KEY_EXPLANATION`: Diễn giải cơ chế, mối quan hệ giữa các thành phần.
     - `PROCESS`: Trình bày quy trình nhân quả không dùng "Thứ nhất, Thứ hai" trừ khi là bước thao tác tuần tự thực sự.
     - `EXAMPLE`: Mẫu `Concept -> Example -> Interpretation`, không lặp lại lý thuyết nền.
     - `DECORATIVE`: Lời dẫn ngắn gọn hoặc `null` (không bắt buộc có lời giảng).
     - `SUMMARY`: Tổng hợp cô đọng, củng cố liên kết, không đưa khái niệm mới.
   - Khắc phục triệt để lỗi lặp câu ngữ pháp tiếng Việt và cụm từ thừa.

5. **`src/pipeline/module3_generator/visualIntentGenerator.ts` & `prosodyPlanner.ts`**:
   - `visualIntentGenerator.ts`: Nhận `slide_role` và `instructional_value` để không sinh visual tùy tiện cho slide `DECORATIVE`.
   - `prosodyPlanner.ts`: Điều chỉnh nhịp đọc, độ nhấn theo `narrative_function` (giảng bài đĩnh đạc cho `CORE_CONCEPT`, tự nhiên cho `EXAMPLE`, dứt khoát cho `SUMMARY`).

6. **`src/pipeline/module4_guard/qualityGuard.ts`**:
   - Bổ sung bộ quy tắc kiểm định M4 theo Section 25:
     - Phát hiện đánh số không cần thiết (`UNNECESSARY_ENUMERATION`).
     - Phát hiện slide ví dụ lặp lại lý thuyết (`EXAMPLE_REPEATS_THEORY`).
     - Phát hiện slide trang trí giảng giải quá dài (`DECORATIVE_OVEREXPLANATION`).
     - Kiểm tra cầu nối chuyển tiếp còn thiếu (`MISSING_TRANSITION`).
     - Phát hiện trùng lặp (`REDUNDANT_EXPLANATION`) và tiết lộ sớm (`PREMATURE_INFORMATION`).
   - Hỗ trợ **Targeted Regeneration** (tự động sửa chữa cục bộ chỉ trên slide vi phạm mà không làm hỏng các phân cảnh hợp lệ khác).

7. **Giao diện người dùng (`src/components/pipeline/PlanViewer.tsx`, `QualityGuardViewer.tsx`, `CLSGIRInspector.tsx`)**:
   - Bổ sung bộ thanh tra chiến lược tự sự (Narrative Strategy Inspector) hiển thị rõ `Role`, `Importance`, `Instructional Value`, `Narrative Function`, `Previous/Next Relationship`, `Narration Strategy`.

---

## 5. Luồng Dữ Liệu Đề Xuất (Proposed Data Flow)

```
Document
    ↓
M1 — Content Extractor
    ↓ CanonicalDocumentTree
M2 — Instructional Planner
    ↓ Slide Role Classification + Importance + Instructional Value + Content Type
NEW — Context-Aware Narrative Planner (Internal Layer)
    ├── Xây dựng đồ thị quan hệ: Slide [i-1] ↔ Slide [i] ↔ Slide [i+1]
    ├── Quyết định chiến lược: opening_strategy, body_strategy, closing_strategy
    └── Quyết định cấu trúc: list_strategy (Mặc định: 'none')
    ↓ LessonBlueprint (bao gồm NarrativePlans)
M3A / M3B / M3C — Expression Generation
    ├── M3A: Lời giảng theo ngữ cảnh và vai trò slide
    ├── M3B: Ngữ điệu & ngắt nghỉ theo chức năng tự sự
    └── M3C: Ý đồ thị giác gắn chặt với giá trị sư phạm
    ↓ CLSGScene[]
M4 — Quality & Visual Guard
    ├── Kiểm tra DAR-P & 13 Visual Taxonomies & Factual Grounding
    ├── Kiểm tra Chính sách Ngôn ngữ & Thuật ngữ
    └── Kiểm tra Tính mạch lạc tự sự (Narrative & Role Checks)
         ↳ Nếu lỗi cục bộ: Targeted Auto-Repair trên chính phân cảnh đó
    ↓
Verified CLSG-IR (100% Validated)
```

---

## 6. Đảm Bảo Tính Tương Thích Ngược (Backward Compatibility)

1. **Giữ nguyên các trường CLSG-IR hiện tại**:
   - Các trường `section_id`, `topic`, `order`, `pedagogical_function`, `learning_goal`, `narration`, `prosody_plan`, `visual_cues` được bảo toàn nguyên vẹn.
   - Các trường mới `slide_analysis` và `narrative_plan` được thêm vào dưới dạng trường bổ trợ có giá trị mặc định hợp lệ (`default fallback`), giúp các dự án Firestore cũ tải lại mà không gặp bất kỳ lỗi crash nào.
2. **Không thay đổi kiến trúc hạ tầng**:
   - Không thay đổi React Router, Firebase Auth/Firestore, Cloudinary, hay cấu hình triển khai Vercel.
   - Giữ nguyên chế độ 1-Click CNN Demo hoạt động 100% trơn tru, nâng cấp kịch bản 7 slide chuẩn theo Section 28 & 29 của đặc tả.
