-- Migration: Garantir status 'completed' no CHECK constraint de event_timeline
-- Idempotente — seguro re-executar em ambientes onde migration-eventos-consultas-full.sql não rodou.
-- Execute no SQL Editor do Supabase.

ALTER TABLE public.event_timeline
  DROP CONSTRAINT IF EXISTS event_timeline_status_check;

ALTER TABLE public.event_timeline
  ADD CONSTRAINT event_timeline_status_check
  CHECK (status IN ('pending', 'sent', 'completed_without_send', 'completed', 'ignored', 'failed'));

COMMENT ON COLUMN public.event_timeline.status IS 'pending: aguardando; sent: enviado; completed_without_send: ok sem enviar; completed: usuário clicou Concluir; ignored; failed';
