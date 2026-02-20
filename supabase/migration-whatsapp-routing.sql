-- Migration: Roteamento de conversas WhatsApp por secretária
-- - doctor_procedures: quais médicos executam quais procedimentos
-- - conversation_eligible_secretaries: pool de secretárias elegíveis (quando assigned_secretary_id = null)
-- - clinic_whatsapp_routing_settings: estratégia (general_secretary | first_responder | chatbot) + secretária geral
-- - whatsapp_conversations: assigned_secretary_id, patient_id, assigned_at

-- ========== 1. DOCTOR_PROCEDURES (médico executa procedimento) ==========
CREATE TABLE IF NOT EXISTS public.doctor_procedures (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, doctor_id, procedure_id)
);

CREATE INDEX IF NOT EXISTS idx_doctor_procedures_clinic ON public.doctor_procedures(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctor_procedures_doctor ON public.doctor_procedures(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_procedures_procedure ON public.doctor_procedures(procedure_id);

COMMENT ON TABLE public.doctor_procedures IS 'Quais médicos executam quais procedimentos. Usado no chatbot para vincular paciente à secretária.';

ALTER TABLE public.doctor_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor_procedures_clinic_access"
  ON public.doctor_procedures FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- ========== 2. CLINIC_WHATSAPP_ROUTING_SETTINGS ==========
CREATE TABLE IF NOT EXISTS public.clinic_whatsapp_routing_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE UNIQUE,
  routing_strategy text NOT NULL DEFAULT 'first_responder' 
    CHECK (routing_strategy IN ('general_secretary', 'first_responder', 'chatbot')),
  general_secretary_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_whatsapp_routing_clinic ON public.clinic_whatsapp_routing_settings(clinic_id);

COMMENT ON TABLE public.clinic_whatsapp_routing_settings IS 'Config do admin: estratégia de roteamento e secretária geral (se general_secretary)';
COMMENT ON COLUMN public.clinic_whatsapp_routing_settings.routing_strategy IS 'general_secretary: encaminha para secretária designada; first_responder: primeira que responder assume; chatbot: menu inicial';
COMMENT ON COLUMN public.clinic_whatsapp_routing_settings.general_secretary_id IS 'Obrigatório quando routing_strategy = general_secretary';

ALTER TABLE public.clinic_whatsapp_routing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_whatsapp_routing_admin"
  ON public.clinic_whatsapp_routing_settings FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- ========== 3. WHATSAPP_CONVERSATIONS: novos campos ==========
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS assigned_secretary_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_assigned_secretary 
  ON public.whatsapp_conversations(assigned_secretary_id);

COMMENT ON COLUMN public.whatsapp_conversations.assigned_secretary_id IS 'Secretária responsável pela conversa. NULL = em pool (first_responder ou eligible)';
COMMENT ON COLUMN public.whatsapp_conversations.patient_id IS 'Paciente vinculado (quando cadastrado)';
COMMENT ON COLUMN public.whatsapp_conversations.assigned_at IS 'Quando a conversa foi atribuída à secretária';

-- ========== 4. CONVERSATION_ELIGIBLE_SECRETARIES (pool) ==========
CREATE TABLE IF NOT EXISTS public.conversation_eligible_secretaries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  secretary_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, secretary_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_eligible_conversation 
  ON public.conversation_eligible_secretaries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_eligible_secretary 
  ON public.conversation_eligible_secretaries(secretary_id);

COMMENT ON TABLE public.conversation_eligible_secretaries IS 'Pool: quando assigned_secretary_id é null, só essas secretárias veem a conversa';

ALTER TABLE public.conversation_eligible_secretaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_eligible_secretaries_clinic"
  ON public.conversation_eligible_secretaries FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM public.whatsapp_conversations
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.whatsapp_conversations
      WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    )
    AND secretary_id IN (SELECT id FROM public.profiles WHERE clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()))
  );

-- ========== 5. RLS: UPDATE em whatsapp_conversations (assign/forward) ==========
DROP POLICY IF EXISTS "whatsapp_conversations_update_clinic" ON public.whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_update_clinic"
  ON public.whatsapp_conversations FOR UPDATE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND COALESCE(active, true) = true
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND COALESCE(active, true) = true
    )
  );

-- ========== 6. Inserir linha padrão de routing por clínica ==========
INSERT INTO public.clinic_whatsapp_routing_settings (clinic_id, routing_strategy)
SELECT id, 'first_responder' FROM public.clinics
ON CONFLICT (clinic_id) DO NOTHING;
