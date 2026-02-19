-- Migration: Integração WhatsApp Simples + Conversas
-- Execute no SQL Editor do Supabase

-- ========== ATUALIZAR TIPOS DE INTEGRAÇÃO ==========
-- Adicionar 'whatsapp_simple' ao CHECK constraint
ALTER TABLE public.clinic_integrations
  DROP CONSTRAINT IF EXISTS clinic_integrations_integration_type_check;

ALTER TABLE public.clinic_integrations
  ADD CONSTRAINT clinic_integrations_integration_type_check
  CHECK (integration_type IN ('email_google', 'whatsapp_meta', 'whatsapp_simple'));

-- ========== CONVERSAS WHATSAPP ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone_number text NOT NULL, -- Número do contato (formato: 5511999999999)
  contact_name text, -- Nome do contato (se disponível)
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text, -- Preview da última mensagem
  unread_count int DEFAULT 0,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_clinic_id ON public.whatsapp_conversations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone_number ON public.whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_message_at ON public.whatsapp_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_unread ON public.whatsapp_conversations(clinic_id, is_archived, unread_count) WHERE unread_count > 0;

-- ========== MENSAGENS WHATSAPP ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  message_id text, -- ID da mensagem da Meta (wamid.xxx)
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'template')),
  content text NOT NULL, -- Texto da mensagem ou descrição da mídia
  media_url text, -- URL da mídia (se aplicável)
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}', -- Dados adicionais da Meta
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_clinic_id ON public.whatsapp_messages(clinic_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON public.whatsapp_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at DESC);

-- ========== RLS ==========
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Política: Membros da clínica podem ler e criar conversas
CREATE POLICY "whatsapp_conversations_clinic_all"
  ON public.whatsapp_conversations
  FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND active
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND active
    )
  );

-- Política: Membros da clínica podem ler e criar mensagens
CREATE POLICY "whatsapp_messages_clinic_all"
  ON public.whatsapp_messages
  FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND active
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND active
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
