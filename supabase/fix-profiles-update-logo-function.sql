-- Cria função SECURITY DEFINER para atualizar logo_url do perfil
-- Isso contorna problemas de RLS ao atualizar o próprio perfil
-- Execute no Supabase: SQL Editor → New query → Cole → Run.

CREATE OR REPLACE FUNCTION public.update_profile_logo_url(p_user_id uuid, p_logo_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica se o usuário está tentando atualizar seu próprio perfil
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Você só pode atualizar seu próprio perfil';
  END IF;
  
  -- Atualiza apenas o campo logo_url
  UPDATE public.profiles
  SET logo_url = p_logo_url,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Permite que usuários autenticados executem a função
GRANT EXECUTE ON FUNCTION public.update_profile_logo_url(uuid, text) TO authenticated;
