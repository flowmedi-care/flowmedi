-- Modelo de cobrança para séries recorrentes (definido no serviço; procedimento herda via default_service_id).

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS recurrence_billing_mode text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_recurrence_billing_mode_check'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_recurrence_billing_mode_check
      CHECK (
        recurrence_billing_mode IS NULL
        OR recurrence_billing_mode IN ('per_session', 'treatment_plan')
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.services.recurrence_billing_mode IS
  'Recorrência: per_session = cupom por consulta; treatment_plan = pacote multi-sessão; NULL = só agenda sem valor automático.';
