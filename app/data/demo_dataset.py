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

if __name__ == "__main__":
    generate_cnn_presentation()
