-- Migration: log de eventos do assistente virtual WhatsApp (diagnóstico)
-- Execute no SQL Editor do Supabase após migration-virtual-assistant.sql

CREATE TABLE IF NOT EXISTS public.whatsapp_ai_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  stage text NOT NULL,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  detail jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_event_log_clinic
  ON public.whatsapp_ai_event_log(clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_event_log_conversation
  ON public.whatsapp_ai_event_log(conversation_id, created_at DESC)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE public.whatsapp_ai_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "va_event_log_read" ON public.whatsapp_ai_event_log;
CREATE POLICY "va_event_log_read" ON public.whatsapp_ai_event_log
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );
