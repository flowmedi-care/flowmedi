-- Controle de baixa de estoque no atendimento (evita dupla baixa)
ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS stock_consumed_at timestamptz;

COMMENT ON COLUMN public.encounters.stock_consumed_at IS 'Momento em que o consumo de estoque foi lançado na finalização da comanda';
