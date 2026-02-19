-- Corrige erros em whatsapp_messages
-- Execute no SQL Editor do Supabase

-- Coluna body (erro PGRST204)
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS body text;

-- Coluna clinic_id (erro 23502; se sua tabela já tiver clinic_id NOT NULL, ignore esta parte)
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;
UPDATE public.whatsapp_messages wm SET clinic_id = wc.clinic_id
  FROM public.whatsapp_conversations wc WHERE wm.conversation_id = wc.id AND wm.clinic_id IS NULL;

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
