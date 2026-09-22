# CLSG-IR Database & Security Model
**Firebase Firestore & Cloudinary Architecture**

---

## 1. Architectural Separation of Responsibilities

```
+------------------------------------+------------------------------------+
|        FIREBASE FIRESTORE          |            CLOUDINARY              |
|     (Structured Metadata & IR)     |       (Binary & Media Assets)      |
+------------------------------------+------------------------------------+
| • User Profiles                    | • Original PPTX Presentation files |
| • Projects & Configurations        | • Original DOCX Document files     |
| • Canonical Document Trees         | • Generated TTS Audio WAV/MP3      |
| • Lesson Blueprints                | • Generated Video Renderings       |
| • Verified CLSG-IR JSONs           | • Rendered Visual Diagrams         |
| • Quality & Verification Reports   |                                    |
| • Execution Trace Logs             |                                    |
+------------------------------------+------------------------------------+
```

> **Critical Rule**: Never store binary blobs, video streams, or raw PPTX files in Firestore. All media assets are uploaded to Cloudinary, and only their `secure_url` and `public_id` references are persisted in Firestore.

---

## 2. Firestore Collection Schemas

### 2.1 Users Collection (`/users/{uid}`)
```json
{
  "uid": "usr_k891a2",
  "email": "alex.rivers@stanford.edu",
  "displayName": "Prof. Alex Rivers",
  "photoURL": "https://...",
  "role": "instructor",
  "createdAt": "2026-09-21T10:00:00.000Z"
}
```

### 2.2 Projects Collection (`/projects/{projectId}`)
```json
{
  "projectId": "proj_cnn_01",
  "userId": "usr_k891a2",
  "title": "Introduction to Convolutional Neural Networks",
  "description": "Foundations of Computer Vision, Spatial Locality, and Feature Hierarchies",
  "source": {
    "fileName": "cnn_intro.pptx",
    "fileType": "pptx",
    "fileSize": 45200,
    "cloudinaryPublicId": "clsg/cnn_intro_981a",
    "cloudinaryUrl": "https://res.cloudinary.com/..."
  },
  "configuration": {
    "language": "en",
    "learnerLevel": "undergraduate",
    "priorKnowledge": "Linear algebra and basic calculus",
    "targetDurationSeconds": 180,
    "targetWpm": 140,
    "narrationStyle": "academic",
    "visualDensity": "balanced"
  },
  "status": "verified",
  "canonicalDocument": { ... },
  "lessonBlueprint": { ... },
  "clsgIr": { ... },
  "qualityReport": { ... },
  "createdAt": "2026-09-21T10:00:00.000Z",
  "updatedAt": "2026-09-21T10:02:15.000Z"
}
```

### 2.3 Execution Runs Subcollection (`/projects/{projectId}/runs/{runId}`)
```json
{
  "runId": "run_01_a89c",
  "projectId": "proj_cnn_01",
  "status": "verified",
  "traceLogs": [
    {
      "stage": "Module 1: Content Extractor",
      "duration_sec": 0.04,
      "details": { "sections": 5 }
    }
  ],
  "createdAt": "2026-09-21T10:01:45.000Z"
}
```

---

## 3. Firestore Security Rules

Strict ownership rules enforced in `firestore.rules`:
1. Only authenticated users can access the database (`request.auth != null`).
2. Users can read and write only documents where `resource.data.userId == request.auth.uid`.
3. Document creation requires `request.resource.data.userId == request.auth.uid`.
4. Firestore is never publicly readable or writable.
