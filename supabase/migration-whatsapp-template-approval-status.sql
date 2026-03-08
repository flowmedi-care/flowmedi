-- Controle de submissão e status de aprovação de templates WhatsApp na Meta (por clínica)

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS whatsapp_meta_template_name text,
  ADD COLUMN IF NOT EXISTS whatsapp_meta_template_id text,
  ADD COLUMN IF NOT EXISTS whatsapp_meta_status text,
  ADD COLUMN IF NOT EXISTS whatsapp_meta_last_error text,
  ADD COLUMN IF NOT EXISTS whatsapp_meta_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_meta_synced_at timestamptz;

COMMENT ON COLUMN public.message_templates.whatsapp_meta_template_name IS 'Nome do template criado no Meta por clínica.';
COMMENT ON COLUMN public.message_templates.whatsapp_meta_template_id IS 'ID do template no Meta/Graph API.';
COMMENT ON COLUMN public.message_templates.whatsapp_meta_status IS 'Status no Meta (APPROVED, PENDING, IN_REVIEW, REJECTED, PAUSED, DISABLED).';
COMMENT ON COLUMN public.message_templates.whatsapp_meta_last_error IS 'Último erro ao criar/sincronizar template na Meta.';
COMMENT ON COLUMN public.message_templates.whatsapp_meta_submitted_at IS 'Data da última submissão do template para aprovação na Meta.';
COMMENT ON COLUMN public.message_templates.whatsapp_meta_synced_at IS 'Data da última sincronização de status com a Meta.';

