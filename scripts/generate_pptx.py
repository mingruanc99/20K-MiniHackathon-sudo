# -*- coding: utf-8 -*-
"""
CLSG-IR System Architecture & Pipeline — PPTX Presentation Generator
Based on: Bao_Cao_Phuong_Phap_De_Xuat_CLSG.docx
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# ── Paths ──
PROJ = r"C:\Users\stayhere_101\20K-MiniHackathon-sudo"
ASSETS = os.path.join(PROJ, "docs", "assets")
OUTPUT = os.path.join(PROJ, "docs", "reports", "CLSG_IR_Pipeline_Presentation.pptx")

# ── Colors ──
NAVY       = RGBColor(0x13, 0x4B, 0x88)
DARK_BLUE  = RGBColor(0x04, 0x4A, 0x97)
WHITE      = RGBColor(0xFF, 0xFF, 0xFF)
DARK_TEXT   = RGBColor(0x1B, 0x25, 0x59)
SOFT_TEXT   = RGBColor(0x4B, 0x55, 0x77)
RED_ACCENT  = RGBColor(0xBE, 0x1E, 0x2D)
GREEN       = RGBColor(0x05, 0x96, 0x69)
AMBER       = RGBColor(0xD9, 0x77, 0x06)
TEAL        = RGBColor(0x0D, 0x94, 0x88)
PURPLE      = RGBColor(0x7C, 0x3A, 0xED)
INDIGO      = RGBColor(0x4F, 0x46, 0xE5)
ROSE        = RGBColor(0xE1, 0x1D, 0x48)
FOIL        = RGBColor(0xE6, 0xD9, 0xA8)

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

prs = Presentation()
prs.slide_width = SLIDE_W
prs.slide_height = SLIDE_H
blank_layout = prs.slide_layouts[6]


# ── Helpers ──
def add_shape(slide, left, top, width, height, fill_color=None, border_color=None, border_width=Pt(0)):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.rotation = 0
    sf = shape.fill
    if fill_color:
        sf.solid()
        sf.fore_color.rgb = fill_color
    else:
        sf.background()
    ln = shape.line
    if border_color:
        ln.color.rgb = border_color
        ln.width = border_width
    else:
        ln.fill.background()
    shape.shadow.inherit = False
    return shape


def add_rect(slide, left, top, width, height, fill_color=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    shape.rotation = 0
    if fill_color:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill_color
    else:
        shape.fill.background()
    shape.line.fill.background()
    shape.shadow.inherit = False
    return shape


def add_text_box(slide, left, top, width, height, text, font_size=18,
                 bold=False, color=DARK_TEXT, alignment=PP_ALIGN.LEFT,
                 font_name="Segoe UI"):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    tf.margin_left = Pt(4)
    tf.margin_right = Pt(4)
    tf.margin_top = Pt(2)
    tf.margin_bottom = Pt(2)
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.font.name = font_name
    p.alignment = alignment
    return txBox


def add_rich_text_box(slide, left, top, width, height, lines, font_name="Segoe UI"):
    """lines: list of (text, font_size, bold, color, alignment)"""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    tf.margin_left = Pt(8)
    tf.margin_right = Pt(8)
    tf.margin_top = Pt(4)
    tf.margin_bottom = Pt(4)
    for i, (text, fs, bold, color, align) in enumerate(lines):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = text
        p.font.size = Pt(fs)
        p.font.bold = bold
        p.font.color.rgb = color
        p.font.name = font_name
        p.alignment = align
        p.space_after = Pt(4)
    return txBox


def add_image_safe(slide, path, left, top, width=None, height=None):
    if os.path.exists(path):
        kwargs = {"left": left, "top": top}
        if width: kwargs["width"] = width
        if height: kwargs["height"] = height
        slide.shapes.add_picture(path, **kwargs)
        return True
    return False


# ══════════════════════════════════════════════════════════════════════
# SLIDE 1: TITLE
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, SLIDE_H, DARK_BLUE)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.15), FOIL)

add_rich_text_box(slide, Inches(1.2), Inches(1.5), Inches(11), Inches(4.5), [
    ("CLSG-IR", 54, True, FOIL, PP_ALIGN.LEFT),
    ("Configurable Lecture Script &\nVisual Intent Generation", 36, True, WHITE, PP_ALIGN.LEFT),
    ("", 12, False, WHITE, PP_ALIGN.LEFT),
    ("Khung Biểu Diễn Trung Gian (Intermediate Representation)", 22, False, RGBColor(0xE3, 0xEB, 0xF5), PP_ALIGN.LEFT),
    ("Cầu Nối Giữa Tài Liệu Học Tập và Hệ Thống AI Video Generation", 22, False, RGBColor(0xE3, 0xEB, 0xF5), PP_ALIGN.LEFT),
    ("", 14, False, WHITE, PP_ALIGN.LEFT),
    ("Vai trò: Instructional Designer & Educational Content Architect", 16, False, FOIL, PP_ALIGN.LEFT),
    ("Đối sánh: EduCraft (CIKM 2025)", 16, False, FOIL, PP_ALIGN.LEFT),
])

add_rect(slide, Inches(0), Inches(7.0), SLIDE_W, Inches(0.5), RGBColor(0x0F, 0x36, 0x6E))
add_text_box(slide, Inches(1.2), Inches(7.05), Inches(11), Inches(0.4),
             "BÁO CÁO PHƯƠNG PHÁP & KIẾN TRÚC HỆ THỐNG  •  20K MiniHackathon 2026",
             font_size=13, color=FOIL, alignment=PP_ALIGN.LEFT)

# ══════════════════════════════════════════════════════════════════════
# SLIDE 2: PAIN POINT (Ai — Đang làm gì — Vướng đâu — Hậu quả)
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.1), DARK_BLUE)
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.7),
             "PAIN POINT — BÀI TOÁN THỰC TẾ", 32, True, WHITE)

# Card 1: AI (Ai?)
add_shape(slide, Inches(0.6), Inches(1.35), Inches(5.9), Inches(1.2),
          fill_color=RGBColor(0xEF, 0xF6, 0xFF), border_color=RGBColor(0x25, 0x63, 0xEB), border_width=Pt(1.5))
add_rect(slide, Inches(0.8), Inches(1.45), Inches(1.0), Inches(0.45), RGBColor(0x25, 0x63, 0xEB))
add_text_box(slide, Inches(0.8), Inches(1.47), Inches(1.0), Inches(0.4),
             "AI?", 16, True, WHITE, PP_ALIGN.CENTER)
add_text_box(slide, Inches(2.0), Inches(1.45), Inches(4.3), Inches(0.45),
             "Giảng viên, giáo viên & Instructional Designers", 16, True, RGBColor(0x1E, 0x3A, 0x8A))
add_text_box(slide, Inches(2.0), Inches(1.9), Inches(4.3), Inches(0.5),
             "Chuyên viên phát triển nội dung đào tạo tại các trường học và tổ chức EdTech.", 13, False, SOFT_TEXT)

# Card 2: ĐANG LÀM GÌ?
add_shape(slide, Inches(6.8), Inches(1.35), Inches(5.9), Inches(1.2),
          fill_color=RGBColor(0xF0, 0xFD, 0xFA), border_color=TEAL, border_width=Pt(1.5))
add_rect(slide, Inches(7.0), Inches(1.45), Inches(1.6), Inches(0.45), TEAL)
add_text_box(slide, Inches(7.0), Inches(1.47), Inches(1.6), Inches(0.4),
             "ĐANG LÀM?", 14, True, WHITE, PP_ALIGN.CENTER)
add_text_box(slide, Inches(8.8), Inches(1.45), Inches(3.7), Inches(0.95),
             "Chuyển đổi tài liệu học thuật, giáo trình và slide tĩnh (PDF, PPTX) thành video bài giảng trực quan, sinh động.",
             14, False, SOFT_TEXT)

# Card 3: VƯỚNG ĐÂU?
add_shape(slide, Inches(0.6), Inches(2.85), Inches(12.15), Inches(1.5),
          fill_color=RGBColor(0xFF, 0xFB, 0xEB), border_color=AMBER, border_width=Pt(2))
add_rect(slide, Inches(0.8), Inches(2.95), Inches(1.6), Inches(0.45), AMBER)
add_text_box(slide, Inches(0.8), Inches(2.97), Inches(1.6), Inches(0.4),
             "VƯỚNG ĐÂU?", 14, True, WHITE, PP_ALIGN.CENTER)
add_text_box(slide, Inches(2.6), Inches(2.95), Inches(9.9), Inches(1.3),
             "Quy trình sản xuất thủ công đòi hỏi quá nhiều khâu phân mảnh:\n"
             "① Viết lại kịch bản sư phạm  →  ② Vẽ/thiết kế đồ họa trực quan  →  ③ Thu âm & căn chỉnh nhịp độ timeline",
             15, False, DARK_TEXT)

# Card 4: HẬU QUẢ — Main impact box
add_shape(slide, Inches(0.6), Inches(4.6), Inches(12.15), Inches(2.7),
          fill_color=RGBColor(0xFE, 0xF2, 0xF2), border_color=RED_ACCENT, border_width=Pt(2))
add_rect(slide, Inches(0.8), Inches(4.7), Inches(1.6), Inches(0.45), RED_ACCENT)
add_text_box(slide, Inches(0.8), Inches(4.72), Inches(1.6), Inches(0.4),
             "HẬU QUẢ?", 14, True, WHITE, PP_ALIGN.CENTER)

add_rich_text_box(slide, Inches(2.6), Inches(4.65), Inches(9.9), Inches(2.55), [
    ("\u23F0  Mất 15–20 giờ lao động chỉ cho 10 phút video thành phẩm", 17, True, RED_ACCENT, PP_ALIGN.LEFT),
    ("Nguồn: NIU Center for Innovative Teaching and Learning", 11, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("", 6, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("\U0001F4B0  Chi phí: $100–$300 / bài giảng cơ bản (hàng nghìn USD nếu thuê agency)", 17, True, RED_ACCENT, PP_ALIGN.LEFT),
    ("Nguồn: Vidico — Educational Video Production Cost Report", 11, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("", 6, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("\U0001F6A7  Trở thành điểm nghẽn nghiêm trọng khiến các trường học và tổ chức EdTech", 16, True, DARK_TEXT, PP_ALIGN.LEFT),
    ("     không thể số hóa kho học liệu ở quy mô lớn.", 16, True, DARK_TEXT, PP_ALIGN.LEFT),
])
# ══════════════════════════════════════════════════════════════════════
# SLIDE 2: VẤN ĐỀ
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.1), DARK_BLUE)
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.7),
             "1.  VẤN ĐỀ & ĐỘNG LỰC NGHIÊN CỨU", 32, True, WHITE)

add_text_box(slide, Inches(0.8), Inches(1.4), Inches(11.5), Inches(0.8),
             "Các mô hình AI sinh video gặp 3 vấn đề chí mạng khi áp dụng vào giáo dục:",
             20, False, SOFT_TEXT)

problems = [
    ("\u274C  Lệch Nhịp Độ (Pacing Failure)",
     "Kịch bản nói có độ dài chênh lệch tùy tiện so với thời lượng video mong muốn. EduCraft trói cứng 1 slide = 1 đoạn script rời rạc, không thể co giãn theo thời lượng mục tiêu.",
     RED_ACCENT),
    ("\u274C  Ảo Giác Thị Giác (Visual Hallucination)",
     "AI sinh hoạt ảnh trang trí vô bổ thay vì sơ đồ trực quan có giá trị sư phạm. Không có metadata chỉ dẫn visual intent cho downstream video engine.",
     RED_ACCENT),
    ("\u274C  Giọng Đọc Đơn Điệu (Monotone Audio)",
     "TTS phát âm đều đều, thiếu khoảng dừng nhận thức (Cognitive Pauses), gây quá tải nhận thức (Cognitive Overload) cho người học.",
     RED_ACCENT),
]

for i, (title, desc, accent) in enumerate(problems):
    card_top = Inches(2.4) + Inches(i * 1.6)
    add_shape(slide, Inches(0.8), card_top, Inches(11.5), Inches(1.4),
              fill_color=RGBColor(0xFE, 0xF2, 0xF2), border_color=accent, border_width=Pt(1.5))
    add_text_box(slide, Inches(1.0), card_top + Inches(0.1), Inches(11), Inches(0.45),
                 title, 19, True, accent)
    add_text_box(slide, Inches(1.0), card_top + Inches(0.55), Inches(11), Inches(0.75),
                 desc, 15, False, SOFT_TEXT)


# ══════════════════════════════════════════════════════════════════════
# SLIDE 3: GIẢI PHÁP
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.1), DARK_BLUE)
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.7),
             "2.  GIẢI PHÁP: INTERMEDIATE REPRESENTATION (IR)", 30, True, WHITE)

add_shape(slide, Inches(0.8), Inches(1.35), Inches(11.5), Inches(1.2),
          fill_color=RGBColor(0xEF, 0xF6, 0xFF), border_color=NAVY, border_width=Pt(2))
add_rich_text_box(slide, Inches(1.0), Inches(1.45), Inches(11), Inches(1.0), [
    ("CLSG-IR = \u27E8 WHY, WHAT, HOW, WHAT TO SHOW \u27E9", 24, True, NAVY, PP_ALIGN.CENTER),
    ("Document + \u0398_user  \u2192  [Instructional Architect]  \u2192  Narration + Prosody + Visual Intent  \u2192  AI Video", 15, False, SOFT_TEXT, PP_ALIGN.CENTER),
])

principles = [
    ("Nguyên tắc 1:", "Nội dung và mục tiêu học tập (Learning Goals) là ưu tiên cao nhất."),
    ("Nguyên tắc 2:", "Chỉ đề xuất hình ảnh khi nó thực sự giúp người học hiểu bài tốt hơn."),
    ("Nguyên tắc 3:", "Tuyệt đối KHÔNG tạo hình ảnh chỉ nhằm mục đích trang trí hình thức."),
    ("Nguyên tắc 4:", "Mỗi visual cue phải trả lời: Học viên cần hiểu gì? Điểm nào khó hình dung?"),
    ("Nguyên tắc 5:", "Phân định ranh giới: KHÔNG sinh camera, góc quay, hiệu ứng chuyển cảnh."),
]

add_text_box(slide, Inches(0.8), Inches(2.8), Inches(11), Inches(0.45),
             "5 Nguyên tắc Sư phạm Bắt buộc:", 20, True, DARK_TEXT)

for i, (label, desc) in enumerate(principles):
    y = Inches(3.3) + Inches(i * 0.72)
    bg = RGBColor(0xEC, 0xFD, 0xF5) if i % 2 == 0 else WHITE
    add_shape(slide, Inches(0.8), y, Inches(11.5), Inches(0.62),
              fill_color=bg, border_color=GREEN, border_width=Pt(1))
    add_text_box(slide, Inches(1.0), y + Inches(0.08), Inches(1.8), Inches(0.5),
                 label, 15, True, GREEN)
    add_text_box(slide, Inches(2.8), y + Inches(0.08), Inches(9.3), Inches(0.5),
                 desc, 15, False, DARK_TEXT)


# ══════════════════════════════════════════════════════════════════════
# SLIDE 4: PIPELINE IMAGE
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.1), DARK_BLUE)
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.7),
             "3.  KIẾN TRÚC PIPELINE HOÀN CHỈNH", 32, True, WHITE)

add_image_safe(slide, os.path.join(ASSETS, "clsg_pipeline_main.jpg"),
               Inches(0.5), Inches(1.3), width=Inches(12.3))

add_text_box(slide, Inches(0.8), Inches(6.9), Inches(11.5), Inches(0.5),
             "Hình 1: Sơ đồ Pipeline tổng thể hệ thống CLSG-IR \u2014 4 Phase từ Input đến Verified IR",
             13, True, SOFT_TEXT, PP_ALIGN.CENTER)


# ══════════════════════════════════════════════════════════════════════
# SLIDE 5: MODULE 1 & 2
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.1), DARK_BLUE)
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.7),
             "4.  MODULE 1 & 2: TRÍCH XUẤT & LẬP KẾ HOẠCH", 30, True, WHITE)

# Module 1
add_shape(slide, Inches(0.6), Inches(1.35), Inches(5.9), Inches(5.7),
          fill_color=WHITE, border_color=RGBColor(0x25, 0x63, 0xEB), border_width=Pt(2))
add_rect(slide, Inches(0.6), Inches(1.35), Inches(5.9), Inches(0.7), RGBColor(0x1D, 0x4E, 0xD8))
add_text_box(slide, Inches(0.8), Inches(1.4), Inches(5.5), Inches(0.6),
             "MODULE 1: Content Extractor", 22, True, WHITE)

add_rich_text_box(slide, Inches(0.8), Inches(2.15), Inches(5.5), Inches(4.7), [
    ("Nguyên lý: Zero-LLM, Zero-VLM", 15, True, RGBColor(0x1E, 0x3A, 0x8A), PP_ALIGN.LEFT),
    ("(Thuần thuật toán, không dùng AI)", 13, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("", 8, False, DARK_TEXT, PP_ALIGN.LEFT),
    ("\u2022 PPTX: shapes, text_frame, tables, notes", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("\u2022 PDF: text blocks, tọa độ (x,y,w,h)", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("\u2022 DOCX: Heading 1\u20133, paragraphs", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("\u2022 Metadata Cleaner: Regex quét template rác", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("", 8, False, DARK_TEXT, PP_ALIGN.LEFT),
    ("\u26A1 Độ trễ: < 100ms  |  \U0001F4B0 Chi phí: $0", 15, True, GREEN, PP_ALIGN.LEFT),
    ("", 8, False, DARK_TEXT, PP_ALIGN.LEFT),
    ("OUTPUT: Canonical Document Tree", 15, True, RGBColor(0x1E, 0x3A, 0x8A), PP_ALIGN.LEFT),
    ("  \u251C\u2500\u2500 sections[]: section_id, title, raw_text", 13, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("  \u251C\u2500\u2500 visual_elements[]: image, chart, diagram", 13, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("  \u2514\u2500\u2500 table_elements[]: rows[][]", 13, False, SOFT_TEXT, PP_ALIGN.LEFT),
])

# Module 2
add_shape(slide, Inches(6.8), Inches(1.35), Inches(5.9), Inches(5.7),
          fill_color=WHITE, border_color=AMBER, border_width=Pt(2))
add_rect(slide, Inches(6.8), Inches(1.35), Inches(5.9), Inches(0.7), RGBColor(0xB4, 0x53, 0x09))
add_text_box(slide, Inches(7.0), Inches(1.4), Inches(5.5), Inches(0.6),
             "MODULE 2: Instructional Planner", 22, True, WHITE)

add_rich_text_box(slide, Inches(7.0), Inches(2.15), Inches(5.5), Inches(4.7), [
    ("Semantic Whole-Lesson Reasoning", 15, True, RGBColor(0x92, 0x40, 0x0E), PP_ALIGN.LEFT),
    ("", 8, False, DARK_TEXT, PP_ALIGN.LEFT),
    ("3 cuộc gọi LLM có cấu trúc:", 14, True, DARK_TEXT, PP_ALIGN.LEFT),
    ("  Call 1: Lesson Understanding (Big Picture)", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("  Call 2: Content Prioritization (Core vs Noise)", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("  Call 3: Teaching Arc Units (Bloom + Gagné)", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("", 8, False, DARK_TEXT, PP_ALIGN.LEFT),
    ("Công thức ngân sách số từ:", 14, True, DARK_TEXT, PP_ALIGN.LEFT),
    ("W_target = Duration \u00D7 (1 \u2212 \u03B1_pause) \u00D7 WPM/60", 15, True, AMBER, PP_ALIGN.CENTER),
    ("", 8, False, DARK_TEXT, PP_ALIGN.LEFT),
    ("Trọng số theo vai trò sư phạm:", 14, True, DARK_TEXT, PP_ALIGN.LEFT),
    ("  \u2022 CORE_CONCEPT: \u00D71.2 \u2013 1.4", 13, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("  \u2022 HOOK / EXAMPLE: \u00D71.0", 13, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("  \u2022 SUMMARY: \u00D70.8 \u2013 0.9", 13, False, SOFT_TEXT, PP_ALIGN.LEFT),
    ("", 6, False, DARK_TEXT, PP_ALIGN.LEFT),
    ("OUTPUT: Lesson Blueprint (JSON)", 15, True, RGBColor(0x92, 0x40, 0x0E), PP_ALIGN.LEFT),
])


# ══════════════════════════════════════════════════════════════════════
# SLIDE 6: MODULE 3
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.1), DARK_BLUE)
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.7),
             "5.  MODULE 3: EXPRESSION GENERATOR", 30, True, WHITE)

submodules = [
    {
        "title": "3A. Narration Generator",
        "subtitle": "WHAT TO SAY",
        "color": TEAL,
        "header_bg": RGBColor(0x0F, 0x76, 0x6E),
        "bg": RGBColor(0xF0, 0xFD, 0xFA),
        "lines": [
            ("\u2022 Lời giảng văn phong nói tự nhiên", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("\u2022 Bảo tồn thuật ngữ tiếng Anh", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("\u2022 Anti-Listicle (không liệt kê)", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("\u2022 Ẩn dụ sư phạm & liên kết suy luận", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("\u2022 Bám sát W_target nghiêm ngặt", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("", 8, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("OUTPUT: Spoken Narration Text", 14, True, TEAL, PP_ALIGN.LEFT),
        ]
    },
    {
        "title": "3B. Prosody Planner",
        "subtitle": "HOW TO DELIVER (Pre-TTS)",
        "color": ROSE,
        "header_bg": RGBColor(0xBE, 0x12, 0x3C),
        "bg": RGBColor(0xFF, 0xF1, 0xF2),
        "lines": [
            ("\u2022 Micro-pause: 150\u2013250ms", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("\u2022 Emphasis-pause: 300\u2013450ms", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("\u2022 Concept Boundary: 500\u2013700ms", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("\u2022 Section Transition: 800\u20131200ms", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("\u2022 Rate Modulation: slow/brisk", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("", 8, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("OUTPUT: Prosody Spec (W3C SSML)", 14, True, ROSE, PP_ALIGN.LEFT),
        ]
    },
    {
        "title": "3C. Visual Intent Generator",
        "subtitle": "WHAT TO SHOW & WHY",
        "color": INDIGO,
        "header_bg": RGBColor(0x43, 0x38, 0xCA),
        "bg": RGBColor(0xEE, 0xF2, 0xFF),
        "lines": [
            ("\u2022 13 Canonical Visual Taxonomies", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("\u2022 Visual Necessity Rule", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("\u2022 trigger_timestamp_sec đồng bộ", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("\u2022 visual_purpose + learning_support", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("\u2022 importance_level: high/med/low", 14, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("", 8, False, SOFT_TEXT, PP_ALIGN.LEFT),
            ("OUTPUT: Visual Intent Metadata", 14, True, INDIGO, PP_ALIGN.LEFT),
        ]
    },
]

for i, sm in enumerate(submodules):
    x = Inches(0.5) + Inches(i * 4.2)
    w = Inches(3.95)
    add_shape(slide, x, Inches(1.35), w, Inches(5.2),
              fill_color=sm["bg"], border_color=sm["color"], border_width=Pt(2))
    add_rect(slide, x, Inches(1.35), w, Inches(0.9), sm["header_bg"])
    add_text_box(slide, x + Inches(0.15), Inches(1.4), w - Inches(0.3), Inches(0.5),
                 sm["title"], 18, True, WHITE)
    add_text_box(slide, x + Inches(0.15), Inches(1.85), w - Inches(0.3), Inches(0.35),
                 sm["subtitle"], 13, True, RGBColor(0xE2, 0xE8, 0xF0))
    add_rich_text_box(slide, x + Inches(0.15), Inches(2.4), w - Inches(0.3), Inches(4.0), sm["lines"])

# Shared Context Bus
add_shape(slide, Inches(0.5), Inches(6.6), Inches(12.35), Inches(0.5),
          fill_color=RGBColor(0xFA, 0xF5, 0xFF), border_color=PURPLE, border_width=Pt(1.5))
add_text_box(slide, Inches(0.7), Inches(6.62), Inches(11.9), Inches(0.45),
             "SHARED INSTRUCTIONAL CONTEXT BUS  \u2014  Lesson Blueprint + Learning Goals + Rolling Memory",
             14, True, PURPLE, PP_ALIGN.CENTER)


# ══════════════════════════════════════════════════════════════════════
# SLIDE 7: MODULE 4
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.1), DARK_BLUE)
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.7),
             "6.  MODULE 4: QUALITY & VISUAL GUARD", 32, True, WHITE)

checks = [
    ("1", "DAR-P Pacing Check",
     "T_estimated = \u03A3(W_k / WPM_k) + \u03A3(Duration_ms / 1000)\nĐảm bảo |T_actual \u2212 T_target| / T_target \u2264 15%. Auto-Repair nếu lệch 5\u201325%.",
     RED_ACCENT, RGBColor(0xFE, 0xF2, 0xF2)),
    ("2", "Visual Taxonomy Check",
     "100% visual cues phải thuộc 13 taxonomy chuẩn: diagram, flowchart, comparison,\ninfographic, chart, table, screenshot, illustration, timeline, equation, ...",
     INDIGO, RGBColor(0xEE, 0xF2, 0xFF)),
    ("3", "Visual Necessity Guard",
     "Loại bỏ mọi visual mang tính trang trí. Đảm bảo mọi visual cue đều có lý do\ngiáo dục rõ ràng và bổ trợ trực tiếp cho learning_goal.",
     TEAL, RGBColor(0xF0, 0xFD, 0xFA)),
    ("4", "Metadata Leakage Audit",
     "Quét Regex khử sạch chuỗi rác aicb-*, placeholder, template sinh tự động\ncòn sót trong narration. Bảo vệ chất lượng đầu ra cuối cùng.",
     AMBER, RGBColor(0xFF, 0xFB, 0xEB)),
]

for i, (num, title, desc, accent, bg) in enumerate(checks):
    y = Inches(1.35) + Inches(i * 1.35)
    add_shape(slide, Inches(0.6), y, Inches(12.15), Inches(1.2),
              fill_color=bg, border_color=accent, border_width=Pt(1.5))
    add_rect(slide, Inches(0.8), y + Inches(0.15), Inches(0.55), Inches(0.55), accent)
    add_text_box(slide, Inches(0.8), y + Inches(0.18), Inches(0.55), Inches(0.5),
                 num, 22, True, WHITE, PP_ALIGN.CENTER)
    add_text_box(slide, Inches(1.5), y + Inches(0.08), Inches(5), Inches(0.4),
                 title, 18, True, accent)
    add_text_box(slide, Inches(1.5), y + Inches(0.48), Inches(11), Inches(0.65),
                 desc, 13, False, SOFT_TEXT)

# Decision
add_rect(slide, Inches(0.6), Inches(6.8), Inches(5.9), Inches(0.45), GREEN)
add_text_box(slide, Inches(0.8), Inches(6.82), Inches(5.5), Inches(0.4),
             "\u2713  PASS \u2192 Verified CLSG-IR (JSON)", 15, True, WHITE, PP_ALIGN.CENTER)
add_rect(slide, Inches(6.85), Inches(6.8), Inches(5.9), Inches(0.45), RED_ACCENT)
add_text_box(slide, Inches(7.05), Inches(6.82), Inches(5.5), Inches(0.4),
             "\u2717  FAIL \u2192 Revision Loop \u2190 Module 3", 15, True, WHITE, PP_ALIGN.CENTER)


# ══════════════════════════════════════════════════════════════════════
# SLIDE 8: BỘ TỨ SƯ PHẠM (Image)
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.1), DARK_BLUE)
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.7),
             "7.  BỘ TỨ SƯ PHẠM \u2014 4-PILLAR IR", 32, True, WHITE)

add_image_safe(slide, os.path.join(ASSETS, "clsg_ir_four_pillars.jpg"),
               Inches(0.5), Inches(1.3), width=Inches(12.3))

add_text_box(slide, Inches(0.8), Inches(6.9), Inches(11.5), Inches(0.5),
             "Hình 2: CLSG-IR = \u27E8 WHY (Learning Intent), WHAT (Narration), HOW (Prosody/SSML), SHOW (Visual Intent) \u27E9",
             13, True, SOFT_TEXT, PP_ALIGN.CENTER)


# ══════════════════════════════════════════════════════════════════════
# SLIDE 9: 13 VISUAL TAXONOMY
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.1), DARK_BLUE)
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.7),
             "8.  13 PHÂN LOẠI TRỰC QUAN SƯ PHẠM", 30, True, WHITE)

taxonomy = [
    ("diagram", "Cấu trúc, thành phần, mô hình tĩnh"),
    ("flowchart", "Chuỗi bước tuần tự, luồng logic rẽ nhánh"),
    ("comparison", "Đối chiếu song song ưu/nhược điểm"),
    ("infographic", "Tổng hợp tri thức đa chiều"),
    ("chart", "Dữ liệu định lượng, xu hướng biến thiên"),
    ("table", "Thông tin đa thuộc tính dạng ma trận"),
    ("screenshot", "Giao diện thực tế phần mềm / hệ thống"),
    ("illustration", "Ẩn dụ trực quan hóa ý niệm trừu tượng"),
    ("real_world_example", "Tình huống thực tế, vật thể đời thực"),
    ("timeline", "Diễn biến theo trục thời gian tuyến tính"),
    ("equation", "Công thức toán học, ký hiệu logic"),
    ("process_vis.", "Dòng chảy hoạt động hệ thống kỹ thuật"),
    ("concept_map", "Mạng lưới khái niệm & quan hệ ngữ nghĩa"),
]

colors_cycle = [
    RGBColor(0x25, 0x63, 0xEB), TEAL, AMBER, PURPLE, INDIGO,
    GREEN, RED_ACCENT, RGBColor(0x0D, 0x94, 0x88), RGBColor(0xD9, 0x77, 0x06),
    RGBColor(0x7C, 0x3A, 0xED), RGBColor(0x4F, 0x46, 0xE5), RGBColor(0x05, 0x96, 0x69), NAVY,
]
bg_cycle = [
    RGBColor(0xEF, 0xF6, 0xFF), RGBColor(0xF0, 0xFD, 0xFA), RGBColor(0xFF, 0xFB, 0xEB),
    RGBColor(0xFA, 0xF5, 0xFF), RGBColor(0xEE, 0xF2, 0xFF), RGBColor(0xEC, 0xFD, 0xF5),
    RGBColor(0xFE, 0xF2, 0xF2), RGBColor(0xF0, 0xFD, 0xFA), RGBColor(0xFF, 0xFB, 0xEB),
    RGBColor(0xFA, 0xF5, 0xFF), RGBColor(0xEE, 0xF2, 0xFF), RGBColor(0xEC, 0xFD, 0xF5),
    RGBColor(0xEF, 0xF6, 0xFF),
]

for i, (vtype, purpose) in enumerate(taxonomy):
    col = i % 3
    row = i // 3
    x = Inches(0.5) + Inches(col * 4.2)
    y = Inches(1.35) + Inches(row * 1.15)
    w = Inches(3.95)
    h = Inches(1.0)

    add_shape(slide, x, y, w, h, fill_color=bg_cycle[i], border_color=colors_cycle[i], border_width=Pt(1.5))
    add_text_box(slide, x + Inches(0.1), y + Inches(0.05), Inches(0.45), Inches(0.35),
                 f"{i+1:2d}.", 14, True, colors_cycle[i])
    add_text_box(slide, x + Inches(0.5), y + Inches(0.05), w - Inches(0.6), Inches(0.35),
                 vtype, 15, True, colors_cycle[i])
    add_text_box(slide, x + Inches(0.5), y + Inches(0.42), w - Inches(0.6), Inches(0.5),
                 purpose, 12, False, SOFT_TEXT)


# ══════════════════════════════════════════════════════════════════════
# SLIDE 10: SO SÁNH vs EDUCRAFT
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.1), DARK_BLUE)
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.7),
             "9.  CLSG-IR vs EduCraft (CIKM 2025)", 30, True, WHITE)

add_image_safe(slide, os.path.join(ASSETS, "clsg_vs_educraft.jpg"),
               Inches(0.5), Inches(1.3), width=Inches(12.3))

add_text_box(slide, Inches(0.8), Inches(6.9), Inches(11.5), Inches(0.5),
             "Hình 3: Bảng đối sánh 6 tiêu chí \u2014 CLSG-IR giải quyết triệt để các hạn chế của EduCraft",
             13, True, SOFT_TEXT, PP_ALIGN.CENTER)


# ══════════════════════════════════════════════════════════════════════
# SLIDE 11: EVALUATION METRICS
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.1), DARK_BLUE)
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.7),
             "10.  HỆ THỐNG ĐÁNH GIÁ THỰC NGHIỆM", 30, True, WHITE)

metrics = [
    ("VNS", "Visual Necessity Score",
     "Chuyên gia giáo dục hoặc Critic LLM đánh giá tỷ lệ visual cues thực sự giải tỏa điểm nghẽn nhận thức, không trang trí vô bổ.",
     TEAL, RGBColor(0xF0, 0xFD, 0xFA)),
    ("TCR", "Taxonomy Compliance Rate",
     "Tỷ lệ 100% các visual_type được gán đúng theo 13 loại trong Taxonomy quy định. Mọi visual cue thuộc đúng phân loại chuẩn.",
     INDIGO, RGBColor(0xEE, 0xF2, 0xFF)),
    ("R\u2090\u2097\u2097\u2099", "Narration\u2013Visual Alignment",
     "Độ khớp ngữ nghĩa giữa content_focus trong visual cue với đoạn narration đang phát biểu. Visual đúng thời điểm, đúng nội dung.",
     PURPLE, RGBColor(0xFA, 0xF5, 0xFF)),
    ("DAR", "Duration Adherence Rate",
     "DAR = 1 \u2212 |W_actual \u2212 W_target| / W_target. Thời lượng lời giảng tuân thủ \u2264 15% sai lệch, bao gồm cả thời gian khoảng dừng SSML.",
     RED_ACCENT, RGBColor(0xFE, 0xF2, 0xF2)),
]

for i, (abbr, name, desc, accent, bg) in enumerate(metrics):
    y = Inches(1.35) + Inches(i * 1.45)
    add_shape(slide, Inches(0.6), y, Inches(12.15), Inches(1.3),
              fill_color=bg, border_color=accent, border_width=Pt(1.5))
    add_rect(slide, Inches(0.8), y + Inches(0.2), Inches(1.1), Inches(0.5), accent)
    add_text_box(slide, Inches(0.8), y + Inches(0.22), Inches(1.1), Inches(0.45),
                 abbr, 16, True, WHITE, PP_ALIGN.CENTER)
    add_text_box(slide, Inches(2.1), y + Inches(0.1), Inches(10.4), Inches(0.4),
                 name, 18, True, accent)
    add_text_box(slide, Inches(2.1), y + Inches(0.5), Inches(10.4), Inches(0.75),
                 desc, 14, False, SOFT_TEXT)


# ══════════════════════════════════════════════════════════════════════
# SLIDE 12: TECHNICAL ARCHITECTURE
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(1.1), DARK_BLUE)
add_text_box(slide, Inches(0.8), Inches(0.2), Inches(11), Inches(0.7),
             "11.  SƠ ĐỒ KỸ THUẬT CHI TIẾT", 32, True, WHITE)

add_image_safe(slide, os.path.join(ASSETS, "clsg_pipeline_architecture.png"),
               Inches(0.3), Inches(1.3), width=Inches(12.7))

add_text_box(slide, Inches(0.8), Inches(6.9), Inches(11.5), Inches(0.5),
             "Hình 4: Sơ đồ kỹ thuật chi tiết 32\u00D718 inch @ 300 DPI (scripts/draw_pipeline.py)",
             13, True, SOFT_TEXT, PP_ALIGN.CENTER)


# ══════════════════════════════════════════════════════════════════════
# SLIDE 13: KẾT LUẬN
# ══════════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(blank_layout)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, SLIDE_H, DARK_BLUE)
add_rect(slide, Inches(0), Inches(0), SLIDE_W, Inches(0.15), FOIL)

add_rich_text_box(slide, Inches(1.2), Inches(1.0), Inches(11), Inches(6), [
    ("KẾT LUẬN", 42, True, FOIL, PP_ALIGN.LEFT),
    ("", 16, False, WHITE, PP_ALIGN.LEFT),
    ("CLSG-IR tái định hình bài toán Lecture Script Generation", 24, True, WHITE, PP_ALIGN.LEFT),
    ("thành bài toán thiết kế Intermediate Representation cho Video AI.", 24, True, WHITE, PP_ALIGN.LEFT),
    ("", 16, False, WHITE, PP_ALIGN.LEFT),
    ("\u2713  Zero-VLM Content Extraction \u2014 Chi phí $0, độ trễ < 100ms", 20, False, RGBColor(0xE3, 0xEB, 0xF5), PP_ALIGN.LEFT),
    ("\u2713  4-Pillar IR: WHY + WHAT + HOW + WHAT TO SHOW", 20, False, RGBColor(0xE3, 0xEB, 0xF5), PP_ALIGN.LEFT),
    ("\u2713  Pre-TTS Prosody Planning với 4 loại khoảng dừng nhận thức (W3C SSML)", 20, False, RGBColor(0xE3, 0xEB, 0xF5), PP_ALIGN.LEFT),
    ("\u2713  13 Visual Taxonomies \u2014 Triệt tiêu hoàn toàn visual trang trí", 20, False, RGBColor(0xE3, 0xEB, 0xF5), PP_ALIGN.LEFT),
    ("\u2713  Quality Guard: DAR-P \u2264 15% \u2014 Vòng lặp sửa lỗi tự động", 20, False, RGBColor(0xE3, 0xEB, 0xF5), PP_ALIGN.LEFT),
    ("\u2713  Cầu nối trực tiếp tới Sora, Runway, Midjourney, ElevenLabs", 20, False, RGBColor(0xE3, 0xEB, 0xF5), PP_ALIGN.LEFT),
    ("", 20, False, WHITE, PP_ALIGN.LEFT),
    ("Sẵn sàng công bố: AIED, EDM, CIKM, EMNLP, ACM Multimedia", 18, True, FOIL, PP_ALIGN.LEFT),
])

add_rect(slide, Inches(0), Inches(7.0), SLIDE_W, Inches(0.5), RGBColor(0x0F, 0x36, 0x6E))
add_text_box(slide, Inches(1.2), Inches(7.05), Inches(11), Inches(0.4),
             "CLSG-IR  \u2022  Configurable Lecture Script & Visual Intent Generation  \u2022  2026",
             13, True, FOIL, PP_ALIGN.LEFT)


# ══════════════════════════════════════════════════════════════════════
# SAVE
# ══════════════════════════════════════════════════════════════════════
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
prs.save(OUTPUT)
print(f"Presentation saved: {OUTPUT}")
print(f"Total slides: {len(prs.slides)}")
