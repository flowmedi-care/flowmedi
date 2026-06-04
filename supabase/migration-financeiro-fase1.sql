-- FINANCEIRO FASE 1 — category, payment_method em financial_entries; cancelamento em comandas

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IS NULL OR category IN (
      'aluguel', 'salarios', 'materiais', 'laboratorio', 'equipamentos', 'marketing', 'outros'
    ));

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS payment_method text;

CREATE INDEX IF NOT EXISTS idx_financial_entries_category
  ON public.financial_entries(clinic_id, category)
  WHERE category IS NOT NULL;

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS cancelled_reason text;

COMMENT ON COLUMN public.financial_entries.category IS 'Categoria da despesa/receita manual';
COMMENT ON COLUMN public.financial_entries.payment_method IS 'Método usado ao marcar despesa como paga';
COMMENT ON COLUMN public.comandas.cancelled_at IS 'Data/hora do cancelamento da comanda';
COMMENT ON COLUMN public.comandas.cancelled_reason IS 'Motivo informado no cancelamento';
