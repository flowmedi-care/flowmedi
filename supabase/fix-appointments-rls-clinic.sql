-- Fix RLS em appointments: usar get_my_clinic_id() em vez de subquery em profiles.
-- A subquery (SELECT clinic_id FROM profiles WHERE id = auth.uid()) pode falhar
-- ou causar recursão quando profiles tem RLS. A função SECURITY DEFINER ignora RLS.

-- Garantir que a função exista (se já rodou fix-profiles-ver-membros-clinica, não quebra)
CREATE OR REPLACE FUNCTION public.get_my_clinic_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT clinic_id FROM public.profiles
  WHERE id = auth.uid() AND COALESCE(active, true) = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_clinic_id() TO anon;

-- Recriar policy de appointments usando a função (sem subquery em profiles)
DROP POLICY IF EXISTS "Appointments por clínica" ON public.appointments;

CREATE POLICY "Appointments por clínica"
  ON public.appointments
  FOR ALL
  USING (clinic_id = public.get_my_clinic_id())
  WITH CHECK (clinic_id = public.get_my_clinic_id());
