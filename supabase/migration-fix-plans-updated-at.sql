-- Adicionar coluna updated_at na tabela plans se não existir
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Criar trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_plans_updated_at ON public.plans;

CREATE TRIGGER trigger_update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_plans_updated_at();
