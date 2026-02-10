-- Migration: Campos customizados para pacientes e logos
-- Execute no SQL Editor do Supabase

-- ========== CAMPOS CUSTOMIZADOS PARA PACIENTES ==========
CREATE TABLE IF NOT EXISTS public.patient_custom_fields (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'textarea', 'select')),
  field_label text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  options text[], -- Para campos do tipo 'select'
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_patient_custom_fields_clinic_id ON public.patient_custom_fields(clinic_id);

-- Adicionar coluna para armazenar valores dos campos customizados nos pacientes
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}';

-- ========== LOGOS ==========
-- Logo da clínica
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Logo do médico (opcional, só para médicos)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_url text;

-- ========== RLS PARA CAMPOS CUSTOMIZADOS ==========
ALTER TABLE public.patient_custom_fields ENABLE ROW LEVEL SECURITY;

-- Admin da clínica pode gerenciar campos customizados
CREATE POLICY "patient_custom_fields_admin_all"
  ON public.patient_custom_fields
  FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin' AND active
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin' AND active
    )
  );

-- Membros da clínica podem ler campos customizados
CREATE POLICY "patient_custom_fields_read_clinic"
  ON public.patient_custom_fields
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND active
    )
  );

-- ========== STORAGE BUCKET PARA LOGOS ==========
-- Nota: Execute manualmente no Supabase Dashboard → Storage → Create bucket
-- Nome do bucket: 'logos'
-- Public: false (privado)
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- Política de storage (execute após criar o bucket manualmente):
-- CREATE POLICY "Logo upload clinic admin"
--   ON storage.objects FOR INSERT
--   WITH CHECK (
--     bucket_id = 'logos' AND
--     auth.uid() IN (
--       SELECT id FROM public.profiles WHERE role = 'admin' AND active
--     )
--   );
--
-- CREATE POLICY "Logo update clinic admin"
--   ON storage.objects FOR UPDATE
--   USING (
--     bucket_id = 'logos' AND
--     auth.uid() IN (
--       SELECT id FROM public.profiles WHERE role = 'admin' AND active
--     )
--   );
--
-- CREATE POLICY "Logo read public"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'logos');
