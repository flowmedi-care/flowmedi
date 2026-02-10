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
  v_clinic_logo text;
  v_doctor_logo text;
  v_patient_name text;
  v_patient_email text;
  v_patient_phone text;
  v_patient_birth_date date;
  v_patient_age int;
BEGIN
  SELECT fi.id, fi.appointment_id, fi.form_template_id, fi.status, fi.responses, fi.link_expires_at,
         ft.name AS template_name, ft.definition,
         ft.clinic_id,
         a.doctor_id,
         a.patient_id
  INTO v_row
  FROM form_instances fi
  JOIN form_templates ft ON ft.id = fi.form_template_id
  JOIN appointments a ON a.id = fi.appointment_id
  WHERE fi.link_token = p_token
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;
  
  -- Buscar logo da clínica
  SELECT logo_url INTO v_clinic_logo
  FROM clinics
  WHERE id = v_row.clinic_id;
  
  -- Buscar logo do médico
  SELECT logo_url INTO v_doctor_logo
  FROM profiles
  WHERE id = v_row.doctor_id;
  
  -- Buscar dados do paciente (inicializar variáveis como NULL)
  v_patient_name := NULL;
  v_patient_email := NULL;
  v_patient_phone := NULL;
  v_patient_birth_date := NULL;
  v_patient_age := NULL;
  
  SELECT full_name, email, phone, birth_date
  INTO v_patient_name, v_patient_email, v_patient_phone, v_patient_birth_date
  FROM patients
  WHERE id = v_row.patient_id;
  
  -- Calcular idade se tiver data de nascimento
  IF v_patient_birth_date IS NOT NULL THEN
    v_patient_age := EXTRACT(YEAR FROM age(v_patient_birth_date));
  END IF;

  IF v_row.link_expires_at IS NOT NULL AND v_row.link_expires_at < now() THEN
    RETURN json_build_object('found', true, 'expired', true);
  END IF;

  v_result := json_build_object(
    'found', true,
    'expired', false,
    'id', COALESCE(v_row.id::text, ''),
    'appointment_id', COALESCE(v_row.appointment_id::text, ''),
    'form_template_id', COALESCE(v_row.form_template_id::text, ''),
    'status', COALESCE(v_row.status, 'pendente'),
    'responses', COALESCE(v_row.responses, '{}'::jsonb),
    'template_name', COALESCE(v_row.template_name, 'Formulário'),
    'definition', COALESCE(v_row.definition, '[]'::jsonb),
    'clinic_logo_url', v_clinic_logo,
    'doctor_logo_url', v_doctor_logo,
    'patient_name', v_patient_name,
    'patient_email', v_patient_email,
    'patient_phone', v_patient_phone,
    'patient_age', v_patient_age
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
