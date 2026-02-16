-- Migration: Adicionar slugs amigáveis para form_instances
-- Execute no SQL Editor do Supabase
-- 
-- Esta migração adiciona um campo 'slug' que será usado para criar links mais amigáveis
-- Exemplo: /f/abc123 ao invés de /f/7d0a8e7eb26f418bb932a555c8166ccemlp2bb7i

-- Adicionar coluna slug
ALTER TABLE public.form_instances
  ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Criar índice para melhor performance nas buscas por slug
CREATE INDEX IF NOT EXISTS idx_form_instances_slug ON public.form_instances(slug) WHERE slug IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.form_instances.slug IS 'Slug amigável para links (ex: abc123). Usado como alternativa ao link_token para URLs mais legíveis.';

-- Atualizar função get_form_by_token para também buscar por slug
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
  v_clinic_scale int;
  v_doctor_logo text;
  v_doctor_scale int;
  v_patient_name text;
  v_patient_email text;
  v_patient_phone text;
  v_patient_birth_date date;
  v_patient_age int;
  v_is_public boolean;
BEGIN
  -- Buscar instância por link_token, public_link_token ou slug
  SELECT fi.id, fi.appointment_id, fi.form_template_id, fi.status, fi.responses, fi.link_expires_at,
         fi.public_submitter_name, fi.public_submitter_email, fi.public_submitter_phone, 
         fi.public_submitter_birth_date,
         ft.name AS template_name, ft.definition,
         ft.clinic_id,
         a.doctor_id,
         a.patient_id,
         (fi.appointment_id IS NULL) AS is_public_instance
  INTO v_row
  FROM form_instances fi
  JOIN form_templates ft ON ft.id = fi.form_template_id
  LEFT JOIN appointments a ON a.id = fi.appointment_id
  WHERE fi.link_token = p_token 
     OR fi.public_link_token = p_token
     OR fi.slug = p_token
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  v_is_public := COALESCE(v_row.is_public_instance, false);
  
  -- Buscar logo e escala da clínica
  v_clinic_logo := NULL;
  v_clinic_scale := 100;
  SELECT logo_url, COALESCE(logo_scale, 100) INTO v_clinic_logo, v_clinic_scale
  FROM clinics
  WHERE id = v_row.clinic_id;
  
  -- Buscar logo e escala do médico (só se não for público)
  v_doctor_logo := NULL;
  v_doctor_scale := 100;
  IF NOT v_is_public AND v_row.doctor_id IS NOT NULL THEN
    SELECT logo_url, COALESCE(logo_scale, 100) INTO v_doctor_logo, v_doctor_scale
    FROM profiles
    WHERE id = v_row.doctor_id;
  END IF;
  
  -- Buscar dados do paciente (só se não for público)
  v_patient_name := NULL;
  v_patient_email := NULL;
  v_patient_phone := NULL;
  v_patient_birth_date := NULL;
  v_patient_age := NULL;
  
  IF v_is_public THEN
    -- Se for público, usar dados do submissor
    v_patient_name := v_row.public_submitter_name;
    v_patient_email := v_row.public_submitter_email;
    v_patient_phone := v_row.public_submitter_phone;
    v_patient_birth_date := v_row.public_submitter_birth_date;
    IF v_patient_birth_date IS NOT NULL THEN
      v_patient_age := EXTRACT(YEAR FROM age(v_patient_birth_date));
    END IF;
  ELSIF v_row.patient_id IS NOT NULL THEN
    -- Se for vinculado, buscar dados do paciente cadastrado
    SELECT full_name, email, phone, birth_date
    INTO v_patient_name, v_patient_email, v_patient_phone, v_patient_birth_date
    FROM patients
    WHERE id = v_row.patient_id;
    
    IF v_patient_birth_date IS NOT NULL THEN
      v_patient_age := EXTRACT(YEAR FROM age(v_patient_birth_date));
    END IF;
  END IF;

  IF v_row.link_expires_at IS NOT NULL AND v_row.link_expires_at < now() THEN
    RETURN json_build_object('found', true, 'expired', true);
  END IF;

  v_result := json_build_object(
    'found', true,
    'expired', false,
    'is_public', v_is_public,
    'id', COALESCE(v_row.id::text, ''),
    'appointment_id', CASE WHEN v_row.appointment_id IS NOT NULL THEN v_row.appointment_id::text ELSE NULL END,
    'form_template_id', COALESCE(v_row.form_template_id::text, ''),
    'clinic_id', COALESCE(v_row.clinic_id::text, ''),
    'status', COALESCE(v_row.status, 'pendente'),
    'responses', COALESCE(v_row.responses, '{}'::jsonb),
    'template_name', COALESCE(v_row.template_name, 'Formulário'),
    'definition', COALESCE(v_row.definition, '[]'::jsonb),
    'clinic_logo_url', v_clinic_logo,
    'clinic_logo_scale', COALESCE(v_clinic_scale, 100),
    'doctor_logo_url', v_doctor_logo,
    'doctor_logo_scale', COALESCE(v_doctor_scale, 100),
    'patient_name', v_patient_name,
    'patient_email', v_patient_email,
    'patient_phone', v_patient_phone,
    'patient_age', v_patient_age
  );
  RETURN v_result;
END;
$$;

-- Atualizar função submit_form_by_token para também aceitar slug
CREATE OR REPLACE FUNCTION public.submit_form_by_token(
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
  -- Buscar instância por link_token, public_link_token ou slug
  SELECT id, link_expires_at, status, (appointment_id IS NULL) AS is_public
  INTO v_id, v_expires_at, v_status, v_is_public
  FROM form_instances
  WHERE link_token = p_token 
     OR public_link_token = p_token
     OR slug = p_token
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

-- Manter permissões
GRANT EXECUTE ON FUNCTION public.get_form_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_form_by_token(text, jsonb, text, text, text, date, jsonb) TO anon;
