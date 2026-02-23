-- Migration: Tempo de atendimento (início e duração da consulta)
-- Quando o médico "chama" o paciente: started_at.
-- Ao marcar como realizada: completed_at e duration_minutes (desde started_at).
-- Permite controle total pelo médico (iniciar + marcar realizada) e visibilidade para a secretária.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_minutes int;

COMMENT ON COLUMN public.appointments.started_at IS 'Quando o médico chamou o paciente / iniciou a consulta';
COMMENT ON COLUMN public.appointments.completed_at IS 'Quando a consulta foi marcada como realizada';
COMMENT ON COLUMN public.appointments.duration_minutes IS 'Duração em minutos (completed_at - started_at), preenchido ao marcar realizada';

CREATE INDEX IF NOT EXISTS idx_appointments_started_at
  ON public.appointments(started_at) WHERE started_at IS NOT NULL;
