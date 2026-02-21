-- Adiciona chatbot_fallback_strategy: quando chatbot não encontra secretária definida
-- ou há múltiplas, usa 'first_responder' (pool) ou 'round_robin' (revezamento)

ALTER TABLE public.clinic_whatsapp_routing_settings
  ADD COLUMN IF NOT EXISTS chatbot_fallback_strategy text DEFAULT 'first_responder'
  CHECK (chatbot_fallback_strategy IN ('first_responder', 'round_robin'));

COMMENT ON COLUMN public.clinic_whatsapp_routing_settings.chatbot_fallback_strategy IS 
  'Usado no chatbot quando: opção 2/3 sem secretária, opção 4, ou procedimento com 0 ou múltiplas secretárias. first_responder = pool (primeira que responder); round_robin = atribui à com menos conversas.';
