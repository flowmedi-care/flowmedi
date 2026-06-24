-- Migration: mime type de mídia nas mensagens WhatsApp (áudio/imagem)
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_mime_type text;
