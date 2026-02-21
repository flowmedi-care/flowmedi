-- Migration: doctor_referral_codes → custom_message (mensagem personalizada pelo médico)
-- O médico escreve a mensagem que o paciente verá; sistema faz match por similaridade
--
-- Execute após: migration-doctor-referral-codes.sql

-- Remover constraint antiga (code único)
ALTER TABLE public.doctor_referral_codes
  DROP CONSTRAINT IF EXISTS doctor_referral_codes_clinic_id_code_key;

-- Adicionar coluna custom_message e migrar/remover code
ALTER TABLE public.doctor_referral_codes
  ADD COLUMN IF NOT EXISTS custom_message text;

-- Migrar: preencher com template usando o nome do médico
UPDATE public.doctor_referral_codes drc
SET custom_message = 'Olá gostaria de obter mais informação sobre a consulta com o dr ' ||
  COALESCE(TRIM(initcap((SELECT full_name FROM public.profiles p WHERE p.id = drc.doctor_id))), '[seu nome]')
WHERE custom_message IS NULL;

-- Fallback para mensagem padrão se ainda null
UPDATE public.doctor_referral_codes
SET custom_message = 'Olá gostaria de obter mais informação sobre a consulta com o dr [seu nome]'
WHERE custom_message IS NULL OR custom_message = '';

-- Remover coluna code
ALTER TABLE public.doctor_referral_codes
  DROP COLUMN IF EXISTS code;

-- Um config por médico (permite upsert)
ALTER TABLE public.doctor_referral_codes
  DROP CONSTRAINT IF EXISTS doctor_referral_codes_clinic_doctor_unique;
ALTER TABLE public.doctor_referral_codes
  ADD CONSTRAINT doctor_referral_codes_clinic_doctor_unique UNIQUE(clinic_id, doctor_id);

-- Remover índice antigo de code
DROP INDEX IF EXISTS public.idx_doctor_referral_codes_code;

COMMENT ON TABLE public.doctor_referral_codes IS 'Mensagem personalizada por médico para link de divulgação. Paciente envia a mensagem; sistema faz match e vincula à secretária do médico.';
COMMENT ON COLUMN public.doctor_referral_codes.custom_message IS 'Mensagem que o paciente verá preenchida ao clicar no link. Ex: Olá gostaria de obter mais informação sobre a consulta com o dr [seu nome].';
