-- Cor por valor de dimensão: usada na agenda ao colorir por dimensão
ALTER TABLE public.dimension_values
  ADD COLUMN IF NOT EXISTS cor text;

COMMENT ON COLUMN public.dimension_values.cor IS 'Cor em hex (ex: #3B82F6) para exibir na agenda ao filtrar por esta dimensão.';
