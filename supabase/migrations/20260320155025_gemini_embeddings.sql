-- Add pgvector + Gemini embeddings for semantic RAG
-- Enable extension: Database > Extensions > vector (in hosted Supabase)
-- After running: npm run backfill-embeddings (for existing rows)

create extension if not exists vector with schema extensions;

-- Add embedding column (768 dims = Gemini embedding-001 with output_dimensionality=768)
alter table knowledge_base
  add column if not exists embedding extensions.vector(768);

-- Create index for fast similarity search (optional but recommended as table grows)
create index if not exists idx_knowledge_base_embedding
  on knowledge_base
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Match function for semantic search (call via supabase.rpc)
create or replace function match_knowledge_base(
  query_embedding extensions.vector(768),
  p_tenant_id uuid,
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  tenant_id uuid,
  topic text,
  content text,
  source text,
  similarity float
)
language sql stable
as $$
  select
    kb.id,
    kb.tenant_id,
    kb.topic,
    kb.content,
    kb.source,
    1 - (kb.embedding <=> query_embedding) as similarity
  from knowledge_base kb
  where kb.tenant_id = p_tenant_id
    and kb.embedding is not null
    and (1 - (kb.embedding <=> query_embedding)) > match_threshold
  order by kb.embedding <=> query_embedding
  limit match_count;
$$;
