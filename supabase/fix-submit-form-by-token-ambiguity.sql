-- Fix: Remove ambiguidade na função submit_form_by_token
-- Execute este script no SQL Editor do Supabase para corrigir o erro de ambiguidade

-- Remover todas as versões antigas da função para evitar ambiguidade
DROP FUNCTION IF EXISTS public.submit_form_by_token(text, jsonb);
DROP FUNCTION IF EXISTS public.submit_form_by_token(text, jsonb, text, text, text, date);
DROP FUNCTION IF EXISTS public.submit_form_by_token(text, jsonb, text, text, text, date, jsonb);

-- Recriar a função única com todos os parâmetros opcionais
CREATE FUNCTION public.submit_form_by_token(
  p_token text, 
  p_responses jsonb,
  p_submitter_name text DEFAULT NULL,
  p_submitter_email text DEFAULT NULL,
  p_submitter_phone text DEFAULT NULL,
  p_submitter_birth_date date DEFAULT NULL,
  p_custom_fields jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_expires_at timestamptz;
  v_status text;
  v_is_public boolean;
BEGIN
  -- Buscar instância por link_token ou public_link_token
  SELECT id, link_expires_at, status, (appointment_id IS NULL) AS is_public
  INTO v_id, v_expires_at, v_status, v_is_public
  FROM form_instances
  WHERE link_token = p_token OR public_link_token = p_token
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'expired');
  END IF;

  -- Atualizar respostas e, se for público, também os dados básicos
  IF v_is_public THEN
    UPDATE form_instances
    SET responses = p_responses,
        status = 'respondido',
        public_submitter_name = COALESCE(p_submitter_name, public_submitter_name),
        public_submitter_email = COALESCE(p_submitter_email, public_submitter_email),
        public_submitter_phone = COALESCE(p_submitter_phone, public_submitter_phone),
        public_submitter_birth_date = COALESCE(p_submitter_birth_date, public_submitter_birth_date),
        public_submitter_custom_fields = COALESCE(p_custom_fields, public_submitter_custom_fields, '{}'::jsonb),
        updated_at = now()
    WHERE id = v_id;
  ELSE
    UPDATE form_instances
    SET responses = p_responses,
        status = 'respondido',
        updated_at = now()
    WHERE id = v_id;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- Reaplicar permissões
GRANT EXECUTE ON FUNCTION public.submit_form_by_token(text, jsonb, text, text, text, date, jsonb) TO anon;
