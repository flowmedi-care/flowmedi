-- Atestado ficha uses certificate type (aligned with clinical_documents)

ALTER TABLE public.clinical_ficha_templates
  DROP CONSTRAINT IF EXISTS clinical_ficha_templates_ficha_type_check;

ALTER TABLE public.clinical_ficha_templates
  ADD CONSTRAINT clinical_ficha_templates_ficha_type_check
  CHECK (ficha_type IN ('fields', 'prescription', 'exam_request', 'notes', 'certificate'));

UPDATE public.clinical_ficha_templates
SET ficha_type = 'certificate', definition = '[]'::jsonb
WHERE slug = 'atestado';
