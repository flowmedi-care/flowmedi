-- Migration: Tabelas para chat WhatsApp (conversas e mensagens)
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard → SQL Editor → New query
-- 
-- Esta migration cria:
-- 1. Tabela whatsapp_conversations (conversas por clínica/número)
-- 2. Tabela whatsapp_messages (mensagens de cada conversa)
-- 3. Atualiza clinic_integrations para incluir 'whatsapp_simple'
-- 4. Configura RLS (Row Level Security)
-- 5. Cria índices para performance

-- ========== CONVERSAS WHATSAPP ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone_number text NOT NULL, -- Número do paciente (ex: 5511999999999)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_clinic_id 
  ON public.whatsapp_conversations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone_number 
  ON public.whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_updated_at 
  ON public.whatsapp_conversations(updated_at DESC);

-- ========== MENSAGENS WHATSAPP ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body text, -- Texto da mensagem (null se for mídia)
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id 
  ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at 
  ON public.whatsapp_messages(sent_at ASC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction 
  ON public.whatsapp_messages(direction);

-- ========== ATUALIZAR clinic_integrations PARA INCLUIR whatsapp_simple ==========
-- Remove constraint antiga se existir
DO $$ 
BEGIN
  -- Tenta remover constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'clinic_integrations_integration_type_check'
    AND table_name = 'clinic_integrations'
  ) THEN
    ALTER TABLE public.clinic_integrations 
      DROP CONSTRAINT clinic_integrations_integration_type_check;
  END IF;
END $$;

-- Adiciona nova constraint incluindo whatsapp_simple
ALTER TABLE public.clinic_integrations
  ADD CONSTRAINT clinic_integrations_integration_type_check 
  CHECK (integration_type IN ('email_google', 'whatsapp_meta', 'whatsapp_simple'));

-- ========== RLS (Row Level Security) ==========
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Remove políticas existentes se houver (para permitir reexecução)
DROP POLICY IF EXISTS "whatsapp_conversations_read_clinic" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "whatsapp_conversations_insert_clinic" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "whatsapp_messages_read_clinic" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "whatsapp_messages_insert_clinic" ON public.whatsapp_messages;

-- Política: Membros da clínica podem ler conversas da sua clínica
CREATE POLICY "whatsapp_conversations_read_clinic"
  ON public.whatsapp_conversations
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND active
    )
  );

-- Política: Membros da clínica podem criar conversas (quando recebem mensagem)
CREATE POLICY "whatsapp_conversations_insert_clinic"
  ON public.whatsapp_conversations
  FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND active
    )
  );

-- Política: Membros da clínica podem ler mensagens das conversas da sua clínica
CREATE POLICY "whatsapp_messages_read_clinic"
  ON public.whatsapp_messages
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.whatsapp_conversations
      WHERE clinic_id IN (
        SELECT clinic_id FROM public.profiles 
        WHERE id = auth.uid() AND active
      )
    )
  );

-- Política: Membros da clínica podem inserir mensagens (enviar/receber)
CREATE POLICY "whatsapp_messages_insert_clinic"
  ON public.whatsapp_messages
  FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.whatsapp_conversations
      WHERE clinic_id IN (
        SELECT clinic_id FROM public.profiles 
        WHERE id = auth.uid() AND active
      )
    )
  );

-- ========== TRIGGER PARA ATUALIZAR updated_at NA CONVERSA ==========
-- Quando uma nova mensagem é inserida, atualiza updated_at da conversa
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.whatsapp_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove triggers existentes se houver (para permitir reexecução)
DROP TRIGGER IF EXISTS update_whatsapp_conversation_on_message ON public.whatsapp_messages;
DROP TRIGGER IF EXISTS update_whatsapp_conversations_updated_at ON public.whatsapp_conversations;

CREATE TRIGGER update_whatsapp_conversation_on_message
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_updated_at();

-- ========== TRIGGER PARA updated_at NA CONVERSA (UPDATE) ==========
CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========== VERIFICAÇÃO ==========
-- Execute estas queries para verificar se tudo foi criado corretamente:

-- Verificar se tabelas foram criadas
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('whatsapp_conversations', 'whatsapp_messages');

-- Verificar se constraint foi atualizada
-- SELECT constraint_name, check_clause 
-- FROM information_schema.check_constraints 
-- WHERE constraint_name = 'clinic_integrations_integration_type_check';

-- Verificar se políticas RLS foram criadas
-- SELECT tablename, policyname 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('whatsapp_conversations', 'whatsapp_messages');
