-- Migration: Corrigir coluna "type" e "body" em message_templates
-- type: null value in column "type" violates not-null constraint
-- body: null value in column "body" violates not-null constraint (legado clinic-integrations)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'message_templates'
      AND column_name = 'type'
  ) THEN
    ALTER TABLE public.message_templates
      ALTER COLUMN type DROP NOT NULL;
    ALTER TABLE public.message_templates
      ALTER COLUMN type SET DEFAULT 'custom';
    RAISE NOTICE 'Coluna type: nullable com default ''custom''';
  END IF;
END $$;

-- body: se existir como NOT NULL, tornar opcional; se não existir, adicionar (para compatibilidade)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'message_templates' AND column_name = 'body'
  ) THEN
    ALTER TABLE public.message_templates ALTER COLUMN body DROP NOT NULL;
    ALTER TABLE public.message_templates ALTER COLUMN body SET DEFAULT '';
    RAISE NOTICE 'Coluna body: nullable com default vazio';
  ELSE
    ALTER TABLE public.message_templates ADD COLUMN body text DEFAULT '';
    RAISE NOTICE 'Coluna body: adicionada com default vazio';
  END IF;
END $$;
