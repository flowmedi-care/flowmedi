-- Adiciona campo para armazenar nome do contato vindo do webhook
ALTER TABLE public.whatsapp_conversations 
  ADD COLUMN IF NOT EXISTS contact_name text;

COMMENT ON COLUMN public.whatsapp_conversations.contact_name IS 'Nome do contato vindo do webhook do WhatsApp (quando disponível)';
