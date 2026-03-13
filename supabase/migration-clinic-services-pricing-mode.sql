-- Fase 2: modo de gestão de serviços e valores por clínica
-- centralizado: apenas admin gerencia serviços/valores
-- descentralizado: admin e médicoas podem gerenciars (comporatamento atual)

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS services_pricing_mode text NOT NULL DEFAULT 'descentralizado';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clinics_services_pricing_mode_check'
  ) THEN
    ALTER TABLE public.clinics
      ADD CONSTRAINT clinics_services_pricing_mode_check
      CHECK (services_pricing_mode IN ('centralizado', 'descentralizado'));
  END IF;
END
$$;

COMMENT ON COLUMN public.clinics.services_pricing_mode IS
'Modo de gestão de serviços/valores: centralizado (somente admin) ou descentralizado (admin e médico).';
