# CLSG-IR API Documentation
**Configurable Lecture Script & Visual Intent Representation**  
*REST API Specifications for Vercel Serverless & Local Execution*

---

## 1. Authentication & Security

All protected API endpoints require an `Authorization` header with a Firebase ID token:
```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```
Serverless functions verify the token using the Firebase Admin SDK to extract the user's `uid`. Requests with missing or invalid tokens return `401 Unauthorized`.

---

## 2. API Endpoints

### 2.1 Health Check
- **Endpoint**: `GET /api/health`
- **Access**: Public
- **Response**:
  ```json
  {
    "status": "online",
    "system": "CLSG-IR Studio",
    "version": "1.0.0",
    "modules": [
      "Module 1: Content Extractor (Zero-LLM/VLM)",
      "Module 2: Instructional Planner",
      "Module 3: Expression Generator",
      "Module 4: Quality & Visual Guard"
    ]
  }
  ```

---

### 2.2 Run Full Pipeline
- **Endpoint**: `POST /api/projects/:id/run`
- **Access**: Protected (Project Owner)
- **Request Body**:
  ```json
  {
    "targetDurationSeconds": 180,
    "targetWpm": 140,
    "learnerLevel": "undergraduate",
    "narrationStyle": "academic",
    "visualDensity": "balanced"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "projectId": "proj_demo_cnn_001",
    "status": "verified",
    "data": {
      "documentTree": { ... },
      "blueprint": { ... },
      "draftScenes": [ ... ],
      "qualityReport": {
        "overall_status": "PASSED",
        "overall_quality_score": 0.94,
        "dar_p_ratio": 0.082,
        "duration_error_pct": 8.2
      },
      "verifiedIr": {
        "ir_id": "clsg_verified_01",
        "total_scenes": 5,
        "total_duration_sec": 194.8,
        "total_words": 348
      }
    },
    "traceLogs": [
      {
        "stage": "Module 1: Content Extractor",
        "duration_sec": 0.04,
        "details": { "sections": 5 }
      }
    ]
  }
  ```

---

### 2.3 1-Click CNN Demo
- **Endpoint**: `GET /api/demo`
- **Access**: Public / Demo
- **Description**: Executes the complete 4-module pipeline on the built-in 5-slide "Introduction to CNN" presentation deterministically without external API dependencies.
- **Response**: Returns full `verifiedIr`, `qualityReport`, and `traceLogs`.

---

### 2.4 Multi-Target Export
- **Endpoint**: `GET /api/export/:ir_id/:format`
- **Parameters**:
  - `ir_id`: Verified Intermediate Representation ID.
  - `format`: One of `clsg_json`, `remotion_props`, `manim_code`, `ssml_bundle`.
- **Response**:
  - `clsg_json`: `application/json` payload conforming to `clsg_ir.schema.json`.
  - `remotion_props`: JSON composition props formatted for `<Composition {...props} />`.
  - `manim_code`: `text/x-python` script ready to run with `manim -pql scene.py`.
  - `ssml_bundle`: JSON map of scene IDs to W3C `<speak>` XML documents.
