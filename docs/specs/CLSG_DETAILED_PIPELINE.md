# TÀI LIỆU ĐẶC TẢ PIPELINE CHI TIẾT CỦA HỆ THỐNG CLSG-IR
*(Configurable Lecture Script & Visual Intent Representation)*

> **Lưu ý:** Tài liệu này mô tả bản cài đặt Python (`app/`, `scripts/run_pose_estimation_pipeline.py`) đã được gỡ khỏi repo; xem git history tại commit `35d4cab` nếu cần. Pipeline đang chạy là bản TypeScript trong `src/pipeline/` (module1_extractor → module2_planner → module3_generator → module4_guard), chỉ số đánh giá ở `docs/specs/EVALUATION.md`.

---

## 1. TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)

Hệ thống **CLSG-IR** được thiết kế để giải quyết bài toán cốt lõi: **Chuyển hóa tài liệu học tập thô (PPTX, PDF, DOCX, Markdown) thành biểu diễn trung gian bài giảng sư phạm có cấu trúc, đồng bộ chặt chẽ giữa kịch bản giảng dạy (Script), kế hoạch ngữ điệu (Prosody) và chỉ dẫn thị giác (Visual Intent)**.

Biểu diễn trung gian này đóng vai trò là "nguồn chân lý duy nhất" (Source of Truth) để cấp phát trực tiếp cho các hệ thống tổng hợp video (Remotion, Manim, Unreal Engine) hoặc các dịch vụ TTS học thuật.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TÀI LIỆU ĐẦU VÀO (RAW DOCUMENTS)                │
│                         PPTX  •  PDF  •  DOCX  •  MD                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│         MODULE 1: BÓC TÁCH ĐA PHƯƠNG THỨC & HIỂU THỊ GIÁC (ZERO-LLM)   │
│       Layout 2D  •  Diagram Recognizer  •  Vector Graph  •  Unicode    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              TẦNG LƯU TRỮ TRI THỨC BỀN VỮNG (KNOWLEDGE LAYER)          │
│       PostgreSQL/SQLite  •  Relational Graph  •  Vector Embeddings     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│            MODULE 2: LẬP KẾ HOẠCH BẢN VẼ SƯ PHẠM (BLUEPRINT)           │
│       Bloom's Taxonomy  •  WPM Budget  •  Scaffolded Progression       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│          MODULE 3: SINH BIỂU ĐẠT ĐA PHƯƠNG THỨC (EXPRESSION)           │
│   3A Narration Script  •  3B Prosody & Pause  •  3C Visual Taxonomies  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│     MODULE 4: HỆ THỐNG KIỂM ĐỊNH & ĐẢM BẢO CHẤT LƯỢNG (GUARD)          │
│   Automated QA  •  DAR-P / DAR-S  •  Decision Engine  •  Human Review  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      XUẤT XƯỞNG ĐA ĐỊNH DẠNG (EXPORT)                  │
│       CLSG JSON  •  Remotion Props  •  SSML Bundle  •  Manim Code      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CHI TIẾT 9 GIAI ĐOẠN CỦA PIPELINE (THE 9 PIPELINE STAGES)

### Giai Đoạn 0: Tiếp Nhận & Khởi Tạo (Input Inception & Ingestion)
- **Đầu vào**: Mảng byte nhị phân của tài liệu (`source_bytes`), tên tệp (`filename`), và cấu hình học tập `PipelineConfig`.
- **Nhiệm vụ**:
  1. Tính mã băm SHA-256 (`file_hash`) để kiểm tra tính toàn vẹn và chống xử lý trùng lặp.
  2. Xác thực cấu hình `LearnerPersona` (đối tượng học viên, kiến thức nền tảng, phong cách sư phạm) và `PresentationConfig` (thời lượng mong muốn, WPM chuẩn, mật độ thị giác).
  3. Khởi tạo nhật ký truy vết `ExecutionTraceLog`.

---

### Giai Đoạn 1: Bóc Tách Đa Phương Thức & Hiểu Đồ Họa (Multimodal Extraction & Visual Understanding)
- **Nguyên tắc**: **Zero-LLM/VLM**, tốc độ xử lý $< 50$ms, không phụ thuộc API bên ngoài.
- **Thực thi trong code**: [app/modules/extractor/factory.py](file:///c:/Users/KIM%20THIEN/Desktop/T032/app/modules/extractor/factory.py) &rarr; `PPTXExtractor`, `PDFExtractor`, `DOCXExtractor`.
- **Cơ chế bóc tách**:
  1. **Phân vùng không gian 2D (Spatial Layout Partitioning)**:
     - Tọa độ chuẩn hóa `bbox = [x1, y1, x2, y2]` ($\in [0.0, 1.0]$).
     - Phân lớp rõ rệt: `top_title` ($Y < 0.18$), `left_diagram` ($X \le 0.48$), `right_text` ($X > 0.48$), `bottom_caption` ($Y \ge 0.85$).
  2. **Hiểu sơ đồ & khung xương (Diagram Understanding)**:
     - [DiagramRecognizer](file:///c:/Users/KIM%20THIEN/Desktop/T032/app/modules/extractor/diagram_recognizer.py) phát hiện các cấu trúc đồ thị logic (như khung xương người `human_pose_skeleton`, lưu lượng `flowchart`, kiến trúc `architecture`).
     - Tách riêng toàn bộ nhãn số tọa độ ($0..16$) thành `type="annotation"` kèm `diagram_ref`. Ngăn chặn hoàn toàn hiện tượng nhãn số hòa lẫn vào văn bản tạo ra chuỗi biến dạng (`"0 9"`, `"2 11"`, `"4 13"`).
  3. **Bảo toàn ký tự đặc biệt & Unicode (Unicode Preservation)**:
     - Chuẩn hóa NFC nhưng bảo toàn nghiêm ngặt dải số học (`1–4`, `5–10`, `11–16`) và các dấu gạch ngang (`–`, `—`, `−`, `-`).

---

### Giai Đoạn 2: Xây Dựng Document IR & Lưu Trữ Tri Thức Bền Vững
- **Nguyên tắc**: **DOCUMENT IR = SOURCE OF TRUTH**; **MARKDOWN = VIEW CHO LLM**.
- **Cấu trúc thực thể**:
  - `DocumentRecord`: Thông tin phiên bản, parser version, schema version, status.
  - `SlideIR`: Kích thước vật lý, danh sách phần tử, quan hệ liên kết.
  - `DocumentElement`: ID duy nhất, loại (`text`, `diagram`, `annotation`, `table`), role, bbox, reading order.
  - `VisualRecord`: Bản ghi thị giác, lưu trữ metadata giải phẫu (`keypoint_count: 17, connection_count: 19`).
- **Cơ sở dữ liệu**: SQLite (môi trường local/offline) và PostgreSQL/pgvector (môi trường Cloud/Production).

---

### Giai Đoạn 3: Phân Mảnh Suy Luận Đa Phương Thức & Đánh Chỉ Mục Vector
- **Nguyên tắc**: **SEMANTIC CHUNK = UNIT OF REASONING**.
- **Thực thi**: [SemanticChunker](file:///c:/Users/KIM%20THIEN/Desktop/T032/app/modules/extractor/chunker.py).
- **Quy tắc tạo chunk**:
  - Bảo tồn tuyệt đối ranh giới bảng và biểu đồ (không cắt xẻ bảng ngang chừng).
  - **Multimodal Chunk**: Tự động gộp văn bản giải thích và hình ảnh/diagram được giải thích thành một đơn vị suy luận thống nhất.
  - **Vector Embeddings**: Tạo vector 1536 chiều bằng mô hình chuẩn hóa $L_2$ (`text-embedding-3-small`), phục vụ tìm kiếm tương đồng ngữ nghĩa.

---

### Giai Đoạn 4: Lập Kế Hoạch Bản Vẽ Sư Phạm (Module 2: Instructional Planner)
- **Thực thi**: [InstructionalPlanner](file:///c:/Users/KIM%20THIEN/Desktop/T032/app/modules/planner/planner.py).
- **Chiến lược sư phạm**: *Scaffolded Conceptual Progression (Hook &rarr; Intuition &rarr; Mechanism &rarr; Synthesis)*.
- **Phân bổ ngân sách**:
  - Ngân sách từ: $\text{WordBudget} = \frac{\text{TargetDurationSec} \times \text{BaselineWPM}}{60}$.
  - Gán nhãn nhận thức Bloom (`Remember`, `Understand`, `Apply`, `Analyze`, `Evaluate`, `Create`) cho từng section.

---

### Giai Đoạn 5: Sinh Biểu Đạt Đa Phương Thức (Module 3: Expression Generator)
- **Thực thi**: [ExpressionGenerator](file:///c:/Users/KIM%20THIEN/Desktop/T032/app/modules/generator/generator.py).
- **Bộ ba thành phần đồng bộ**:
  1. **3A: Narration Script**: Văn phong giảng giải sư phạm tự nhiên, ngắn gọn, súc tích.
  2. **3B: Prosody & Pause Planning**:
     - Lập kế hoạch ngắt nghỉ trước TTS: `Micro-pause` (150ms), `Emphasis-pause` (300ms), `Cognitive-pause` (500-1200ms), `Transition-pause` (1000-2000ms).
     - Tạo tài liệu SSML đầy đủ với thẻ `<prosody>` và `<break>`.
  3. **3C: Visual Intent Cues (13 Canonical Taxonomies)**:
     - Định nghĩa chính xác *cái gì xuất hiện, ở đâu, khi nào* theo mốc thời gian phát âm (`trigger_timestamp_sec`).
     - 13 loại taxonomy: `Diagram Animation`, `Code Walkthrough`, `Mathematical Derivation`, `Geometric Spatial Transform`, `Timeline Progression`, `Data Chart Trend`, `Concept Map Linkage`, `Physical World Metaphor`, `Architectural Highlight`, `Code Execution Trace`, `Component Zoom-in`, `Morphing Transition`, `Side-by-Side Comparison`.

---

### Giai Đoạn 6: Kiểm Định & Chứng Nhận Chất Lượng (Module 4: Quality & Visual Guard)
- **Thực thi**: [QualityVisualGuard](file:///c:/Users/KIM%20THIEN/Desktop/T032/app/modules/guard/guard.py).
- **Các tiêu chuẩn kiểm tra bắt buộc**:
  - **DAR-P (Duration Accuracy Ratio)**: Sai số thời lượng $|\Delta t| \le 10\%$.
  - **DAR-S (Script-Visual Synchronization Ratio)**: $100\%$ visual cues có mốc thời gian hợp lệ trong cảnh.
  - **Anti-Hallucination**: Đối soát nội dung lời giảng với Document IR gốc.
  - **Tự động sửa lỗi (Auto-Repair)**: Tự động nén/giãn tốc độ đọc (WPM scaling) và chèn ngắt nghỉ để triệt tiêu độ lệch thời lượng.
  - Cấp chứng nhận: `VerifiedCLSG_IR`.

---

### Giai Đoạn 7: Đóng Gói Xuất Xưởng Đa Định Dạng (Multi-Target Export Engine)
- **Gói đầu ra `ExportPackage`**:
  1. `clsg_json`: Bản ghi JSON toàn diện chuẩn CLSG-IR.
  2. `remotion_props`: Cấu hình timeline, frame và visual trigger sẵn sàng render trên Remotion (React Video).
  3. `ssml_bundle`: Tập tin SSML theo từng cảnh để nạp vào ElevenLabs / Google Cloud TTS.
  4. `manim_code`: Mã nguồn Python kịch bản toán học/đồ thị chạy độc lập trên Manim engine.

---

### Giai Đoạn 8: Truy Vấn & Kiểm Định Tri Thức (Pedagogical Hybrid Retrieval)
- **Thực thi**: [QueryService](file:///c:/Users/KIM%20THIEN/Desktop/T032/app/services/query_service.py).
- **Hỗ trợ 10 ý định sư phạm chuyên sâu**:
  1. `FIND_VISUAL`: Truy xuất sơ đồ / hình ảnh kỹ thuật.
  2. `FIND_DIAGRAM`: Tìm kiếm đồ thị logic theo đỉnh và cạnh.
  3. `FIND_CONCEPT`: Tìm định nghĩa khái niệm.
  4. `FIND_DEFINITION`: Trích xuất công thức hoặc thuật ngữ.
  5. `FIND_SLIDES`: Tìm slide liên quan đến chủ đề.
  6. `FIND_SUPPORTING_TEXT`: Lấy đoạn văn bổ trợ cho hình ảnh.
  7. `FIND_RELATED_CONTENT`: Gợi ý tri thức liên quan.
  8. `FIND_SOURCE`: Truy vết nguồn trích dẫn gốc.
  9. `FIND_RELATIONS`: Khám phá mạng lưới liên kết giữa các phần tử.
  10. `FIND_MULTIMODAL_CONTEXT`: Lấy ngữ cảnh hợp nhất cả text và visual.

---

## 3. HƯỚNG DẪN VẬN HÀNH & KIỂM TRA (EXECUTION GUIDE)

### 1. Chạy Trực Tiếp Bằng Lệnh Python
Hệ thống cung cấp sẵn script chạy độc lập:
```bash
python scripts/run_pose_estimation_pipeline.py
```
*Thời gian chạy toàn bộ: ~0.17 giây, in đầy đủ nhật ký của 8 bước.*

### 2. Sử Dụng Trực Tiếp Trong Code Python
```python
from app.core.clsg_pipeline import clsg_pipeline
from app.models.config import PipelineConfig

# Chạy toàn bộ pipeline trên một tệp bài giảng bất kỳ
result = clsg_pipeline.execute(
    source="app/data/Pose_Estimation.pptx",
    filename="Pose_Estimation.pptx",
    config=PipelineConfig()
)

print(f"Verified IR ID: {result.verified_ir_id}")
print(f"Quality Score : {result.quality_score}/100")
print(f"Runtime       : {result.total_runtime_sec}s")
```

### 3. Kiểm Tra Trực Quan Trên Web (Knowledge Inspector UI)
Truy cập route đã triển khai trên production:
- **URL**: [https://clsg-ir-studio.vercel.app/knowledge](https://clsg-ir-studio.vercel.app/knowledge)
- Chọn tài liệu `Pose_Estimation.pptx` để kiểm tra chi tiết 11 tầng tri thức:
  1. Document Overview
  2. Slide Inspector
  3. Element Inspector
  4. Visual Inspector
  5. Visual Overlay
  6. Raw vs Normalized
  7. Relation Graph
  8. Chunk Inspector
  9. Database Records
  10. Retrieval Tester
  11. Pipeline Debug
