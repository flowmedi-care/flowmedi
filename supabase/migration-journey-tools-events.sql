-- Eventos: recibo de pagamento, orçamento enviado, feedback NPS
-- Bucket de recibos + feedback de pacientes

INSERT INTO public.message_events (
  code, name, description, category,
  default_enabled_email, default_enabled_whatsapp,
  can_be_automatic, requires_appointment
)
VALUES
  (
    'payment_receipt_generated',
    'Recibo de pagamento gerado',
    'Disparado quando um recibo é emitido após registro de pagamento',
    'outros',
    true,
    true,
    true,
    false
  ),
  (
    'quote_sent',
    'Orçamento enviado',
    'Disparado quando um orçamento é enviado ao paciente (inclui IA)',
    'outros',
    true,
    true,
    true,
    false
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.system_message_templates (
  event_code,
  channel,
  name,
  subject,
  body_html,
  body_text,
  whatsapp_meta_phrase,
  variables_used
)
VALUES
  (
    'payment_receipt_generated',
    'whatsapp',
    'Recibo de pagamento (WhatsApp)',
    NULL,
    'Olá {{nome_paciente}}! Segue o comprovante do pagamento de {{valor_recibo}} referente ao recibo {{numero_recibo}}. {{instrucao_recibo}}',
    'Olá {{nome_paciente}}! Segue o comprovante do pagamento de {{valor_recibo}} referente ao recibo {{numero_recibo}}. {{instrucao_recibo}}',
    'Seu recibo de pagamento está disponível.',
    '["nome_paciente","valor_recibo","numero_recibo","instrucao_recibo"]'::jsonb
  ),
  (
    'quote_sent',
    'whatsapp',
    'Orçamento enviado (WhatsApp)',
    NULL,
    'Olá {{nome_paciente}}! Enviamos seu orçamento {{numero_orcamento}} no valor de {{valor_orcamento}}. Válido até {{validade_orcamento}}. {{instrucao_orcamento}}',
    'Olá {{nome_paciente}}! Enviamos seu orçamento {{numero_orcamento}} no valor de {{valor_orcamento}}. Válido até {{validade_orcamento}}. {{instrucao_orcamento}}',
    'Seu orçamento está disponível.',
    '["nome_paciente","numero_orcamento","valor_orcamento","validade_orcamento","instrucao_orcamento"]'::jsonb
  )
ON CONFLICT (event_code, channel) DO NOTHING;

-- Configuração padrão para clínicas existentes
INSERT INTO public.clinic_message_settings (
  clinic_id, event_code, channel, enabled, send_mode, send_only_when_ticket_open
)
SELECT c.id, me.code, 'whatsapp', me.default_enabled_whatsapp, 'automatic', false
FROM public.clinics c
CROSS JOIN public.message_events me
WHERE me.code IN ('payment_receipt_generated', 'quote_sent')
ON CONFLICT (clinic_id, event_code, channel) DO NOTHING;

INSERT INTO public.clinic_message_settings (
  clinic_id, event_code, channel, enabled, send_mode, send_only_when_ticket_open
)
SELECT c.id, me.code, 'email', me.default_enabled_email, 'automatic', false
FROM public.clinics c
CROSS JOIN public.message_events me
WHERE me.code IN ('payment_receipt_generated', 'quote_sent')
ON CONFLICT (clinic_id, event_code, channel) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('quotes', 'quotes', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.patient_nps_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 10),
  comment text,
  source text NOT NULL DEFAULT 'whatsapp_assistant',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_nps_feedback_clinic
  ON public.patient_nps_feedback(clinic_id, created_at DESC);

ALTER TABLE public.patient_nps_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_nps_feedback_clinic" ON public.patient_nps_feedback;
CREATE POLICY "patient_nps_feedback_clinic"
  ON public.patient_nps_feedback FOR ALL
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );
