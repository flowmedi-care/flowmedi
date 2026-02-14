-- Cabeçalho e rodapé únicos por clínica (aplicados a todos os emails)
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS email_header text,
  ADD COLUMN IF NOT EXISTS email_footer text;

COMMENT ON COLUMN public.clinics.email_header IS 'Cabeçalho HTML aplicado a todos os emails da clínica';
COMMENT ON COLUMN public.clinics.email_footer IS 'Rodapé HTML aplicado a todos os emails da clínica';
