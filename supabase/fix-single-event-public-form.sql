-- Corrige: criar APENAS 1 evento por formulário público (não 2).
-- Execute no SQL Editor do Supabase se ainda estiver criando 2 eventos.
-- Diferença: público = appointment_id IS NULL (formulário público); senão = formulário do paciente.

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

    -- Um único evento: público (sem paciente) ou paciente (vinculado à consulta)
    SELECT public.create_event_timeline(
      p_clinic_id := v_template_clinic_id,
      p_event_code := v_event_code,
      p_patient_id := v_patient_id,
      p_appointment_id := NEW.appointment_id,
      p_form_instance_id := NEW.id,
      p_origin := CASE WHEN v_is_public THEN 'system' ELSE 'patient' END,
      p_occurred_at := COALESCE(NEW.updated_at, NEW.created_at, now()),
      p_variables := jsonb_build_object(
        'form_instance_id', NEW.id::text,
        'form_template_id', NEW.form_template_id::text,
        'is_public', v_is_public
      ),
      p_metadata := jsonb_build_object(
        'public_submitter_email', NEW.public_submitter_email,
        'public_submitter_name', NEW.public_submitter_name,
        'public_submitter_phone', NEW.public_submitter_phone,
        'form_instance_id', NEW.id::text
      ) || CASE WHEN v_is_public THEN jsonb_build_object('action_required', 'register_patient') ELSE '{}'::jsonb END
    ) INTO v_event_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_form_completed_event ON public.form_instances;
CREATE TRIGGER on_form_completed_event
  AFTER INSERT OR UPDATE ON public.form_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_form_completed_event();
