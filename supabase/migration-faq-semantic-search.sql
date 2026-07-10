-- FAQ semantic search: pgvector embeddings (opcional; requer extensão vector no Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.clinic_virtual_assistant_faq
  ADD COLUMN IF NOT EXISTS question_embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_va_faq_question_embedding
  ON public.clinic_virtual_assistant_faq
  USING ivfflat (question_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Busca por similaridade (cosine) quando embeddings estão preenchidos
CREATE OR REPLACE FUNCTION public.match_clinic_faq(
  p_clinic_id uuid,
  p_query_embedding vector(1536),
  p_match_threshold float DEFAULT 0.72,
  p_match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  question text,
  answer text,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    f.id,
    f.question,
    f.answer,
    1 - (f.question_embedding <=> p_query_embedding) AS similarity
  FROM public.clinic_virtual_assistant_faq f
  WHERE f.clinic_id = p_clinic_id
    AND f.question_embedding IS NOT NULL
    AND 1 - (f.question_embedding <=> p_query_embedding) >= p_match_threshold
  ORDER BY f.question_embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;
