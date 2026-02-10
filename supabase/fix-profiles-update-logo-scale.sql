-- Função para atualizar escala da logo do médico
-- Execute no SQL Editor do Supabase

CREATE OR REPLACE FUNCTION public.update_profile_logo_scale(p_user_id uuid, p_logo_scale integer)
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
  
  -- Valida escala
  IF p_logo_scale < 50 OR p_logo_scale > 200 THEN
    RAISE EXCEPTION 'A escala deve estar entre 50 e 200';
  END IF;
  
  -- Atualiza apenas o campo logo_scale
  UPDATE public.profiles
  SET logo_scale = p_logo_scale,
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Permite que usuários autenticados executem a função
GRANT EXECUTE ON FUNCTION public.update_profile_logo_scale(uuid, integer) TO authenticated;
