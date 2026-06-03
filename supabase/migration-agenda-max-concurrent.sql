-- Capacidade simultânea na agenda (ex.: 2 consultórios).
-- NULL = sem limite na clínica (apenas conflito por médico).

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS agenda_max_concurrent int DEFAULT NULL;

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_agenda_max_concurrent_check;

ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_agenda_max_concurrent_check
  CHECK (agenda_max_concurrent IS NULL OR (agenda_max_concurrent >= 1 AND agenda_max_concurrent <= 20));

COMMENT ON COLUMN public.clinics.agenda_max_concurrent IS
  'Máximo de consultas simultâneas na clínica (consultórios). NULL = sem limite global; conflito só por médico.';
