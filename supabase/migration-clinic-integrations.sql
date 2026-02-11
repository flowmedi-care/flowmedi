-- Migration: Integrações de email e WhatsApp por clínica
-- Execute no SQL Editor do Supabase

-- ========== INTEGRAÇÕES DE CLÍNICA ==========
CREATE TABLE IF NOT EXISTS public.clinic_integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  integration_type text NOT NULL CHECK (integration_type IN ('email_google', 'whatsapp_meta')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'error', 'disconnected')),
  credentials jsonb NOT NULL DEFAULT '{}', -- Tokens OAuth, access_token, refresh_token (criptografados)
  metadata jsonb DEFAULT '{}', -- Email vinculado, número WhatsApp, etc.
  connected_at timestamptz,
  last_sync_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, integration_type)
);

CREATE INDEX IF NOT EXISTS idx_clinic_integrations_clinic_id ON public.clinic_integrations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_integrations_type ON public.clinic_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_clinic_integrations_status ON public.clinic_integrations(status);

-- ========== TEMPLATES DE MENSAGENS ==========
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'both')),
  type text NOT NULL CHECK (type IN ('appointment_reminder', 'form_link', 'confirmation', 'custom')),
  subject text, -- Para email
  body text NOT NULL, -- Corpo da mensagem
  variables jsonb DEFAULT '[]', -- Lista de variáveis usadas: ["{{patient_name}}", "{{appointment_date}}"]
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_clinic_id ON public.message_templates(clinic_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_channel ON public.message_templates(channel);
CREATE INDEX IF NOT EXISTS idx_message_templates_type ON public.message_templates(type);
CREATE INDEX IF NOT EXISTS idx_message_templates_active ON public.message_templates(is_active);

-- ========== RLS ==========
ALTER TABLE public.clinic_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Política: Admin da clínica pode gerenciar integrações
CREATE POLICY "clinic_integrations_admin_all"
  ON public.clinic_integrations
  FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin' AND active
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin' AND active
    )
  );

-- Política: Membros da clínica podem ler integrações (para ver status)
CREATE POLICY "clinic_integrations_read_clinic"
  ON public.clinic_integrations
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND active
    )
  );

-- Política: Admin da clínica pode gerenciar templates
CREATE POLICY "message_templates_admin_all"
  ON public.message_templates
  FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin' AND active
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin' AND active
    )
  );

-- Política: Membros da clínica podem ler templates ativos
CREATE POLICY "message_templates_read_clinic"
  ON public.message_templates
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND active
    )
    AND is_active = true
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clinic_integrations_updated_at
  BEFORE UPDATE ON public.clinic_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
