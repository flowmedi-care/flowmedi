-- Fix RLS para Agenda e Consultas: consultas aparecem na Auditoria/tabela
-- mas não nas páginas porque as policies usam subquery em profiles, que pode
-- falhar ou causar recursão. Esta migration usa get_my_clinic_id() em
-- appointments, patients e appointment_types.
-- Execute no Supabase: SQL Editor → New query → Cole → Run.

-- 1) Função que retorna o clinic_id do usuário (SECURITY DEFINER = ignora RLS)
CREATE OR REPLACE FUNCTION public.get_my_clinic_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT clinic_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_clinic_id() TO anon;

-- 2) Appointments
DROP POLICY IF EXISTS "Appointments por clínica" ON public.appointments;
CREATE POLICY "Appointments por clínica"
  ON public.appointments
  FOR ALL
  USING (clinic_id = public.get_my_clinic_id())
  WITH CHECK (clinic_id = public.get_my_clinic_id());

-- 3) Patients (join na Agenda/Consultas)
DROP POLICY IF EXISTS "Patients por clínica" ON public.patients;
CREATE POLICY "Patients por clínica"
  ON public.patients
  FOR ALL
  USING (clinic_id = public.get_my_clinic_id())
  WITH CHECK (clinic_id = public.get_my_clinic_id());

-- 4) Appointment types (join na Agenda/Consultas)
DROP POLICY IF EXISTS "Appointment types por clínica" ON public.appointment_types;
CREATE POLICY "Appointment types por clínica"
  ON public.appointment_types
  FOR ALL
  USING (clinic_id = public.get_my_clinic_id())
  WITH CHECK (clinic_id = public.get_my_clinic_id());

-- 5) Garantir que perfis da mesma clínica sejam visíveis (dropdown médico na Agenda)
DROP POLICY IF EXISTS "Perfil próprio" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_select_same_clinic" ON public.profiles;
CREATE POLICY "profiles_select_same_clinic"
  ON public.profiles FOR SELECT
  USING (clinic_id = public.get_my_clinic_id());
