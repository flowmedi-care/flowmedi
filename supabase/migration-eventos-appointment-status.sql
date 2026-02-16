-- Retornar status atual da consulta (a.status) nas funções de eventos
-- para a UI mostrar "✓ Consulta marcada como realizada" em vez dos botões quando já executado

DROP FUNCTION IF EXISTS public.get_pending_events(uuid, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_all_events(uuid, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_completed_events(uuid, uuid, text, integer, integer);

-- get_pending_events + appointment_status
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
  appointment_status text,
  form_instance_id uuid,
  status text,
  origin text,
  occurred_at timestamptz,
  created_at timestamptz,
  channels text[],
  sent_channels text[],
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
    a.status AS appointment_status,
    et.form_instance_id,
    et.status,
    et.origin,
    et.occurred_at,
    et.created_at,
    et.channels,
    COALESCE(et.sent_channels, ARRAY[]::text[]),
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

-- get_all_events + appointment_status
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
  appointment_status text,
  form_instance_id uuid,
  status text,
  origin text,
  occurred_at timestamptz,
  processed_at timestamptz,
  processed_by uuid,
  processed_by_name text,
  created_at timestamptz,
  channels text[],
  sent_channels text[],
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
    a.status AS appointment_status,
    et.form_instance_id,
    et.status,
    et.origin,
    et.occurred_at,
    et.processed_at,
    et.processed_by,
    pr.full_name AS processed_by_name,
    et.created_at,
    et.channels,
    COALESCE(et.sent_channels, ARRAY[]::text[]),
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

-- get_completed_events + appointment_status
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
  appointment_status text,
  form_instance_id uuid,
  status text,
  origin text,
  occurred_at timestamptz,
  processed_at timestamptz,
  processed_by uuid,
  processed_by_name text,
  created_at timestamptz,
  channels text[],
  sent_channels text[],
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
    a.status AS appointment_status,
    et.form_instance_id,
    et.status,
    et.origin,
    et.occurred_at,
    et.processed_at,
    et.processed_by,
    pr.full_name AS processed_by_name,
    et.created_at,
    et.channels,
    COALESCE(et.sent_channels, ARRAY[]::text[]),
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

GRANT EXECUTE ON FUNCTION public.get_pending_events(uuid, uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_events(uuid, uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_completed_events(uuid, uuid, text, integer, integer) TO authenticated;
