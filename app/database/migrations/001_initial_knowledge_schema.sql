-- app/database/migrations/001_initial_knowledge_schema.sql
-- Production PostgreSQL DDL for CLSG-IR Persistent Document Knowledge Layer
-- Enables pgvector, JSONB queries, ACID relational graphs, and tenant isolation (owner_id).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(32) NOT NULL DEFAULT 'pptx',
    file_hash VARCHAR(128) NOT NULL,
    storage_url TEXT,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    total_slides INT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(file_hash);

-- 2. DOCUMENT VERSIONS TABLE
CREATE TABLE IF NOT EXISTS document_versions (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version INT NOT NULL,
    parser_version VARCHAR(64) NOT NULL DEFAULT 'v2.0-multimodal',
    schema_version VARCHAR(64) NOT NULL DEFAULT 'v2.0',
    embedding_model VARCHAR(64) NOT NULL DEFAULT 'text-embedding-3-small',
    processing_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc_ver ON document_versions(document_id, version);

-- 3. SLIDES TABLE
CREATE TABLE IF NOT EXISTS slides (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    owner_id VARCHAR(64) NOT NULL,
    slide_number INT NOT NULL,
    title TEXT,
    section VARCHAR(64),
    width FLOAT,
    height FLOAT,
    thumbnail_url TEXT,
    ir JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_slides_doc_num ON slides(document_id, slide_number);
CREATE INDEX IF NOT EXISTS idx_slides_owner ON slides(owner_id);

-- 4. ELEMENTS TABLE
CREATE TABLE IF NOT EXISTS elements (
    id VARCHAR(64) PRIMARY KEY,
    slide_id VARCHAR(64) NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    owner_id VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    subtype VARCHAR(64),
    role VARCHAR(64) NOT NULL DEFAULT 'concept',
    content TEXT,
    raw_text TEXT,
    normalized_text TEXT,
    marker VARCHAR(16),
    layout_region VARCHAR(64),
    bbox JSONB,
    reading_order INT NOT NULL DEFAULT 1,
    parent_id VARCHAR(64),
    source_type VARCHAR(64) NOT NULL DEFAULT 'slide_text',
    confidence FLOAT NOT NULL DEFAULT 1.0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_elements_slide ON elements(slide_id);
CREATE INDEX IF NOT EXISTS idx_elements_doc ON elements(document_id);
CREATE INDEX IF NOT EXISTS idx_elements_owner ON elements(owner_id);
CREATE INDEX IF NOT EXISTS idx_elements_type_role ON elements(type, role);

-- 5. VISUALS TABLE
CREATE TABLE IF NOT EXISTS visuals (
    id VARCHAR(64) PRIMARY KEY,
    element_id VARCHAR(64) NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
    slide_id VARCHAR(64) NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    owner_id VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'diagram',
    subtype VARCHAR(64) NOT NULL DEFAULT 'unknown',
    role VARCHAR(64) NOT NULL DEFAULT 'conceptual_diagram',
    description TEXT,
    asset_url TEXT,
    public_id VARCHAR(255),
    bbox JSONB,
    confidence FLOAT NOT NULL DEFAULT 1.0,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visuals_doc ON visuals(document_id);
CREATE INDEX IF NOT EXISTS idx_visuals_slide ON visuals(slide_id);
CREATE INDEX IF NOT EXISTS idx_visuals_subtype ON visuals(subtype);
CREATE INDEX IF NOT EXISTS idx_visuals_owner ON visuals(owner_id);

-- 6. CONCEPTS TABLE
CREATE TABLE IF NOT EXISTS concepts (
    id VARCHAR(64) PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL,
    document_id VARCHAR(64) REFERENCES documents(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64) NOT NULL DEFAULT 'domain_concept',
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_concepts_owner ON concepts(owner_id);
CREATE INDEX IF NOT EXISTS idx_concepts_name ON concepts(name);

-- 7. CHUNKS TABLE
CREATE TABLE IF NOT EXISTS chunks (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    owner_id VARCHAR(64) NOT NULL,
    slide_id VARCHAR(64) NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
    chunk_type VARCHAR(32) NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    source_element_ids JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_slide ON chunks(slide_id);
CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_chunks_owner ON chunks(owner_id);

-- 8. RELATIONS TABLE
CREATE TABLE IF NOT EXISTS relations (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    owner_id VARCHAR(64) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    source_id VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    relation_type VARCHAR(64) NOT NULL,
    confidence FLOAT NOT NULL DEFAULT 1.0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_relations_doc ON relations(document_id);
CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id, source_type);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_relations_owner ON relations(owner_id);

-- 9. PROCESSING RUNS TABLE
CREATE TABLE IF NOT EXISTS processing_runs (
    run_id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    owner_id VARCHAR(64) NOT NULL,
    parser_version VARCHAR(64) NOT NULL DEFAULT 'v2.0-multimodal',
    schema_version VARCHAR(64) NOT NULL DEFAULT 'v2.0',
    embedding_model VARCHAR(64) NOT NULL DEFAULT 'text-embedding-3-small',
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    errors JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_runs_doc ON processing_runs(document_id);
CREATE INDEX IF NOT EXISTS idx_runs_owner ON processing_runs(owner_id);
