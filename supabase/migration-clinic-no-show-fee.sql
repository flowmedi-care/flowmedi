-- Taxa de falta (no-show) configurável por clínica

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS no_show_fee_mode text DEFAULT 'none';

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS no_show_fee_amount numeric;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS no_show_fee_percent numeric;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS no_show_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinics_no_show_fee_mode_check'
  ) THEN
    ALTER TABLE public.clinics
      ADD CONSTRAINT clinics_no_show_fee_mode_check
      CHECK (
        no_show_fee_mode IS NULL
        OR no_show_fee_mode IN ('none', 'fixed', 'percent_service', 'service')
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.clinics.no_show_fee_mode IS
  'Taxa de falta: none | fixed (valor fixo) | percent_service (% do serviço) | service (serviço dedicado)';
