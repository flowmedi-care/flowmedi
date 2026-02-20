-- Verifica se o e-mail do convite já tem conta (para mostrar Entrar vs Criar conta)
-- Só retorna para convites válidos e não expirados.

CREATE OR REPLACE FUNCTION public.check_invite_email_has_account(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_invite_email text;
  v_has_account boolean;
BEGIN
  SELECT i.email INTO v_invite_email
  FROM invites i
  WHERE i.token = p_token AND i.expires_at > now() AND i.accepted_at IS NULL;
  IF v_invite_email IS NULL THEN
    RETURN false;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE lower(trim(u.email)) = lower(trim(v_invite_email))
  ) INTO v_has_account;
  RETURN v_has_account;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_invite_email_has_account(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_invite_email_has_account(text) TO authenticated;
