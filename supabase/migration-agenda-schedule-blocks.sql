-- Períodos indisponíveis na agenda (bloqueios avulsos e recorrentes).

CREATE TABLE IF NOT EXISTS public.schedule_blocks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  block_kind text NOT NULL CHECK (block_kind IN ('once', 'recurring')),
  starts_at timestamptz,
  ends_at timestamptz,
  recurrence_frequency text CHECK (recurrence_frequency IN ('semanal', 'quinzenal', 'mensal')),
  recurrence_weekday smallint CHECK (recurrence_weekday BETWEEN 0 AND 6),
  time_start time NOT NULL,
  time_end time NOT NULL,
  recurrence_start_date date,
  recurrence_end_date date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT schedule_blocks_once_requires_ts CHECK (
    block_kind <> 'once' OR (starts_at IS NOT NULL AND ends_at IS NOT NULL)
  ),
  CONSTRAINT schedule_blocks_recurring_requires_rule CHECK (
    block_kind <> 'recurring' OR (
      recurrence_frequency IS NOT NULL
      AND recurrence_start_date IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_clinic_doctor
  ON public.schedule_blocks(clinic_id, doctor_id);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_clinic_once_range
  ON public.schedule_blocks(clinic_id, starts_at, ends_at)
  WHERE block_kind = 'once';

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_clinic_recurring
  ON public.schedule_blocks(clinic_id, recurrence_start_date)
  WHERE block_kind = 'recurring';

ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_blocks_clinic_access"
  ON public.schedule_blocks FOR ALL
  USING (clinic_id = public.get_my_clinic_id())
  WITH CHECK (clinic_id = public.get_my_clinic_id());
