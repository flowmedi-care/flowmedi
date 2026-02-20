-- Adiciona campo para controlar se WhatsApp só envia quando ticket está aberto
ALTER TABLE public.clinic_message_settings 
  ADD COLUMN IF NOT EXISTS send_only_when_ticket_open boolean DEFAULT false;

COMMENT ON COLUMN public.clinic_message_settings.send_only_when_ticket_open IS 'Se true (WhatsApp), só envia mensagem de texto quando ticket está aberto. Se false, pode enviar template quando fechado.';
