-- Migration: Garantir que todas as clínicas tenham slug único
-- Execute no SQL Editor do Supabase
-- 
-- Esta migração garante que todas as clínicas tenham um slug único
-- necessário para evitar conflitos em rotas de formulários

-- Função auxiliar para gerar slug a partir de nome
CREATE OR REPLACE FUNCTION public.generate_clinic_slug(p_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_slug text;
  v_slug text;
  v_counter int := 0;
BEGIN
  -- Gerar slug base do nome (substituir acentos e ç/ñ, nunca remover letras)
  v_base_slug := p_name;
  v_base_slug := REGEXP_REPLACE(v_base_slug, '[àáâãäå]', 'a', 'gi');
  v_base_slug := REGEXP_REPLACE(v_base_slug, '[èéêë]', 'e', 'gi');
  v_base_slug := REGEXP_REPLACE(v_base_slug, '[ìíîï]', 'i', 'gi');
  v_base_slug := REGEXP_REPLACE(v_base_slug, '[òóôõö]', 'o', 'gi');
  v_base_slug := REGEXP_REPLACE(v_base_slug, '[ùúûü]', 'u', 'gi');
  v_base_slug := REGEXP_REPLACE(v_base_slug, '[ñÑ]', 'n', 'g');
  v_base_slug := REGEXP_REPLACE(v_base_slug, '[çÇ]', 'c', 'g');
  v_base_slug := LOWER(REGEXP_REPLACE(v_base_slug, '[^a-z0-9]+', '-', 'g'));
  
  -- Remover hífens no início e fim
  v_base_slug := TRIM(BOTH '-' FROM v_base_slug);
  
  -- Limitar tamanho
  v_base_slug := SUBSTRING(v_base_slug FROM 1 FOR 50);
  
  -- Se vazio, usar padrão
  IF v_base_slug = '' OR v_base_slug IS NULL THEN
    v_base_slug := 'clinica';
  END IF;
  
  v_slug := v_base_slug;
  
  -- Verificar se já existe e adicionar sufixo numérico se necessário
  WHILE EXISTS (SELECT 1 FROM public.clinics WHERE slug = v_slug) LOOP
    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter::text;
  END LOOP;
  
  RETURN v_slug;
END;
$$;

-- Atualizar clínicas sem slug
UPDATE public.clinics
SET slug = public.generate_clinic_slug(name)
WHERE slug IS NULL OR slug = '';

-- Garantir que não há slugs duplicados (caso raro)
DO $$
DECLARE
  r RECORD;
  v_new_slug text;
BEGIN
  FOR r IN (
    SELECT id, slug, name
    FROM public.clinics
    WHERE slug IN (
      SELECT slug
      FROM public.clinics
      GROUP BY slug
      HAVING COUNT(*) > 1
    )
    ORDER BY created_at
  ) LOOP
    -- Manter o primeiro, atualizar os demais
    IF r.id NOT IN (
      SELECT id FROM public.clinics WHERE slug = r.slug ORDER BY created_at LIMIT 1
    ) THEN
      v_new_slug := public.generate_clinic_slug(r.name || '-' || SUBSTRING(r.id::text FROM 1 FOR 8));
      UPDATE public.clinics SET slug = v_new_slug WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Criar índice único para garantir unicidade
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinics_slug_unique ON public.clinics(slug) WHERE slug IS NOT NULL;

-- Criar índice para melhor performance nas buscas
CREATE INDEX IF NOT EXISTS idx_clinics_slug ON public.clinics(slug) WHERE slug IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.clinics.slug IS 'Slug único da clínica usado em URLs amigáveis (ex: clinica-dr-silva). Gerado automaticamente a partir do nome se não fornecido.';
