-- Migration: Job em background para compliance de formulário vinculado
-- Execute APÓS migration-eventos-consultas-full.sql (compliance_form_days, form_reminder)
--
-- Quando o prazo de compliance do formulário passa (X dias antes da consulta) e o
-- formulário vinculado ainda está pendente, cria o evento form_reminder na event_timeline.
-- O evento aparece em Pendentes e pode disparar email/WhatsApp (lembrete para preencher).

-- ========== FUNÇÃO: Verificar compliance de formulário e criar evento "Lembrete Formulário" ==========
CREATE OR REPLACE FUNCTION public.check_compliance_and_create_form_reminder_events(
  p_clinic_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_event_id uuid;
  v_created_count int := 0;
  v_event_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR v_row IN
    SELECT
      fi.id AS form_instance_id,
      a.id AS appointment_id,
      a.clinic_id,
      a.patient_id,
      a.scheduled_at,
      c.compliance_form_days AS days
    FROM public.form_instances fi
    JOIN public.appointments a ON a.id = fi.appointment_id
    JOIN public.clinics c ON c.id = a.clinic_id
    WHERE fi.appointment_id IS NOT NULL
      AND fi.status = 'pendente'
      AND a.scheduled_at > now()
      AND a.status = 'agendada'
      AND c.compliance_form_days IS NOT NULL
      AND c.compliance_form_days >= 0
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      AND now() >= (a.scheduled_at - (c.compliance_form_days || ' days')::interval)
      AND NOT EXISTS (
        SELECT 1 FROM public.event_timeline et
        WHERE et.form_instance_id = fi.id
          AND et.event_code = 'form_reminder'
          AND et.status IN ('pending', 'sent', 'completed_without_send', 'completed')
      )
  LOOP
    SELECT public.create_event_timeline(
      p_clinic_id := v_row.clinic_id,
      p_event_code := 'form_reminder',
      p_patient_id := v_row.patient_id,
      p_appointment_id := v_row.appointment_id,
      p_form_instance_id := v_row.form_instance_id,
      p_origin := 'automatic',
      p_occurred_at := now(),
      p_variables := jsonb_build_object(
        'appointment_id', v_row.appointment_id::text,
        'patient_id', v_row.patient_id::text,
        'form_instance_id', v_row.form_instance_id::text,
        'scheduled_at', v_row.scheduled_at::text,
        'compliance_form_deadline_passed', true
      ),
      p_metadata := jsonb_build_object(
        'action_recommended', 'entrar_em_contato',
        'compliance_form_days', v_row.days
      )
    ) INTO v_event_id;
    v_created_count := v_created_count + 1;
    v_event_ids := array_append(v_event_ids, v_event_id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'created_count', v_created_count,
    'event_ids', to_jsonb(v_event_ids)
  );
END;
$$;

COMMENT ON FUNCTION public.check_compliance_and_create_form_reminder_events IS
  'Cria eventos form_reminder para formulários vinculados a consultas cujo prazo de compliance (X dias antes da consulta) já passou sem resposta. Chamar periodicamente via cron (ex: junto com check_compliance_and_create_not_confirmed_events).';

GRANT EXECUTE ON FUNCTION public.check_compliance_and_create_form_reminder_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_compliance_and_create_form_reminder_events TO service_role;
