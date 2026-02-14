-- Migration: Corrigir coluna "type" em message_templates
-- Erro: null value in column "type" violates not-null constraint
-- A aplicação usa event_code; "type" é legado (clinic-integrations). Tornar opcional.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'message_templates'
      AND column_name = 'type'
  ) THEN
    -- Permitir NULL e definir default para novos inserts sem type
    ALTER TABLE public.message_templates
      ALTER COLUMN type DROP NOT NULL;
    ALTER TABLE public.message_templates
      ALTER COLUMN type SET DEFAULT 'custom';
    RAISE NOTICE 'Coluna type em message_templates: agora nullable com default ''custom''';
  END IF;
END $$;
