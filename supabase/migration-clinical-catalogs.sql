-- Migration: Catálogos de medicamentos e exames (clínica + médico)
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.clinical_medication_catalog (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('clinic', 'doctor')),
  doctor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_dosage text DEFAULT '',
  default_quantity text DEFAULT '',
  default_instructions text DEFAULT '',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT clinical_medication_catalog_doctor_scope CHECK (
    (scope = 'clinic' AND doctor_id IS NULL) OR (scope = 'doctor' AND doctor_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.clinical_exam_catalog (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('clinic', 'doctor')),
  doctor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT clinical_exam_catalog_doctor_scope CHECK (
    (scope = 'clinic' AND doctor_id IS NULL) OR (scope = 'doctor' AND doctor_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_clinical_medication_catalog_clinic ON public.clinical_medication_catalog(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinical_exam_catalog_clinic ON public.clinical_exam_catalog(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinical_exam_catalog_category ON public.clinical_exam_catalog(category);

ALTER TABLE public.clinical_medication_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_exam_catalog ENABLE ROW LEVEL SECURITY;

-- Medication catalog policies (mirror templates)
CREATE POLICY "medication_catalog_read_clinic"
  ON public.clinical_medication_catalog FOR SELECT
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    AND (scope = 'clinic' OR doctor_id = auth.uid())
  );

CREATE POLICY "medication_catalog_admin_clinic"
  ON public.clinical_medication_catalog FOR ALL
  USING (
    scope = 'clinic'
    AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    scope = 'clinic' AND doctor_id IS NULL
    AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "medication_catalog_doctor_own"
  ON public.clinical_medication_catalog FOR ALL
  USING (
    scope = 'doctor' AND doctor_id = auth.uid()
    AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'medico')
  )
  WITH CHECK (
    scope = 'doctor' AND doctor_id = auth.uid()
    AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'medico')
  );

CREATE POLICY "exam_catalog_read_clinic"
  ON public.clinical_exam_catalog FOR SELECT
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
    AND (scope = 'clinic' OR doctor_id = auth.uid())
  );

CREATE POLICY "exam_catalog_admin_clinic"
  ON public.clinical_exam_catalog FOR ALL
  USING (
    scope = 'clinic'
    AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    scope = 'clinic' AND doctor_id IS NULL
    AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "exam_catalog_doctor_own"
  ON public.clinical_exam_catalog FOR ALL
  USING (
    scope = 'doctor' AND doctor_id = auth.uid()
    AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'medico')
  )
  WITH CHECK (
    scope = 'doctor' AND doctor_id = auth.uid()
    AND clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid() AND role = 'medico')
  );
