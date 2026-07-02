-- Consentimento LGPD: configuração por clínica, extensão da tabela consents e enforcement.
-- Execute no SQL Editor do Supabase.

-- ========== CONFIGURAÇÃO POR CLÍNICA ==========
CREATE TABLE IF NOT EXISTS public.clinic_consent_settings (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  require_consent_for_marketing boolean NOT NULL DEFAULT true,
  block_marketing_without_consent boolean NOT NULL DEFAULT true,
  default_consent_text text DEFAULT 'Autorizo o recebimento de comunicações de marketing e promoções da clínica por e-mail e WhatsApp.',
  transactional_legal_basis_note text DEFAULT 'Mensagens transacionais de agenda, formulários e confirmações são enviadas com base na execução do contrato de prestação de serviços de saúde e no legítimo interesse, conforme orientação da clínica controladora.',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clinic_consent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_consent_settings_admin"
  ON public.clinic_consent_settings
  FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "clinic_consent_settings_read_members"
  ON public.clinic_consent_settings
  FOR SELECT
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

-- ========== EXTENSÃO CONSENTS ==========
ALTER TABLE public.consents
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'communications'
    CHECK (purpose IN ('marketing', 'communications', 'data_processing')),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

COMMENT ON COLUMN public.consents.purpose IS 'marketing = promoções; communications = mensagens não transacionais; data_processing = tratamento geral';
COMMENT ON COLUMN public.consents.revoked_at IS 'Quando preenchido, consentimento revogado';

-- Backfill clinic_id from patients
UPDATE public.consents c
SET clinic_id = p.clinic_id
FROM public.patients p
WHERE c.patient_id = p.id AND c.clinic_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_consents_patient_purpose
  ON public.consents(patient_id, purpose)
  WHERE revoked_at IS NULL;

-- ========== DATA SUBJECT REQUESTS (DSAR) ==========
CREATE TABLE IF NOT EXISTS public.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('access', 'correction', 'deletion', 'portability', 'opposition', 'other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'rejected')),
  requester_name text,
  requester_email text,
  requester_phone text,
  notes text,
  response_notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dsar_clinic_admin"
  ON public.data_subject_requests
  FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "dsar_clinic_read_staff"
  ON public.data_subject_requests
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'secretaria')
    )
  );

-- ========== WHATSAPP AI PRIVACY NOTICE ==========
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS ai_privacy_notice_sent_at timestamptz;

COMMENT ON COLUMN public.whatsapp_conversations.ai_privacy_notice_sent_at IS
  'Quando o aviso de privacidade/IA foi enviado ao titular nesta conversa';
