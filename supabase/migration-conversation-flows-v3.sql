-- Conversation flows v3: política de atendimento, fluxos conversacionais, pendências e campos WhatsApp

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS appointment_policy jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clinics.appointment_policy IS
  'Política de atendimento por goal: { goals: { goal_id: ignore|optional|required } }';

ALTER TABLE public.clinic_virtual_assistant_settings
  ADD COLUMN IF NOT EXISTS conversation_flows jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clinic_virtual_assistant_settings.conversation_flows IS
  'Fluxos conversacionais por workflow (ordem visual, prioridades, modo express/assisted/strict)';

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS intake_pendencies jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.appointments.intake_pendencies IS
  'Campos/goals não coletados via WhatsApp no momento do agendamento';

ALTER TABLE public.patient_custom_fields
  ADD COLUMN IF NOT EXISTS whatsapp_policy text NOT NULL DEFAULT 'ignore';

ALTER TABLE public.patient_custom_fields
  DROP CONSTRAINT IF EXISTS patient_custom_fields_whatsapp_policy_check;

ALTER TABLE public.patient_custom_fields
  ADD CONSTRAINT patient_custom_fields_whatsapp_policy_check
  CHECK (whatsapp_policy IN ('ignore', 'optional', 'required'));

COMMENT ON COLUMN public.patient_custom_fields.whatsapp_policy IS
  'Política do campo no fluxo WhatsApp: ignore | optional | required';

-- Migrar include_in_public_form required para whatsapp_policy onde aplicável
UPDATE public.patient_custom_fields
SET whatsapp_policy = CASE
  WHEN required = true THEN 'required'
  WHEN include_in_public_form = true THEN 'optional'
  ELSE 'ignore'
END
WHERE whatsapp_policy = 'ignore'
  AND (include_in_public_form = true OR required = true);
