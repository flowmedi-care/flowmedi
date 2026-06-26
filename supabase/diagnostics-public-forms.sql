-- Diagnóstico: formulários públicos 404
-- Execute no SQL Editor do Supabase de produção

-- 1) A função existe?
SELECT proname FROM pg_proc WHERE proname = 'get_public_form_by_slugs';

-- 2) O que a RPC retorna?
SELECT get_public_form_by_slugs('clinica-saude', 'colonoscopia');

-- 3) Slugs reais no banco
SELECT
  c.name AS clinic_name,
  c.slug AS clinic_slug,
  public.slugify_text(c.name) AS clinic_name_slug,
  ft.name AS form_name,
  ft.slug AS form_slug,
  ft.is_public,
  public.slugify_text(ft.name) AS form_name_slug
FROM clinics c
JOIN form_templates ft ON ft.clinic_id = c.id
WHERE ft.is_public = true
  AND (
    lower(c.slug) = 'clinica-saude'
    OR public.slugify_text(c.name) = 'clinica-saude'
  );
