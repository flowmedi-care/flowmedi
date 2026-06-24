-- Migration: Assistente Virtual WhatsApp com IA
-- Execute no SQL Editor do Supabase após as migrations de WhatsApp existentes.

-- ========== PLAN GATE ==========
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS virtual_assistant_enabled boolean DEFAULT false;

UPDATE public.plans
SET virtual_assistant_enabled = true
WHERE slug IN ('pro', 'profissional', 'essencial', 'estrategico')
  AND virtual_assistant_enabled IS NOT TRUE;

-- ========== CONFIGURAÇÃO DO ASSISTENTE ==========
CREATE TABLE IF NOT EXISTS public.clinic_virtual_assistant_settings (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  assistant_name text DEFAULT 'Assistente',
  tone text NOT NULL DEFAULT 'informal' CHECK (tone IN ('formal', 'informal')),
  use_emojis boolean NOT NULL DEFAULT true,
  segment text DEFAULT 'clinica',
  short_description text,
  google_maps_url text,
  parking_info text,
  accessibility_info text,
  landmarks text,
  has_multiple_units boolean NOT NULL DEFAULT false,
  human_handoff_enabled boolean NOT NULL DEFAULT true,
  human_handoff_hours jsonb DEFAULT '{}'::jsonb,
  message_debounce_seconds int NOT NULL DEFAULT 5 CHECK (message_debounce_seconds BETWEEN 2 AND 30),
  operating_hours jsonb DEFAULT '{}'::jsonb,
  holiday_policy text,
  payment_methods text[] DEFAULT '{}',
  cancellation_policy text,
  avg_wait_time text,
  delivery_info text,
  booking_requires_appointment boolean NOT NULL DEFAULT true,
  website_url text,
  active_promotions text,
  ai_model text NOT NULL DEFAULT 'gpt-4o-mini',
  max_context_messages int NOT NULL DEFAULT 20 CHECK (max_context_messages BETWEEN 5 AND 50),
  bot_active_start time without time zone,
  bot_active_end time without time zone,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinic_virtual_assistant_locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  google_maps_url text,
  phone text,
  operating_hours jsonb DEFAULT '{}'::jsonb,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_va_locations_clinic
  ON public.clinic_virtual_assistant_locations(clinic_id, display_order);

CREATE TABLE IF NOT EXISTS public.clinic_virtual_assistant_faq (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_va_faq_clinic
  ON public.clinic_virtual_assistant_faq(clinic_id, display_order);

-- ========== LOG DE TOOLS ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_ai_tool_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  params jsonb DEFAULT '{}'::jsonb,
  result_summary text,
  success boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_tool_log_clinic
  ON public.whatsapp_ai_tool_log(clinic_id, created_at DESC);

-- ========== CONFIRMAÇÕES PROATIVAS ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_ai_confirmation_outreach (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  UNIQUE (appointment_id)
);

-- ========== COLUNAS WHATSAPP ==========
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS ai_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_handoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_debounce_until timestamptz,
  ADD COLUMN IF NOT EXISTS ai_state jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_last_processed_message_at timestamptz;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS ai_processed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_ai_debounce
  ON public.whatsapp_conversations(ai_debounce_until)
  WHERE ai_debounce_until IS NOT NULL AND ai_handoff_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_ai_pending
  ON public.whatsapp_messages(conversation_id, sent_at)
  WHERE ai_processed_at IS NULL AND direction = 'inbound';

-- ========== RLS ==========
ALTER TABLE public.clinic_virtual_assistant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_virtual_assistant_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_virtual_assistant_faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_ai_tool_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_ai_confirmation_outreach ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "va_settings_clinic" ON public.clinic_virtual_assistant_settings;
CREATE POLICY "va_settings_clinic" ON public.clinic_virtual_assistant_settings
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "va_locations_clinic" ON public.clinic_virtual_assistant_locations;
CREATE POLICY "va_locations_clinic" ON public.clinic_virtual_assistant_locations
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "va_faq_clinic" ON public.clinic_virtual_assistant_faq;
CREATE POLICY "va_faq_clinic" ON public.clinic_virtual_assistant_faq
  FOR ALL USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "va_tool_log_read" ON public.whatsapp_ai_tool_log;
CREATE POLICY "va_tool_log_read" ON public.whatsapp_ai_tool_log
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "va_confirmation_read" ON public.whatsapp_ai_confirmation_outreach;
CREATE POLICY "va_confirmation_read" ON public.whatsapp_ai_confirmation_outreach
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );
