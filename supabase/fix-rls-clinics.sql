-- Opção A: Corrigir políticas RLS na tabela clinics
-- Opção B: Função que cria clínica + perfil (contorna RLS) — use se A não resolver.
-- Execute TUDO no Supabase: SQL Editor → New query → Cole → Run.

-- ========== A) Remove e recria políticas em clinics ==========
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'clinics' AND schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.clinics', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "clinics_select_own"
  ON public.clinics FOR SELECT
  USING (id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "clinics_update_own"
  ON public.clinics FOR UPDATE
  USING (id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "clinics_insert_logged_in"
  ON public.clinics FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ========== B) Função onboarding (usa SECURITY DEFINER = ignora RLS) ==========
CREATE OR REPLACE FUNCTION public.create_clinic_and_profile(
  p_clinic_name text,
  p_full_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_clinic_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO public.clinics (name) VALUES (p_clinic_name) RETURNING id INTO v_clinic_id;

  INSERT INTO public.profiles (id, email, full_name, role, clinic_id)
  SELECT v_user_id, u.email, p_full_name, 'admin', v_clinic_id
  FROM auth.users u WHERE u.id = v_user_id;

  RETURN v_clinic_id;
END;
$$;

-- Permite o role anon (cliente do app) chamar a função quando logado
GRANT EXECUTE ON FUNCTION public.create_clinic_and_profile(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_clinic_and_profile(text, text) TO authenticated;
