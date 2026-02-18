-- Migration: Adiciona telefone e email da clínica
-- Execute no SQL Editor do Supabase

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS email_header_template text DEFAULT 'minimal',
  ADD COLUMN IF NOT EXISTS email_footer_template text DEFAULT 'minimal',
  ADD COLUMN IF NOT EXISTS email_branding_colors jsonb DEFAULT '{"primary": "#007bff", "secondary": "#6c757d", "text": "#333333", "background": "#ffffff"}';

COMMENT ON COLUMN public.clinics.phone IS 'Telefone da clínica para uso em cabeçalhos/rodapés';
COMMENT ON COLUMN public.clinics.email IS 'Email da clínica para uso em cabeçalhos/rodapés';
COMMENT ON COLUMN public.clinics.address IS 'Endereço completo da clínica';
COMMENT ON COLUMN public.clinics.email_header_template IS 'Template escolhido para cabeçalho: minimal, centered, modern';
COMMENT ON COLUMN public.clinics.email_footer_template IS 'Template escolhido para rodapé: minimal, centered, modern';
COMMENT ON COLUMN public.clinics.email_branding_colors IS 'Cores customizadas para branding dos emails: primary, secondary, text, background';
