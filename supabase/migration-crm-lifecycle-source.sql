-- Migration: corrigir source em contatos do site público
-- Execute após migration-crm-lifecycle.sql

CREATE OR REPLACE FUNCTION public.submit_public_site_contact(
  p_slug text,
  p_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_site_enabled boolean;
  v_show_form boolean;
  v_email text;
  v_pipeline_id uuid;
BEGIN
  SELECT c.id INTO v_clinic_id
  FROM clinics c
  INNER JOIN clinic_slugs cs ON cs.clinic_id = c.id
  WHERE cs.slug = trim(p_slug)
  LIMIT 1;

  IF v_clinic_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Clínica não encontrada.');
  END IF;

  SELECT s.site_enabled, COALESCE(s.show_contact_form, true)
  INTO v_site_enabled, v_show_form
  FROM clinic_public_site_settings s
  WHERE s.clinic_id = v_clinic_id;

  IF v_site_enabled IS NOT TRUE OR v_show_form IS NOT TRUE THEN
    RETURN json_build_object('success', false, 'error', 'Formulário indisponível.');
  END IF;

  v_email := lower(trim(p_email));

  INSERT INTO non_registered_pipeline (
    clinic_id, email, name, phone, stage, lifecycle_stage, source, notes, last_contact_at, next_action
  )
  VALUES (
    v_clinic_id,
    v_email,
    trim(p_name),
    NULLIF(trim(p_phone), ''),
    'novo_contato',
    'lead_novo',
    'site',
    COALESCE(trim(p_message), ''),
    now(),
    'Contato via site público'
  )
  ON CONFLICT (clinic_id, email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, non_registered_pipeline.phone),
    notes = EXCLUDED.notes,
    source = COALESCE(non_registered_pipeline.source, 'site'),
    last_contact_at = now(),
    next_action = 'Contato via site público',
    updated_at = now()
  RETURNING id INTO v_pipeline_id;

  RETURN json_build_object('success', true, 'pipeline_id', v_pipeline_id::text);
END;
$$;
