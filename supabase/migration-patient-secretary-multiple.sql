-- Migration: patient_secretary - permitir múltiplas secretárias por paciente
-- Um paciente pode ter várias secretárias (ex.: dois procedimentos, dois médicos, duas secretárias).
-- Execute após: migration-patient-secretary.sql

-- Remover constraint antiga (uma secretária por paciente)
ALTER TABLE public.patient_secretary
  DROP CONSTRAINT IF EXISTS patient_secretary_clinic_id_patient_id_key;

-- Nova constraint: um mesmo (patient, secretary) só pode aparecer uma vez
ALTER TABLE public.patient_secretary
  ADD CONSTRAINT patient_secretary_clinic_patient_secretary_unique
  UNIQUE(clinic_id, patient_id, secretary_id);

COMMENT ON TABLE public.patient_secretary IS 'Associação paciente ↔ secretárias (pode ter várias). Preenchida ao atribuir conversa WhatsApp, ao agendar, etc.';
