-- Fase 1: Confiabilidade operacional (WhatsApp + janela de envio automático)
-- 1) Limite mensal de conversas iniciadas fora da janela de 24h (templates Meta)
-- 2) Janela de horário + fuso para envios automáticos (cron)

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS whatsapp_monthly_post24h_limit integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_message_send_start time DEFAULT '08:00:00',
  ADD COLUMN IF NOT EXISTS auto_message_send_end time DEFAULT '20:00:00',
  ADD COLUMN IF NOT EXISTS auto_message_timezone text DEFAULT 'America/Sao_Paulo';

COMMENT ON COLUMN public.clinics.whatsapp_monthly_post24h_limit IS 'Limite mensal de novas conversas iniciadas por template fora da janela de 24h. NULL = sem limite.';
COMMENT ON COLUMN public.clinics.auto_message_send_start IS 'Horário inicial permitido para envios automáticos (cron), no fuso da clínica.';
COMMENT ON COLUMN public.clinics.auto_message_send_end IS 'Horário final permitido para envios automáticos (cron), no fuso da clínica.';
COMMENT ON COLUMN public.clinics.auto_message_timezone IS 'Fuso usado para validar a janela de envio automático (ex.: America/Sao_Paulo).';

CREATE TABLE IF NOT EXISTS public.whatsapp_post24h_usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  source text NOT NULL CHECK (source IN ('event_auto', 'event_manual')),
  event_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_post24h_usage IS 'Registro de conversas iniciadas via template fora da janela de 24h para controle de custo.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_post24h_usage_clinic_created_at
  ON public.whatsapp_post24h_usage(clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_post24h_usage_clinic_phone_created_at
  ON public.whatsapp_post24h_usage(clinic_id, phone_number, created_at DESC);

ALTER TABLE public.whatsapp_post24h_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_post24h_usage_clinic_access" ON public.whatsapp_post24h_usage;
CREATE POLICY "whatsapp_post24h_usage_clinic_access"
  ON public.whatsapp_post24h_usage FOR ALL
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );
