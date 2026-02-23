-- created_by: quem criou/alterou o agendamento (para relatórios por atendente)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.appointments.created_by IS 'Usuário que criou o agendamento (admin ou secretária)';

CREATE INDEX IF NOT EXISTS idx_appointments_created_by ON public.appointments(created_by) WHERE created_by IS NOT NULL;

-- Auditoria: histórico de ações para relatório e controle
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS 'Histórico de ações para relatórios e auditoria (admin)';

CREATE INDEX IF NOT EXISTS idx_audit_log_clinic ON public.audit_log(clinic_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_clinic" ON public.audit_log;
CREATE POLICY "audit_log_clinic"
  ON public.audit_log
  FOR ALL
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );
