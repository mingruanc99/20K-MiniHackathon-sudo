# app/services/query_service.py
"""
Controlled Query Service for CLSG-IR Persistent Knowledge Layer.
Implements the 10 Pedagogical Retrieval Intents:
- FIND_CONCEPT
- FIND_DEFINITION
- FIND_VISUAL
- FIND_DIAGRAM
- FIND_SLIDES
- FIND_SUPPORTING_TEXT
- FIND_RELATED_CONTENT
- FIND_SOURCE
- FIND_RELATIONS
- FIND_MULTIMODAL_CONTEXT

Guarantees:
- Strict user authorization (User A cannot access User B's documents)
- No direct LLM SQL execution: safe parameter binding and controlled context building
- Hybrid search (Structured SQL filters + semantic vector similarity + relationship traversal)
"""
import re
from typing import List, Dict, Any, Optional
from app.database.knowledge_store import KnowledgeStore

class QueryService:
    def __init__(self, knowledge_store: KnowledgeStore):
        self.store = knowledge_store

    def query(
        self,
        document_id: str,
        owner_id: str,
        query_text: str,
        intent: Optional[str] = None,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Executes a controlled query dispatching to the appropriate intent handler.
        """
        # 1. Authorization check
        doc = self.store.get_document(document_id, owner_id)
        if not doc:
            return {
                "error": "Access denied or document not found.",
                "status": "unauthorized",
                "results": []
            }

        # 2. Determine Intent if not explicitly specified
        detected_intent = intent or self._detect_intent(query_text)
        filters = filters or {}

        # 3. Route to Intent Handler
        if detected_intent == "FIND_VISUAL" or detected_intent == "FIND_DIAGRAM":
            return self._handle_find_visual(document_id, owner_id, query_text, detected_intent, top_k, filters)
        elif detected_intent == "FIND_CONCEPT" or detected_intent == "FIND_DEFINITION":
            return self._handle_find_concept(document_id, owner_id, query_text, top_k)
        elif detected_intent == "FIND_RELATIONS":
            return self._handle_find_relations(document_id, owner_id, query_text, top_k)
        elif detected_intent == "FIND_SOURCE":
            return self._handle_find_source(document_id, owner_id, query_text)
        elif detected_intent == "FIND_MULTIMODAL_CONTEXT":
            return self._handle_find_multimodal(document_id, owner_id, query_text, top_k)
        else:
            return self._handle_hybrid_search(document_id, owner_id, query_text, detected_intent, top_k, filters)

    def _detect_intent(self, text: str) -> str:
        tl = text.lower()
        if any(w in tl for w in ["hình", "ảnh", "diagram", "sơ đồ", "visual", "minh họa", "skeleton", "flowchart"]):
            if "diagram" in tl or "sơ đồ" in tl or "skeleton" in tl:
                return "FIND_DIAGRAM"
            return "FIND_VISUAL"
        if any(w in tl for w in ["là gì", "định nghĩa", "khái niệm", "what is", "define", "concept"]):
            return "FIND_DEFINITION"
        if any(w in tl for w in ["quan hệ", "liên kết", "nối", "relation", "relationship", "cạnh"]):
            return "FIND_RELATIONS"
        if any(w in tl for w in ["ở đâu", "nguồn", "slide nào", "source", "provenance", "trích"]):
            return "FIND_SOURCE"
        if any(w in tl for w in ["đa thể thức", "vừa hình vừa chữ", "giải thích hình", "multimodal"]):
            return "FIND_MULTIMODAL_CONTEXT"
        return "FIND_SUPPORTING_TEXT"

    def _handle_find_visual(
        self,
        document_id: str,
        owner_id: str,
        query: str,
        intent: str,
        top_k: int,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        subtype = filters.get("subtype")
        if intent == "FIND_DIAGRAM" and not subtype:
            if "pose" in query.lower() or "skeleton" in query.lower() or "keypoint" in query.lower():
                subtype = "human_pose_skeleton"

        visuals = self.store.search_visuals(document_id, owner_id, query, subtype=subtype, top_k=top_k)
        return {
            "intent": intent,
            "query": query,
            "document_id": document_id,
            "total_matches": len(visuals),
            "visuals": visuals
        }

    def _handle_find_concept(
        self,
        document_id: str,
        owner_id: str,
        query: str,
        top_k: int
    ) -> Dict[str, Any]:
        all_concepts = self.store.get_concepts(document_id, owner_id)
        q_vec = self.store.embedding_provider.embed(query)

        scored = []
        for c in all_concepts:
            c_emb = c.embedding or self.store.embedding_provider.embed(f"{c.name} {c.description}")
            score = self.store.embedding_provider.embed(query)
            # Match by name or semantic vector
            lexical_hit = 1.0 if c.name.lower() in query.lower() or query.lower() in c.name.lower() else 0.0
            from app.services.embedding_provider import cosine_similarity
            cos_score = cosine_similarity(q_vec, c_emb)
            final_score = max(lexical_hit, cos_score)
            scored.append((final_score, c))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_concepts = [c.model_dump() for s, c in scored[:top_k] if s > 0.1]

        return {
            "intent": "FIND_CONCEPT",
            "query": query,
            "document_id": document_id,
            "concepts": top_concepts
        }

    def _handle_find_relations(
        self,
        document_id: str,
        owner_id: str,
        query: str,
        top_k: int
    ) -> Dict[str, Any]:
        # Perform hybrid search to locate entity, then extract relationships
        chunks = self.store.hybrid_search(document_id, owner_id, query, top_k=top_k)
        relations = []
        for ch in chunks:
            relations.extend(ch.get("graph_relations", []))

        return {
            "intent": "FIND_RELATIONS",
            "query": query,
            "document_id": document_id,
            "relations": relations
        }

    def _handle_find_source(
        self,
        document_id: str,
        owner_id: str,
        query: str
    ) -> Dict[str, Any]:
        chunks = self.store.hybrid_search(document_id, owner_id, query, top_k=1)
        if not chunks:
            return {"intent": "FIND_SOURCE", "query": query, "provenance": None}

        provenance = self.store.resolve_provenance(chunks[0]["chunk_id"], owner_id)
        return {
            "intent": "FIND_SOURCE",
            "query": query,
            "provenance": provenance
        }

    def _handle_find_multimodal(
        self,
        document_id: str,
        owner_id: str,
        query: str,
        top_k: int
    ) -> Dict[str, Any]:
        chunks = self.store.hybrid_search(
            document_id, owner_id, query, filters={"chunk_type": "multimodal"}, top_k=top_k
        )
        return {
            "intent": "FIND_MULTIMODAL_CONTEXT",
            "query": query,
            "document_id": document_id,
            "multimodal_chunks": chunks
        }

    def _handle_hybrid_search(
        self,
        document_id: str,
        owner_id: str,
        query: str,
        intent: str,
        top_k: int,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        chunks = self.store.hybrid_search(document_id, owner_id, query, filters=filters, top_k=top_k)
        return {
            "intent": intent,
            "query": query,
            "document_id": document_id,
            "results": chunks
        }
