-- Migration: Disparar evento de formulário preenchido também no INSERT
-- O formulário público faz INSERT com status 'respondido', então o trigger
-- que só rodava em UPDATE nunca disparava. Agora roda em INSERT e UPDATE.

CREATE OR REPLACE FUNCTION public.trigger_form_completed_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_code text;
  v_event_id uuid;
  v_clinic_id uuid;
  v_patient_id uuid;
  v_is_public boolean;
  v_template_clinic_id uuid;
BEGIN
  -- INSERT com status respondido (ex: formulário público) ou UPDATE para respondido
  IF (TG_OP = 'INSERT' AND NEW.status = 'respondido')
     OR (TG_OP = 'UPDATE' AND (OLD.status IS NULL OR OLD.status != 'respondido') AND NEW.status = 'respondido') THEN

    v_is_public := (NEW.appointment_id IS NULL);

    SELECT clinic_id INTO v_template_clinic_id
    FROM public.form_templates
    WHERE id = NEW.form_template_id;

    IF v_template_clinic_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF NOT v_is_public THEN
      SELECT patient_id INTO v_patient_id
      FROM public.appointments
      WHERE id = NEW.appointment_id;
    END IF;

    IF v_is_public THEN
      v_event_code := 'public_form_completed';
    ELSE
      v_event_code := 'patient_form_completed';
    END IF;

    -- Criar evento principal
    SELECT public.create_event_timeline(
      p_clinic_id := v_template_clinic_id,
      p_event_code := v_event_code,
      p_patient_id := v_patient_id,
      p_appointment_id := NEW.appointment_id,
      p_form_instance_id := NEW.id,
      p_origin := 'patient',
      p_occurred_at := COALESCE(NEW.updated_at, NEW.created_at, now()),
      p_variables := jsonb_build_object(
        'form_instance_id', NEW.id::text,
        'form_template_id', NEW.form_template_id::text,
        'is_public', v_is_public
      ),
      p_metadata := jsonb_build_object(
        'public_submitter_email', NEW.public_submitter_email,
        'public_submitter_name', NEW.public_submitter_name,
        'public_submitter_phone', NEW.public_submitter_phone
      )
    ) INTO v_event_id;

    -- Formulário público: segundo evento com ação recomendada (cadastrar paciente)
    IF v_is_public THEN
      SELECT public.create_event_timeline(
        p_clinic_id := v_template_clinic_id,
        p_event_code := 'public_form_completed',
        p_form_instance_id := NEW.id,
        p_origin := 'system',
        p_occurred_at := COALESCE(NEW.updated_at, NEW.created_at, now()),
        p_metadata := jsonb_build_object(
          'action_required', 'register_patient',
          'public_submitter_email', NEW.public_submitter_email,
          'public_submitter_name', NEW.public_submitter_name,
          'public_submitter_phone', NEW.public_submitter_phone,
          'form_instance_id', NEW.id::text
        )
      ) INTO v_event_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recriar trigger para INSERT e UPDATE
DROP TRIGGER IF EXISTS on_form_completed_event ON public.form_instances;
CREATE TRIGGER on_form_completed_event
  AFTER INSERT OR UPDATE ON public.form_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_form_completed_event();

-- ========== Pendentes: só eventos com "Sistema" ligado (on) ==========
-- Se system_enabled = false, o evento aparece só em "Todos", não em "Pendentes".
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
