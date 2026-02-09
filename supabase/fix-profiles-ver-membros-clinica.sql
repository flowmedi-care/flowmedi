-- 1) Garante que cada usuário sempre possa ver o PRÓPRIO perfil (evita
--    "Criar minha clínica" quando já tem clínica; evita recursão).
-- 2) Permite que qualquer membro da clínica veja os demais (dropdown médico, etc.)
--    SEM recursão: usa função SECURITY DEFINER em vez de subquery em profiles.
-- Execute no Supabase: SQL Editor → New query → Cole → Run.

-- Garantir política "ver próprio perfil" (recria para garantir que exista)
DROP POLICY IF EXISTS "Perfil próprio" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Função que retorna o clinic_id do usuário atual (ignora RLS = sem recursão)
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

-- Remover política que usava subquery (pode causar recursão)
DROP POLICY IF EXISTS "profiles_select_same_clinic" ON public.profiles;

-- Ver membros da mesma clínica usando a função (sem subquery em profiles)
CREATE POLICY "profiles_select_same_clinic"
  ON public.profiles FOR SELECT
  USING (clinic_id = public.get_my_clinic_id());
