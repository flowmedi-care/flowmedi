-- Migration: Case Management core (Fase 3 / V5+)
-- Case Aggregate Root mínimo + Tasks + Domain Events + form allowed_contexts

-- ========== JOURNEY CASES ==========
CREATE TABLE IF NOT EXISTS public.journey_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  contact_id text NOT NULL,
  lead_id uuid REFERENCES public.non_registered_pipeline(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  journey_type text NOT NULL DEFAULT 'primeira_consulta'
    CHECK (journey_type IN (
      'primeira_consulta', 'retorno', 'tratamento', 'reativacao', 'suporte', 'orcamento'
    )),
  phase text NOT NULL DEFAULT 'captacao'
    CHECK (phase IN (
      'captacao', 'comercial', 'consulta', 'financeiro', 'pos', 'reengajamento', 'perdido', 'fechado'
    )),
  owner text NOT NULL DEFAULT 'system',
  pending_decision jsonb,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'waiting', 'closed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journey_cases_one_open_contact
  ON public.journey_cases (clinic_id, contact_id)
  WHERE status IN ('open', 'waiting');

CREATE INDEX IF NOT EXISTS idx_journey_cases_clinic_phase
  ON public.journey_cases (clinic_id, phase);
CREATE INDEX IF NOT EXISTS idx_journey_cases_clinic_status
  ON public.journey_cases (clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_journey_cases_lead
  ON public.journey_cases (lead_id);
CREATE INDEX IF NOT EXISTS idx_journey_cases_patient
  ON public.journey_cases (patient_id);

COMMENT ON TABLE public.journey_cases IS
  'Case Aggregate Root — estado operacional mínimo. phase é materializado (verdade = events).';
COMMENT ON COLUMN public.journey_cases.contact_id IS
  'Chave estável lead:<id> ou patient:<id>';
COMMENT ON COLUMN public.journey_cases.phase IS
  'Read model materializado; rebuildável a partir de journey_events';
COMMENT ON COLUMN public.journey_cases.pending_decision IS
  '{ actor_role, label?, due_at? } — quem precisa decidir agora';

-- ========== CASE TASKS ==========
CREATE TABLE IF NOT EXISTS public.case_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.journey_cases(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'cancelled')),
  assignee_role text,
  due_at timestamptz,
  source_event_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_tasks_case ON public.case_tasks (case_id);
CREATE INDEX IF NOT EXISTS idx_case_tasks_clinic_status ON public.case_tasks (clinic_id, status);

COMMENT ON TABLE public.case_tasks IS
  'Tasks do aggregate Case — o que precisa ser feito (≠ pending_decision)';

-- ========== JOURNEY EVENTS ==========
CREATE TABLE IF NOT EXISTS public.journey_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.journey_cases(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'domain'
    CHECK (category IN ('domain', 'integration', 'internal')),
  event_type text NOT NULL,
  actor text NOT NULL DEFAULT 'system',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journey_events_case_created
  ON public.journey_events (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_events_clinic_type
  ON public.journey_events (clinic_id, event_type);
CREATE INDEX IF NOT EXISTS idx_journey_events_category
  ON public.journey_events (clinic_id, category, created_at DESC);

COMMENT ON TABLE public.journey_events IS
  'Event store — Domain / Integration / Internal. Fonte da verdade histórica.';

-- ========== FORM TEMPLATES: allowed_contexts ==========
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS allowed_contexts text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.form_templates.allowed_contexts IS
  'Contextos em que o template pode ser disparado: captacao, pre_consulta, pos_consulta, retorno, cirurgia, financeiro, comercial, feedback';

-- ========== RLS ==========
ALTER TABLE public.journey_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journey_cases_select_clinic" ON public.journey_cases;
DROP POLICY IF EXISTS "journey_cases_insert_clinic" ON public.journey_cases;
DROP POLICY IF EXISTS "journey_cases_update_clinic" ON public.journey_cases;

CREATE POLICY "journey_cases_select_clinic" ON public.journey_cases FOR SELECT
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND active = true));
CREATE POLICY "journey_cases_insert_clinic" ON public.journey_cases FOR INSERT
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND active = true));
CREATE POLICY "journey_cases_update_clinic" ON public.journey_cases FOR UPDATE
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "case_tasks_select_clinic" ON public.case_tasks;
DROP POLICY IF EXISTS "case_tasks_insert_clinic" ON public.case_tasks;
DROP POLICY IF EXISTS "case_tasks_update_clinic" ON public.case_tasks;

CREATE POLICY "case_tasks_select_clinic" ON public.case_tasks FOR SELECT
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND active = true));
CREATE POLICY "case_tasks_insert_clinic" ON public.case_tasks FOR INSERT
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND active = true));
CREATE POLICY "case_tasks_update_clinic" ON public.case_tasks FOR UPDATE
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND active = true));

DROP POLICY IF EXISTS "journey_events_select_clinic" ON public.journey_events;
DROP POLICY IF EXISTS "journey_events_insert_clinic" ON public.journey_events;

CREATE POLICY "journey_events_select_clinic" ON public.journey_events FOR SELECT
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND active = true));
CREATE POLICY "journey_events_insert_clinic" ON public.journey_events FOR INSERT
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND active = true));

-- ========== updated_at ==========
CREATE OR REPLACE FUNCTION public.update_journey_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_journey_cases_updated_at ON public.journey_cases;
CREATE TRIGGER trigger_journey_cases_updated_at
  BEFORE UPDATE ON public.journey_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_journey_cases_updated_at();

CREATE OR REPLACE FUNCTION public.update_case_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_case_tasks_updated_at ON public.case_tasks;
CREATE TRIGGER trigger_case_tasks_updated_at
  BEFORE UPDATE ON public.case_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_case_tasks_updated_at();

-- ========== BACKFILL: 1 open case per active lead ==========
INSERT INTO public.journey_cases (
  clinic_id, contact_id, lead_id, patient_id, journey_type, phase, owner, status, opened_at
)
SELECT
  p.clinic_id,
  'lead:' || p.id::text,
  p.id,
  p.patient_id,
  CASE
    WHEN p.lifecycle_stage = 'cliente' THEN 'retorno'
    ELSE 'primeira_consulta'
  END,
  CASE
    WHEN p.lifecycle_stage = 'perdido' THEN 'perdido'
    WHEN p.lifecycle_stage IN ('oportunidade', 'cliente') THEN 'consulta'
    WHEN p.lifecycle_stage = 'qualificado' THEN 'comercial'
    WHEN p.lifecycle_stage IN ('lead_novo', 'em_qualificacao') THEN 'captacao'
    ELSE 'captacao'
  END,
  'system',
  CASE WHEN p.lifecycle_stage = 'perdido' THEN 'closed' ELSE 'open' END,
  COALESCE(p.created_at, now())
FROM public.non_registered_pipeline p
WHERE NOT EXISTS (
  SELECT 1 FROM public.journey_cases c
  WHERE c.clinic_id = p.clinic_id AND c.contact_id = 'lead:' || p.id::text
);
