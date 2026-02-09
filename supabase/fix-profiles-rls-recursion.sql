-- Corrige recursão infinita na política profiles_select_clinic_admin.
-- A política subquery (SELECT ... FROM profiles) causava loop ao ler profiles.
-- Solução: função SECURITY DEFINER que retorna clinic_id do admin (ignora RLS).

-- 1) Função auxiliar: retorna clinic_id onde o usuário atual é admin
CREATE OR REPLACE FUNCTION public.get_my_admin_clinic_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT clinic_id FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin' AND COALESCE(active, true) = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_admin_clinic_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_admin_clinic_id() TO anon;

-- 2) Substitui a política que causava recursão
DROP POLICY IF EXISTS "profiles_select_clinic_admin" ON public.profiles;

CREATE POLICY "profiles_select_clinic_admin"
  ON public.profiles FOR SELECT
  USING (clinic_id = public.get_my_admin_clinic_id());
