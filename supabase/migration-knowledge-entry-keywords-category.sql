-- Knowledge entries: keywords + category for retrieval / organization
ALTER TABLE public.clinic_virtual_assistant_faq
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS category text;

COMMENT ON COLUMN public.clinic_virtual_assistant_faq.keywords IS 'Optional keywords to boost FAQ retrieval match';
COMMENT ON COLUMN public.clinic_virtual_assistant_faq.category IS 'Optional category label for knowledge entries';
