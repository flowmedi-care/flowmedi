-- Migration: Contagens reais de eventos + concluir todos
-- Corrige badge travado em 100 quando há mais registros que o p_limit da listagem.
-- Execute no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION public.get_event_counts(
  p_clinic_id uuid,
  p_secretary_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending bigint;
  v_completed bigint;
  v_all bigint;
  v_secretary_filter boolean;
BEGIN
  v_secretary_filter := (
    p_secretary_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.secretary_doctors sd
      WHERE sd.clinic_id = p_clinic_id AND sd.secretary_id = p_secretary_id
    )
  );

  SELECT COUNT(*) INTO v_pending
  FROM public.event_timeline et
  LEFT JOIN public.clinic_event_config cec
    ON cec.clinic_id = et.clinic_id AND cec.event_code = et.event_code
  WHERE et.clinic_id = p_clinic_id
    AND et.status = 'pending'
    AND COALESCE(cec.system_enabled, true) = true
    AND (
      NOT v_secretary_filter
      OR et.patient_id IS NULL
      OR et.patient_id IN (
        SELECT ps.patient_id FROM public.patient_secretary ps
        WHERE ps.clinic_id = p_clinic_id AND ps.secretary_id = p_secretary_id
      )
      OR et.patient_id NOT IN (
        SELECT ps2.patient_id FROM public.patient_secretary ps2
        WHERE ps2.clinic_id = p_clinic_id
      )
    );

  SELECT COUNT(*) INTO v_completed
  FROM public.event_timeline et
  WHERE et.clinic_id = p_clinic_id
    AND et.status IN ('sent', 'completed_without_send', 'completed')
    AND (
      NOT v_secretary_filter
      OR et.patient_id IS NULL
      OR et.patient_id IN (
        SELECT ps.patient_id FROM public.patient_secretary ps
        WHERE ps.clinic_id = p_clinic_id AND ps.secretary_id = p_secretary_id
      )
      OR et.patient_id NOT IN (
        SELECT ps2.patient_id FROM public.patient_secretary ps2
        WHERE ps2.clinic_id = p_clinic_id
      )
    );

  SELECT COUNT(*) INTO v_all
  FROM public.event_timeline et
  WHERE et.clinic_id = p_clinic_id
    AND (
      NOT v_secretary_filter
      OR et.patient_id IS NULL
      OR et.patient_id IN (
        SELECT ps.patient_id FROM public.patient_secretary ps
        WHERE ps.clinic_id = p_clinic_id AND ps.secretary_id = p_secretary_id
      )
      OR et.patient_id NOT IN (
        SELECT ps2.patient_id FROM public.patient_secretary ps2
        WHERE ps2.clinic_id = p_clinic_id
      )
    );

  RETURN jsonb_build_object(
    'pending', v_pending,
    'completed', v_completed,
    'all', v_all
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.concluir_todos_eventos(
  p_processed_by uuid DEFAULT auth.uid()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_role text;
  v_secretary_id uuid;
  v_count integer;
  v_secretary_filter boolean;
BEGIN
  IF p_processed_by IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT clinic_id, role INTO v_clinic_id, v_role
  FROM public.profiles
  WHERE id = p_processed_by;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica não encontrada';
  END IF;

  v_secretary_id := CASE WHEN v_role = 'secretaria' THEN p_processed_by ELSE NULL END;

  v_secretary_filter := (
    v_secretary_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.secretary_doctors sd
      WHERE sd.clinic_id = v_clinic_id AND sd.secretary_id = v_secretary_id
    )
  );

  WITH pending_ids AS (
    SELECT et.id
    FROM public.event_timeline et
    LEFT JOIN public.clinic_event_config cec
      ON cec.clinic_id = et.clinic_id AND cec.event_code = et.event_code
    WHERE et.clinic_id = v_clinic_id
      AND et.status = 'pending'
      AND COALESCE(cec.system_enabled, true) = true
      AND (
        NOT v_secretary_filter
        OR et.patient_id IS NULL
        OR et.patient_id IN (
          SELECT ps.patient_id FROM public.patient_secretary ps
          WHERE ps.clinic_id = v_clinic_id AND ps.secretary_id = v_secretary_id
        )
        OR et.patient_id NOT IN (
          SELECT ps2.patient_id FROM public.patient_secretary ps2
          WHERE ps2.clinic_id = v_clinic_id
        )
      )
  )
  UPDATE public.event_timeline et
  SET
    status = 'completed',
    processed_at = now(),
    processed_by = p_processed_by
  FROM pending_ids pi
  WHERE et.id = pi.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_counts(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.concluir_todos_eventos(uuid) TO authenticated;
