-- Sugestoes publicas sem login com edicao por token temporario
CREATE TABLE IF NOT EXISTS public.public_suggestions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  content text NOT NULL,
  edit_token uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_suggestions_content_not_empty CHECK (length(trim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS public_suggestions_created_at_idx
  ON public.public_suggestions (created_at DESC);
