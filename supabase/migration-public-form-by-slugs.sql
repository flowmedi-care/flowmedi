-- Migration: Buscar formulário público por slug da clínica + slug do formulário
-- Execute no SQL Editor do Supabase
--
-- Corrige 404 em /f/public/{clinica}/{formulario} para visitantes anônimos

CREATE OR REPLACE FUNCTION public.slugify_text(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN '';
  END IF;

  v := btrim(p_text);
  v := regexp_replace(v, '[àáâãäå]', 'a', 'gi');
  v := regexp_replace(v, '[èéêë]', 'e', 'gi');
  v := regexp_replace(v, '[ìíîï]', 'i', 'gi');
  v := regexp_replace(v, '[òóôõö]', 'o', 'gi');
  v := regexp_replace(v, '[ùúûü]', 'u', 'gi');
  v := regexp_replace(v, '[ñÑ]', 'n', 'g');
  v := regexp_replace(v, '[çÇ]', 'c', 'g');
  v := lower(regexp_replace(v, '[^a-z0-9]+', '-', 'g'));
  v := trim(both '-' from v);
  v := substring(v from 1 for 100);

  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_form_by_slugs(
  p_clinic_slug text,
  p_form_slug text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id uuid;
  v_clinic_slug text;
  v_form_slug text;
BEGIN
  v_clinic_slug := lower(btrim(p_clinic_slug));
  v_form_slug := lower(btrim(p_form_slug));

  IF v_clinic_slug = '' OR v_form_slug = '' THEN
    RETURN json_build_object('found', false);
  END IF;

  -- Match exato: clínica + formulário (JOIN único)
  SELECT ft.id INTO v_template_id
  FROM form_templates ft
  JOIN clinics c ON c.id = ft.clinic_id
  WHERE ft.is_public = true
    AND (
      lower(c.slug) = v_clinic_slug
      OR public.slugify_text(c.name) = v_clinic_slug
    )
    AND (
      lower(ft.slug) = v_form_slug
      OR public.slugify_text(ft.name) = v_form_slug
    )
  ORDER BY ft.created_at
  LIMIT 1;

  -- Fallback: match parcial no slug/nome do formulário
  IF v_template_id IS NULL THEN
    SELECT ft.id INTO v_template_id
    FROM form_templates ft
    JOIN clinics c ON c.id = ft.clinic_id
    WHERE ft.is_public = true
      AND (
        lower(c.slug) = v_clinic_slug
        OR public.slugify_text(c.name) = v_clinic_slug
      )
      AND (
        public.slugify_text(ft.name) LIKE '%' || replace(v_form_slug, '-', '%') || '%'
        OR lower(COALESCE(ft.slug, '')) LIKE '%' || replace(v_form_slug, '-', '%') || '%'
      )
    ORDER BY ft.created_at
    LIMIT 1;
  END IF;

  IF v_template_id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN get_public_form_template(v_template_id);
END;
$$;

-- Inclui campos customizados públicos na resposta (evita RLS para anônimos)
CREATE OR REPLACE FUNCTION public.get_public_form_template(p_template_id uuid)
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
  v_doctor_name text;
  v_custom_fields json;
BEGIN
  SELECT ft.id, ft.name, ft.definition, ft.clinic_id, ft.public_doctor_id
  INTO v_row
  FROM form_templates ft
  WHERE ft.id = p_template_id
    AND ft.is_public = true
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  v_clinic_logo := NULL;
  v_clinic_scale := 100;
  SELECT logo_url, COALESCE(logo_scale, 100) INTO v_clinic_logo, v_clinic_scale
  FROM clinics
  WHERE id = v_row.clinic_id;

  v_doctor_logo := NULL;
  v_doctor_scale := 100;
  v_doctor_name := NULL;
  IF v_row.public_doctor_id IS NOT NULL THEN
    SELECT logo_url, COALESCE(logo_scale, 100), full_name
    INTO v_doctor_logo, v_doctor_scale, v_doctor_name
    FROM profiles
    WHERE id = v_row.public_doctor_id;
  END IF;

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', pcf.id::text,
        'field_name', pcf.field_name,
        'field_type', pcf.field_type,
        'field_label', pcf.field_label,
        'required', pcf.required,
        'options', pcf.options,
        'display_order', pcf.display_order
      )
      ORDER BY pcf.display_order
    ),
    '[]'::json
  )
  INTO v_custom_fields
  FROM patient_custom_fields pcf
  WHERE pcf.clinic_id = v_row.clinic_id
    AND pcf.include_in_public_form = true;

  v_result := json_build_object(
    'found', true,
    'template_id', v_row.id::text,
    'template_name', COALESCE(v_row.name, 'Formulário'),
    'definition', COALESCE(v_row.definition, '[]'::jsonb),
    'clinic_id', v_row.clinic_id::text,
    'clinic_logo_url', v_clinic_logo,
    'clinic_logo_scale', COALESCE(v_clinic_scale, 100),
    'doctor_logo_url', v_doctor_logo,
    'doctor_logo_scale', COALESCE(v_doctor_scale, 100),
    'doctor_name', v_doctor_name,
    'custom_fields', v_custom_fields
  );
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.slugify_text(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_form_by_slugs(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_form_template(uuid) TO anon;
