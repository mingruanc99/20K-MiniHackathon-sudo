# app/data/demo_dataset.py
"""
Script to programmatically generate sample educational materials.
Generates `intro_to_cnn.pptx` (5 slides) with titles, bullet points, tables, and notes.
"""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

def generate_cnn_presentation(output_path: str = "app/data/intro_to_cnn.pptx"):
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    slides_data = [
        {
            "title": "Introduction to Convolutional Neural Networks",
            "subtitle": "Deep Learning for Computer Vision & Spatial Representation",
            "bullets": [
                "Computer Vision Challenges: Bridging the semantic gap from raw pixel tensors",
                "From Photons to Percepts: Recognizing patterns invariant to lighting, rotation, and scale",
                "Core Innovation: Preserving 2D spatial locality with structured matrix transformations"
            ],
            "notes": "Welcome to our deep dive on Convolutional Neural Networks. Today we unpack how AI sees the world."
        },
        {
            "title": "The Parameter Explosion in Dense MLPs",
            "subtitle": "Why Traditional Fully Connected Neural Networks Fail on Images",
            "bullets": [
                "Image Flattening: A modest 200x200 RGB image creates 120,000 raw input features",
                "Weight Matrix Explosion: Connecting to 1,000 hidden units requires 120 Million trainable parameters",
                "Spatial Oblivion: Vector flattening destroys 2D neighborhood relationships and spatial adjacency"
            ],
            "notes": "Notice how dense networks fail to scale because they treat adjacent pixels the same as opposite corners."
        },
        {
            "title": "The Convolution Operation & Kernel Mechanics",
            "subtitle": "Sparse Connectivity, Sliding Windows, and Weight Sharing",
            "bullets": [
                "The Kernel / Filter: A small learnable tensor (e.g. 3x3) sliding across the input grid",
                "Element-wise Multiplication: Summing products at each position yields a scalar feature activation",
                "Translation Equivariance: Identifying features regardless of where they appear on the canvas"
            ],
            "notes": "The convolution operation is the mathematical heart of CNNs, drastically shrinking model size."
        },
        {
            "title": "Downsampling via Max Pooling",
            "subtitle": "Spatial Dimensionality Reduction & Translation Invariance",
            "bullets": [
                "Window Mechanics: A 2x2 window with stride 2 steps through the feature map",
                "Peak Activation Extraction: Captures only the most salient signal while suppressing noise",
                "Computational Efficiency: Halves spatial dimensions, quadrupling receptive field scale downstream"
            ],
            "notes": "Max pooling provides downsampling and a degree of translational invariance."
        },
        {
            "title": "Full CNN Pipeline Architecture & Synthesis",
            "subtitle": "Hierarchical Feature Extraction from Edges to Objects",
            "bullets": [
                "End-to-End Pipeline: [Conv2D -> ReLU -> MaxPool] x N -> Dense Classification -> Softmax",
                "Hierarchical Representations: Shallow layers detect edges; deep layers capture semantic entities",
                "Synthesis & Performance: State-of-the-art vision benchmarks achieved with sub-second inference"
            ],
            "notes": "To conclude, stacking these simple operations produces powerful visual reasoning machines."
        }
    ]

    for data in slides_data:
        slide = prs.slides.add_slide(blank_layout)

        # Title Box
        title_box = slide.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.333), Inches(1.2))
        tf = title_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = data["title"]
        p.font.size = Pt(36)
        p.font.bold = True
        p.font.color.rgb = RGBColor(30, 41, 59)

        # Subtitle
        p2 = tf.add_paragraph()
        p2.text = data["subtitle"]
        p2.font.size = Pt(20)
        p2.font.color.rgb = RGBColor(100, 116, 139)

        # Content Box (Bullets)
        content_box = slide.shapes.add_textbox(Inches(1.0), Inches(2.4), Inches(11.333), Inches(4.0))
        c_tf = content_box.text_frame
        c_tf.word_wrap = True

        for i, bullet in enumerate(data["bullets"]):
            bp = c_tf.paragraphs[0] if i == 0 else c_tf.add_paragraph()
            bp.text = f"•  {bullet}"
            bp.font.size = Pt(22)
            bp.font.color.rgb = RGBColor(51, 65, 85)
            bp.space_before = Pt(14)

        # Speaker Notes
        notes_slide = slide.notes_slide
        notes_slide.notes_text_frame.text = data["notes"]

    prs.save(str(out_file))
    print(f"Successfully generated demo presentation at {out_file}")

def generate_pose_estimation_presentation(output_path: str = "app/data/Pose_Estimation.pptx"):
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    slides_meta = [
        ("Giới thiệu về Human Pose Estimation", "Thị giác Máy tính & Ước lượng Tư thế"),
        ("Kiến trúc Top-Down vs Bottom-Up trong Pose Estimation", "So sánh độ phức tạp O(N) và O(1)"),
        ("Heatmap Regression và Coordinate Representation", "Dự đoán tọa độ khớp từ ma trận xác suất Gauss"),
        ("Part Affinity Fields (PAF) trong OpenPose", "Trường vector định hướng liên kết các chi"),
        ("Mô hình MediaPipe Pose: 33 Landmarks 3D", "Tối ưu hóa chạy trực tiếp trên thiết bị di động"),
        ("Chuẩn hóa Định dạng COCO Keypoints", "17 điểm khớp chuẩn hóa quốc tế"),
        ("Cấu trúc Cây Khung xương (Skeleton Tree Structure)", "Biểu diễn đồ thị không gian có hướng"),
    ]

    for idx, (title, sub) in enumerate(slides_meta, start=1):
        s = prs.slides.add_slide(blank_layout)
        tb = s.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.333), Inches(1.2))
        tf = tb.text_frame
        p = tf.paragraphs[0]
        p.text = f"Slide {idx}: {title}"
        p.font.size = Pt(32)
        p.font.bold = True
        p.font.color.rgb = RGBColor(30, 41, 59)

        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.size = Pt(18)
        p2.font.color.rgb = RGBColor(100, 116, 139)

        cb = s.shapes.add_textbox(Inches(1.0), Inches(2.4), Inches(11.333), Inches(4.0))
        ctf = cb.text_frame
        bp = ctf.paragraphs[0]
        bp.text = f"• Tổng quan nội dung phần {idx}: Cơ sở lý thuyết và ứng dụng thực tiễn."
        bp.font.size = Pt(20)

    # Slide 8: 17 điểm có tên — và 19 đường nối
    s8 = prs.slides.add_slide(blank_layout)

    # Title Box
    title_box = s8.shapes.add_textbox(Inches(1.0), Inches(0.6), Inches(11.333), Inches(1.0))
    tf8 = title_box.text_frame
    p8 = tf8.paragraphs[0]
    p8.text = "17 điểm có tên — và 19 đường nối"
    p8.font.size = Pt(34)
    p8.font.bold = True
    p8.font.color.rgb = RGBColor(30, 41, 59)

    # Left visual placeholder: Skeleton diagram graphic
    s8.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(4.8), Inches(4.7))

    # 17 keypoint numeric label shapes on the left side
    kp_coords = [
        (0, 3.4, 2.0),
        (1, 3.2, 1.9),
        (2, 3.6, 1.9),
        (3, 3.0, 2.0),
        (4, 3.8, 2.0),
        (5, 2.6, 2.6),
        (6, 4.2, 2.6),
        (7, 2.2, 3.3),
        (8, 4.6, 3.3),
        (9, 1.8, 4.0),
        (10, 5.0, 4.0),
        (11, 2.9, 4.2),
        (12, 3.9, 4.2),
        (13, 2.8, 5.1),
        (14, 4.0, 5.1),
        (15, 2.7, 6.0),
        (16, 4.1, 6.0)
    ]
    for kp_idx, x, y in kp_coords:
        kp_box = s8.shapes.add_textbox(Inches(x), Inches(y), Inches(0.4), Inches(0.35))
        ktf = kp_box.text_frame
        kp = ktf.paragraphs[0]
        kp.text = str(kp_idx)
        kp.font.size = Pt(13)
        kp.font.bold = True
        kp.font.color.rgb = RGBColor(14, 116, 144)

    # Right text explanatory box
    right_box = s8.shapes.add_textbox(Inches(6.2), Inches(1.8), Inches(6.1), Inches(4.5))
    rtf = right_box.text_frame
    rtf.word_wrap = True

    bullets = [
        "■ 0 nose — mũi",
        "■ 1–4 mắt trái, mắt phải, tai trái, tai phải",
        "■ 5–10 vai, khuỷu tay, cổ tay (trái rồi phải)",
        "■ 11–16 hông, đầu gối, cổ chân (trái rồi phải)"
    ]
    for i, b in enumerate(bullets):
        bp = rtf.paragraphs[0] if i == 0 else rtf.add_paragraph()
        bp.text = b
        bp.font.size = Pt(22)
        bp.font.color.rgb = RGBColor(51, 65, 85)
        bp.space_before = Pt(14)

    # Bottom caption
    caption_box = s8.shapes.add_textbox(Inches(1.0), Inches(6.7), Inches(11.333), Inches(0.5))
    ctf = caption_box.text_frame
    cp = ctf.paragraphs[0]
    cp.text = "Nguồn: COCO — person keypoints, 17 điểm / 19 cạnh"
    cp.font.size = Pt(15)
    cp.font.italic = True
    cp.font.color.rgb = RGBColor(100, 116, 139)

    # Notes
    s8.notes_slide.notes_text_frame.text = "Phân loại 17 điểm tọa độ và 19 liên kết khung xương COCO chuẩn hóa."

    prs.save(str(out_file))
    print(f"Successfully generated Pose Estimation presentation at {out_file}")

if __name__ == "__main__":
    generate_cnn_presentation()
    generate_pose_estimation_presentation()
