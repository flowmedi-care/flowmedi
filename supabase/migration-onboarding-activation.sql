-- Ativação FlowMedi: estado de onboarding + eventos de produto

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS admin_also_practices boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_tour_step text,
  ADD COLUMN IF NOT EXISTS onboarding_mini_aha_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_aha_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_demo_seeded_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_demo_bundle jsonb;

COMMENT ON COLUMN public.clinics.admin_also_practices IS
  'Admin também aparece como profissional na agenda (default true na ativação).';
COMMENT ON COLUMN public.clinics.onboarding_tour_step IS
  'contact|appointment|attendance|payment|aha|done|skipped';
COMMENT ON COLUMN public.clinics.onboarding_demo_bundle IS
  'IDs do seed Maria + story metadata para purge.';

CREATE TABLE IF NOT EXISTS public.product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_events_clinic_event_idx
  ON public.product_events (clinic_id, event, created_at DESC);
CREATE INDEX IF NOT EXISTS product_events_event_created_idx
  ON public.product_events (event, created_at DESC);

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_events_insert_own_clinic" ON public.product_events;
CREATE POLICY "product_events_insert_own_clinic" ON public.product_events
  FOR INSERT TO authenticated
  WITH CHECK (
    clinic_id IS NULL
    OR clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "product_events_select_admin" ON public.product_events;
CREATE POLICY "product_events_select_admin" ON public.product_events
  FOR SELECT TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
    )
  );
