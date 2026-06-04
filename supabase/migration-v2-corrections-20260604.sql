-- Correções v2 — estorno no caixa + backfill histórico

ALTER TABLE public.patient_payments
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_patient_payments_refunded
  ON public.patient_payments(clinic_id, refunded_at)
  WHERE refunded_at IS NOT NULL;

COMMENT ON COLUMN public.patient_payments.refunded_at IS 'Preenchido quando pagamento estornado no cancelamento do cupom';

-- Backfill N-07: gross_amount histórico
UPDATE public.patient_payments
SET
  gross_amount = COALESCE(gross_amount, amount),
  net_amount = COALESCE(net_amount, amount),
  fee_amount = COALESCE(fee_amount, 0)
WHERE gross_amount IS NULL OR net_amount IS NULL;
