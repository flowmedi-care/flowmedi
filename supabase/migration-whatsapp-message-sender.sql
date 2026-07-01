-- Identidade do remetente nas mensagens WhatsApp (assistente, humano, sistema, paciente)

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS sender_type text
    CHECK (sender_type IS NULL OR sender_type IN ('assistant', 'human', 'system', 'patient')),
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.whatsapp_messages.sender_type IS 'assistant | human | system | patient';
COMMENT ON COLUMN public.whatsapp_messages.sender_name IS 'Nome exibido no painel e no cabeçalho da mensagem ao paciente';
COMMENT ON COLUMN public.whatsapp_messages.sender_user_id IS 'profiles.id quando sender_type = human';

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sender_type
  ON public.whatsapp_messages(conversation_id, sender_type)
  WHERE sender_type IS NOT NULL;
