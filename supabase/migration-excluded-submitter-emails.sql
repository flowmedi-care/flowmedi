-- Emails que não devem mais aparecer em "Não cadastrados" (ex.: paciente foi cadastrado e depois excluído)
CREATE TABLE IF NOT EXISTS public.excluded_submitter_emails (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, email)
);

CREATE INDEX IF NOT EXISTS idx_excluded_submitter_emails_clinic ON public.excluded_submitter_emails(clinic_id);
CREATE INDEX IF NOT EXISTS idx_excluded_submitter_emails_email ON public.excluded_submitter_emails(email);

ALTER TABLE public.excluded_submitter_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "excluded_submitter_select_clinic" ON public.excluded_submitter_emails;
DROP POLICY IF EXISTS "excluded_submitter_insert_clinic" ON public.excluded_submitter_emails;

CREATE POLICY "excluded_submitter_select_clinic"
  ON public.excluded_submitter_emails FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND active = true
    )
  );

CREATE POLICY "excluded_submitter_insert_clinic"
  ON public.excluded_submitter_emails FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND active = true
    )
  );

COMMENT ON TABLE public.excluded_submitter_emails IS 'Emails que não devem aparecer em Não cadastrados (ex.: paciente cadastrado a partir do formulário público e depois excluído)';
