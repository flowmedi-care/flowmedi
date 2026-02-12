-- Migration: Sistema de Lembretes Automáticos (30/15/7/48/24/2 horas antes)
-- Execute APÓS migration-event-central.sql
--
-- Este migration cria funções para gerar lembretes automaticamente
-- baseados na data/hora agendada das consultas

-- ========== FUNÇÃO: Gerar lembretes para consultas futuras ==========
CREATE OR REPLACE FUNCTION public.generate_reminder_events(
  p_clinic_id uuid DEFAULT NULL -- Se NULL, processa todas as clínicas
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment record;
  v_days_until int;
  v_hours_until numeric;
  v_event_code text;
  v_event_id uuid;
  v_created_count int := 0;
  v_skipped_count int := 0;
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- Buscar consultas agendadas futuras
  FOR v_appointment IN
    SELECT 
      a.id,
      a.clinic_id,
      a.patient_id,
      a.scheduled_at,
      a.status,
      -- Calcular dias até a consulta
      EXTRACT(EPOCH FROM (a.scheduled_at - now())) / 86400 AS days_until,
      -- Calcular horas até a consulta
      EXTRACT(EPOCH FROM (a.scheduled_at - now())) / 3600 AS hours_until
    FROM public.appointments a
    WHERE a.status IN ('agendada', 'confirmada')
      AND a.scheduled_at > now()
      AND (p_clinic_id IS NULL OR a.clinic_id = p_clinic_id)
  LOOP
    -- Verificar se já existe evento de lembrete para esta consulta e este período
    -- (evitar duplicatas)
    
    v_days_until := FLOOR(v_appointment.days_until);
    v_hours_until := v_appointment.hours_until;
    
    -- Determinar qual lembrete deve ser criado (se ainda não foi criado)
    -- Regra: criar apenas o próximo lembrete válido
    
    -- Lembrete 30 dias (se faltam entre 30 e 15 dias)
    IF v_days_until >= 15 AND v_days_until < 30 THEN
      -- Verificar se já existe
      IF NOT EXISTS (
        SELECT 1 FROM public.event_timeline
        WHERE appointment_id = v_appointment.id
          AND event_code = 'appointment_reminder_30d'
          AND status != 'ignored'
      ) THEN
        SELECT public.create_event_timeline(
          p_clinic_id := v_appointment.clinic_id,
          p_event_code := 'appointment_reminder_30d',
          p_patient_id := v_appointment.patient_id,
          p_appointment_id := v_appointment.id,
          p_origin := 'automatic',
          p_occurred_at := now(),
          p_variables := jsonb_build_object(
            'appointment_id', v_appointment.id::text,
            'patient_id', v_appointment.patient_id::text,
            'scheduled_at', v_appointment.scheduled_at::text,
            'days_until', v_days_until
          )
        ) INTO v_event_id;
        v_created_count := v_created_count + 1;
      ELSE
        v_skipped_count := v_skipped_count + 1;
      END IF;
    END IF;
    
    -- Lembrete 15 dias (se faltam entre 15 e 7 dias)
    IF v_days_until >= 7 AND v_days_until < 15 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.event_timeline
        WHERE appointment_id = v_appointment.id
          AND event_code = 'appointment_reminder_15d'
          AND status != 'ignored'
      ) THEN
        SELECT public.create_event_timeline(
          p_clinic_id := v_appointment.clinic_id,
          p_event_code := 'appointment_reminder_15d',
          p_patient_id := v_appointment.patient_id,
          p_appointment_id := v_appointment.id,
          p_origin := 'automatic',
          p_occurred_at := now(),
          p_variables := jsonb_build_object(
            'appointment_id', v_appointment.id::text,
            'patient_id', v_appointment.patient_id::text,
            'scheduled_at', v_appointment.scheduled_at::text,
            'days_until', v_days_until
          )
        ) INTO v_event_id;
        v_created_count := v_created_count + 1;
      ELSE
        v_skipped_count := v_skipped_count + 1;
      END IF;
    END IF;
    
    -- Lembrete 7 dias (se faltam entre 7 dias e 48 horas)
    IF v_days_until >= 2 AND v_days_until < 7 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.event_timeline
        WHERE appointment_id = v_appointment.id
          AND event_code = 'appointment_reminder_7d'
          AND status != 'ignored'
      ) THEN
        SELECT public.create_event_timeline(
          p_clinic_id := v_appointment.clinic_id,
          p_event_code := 'appointment_reminder_7d',
          p_patient_id := v_appointment.patient_id,
          p_appointment_id := v_appointment.id,
          p_origin := 'automatic',
          p_occurred_at := now(),
          p_variables := jsonb_build_object(
            'appointment_id', v_appointment.id::text,
            'patient_id', v_appointment.patient_id::text,
            'scheduled_at', v_appointment.scheduled_at::text,
            'days_until', v_days_until
          )
        ) INTO v_event_id;
        v_created_count := v_created_count + 1;
      ELSE
        v_skipped_count := v_skipped_count + 1;
      END IF;
    END IF;
    
    -- Lembrete 48h (se faltam entre 48h e 24h)
    IF v_hours_until >= 24 AND v_hours_until < 48 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.event_timeline
        WHERE appointment_id = v_appointment.id
          AND event_code = 'appointment_reminder_48h'
          AND status != 'ignored'
      ) THEN
        SELECT public.create_event_timeline(
          p_clinic_id := v_appointment.clinic_id,
          p_event_code := 'appointment_reminder_48h',
          p_patient_id := v_appointment.patient_id,
          p_appointment_id := v_appointment.id,
          p_origin := 'automatic',
          p_occurred_at := now(),
          p_variables := jsonb_build_object(
            'appointment_id', v_appointment.id::text,
            'patient_id', v_appointment.patient_id::text,
            'scheduled_at', v_appointment.scheduled_at::text,
            'hours_until', v_hours_until
          )
        ) INTO v_event_id;
        v_created_count := v_created_count + 1;
      ELSE
        v_skipped_count := v_skipped_count + 1;
      END IF;
    END IF;
    
    -- Lembrete 24h (se faltam entre 24h e 2h)
    IF v_hours_until >= 2 AND v_hours_until < 24 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.event_timeline
        WHERE appointment_id = v_appointment.id
          AND event_code = 'appointment_reminder_24h'
          AND status != 'ignored'
      ) THEN
        SELECT public.create_event_timeline(
          p_clinic_id := v_appointment.clinic_id,
          p_event_code := 'appointment_reminder_24h',
          p_patient_id := v_appointment.patient_id,
          p_appointment_id := v_appointment.id,
          p_origin := 'automatic',
          p_occurred_at := now(),
          p_variables := jsonb_build_object(
            'appointment_id', v_appointment.id::text,
            'patient_id', v_appointment.patient_id::text,
            'scheduled_at', v_appointment.scheduled_at::text,
            'hours_until', v_hours_until
          )
        ) INTO v_event_id;
        v_created_count := v_created_count + 1;
      ELSE
        v_skipped_count := v_skipped_count + 1;
      END IF;
    END IF;
    
    -- Lembrete 2h (se faltam menos de 2h)
    IF v_hours_until >= 0 AND v_hours_until < 2 THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.event_timeline
        WHERE appointment_id = v_appointment.id
          AND event_code = 'appointment_reminder_2h'
          AND status != 'ignored'
      ) THEN
        SELECT public.create_event_timeline(
          p_clinic_id := v_appointment.clinic_id,
          p_event_code := 'appointment_reminder_2h',
          p_patient_id := v_appointment.patient_id,
          p_appointment_id := v_appointment.id,
          p_origin := 'automatic',
          p_occurred_at := now(),
          p_variables := jsonb_build_object(
            'appointment_id', v_appointment.id::text,
            'patient_id', v_appointment.patient_id::text,
            'scheduled_at', v_appointment.scheduled_at::text,
            'hours_until', v_hours_until
          )
        ) INTO v_event_id;
        v_created_count := v_created_count + 1;
      ELSE
        v_skipped_count := v_skipped_count + 1;
      END IF;
    END IF;
    
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'created', v_created_count,
    'skipped', v_skipped_count
  );
END;
$$;

-- ========== FUNÇÃO: Limpar lembretes antigos inválidos ==========
-- Remove lembretes pendentes de consultas que já passaram ou foram canceladas
CREATE OR REPLACE FUNCTION public.cleanup_invalid_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count int;
BEGIN
  -- Marcar como ignorados os eventos pendentes de consultas que:
  -- 1. Já passaram (scheduled_at < now())
  -- 2. Foram canceladas
  -- 3. Já foram realizadas ou marcadas como falta
  UPDATE public.event_timeline et
  SET status = 'ignored',
      processed_at = now(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('reason', 'appointment_past_or_invalid')
  FROM public.appointments a
  WHERE et.appointment_id = a.id
    AND et.status = 'pending'
    AND et.event_code LIKE 'appointment_reminder%'
    AND (
      a.scheduled_at < now()
      OR a.status IN ('cancelada', 'realizada', 'falta')
    );
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'ignored_count', v_updated_count
  );
END;
$$;

-- ========== GRANTS ==========
GRANT EXECUTE ON FUNCTION public.generate_reminder_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_invalid_reminders TO authenticated;

-- ========== COMENTÁRIOS ==========
COMMENT ON FUNCTION public.generate_reminder_events IS 'Gera lembretes automáticos para consultas futuras baseado em dias/horas até a consulta. Deve ser chamada periodicamente (ex: via cron job ou scheduled function).';
COMMENT ON FUNCTION public.cleanup_invalid_reminders IS 'Limpa lembretes pendentes de consultas que já passaram ou foram canceladas/realizadas. Deve ser chamada periodicamente.';
