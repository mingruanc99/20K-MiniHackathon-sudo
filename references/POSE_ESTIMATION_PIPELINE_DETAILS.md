# TÀI LIỆU LUỒNG PIPELINE CHI TIẾT: BÀI GIẢNG "POSE ESTIMATION" (HUMAN SKELETON)

Tài liệu này đặc tả toàn bộ luồng xử lý thực thi đầu-cuối (End-to-End Execution Trace) của hệ thống **CLSG-IR** áp dụng cho tệp bài giảng `Pose_Estimation.pptx`, với trọng tâm giải quyết bài toán phức tạp tại **Slide 8**: *"17 điểm có tên — và 19 đường nối"*.

---

## 1. Sơ Đồ Khái Quát Luồng Dữ Liệu (End-to-End Pipeline)

```
[INPUT: Pose_Estimation.pptx (8 Slides) + UserConfiguration]
                          ↓
[MODULE 1: MULTIMODAL EXTRACTION & VISUAL UNDERSTANDING]
  ├─ Spatial Layout Partitioning (left_diagram, right_text, top_title, bottom_caption)
  ├─ DiagramRecognizer: Human Pose Skeleton (17 Keypoints, 19 Edges)
  ├─ Annotation Isolator: Chuyển 0..16 thành `diagram_annotation` (Không lẫn text)
  └─ RelationshipBuilder: text → explains → visual; annotation → annotates → visual
                          ↓
[DOCUMENT IR (Source of Truth)]
                          ↓
[PERSISTENT KNOWLEDGE STORAGE & VECTOR EMBEDDING]
  ├─ SQLite / PostgreSQL: Documents, Slides, Elements, Visuals, Concepts, Relations, Chunks
  └─ Embedding Provider: Vectors 1536 chiều (text-embedding-3-small)
                          ↓
[MODULE 2: INSTRUCTIONAL BLUEPRINT PLANNER]
  └─ Phân bổ thời lượng mục tiêu (240s), WPM (135), mục tiêu Bloom (Understand/Analyze)
                          ↓
[MODULE 3: MULTIMODAL EXPRESSION GENERATOR]
  ├─ 3A: Lời giảng sư phạm tự nhiên (Narration Script)
  ├─ 3B: Kế hoạch ngữ điệu, ngắt nghỉ nhận thức (Prosody & Pause Planning)
  └─ 3C: Chỉ dẫn thị giác chuẩn hóa (13 Canonical Visual Taxonomies)
                          ↓
[MODULE 4: QUALITY & VISUAL GUARD CERTIFICATION]
  ├─ Kiểm định DAR-P (Sai số thời lượng <= 10%), DAR-S (Đồng bộ Visual-Script)
  └─ Chứng nhận Verified CLSG-IR (Chống hallucination)
                          ↓
[DOWNSTREAM EXPORT & HYBRID RETRIEVAL]
  ├─ 4 Định dạng xuất: CLSG JSON, Remotion Props, SSML Bundle, Manim Code
  └─ Hybrid Retrieval: Vector Cosine + Full-text + Knowledge Graph Traversal
```

---

## 2. Chi Tiết Thực Thi Qua Từng Giai Đoạn

### Giai Đoạn 1: Input & Khởi Tạo Cấu Hình Sư Phạm
- **Tệp nguồn**: `app/data/Pose_Estimation.pptx` (8 slides, kích thước 41.9 KB).
- **Cấu hình sư phạm**:
  - `target_audience`: `undergraduate` (Sinh viên đại học khối ngành CNTT/Khoa học dữ liệu).
  - `prior_knowledge`: Thị giác máy tính cơ bản, ma trận ảnh, tích chập.
  - `target_duration_sec`: $240$ giây (4 phút).
  - `baseline_wpm`: $135$ WPM (Tốc độ giảng chuẩn học thuật).
  - `visual_density`: `rich` (Ưu tiên trực quan hóa tối đa).

---

### Giai Đoạn 2: Module 1 - Bóc Tách Đa Phương Thức & Hiểu Đồ Họa (Visual Understanding)
Giai đoạn này giải quyết triệt để vấn đề slide bị coi là "thuần văn bản":
1. **Phân vùng không gian 2D (Spatial Layout Partitioning)**:
   - $X \in [0.00, 0.48]$: Gán nhãn `layout_region="left_diagram"`.
   - $X \in [0.48, 1.00]$: Gán nhãn `layout_region="right_text"`.
   - $Y \le 0.18$: Gán nhãn `layout_region="top_title"`.
   - $Y \ge 0.85$: Gán nhãn `layout_region="bottom_caption"`.
2. **Nhận diện Khung xương Người (Human Pose Skeleton)**:
   - Phát hiện các dấu hiệu: Tiêu đề có chứa *"17 điểm có tên — và 19 đường nối"*, cụm từ *"COCO"*, *"nose — mũi"*, và mật độ các số nguyên độc lập từ $0$ đến $16$.
   - Khởi tạo thực thể `StructuredDiagram` logic với:
     - $17$ nodes (keypoints): `nose`, `left_eye`, `right_eye`, `left_ear`, `right_ear`, `left_shoulder`, `right_shoulder`, `left_elbow`, `right_elbow`, `left_wrist`, `right_wrist`, `left_hip`, `right_hip`, `left_knee`, `right_knee`, `left_ankle`, `right_ankle`.
     - $19$ edges (connections): Liên kết khung xương COCO chuẩn hóa.
     - `bbox`: `[0.05, 0.15, 0.45, 0.88]`.
     - `confidence`: `0.96`.
3. **Cô lập nhãn số Diagram (Annotation Isolation)**:
   - Toàn bộ 17 số $0..16$ nằm ở vùng `left_diagram` được chuyển đổi thành `type="annotation"`, `source_type="diagram_annotation"`, `role="reference"`.
   - **Tuyệt đối không đưa vào dòng text thường**, ngăn chặn lỗi nhập chuỗi thành `"0 9"`, `"2 11"`, `"4 13"`, `"6 15"`.
4. **Bảo tồn dải số và ký tự Unicode gạch ngang**:
   - Sử dụng chuẩn NFC, bảo toàn nguyên vẹn:
     - `■ 0 nose — mũi`
     - `■ 1–4 mắt trái, mắt phải, tai trái, tai phải`
     - `■ 5–10 vai, khuỷu tay, cổ tay (trái rồi phải)`
     - `■ 11–16 hông, đầu gối, cổ chân (trái rồi phải)`
     - `Nguồn: COCO — person keypoints, 17 điểm / 19 cạnh`

---

### Giai Đoạn 3: Lưu Trữ Cơ Sở Dữ Liệu & Đánh Chỉ Mục Vector
Toàn bộ DocumentIR được chuyển đổi thành các bản ghi quan hệ và lưu vào PostgreSQL / SQLite (`app/data/clsg_knowledge.db`):
- **Bảng `documents`**: Metadata tệp `Pose_Estimation.pptx` (Version 1, Schema v1.0.0).
- **Bảng `slides`**: 8 bản ghi SlideIR với thông số kích thước và tọa độ.
- **Bảng `elements`**: 47 phần tử (gồm 25 phần tử tại Slide 8).
- **Bảng `visuals`**: Bản ghi visual `human_pose_skeleton` chứa metadata `{"keypoint_count": 17, "connection_count": 19}`.
- **Bảng `concepts`**: 28 khái niệm sư phạm chính.
- **Bảng `relations`**: 26 quan hệ ngữ nghĩa (23 quan hệ tại Slide 8).
- **Bảng `chunks`**: 28 chunk ngữ nghĩa. Riêng Slide 8 tạo ra Multimodal Chunk liên kết giữa mô hình khung xương và văn bản định nghĩa tọa độ khớp.
- **Vector Embeddings**: 28 vector 1536 chiều được tính toán và lưu trữ.

---

### Giai Đoạn 4: Module 2 - Thiết Kế Bản Vẽ Sư Phạm (Instructional Planner)
Bộ lập kế hoạch sư phạm phân bổ thời lượng và ngân sách từ dựa trên thang đo nhận thức Bloom:
- **Tổng ngân sách từ**: $438$ từ trên toàn bài giảng.
- **Kế hoạch cho Section Slide 8**:
  - `target_duration_sec`: $36$ giây.
  - `target_word_budget`: $66$ từ.
  - `bloom_level`: `Understand / Analyze`.
  - `instructional_goal`: Tổng hợp tiêu chuẩn định dạng 17 điểm mốc giải phẫu và 19 liên kết khung xương COCO.

---

### Giai Đoạn 5: Module 3 - Sinh Biểu Đạt Đa Phương Thức (Expression Generator)
Module 3 chuyển hóa kế hoạch sư phạm thành kịch bản đồng bộ:
1. **3A: Lời thoại giảng giải (Narration)**: Lời giảng tự nhiên, sư phạm, giải thích rõ ràng thứ tự 17 điểm khớp từ đầu đến chân.
2. **3B: Ngữ điệu & Ngắt nghỉ (Prosody & Pause Planning)**:
   - Chia thành $4$ câu học thuật.
   - Thêm $4.35$ giây ngắt nghỉ nhận thức (`Cognitive-pause`, `Emphasis-pause`) trước các từ khóa kỹ thuật.
   - Tạo tài liệu SSML chuẩn cho bộ tổng hợp giọng nói TTS.
3. **3C: Chỉ dẫn thị giác (Visual Intent Cues)**:
   - Kích hoạt $4$ hiệu ứng thị giác theo thời gian thực:
     - `[2.77s] draw`: Vẽ khung xương người và làm sáng 17 điểm mốc.
     - `[15.2s] highlight`: Làm nổi bật nhóm khớp đầu & mắt (`0 nose`, `1–4 eyes/ears`).
     - `[21.93s] pulse`: Nhấp nháy các chi trên vai và khuỷu tay (`5–10`).
     - `[28.5s] reveal`: Hiển thị nhánh chi dưới hông, đầu gối, cổ chân (`11–16`).

---

### Giai Đoạn 6: Module 4 - Kiểm Định & Chứng Nhận (Quality Visual Guard)
Hệ thống kiểm định tự động Module 4 chứng nhận kết quả:
- **Sai số thời lượng (DAR-P)**: $3.68\%$ (Thỏa mãn tiêu chuẩn khắt khe $\le 10\%$).
- **Đồng bộ Visual - Script (DAR-S)**: $100\%$ các chỉ dẫn thị giác khớp với mốc từ phát âm.
- **Chống ảo giác (Anti-Hallucination)**: $100\%$ điểm khớp và liên kết được kiểm chứng đối chiếu với nguồn dữ liệu gốc COCO.
- **Cấp chứng chỉ**: `VerifiedCLSG_IR` (ID: `ir_8e9fd702`).

---

### Giai Đoạn 7: Xuất Bản Đa Nền Tảng (Export Targets)
Gói sản phẩm CLSG-IR được đóng gói thành 4 định dạng đầu ra:
1. `clsg_json`: Định dạng JSON đầy đủ cho hệ thống lưu trữ và quản lý học tập.
2. `remotion_props`: Thuộc tính và timeline video phục vụ render trên Remotion (React Video).
3. `ssml_bundle`: Mã đánh dấu ngữ điệu giọng đọc cho TTS (ElevenLabs, Google Cloud TTS).
4. `manim_code`: Mã nguồn Python động hóa đồ thị khung xương 17 điểm bằng thư viện Manim.

---

### Giai Đoạn 8: Kiểm Thử Truy Vấn Tri Thức (Hybrid Retrieval Test)
Thực thi kiểm tra khả năng truy hồi thông tin trên cơ sở dữ liệu thật:
- Truy vấn: `"human pose skeleton"` &rarr; Trả về Multimodal Chunk của Slide 8 (`Score: 0.6959`), liên kết chính xác đến `visual_id: diagram_...`.
- Truy vấn: `"keypoint 0"` &rarr; Trả về định nghĩa mũi (`0 nose — mũi`) và vị trí đỉnh số 0 của khung xương.
- Truy vấn: `"vai, khuỷu tay"` &rarr; Trả về dải điểm 5–10 (`Score: 0.8076`).
- Truy vấn: `"17 keypoints"` &rarr; Trả về tài liệu trích dẫn nguồn COCO chuẩn hóa.

---

## 3. Hướng Dẫn Chạy & Kiểm Định Trực Quan

Người dùng và kiểm định viên có thể kiểm tra trực tiếp theo 2 cách:

### Cách 1: Chạy trực tiếp script pipeline bằng Python
```bash
python scripts/run_pose_estimation_pipeline.py
```
*Thời gian chạy toàn bộ: ~0.17 giây, in đầy đủ nhật ký 8 bước.*

### Cách 2: Kiểm tra trực quan trên giao diện Web Inspector
Truy cập: [https://clsg-ir-studio.vercel.app/knowledge](https://clsg-ir-studio.vercel.app/knowledge)
- Chọn tệp: `Pose_Estimation.pptx`
- Xem xét toàn bộ 11 tab: Document Overview, Slide Inspector, Element Inspector, Visual Inspector (hiển thị 17 keypoints & 19 edges), Visual Overlay (vẽ bounding box thực), Raw vs Normalized, Relation Graph, Chunk Inspector, Database Records, Retrieval Tester, và Pipeline Debug.
