-- Tabela para rastrear quando cada conversa foi visualizada pela última vez por cada usuário
CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_views (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation_views_conversation_id 
  ON public.whatsapp_conversation_views(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversation_views_user_id 
  ON public.whatsapp_conversation_views(user_id);

ALTER TABLE public.whatsapp_conversation_views ENABLE ROW LEVEL SECURITY;

-- Política: usuários só podem ver/atualizar suas próprias visualizações
DROP POLICY IF EXISTS "whatsapp_conversation_views_read_own" ON public.whatsapp_conversation_views;
CREATE POLICY "whatsapp_conversation_views_read_own"
  ON public.whatsapp_conversation_views FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "whatsapp_conversation_views_insert_own" ON public.whatsapp_conversation_views;
CREATE POLICY "whatsapp_conversation_views_insert_own"
  ON public.whatsapp_conversation_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "whatsapp_conversation_views_update_own" ON public.whatsapp_conversation_views;
CREATE POLICY "whatsapp_conversation_views_update_own"
  ON public.whatsapp_conversation_views FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
