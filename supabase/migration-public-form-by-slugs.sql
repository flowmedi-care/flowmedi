-- Migration: Buscar formulário público por slug da clínica + slug do formulário
-- Execute no SQL Editor do Supabase
--
-- Corrige 404 em /f/public/{clinica}/{formulario} para visitantes anônimos:
-- consultas diretas em clinics/form_templates são bloqueadas pelo RLS)

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
  v_clinic_id uuid;
  v_template_id uuid;
  v_clinic_slug text;
  v_form_slug text;
BEGIN
  v_clinic_slug := lower(btrim(p_clinic_slug));
  v_form_slug := lower(btrim(p_form_slug));

  IF v_clinic_slug = '' OR v_form_slug = '' THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT c.id INTO v_clinic_id
  FROM clinics c
  WHERE lower(c.slug) = v_clinic_slug
     OR public.slugify_text(c.name) = v_clinic_slug
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT ft.id INTO v_template_id
  FROM form_templates ft
  WHERE ft.clinic_id = v_clinic_id
    AND ft.is_public = true
    AND public.slugify_text(ft.name) = v_form_slug
  LIMIT 1;

  IF v_template_id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN get_public_form_template(v_template_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.slugify_text(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_form_by_slugs(text, text) TO anon;
