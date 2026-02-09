-- Garante que cada usuário consiga VER o próprio perfil (senão o dashboard fica em "Criar minha clínica").
-- Execute no Supabase: SQL Editor → New query → Cole → Run.

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());
