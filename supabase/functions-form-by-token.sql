-- Funções para acesso público ao formulário por link_token (sem login)
-- Execute no SQL Editor do Supabase

-- Retorna a instância do formulário e o template para exibir/preencher
CREATE OR REPLACE FUNCTION public.get_form_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_result json;
BEGIN
  SELECT fi.id, fi.appointment_id, fi.form_template_id, fi.status, fi.responses, fi.link_expires_at,
         ft.name AS template_name, ft.definition
  INTO v_row
  FROM form_instances fi
  JOIN form_templates ft ON ft.id = fi.form_template_id
  WHERE fi.link_token = p_token
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  IF v_row.link_expires_at IS NOT NULL AND v_row.link_expires_at < now() THEN
    RETURN json_build_object('found', true, 'expired', true);
  END IF;

  v_result := json_build_object(
    'found', true,
    'expired', false,
    'id', v_row.id,
    'appointment_id', v_row.appointment_id,
    'form_template_id', v_row.form_template_id,
    'status', v_row.status,
    'responses', COALESCE(v_row.responses, '{}'::jsonb),
    'template_name', v_row.template_name,
    'definition', v_row.definition
  );
  RETURN v_result;
END;
$$;

-- Submete as respostas do formulário (por token)
CREATE OR REPLACE FUNCTION public.submit_form_by_token(p_token text, p_responses jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_expires_at timestamptz;
  v_status text;
BEGIN
  SELECT id, link_expires_at, status
  INTO v_id, v_expires_at, v_status
  FROM form_instances
  WHERE link_token = p_token
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'expired');
  END IF;

  UPDATE form_instances
  SET responses = p_responses,
      status = 'respondido',
      updated_at = now()
  WHERE id = v_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Permite execução anônima (anon role)
GRANT EXECUTE ON FUNCTION public.get_form_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_form_by_token(text, jsonb) TO anon;
