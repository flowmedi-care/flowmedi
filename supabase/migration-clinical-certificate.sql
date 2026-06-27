-- Certificate documents + procedure link on clinical_documents

ALTER TABLE public.clinical_documents
  DROP CONSTRAINT IF EXISTS clinical_documents_type_check;

ALTER TABLE public.clinical_documents
  ADD CONSTRAINT clinical_documents_type_check
  CHECK (type IN ('prescription', 'exam_request', 'certificate'));

ALTER TABLE public.clinical_documents
  ADD COLUMN IF NOT EXISTS procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_documents_procedure
  ON public.clinical_documents (procedure_id)
  WHERE procedure_id IS NOT NULL;

-- Catalog of saved certificate texts (mirror of clinical_exam_catalog)
CREATE TABLE IF NOT EXISTS public.clinical_certificate_catalog (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('clinic', 'doctor')),
  doctor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_body text NOT NULL DEFAULT '',
  default_days int NOT NULL DEFAULT 1,
  default_cid text NOT NULL DEFAULT '',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_certificate_catalog_clinic
  ON public.clinical_certificate_catalog (clinic_id, is_active);

ALTER TABLE public.clinical_certificate_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinical_certificate_catalog_select ON public.clinical_certificate_catalog
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY clinical_certificate_catalog_insert ON public.clinical_certificate_catalog
  FOR INSERT WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY clinical_certificate_catalog_update ON public.clinical_certificate_catalog
  FOR UPDATE USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY clinical_certificate_catalog_delete ON public.clinical_certificate_catalog
  FOR DELETE USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );
