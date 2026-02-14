-- Permite registrar envio de mensagem para lead (formulário público) sem paciente
ALTER TABLE public.message_log
  ALTER COLUMN patient_id DROP NOT NULL;

COMMENT ON COLUMN public.message_log.patient_id IS 'Paciente (null quando envio para lead, ex. formulário público)';
