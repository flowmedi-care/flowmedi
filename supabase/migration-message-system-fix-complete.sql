-- Migration: Correção completa - Adaptar tabela message_templates existente
-- Execute se receber erro sobre coluna event_code não existir
-- Esta migration adapta a estrutura antiga da tabela para a nova estrutura

-- ========== VERIFICAR E ADICIONAR COLUNAS FALTANTES ==========
DO $$
BEGIN
  -- Verificar se a tabela existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'message_templates'
  ) THEN
    -- Adicionar event_code se não existir
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'event_code'
    ) THEN
      ALTER TABLE public.message_templates
        ADD COLUMN event_code text;
      RAISE NOTICE 'Coluna event_code adicionada';
    END IF;
    
    -- Adicionar body_html se não existir (e se body existir, copiar dados)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'body_html'
    ) THEN
      -- Se existe coluna 'body', vamos copiar os dados
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'message_templates' 
        AND column_name = 'body'
      ) THEN
        ALTER TABLE public.message_templates
          ADD COLUMN body_html text;
        -- Copiar dados de body para body_html
        UPDATE public.message_templates
          SET body_html = body
          WHERE body IS NOT NULL;
        RAISE NOTICE 'Coluna body_html adicionada e dados copiados de body';
      ELSE
        ALTER TABLE public.message_templates
          ADD COLUMN body_html text;
        RAISE NOTICE 'Coluna body_html adicionada';
      END IF;
    END IF;
    
    -- Adicionar body_text se não existir
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
    
    -- Adicionar variables_used se não existir (e se variables existir, copiar dados)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'message_templates' 
      AND column_name = 'variables_used'
    ) THEN
      -- Se existe coluna 'variables', vamos copiar os dados
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'message_templates' 
        AND column_name = 'variables'
      ) THEN
        ALTER TABLE public.message_templates
          ADD COLUMN variables_used jsonb DEFAULT '[]';
        -- Copiar dados de variables para variables_used
        UPDATE public.message_templates
          SET variables_used = variables
          WHERE variables IS NOT NULL;
        RAISE NOTICE 'Coluna variables_used adicionada e dados copiados de variables';
      ELSE
        ALTER TABLE public.message_templates
          ADD COLUMN variables_used jsonb DEFAULT '[]';
        RAISE NOTICE 'Coluna variables_used adicionada';
      END IF;
    END IF;
    
    -- Adicionar is_default se não existir
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
    
    -- Ajustar constraint de channel se necessário (remover 'both' se existir)
    -- Primeiro verificar se há constraint
    IF EXISTS (
      SELECT 1 FROM information_schema.check_constraints 
      WHERE constraint_schema = 'public' 
      AND constraint_name LIKE '%channel%'
    ) THEN
      -- Remover constraint antiga se tiver 'both'
      -- Nota: PostgreSQL não permite remover constraint específica facilmente
      -- Vamos apenas adicionar uma nova constraint se necessário
      RAISE NOTICE 'Verifique manualmente a constraint de channel se necessário';
    END IF;
    
  ELSE
    RAISE NOTICE 'Tabela message_templates não existe. Execute primeiro migration-message-system.sql';
  END IF;
END $$;

-- ========== ADICIONAR FOREIGN KEY SE NECESSÁRIO ==========
DO $$
BEGIN
  -- Adicionar foreign key para event_code se a tabela message_events existir
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'message_events'
  ) THEN
    -- Verificar se a constraint já existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = 'public' 
      AND table_name = 'message_templates' 
      AND constraint_name = 'message_templates_event_code_fkey'
    ) THEN
      -- Adicionar constraint (pode falhar se houver dados com event_code inválido)
      BEGIN
        ALTER TABLE public.message_templates
          ADD CONSTRAINT message_templates_event_code_fkey 
          FOREIGN KEY (event_code) 
          REFERENCES public.message_events(code) 
          ON DELETE CASCADE;
        RAISE NOTICE 'Foreign key adicionada para event_code';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Não foi possível adicionar foreign key. Verifique se há dados com event_code inválido.';
      END;
    END IF;
  END IF;
END $$;

-- ========== MIGRAR DADOS DA ESTRUTURA ANTIGA (se type existir) ==========
DO $$
BEGIN
  -- Se existe coluna 'type', tentar mapear para event_code
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'message_templates' 
    AND column_name = 'type'
  ) THEN
    -- Mapear tipos antigos para códigos de eventos novos
    UPDATE public.message_templates
    SET event_code = CASE 
      WHEN type = 'appointment_reminder' THEN 'appointment_reminder_24h'
      WHEN type = 'form_link' THEN 'form_link_sent'
      WHEN type = 'confirmation' THEN 'appointment_confirmed'
      ELSE 'form_link_sent' -- fallback
    END
    WHERE event_code IS NULL AND type IS NOT NULL;
    
    RAISE NOTICE 'Dados migrados de type para event_code';
  END IF;
END $$;

-- ========== VERIFICAR ESTRUTURA FINAL ==========
-- Execute esta query para verificar se todas as colunas foram adicionadas:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name = 'message_templates'
-- ORDER BY ordinal_position;
