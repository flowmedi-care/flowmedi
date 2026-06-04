-- Fluxo comanda / atendimento clínico — subtotal, desconto, emissão, config clínica

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric(12,2);

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2);

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS charge_materials_separately boolean NOT NULL DEFAULT true;

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS issued_at timestamptz;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS charge_materials_by_default boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.comandas.subtotal_amount IS 'Valor antes do desconto na emissão';
COMMENT ON COLUMN public.comandas.discount_amount IS 'Desconto aplicado em R$ na emissão';
COMMENT ON COLUMN public.comandas.discount_percent IS 'Percentual de desconto informado (auditoria)';
COMMENT ON COLUMN public.comandas.charge_materials_separately IS 'Se insumos foram faturados como linhas separadas';
COMMENT ON COLUMN public.comandas.issued_at IS 'Momento da emissão da comanda (competência)';
COMMENT ON COLUMN public.clinics.charge_materials_by_default IS 'Default do checkbox cobrar insumos na emissão';

-- Comandas históricas: subtotal = total, issued_at = created_at
UPDATE public.comandas
SET
  subtotal_amount = COALESCE(subtotal_amount, total_amount),
  issued_at = COALESCE(issued_at, created_at)
WHERE subtotal_amount IS NULL OR issued_at IS NULL;
