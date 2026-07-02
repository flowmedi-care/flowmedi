-- LGPD Fases 2–5: DPA assinável, DSAR SLA, bloqueio/anonimização, retenção.
-- Execute após migration-consent-lgpd.sql (ver docs/compliance/MIGRATIONS-LGPD.md).

-- ========== DPA ASSINÁVEL ==========
CREATE TABLE IF NOT EXISTS public.clinic_dpa_acceptances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  accepted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dpa_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  UNIQUE (clinic_id, dpa_version)
);

ALTER TABLE public.clinic_dpa_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_dpa_acceptances_admin_read"
  ON public.clinic_dpa_acceptances
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "clinic_dpa_acceptances_admin_insert"
  ON public.clinic_dpa_acceptances
  FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    AND accepted_by = auth.uid()
  );

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS accepted_dpa_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_dpa_version text;

-- ========== DSAR: SLA e origem pública ==========
ALTER TABLE public.data_subject_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'clinic_panel'
    CHECK (source IN ('clinic_panel', 'public_portal', 'email', 'other')),
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_tier text NOT NULL DEFAULT 'standard'
    CHECK (sla_tier IN ('simple', 'standard'));

CREATE INDEX IF NOT EXISTS idx_dsar_clinic_due
  ON public.data_subject_requests(clinic_id, due_at)
  WHERE status IN ('open', 'in_progress');

-- Inserção pública via service role (API rate-limited)
CREATE POLICY "dsar_service_role_insert"
  ON public.data_subject_requests
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ========== PACIENTE: bloqueio / anonimização (CFM) ==========
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS data_blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

COMMENT ON COLUMN public.patients.data_blocked_at IS
  'Bloqueio de acesso operacional (ex.: solicitação de exclusão com prontuário ativo)';
COMMENT ON COLUMN public.patients.anonymized_at IS
  'Campos identificáveis anonimizados; registros clínicos mínimos podem permanecer por obrigação legal';

-- ========== RETENÇÃO OPERACIONAL (logs) ==========
CREATE TABLE IF NOT EXISTS public.compliance_retention_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ai_event_log_retention_days int NOT NULL DEFAULT 730,
  message_log_retention_days int NOT NULL DEFAULT 730,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.compliance_retention_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
