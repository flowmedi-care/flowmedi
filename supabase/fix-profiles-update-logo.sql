-- Corrige política RLS para permitir que usuários atualizem seu próprio campo logo_url
-- Execute no Supabase: SQL Editor → New query → Cole → Run.

-- Remove todas as políticas de UPDATE existentes para evitar conflitos
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND schemaname = 'public'
    AND cmd = 'UPDATE'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

-- Recria política de UPDATE permitindo que usuário atualize seu próprio perfil
-- Isso inclui o campo logo_url que foi adicionado
-- IMPORTANTE: WITH CHECK é necessário para UPDATEs no Supabase
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Garante que a política de SELECT também existe (caso não exista)
DROP POLICY IF EXISTS "Perfil próprio" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());
