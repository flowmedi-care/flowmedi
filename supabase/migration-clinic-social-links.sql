-- Migration: Links de redes sociais da clínica (WhatsApp, Facebook, Instagram)
-- Execute no SQL Editor do Supabase

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS whatsapp_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text;

COMMENT ON COLUMN public.clinics.whatsapp_url IS 'Link do WhatsApp da clínica (ex: https://wa.me/5562999999999)';
COMMENT ON COLUMN public.clinics.facebook_url IS 'Link do Facebook da clínica';
COMMENT ON COLUMN public.clinics.instagram_url IS 'Link do Instagram da clínica';
