# -*- coding: utf-8 -*-
"""
==============================================================================
CLSG-IR END-TO-END PIPELINE RUNNER: POSE ESTIMATION (BÀI NÀY)
==============================================================================
Tệp pipeline chi tiết thực thi trọn vẹn từ đầu đến cuối cho bài giảng:
"Pose_Estimation.pptx" (Đặc biệt là Slide 8: "17 điểm có tên — và 19 đường nối")

Các giai đoạn thực thi:
  1. INPUT & INCEPTION: Tải presentation 8 slides và cấu hình sư phạm
  2. MODULE 1: MULTIMODAL EXTRACTION & VISUAL UNDERSTANDING
     - Bóc tách cấu trúc hình học 2D (Spatial Layout Partitioning)
     - Nhận diện vector diagram: Human Pose Skeleton (17 keypoints, 19 edges)
     - Tách độc lập nhãn số 0..16 thành diagram_annotation
     - Xây dựng DocumentIR (Source of Truth)
  3. KNOWLEDGE PERSISTENCE & EMBEDDING
     - Lưu trữ Document, Slides, Elements, Visuals, Relations, Chunks vào Database
     - Tạo embedding vector chuẩn hóa L2 1536 chiều
  4. MODULE 2: INSTRUCTIONAL BLUEPRINT PLANNING
     - Phân bổ ngân sách thời gian, WPM và mục tiêu học tập sư phạm
  5. MODULE 3: EXPRESSION GENERATION
     - 3A: Lời thoại giảng giải sư phạm (Narration)
     - 3B: Ký hiệu ngữ điệu và ngắt nghỉ (Prosody & SSML)
     - 3C: Chỉ dẫn thị giác chuẩn hóa (13 Visual Taxonomies)
  6. MODULE 4: QUALITY & VISUAL GUARD CERTIFICATION
     - Kiểm định DAR-P, DAR-S, đồng bộ Visual-Script, chống hallucination
  7. EXPORT ENGINE
     - Xuất các gói: CLSG JSON, Remotion Props, Manim Python code, SSML bundle
  8. RETRIEVAL VERIFICATION
     - Thử nghiệm truy vấn trực tiếp vào Persistent Knowledge Store
==============================================================================
"""

import os
import sys
import json
import time
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Đảm bảo đường dẫn root có trong sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.config import PipelineConfig, LearnerPersona, PresentationConfig
from app.modules.extractor.factory import extract_document
from app.database.knowledge_store import KnowledgeStore
from app.services.query_service import QueryService
from app.core.orchestrator import PipelineOrchestrator
from app.data.demo_dataset import generate_pose_estimation_presentation

def print_banner(title: str):
    print("\n" + "=" * 78)
    print(f"  {title.upper()}")
    print("=" * 78)

def print_step(step_num: int, title: str):
    print(f"\n[BƯỚC {step_num}] {title}")
    print("-" * 70)

def run_detailed_pose_pipeline():
    total_start = time.perf_counter()
    print_banner("KHỞI CHẠY PIPELINE CHI TIẾT: POSE ESTIMATION (HUMAN SKELETON)")

    # --------------------------------------------------------------------------
    # BƯỚC 1: INPUT & PEDAGOGICAL CONFIGURATION
    # --------------------------------------------------------------------------
    print_step(1, "Khởi tạo dữ liệu đầu vào & Cấu hình sư phạm")
    pptx_path = Path("app/data/Pose_Estimation.pptx")
    if not pptx_path.exists():
        print("  -> Tạo mới presentation Pose_Estimation.pptx (8 slides)...")
        generate_pose_estimation_presentation(str(pptx_path))
    else:
        print(f"  -> Đã tìm thấy tệp đầu vào: {pptx_path} ({pptx_path.stat().st_size} bytes)")

    pptx_bytes = pptx_path.read_bytes()

    config = PipelineConfig(
        learner=LearnerPersona(
            target_audience="undergraduate",
            prior_knowledge="Thị giác máy tính cơ bản, ma trận ảnh, tích chập",
            tone="academic"
        ),
        presentation=PresentationConfig(
            target_duration_sec=240,
            pacing="normal",
            baseline_wpm=135,
            visual_density="rich"
        )
    )
    print(f"  * Đối tượng học viên : {config.learner.target_audience}")
    print(f"  * Thời lượng mục tiêu: {config.presentation.target_duration_sec}s")
    print(f"  * Tốc độ nói chuẩn    : {config.presentation.baseline_wpm} WPM")

    # --------------------------------------------------------------------------
    # BƯỚC 2: MODULE 1 - BÓC TÁCH ĐA PHƯƠNG THỨC & NHẬN DIỆN THỊ GIÁC
    # --------------------------------------------------------------------------
    print_step(2, "Module 1: Multimodal Extraction & Visual Diagram Understanding")
    t0 = time.perf_counter()
    doc_tree = extract_document(pptx_bytes, "Pose_Estimation.pptx")
    t1 = time.perf_counter()

    doc_ir = doc_tree.document_ir
    print(f"  * Thời gian bóc tách : {round((t1 - t0) * 1000, 2)} ms (Zero-LLM/VLM)")
    print(f"  * Tổng số slide      : {doc_ir.total_slides if doc_ir else doc_tree.total_sections}")
    print(f"  * Tiêu đề tài liệu   : {doc_tree.title}")

    # Kiểm tra chuyên sâu Slide 8 (Tâm điểm bài toán)
    slide_8_ir = next((s for s in (doc_ir.slides if doc_ir else []) if s.slide_id == 8), None)
    if slide_8_ir:
        print("\n  --- KẾT QUẢ BÓC TÁCH CHI TIẾT TẠI SLIDE 8 ---")
        print(f"  * Tiêu đề Slide 8    : \"{slide_8_ir.title}\"")
        print(f"  * Tổng số elements   : {len(slide_8_ir.elements)}")

        # Phân loại element
        anno_elements = [e for e in slide_8_ir.elements if e.type == "annotation"]
        diag_elements = [e for e in slide_8_ir.elements if e.type == "diagram"]
        text_elements = [e for e in slide_8_ir.elements if e.type == "text"]

        print(f"  * Diagrams phát hiện : {len(diag_elements)} ({', '.join(d.subtype or '' for d in diag_elements)})")
        print(f"  * Annotations số     : {len(anno_elements)} nhãn tọa độ khớp (0 đến 16)")
        print(f"  * Văn bản giải thích : {len(text_elements)} đoạn")

        # Kiểm tra diagram structured graph
        if diag_elements and diag_elements[0].structured_diagram:
            diag = diag_elements[0].structured_diagram
            print(f"  * Đồ thị khung xương : {diag.node_count} nodes (keypoints), {diag.edge_count} edges (connections)")
            print(f"  * Bounding box       : {diag.bbox}")
            print(f"  * Độ tin cậy         : {diag.confidence}")

        # Kiểm tra văn bản bên phải có bị dính số không
        print("\n  --- NỘI DUNG VĂN BẢN GIẢI THÍCH (BẢO TOÀN DẢI SỐ) ---")
        for te in text_elements:
            print(f"    - [{te.role:10s}] {te.content}")

    # --------------------------------------------------------------------------
    # BƯỚC 3: PERSISTENT KNOWLEDGE STORAGE & EMBEDDING
    # --------------------------------------------------------------------------
    print_step(3, "Persistent Knowledge Storage & Hybrid Indexing")
    db_path = "app/data/clsg_knowledge.db"
    store = KnowledgeStore(db_path)
    query_service = QueryService(store)

    doc_id = store.persist_document_ir(doc_ir, owner_id="user_instructor_01", file_hash="hash_pose_pipeline")
    overview = store.get_document_overview(doc_id)
    stats = overview.get("stats", {})

    print(f"  * Lưu trữ vào DB     : {db_path}")
    print(f"  * Document ID        : {doc_id}")
    print(f"  * Entity Counts      :")
    print(f"      - Slides         : {stats.get('slides')}")
    print(f"      - Elements       : {stats.get('elements')}")
    print(f"      - Visuals        : {stats.get('visuals')}")
    print(f"      - Concepts       : {stats.get('concepts')}")
    print(f"      - Relations      : {stats.get('relations')}")
    print(f"      - Chunks         : {stats.get('chunks')}")
    print(f"      - Embeddings     : {stats.get('embeddings')} (1536 chiều)")

    # --------------------------------------------------------------------------
    # BƯỚC 4: MODULE 2 - INSTRUCTIONAL BLUEPRINT PLANNING
    # --------------------------------------------------------------------------
    print_step(4, "Module 2: Instructional Planner (Thiết Kế Bản Vẽ Sư Phạm)")
    orchestrator = PipelineOrchestrator()
    t0 = time.perf_counter()
    blueprint = orchestrator.planner.plan(doc_tree, config)
    t1 = time.perf_counter()

    print(f"  * Blueprint ID       : {blueprint.blueprint_id}")
    print(f"  * Thời gian lập kế hoạch: {round((t1 - t0) * 1000, 2)} ms")
    print(f"  * Tổng ngân sách từ  : {blueprint.total_word_budget} từ")
    print(f"  * Số section phân bổ : {len(blueprint.sections)}")

    # Hiển thị kế hoạch của section Slide 8
    sec_8 = next((s for s in blueprint.sections if "17 điểm" in s.title or s.section_id.endswith("_08")), blueprint.sections[-1])
    print(f"\n  --- KẾ HOẠCH SƯ PHẠM CHO SLIDE 8 ---")
    print(f"  * Section ID         : {sec_8.section_id}")
    print(f"  * Tiêu đề            : {sec_8.title}")
    print(f"  * Thời lượng dự kiến : {sec_8.target_duration_sec}s")
    print(f"  * Ngân sách từ       : {sec_8.target_word_budget} từ")
    print(f"  * Trọng tâm sư phạm  : {sec_8.instructional_goal}")

    # --------------------------------------------------------------------------
    # BƯỚC 5: MODULE 3 - EXPRESSION GENERATION (NARRATION + PROSODY + VISUAL)
    # --------------------------------------------------------------------------
    print_step(5, "Module 3: Expression Generator (Lời Thoại, Ngữ Điệu & Chỉ Dẫn Thị Giác)")
    t0 = time.perf_counter()
    draft = orchestrator.generator.generate_draft(blueprint, doc_tree, config)
    t1 = time.perf_counter()

    print(f"  * Draft ID           : {draft.draft_id}")
    print(f"  * Thời gian sinh lời : {round((t1 - t0) * 1000, 2)} ms")
    print(f"  * Tổng số cảnh (scene): {len(draft.scenes)}")
    print(f"  * Tổng số từ sinh ra : {draft.total_word_count} từ")
    print(f"  * Thời lượng ước tính: {draft.estimated_total_duration_sec}s")

    # Hiển thị chi tiết cảnh của Slide 8
    scene_8 = next((sc for sc in draft.scenes if "17 điểm" in sc.title or sc.section_id.endswith("_08")), draft.scenes[-1])
    print(f"\n  --- CHI TIẾT BIỂU ĐẠT CẢNH SLIDE 8 ---")
    print(f"  * Scene ID           : {scene_8.scene_id}")
    print(f"  * Narration (Lời nói): \"{scene_8.narration_text[:120]}...\"")
    print(f"  * Prosody Plan       : {len(scene_8.prosody_plan.sentences)} câu ({scene_8.prosody_plan.total_pause_sec}s ngắt nghỉ)")
    print(f"  * Visual Intent Cues : {len(scene_8.visual_cues)} chỉ dẫn thị giác")
    for vi in scene_8.visual_cues[:3]:
        print(f"      [{vi.trigger_timestamp_sec}s] {vi.action}: {vi.visual_description[:60]}...")

    # --------------------------------------------------------------------------
    # BƯỚC 6: MODULE 4 - QUALITY & VISUAL GUARD CERTIFICATION
    # --------------------------------------------------------------------------
    print_step(6, "Module 4: Quality & Visual Guard (Kiểm Định & Chứng Nhận Chất Lượng)")
    t0 = time.perf_counter()
    report, verified_ir = orchestrator.guard.validate_and_certify(draft, blueprint, doc_tree, config)
    t1 = time.perf_counter()

    print(f"  * Trạng thái chứng nhận: {report.overall_status.upper()}")
    print(f"  * Điểm chất lượng      : {report.overall_quality_score}/100")
    print(f"  * Sai số thời lượng (DAR-P): {report.duration_error_pct}% (Ngưỡng <= 10%)")
    print(f"  * Sửa lỗi tự động (Auto-Repairs): {len(report.auto_repairs_applied)} lần")
    print(f"  * Verified IR ID       : {verified_ir.ir_id}")

    # --------------------------------------------------------------------------
    # BƯỚC 7: EXPORT TARGETS (DOWNSTREAM READY)
    # --------------------------------------------------------------------------
    print_step(7, "Export Engine: Đóng Gói Định Dạng Đầu Ra")
    export_pkg = orchestrator.build_export_package(verified_ir)
    formats = export_pkg.formats
    print(f"  * Gói xuất xưởng CLSG-IR : {len(formats)} định dạng sẵn sàng")
    print(f"      1. clsg_json       : {len(json.dumps(formats['clsg_json']))} bytes")
    print(f"      2. remotion_props  : {len(json.dumps(formats['remotion_props']))} bytes")
    print(f"      3. ssml_bundle     : {len(json.dumps(formats['ssml_bundle']))} bytes")
    print(f"      4. manim_code      : {len(formats['manim_code'])} ký tự Python animation")

    # --------------------------------------------------------------------------
    # BƯỚC 8: HYBRID RETRIEVAL TESTING TRÊN DỮ LIỆU THẬT
    # --------------------------------------------------------------------------
    print_step(8, "Kiểm Thử Khả Năng Truy Vấn (Hybrid Retrieval Verification)")
    test_queries = [
        "human pose skeleton",
        "17 keypoints",
        "keypoint 0",
        "vai, khuỷu tay"
    ]
    for q in test_queries:
        res = store.hybrid_search(doc_id, "user_instructor_01", q, top_k=2)
        print(f"\n  [QUERY]: \"{q}\"")
        if res:
            top_hit = res[0]
            print(f"    -> Top Hit: {top_hit['chunk_id']} | Type: {top_hit['chunk_type']} | Score: {top_hit.get('similarity_score')}")
            print(f"    -> Nội dung: {top_hit['content'][:90]}...")
            if top_hit.get('visual_refs'):
                print(f"    -> Visual Ref: {top_hit['visual_refs']}")
        else:
            print("    -> Không tìm thấy kết quả phù hợp.")

    # --------------------------------------------------------------------------
    # TỔNG KẾT PIPELINE
    # --------------------------------------------------------------------------
    total_elapsed = time.perf_counter() - total_start
    print_banner(f"PIPELINE HOÀN THÀNH THÀNH CÔNG TRONG {round(total_elapsed, 2)} GIÂY")
    print(f"  * Tệp bài giảng : Pose_Estimation.pptx")
    print(f"  * Kết quả       : Verified CLSG-IR ID: {verified_ir.ir_id}")
    print(f"  * Kiểm tra UI   : Mở https://clsg-ir-studio.vercel.app/knowledge để kiểm định trực quan.")
    print("=" * 78 + "\n")

    return {
        "doc_id": doc_id,
        "verified_ir_id": verified_ir.ir_id,
        "quality_score": report.overall_quality_score,
        "total_elapsed_sec": round(total_elapsed, 2)
    }

if __name__ == "__main__":
    run_detailed_pose_pipeline()
