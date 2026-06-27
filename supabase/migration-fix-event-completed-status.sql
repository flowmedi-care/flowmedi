-- Migration: Garantir status 'completed' no CHECK constraint de event_timeline
-- Idempotente — seguro re-executar.
-- Execute no SQL Editor do Supabase.
--
-- Para corrigir apenas o botão "Concluir", rode SOMENTE este arquivo.
-- Não é necessário rodar migration-eventos-consultas-full.sql inteiro se já
-- tiver as funções de eventos instaladas (evita conflito de sobrecargas).

ALTER TABLE public.event_timeline
  DROP CONSTRAINT IF EXISTS event_timeline_status_check;

ALTER TABLE public.event_timeline
  ADD CONSTRAINT event_timeline_status_check
  CHECK (status IN ('pending', 'sent', 'completed_without_send', 'completed', 'ignored', 'failed'));

COMMENT ON COLUMN public.event_timeline.status IS 'pending: aguardando; sent: enviado; completed_without_send: ok sem enviar; completed: usuário clicou Concluir; ignored; failed';
