-- Migration: Templates e documentos clínicos (receitas e pedidos de exame)
-- Execute no SQL Editor do Supabase

-- ========== TEMPLATES ==========
CREATE TABLE IF NOT EXISTS public.clinical_document_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('prescription', 'exam_request')),
  scope text NOT NULL CHECK (scope IN ('clinic', 'doctor')),
  doctor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  body text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT clinical_document_templates_doctor_scope CHECK (
    (scope = 'clinic' AND doctor_id IS NULL) OR (scope = 'doctor' AND doctor_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_clinical_document_templates_clinic ON public.clinical_document_templates(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinical_document_templates_type ON public.clinical_document_templates(type);
CREATE INDEX IF NOT EXISTS idx_clinical_document_templates_doctor ON public.clinical_document_templates(doctor_id);

-- ========== DOCUMENTOS EMITIDOS ==========
CREATE TABLE IF NOT EXISTS public.clinical_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('prescription', 'exam_request')),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.clinical_document_templates(id) ON DELETE SET NULL,
  title text,
  body_text text NOT NULL DEFAULT '',
  body_rendered text,
  structured_content jsonb NOT NULL DEFAULT '{}',
  signature_mode text CHECK (signature_mode IS NULL OR signature_mode IN ('manual', 'digital_icp')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signature', 'issued_manual', 'signed_digital', 'void')),
  pdf_path text,
  icp_metadata jsonb DEFAULT '{}',
  finalized_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_documents_clinic ON public.clinical_documents(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinical_documents_patient ON public.clinical_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_documents_appointment ON public.clinical_documents(appointment_id);
CREATE INDEX IF NOT EXISTS idx_clinical_documents_doctor ON public.clinical_documents(doctor_id);
CREATE INDEX IF NOT EXISTS idx_clinical_documents_status ON public.clinical_documents(status);

-- ========== RLS ==========
ALTER TABLE public.clinical_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinical_templates_read_clinic" ON public.clinical_document_templates;
DROP POLICY IF EXISTS "clinical_templates_admin_clinic" ON public.clinical_document_templates;
DROP POLICY IF EXISTS "clinical_templates_doctor_own" ON public.clinical_document_templates;

CREATE POLICY "clinical_templates_read_clinic"
  ON public.clinical_document_templates FOR SELECT
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    AND (
      scope = 'clinic'
      OR doctor_id = auth.uid()
    )
  );

CREATE POLICY "clinical_templates_admin_clinic"
  ON public.clinical_document_templates FOR ALL
  USING (
    scope = 'clinic'
    AND clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    scope = 'clinic'
    AND doctor_id IS NULL
    AND clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "clinical_templates_doctor_own"
  ON public.clinical_document_templates FOR ALL
  USING (
    scope = 'doctor'
    AND doctor_id = auth.uid()
    AND clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'medico'
    )
  )
  WITH CHECK (
    scope = 'doctor'
    AND doctor_id = auth.uid()
    AND clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'medico'
    )
  );

DROP POLICY IF EXISTS "clinical_documents_read_clinic" ON public.clinical_documents;
DROP POLICY IF EXISTS "clinical_documents_doctor_write" ON public.clinical_documents;

CREATE POLICY "clinical_documents_read_clinic"
  ON public.clinical_documents FOR SELECT
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "clinical_documents_doctor_write"
  ON public.clinical_documents FOR ALL
  USING (
    doctor_id = auth.uid()
    AND clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'medico'
    )
  )
  WITH CHECK (
    doctor_id = auth.uid()
    AND clinic_id IN (
      SELECT clinic_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'medico'
    )
  );
