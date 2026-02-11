-- Migration: Correção - Adicionar colunas faltantes na tabela message_templates
-- Execute se receber erro sobre coluna event_code não existir
-- Esta migration verifica e adiciona as colunas necessárias na tabela message_templates

-- ========== VERIFICAR ESTRUTURA ATUAL DA TABELA ==========
-- Primeiro, vamos verificar quais colunas existem
DO $$
DECLARE
  has_event_code boolean;
  has_channel boolean;
  has_type boolean;
BEGIN
  -- Verificar se a tabela existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'message_templates'
  ) THEN
    -- Verificar colunas existentes
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'event_code'
    ) INTO has_event_code;
    
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'channel'
    ) INTO has_channel;
    
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'type'
    ) INTO has_type;
    
    -- Se tem 'type' mas não tem 'event_code', provavelmente é a estrutura antiga
    -- Vamos adicionar as colunas necessárias
    IF has_type AND NOT has_event_code THEN
      RAISE NOTICE 'Tabela message_templates tem estrutura antiga. Adicionando colunas...';
      
      -- Adicionar event_code (nullable por enquanto, pode ser preenchido depois)
      ALTER TABLE public.message_templates
        ADD COLUMN IF NOT EXISTS event_code text;
      
      -- Se já tem channel, não precisa adicionar
      IF NOT has_channel THEN
        ALTER TABLE public.message_templates
          ADD COLUMN IF NOT EXISTS channel text CHECK (channel IN ('email', 'whatsapp'));
      END IF;
      
      RAISE NOTICE 'Colunas event_code e channel adicionadas. Você precisará atualizar os registros existentes.';
    END IF;
  END IF;
END $$;

-- ========== VERIFICAR E ADICIONAR OUTRAS COLUNAS SE NECESSÁRIO ==========
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'message_templates'
  ) THEN
    -- Adicionar coluna channel se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'channel'
    ) THEN
      ALTER TABLE public.message_templates
        ADD COLUMN channel text CHECK (channel IN ('email', 'whatsapp'));
      RAISE NOTICE 'Coluna channel adicionada';
    END IF;
    
    -- Adicionar coluna subject se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'subject'
    ) THEN
      ALTER TABLE public.message_templates
        ADD COLUMN subject text;
      RAISE NOTICE 'Coluna subject adicionada';
    END IF;
    
    -- Adicionar coluna body_html se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'body_html'
    ) THEN
      ALTER TABLE public.message_templates
        ADD COLUMN body_html text;
      RAISE NOTICE 'Coluna body_html adicionada';
    END IF;
    
    -- Adicionar coluna body_text se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'body_text'
    ) THEN
      ALTER TABLE public.message_templates
        ADD COLUMN body_text text;
      RAISE NOTICE 'Coluna body_text adicionada';
    END IF;
    
    -- Adicionar coluna variables_used se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'variables_used'
    ) THEN
      ALTER TABLE public.message_templates
        ADD COLUMN variables_used jsonb DEFAULT '[]';
      RAISE NOTICE 'Coluna variables_used adicionada';
    END IF;
    
    -- Adicionar coluna is_active se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'is_active'
    ) THEN
      ALTER TABLE public.message_templates
        ADD COLUMN is_active boolean DEFAULT true;
      RAISE NOTICE 'Coluna is_active adicionada';
    END IF;
    
    -- Adicionar coluna is_default se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'is_default'
    ) THEN
      ALTER TABLE public.message_templates
        ADD COLUMN is_default boolean DEFAULT false;
      RAISE NOTICE 'Coluna is_default adicionada';
    END IF;
  END IF;
END $$;

-- ========== VERIFICAR ESTRUTURA FINAL ==========
-- Execute esta query para verificar se todas as colunas foram adicionadas:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name = 'message_templates'
-- ORDER BY ordinal_position;
