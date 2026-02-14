-- Migration: Eventos e Consultas - clinic_event_config, status completed, novos eventos, compliance form, secretary_doctors, tipos padrão
-- Execute APÓS: migration-event-central.sql, migration-message-events-extend.sql, migration-compliance-confirmation-days.sql
--
-- 1. event_timeline: adicionar status 'completed'
-- 2. clinic_event_config: sistema (on/off) por evento
-- 3. message_events: appointment_not_confirmed, form_linked
-- 4. clinics: compliance_form_days, return_reminder_days
-- 5. secretary_doctors: quais médicos cada secretária atende
-- 6. appointment_types: slug + tipos padrão Consulta e Retorno por clínica

-- ========== 1. EVENT_TIMELINE: status 'completed' ==========
ALTER TABLE public.event_timeline
  DROP CONSTRAINT IF EXISTS event_timeline_status_check;

ALTER TABLE public.event_timeline
  ADD CONSTRAINT event_timeline_status_check
  CHECK (status IN ('pending', 'sent', 'completed_without_send', 'completed', 'ignored', 'failed'));

COMMENT ON COLUMN public.event_timeline.status IS 'pending: aguardando; sent: enviado; completed_without_send: ok sem enviar; completed: usuário clicou Concluir; ignored; failed';

-- ========== 2. CLINIC_EVENT_CONFIG (sistema on/off por evento) ==========
CREATE TABLE IF NOT EXISTS public.clinic_event_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  event_code text NOT NULL REFERENCES public.message_events(code) ON DELETE CASCADE,
  system_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, event_code)
);

COMMENT ON TABLE public.clinic_event_config IS 'Por evento: se está ligado para o sistema (on = aparece em Pendentes; off = só em Todos)';
CREATE INDEX IF NOT EXISTS idx_clinic_event_config_clinic ON public.clinic_event_config(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_event_config_event ON public.clinic_event_config(event_code);

ALTER TABLE public.clinic_event_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinic_event_config_clinic_access"
  ON public.clinic_event_config FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- Popular para todas as clínicas e todos os eventos (system_enabled = true por padrão)
INSERT INTO public.clinic_event_config (clinic_id, event_code, system_enabled)
SELECT c.id, me.code, true
FROM public.clinics c
CROSS JOIN public.message_events me
ON CONFLICT (clinic_id, event_code) DO NOTHING;

-- ========== 3. NOVOS EVENTOS: appointment_not_confirmed, form_linked, patient_registered ==========
-- patient_registered: não dispara contato (só card com ação "Agendar consulta"); default enabled = false
INSERT INTO public.message_events (code, name, description, category, default_enabled_email, default_enabled_whatsapp, can_be_automatic, requires_appointment)
VALUES
  ('appointment_not_confirmed', 'Consulta ainda não confirmada', 'Disparado quando a consulta agendada passa o prazo de compliance sem confirmação', 'agendamento', true, true, true, true),
  ('form_linked', 'Formulário vinculado', 'Disparado quando um novo formulário é vinculado ao paciente/consulta', 'formulario', true, true, true, true),
  ('patient_registered', 'Usuário cadastrado', 'Disparado quando o paciente é cadastrado (botão cadastrar). Não dispara email/WPP; apenas ação recomendada: Agendar consulta.', 'agendamento', false, false, false, false)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  default_enabled_email = EXCLUDED.default_enabled_email,
  default_enabled_whatsapp = EXCLUDED.default_enabled_whatsapp;

-- Inserir config por canal para novos eventos (clinic_message_settings já preenchido por trigger de nova clínica; para clínicas existentes)
INSERT INTO public.clinic_message_settings (clinic_id, event_code, channel, enabled, send_mode)
SELECT c.id, me.code, ch.channel,
  CASE WHEN ch.channel = 'email' THEN me.default_enabled_email ELSE me.default_enabled_whatsapp END,
  CASE WHEN me.can_be_automatic THEN 'automatic' ELSE 'manual' END
FROM public.clinics c
CROSS JOIN (SELECT code, default_enabled_email, default_enabled_whatsapp, can_be_automatic FROM public.message_events WHERE code IN ('appointment_not_confirmed', 'form_linked', 'patient_registered')) me
CROSS JOIN (VALUES ('email'), ('whatsapp')) AS ch(channel)
ON CONFLICT (clinic_id, event_code, channel) DO NOTHING;

INSERT INTO public.clinic_event_config (clinic_id, event_code, system_enabled)
SELECT c.id, me.code, true
FROM public.clinics c
CROSS JOIN (SELECT code FROM public.message_events WHERE code IN ('appointment_not_confirmed', 'form_linked', 'patient_registered')) me
ON CONFLICT (clinic_id, event_code) DO NOTHING;

-- ========== 4. CLINICS: compliance_form_days, return_reminder_days ==========
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS compliance_form_days integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_reminder_days integer DEFAULT NULL;

COMMENT ON COLUMN public.clinics.compliance_form_days IS 'Dias antes da consulta em que o formulário deve estar respondido. NULL = desligado.';
COMMENT ON COLUMN public.clinics.return_reminder_days IS 'Dias após consulta realizada para enviar lembrete de retorno. NULL = desligado.';

-- ========== 5. SECRETARY_DOCTORS (quais médicos cada secretária atende) ==========
CREATE TABLE IF NOT EXISTS public.secretary_doctors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  secretary_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, secretary_id, doctor_id)
);

COMMENT ON TABLE public.secretary_doctors IS 'Associação: quais médicos cada secretária atende (admin configura). Se vazio para uma secretária, mostrar todos os médicos.';
CREATE INDEX IF NOT EXISTS idx_secretary_doctors_clinic ON public.secretary_doctors(clinic_id);
CREATE INDEX IF NOT EXISTS idx_secretary_doctors_secretary ON public.secretary_doctors(secretary_id);

ALTER TABLE public.secretary_doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "secretary_doctors_clinic_access"
  ON public.secretary_doctors FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- ========== 6. APPOINTMENT_TYPES: slug + tipos padrão Consulta e Retorno ==========
ALTER TABLE public.appointment_types
  ADD COLUMN IF NOT EXISTS slug text DEFAULT NULL;

COMMENT ON COLUMN public.appointment_types.slug IS 'Slug fixo do sistema: consulta, retorno. Tipos com slug são inalteráveis (usados no código).';

-- Criar tipos padrão para cada clínica que ainda não tem
INSERT INTO public.appointment_types (clinic_id, name, duration_minutes, slug)
SELECT c.id, 'Consulta', 30, 'consulta'
FROM public.clinics c
WHERE NOT EXISTS (SELECT 1 FROM public.appointment_types at WHERE at.clinic_id = c.id AND at.slug = 'consulta')
ON CONFLICT DO NOTHING;

INSERT INTO public.appointment_types (clinic_id, name, duration_minutes, slug)
SELECT c.id, 'Retorno', 30, 'retorno'
FROM public.clinics c
WHERE NOT EXISTS (SELECT 1 FROM public.appointment_types at WHERE at.clinic_id = c.id AND at.slug = 'retorno')
ON CONFLICT DO NOTHING;

-- Garantir um único tipo por (clinic_id, slug) para slugs fixos (consulta, retorno)
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_types_clinic_slug
  ON public.appointment_types(clinic_id, slug);

-- Trigger: ao criar nova clínica, criar tipos Consulta e Retorno
CREATE OR REPLACE FUNCTION public.ensure_default_appointment_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.appointment_types (clinic_id, name, duration_minutes, slug)
  VALUES
    (NEW.id, 'Consulta', 30, 'consulta'),
    (NEW.id, 'Retorno', 30, 'retorno')
  ON CONFLICT (clinic_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_clinic_created_default_appointment_types ON public.clinics;
CREATE TRIGGER on_clinic_created_default_appointment_types
  AFTER INSERT ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_default_appointment_types();

-- ========== 7. FUNÇÕES: get_pending_events (com system_enabled), get_all_events, get_completed_events ==========

-- Pendentes: status = pending E system_enabled = true para aquele evento
CREATE OR REPLACE FUNCTION public.get_pending_events(
  p_clinic_id uuid,
  p_patient_id uuid DEFAULT NULL,
  p_event_code text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  event_code text,
  event_name text,
  event_category text,
  patient_id uuid,
  patient_name text,
  appointment_id uuid,
  appointment_scheduled_at timestamptz,
  form_instance_id uuid,
  status text,
  origin text,
  occurred_at timestamptz,
  created_at timestamptz,
  channels text[],
  template_ids jsonb,
  variables jsonb,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    et.id,
    et.event_code,
    me.name AS event_name,
    me.category AS event_category,
    et.patient_id,
    p.full_name AS patient_name,
    et.appointment_id,
    a.scheduled_at AS appointment_scheduled_at,
    et.form_instance_id,
    et.status,
    et.origin,
    et.occurred_at,
    et.created_at,
    et.channels,
    et.template_ids,
    et.variables,
    et.metadata
  FROM public.event_timeline et
  JOIN public.message_events me ON me.code = et.event_code
  LEFT JOIN public.clinic_event_config cec ON cec.clinic_id = et.clinic_id AND cec.event_code = et.event_code
  LEFT JOIN public.patients p ON p.id = et.patient_id
  LEFT JOIN public.appointments a ON a.id = et.appointment_id
  WHERE et.clinic_id = p_clinic_id
    AND et.status = 'pending'
    AND COALESCE(cec.system_enabled, true) = true
    AND (p_patient_id IS NULL OR et.patient_id = p_patient_id)
    AND (p_event_code IS NULL OR et.event_code = p_event_code)
  ORDER BY et.occurred_at DESC, et.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Todos: todos os eventos da clínica
CREATE OR REPLACE FUNCTION public.get_all_events(
  p_clinic_id uuid,
  p_patient_id uuid DEFAULT NULL,
  p_event_code text DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  event_code text,
  event_name text,
  event_category text,
  patient_id uuid,
  patient_name text,
  appointment_id uuid,
  appointment_scheduled_at timestamptz,
  form_instance_id uuid,
  status text,
  origin text,
  occurred_at timestamptz,
  processed_at timestamptz,
  processed_by uuid,
  processed_by_name text,
  created_at timestamptz,
  channels text[],
  template_ids jsonb,
  variables jsonb,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    et.id,
    et.event_code,
    me.name AS event_name,
    me.category AS event_category,
    et.patient_id,
    p.full_name AS patient_name,
    et.appointment_id,
    a.scheduled_at AS appointment_scheduled_at,
    et.form_instance_id,
    et.status,
    et.origin,
    et.occurred_at,
    et.processed_at,
    et.processed_by,
    pr.full_name AS processed_by_name,
    et.created_at,
    et.channels,
    et.template_ids,
    et.variables,
    et.metadata
  FROM public.event_timeline et
  JOIN public.message_events me ON me.code = et.event_code
  LEFT JOIN public.patients p ON p.id = et.patient_id
  LEFT JOIN public.appointments a ON a.id = et.appointment_id
  LEFT JOIN public.profiles pr ON pr.id = et.processed_by
  WHERE et.clinic_id = p_clinic_id
    AND (p_patient_id IS NULL OR et.patient_id = p_patient_id)
    AND (p_event_code IS NULL OR et.event_code = p_event_code)
  ORDER BY et.occurred_at DESC, et.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Concluídos: status in (sent, completed_without_send, completed)
CREATE OR REPLACE FUNCTION public.get_completed_events(
  p_clinic_id uuid,
  p_patient_id uuid DEFAULT NULL,
  p_event_code text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  event_code text,
  event_name text,
  event_category text,
  patient_id uuid,
  patient_name text,
  appointment_id uuid,
  appointment_scheduled_at timestamptz,
  form_instance_id uuid,
  status text,
  origin text,
  occurred_at timestamptz,
  processed_at timestamptz,
  processed_by uuid,
  processed_by_name text,
  created_at timestamptz,
  channels text[],
  template_ids jsonb,
  variables jsonb,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    et.id,
    et.event_code,
    me.name AS event_name,
    me.category AS event_category,
    et.patient_id,
    p.full_name AS patient_name,
    et.appointment_id,
    a.scheduled_at AS appointment_scheduled_at,
    et.form_instance_id,
    et.status,
    et.origin,
    et.occurred_at,
    et.processed_at,
    et.processed_by,
    pr.full_name AS processed_by_name,
    et.created_at,
    et.channels,
    et.template_ids,
    et.variables,
    et.metadata
  FROM public.event_timeline et
  JOIN public.message_events me ON me.code = et.event_code
  LEFT JOIN public.patients p ON p.id = et.patient_id
  LEFT JOIN public.appointments a ON a.id = et.appointment_id
  LEFT JOIN public.profiles pr ON pr.id = et.processed_by
  WHERE et.clinic_id = p_clinic_id
    AND et.status IN ('sent', 'completed_without_send', 'completed')
    AND (p_patient_id IS NULL OR et.patient_id = p_patient_id)
    AND (p_event_code IS NULL OR et.event_code = p_event_code)
  ORDER BY et.processed_at DESC NULLS LAST, et.occurred_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_completed_events TO authenticated;
