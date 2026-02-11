-- Migration: Sistema de Mensagens Automáticas (Email e WhatsApp)
-- Execute no SQL Editor do Supabase
-- Este migration cria a estrutura completa para templates e eventos de mensagens

-- ========== TABELA DE EVENTOS (fixos do sistema) ==========
CREATE TABLE IF NOT EXISTS public.message_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('agendamento', 'lembrete', 'formulario', 'pos_consulta', 'outros')),
  default_enabled_email boolean DEFAULT false,
  default_enabled_whatsapp boolean DEFAULT false,
  can_be_automatic boolean DEFAULT true,
  requires_appointment boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.message_events IS 'Eventos fixos do sistema que podem disparar mensagens';
COMMENT ON COLUMN public.message_events.code IS 'Código único do evento (ex: appointment_created)';
COMMENT ON COLUMN public.message_events.name IS 'Nome em português do evento';
COMMENT ON COLUMN public.message_events.default_enabled_email IS 'Se vem ativado por padrão para email';
COMMENT ON COLUMN public.message_events.default_enabled_whatsapp IS 'Se vem ativado por padrão para WhatsApp';
COMMENT ON COLUMN public.message_events.can_be_automatic IS 'Se pode ser enviado automaticamente ou só manual';
COMMENT ON COLUMN public.message_events.requires_appointment IS 'Se o evento requer uma consulta associada';

-- ========== POPULAR EVENTOS FIXOS ==========
INSERT INTO public.message_events (code, name, description, category, default_enabled_email, default_enabled_whatsapp, can_be_automatic, requires_appointment)
VALUES
  -- Agendamento
  ('appointment_created', 'Consulta Agendada', 'Disparado quando uma nova consulta é criada', 'agendamento', true, false, true, true),
  ('appointment_rescheduled', 'Consulta Remarcada', 'Disparado quando a data/hora de uma consulta é alterada', 'agendamento', true, true, true, true),
  ('appointment_canceled', 'Consulta Cancelada', 'Disparado quando uma consulta é cancelada', 'agendamento', true, true, true, true),
  ('appointment_confirmed', 'Consulta Confirmada', 'Disparado quando paciente confirma presença', 'agendamento', false, false, true, true),
  
  -- Lembretes
  ('appointment_reminder_48h', 'Lembrete 48h Antes', 'Lembrete enviado 48 horas antes da consulta', 'lembrete', true, true, true, true),
  ('appointment_reminder_24h', 'Lembrete 24h Antes', 'Lembrete enviado 24 horas antes da consulta', 'lembrete', true, true, true, true),
  ('appointment_reminder_2h', 'Lembrete 2h Antes', 'Lembrete enviado 2 horas antes da consulta', 'lembrete', false, true, true, true),
  
  -- Formulários
  ('form_link_sent', 'Link do Formulário Enviado', 'Disparado quando link do formulário é enviado ao paciente', 'formulario', true, true, false, true),
  ('form_reminder', 'Lembrete para Preencher Formulário', 'Lembrete para paciente preencher formulário pendente', 'formulario', true, true, true, true),
  ('form_completed', 'Formulário Preenchido', 'Disparado quando paciente completa o formulário', 'formulario', false, false, true, true),
  ('form_incomplete', 'Formulário Incompleto', 'Disparado quando paciente não completa todos os campos obrigatórios', 'formulario', true, false, true, true),
  
  -- Pós-consulta
  ('appointment_completed', 'Consulta Realizada', 'Disparado após marcar consulta como realizada', 'pos_consulta', false, false, false, true),
  ('appointment_no_show', 'Falta Registrada', 'Disparado quando paciente não comparece à consulta', 'pos_consulta', true, false, false, true),
  ('return_appointment_reminder', 'Lembrete de Retorno', 'Lembrete para consulta de retorno agendada', 'pos_consulta', true, false, true, true)
ON CONFLICT (code) DO NOTHING;

-- ========== TABELA DE TEMPLATES (editáveis pelo usuário) ==========
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  event_code text NOT NULL REFERENCES public.message_events(code) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  subject text,
  body_html text,
  body_text text,
  variables_used jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.message_templates IS 'Templates de mensagem criados/editados pelos usuários';
COMMENT ON COLUMN public.message_templates.event_code IS 'Código do evento que este template atende';
COMMENT ON COLUMN public.message_templates.channel IS 'Canal: email ou whatsapp';
COMMENT ON COLUMN public.message_templates.subject IS 'Assunto (apenas para email)';
COMMENT ON COLUMN public.message_templates.body_html IS 'Corpo HTML (email) ou texto formatado (WhatsApp)';
COMMENT ON COLUMN public.message_templates.body_text IS 'Versão texto simples (opcional)';
COMMENT ON COLUMN public.message_templates.variables_used IS 'Lista de variáveis usadas no template';
COMMENT ON COLUMN public.message_templates.is_default IS 'Se é o template padrão para este evento/canal';

-- ========== TABELA DE CONFIGURAÇÕES POR CLÍNICA ==========
CREATE TABLE IF NOT EXISTS public.clinic_message_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  event_code text NOT NULL REFERENCES public.message_events(code) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  enabled boolean DEFAULT false,
  send_mode text NOT NULL DEFAULT 'manual' CHECK (send_mode IN ('automatic', 'manual')),
  template_id uuid REFERENCES public.message_templates(id) ON DELETE SET NULL,
  conditions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, event_code, channel)
);

COMMENT ON TABLE public.clinic_message_settings IS 'Configurações de eventos de mensagem por clínica, separadas por canal';
COMMENT ON COLUMN public.clinic_message_settings.channel IS 'Canal específico: email ou whatsapp';
COMMENT ON COLUMN public.clinic_message_settings.enabled IS 'Se o evento está ativado para este canal';
COMMENT ON COLUMN public.clinic_message_settings.send_mode IS 'Modo de envio: automatic (envia direto) ou manual (requer aprovação)';
COMMENT ON COLUMN public.clinic_message_settings.template_id IS 'Template a ser usado (se null, usa template padrão)';
COMMENT ON COLUMN public.clinic_message_settings.conditions IS 'Condições extras em JSON (ex: só enviar se status = agendada)';

-- ========== TABELA DE MENSAGENS PENDENTES ==========
CREATE TABLE IF NOT EXISTS public.pending_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  event_code text NOT NULL REFERENCES public.message_events(code) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  template_id uuid NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
  variables jsonb NOT NULL DEFAULT '{}',
  processed_body text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sent', 'failed')),
  suggested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.pending_messages IS 'Fila de mensagens pendentes de aprovação (quando send_mode = manual)';
COMMENT ON COLUMN public.pending_messages.variables IS 'Valores das variáveis já processadas';
COMMENT ON COLUMN public.pending_messages.processed_body IS 'Corpo da mensagem com variáveis substituídas';
COMMENT ON COLUMN public.pending_messages.status IS 'Status: pending (aguardando), approved (aprovado), rejected (rejeitado), sent (enviado), failed (falhou)';

-- ========== ADICIONAR CAMPOS DE RECOMENDAÇÕES EM APPOINTMENTS ==========
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS recommendations text,
  ADD COLUMN IF NOT EXISTS requires_fasting boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_medication_stop boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_instructions text,
  ADD COLUMN IF NOT EXISTS preparation_notes text;

COMMENT ON COLUMN public.appointments.recommendations IS 'Recomendações/preparações específicas desta consulta';
COMMENT ON COLUMN public.appointments.requires_fasting IS 'Se a consulta requer jejum';
COMMENT ON COLUMN public.appointments.requires_medication_stop IS 'Se o paciente precisa parar alguma medicação';
COMMENT ON COLUMN public.appointments.special_instructions IS 'Instruções especiais para esta consulta';
COMMENT ON COLUMN public.appointments.preparation_notes IS 'Notas de preparo (campo livre)';

-- ========== ÍNDICES ==========
CREATE INDEX IF NOT EXISTS idx_message_templates_clinic_event ON public.message_templates(clinic_id, event_code);
CREATE INDEX IF NOT EXISTS idx_message_templates_clinic_channel ON public.message_templates(clinic_id, channel);
CREATE INDEX IF NOT EXISTS idx_clinic_message_settings_clinic ON public.clinic_message_settings(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_message_settings_event_channel ON public.clinic_message_settings(event_code, channel);
CREATE INDEX IF NOT EXISTS idx_pending_messages_clinic ON public.pending_messages(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON public.pending_messages(status);
CREATE INDEX IF NOT EXISTS idx_pending_messages_appointment ON public.pending_messages(appointment_id);
CREATE INDEX IF NOT EXISTS idx_pending_messages_created ON public.pending_messages(created_at DESC);

-- ========== RLS (Row Level Security) ==========
ALTER TABLE public.message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_message_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_messages ENABLE ROW LEVEL SECURITY;

-- Eventos: leitura pública (todos podem ver eventos disponíveis)
CREATE POLICY "Message events readable by all"
  ON public.message_events
  FOR SELECT
  USING (true);

-- Templates: membros da clínica podem gerenciar templates da própria clínica
CREATE POLICY "Message templates clinic access"
  ON public.message_templates
  FOR ALL
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

-- Configurações: membros da clínica podem gerenciar configurações da própria clínica
CREATE POLICY "Clinic message settings clinic access"
  ON public.clinic_message_settings
  FOR ALL
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

-- Mensagens pendentes: membros da clínica podem ver/gerenciar mensagens da própria clínica
CREATE POLICY "Pending messages clinic access"
  ON public.pending_messages
  FOR ALL
  USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

-- ========== TRIGGER: atualizar updated_at ==========
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir e criar novo
DROP TRIGGER IF EXISTS update_message_templates_updated_at ON public.message_templates;
CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinic_message_settings_updated_at
  BEFORE UPDATE ON public.clinic_message_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========== FUNÇÃO: inicializar configurações padrão para nova clínica ==========
CREATE OR REPLACE FUNCTION initialize_clinic_message_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar configurações padrão para email e whatsapp de todos os eventos
  INSERT INTO public.clinic_message_settings (clinic_id, event_code, channel, enabled, send_mode)
  SELECT 
    NEW.id,
    me.code,
    'email',
    me.default_enabled_email,
    CASE WHEN me.can_be_automatic THEN 'automatic' ELSE 'manual' END
  FROM public.message_events me
  ON CONFLICT (clinic_id, event_code, channel) DO NOTHING;
  
  INSERT INTO public.clinic_message_settings (clinic_id, event_code, channel, enabled, send_mode)
  SELECT 
    NEW.id,
    me.code,
    'whatsapp',
    me.default_enabled_whatsapp,
    CASE WHEN me.can_be_automatic THEN 'automatic' ELSE 'manual' END
  FROM public.message_events me
  ON CONFLICT (clinic_id, event_code, channel) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar configurações quando nova clínica é criada
CREATE TRIGGER on_clinic_created_message_settings
  AFTER INSERT ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION initialize_clinic_message_settings();

-- ========== COMENTÁRIOS FINAIS ==========
COMMENT ON FUNCTION initialize_clinic_message_settings() IS 'Cria configurações padrão de mensagens quando uma nova clínica é criada';
