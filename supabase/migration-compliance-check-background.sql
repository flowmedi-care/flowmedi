-- Migration: Job em background para compliance de confirmação
-- Execute APÓS migration-eventos-consultas-full.sql (que tem appointment_not_confirmed)
--
-- Quando o prazo de compliance passa e a consulta ainda não está confirmada,
-- cria o evento appointment_not_confirmed na event_timeline.
-- O evento aparece em Pendentes (se system_enabled = true) com ação recomendada:
-- Confirmar / cancelar / remarcar Consulta.
--
-- Inclui função auxiliar usada por TODOS os jobs do cron: no dia da consulta após 08:00 (Brasília)
-- não criar eventos de compliance, para não competir com as ações de consulta confirmada.

-- ========== FUNÇÃO AUXILIAR: Usar em todos os jobs do cron ==========
-- Retorna true quando é o dia da consulta e já passou das 08:00 (Brasília).
-- Quando true, o job NÃO deve criar evento (deixa espaço para consulta confirmada).
CREATE OR REPLACE FUNCTION public.is_appointment_same_day_past_0800_br(p_scheduled_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    (p_scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
    AND (now() AT TIME ZONE 'America/Sao_Paulo')::time >= '08:00';
$$;

COMMENT ON FUNCTION public.is_appointment_same_day_past_0800_br IS
  'True se for o dia da consulta (Brasília) e já passou das 08:00. Jobs do cron não devem criar eventos nesse caso.';

GRANT EXECUTE ON FUNCTION public.is_appointment_same_day_past_0800_br TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_appointment_same_day_past_0800_br TO service_role;

-- ========== FUNÇÃO: Verificar compliance e criar evento "Consulta ainda não confirmada" ==========
CREATE OR REPLACE FUNCTION public.check_compliance_and_create_not_confirmed_events(
  p_clinic_id uuid DEFAULT NULL -- Se NULL, processa todas as clínicas
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment record;
  v_event_id uuid;
  v_created_count int := 0;
  v_event_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Consultas agendadas (não confirmadas) cujo prazo de compliance já passou
  FOR v_appointment IN
    SELECT
      a.id,
      a.clinic_id,
      a.patient_id,
      a.scheduled_at,
      c.compliance_confirmation_days AS days
    FROM public.appointments a
    JOIN public.clinics c ON c.id = a.clinic_id
    WHERE a.status = 'agendada'
      AND a.scheduled_at > now()
      AND c.compliance_confirmation_days IS NOT NULL
      AND c.compliance_confirmation_days >= 0
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
      -- Prazo de compliance: scheduled_at - X dias
      -- Se now() >= deadline, já passou o prazo
      AND now() >= (a.scheduled_at - (c.compliance_confirmation_days || ' days')::interval)
      -- Evitar duplicatas: ainda não existe evento appointment_not_confirmed para esta consulta
      AND NOT EXISTS (
        SELECT 1 FROM public.event_timeline et
        WHERE et.appointment_id = a.id
          AND et.event_code = 'appointment_not_confirmed'
          AND et.status IN ('pending', 'sent', 'completed_without_send', 'completed')
      )
      -- Regra única do cron: no dia da consulta após 08:00 (Brasília) não criar
      AND NOT public.is_appointment_same_day_past_0800_br(a.scheduled_at)
  LOOP
    SELECT public.create_event_timeline(
      p_clinic_id := v_appointment.clinic_id,
      p_event_code := 'appointment_not_confirmed',
      p_patient_id := v_appointment.patient_id,
      p_appointment_id := v_appointment.id,
      p_origin := 'automatic',
      p_occurred_at := now(),
      p_variables := jsonb_build_object(
        'appointment_id', v_appointment.id::text,
        'patient_id', v_appointment.patient_id::text,
        'scheduled_at', v_appointment.scheduled_at::text,
        'compliance_deadline_passed', true
      ),
      p_metadata := jsonb_build_object(
        'action_recommended', 'confirmar_cancelar_remarcar_consulta',
        'compliance_days', v_appointment.days
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

COMMENT ON FUNCTION public.check_compliance_and_create_not_confirmed_events IS 
  'Cria eventos appointment_not_confirmed para consultas agendadas cujo prazo de compliance já passou sem confirmação. Chamar periodicamente via cron (ex: 1x/dia).';

GRANT EXECUTE ON FUNCTION public.check_compliance_and_create_not_confirmed_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_compliance_and_create_not_confirmed_events TO service_role;
