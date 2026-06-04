-- Recorrência de consultas: agrupa sessões da mesma série para edição em lote.
-- session_number já existe em migration-operational-flow-extensions.sql

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_appointments_recurrence_group
  ON public.appointments(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;
