-- Metas de relatórios por clínica (Sprint 2+)
-- Permite configurar metas operacionais sem hardcode no app.

CREATE TABLE IF NOT EXISTS public.clinic_report_goals (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  target_confirmation_pct int NOT NULL DEFAULT 85 CHECK (target_confirmation_pct >= 0 AND target_confirmation_pct <= 100),
  target_attendance_pct int NOT NULL DEFAULT 80 CHECK (target_attendance_pct >= 0 AND target_attendance_pct <= 100),
  target_no_show_pct int NOT NULL DEFAULT 8 CHECK (target_no_show_pct >= 0 AND target_no_show_pct <= 100),
  target_occupancy_pct int NOT NULL DEFAULT 75 CHECK (target_occupancy_pct >= 0 AND target_occupancy_pct <= 100),
  target_return_pct int NOT NULL DEFAULT 60 CHECK (target_return_pct >= 0 AND target_return_pct <= 100),
  return_window_days int NOT NULL DEFAULT 30 CHECK (return_window_days >= 1 AND return_window_days <= 180),
  working_hours_start int NOT NULL DEFAULT 8 CHECK (working_hours_start >= 0 AND working_hours_start <= 23),
  working_hours_end int NOT NULL DEFAULT 18 CHECK (working_hours_end >= 0 AND working_hours_end <= 23),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clinic_report_goals IS 'Metas operacionais configuráveis por clínica para relatórios e alertas.';

ALTER TABLE public.clinic_report_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_report_goals_clinic" ON public.clinic_report_goals;
CREATE POLICY "clinic_report_goals_clinic"
  ON public.clinic_report_goals
  FOR ALL
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_clinic_report_goals_updated_at
  ON public.clinic_report_goals(updated_at DESC);
