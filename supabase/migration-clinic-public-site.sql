-- Migration: Site público da clínica + autoagendamento configurável
-- Execute no SQL Editor do Supabase.
--
-- PRÉ-REQUISITOS (rode antes, nesta ordem, se ainda não rodou):
--   1. supabase/schema.sql
--   2. Demais migrations do projeto (slug, contact, VA, etc.)
--   3. supabase/migration-virtual-assistant.sql (RPC usa tabelas do assistente)
--
-- Se der "relation public.clinics does not exist", o banco ainda não tem o schema base
-- ou você está no projeto Supabase errado (confira NEXT_PUBLIC_SUPABASE_URL no .env).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clinics'
  ) THEN
    RAISE EXCEPTION
      'Tabela public.clinics não existe. Execute supabase/schema.sql primeiro (e confira se está no projeto Supabase correto).';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    RAISE EXCEPTION
      'Tabela public.profiles não existe. Execute supabase/schema.sql primeiro.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.clinic_public_site_settings (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  site_enabled boolean NOT NULL DEFAULT false,
  self_service_booking_enabled boolean NOT NULL DEFAULT false,
  show_team boolean NOT NULL DEFAULT true,
  show_faq boolean NOT NULL DEFAULT true,
  show_services boolean NOT NULL DEFAULT true,
  hero_title text,
  hero_subtitle text,
  primary_color text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clinic_public_site_settings IS
  'Configurações do site público da clínica (landing + autoagendamento).';

ALTER TABLE public.clinic_public_site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_site_settings_clinic" ON public.clinic_public_site_settings;
CREATE POLICY "public_site_settings_clinic" ON public.clinic_public_site_settings
  FOR ALL
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

-- RPC pública: retorna dados do site apenas se site_enabled = true
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
         va.has_multiple_units
  INTO v_va
  FROM clinic_virtual_assistant_settings va
  WHERE va.clinic_id = v_clinic.id;

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'specialty', p.specialty,
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
      'primary_color', v_site.primary_color
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
