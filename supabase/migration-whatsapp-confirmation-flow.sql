-- WhatsApp Flow: confirmação de consulta (Sim / Não / Remarcar)
-- + frase do template appointment_confirmation_request

ALTER TABLE public.clinic_virtual_assistant_settings
  ADD COLUMN IF NOT EXISTS confirmation_flow_id text,
  ADD COLUMN IF NOT EXISTS confirmation_flow_template_name text DEFAULT 'flowmedi_confirmacao_flow';

COMMENT ON COLUMN public.clinic_virtual_assistant_settings.confirmation_flow_id IS
  'ID do WhatsApp Flow publicado na Meta para confirmação 2d. Fallback: META_WHATSAPP_CONFIRMATION_FLOW_ID.';
COMMENT ON COLUMN public.clinic_virtual_assistant_settings.confirmation_flow_template_name IS
  'Nome do template Meta com botão FLOW. Padrão: flowmedi_confirmacao_flow.';

UPDATE public.system_message_templates
SET
  whatsapp_meta_phrase = 'Confirme sua consulta pelo botão abaixo.',
  body_text = 'Olá {{nome_paciente}}! Sua consulta está próxima. Toque no botão para confirmar, cancelar ou remarcar.',
  body_html = 'Olá {{nome_paciente}}! Sua consulta está próxima. Toque no botão para confirmar, cancelar ou remarcar.',
  updated_at = now()
WHERE event_code = 'appointment_confirmation_request'
  AND channel = 'whatsapp';

UPDATE public.system_message_templates
SET
  whatsapp_meta_phrase = 'Lembramos que sua consulta ainda aguarda confirmação. Toque no botão abaixo.',
  updated_at = now()
WHERE event_code = 'appointment_confirmation_followup'
  AND channel = 'whatsapp';
