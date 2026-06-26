-- Fix: slugify_text corrompia slugs (ex: "Colonoscopia" -> "olonoscopia")
-- Causa: [çÇ] em character class virava intervalo [c-ç] no PostgreSQL
-- Execute no SQL Editor do Supabase de produção

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

  v := lower(btrim(p_text));
  v := translate(
    v,
    'àáâãäåèéêëìíîïòóôõöùúûüñç',
    'aaaaaaeeeeiiiiooooouuuunc'
  );
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := trim(both '-' from v);
  v := substring(v from 1 for 100);

  RETURN v;
END;
$$;

-- Re-backfill slugs corrompidos
UPDATE public.form_templates
SET slug = public.slugify_text(name)
WHERE slug IS NULL OR slug = '' OR slug <> public.slugify_text(name);

-- Validar slugify após fix
SELECT public.slugify_text('Colonoscopia') AS colonoscopia_slug;
SELECT public.slugify_text('Clínica Saúde') AS clinica_slug;
SELECT get_public_form_by_slugs('clinica-saude', 'colonoscopia');
