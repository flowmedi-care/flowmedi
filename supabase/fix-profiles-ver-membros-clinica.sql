-- Permite que qualquer membro da clínica (secretária, médico, admin) veja
-- os perfis da mesma clínica. Necessário para: dropdown de médico na Agenda,
-- lista de membros, etc.
-- Execute no Supabase: SQL Editor → New query → Cole → Run.

CREATE POLICY "profiles_select_same_clinic"
  ON public.profiles FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND COALESCE(active, true) = true
    )
  );
