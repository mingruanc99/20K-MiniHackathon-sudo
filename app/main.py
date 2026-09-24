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

from app.database.knowledge_store import KnowledgeStore
from app.services.query_service import QueryService

# Global orchestrator, in-memory cache, and Persistent Knowledge Layer
orchestrator = PipelineOrchestrator()
knowledge_store = KnowledgeStore("app/data/clsg_knowledge.db")
query_service = QueryService(knowledge_store)
SESSION_STORE: Dict[str, Any] = {}

# Ensure demo presentations exist
DEMO_PPTX_PATH = Path("app/data/intro_to_cnn.pptx")
POSE_PPTX_PATH = Path("app/data/Pose_Estimation.pptx")
if not DEMO_PPTX_PATH.exists():
    from app.data.demo_dataset import generate_cnn_presentation
    generate_cnn_presentation(str(DEMO_PPTX_PATH))
if not POSE_PPTX_PATH.exists():
    from app.data.demo_dataset import generate_pose_estimation_presentation
    generate_pose_estimation_presentation(str(POSE_PPTX_PATH))

def _init_knowledge_store():
    try:
        docs = knowledge_store.list_documents()
        pose_doc = next((d for d in docs if "pose" in d.get("file_name", "").lower()), None)
        if not pose_doc and POSE_PPTX_PATH.exists():
            with open(POSE_PPTX_PATH, "rb") as f:
                b = f.read()
            doc_tree = extract_document(b, "Pose_Estimation.pptx")
            if doc_tree.document_ir:
                knowledge_store.persist_document_ir(doc_tree.document_ir, owner_id="user_default", file_hash="hash_pose_init")
    except Exception as e:
        print(f"Warning initializing knowledge store: {e}")

_init_knowledge_store()

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

# Knowledge Layer & Hybrid Retrieval Endpoints
@app.post("/api/documents/{doc_id}/query")
def query_document_knowledge(doc_id: str, payload: Dict[str, Any]):
    """Controlled query engine supporting the 10 pedagogical retrieval intents."""
    owner_id = payload.get("owner_id", "user_default")
    query_text = payload.get("query", "")
    intent = payload.get("intent")
    top_k = payload.get("top_k", 5)
    filters = payload.get("filters", {})
    return query_service.query(
        document_id=doc_id,
        owner_id=owner_id,
        query_text=query_text,
        intent=intent,
        top_k=top_k,
        filters=filters
    )

@app.get("/api/documents/{doc_id}/visuals")
def get_document_visuals(doc_id: str, owner_id: str = "user_default"):
    """Retrieve structured visuals from the document knowledge store."""
    return {
        "document_id": doc_id,
        "visuals": knowledge_store.search_visuals(doc_id, owner_id, query="", top_k=20)
    }

@app.get("/api/documents/{doc_id}/provenance/{chunk_id}")
def get_chunk_provenance(doc_id: str, chunk_id: str, owner_id: str = "user_default"):
    """Trace a semantic chunk back to its source elements, slide, and original document."""
    prov = knowledge_store.resolve_provenance(chunk_id, owner_id)
    if not prov:
        raise HTTPException(status_code=404, detail="Provenance not found or access denied.")
    return prov

# ============================================================================
# KNOWLEDGE / DATABASE INSPECTOR READ-ONLY ENDPOINTS
# ============================================================================
@app.get("/api/knowledge/documents")
def list_knowledge_documents():
    """List all documents stored in the persistent knowledge database."""
    return knowledge_store.list_documents()

@app.get("/api/knowledge/documents/{doc_id}")
def get_knowledge_document(doc_id: str):
    """Get full document overview including counts of slides, elements, visuals, chunks, embeddings."""
    res = knowledge_store.get_document_overview(doc_id)
    if not res:
        docs = knowledge_store.list_documents()
        matched = next((d for d in docs if d["id"] == doc_id or doc_id.lower() in d["file_name"].lower()), None)
        if matched:
            res = knowledge_store.get_document_overview(matched["id"])
    if not res:
        raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
    return res

@app.get("/api/knowledge/documents/{doc_id}/slides")
def get_knowledge_document_slides(doc_id: str):
    """Get all slides belonging to a document."""
    slides = knowledge_store.get_slides_by_doc(doc_id)
    if not slides:
        docs = knowledge_store.list_documents()
        matched = next((d for d in docs if d["id"] == doc_id or doc_id.lower() in d["file_name"].lower()), None)
        if matched:
            slides = knowledge_store.get_slides_by_doc(matched["id"])
    return slides

@app.get("/api/knowledge/slides/{slide_id}")
def get_knowledge_slide(slide_id: str):
    """Get slide metadata and canonical IR."""
    slide = knowledge_store.get_slide_by_id(slide_id)
    if not slide:
        conn = knowledge_store._get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM slides WHERE id LIKE ? OR slide_number = ?", (f"%{slide_id}%", int(slide_id) if slide_id.isdigit() else -1))
        row = cur.fetchone()
        if row:
            slide = dict(row)
    if not slide:
        raise HTTPException(status_code=404, detail=f"Slide {slide_id} not found")
    if slide.get("ir") and isinstance(slide["ir"], str):
        try:
            slide["ir"] = json.loads(slide["ir"])
        except Exception:
            pass
    return slide

@app.get("/api/knowledge/slides/{slide_id}/elements")
def get_knowledge_slide_elements(slide_id: str):
    """Get all elements (text, visual, annotation, table) extracted for a slide."""
    return knowledge_store.get_elements_by_slide(slide_id)

@app.get("/api/knowledge/slides/{slide_id}/visuals")
def get_knowledge_slide_visuals(slide_id: str):
    """Get all visual records (diagrams, images) for a slide."""
    return knowledge_store.get_visuals_by_slide(slide_id)

@app.get("/api/knowledge/slides/{slide_id}/relations")
def get_knowledge_slide_relations(slide_id: str):
    """Get all semantic relationships for a slide."""
    return knowledge_store.get_relations_by_slide(slide_id)

@app.get("/api/knowledge/slides/{slide_id}/chunks")
def get_knowledge_slide_chunks(slide_id: str):
    """Get all semantic chunks originating from this slide."""
    return knowledge_store.get_chunks_by_slide(slide_id)

@app.get("/api/knowledge/elements/{element_id}")
def get_knowledge_element(element_id: str):
    """Get element details by unique ID."""
    el = knowledge_store.get_element_by_id(element_id)
    if not el:
        raise HTTPException(status_code=404, detail="Element not found")
    return el

@app.get("/api/knowledge/visuals/{visual_id}")
def get_knowledge_visual(visual_id: str):
    """Get visual record details by unique ID."""
    vis = knowledge_store.get_visual_by_id(visual_id)
    if not vis:
        raise HTTPException(status_code=404, detail="Visual record not found")
    return vis

@app.get("/api/knowledge/chunks/{chunk_id}")
def get_knowledge_chunk(chunk_id: str):
    """Get semantic chunk details by unique ID."""
    ch = knowledge_store.get_chunk_by_id(chunk_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return ch

@app.post("/api/knowledge/query")
def query_knowledge_inspector(payload: Dict[str, Any]):
    """Query retrieval tester supporting structured, vector, relation, and hybrid results."""
    query_text = payload.get("query", "")
    doc_id = payload.get("document_id")
    owner_id = payload.get("owner_id", "user_default")
    top_k = payload.get("top_k", 5)
    intent = payload.get("intent")
    
    if not doc_id:
        docs = knowledge_store.list_documents()
        doc_id = docs[0]["id"] if docs else "DOC_DEFAULT"

    hybrid_results = knowledge_store.hybrid_search(
        document_id=doc_id,
        owner_id=owner_id,
        query=query_text,
        top_k=top_k
    )

    structured_results = query_service.query(
        document_id=doc_id,
        owner_id=owner_id,
        query_text=query_text,
        intent=intent,
        top_k=top_k
    )

    visual_results = knowledge_store.search_visuals(
        document_id=doc_id,
        owner_id=owner_id,
        query=query_text,
        top_k=top_k
    )

    formatted_hybrid = []
    for r in hybrid_results:
        item = dict(r)
        item["score"] = round(r.get("similarity_score", 0.0), 3)
        item["type"] = r.get("chunk_type", "text")
        item["slide"] = r.get("slide_id")
        item["source"] = f"slide_{r.get('slide_id')}_{r.get('chunk_id')}"
        formatted_hybrid.append(item)

    formatted_visual = []
    for v in visual_results:
        item = dict(v)
        item["score"] = round(v.get("similarity_score", 0.95), 3)
        item["type"] = "visual"
        item["slide"] = v.get("slide_id")
        item["source"] = f"slide_{v.get('slide_id')}/{v.get('id')}"
        formatted_visual.append(item)

    return {
        "query": query_text,
        "document_id": doc_id,
        "hybrid_results": formatted_hybrid,
        "structured_results": structured_results.get("results", []),
        "visual_results": formatted_visual
    }

@app.get("/api/knowledge/pipeline-debug/{doc_id}")
def get_knowledge_pipeline_debug(doc_id: str):
    """Pipeline debugging metrics across all 8 stages."""
    debug_data = knowledge_store.get_pipeline_debug(doc_id)
    if not debug_data or not debug_data.get("file_name"):
        docs = knowledge_store.list_documents()
        matched = next((d for d in docs if d["id"] == doc_id or doc_id.lower() in d["file_name"].lower()), None)
        if matched:
            debug_data = knowledge_store.get_pipeline_debug(matched["id"])
    return debug_data

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
