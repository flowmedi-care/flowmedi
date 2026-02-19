-- Corrige erro PGRST204: coluna 'body' não encontrada em whatsapp_messages
-- Execute no SQL Editor do Supabase

-- Adiciona coluna body se não existir (tabela pode ter sido criada com schema diferente)
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS body text;

-- Se a tabela tiver 'content' em vez de 'body', copiar dados e usar body
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'content'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'body'
  ) THEN
    UPDATE public.whatsapp_messages SET body = content WHERE body IS NULL;
  END IF;
END $$;
