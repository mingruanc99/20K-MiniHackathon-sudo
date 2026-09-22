# app/main.py
"""
FastAPI application backend for CLSG-IR (Configurable Lecture Script & Visual Intent Representation)
Provides RESTful endpoints for all 4 pipeline modules, 1-click demo, and export targets.
"""
import os
import io
import json
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, FileResponse

from app.models.config import PipelineConfig, LearnerPersona, PresentationConfig
from app.models.document import CanonicalDocumentTree
from app.models.blueprint import LessonBlueprint
from app.models.expression import DraftCLSG_IR
from app.models.clsg_ir import VerifiedCLSG_IR
from app.core.orchestrator import PipelineOrchestrator
from app.modules.extractor.factory import extract_document
from app.modules.planner.planner import InstructionalPlanner
from app.modules.generator.generator import ExpressionGenerator
from app.modules.guard.guard import QualityVisualGuard

app = FastAPI(
    title="CLSG-IR Studio API",
    description="Configurable Lecture Script & Visual Intent Representation for AI Video Synthesis",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global orchestrator and in-memory cache for demo sessions
orchestrator = PipelineOrchestrator()
SESSION_STORE: Dict[str, Any] = {}

# Ensure demo presentation exists
DEMO_PPTX_PATH = Path("app/data/intro_to_cnn.pptx")
if not DEMO_PPTX_PATH.exists():
    from app.data.demo_dataset import generate_cnn_presentation
    generate_cnn_presentation(str(DEMO_PPTX_PATH))

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "system": "CLSG-IR Studio",
        "modules": [
            "Module 1: Content Extractor (Zero-LLM/VLM)",
            "Module 2: Instructional Planner",
            "Module 3: Expression Generator (Narration + Prosody/Pause + Visual)",
            "Module 4: Quality & Visual Guard"
        ]
    }

@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
    target_duration: int = Form(180),
    pacing: str = Form("normal"),
    audience: str = Form("undergraduate"),
    tone: str = Form("academic")
):
    try:
        content = await file.read()
        filename = file.filename or "uploaded_doc.pptx"

        config = PipelineConfig(
            learner=LearnerPersona(target_audience=audience, tone=tone),
            presentation=PresentationConfig(target_duration_sec=target_duration, pacing=pacing)
        )

        pipeline_result = orchestrator.run_full_pipeline(content, filename, config)
        ir_id = pipeline_result["verified_ir"]["ir_id"]
        SESSION_STORE[ir_id] = pipeline_result

        return {
            "success": True,
            "filename": filename,
            "ir_id": ir_id,
            "data": pipeline_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline execution failed: {str(e)}")

@app.get("/api/demo")
def run_demo():
    """1-Click Demo endpoint running 'Introduction to CNN' with zero API key dependencies."""
    try:
        if not DEMO_PPTX_PATH.exists():
            from app.data.demo_dataset import generate_cnn_presentation
            generate_cnn_presentation(str(DEMO_PPTX_PATH))

        config = PipelineConfig(
            learner=LearnerPersona(
                target_audience="undergraduate",
                prior_knowledge="Introductory linear algebra and neural network basics",
                tone="academic"
            ),
            presentation=PresentationConfig(
                target_duration_sec=180,
                pacing="normal",
                baseline_wpm=140,
                visual_density="balanced"
            )
        )

        with open(DEMO_PPTX_PATH, "rb") as f:
            pptx_bytes = f.read()

        pipeline_result = orchestrator.run_full_pipeline(pptx_bytes, "intro_to_cnn.pptx", config)
        ir_id = pipeline_result["verified_ir"]["ir_id"]
        SESSION_STORE[ir_id] = pipeline_result
        SESSION_STORE["latest_demo"] = pipeline_result

        return {
            "success": True,
            "mode": "1-Click Demo (Deterministic CNN Lecture)",
            "filename": "intro_to_cnn.pptx",
            "ir_id": ir_id,
            "data": pipeline_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Demo execution failed: {str(e)}")

@app.post("/api/run-pipeline")
def run_pipeline_with_config(payload: Dict[str, Any]):
    """Run pipeline with custom JSON configuration payload."""
    try:
        raw_text = payload.get("text", "")
        filename = payload.get("filename", "lecture_input.md")
        
        cfg_dict = payload.get("config", {})
        config = PipelineConfig(**cfg_dict) if cfg_dict else PipelineConfig()

        source = raw_text.encode("utf-8") if raw_text else DEMO_PPTX_PATH.read_bytes()
        res = orchestrator.run_full_pipeline(source, filename, config)
        ir_id = res["verified_ir"]["ir_id"]
        SESSION_STORE[ir_id] = res

        return {"success": True, "ir_id": ir_id, "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export/{ir_id}/{format_type}")
def export_payload(ir_id: str, format_type: str):
    """Export verified CLSG-IR into specific downstream targets: clsg_json, remotion_props, manim_code, ssml_bundle."""
    session_data = SESSION_STORE.get(ir_id) or SESSION_STORE.get("latest_demo")
    if not session_data:
        raise HTTPException(status_code=404, detail=f"Session or IR {ir_id} not found.")

    export_pkg = session_data.get("export_package", {}).get("formats", {})
    if format_type not in export_pkg:
        raise HTTPException(status_code=400, detail=f"Format '{format_type}' not available. Choose from: {list(export_pkg.keys())}")

    payload = export_pkg[format_type]

    if format_type == "manim_code":
        return PlainTextResponse(payload, media_type="text/x-python")
    elif format_type == "ssml_bundle":
        return JSONResponse(content=payload)
    else:
        return JSONResponse(content=payload)

# Serve static frontend assets
static_dir = Path("app/static")
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

@app.get("/", response_class=HTMLResponse)
def serve_index():
    index_file = static_dir / "index.html"
    if index_file.exists():
        return index_file.read_text(encoding="utf-8")
    return "<h1>CLSG-IR Studio Backend Active</h1><p>Frontend static files loading...</p>"
