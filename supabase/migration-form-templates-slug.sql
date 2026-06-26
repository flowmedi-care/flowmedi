-- Migration: Slug persistido em form_templates
-- Execute no SQL Editor do Supabase (após migration-public-form-by-slugs.sql)

ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.form_templates
SET slug = public.slugify_text(name)
WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_form_templates_clinic_slug
  ON public.form_templates(clinic_id, slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN public.form_templates.slug IS 'Slug amigável do formulário usado em URLs públicas (/f/public/{clinica}/{slug})';
