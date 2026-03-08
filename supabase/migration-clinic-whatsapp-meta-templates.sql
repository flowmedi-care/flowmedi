-- Controle por clínica dos 3 templates canônicos WhatsApp aprovados na Meta

CREATE TABLE IF NOT EXISTS public.clinic_whatsapp_meta_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  template_key text NOT NULL CHECK (template_key IN ('flowmedi_consulta', 'flowmedi_formulario', 'flowmedi_aviso')),
  template_name text NOT NULL,
  meta_template_id text,
  status text NOT NULL DEFAULT 'PENDING',
  last_error text,
  requested_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_clinic_whatsapp_meta_templates_clinic_id
  ON public.clinic_whatsapp_meta_templates(clinic_id);

ALTER TABLE public.clinic_whatsapp_meta_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_whatsapp_meta_templates_read_clinic"
  ON public.clinic_whatsapp_meta_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.clinic_id = clinic_whatsapp_meta_templates.clinic_id
    )
  );

CREATE POLICY "clinic_whatsapp_meta_templates_manage_admin"
  ON public.clinic_whatsapp_meta_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.clinic_id = clinic_whatsapp_meta_templates.clinic_id
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.clinic_id = clinic_whatsapp_meta_templates.clinic_id
        AND p.role = 'admin'
    )
  );

DROP TRIGGER IF EXISTS update_clinic_whatsapp_meta_templates_updated_at
  ON public.clinic_whatsapp_meta_templates;

CREATE TRIGGER update_clinic_whatsapp_meta_templates_updated_at
  BEFORE UPDATE ON public.clinic_whatsapp_meta_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

