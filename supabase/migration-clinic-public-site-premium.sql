-- Migration: Site público premium (hero, missão/visão/valores, CRM médicos, contato)
-- Execute no SQL Editor do Supabase após migration-clinic-public-site.sql

ALTER TABLE public.clinic_public_site_settings
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS mission text,
  ADD COLUMN IF NOT EXISTS vision text,
  ADD COLUMN IF NOT EXISTS values_text text,
  ADD COLUMN IF NOT EXISTS show_contact_form boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_headline text,
  ADD COLUMN IF NOT EXISTS default_subheadline text;

CREATE OR REPLACE FUNCTION public.get_public_clinic_site(p_slug text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic record;
  v_site record;
  v_va record;
  v_doctors json;
  v_procedures json;
  v_faq json;
  v_locations json;
  v_has_rooms boolean;
BEGIN
  IF p_slug IS NULL OR trim(p_slug) = '' THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT c.id, c.slug, c.name, c.logo_url, c.logo_scale,
         c.phone, c.email, c.address,
         c.whatsapp_url, c.facebook_url, c.instagram_url,
         c.email_branding_colors
  INTO v_clinic
  FROM clinics c
  WHERE c.slug = trim(p_slug)
  LIMIT 1;

  IF v_clinic.id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT s.*
  INTO v_site
  FROM clinic_public_site_settings s
  WHERE s.clinic_id = v_clinic.id;

  IF v_site.clinic_id IS NULL OR v_site.site_enabled IS NOT TRUE THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT va.short_description, va.google_maps_url, va.parking_info,
         va.accessibility_info, va.landmarks, va.operating_hours,
         va.payment_methods, va.cancellation_policy, va.active_promotions,
         va.has_multiple_units, va.segment
  INTO v_va
  FROM clinic_virtual_assistant_settings va
  WHERE va.clinic_id = v_clinic.id;

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'specialty', p.specialty,
      'crm', p.crm,
      'crm_uf', p.crm_uf,
      'logo_url', p.logo_url,
      'logo_scale', COALESCE(p.logo_scale, 100)
    ) ORDER BY p.full_name
  ), '[]'::json)
  INTO v_doctors
  FROM profiles p
  WHERE p.clinic_id = v_clinic.id AND p.role = 'medico';

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', pr.id,
      'name', pr.name,
      'duration_minutes', COALESCE(pr.duration_minutes, 30),
      'recommendations', pr.recommendations,
      'doctor_ids', COALESCE((
        SELECT json_agg(dp.doctor_id)
        FROM doctor_procedures dp
        WHERE dp.procedure_id = pr.id AND dp.clinic_id = v_clinic.id
      ), '[]'::json)
    ) ORDER BY pr.display_order NULLS LAST, pr.name
  ), '[]'::json)
  INTO v_procedures
  FROM procedures pr
  WHERE pr.clinic_id = v_clinic.id;

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', f.id,
      'question', f.question,
      'answer', f.answer
    ) ORDER BY f.display_order
  ), '[]'::json)
  INTO v_faq
  FROM clinic_virtual_assistant_faq f
  WHERE f.clinic_id = v_clinic.id;

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', l.id,
      'name', l.name,
      'address', l.address,
      'google_maps_url', l.google_maps_url,
      'phone', l.phone,
      'operating_hours', l.operating_hours
    ) ORDER BY l.display_order
  ), '[]'::json)
  INTO v_locations
  FROM clinic_virtual_assistant_locations l
  WHERE l.clinic_id = v_clinic.id;

  SELECT EXISTS(
    SELECT 1 FROM rooms r
    WHERE r.clinic_id = v_clinic.id AND r.active = true
    LIMIT 1
  ) INTO v_has_rooms;

  RETURN json_build_object(
    'found', true,
    'clinic_id', v_clinic.id::text,
    'slug', v_clinic.slug,
    'name', v_clinic.name,
    'logo_url', v_clinic.logo_url,
    'logo_scale', COALESCE(v_clinic.logo_scale, 100),
    'phone', v_clinic.phone,
    'email', v_clinic.email,
    'address', v_clinic.address,
    'whatsapp_url', v_clinic.whatsapp_url,
    'facebook_url', v_clinic.facebook_url,
    'instagram_url', v_clinic.instagram_url,
    'email_branding_colors', v_clinic.email_branding_colors,
    'site', json_build_object(
      'site_enabled', v_site.site_enabled,
      'self_service_booking_enabled', v_site.self_service_booking_enabled,
      'show_team', v_site.show_team,
      'show_faq', v_site.show_faq,
      'show_services', v_site.show_services,
      'hero_title', v_site.hero_title,
      'hero_subtitle', v_site.hero_subtitle,
      'primary_color', v_site.primary_color,
      'hero_image_url', v_site.hero_image_url,
      'mission', v_site.mission,
      'vision', v_site.vision,
      'values_text', v_site.values_text,
      'show_contact_form', COALESCE(v_site.show_contact_form, true),
      'default_headline', v_site.default_headline,
      'default_subheadline', v_site.default_subheadline
    ),
    'short_description', v_va.short_description,
    'google_maps_url', v_va.google_maps_url,
    'parking_info', v_va.parking_info,
    'accessibility_info', v_va.accessibility_info,
    'landmarks', v_va.landmarks,
    'operating_hours', COALESCE(v_va.operating_hours, '{}'::jsonb),
    'payment_methods', COALESCE(v_va.payment_methods, '{}'),
    'cancellation_policy', v_va.cancellation_policy,
    'active_promotions', v_va.active_promotions,
    'has_multiple_units', COALESCE(v_va.has_multiple_units, false),
    'segment', COALESCE(v_va.segment, 'clinica'),
    'doctors', v_doctors,
    'procedures', v_procedures,
    'faq', v_faq,
    'locations', v_locations,
    'has_active_rooms', v_has_rooms
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_clinic_site(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_clinic_site(text) TO authenticated;

-- Formulário de contato público → pipeline CRM
CREATE OR REPLACE FUNCTION public.submit_public_site_contact(
  p_slug text,
  p_name text,
  p_phone text,
  p_email text,
  p_message text
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
  IF p_slug IS NULL OR trim(p_slug) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Clínica não encontrada.');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Nome é obrigatório.');
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN json_build_object('success', false, 'error', 'E-mail é obrigatório.');
  END IF;

  SELECT c.id INTO v_clinic_id
  FROM clinics c
  WHERE c.slug = trim(p_slug)
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
    clinic_id, email, name, phone, stage, notes, last_contact_at, next_action
  )
  VALUES (
    v_clinic_id,
    v_email,
    trim(p_name),
    NULLIF(trim(p_phone), ''),
    'novo_contato',
    COALESCE(trim(p_message), ''),
    now(),
    'Contato via site público'
  )
  ON CONFLICT (clinic_id, email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, non_registered_pipeline.phone),
    notes = EXCLUDED.notes,
    last_contact_at = now(),
    next_action = 'Contato via site público',
    updated_at = now()
  RETURNING id INTO v_pipeline_id;

  RETURN json_build_object('success', true, 'pipeline_id', v_pipeline_id::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_site_contact(text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_site_contact(text, text, text, text, text) TO authenticated;
