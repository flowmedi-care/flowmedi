-- Equipe: convites e remoção de acesso (dados históricos permanecem)
-- Execute no Supabase: SQL Editor → New query → Cole tudo → Run.
-- Pré-requisito: já ter executado schema.sql (tabelas clinics, profiles, etc.).

-- 1) Coluna active em profiles (removido = sem acesso; dados de consulta etc. permanecem)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 2) Tabela de convites
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('medico', 'secretaria')),
  token text UNIQUE NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_clinic_id ON public.invites(clinic_id);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Admin da clínica pode listar, criar e cancelar convites da própria clínica
CREATE POLICY "invites_select_admin"
  ON public.invites FOR SELECT
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND active)
  );
CREATE POLICY "invites_insert_admin"
  ON public.invites FOR INSERT
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND active)
    AND created_by = auth.uid()
  );
CREATE POLICY "invites_delete_admin"
  ON public.invites FOR DELETE
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND active)
  );

-- 3) Função: retorna dados do convite por token (para exibir na página pública)
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS TABLE(clinic_name text, role text, email text, expires_at timestamptz, accepted_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT c.name, i.role, i.email, i.expires_at, i.accepted_at
  FROM invites i
  JOIN clinics c ON c.id = i.clinic_id
  WHERE i.token = p_token AND i.expires_at > now() AND i.accepted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO authenticated;

-- 4) Função: aceitar convite (cria perfil; só quem está logado e o email bate ou qualquer logado se convite for por email)
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite invites%ROWTYPE;
  v_user_id uuid;
  v_email text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_invite FROM invites i
  WHERE i.token = p_token AND i.expires_at > now() AND i.accepted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido ou expirado';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_invite.email IS NOT NULL AND v_email IS NOT NULL AND lower(trim(v_invite.email)) <> lower(trim(v_email)) THEN
    RAISE EXCEPTION 'Este convite foi enviado para outro e-mail. Use a conta %', v_invite.email;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, clinic_id, active)
  VALUES (v_user_id, v_email, (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = v_user_id), v_invite.role, v_invite.clinic_id, true)
  ON CONFLICT (id) DO UPDATE SET
    clinic_id = EXCLUDED.clinic_id,
    role = EXCLUDED.role,
    email = COALESCE(profiles.email, EXCLUDED.email),
    active = true,
    updated_at = now();

  UPDATE invites SET accepted_at = now() WHERE id = v_invite.id;

  RETURN v_invite.clinic_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

-- 5) Função: desativar acesso de um usuário (admin apenas; dados históricos permanecem)
CREATE OR REPLACE FUNCTION public.deactivate_profile(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_is_admin boolean;
BEGIN
  v_is_admin := EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active
  );
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT clinic_id INTO v_clinic_id FROM profiles WHERE id = p_profile_id;
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND clinic_id = v_clinic_id AND role = 'admin' AND active) THEN
    RAISE EXCEPTION 'Sem permissão para esta clínica';
  END IF;

  IF auth.uid() = p_profile_id THEN
    RAISE EXCEPTION 'Você não pode remover seu próprio acesso';
  END IF;

  UPDATE profiles SET active = false, updated_at = now() WHERE id = p_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deactivate_profile(uuid) TO authenticated;
