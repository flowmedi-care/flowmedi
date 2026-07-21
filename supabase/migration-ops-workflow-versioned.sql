-- Migration: ProcessType + Workflow + Version + Phase + Transition (arquitetura 10/10)
-- Evolui journey_cases para Case magro versionado. Seguro se core anterior já rodou.

-- ========== PROCESS TYPES ==========
CREATE TABLE IF NOT EXISTS public.process_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE
    CHECK (code IN (
      'primeira_consulta', 'retorno', 'tratamento', 'reativacao', 'suporte', 'orcamento'
    )),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.process_types (code, name) VALUES
  ('primeira_consulta', 'Primeira consulta'),
  ('retorno', 'Retorno'),
  ('tratamento', 'Tratamento'),
  ('reativacao', 'Reativação'),
  ('suporte', 'Suporte'),
  ('orcamento', 'Orçamento')
ON CONFLICT (code) DO NOTHING;

-- ========== WORKFLOWS ==========
CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  process_type_id uuid NOT NULL REFERENCES public.process_types(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, code)
);

-- clinic_id NULL = workflow sistema (seed global)
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_system_code
  ON public.workflows (code) WHERE clinic_id IS NULL;

-- ========== WORKFLOW VERSIONS ==========
CREATE TABLE IF NOT EXISTS public.workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'deprecated')),
  automation_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, version)
);

CREATE INDEX IF NOT EXISTS idx_workflow_versions_status
  ON public.workflow_versions (workflow_id, status);

-- ========== PHASES ==========
CREATE TABLE IF NOT EXISTS public.workflow_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id uuid NOT NULL REFERENCES public.workflow_versions(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  terminal boolean NOT NULL DEFAULT false,
  UNIQUE (workflow_version_id, code)
);

CREATE INDEX IF NOT EXISTS idx_workflow_phases_version
  ON public.workflow_phases (workflow_version_id, sort_order);

-- ========== TRANSITIONS ==========
CREATE TABLE IF NOT EXISTS public.workflow_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_version_id uuid NOT NULL REFERENCES public.workflow_versions(id) ON DELETE CASCADE,
  from_phase_id uuid NOT NULL REFERENCES public.workflow_phases(id) ON DELETE CASCADE,
  to_phase_id uuid NOT NULL REFERENCES public.workflow_phases(id) ON DELETE CASCADE,
  trigger_type text NOT NULL DEFAULT 'manual'
    CHECK (trigger_type IN ('manual', 'event', 'automation')),
  trigger_ref text,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_transitions_version
  ON public.workflow_transitions (workflow_version_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_trigger
  ON public.workflow_transitions (workflow_version_id, trigger_type, trigger_ref);

-- ========== SEED: system workflows (clinic_id NULL) ==========
DO $$
DECLARE
  pt_primeira uuid;
  pt_retorno uuid;
  pt_tratamento uuid;
  pt_reativacao uuid;
  wf_id uuid;
  wv_id uuid;
  p_captacao uuid;
  p_comercial uuid;
  p_consulta uuid;
  p_pos uuid;
  p_perdido uuid;
  p_ret_marcado uuid;
  p_tratamento uuid;
  p_sessoes uuid;
  p_alta uuid;
  p_tentativas uuid;
  p_contato uuid;
  p_retornou uuid;
BEGIN
  SELECT id INTO pt_primeira FROM public.process_types WHERE code = 'primeira_consulta';
  SELECT id INTO pt_retorno FROM public.process_types WHERE code = 'retorno';
  SELECT id INTO pt_tratamento FROM public.process_types WHERE code = 'tratamento';
  SELECT id INTO pt_reativacao FROM public.process_types WHERE code = 'reativacao';

  -- primeira_consulta default
  INSERT INTO public.workflows (clinic_id, process_type_id, code, name)
  VALUES (NULL, pt_primeira, 'primeira_consulta_default', 'Primeira consulta')
  ON CONFLICT DO NOTHING;
  SELECT id INTO wf_id FROM public.workflows WHERE clinic_id IS NULL AND code = 'primeira_consulta_default';

  IF NOT EXISTS (SELECT 1 FROM public.workflow_versions WHERE workflow_id = wf_id AND version = 1) THEN
    INSERT INTO public.workflow_versions (workflow_id, version, status, automation_policy)
    VALUES (
      wf_id,
      1,
      'published',
      '{
        "on_enter_phase": {
          "consulta": ["send_confirmation"],
          "comercial": ["create_task:Enviar orçamento / agendar"],
          "pos": ["create_task:Receber pagamento"]
        }
      }'::jsonb
    )
    RETURNING id INTO wv_id;

    INSERT INTO public.workflow_phases (workflow_version_id, code, name, sort_order, terminal) VALUES
      (wv_id, 'captacao', 'Captação', 1, false),
      (wv_id, 'comercial', 'Comercial', 2, false),
      (wv_id, 'consulta', 'Consulta', 3, false),
      (wv_id, 'pos', 'Pós', 4, true),
      (wv_id, 'perdido', 'Perdido', 5, true);

    SELECT id INTO p_captacao FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'captacao';
    SELECT id INTO p_comercial FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'comercial';
    SELECT id INTO p_consulta FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'consulta';
    SELECT id INTO p_pos FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'pos';
    SELECT id INTO p_perdido FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'perdido';

    INSERT INTO public.workflow_transitions (workflow_version_id, from_phase_id, to_phase_id, trigger_type, trigger_ref) VALUES
      (wv_id, p_captacao, p_comercial, 'event', 'Lead.Qualified'),
      (wv_id, p_captacao, p_perdido, 'event', 'Lead.Disqualified'),
      (wv_id, p_comercial, p_consulta, 'event', 'Appointment.Created'),
      (wv_id, p_comercial, p_consulta, 'event', 'Lead.Converted'),
      (wv_id, p_consulta, p_pos, 'event', 'Appointment.Completed'),
      (wv_id, p_consulta, p_captacao, 'event', 'Appointment.NoShow'),
      (wv_id, p_captacao, p_comercial, 'manual', NULL),
      (wv_id, p_comercial, p_consulta, 'manual', NULL),
      (wv_id, p_consulta, p_pos, 'manual', NULL),
      (wv_id, p_comercial, p_perdido, 'manual', NULL);
  END IF;

  -- retorno
  INSERT INTO public.workflows (clinic_id, process_type_id, code, name)
  VALUES (NULL, pt_retorno, 'retorno_default', 'Retorno')
  ON CONFLICT DO NOTHING;
  SELECT id INTO wf_id FROM public.workflows WHERE clinic_id IS NULL AND code = 'retorno_default';
  IF NOT EXISTS (SELECT 1 FROM public.workflow_versions WHERE workflow_id = wf_id AND version = 1) THEN
    INSERT INTO public.workflow_versions (workflow_id, version, status)
    VALUES (wf_id, 1, 'published') RETURNING id INTO wv_id;
    INSERT INTO public.workflow_phases (workflow_version_id, code, name, sort_order, terminal) VALUES
      (wv_id, 'retorno_marcado', 'Retorno marcado', 1, false),
      (wv_id, 'consulta', 'Consulta', 2, false),
      (wv_id, 'pos', 'Pós', 3, true);
    SELECT id INTO p_ret_marcado FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'retorno_marcado';
    SELECT id INTO p_consulta FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'consulta';
    SELECT id INTO p_pos FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'pos';
    INSERT INTO public.workflow_transitions (workflow_version_id, from_phase_id, to_phase_id, trigger_type, trigger_ref) VALUES
      (wv_id, p_ret_marcado, p_consulta, 'event', 'Appointment.Created'),
      (wv_id, p_consulta, p_pos, 'event', 'Appointment.Completed'),
      (wv_id, p_ret_marcado, p_consulta, 'manual', NULL),
      (wv_id, p_consulta, p_pos, 'manual', NULL);
  END IF;

  -- tratamento
  INSERT INTO public.workflows (clinic_id, process_type_id, code, name)
  VALUES (NULL, pt_tratamento, 'tratamento_default', 'Tratamento')
  ON CONFLICT DO NOTHING;
  SELECT id INTO wf_id FROM public.workflows WHERE clinic_id IS NULL AND code = 'tratamento_default';
  IF NOT EXISTS (SELECT 1 FROM public.workflow_versions WHERE workflow_id = wf_id AND version = 1) THEN
    INSERT INTO public.workflow_versions (workflow_id, version, status)
    VALUES (wf_id, 1, 'published') RETURNING id INTO wv_id;
    INSERT INTO public.workflow_phases (workflow_version_id, code, name, sort_order, terminal) VALUES
      (wv_id, 'tratamento', 'Tratamento', 1, false),
      (wv_id, 'sessoes', 'Sessões', 2, false),
      (wv_id, 'alta', 'Alta', 3, true);
    SELECT id INTO p_tratamento FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'tratamento';
    SELECT id INTO p_sessoes FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'sessoes';
    SELECT id INTO p_alta FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'alta';
    INSERT INTO public.workflow_transitions (workflow_version_id, from_phase_id, to_phase_id, trigger_type, trigger_ref) VALUES
      (wv_id, p_tratamento, p_sessoes, 'manual', NULL),
      (wv_id, p_sessoes, p_alta, 'manual', NULL);
  END IF;

  -- reativacao
  INSERT INTO public.workflows (clinic_id, process_type_id, code, name)
  VALUES (NULL, pt_reativacao, 'reativacao_default', 'Reativação')
  ON CONFLICT DO NOTHING;
  SELECT id INTO wf_id FROM public.workflows WHERE clinic_id IS NULL AND code = 'reativacao_default';
  IF NOT EXISTS (SELECT 1 FROM public.workflow_versions WHERE workflow_id = wf_id AND version = 1) THEN
    INSERT INTO public.workflow_versions (workflow_id, version, status)
    VALUES (wf_id, 1, 'published') RETURNING id INTO wv_id;
    INSERT INTO public.workflow_phases (workflow_version_id, code, name, sort_order, terminal) VALUES
      (wv_id, 'tentativas', 'Tentativas', 1, false),
      (wv_id, 'contato', 'Contato', 2, false),
      (wv_id, 'retornou', 'Retornou', 3, false),
      (wv_id, 'consulta', 'Consulta', 4, true);
    SELECT id INTO p_tentativas FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'tentativas';
    SELECT id INTO p_contato FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'contato';
    SELECT id INTO p_retornou FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'retornou';
    SELECT id INTO p_consulta FROM public.workflow_phases WHERE workflow_version_id = wv_id AND code = 'consulta';
    INSERT INTO public.workflow_transitions (workflow_version_id, from_phase_id, to_phase_id, trigger_type, trigger_ref) VALUES
      (wv_id, p_tentativas, p_contato, 'manual', NULL),
      (wv_id, p_contato, p_retornou, 'manual', NULL),
      (wv_id, p_retornou, p_consulta, 'event', 'Appointment.Created'),
      (wv_id, p_retornou, p_consulta, 'manual', NULL);
  END IF;
END $$;

-- ========== EVOLVE journey_cases ==========
ALTER TABLE public.journey_cases
  ADD COLUMN IF NOT EXISTS process_type_id uuid REFERENCES public.process_types(id),
  ADD COLUMN IF NOT EXISTS workflow_version_id uuid REFERENCES public.workflow_versions(id),
  ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES public.workflow_phases(id),
  ADD COLUMN IF NOT EXISTS owner_type text NOT NULL DEFAULT 'system'
    CHECK (owner_type IN ('ai', 'human', 'system', 'patient')),
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS execution_context jsonb;

-- Map legacy status open/waiting/closed → active/waiting/completed/cancelled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'journey_cases' AND column_name = 'status'
  ) THEN
    -- Drop old check by recreating constraint loosely
    ALTER TABLE public.journey_cases DROP CONSTRAINT IF EXISTS journey_cases_status_check;
    UPDATE public.journey_cases SET status = 'active' WHERE status = 'open';
    UPDATE public.journey_cases SET status = 'completed' WHERE status = 'closed';
    ALTER TABLE public.journey_cases
      ADD CONSTRAINT journey_cases_status_check
      CHECK (status IN ('active', 'waiting', 'completed', 'cancelled'));
  END IF;
END $$;

-- Backfill process_type / workflow_version / phase_id from legacy journey_type + phase
UPDATE public.journey_cases jc
SET
  process_type_id = pt.id,
  owner_type = CASE
    WHEN jc.owner = 'ai' OR jc.owner LIKE 'ai:%' THEN 'ai'
    WHEN jc.owner LIKE 'human:%' THEN 'human'
    ELSE 'system'
  END
FROM public.process_types pt
WHERE jc.process_type_id IS NULL
  AND pt.code = COALESCE(jc.journey_type, 'primeira_consulta');

UPDATE public.journey_cases jc
SET workflow_version_id = wv.id
FROM public.workflows w
JOIN public.workflow_versions wv ON wv.workflow_id = w.id AND wv.status = 'published'
JOIN public.process_types pt ON pt.id = w.process_type_id
WHERE jc.workflow_version_id IS NULL
  AND jc.process_type_id = pt.id
  AND w.clinic_id IS NULL
  AND w.code = CASE pt.code
    WHEN 'primeira_consulta' THEN 'primeira_consulta_default'
    WHEN 'retorno' THEN 'retorno_default'
    WHEN 'tratamento' THEN 'tratamento_default'
    WHEN 'reativacao' THEN 'reativacao_default'
    ELSE 'primeira_consulta_default'
  END;

-- Map legacy phase text → phase_id (fallback first non-terminal phase)
UPDATE public.journey_cases jc
SET phase_id = wp.id
FROM public.workflow_phases wp
WHERE jc.phase_id IS NULL
  AND jc.workflow_version_id = wp.workflow_version_id
  AND wp.code = COALESCE(
    CASE jc.phase
      WHEN 'financeiro' THEN 'pos'
      WHEN 'reengajamento' THEN 'captacao'
      WHEN 'fechado' THEN 'pos'
      ELSE jc.phase
    END,
    'captacao'
  );

UPDATE public.journey_cases jc
SET phase_id = sub.id
FROM (
  SELECT DISTINCT ON (workflow_version_id) id, workflow_version_id
  FROM public.workflow_phases
  ORDER BY workflow_version_id, sort_order
) sub
WHERE jc.phase_id IS NULL
  AND jc.workflow_version_id = sub.workflow_version_id;

-- Unique open cases: active|waiting
DROP INDEX IF EXISTS idx_journey_cases_one_open_contact;
CREATE UNIQUE INDEX IF NOT EXISTS idx_journey_cases_one_active_contact
  ON public.journey_cases (clinic_id, contact_id)
  WHERE status IN ('active', 'waiting');

CREATE INDEX IF NOT EXISTS idx_journey_cases_workflow_version
  ON public.journey_cases (workflow_version_id);
CREATE INDEX IF NOT EXISTS idx_journey_cases_phase_id
  ON public.journey_cases (phase_id);

-- ========== TASKS: ensure type column ==========
ALTER TABLE public.case_tasks
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS assigned_to text;

-- ========== RLS for new tables ==========
ALTER TABLE public.process_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "process_types_select_all" ON public.process_types;
CREATE POLICY "process_types_select_all" ON public.process_types FOR SELECT USING (true);

DROP POLICY IF EXISTS "workflows_select" ON public.workflows;
CREATE POLICY "workflows_select" ON public.workflows FOR SELECT
  USING (
    clinic_id IS NULL
    OR clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND active = true)
  );

DROP POLICY IF EXISTS "workflow_versions_select" ON public.workflow_versions;
CREATE POLICY "workflow_versions_select" ON public.workflow_versions FOR SELECT
  USING (
    workflow_id IN (
      SELECT id FROM public.workflows
      WHERE clinic_id IS NULL
         OR clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND active = true)
    )
  );

DROP POLICY IF EXISTS "workflow_phases_select" ON public.workflow_phases;
CREATE POLICY "workflow_phases_select" ON public.workflow_phases FOR SELECT
  USING (
    workflow_version_id IN (SELECT id FROM public.workflow_versions)
  );

DROP POLICY IF EXISTS "workflow_transitions_select" ON public.workflow_transitions;
CREATE POLICY "workflow_transitions_select" ON public.workflow_transitions FOR SELECT
  USING (
    workflow_version_id IN (SELECT id FROM public.workflow_versions)
  );

COMMENT ON TABLE public.workflow_versions IS
  'Versionamento imutável do fluxo. Cases apontam para version; status draft|published|deprecated ≠ Case.status';
COMMENT ON COLUMN public.journey_cases.execution_context IS
  'Execução técnica em voo (tool/correlation) — distinto de pending_decision';
COMMENT ON COLUMN public.journey_cases.pending_decision IS
  '{ type, waiting_for, label?, due_at? } — quem decide o próximo passo de negócio';
