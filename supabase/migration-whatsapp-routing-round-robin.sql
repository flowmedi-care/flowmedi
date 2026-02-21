-- Adiciona estratégia round_robin ao roteamento WhatsApp
-- round_robin: cada nova conversa vai para a secretária com menos conversas abertas atribuídas

ALTER TABLE public.clinic_whatsapp_routing_settings
  DROP CONSTRAINT IF EXISTS clinic_whatsapp_routing_settings_routing_strategy_check;

ALTER TABLE public.clinic_whatsapp_routing_settings
  ADD CONSTRAINT clinic_whatsapp_routing_settings_routing_strategy_check
  CHECK (routing_strategy IN ('general_secretary', 'first_responder', 'chatbot', 'round_robin'));

COMMENT ON COLUMN public.clinic_whatsapp_routing_settings.routing_strategy IS 
  'general_secretary: todas para uma secretária; first_responder: primeira que responder assume; chatbot: menu inicial; round_robin: distribui por carga (quem tem menos conversas)';
