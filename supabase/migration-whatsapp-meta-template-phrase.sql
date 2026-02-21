-- Migration: Suporte a template Meta no WhatsApp (frase editável por evento/clínica)
-- Adiciona whatsapp_meta_phrase para quando a janela de 24h está fechada

-- ========== 1. COLUNA EM SYSTEM_MESSAGE_TEMPLATES ==========
ALTER TABLE public.system_message_templates
  ADD COLUMN IF NOT EXISTS whatsapp_meta_phrase text;

COMMENT ON COLUMN public.system_message_templates.whatsapp_meta_phrase IS 'Frase editável para template Meta (janela 24h fechada). Usado em {{2}} do flowmedi_*. Só para channel=whatsapp.';

-- ========== 2. COLUNA EM MESSAGE_TEMPLATES ==========
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS whatsapp_meta_phrase text;

COMMENT ON COLUMN public.message_templates.whatsapp_meta_phrase IS 'Frase editável para template Meta (janela 24h fechada). Permite personalização por clínica.';
