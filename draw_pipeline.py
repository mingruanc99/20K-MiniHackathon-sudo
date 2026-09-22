# -*- coding: utf-8 -*-
"""
CLSG-IR TECHNICAL PIPELINE & SYSTEM ARCHITECTURE DIAGRAM
Senior Software Architect & Information Designer Implementation
High-Resolution (32x18 @ 300 DPI), Strict Orthogonal Routing, Zero-Crossing Architecture
"""
import matplotlib.pyplot as plt
import matplotlib.patches as patches

def generate_architecture_diagram():
    # 1. Canvas Setup: 32 x 18 inches at 300 DPI for presentation / paper poster scale
    fig, ax = plt.subplots(figsize=(32, 18), dpi=300)
    fig.patch.set_facecolor('#F8FAFC')  # Clean Slate 50 background
    ax.set_facecolor('#F8FAFC')
    ax.set_xlim(0, 32)
    ax.set_ylim(0, 18)
    ax.axis('off')

    # 2. Design System Color Palette (Enterprise / Research Grade)
    c_blue_border = '#2563EB'
    c_blue_header = '#1D4ED8'
    c_blue_light  = '#EFF6FF'
    
    c_amber_border = '#D97706'
    c_amber_header = '#B45309'
    c_amber_light  = '#FFFBEB'
    
    c_purple_border = '#7C3AED'
    c_purple_header = '#6D28D9'
    c_purple_light  = '#FAF5FF'
    
    s3a_border = '#0D9488'  # Teal for Narration
    s3a_header = '#0F766E'
    s3a_light  = '#F0FDFA'
    
    s3b_border = '#E11D48'  # Rose/Pink for Prosody
    s3b_header = '#BE123C'
    s3b_light  = '#FFF1F2'
    
    s3c_border = '#4F46E5'  # Indigo for Visual Intent
    s3c_header = '#4338CA'
    s3c_light  = '#EEF2FF'
    
    c_red_border = '#DC2626'
    c_red_header = '#B91C1C'
    c_red_light  = '#FEF2F2'
    
    c_green_border = '#059669'
    c_green_header = '#047857'
    c_green_light  = '#ECFDF5'

    # Helper: Draw Card with Header Banner
    def draw_card(x, y, w, h, bg_col, border_col, header_col, title, subtitle=None, corner=0.08, z=2):
        card = patches.FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad={corner}",
                                      ec=border_col, fc=bg_col, lw=1.8, zorder=z)
        ax.add_patch(card)
        hh = 0.72 if subtitle else 0.54
        header = patches.FancyBboxPatch((x, y + h - hh), w, hh, boxstyle=f"round,pad={corner}",
                                        ec=header_col, fc=header_col, lw=1.2, zorder=z+1)
        ax.add_patch(header)
        
        if subtitle:
            ax.text(x + w/2, y + h - 0.26, title, ha='center', va='center',
                    fontsize=10.5, fontweight='bold', color='#FFFFFF', fontfamily='sans-serif', zorder=z+2)
            ax.text(x + w/2, y + h - 0.52, subtitle, ha='center', va='center',
                    fontsize=8.2, fontstyle='italic', color='#E2E8F0', fontfamily='sans-serif', zorder=z+2)
        else:
            ax.text(x + w/2, y + h - hh/2, title, ha='center', va='center',
                    fontsize=10.5, fontweight='bold', color='#FFFFFF', fontfamily='sans-serif', zorder=z+2)

    # Helper: Draw Artifact Card
    def draw_artifact(x, y, w, h, title, items, badge="ARTIFACT", corner=0.06, z=3):
        box = patches.FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad={corner}",
                                     ec='#64748B', fc='#FFFFFF', lw=1.5, zorder=z)
        ax.add_patch(box)
        # Top banner micro badge with dynamic width
        badge_w = max(1.1, len(badge) * 0.095 + 0.2)
        badge_box = patches.FancyBboxPatch((x + 0.15, y + h - 0.32), badge_w, 0.22, boxstyle="round,pad=0.03",
                                           ec='#475569', fc='#F1F5F9', lw=1.0, zorder=z+1)
        ax.add_patch(badge_box)
        ax.text(x + 0.15 + badge_w/2, y + h - 0.21, badge, ha='center', va='center',
                fontsize=6.8, fontweight='bold', color='#334155', fontfamily='sans-serif', zorder=z+2)
        
        # Artifact Title (guaranteed clearance after badge)
        ax.text(x + 0.15 + badge_w + 0.18, y + h - 0.21, title, ha='left', va='center',
                fontsize=8.8, fontweight='bold', color='#0F172A', fontfamily='sans-serif', zorder=z+2)
        
        # Artifact lines
        sy = y + h - 0.54
        for i, item in enumerate(items):
            ax.text(x + 0.18, sy - i * 0.27, item, ha='left', va='top',
                    fontsize=7.8, color='#334155', fontfamily='sans-serif', zorder=z+2)

    # Helper: Orthogonal Arrow
    def draw_ortho_arrow(points, color='#475569', lw=1.8, ls='-', label="", label_pos=(0, 0), z=5):
        for i in range(len(points) - 1):
            p1 = points[i]
            p2 = points[i+1]
            is_last = (i == len(points) - 2)
            if is_last:
                arrow = patches.FancyArrowPatch(p1, p2, color=color, lw=lw, linestyle=ls,
                                                arrowstyle="Simple,tail_width=1.4,head_width=6.0,head_length=8.0",
                                                zorder=z)
                ax.add_patch(arrow)
            else:
                line = patches.ConnectionPatch(p1, p2, coordsA="data", coordsB="data",
                                               color=color, lw=lw, linestyle=ls, zorder=z)
                ax.add_patch(line)
        if label:
            lx, ly = label_pos
            ax.text(lx, ly, label, ha='center', va='center', fontsize=8.0, fontweight='bold',
                    color=color, backgroundcolor='#F8FAFC', zorder=z+2)

    # =========================================================================
    # 3. TOP BANNER & TITLE
    # =========================================================================
    ax.text(16.0, 17.45, "CLSG-IR: CONFIGURABLE LECTURE SCRIPT & VISUAL INTENT REPRESENTATION",
            ha='center', va='center', fontsize=18, fontweight='bold', color='#0F172A', fontfamily='sans-serif')
    ax.text(16.0, 17.08, "Intermediate Representation for AI Video Generation  •  Pedagogical Multi-Stage Reasoning Architecture",
            ha='center', va='center', fontsize=11.5, fontweight='bold', color='#2563EB', fontfamily='sans-serif')
    ax.text(16.0, 16.72, '“Không chỉ tạo kịch bản, mà còn mô tả cách dạy, cách nói và cách thể hiện trực quan.”',
            ha='center', va='center', fontsize=10.0, fontstyle='italic', color='#64748B', fontfamily='sans-serif')

    # =========================================================================
    # 4. STAGE 1: DEDICATED INPUT BLOCK (x: 0.7 to 4.2, width: 3.5)
    # =========================================================================
    in_box = patches.FancyBboxPatch((0.7, 3.4), 3.5, 12.8, boxstyle="round,pad=0.08",
                                   ec='#475569', fc='#F1F5F9', lw=1.8, zorder=1)
    ax.add_patch(in_box)
    in_header = patches.FancyBboxPatch((0.7, 15.48), 3.5, 0.72, boxstyle="round,pad=0.08",
                                       ec='#334155', fc='#334155', lw=1.2, zorder=2)
    ax.add_patch(in_header)
    ax.text(2.45, 15.95, "INPUT STAGE", ha='center', va='center',
            fontsize=11, fontweight='bold', color='#FFFFFF', zorder=3)
    ax.text(2.45, 15.68, "Raw Material + Control Parameters", ha='center', va='center',
            fontsize=8.2, fontstyle='italic', color='#CBD5E1', zorder=3)

    # Sub-block A: Learning Material (Raw Content)
    draw_card(0.85, 9.8, 3.2, 5.4, '#FFFFFF', c_blue_border, c_blue_header, 
              "A. LEARNING MATERIAL", "Raw Educational Content", corner=0.06, z=3)
    mat_lines = [
        "Nguồn tài liệu đầu vào:",
        "• PPTX: Slides, Ghi chú, Bố cục",
        "• PDF: Tài liệu, Giáo trình chuẩn",
        "• DOCX: Giáo án phân cấp H1-H3",
        "• Markdown: Bảng biểu, Mã nguồn",
        "",
        "Đặc trưng bóc tách:",
        "➜ Cấu trúc văn bản phân cấp",
        "➜ Danh sách gạch đầu dòng",
        "➜ Bảng số liệu & Thực thể tĩnh",
        "",
        "Mục đích: Cung cấp tri thức thô"
    ]
    for i, line in enumerate(mat_lines):
        ax.text(1.02, 14.3 - i * 0.29, line, ha='left', va='top', fontsize=8.2,
                color='#1E293B' if not line.startswith("•") else '#475569',
                fontweight='bold' if line.startswith("Nguồn") or line.startswith("Đặc") or line.startswith("Mục") else 'normal',
                zorder=4)

    # Sub-block B: User Configuration (Control Parameters)
    draw_card(0.85, 3.6, 3.2, 5.8, '#FFFFFF', c_purple_border, c_purple_header,
              "B. USER CONFIGURATION", "Control Hyperparameters Θ", corner=0.06, z=3)
    cfg_lines = [
        "Tham số điều khiển sư phạm:",
        "• Audience: K-12 / Univ / Corporate",
        "• Duration: 3 / 5 / 10 / 15 / 30 min",
        "• Teaching Style: Intuitive / Academic",
        "• Detail Level: Core / In-depth",
        "• Interaction: Q&A / Reflection",
        "• Example Type: Real-world / Tech",
        "• Language: Vietnamese / English",
        "",
        "Mục đích: Thiết lập mục tiêu,",
        "đối tượng và ngân sách thời lượng"
    ]
    for i, line in enumerate(cfg_lines):
        ax.text(1.02, 8.5 - i * 0.28, line, ha='left', va='top', fontsize=8.2,
                color='#1E293B' if not line.startswith("•") else '#475569',
                fontweight='bold' if line.startswith("Tham") or line.startswith("Mục") else 'normal',
                zorder=4)

    # =========================================================================
    # 5. STAGE 2: MODULE 1 & CANONICAL ARTIFACT (x: 4.8 to 8.4, w: 3.6)
    # =========================================================================
    draw_card(4.8, 8.8, 3.6, 6.8, '#FFFFFF', c_blue_border, c_blue_header,
              "MODULE 1: CONTENT EXTRACTOR", "“What is in the material?”", z=3)
    m1_lines = [
        "INPUT:",
        "• PPTX / PDF / DOCX / Markdown",
        "",
        "PROCESS:",
        "• Parse document structural hierarchy",
        "• Extract title, headings, paragraphs",
        "• Detect tables, formulas & lists",
        "• Clean, normalize & preserve order",
        "",
        "TECHNICAL APPROACH:",
        "• Rule-based Content Extractor",
        "• Zero-LLM & Zero-VLM (Không tốn GPU)",
        "• Tốc độ: < 50ms | Chi phí: $0",
        "",
        "OUTPUT: Canonical Document Tree"
    ]
    for i, line in enumerate(m1_lines):
        ax.text(4.98, 14.7 - i * 0.29, line, ha='left', va='top', fontsize=8.0,
                color='#1E3A8A' if line.isupper() or line.startswith("OUTPUT") else '#334155',
                fontweight='bold' if line.isupper() or line.startswith("OUTPUT") or line.startswith("• Rule") else 'normal',
                zorder=4)

    # Intermediate Artifact 1: Canonical Document Tree (Below Module 1)
    draw_artifact(4.8, 5.2, 3.6, 2.8, "Canonical Doc Tree",
                  [
                      "• Hierarchical Tree representation",
                      "• Document ➜ Section ➜ Subsection",
                      "• Headings / Paragraphs / Tables",
                      "• Clean text tokens & structural order",
                      "• Zero hallucinations (Trích xuất thuần)",
                      "➜ Đầu ra cấu trúc chuẩn hóa cho M2"
                  ], badge="ARTIFACT 1", z=3)

    # =========================================================================
    # 6. STAGE 3: MODULE 2 & LESSON BLUEPRINT (x: 9.1 to 12.7, w: 3.6)
    # =========================================================================
    draw_card(9.1, 8.8, 3.6, 6.8, '#FFFFFF', c_amber_border, c_amber_header,
              "MODULE 2: INSTRUCTIONAL PLANNER", "“How should the material be taught?”", z=3)
    m2_lines = [
        "INPUT:",
        "• Canonical Document Tree + User Config",
        "",
        "PROCESS:",
        "• Cognitive Load & Content Analysis",
        "• Bloom's Taxonomy: Assign Learning Goals",
        "• Gagné's 9 Events: Pedagogical sequencing",
        "• Determine section priorities & pacing",
        "• Calculate word budgets per section",
        "",
        "PACING BUDGET FORMULA:",
        "",  # Reserve space for formula box
        "",
        "OUTPUT: Lesson Blueprint (JSON)",
        "➜ Bản thiết kế sư phạm sẵn sàng cấp cho M3"
    ]
    for i, line in enumerate(m2_lines):
        if line:  # Only draw non-empty lines
            ax.text(9.28, 14.7 - i * 0.29, line, ha='left', va='top', fontsize=8.0,
                    color='#92400E' if line.isupper() or line.startswith("OUTPUT") or line.startswith("➜") else '#334155',
                    fontweight='bold' if line.isupper() or line.startswith("OUTPUT") or line.startswith("➜") else 'normal',
                    zorder=4)

    # Formula Box Highlight inside Module 2 (Positioned cleanly inside reserved lines)
    f_box = patches.FancyBboxPatch((9.28, 11.1), 3.24, 0.52, boxstyle="round,pad=0.04",
                                   ec='#F59E0B', fc='#FFFBEB', lw=1.2, zorder=4)
    ax.add_patch(f_box)
    ax.text(10.9, 11.36, "W_target = Duration (min) × 140 WPM", ha='center', va='center',
            fontsize=8.5, fontweight='bold', color='#B45309', zorder=5)

    # Intermediate Artifact 2: Lesson Blueprint (Below Module 2)
    draw_artifact(9.1, 5.2, 3.6, 2.8, "Lesson Blueprint",
                  [
                      "• Learning Objectives (Bloom levels)",
                      "• Section sequence & pedagogical role",
                      "• Target duration & Word budgets",
                      "• Cognitive pacing constraints",
                      "• Prerequisite & transition cues",
                      "➜ Bản thiết kế kế hoạch dạy cho M3"
                  ], badge="ARTIFACT 2", z=3)

    # =========================================================================
    # 7. STAGE 4: MODULE 3 — INSTRUCTIONAL EXPRESSION GENERATOR (x: 13.5 to 23.1, w: 9.6)
    # [LARGEST MODULE ON DIAGRAM: Outer Purple Container + 3 Submodules]
    # =========================================================================
    m3_box = patches.FancyBboxPatch((13.5, 4.4), 9.6, 11.8, boxstyle="round,pad=0.08",
                                    ec=c_purple_border, fc=c_purple_light, lw=2.0, zorder=2)
    ax.add_patch(m3_box)
    m3_header = patches.FancyBboxPatch((13.5, 15.4), 9.6, 0.8, boxstyle="round,pad=0.08",
                                       ec=c_purple_header, fc=c_purple_header, lw=1.2, zorder=3)
    ax.add_patch(m3_header)
    ax.text(18.3, 15.95, "MODULE 3: INSTRUCTIONAL EXPRESSION GENERATOR (CENTRAL IR ENGINE)",
            ha='center', va='center', fontsize=11.5, fontweight='bold', color='#FFFFFF', zorder=4)
    ax.text(18.3, 15.62, "“What should be said, how should it be delivered, and what should be shown?”",
            ha='center', va='center', fontsize=8.5, fontstyle='italic', color='#E9D5FF', zorder=4)

    # Internal Shared Context Bus
    bus_box = patches.FancyBboxPatch((13.8, 14.35), 9.0, 0.72, boxstyle="round,pad=0.05",
                                     ec='#A855F7', fc='#FFFFFF', lw=1.4, zorder=3)
    ax.add_patch(bus_box)
    ax.text(18.3, 14.71, "SHARED INSTRUCTIONAL CONTEXT BUS (Lesson Blueprint + Learning Goals + Rolling Memory)",
            ha='center', va='center', fontsize=8.5, fontweight='bold', color='#6D28D9', zorder=4)

    # Submodule 3a: NARRATION GENERATOR (Teal)
    draw_card(13.8, 6.4, 2.85, 7.5, '#FFFFFF', s3a_border, s3a_header,
              "3a. NARRATION GENERATOR", "WHAT TO SAY", z=4)
    s3a_lines = [
        "INPUT:",
        "• Lesson Blueprint & Goals",
        "• Canonical Content Nodes",
        "",
        "PROCESS:",
        "• Spoken-style dialogue gen",
        "• Sư phạm trực cảm (Analogies)",
        "• Không đọc lại slide thô",
        "• Tuân thủ WPM ngân sách",
        "• Sentence segmentation",
        "",
        "OUTPUT:",
        "Spoken Narration Text",
        "",
        "Ví dụ: 'Để hiểu Backprop,",
        "hãy tưởng tượng bạn đang",
        "tinh chỉnh volume radio...'"
    ]
    for i, line in enumerate(s3a_lines):
        ax.text(13.98, 13.1 - i * 0.26, line, ha='left', va='top', fontsize=7.6,
                color='#0F766E' if line.isupper() or line.startswith("OUTPUT") else '#334155',
                fontweight='bold' if line.isupper() or line.startswith("OUTPUT") or line.startswith("• Spoken") else 'normal',
                zorder=5)

    # Submodule 3b: PROSODY & PAUSE PLANNER (Rose/Pink - PRE-TTS LAYER)
    draw_card(16.88, 6.4, 2.85, 7.5, '#FFFFFF', s3b_border, s3b_header,
              "3b. PROSODY & PAUSE PLANNER", "HOW TO SAY IT (PRE-TTS)", z=4)
    s3b_lines = [
        "INPUT:",
        "• Spoken Narration + Goals",
        "• Cognitive Load Anchors",
        "",
        "PROCESS:",
        "• Cognitive Pause: 800-1500ms",
        "  (Hợp nhất sau điểm nghẽn)",
        "• Visual Sync Pause: 1-2s",
        "  (Đồng bộ mắt khi đổi hình)",
        "• Dramatic Pause: 500-1000ms",
        "• Rate Modulation: slow/fast",
        "• Emphasis & Tone selection",
        "",
        "OUTPUT: Prosody Spec (SSML)",
        "",
        "➜ Tiền xử lý Sư phạm âm thanh",
        "(KHÔNG phải audio filter)"
    ]
    for i, line in enumerate(s3b_lines):
        ax.text(17.06, 13.1 - i * 0.26, line, ha='left', va='top', fontsize=7.6,
                color='#BE123C' if line.isupper() or line.startswith("OUTPUT") or "➜" in line else '#334155',
                fontweight='bold' if line.isupper() or line.startswith("OUTPUT") or line.startswith("• Cogn") or "➜" in line else 'normal',
                zorder=5)

    # Submodule 3c: VISUAL INTENT GENERATOR (Indigo)
    draw_card(19.95, 6.4, 2.85, 7.5, '#FFFFFF', s3c_border, s3c_header,
              "3c. VISUAL INTENT GENERATOR", "WHAT TO SHOW & WHY", z=4)
    s3c_lines = [
        "INPUT:",
        "• Spoken Narration + Blueprint",
        "• 13 Pedagogical Taxonomies",
        "",
        "PROCESS:",
        "• Visual Necessity Rule",
        "  (Chống hình ảnh trang trí)",
        "• Select 1 of 13 visual types",
        "• Formulate content focus",
        "• Define learning support",
        "• Link with prosody anchor",
        "",
        "OUTPUT: Visual Intent Meta",
        "(diagram, flowchart, chart,",
        "equation, timeline, map...)",
        "",
        "➜ KHÔNG sinh camera/shotlist"
    ]
    for i, line in enumerate(s3c_lines):
        ax.text(20.13, 13.1 - i * 0.26, line, ha='left', va='top', fontsize=7.6,
                color='#4338CA' if line.isupper() or line.startswith("OUTPUT") or "➜" in line else '#334155',
                fontweight='bold' if line.isupper() or line.startswith("OUTPUT") or line.startswith("• Visual") or "➜" in line else 'normal',
                zorder=5)

    # Intermediate Artifact 3: DRAFT CLSG-IR (Bottom of Module 3)
    draw_artifact(14.6, 4.65, 7.4, 1.25, "DRAFT CLSG-IR (Pre-verification)",
                  [
                      "Hợp đồng JSON thống nhất 4 trường dữ liệu cốt lõi:",
                      "➜ Learning Intent (Why)  +  Narration (What)  +  Prosody Spec (How)  +  Visual Intent (Show)"
                  ], badge="ARTIFACT 3", corner=0.04, z=4)

    # =========================================================================
    # 8. STAGE 5: MODULE 4 & VERIFIED IR (x: 23.8 to 27.2, w: 3.4)
    # =========================================================================
    draw_card(23.8, 8.5, 3.4, 7.1, '#FFFFFF', c_red_border, c_red_header,
              "MODULE 4: QUALITY GUARD", "“Is the representation valid?”", z=3)
    m4_lines = [
        "INPUT: Draft CLSG-IR",
        "",
        "6 VALIDATION LAYERS:",
        "1. Duration Guard (DAR-P):",
        "   |T_act - T_tgt| / T_tgt ≤ 15%",
        "   (Tính cả thời gian ngắt nghỉ)",
        "2. Factuality & Coverage Guard:",
        "   Đối chiếu không bỏ sót ý gốc",
        "3. Visual Necessity Guard:",
        "   Loại bỏ visual trang trí thừa",
        "4. Visual Taxonomy Guard:",
        "   Ép chuẩn 100% thuộc 13 types",
        "5. Prosody & Pause Guard:",
        "   Kiểm tra dải pause, tránh vụn",
        "6. Cognitive Triad Alignment:",
        "   Khớp Narration ↔ Prosody ↔ Visual",
        "",
        "DECISION: PASS  |  FAIL"
    ]
    for i, line in enumerate(m4_lines):
        ax.text(23.98, 14.7 - i * 0.28, line, ha='left', va='top', fontsize=7.7,
                color='#991B1B' if line.isupper() or "DECISION" in line else '#334155',
                fontweight='bold' if line.isupper() or "DECISION" in line or line.startswith("1.") or line.startswith("2.") or line.startswith("3.") else 'normal',
                zorder=4)

    # Intermediate Artifact 4: VERIFIED CLSG-IR (Below Module 4)
    draw_artifact(23.8, 5.0, 3.4, 2.7, "VERIFIED CLSG-IR",
                  [
                      "• Validated Intermediate Rep (JSON)",
                      "• Fully checked 4 pedagogical pillars",
                      "• Guaranteed duration & pacing (DAR-P)",
                      "• Ready-to-render SSML markup",
                      "• Structured downstream prompts",
                      "➜ Cầu nối vững chắc tới AI Video"
                  ], badge="VALIDATED IR", z=3)

    # =========================================================================
    # 9. STAGE 6: DOWNSTREAM GENERATION & FINAL OUTPUT (x: 27.9 to 31.3, w: 3.4)
    # =========================================================================
    # Downstream Branch A: TTS / Voice Gen
    draw_card(27.9, 11.4, 3.4, 4.2, '#FFFFFF', '#0284C7', '#0369A1',
              "DOWNSTREAM: TTS / VOICE AI", "Acoustic Speech Synthesis", z=3)
    tts_lines = [
        "INPUT: Narration + Prosody Plan",
        "",
        "ACOUSTIC EXECUTION:",
        "• ElevenLabs / Azure TTS / EdgeTTS",
        "• Apply exact pauses (<break time=...>)",
        "• Apply speaking rate & emphasis",
        "",
        "OUTPUT: Studio Narrated Audio (.mp3)"
    ]
    for i, line in enumerate(tts_lines):
        ax.text(28.08, 14.7 - i * 0.32, line, ha='left', va='top', fontsize=8.0,
                color='#0369A1' if line.isupper() else '#334155',
                fontweight='bold' if line.isupper() or "OUTPUT:" in line else 'normal',
                zorder=4)

    # Downstream Branch B: Visual AI Generation
    draw_card(27.9, 6.7, 3.4, 4.2, '#FFFFFF', '#4F46E5', '#4338CA',
              "DOWNSTREAM: VISUAL AI", "Visual Asset & Video Engine", z=3)
    vis_lines = [
        "INPUT: Visual Intent Metadata",
        "",
        "VISUAL SYNTHESIS:",
        "• Midjourney / Flux / Manim / Sora",
        "• Render diagrams, flowcharts, charts",
        "• Sync visual cues to timestamps",
        "",
        "OUTPUT: Visual Sequence (.mp4/.png)"
    ]
    for i, line in enumerate(vis_lines):
        ax.text(28.08, 10.0 - i * 0.32, line, ha='left', va='top', fontsize=8.0,
                color='#4338CA' if line.isupper() else '#334155',
                fontweight='bold' if line.isupper() or "OUTPUT:" in line else 'normal',
                zorder=4)

    # FINAL EDUCATIONAL VIDEO CARD (Merged Output)
    draw_card(27.9, 2.7, 3.4, 3.4, c_green_light, c_green_border, c_green_header,
              "FINAL EDUCATIONAL VIDEO", "End-to-End Multimodal Lesson", z=3)
    vid_lines = [
        "MULTIMODAL INTEGRATION:",
        "• Narrated Audio + Visual Sequence",
        "• Perfect Pedagogical Timing & Pauses",
        "• Cognitive-aligned visuals & voice",
        "",
        "➜ BÀI GIẢNG CHUẨN MỰC SƯ PHẠM"
    ]
    for i, line in enumerate(vid_lines):
        ax.text(28.08, 5.2 - i * 0.3, line, ha='left', va='top', fontsize=8.0,
                color='#065F46' if line.isupper() or "➜" in line else '#1E293B',
                fontweight='bold' if line.isupper() or "➜" in line else 'normal',
                zorder=4)

    # =========================================================================
    # 10. STRICT ORTHOGONAL ROUTING LANES (ZERO BOX INTERSECTION, ZERO TEXT OVERLAP)
    # =========================================================================
    # 1. Learning Material -> Module 1
    draw_ortho_arrow([(4.05, 12.5), (4.8, 12.5)], color=c_blue_border, label="Raw Text", label_pos=(4.42, 12.75))

    # 2. Module 1 -> Canonical Document Tree (Downward connector between M1 and Artifact)
    draw_ortho_arrow([(6.6, 8.8), (6.6, 8.0)], color=c_blue_border, label="Extract Structure", label_pos=(6.6, 8.4))

    # 3A. Canonical Document Tree -> Module 2 (Leaves right edge of artifact, enters left edge of M2)
    draw_ortho_arrow([(8.4, 6.6), (8.65, 6.6), (8.65, 12.2), (9.1, 12.2)],
                     color=c_blue_border, label="Canonical AST", label_pos=(8.65, 7.8))

    # 3B. User Configuration -> Module 2 (Runs cleanly under Canonical Doc Tree along y=4.2)
    draw_ortho_arrow([(4.05, 6.5), (4.45, 6.5), (4.45, 4.2), (8.9, 4.2), (8.9, 9.4), (9.1, 9.4)],
                     color='#7C3AED', label="User Hyperparameters Θ (Audience, Time, Style)", label_pos=(6.65, 4.45))

    # 4. Module 2 -> Lesson Blueprint (Downward connector between M2 and Artifact)
    draw_ortho_arrow([(10.9, 8.8), (10.9, 8.0)], color=c_amber_border, label="Compile Blueprint", label_pos=(10.9, 8.4))

    # 5. Lesson Blueprint -> Module 3 Shared Bus (Leaves right edge of artifact, enters Bus from left)
    draw_ortho_arrow([(12.7, 6.6), (13.1, 6.6), (13.1, 14.71), (13.8, 14.71)],
                     color=c_amber_border, label="Blueprint + Budget", label_pos=(13.1, 10.6))

    # Internal Bus Distribution into 3a, 3b, 3c
    draw_ortho_arrow([(15.22, 14.35), (15.22, 13.9)], color=s3a_border)
    draw_ortho_arrow([(18.3, 14.35), (18.3, 13.9)], color=s3b_border)
    draw_ortho_arrow([(21.37, 14.35), (21.37, 13.9)], color=s3c_border)

    # Submodules 3a, 3b, 3c down into Draft CLSG-IR Artifact
    draw_ortho_arrow([(15.22, 6.4), (15.22, 5.9)], color=s3a_border)
    draw_ortho_arrow([(18.3, 6.4), (18.3, 5.9)], color=s3b_border)
    draw_ortho_arrow([(21.37, 6.4), (21.37, 5.9)], color=s3c_border)

    # 6. Draft CLSG-IR -> Module 4 (Leaves right edge of Module 3, routes into Module 4)
    draw_ortho_arrow([(22.0, 5.27), (23.45, 5.27), (23.45, 12.0), (23.8, 12.0)],
                     color='#A855F7', label="Draft IR", label_pos=(23.45, 8.6))

    # 7A. Module 4 -> PASS -> Verified CLSG-IR (Downward connector between M4 and Artifact)
    draw_ortho_arrow([(25.5, 8.5), (25.5, 7.7)], color=c_green_border, label="PASS (DAR-P ≤ 15%)", label_pos=(25.5, 8.1))

    # 7B. Module 4 -> FAIL -> Revision Loop to Module 3 (Dedicated bottom corridor y=3.5, completely in empty space)
    draw_ortho_arrow([(23.8, 9.2), (23.35, 9.2), (23.35, 3.6), (18.3, 3.6), (18.3, 4.4)],
                     color=c_red_border, ls='--', label="FAIL: Revision / Re-plan Loop (Điều chỉnh số từ & khoảng dừng)", label_pos=(20.8, 3.85))

    # 8A. Verified IR -> Downstream TTS
    draw_ortho_arrow([(27.2, 6.4), (27.55, 6.4), (27.55, 13.5), (27.9, 13.5)],
                     color='#0284C7', label="SSML Spec", label_pos=(27.55, 10.2))

    # 8B. Verified IR -> Downstream Visual AI
    draw_ortho_arrow([(27.2, 5.8), (27.55, 5.8), (27.55, 8.8), (27.9, 8.8)],
                     color='#4F46E5', label="Visual Meta", label_pos=(27.55, 7.3))

    # 9A. TTS Audio -> Final Video (Routes cleanly down along outer right clearance lane x=31.55)
    draw_ortho_arrow([(31.3, 13.5), (31.65, 13.5), (31.65, 4.4), (31.3, 4.4)],
                     color='#0284C7', label="Studio Audio (.mp3)", label_pos=(31.65, 9.0))

    # 9B. Visual Sequence -> Final Video (Routes straight down between Visual AI and Final Video)
    draw_ortho_arrow([(29.6, 6.7), (29.6, 6.1)], color='#4F46E5', label="Visuals (.mp4)", label_pos=(29.6, 6.4))

    # =========================================================================
    # 11. BOTTOM SECTION: UNIFIED 4-PILLAR INSTRUCTIONAL REPRESENTATION
    # =========================================================================
    bot_box = patches.FancyBboxPatch((0.7, 0.45), 30.6, 1.55, boxstyle="round,pad=0.06",
                                    ec='#CBD5E1', fc='#FFFFFF', lw=1.5, zorder=2)
    ax.add_patch(bot_box)
    ax.text(1.0, 1.62, "CLSG-IR — BỘ TỨ SƯ PHẠM HOÀN CHỈNH (UNIFIED 4-PILLAR INSTRUCTIONAL REPRESENTATION):",
            fontsize=9.5, fontweight='bold', color='#1E40AF', fontfamily='sans-serif', zorder=3)
    
    pillars = [
        ("1. LEARNING INTENT (WHY)", "Mục tiêu nhận thức cốt lõi theo Bloom's Taxonomy, xác định điểm nghẽn học tập.", '#F59E0B', '#FFFBEB'),
        ("2. NARRATION (WHAT TO SAY)", "Lời giảng tự nhiên, giàu hình tượng ẩn dụ, phân đoạn câu logic theo nhịp độ 140 WPM.", '#0D9488', '#F0FDFA'),
        ("3. PROSODY PLAN (HOW TO SAY IT)", "Kế hoạch ngữ điệu, khoảng dừng nhận thức (800-1500ms), đồng bộ thị giác và thẻ SSML.", '#E11D48', '#FFF1F2'),
        ("4. VISUAL INTENT (WHAT TO SHOW)", "13 phân loại trực quan chuẩn mực, bài trừ hình ảnh trang trí, chỉ xuất hiện khi cần thiết.", '#4F46E5', '#EEF2FF')
    ]
    pw = 6.95
    for idx, (p_title, p_desc, p_border, p_bg) in enumerate(pillars):
        px = 1.0 + idx * 7.6
        p_card = patches.FancyBboxPatch((px, 0.55), pw, 0.82, boxstyle="round,pad=0.04",
                                        ec=p_border, fc=p_bg, lw=1.2, zorder=3)
        ax.add_patch(p_card)
        ax.text(px + 0.15, 1.15, p_title, fontsize=8.2, fontweight='bold', color=p_border, zorder=4)
        ax.text(px + 0.15, 0.88, p_desc, fontsize=7.2, color='#334155', zorder=4)
        
        # Micro arrow between pillars
        if idx < 3:
            arrow_p = patches.FancyArrowPatch((px + pw + 0.12, 0.96), (px + pw + 0.52, 0.96),
                                              color='#94A3B8', lw=1.5,
                                              arrowstyle="Simple,tail_width=1.0,head_width=4.5,head_length=6.0",
                                              zorder=4)
            ax.add_patch(arrow_p)

    plt.tight_layout()
    output_path = r"c:\Users\KIM THIEN\Desktop\T032\clsg_pipeline_architecture.png"
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor())
    plt.close()
    print(f"Professional architecture diagram generated successfully at: {output_path}")

if __name__ == "__main__":
    generate_architecture_diagram()
