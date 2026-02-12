-- Migration: Central de Eventos - Sistema completo de rastreamento e gestão de eventos
-- Execute no SQL Editor do Supabase APÓS:
-- - schema.sql
-- - migration-message-system.sql
-- - migration-message-events-extend.sql
-- - migration-public-forms.sql
--
-- Este migration cria:
-- 1. Tabela event_timeline para rastrear TODOS os eventos (pendentes e passados)
-- 2. Triggers para gerar eventos automaticamente quando coisas acontecem
-- 3. Funções para processar eventos em cadeia
-- 4. Integração com pending_messages existente
-- 5. Queries úteis para UI

-- ========== TABELA CENTRAL DE EVENTOS ==========
CREATE TABLE IF NOT EXISTS public.event_timeline (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  form_instance_id uuid REFERENCES public.form_instances(id) ON DELETE SET NULL,
  
  -- Tipo do evento (código do message_events)
  event_code text NOT NULL REFERENCES public.message_events(code) ON DELETE CASCADE,
  
  -- Status do evento
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed_without_send', 'ignored', 'failed')),
  
  -- Origem do evento
  origin text NOT NULL DEFAULT 'system' CHECK (origin IN ('system', 'user', 'patient', 'automatic')),
  
  -- Dados do evento
  occurred_at timestamptz NOT NULL DEFAULT now(), -- Quando o fato aconteceu (ex: consulta foi realizada)
  created_at timestamptz NOT NULL DEFAULT now(), -- Quando o evento foi criado no sistema
  processed_at timestamptz, -- Quando foi enviado/marcado como ok
  
  -- Quem processou
  processed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Canais que devem ser usados (array de strings)
  channels text[] DEFAULT ARRAY[]::text[],
  
  -- Templates que serão usados (por canal)
  template_ids jsonb DEFAULT '{}', -- { "email": "uuid", "whatsapp": "uuid" }
  
  -- Variáveis para templates
  variables jsonb DEFAULT '{}',
  
  -- Metadados extras
  metadata jsonb DEFAULT '{}',
  
  -- Mensagens relacionadas (se foram criadas pending_messages)
  pending_message_ids uuid[] DEFAULT ARRAY[]::uuid[],
  
  -- Mensagens enviadas (se foram logadas em message_log)
  sent_message_ids uuid[] DEFAULT ARRAY[]::uuid[],
  
  created_at_timeline timestamptz DEFAULT now()
);

COMMENT ON TABLE public.event_timeline IS 'Central de eventos: rastreia todos os eventos do sistema (pendentes e passados)';
COMMENT ON COLUMN public.event_timeline.status IS 'pending: aguardando ação; sent: enviado; completed_without_send: marcado como ok sem enviar; ignored: ignorado; failed: falhou';
COMMENT ON COLUMN public.event_timeline.origin IS 'system: gerado automaticamente; user: criado por usuário; patient: ação do paciente; automatic: enviado automaticamente';
COMMENT ON COLUMN public.event_timeline.occurred_at IS 'Data/hora em que o fato aconteceu (ex: consulta realizada às 14h)';
COMMENT ON COLUMN public.event_timeline.channels IS 'Array de canais: ["email", "whatsapp"]';
COMMENT ON COLUMN public.event_timeline.template_ids IS 'JSON com templates por canal: {"email": "uuid", "whatsapp": "uuid"}';
COMMENT ON COLUMN public.event_timeline.variables IS 'Variáveis para substituir nos templates';
COMMENT ON COLUMN public.event_timeline.pending_message_ids IS 'IDs das pending_messages criadas para este evento';
COMMENT ON COLUMN public.event_timeline.sent_message_ids IS 'IDs das message_log criadas quando mensagens foram enviadas';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_event_timeline_clinic ON public.event_timeline(clinic_id);
CREATE INDEX IF NOT EXISTS idx_event_timeline_patient ON public.event_timeline(patient_id);
CREATE INDEX IF NOT EXISTS idx_event_timeline_appointment ON public.event_timeline(appointment_id);
CREATE INDEX IF NOT EXISTS idx_event_timeline_status ON public.event_timeline(status);
CREATE INDEX IF NOT EXISTS idx_event_timeline_event_code ON public.event_timeline(event_code);
CREATE INDEX IF NOT EXISTS idx_event_timeline_occurred_at ON public.event_timeline(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_timeline_pending ON public.event_timeline(clinic_id, status) WHERE status = 'pending';

-- RLS
ALTER TABLE public.event_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event timeline clinic access"
  ON public.event_timeline
  FOR ALL
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

-- ========== FUNÇÃO: Criar evento na timeline ==========
CREATE OR REPLACE FUNCTION public.create_event_timeline(
  p_clinic_id uuid,
  p_event_code text,
  p_patient_id uuid DEFAULT NULL,
  p_appointment_id uuid DEFAULT NULL,
  p_form_instance_id uuid DEFAULT NULL,
  p_origin text DEFAULT 'system',
  p_occurred_at timestamptz DEFAULT now(),
  p_channels text[] DEFAULT ARRAY[]::text[],
  p_variables jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_event_config record;
  v_channel text;
  v_template_id uuid;
  v_template_ids jsonb := '{}'::jsonb;
  v_final_channels text[] := ARRAY[]::text[];
  v_send_mode text;
  v_enabled boolean;
  v_should_create_pending boolean := false;
  v_pending_message_id uuid;
BEGIN
  -- Verificar se evento existe
  IF NOT EXISTS (SELECT 1 FROM public.message_events WHERE code = p_event_code) THEN
    RAISE EXCEPTION 'Evento % não encontrado', p_event_code;
  END IF;

  -- Criar registro na timeline
  INSERT INTO public.event_timeline (
    clinic_id,
    patient_id,
    appointment_id,
    form_instance_id,
    event_code,
    origin,
    occurred_at,
    channels,
    variables,
    metadata,
    status
  ) VALUES (
    p_clinic_id,
    p_patient_id,
    p_appointment_id,
    p_form_instance_id,
    p_event_code,
    p_origin,
    p_occurred_at,
    p_channels,
    p_variables,
    p_metadata,
    'pending'
  ) RETURNING id INTO v_event_id;

  -- Se não especificou canais, buscar da configuração da clínica
  IF array_length(p_channels, 1) IS NULL THEN
    FOR v_event_config IN
      SELECT channel, enabled, send_mode, template_id
      FROM public.clinic_message_settings
      WHERE clinic_id = p_clinic_id
        AND event_code = p_event_code
        AND enabled = true
    LOOP
      v_final_channels := array_append(v_final_channels, v_event_config.channel);
      IF v_event_config.template_id IS NOT NULL THEN
        v_template_ids := v_template_ids || jsonb_build_object(v_event_config.channel, v_event_config.template_id::text);
      END IF;
      
      -- Se modo é manual ou sugerido, criar pending_message
      IF v_event_config.send_mode = 'manual' THEN
        v_should_create_pending := true;
      END IF;
    END LOOP;
    
    -- Atualizar canais e templates
    UPDATE public.event_timeline
    SET channels = v_final_channels,
        template_ids = v_template_ids
    WHERE id = v_event_id;
  END IF;

  -- Se modo é automático e tem canais, marcar como enviado automaticamente
  -- (a aplicação vai processar depois via processMessageEvent)
  IF v_should_create_pending = false AND array_length(v_final_channels, 1) > 0 THEN
    -- Evento será processado automaticamente pela aplicação
    -- Por enquanto, deixamos como pending e a aplicação decide
  END IF;

  RETURN v_event_id;
END;
$$;

-- ========== FUNÇÃO: Processar evento (enviar ou marcar como ok) ==========
CREATE OR REPLACE FUNCTION public.process_event_timeline(
  p_event_id uuid,
  p_action text, -- 'send' ou 'mark_ok'
  p_processed_by uuid DEFAULT NULL,
  p_channels_to_send text[] DEFAULT NULL -- Se NULL, envia todos os canais configurados
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- Buscar evento
  SELECT * INTO v_event
  FROM public.event_timeline
  WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evento não encontrado');
  END IF;
  
  IF v_event.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Evento já foi processado');
  END IF;
  
  IF p_action = 'mark_ok' THEN
    -- Marcar como concluído sem enviar
    UPDATE public.event_timeline
    SET status = 'completed_without_send',
        processed_at = now(),
        processed_by = p_processed_by
    WHERE id = p_event_id;
    
    RETURN jsonb_build_object('success', true, 'action', 'marked_ok');
    
  ELSIF p_action = 'send' THEN
    -- A aplicação vai processar o envio via processMessageEvent
    -- Por enquanto, apenas marcamos como "enviando" (status continua pending até confirmar envio)
    -- A aplicação deve atualizar para 'sent' quando confirmar
    
    RETURN jsonb_build_object('success', true, 'action', 'send', 'message', 'Envio será processado pela aplicação');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Ação inválida');
  END IF;
END;
$$;

-- ========== TRIGGER: Gerar evento quando consulta é criada ==========
CREATE OR REPLACE FUNCTION public.trigger_appointment_created_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  -- Criar evento de consulta agendada
  SELECT public.create_event_timeline(
    p_clinic_id := NEW.clinic_id,
    p_event_code := 'appointment_created',
    p_patient_id := NEW.patient_id,
    p_appointment_id := NEW.id,
    p_origin := 'system',
    p_occurred_at := NEW.created_at,
    p_variables := jsonb_build_object(
      'appointment_id', NEW.id::text,
      'patient_id', NEW.patient_id::text,
      'scheduled_at', NEW.scheduled_at::text,
      'status', NEW.status
    )
  ) INTO v_event_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_appointment_created_event
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_appointment_created_event();

-- ========== TRIGGER: Gerar eventos quando consulta é atualizada ==========
CREATE OR REPLACE FUNCTION public.trigger_appointment_updated_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_code text;
  v_event_id uuid;
BEGIN
  -- Se mudou status
  IF OLD.status != NEW.status THEN
    CASE NEW.status
      WHEN 'cancelada' THEN
        v_event_code := 'appointment_canceled';
      WHEN 'confirmada' THEN
        v_event_code := 'appointment_confirmed';
      WHEN 'realizada' THEN
        v_event_code := 'appointment_completed';
      WHEN 'falta' THEN
        v_event_code := 'appointment_no_show';
      ELSE
        v_event_code := NULL;
    END CASE;
    
    IF v_event_code IS NOT NULL THEN
      SELECT public.create_event_timeline(
        p_clinic_id := NEW.clinic_id,
        p_event_code := v_event_code,
        p_patient_id := NEW.patient_id,
        p_appointment_id := NEW.id,
        p_origin := 'system',
        p_occurred_at := NEW.updated_at,
        p_variables := jsonb_build_object(
          'appointment_id', NEW.id::text,
          'patient_id', NEW.patient_id::text,
          'scheduled_at', NEW.scheduled_at::text,
          'old_status', OLD.status,
          'new_status', NEW.status
        )
      ) INTO v_event_id;
    END IF;
  END IF;
  
  -- Se mudou scheduled_at (remarcação)
  IF OLD.scheduled_at != NEW.scheduled_at THEN
    SELECT public.create_event_timeline(
      p_clinic_id := NEW.clinic_id,
      p_event_code := 'appointment_rescheduled',
      p_patient_id := NEW.patient_id,
      p_appointment_id := NEW.id,
      p_origin := 'system',
      p_occurred_at := NEW.updated_at,
      p_variables := jsonb_build_object(
        'appointment_id', NEW.id::text,
        'patient_id', NEW.patient_id::text,
        'old_scheduled_at', OLD.scheduled_at::text,
        'new_scheduled_at', NEW.scheduled_at::text
      )
    ) INTO v_event_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_appointment_updated_event
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_appointment_updated_event();

-- ========== TRIGGER: Gerar evento quando formulário é preenchido ==========
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
  -- Só processar quando status muda para 'respondido'
  IF OLD.status != 'respondido' AND NEW.status = 'respondido' THEN
    -- Verificar se é formulário público ou vinculado
    v_is_public := (NEW.appointment_id IS NULL);
    
    -- Buscar clinic_id do template
    SELECT clinic_id INTO v_template_clinic_id
    FROM public.form_templates
    WHERE id = NEW.form_template_id;
    
    IF v_template_clinic_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Buscar patient_id (se tiver appointment_id)
    IF NOT v_is_public THEN
      SELECT patient_id INTO v_patient_id
      FROM public.appointments
      WHERE id = NEW.appointment_id;
    END IF;
    
    -- Determinar código do evento
    IF v_is_public THEN
      v_event_code := 'public_form_completed';
    ELSE
      v_event_code := 'patient_form_completed';
    END IF;
    
    -- Criar evento
    SELECT public.create_event_timeline(
      p_clinic_id := v_template_clinic_id,
      p_event_code := v_event_code,
      p_patient_id := v_patient_id,
      p_appointment_id := NEW.appointment_id,
      p_form_instance_id := NEW.id,
      p_origin := 'patient',
      p_occurred_at := NEW.updated_at,
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
    
    -- Se for formulário público, criar evento em cadeia para cadastro
    IF v_is_public THEN
      SELECT public.create_event_timeline(
        p_clinic_id := v_template_clinic_id,
        p_event_code := 'public_form_completed', -- Mesmo código, mas metadata diferente
        p_form_instance_id := NEW.id,
        p_origin := 'system',
        p_occurred_at := NEW.updated_at,
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

CREATE TRIGGER on_form_completed_event
  AFTER UPDATE ON public.form_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_form_completed_event();

-- ========== FUNÇÃO: Buscar eventos pendentes (para UI) ==========
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
  LEFT JOIN public.patients p ON p.id = et.patient_id
  LEFT JOIN public.appointments a ON a.id = et.appointment_id
  WHERE et.clinic_id = p_clinic_id
    AND et.status = 'pending'
    AND (p_patient_id IS NULL OR et.patient_id = p_patient_id)
    AND (p_event_code IS NULL OR et.event_code = p_event_code)
  ORDER BY et.occurred_at DESC, et.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ========== FUNÇÃO: Buscar eventos passados (para UI) ==========
CREATE OR REPLACE FUNCTION public.get_past_events(
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
    AND et.status != 'pending'
    AND (p_patient_id IS NULL OR et.patient_id = p_patient_id)
    AND (p_event_code IS NULL OR et.event_code = p_event_code)
  ORDER BY et.processed_at DESC NULLS LAST, et.occurred_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ========== GRANTS ==========
GRANT EXECUTE ON FUNCTION public.create_event_timeline TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_event_timeline TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_past_events TO authenticated;

-- ========== COMENTÁRIOS FINAIS ==========
COMMENT ON FUNCTION public.create_event_timeline IS 'Cria um novo evento na timeline. Retorna o ID do evento criado.';
COMMENT ON FUNCTION public.process_event_timeline IS 'Processa um evento: envia mensagens ou marca como ok sem enviar.';
COMMENT ON FUNCTION public.get_pending_events IS 'Busca eventos pendentes para exibir na UI (aba de eventos pendentes).';
COMMENT ON FUNCTION public.get_past_events IS 'Busca eventos passados para exibir na UI (aba de eventos passados).';
