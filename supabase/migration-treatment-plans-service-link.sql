-- Link treatment plans to services and procedures

ALTER TABLE public.treatment_plans
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_treatment_plans_service
  ON public.treatment_plans (clinic_id, service_id, status);
