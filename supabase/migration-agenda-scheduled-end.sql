-- Agenda v2: horário de término explícito e duração prevista.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS planned_duration_minutes int;

COMMENT ON COLUMN public.appointments.scheduled_end_at IS 'Término previsto da consulta (definido pela secretaria no agendamento).';
COMMENT ON COLUMN public.appointments.planned_duration_minutes IS 'Duração prevista em minutos (scheduled_end_at - scheduled_at).';

-- Backfill: usa duração do tipo de consulta ou 30 min.
UPDATE public.appointments a
SET scheduled_end_at = a.scheduled_at + (
  COALESCE(
    (SELECT (at.duration_minutes || ' minutes')::interval
     FROM public.appointment_types at
     WHERE at.id = a.appointment_type_id),
    interval '30 minutes'
  )
)
WHERE a.scheduled_end_at IS NULL;

UPDATE public.appointments
SET planned_duration_minutes = GREATEST(
  0,
  ROUND(EXTRACT(EPOCH FROM (scheduled_end_at - scheduled_at)) / 60)::int
)
WHERE planned_duration_minutes IS NULL
  AND scheduled_end_at IS NOT NULL;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_scheduled_end_after_start;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_scheduled_end_after_start
  CHECK (scheduled_end_at IS NULL OR scheduled_end_at > scheduled_at);

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_interval
  ON public.appointments(clinic_id, doctor_id, scheduled_at, scheduled_end_at)
  WHERE status <> 'cancelada';
