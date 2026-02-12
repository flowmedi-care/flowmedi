-- Migration: Permitir envio automático ou manual para eventos que estavam só manual
-- Execute no SQL Editor do Supabase
-- Assim "Falta Registrada", "Consulta Realizada" e "Link do Formulário Enviado"
-- passam a mostrar a opção Envio: Automático | Manual na configuração.

UPDATE public.message_events
SET can_be_automatic = true
WHERE code IN (
  'appointment_no_show',   -- Falta Registrada
  'appointment_completed', -- Consulta Realizada
  'form_link_sent'         -- Link do Formulário Enviado
);
