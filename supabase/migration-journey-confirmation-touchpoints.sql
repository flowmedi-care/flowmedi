-- Suporte a múltiplos toques de confirmação (7d, 2d, dia)
ALTER TABLE public.whatsapp_ai_confirmation_outreach
  ADD COLUMN IF NOT EXISTS touchpoint text NOT NULL DEFAULT '2d';

ALTER TABLE public.whatsapp_ai_confirmation_outreach
  DROP CONSTRAINT IF EXISTS whatsapp_ai_confirmation_outreach_appointment_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_ai_confirmation_outreach_appt_touch
  ON public.whatsapp_ai_confirmation_outreach(appointment_id, touchpoint);

COMMENT ON COLUMN public.whatsapp_ai_confirmation_outreach.touchpoint IS 'Toque da régua: 7d (leve), 2d (formal), day (lembrete)';
