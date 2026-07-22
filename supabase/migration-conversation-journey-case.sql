-- Conversation → Case link (Synchronizer). Não unifica schemas.
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS journey_case_id uuid REFERENCES public.journey_cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_journey_case
  ON public.whatsapp_conversations (journey_case_id)
  WHERE journey_case_id IS NOT NULL;

COMMENT ON COLUMN public.whatsapp_conversations.journey_case_id IS
  'Vínculo explícito conversa → Case ativo (resolveActiveCaseForConversation)';
