-- Paginação de mensagens WhatsApp: índice composto (sent_at + id só como desempate de cursor)
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_sent_at_id
  ON public.whatsapp_messages (conversation_id, sent_at DESC, id DESC);

-- Isolamento multi-tenant: um phone_number_id connected só pode pertencer a uma clínica
CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_integrations_wa_phone_connected
  ON public.clinic_integrations ((metadata->>'phone_number_id'))
  WHERE status = 'connected'
    AND integration_type IN ('whatsapp_meta', 'whatsapp_simple')
    AND coalesce(metadata->>'phone_number_id', '') <> '';
