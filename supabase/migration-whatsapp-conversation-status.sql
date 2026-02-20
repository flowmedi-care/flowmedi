-- Adiciona campos para gerenciar estado das conversas (open/closed/completed) e janela de 24h
ALTER TABLE public.whatsapp_conversations 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'completed')),
  ADD COLUMN IF NOT EXISTS last_inbound_message_at timestamptz;

-- Índice para buscar conversas que precisam ser fechadas (status=open e última mensagem > 24h)
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status_last_inbound 
  ON public.whatsapp_conversations(status, last_inbound_message_at) 
  WHERE status = 'open';

COMMENT ON COLUMN public.whatsapp_conversations.status IS 'Estado da conversa: open (pode enviar texto livre), closed (só templates), completed (concluída manualmente)';
COMMENT ON COLUMN public.whatsapp_conversations.last_inbound_message_at IS 'Data/hora da última mensagem recebida (inbound). Usado para calcular janela de 24h';

-- Atualizar conversas existentes: se não tem last_inbound_message_at, usar updated_at como fallback
UPDATE public.whatsapp_conversations 
SET last_inbound_message_at = updated_at 
WHERE last_inbound_message_at IS NULL;
