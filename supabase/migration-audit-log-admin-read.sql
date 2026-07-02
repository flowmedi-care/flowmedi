-- Restringe leitura do audit_log a administradores da clínica.
-- Execute no SQL Editor do Supabase.

DROP POLICY IF EXISTS "Audit log por clínica" ON public.audit_log;

CREATE POLICY "Audit log read admin"
  ON public.audit_log
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Audit log insert clinic members"
  ON public.audit_log
  FOR INSERT
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );
