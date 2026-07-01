-- Eventos do assistente virtual para envio fora da janela de 24h (templates Meta)
--
-- Pré-requisito ideal (ambiente completo):
--   1. migration-message-system.sql
--   2. migration-system-templates-and-email-header-footer.sql
--   3. migration-whatsapp-ticket-open-only.sql
--
-- Se public.message_events ainda não existir, o bloco abaixo cria o mínimo
-- necessário para esta migration rodar (bootstrap).

-- ========== BOOTSTRAP MÍNIMO (somente se tabelas não existirem) ==========
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

CREATE TABLE IF NOT EXISTS public.system_message_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_code text NOT NULL REFERENCES public.message_events(code) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  name text NOT NULL,
  subject text,
  body_html text NOT NULL DEFAULT '',
  body_text text,
  email_header text,
  email_footer text,
  variables_used jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_code, channel)
);

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

ALTER TABLE public.system_message_templates
  ADD COLUMN IF NOT EXISTS whatsapp_meta_phrase text;

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS whatsapp_meta_phrase text;

ALTER TABLE public.clinic_message_settings
  ADD COLUMN IF NOT EXISTS send_only_when_ticket_open boolean DEFAULT false;

-- ========== NOVOS EVENTOS ==========
INSERT INTO public.message_events (
  code, name, description, category,
  default_enabled_email, default_enabled_whatsapp,
  can_be_automatic, requires_appointment
)
VALUES
  (
    'appointment_confirmation_request',
    'Solicitação de confirmação de consulta',
    'Disparado pelo assistente virtual para pedir confirmação de presença (ex.: 2 dias antes)',
    'agendamento',
    true,
    true,
    true,
    true
  ),
  (
    'appointment_confirmation_followup',
    'Follow-up de confirmação de consulta',
    'Reenvio quando o paciente não respondeu à solicitação de confirmação',
    'agendamento',
    true,
    true,
    true,
    true
  ),
  (
    'lead_reengagement',
    'Reengajamento de lead',
    'Follow-up proativo com lead que não respondeu (qualificação, aguardando retorno)',
    'outros',
    false,
    true,
    true,
    false
  ),
  (
    'negotiation_followup',
    'Follow-up de negociação',
    'Reenvio proativo em negociação ou objeção de preço',
    'outros',
    false,
    true,
    true,
    false
  ),
  (
    'booking_abandoned_followup',
    'Retomada de agendamento abandonado',
    'Follow-up quando o paciente iniciou agendamento no chat e não concluiu',
    'agendamento',
    false,
    true,
    true,
    false
  )
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.system_message_templates (
  event_code,
  channel,
  name,
  subject,
  body_html,
  body_text,
  whatsapp_meta_phrase,
  variables_used
)
VALUES
  (
    'appointment_confirmation_request',
    'whatsapp',
    'Solicitação de confirmação (WhatsApp)',
    NULL,
    'Olá {{nome_paciente}}! Passando para confirmar sua consulta com {{nome_medico}} em {{data_hora_consulta}}. Você confirma presença? Responda *sim* ou *não*.',
    'Olá {{nome_paciente}}! Passando para confirmar sua consulta com {{nome_medico}} em {{data_hora_consulta}}. Você confirma presença? Responda *sim* ou *não*.',
    'Precisamos confirmar sua consulta agendada. Por favor, responda se confirma presença.',
    '["nome_paciente","nome_medico","data_hora_consulta"]'::jsonb
  ),
  (
    'appointment_confirmation_followup',
    'whatsapp',
    'Follow-up confirmação (WhatsApp)',
    NULL,
    'Olá {{nome_paciente}}! Ainda não recebemos sua confirmação para a consulta com {{nome_medico}} em {{data_hora_consulta}}. Responda *sim* ou *não*.',
    'Olá {{nome_paciente}}! Ainda não recebemos sua confirmação para a consulta com {{nome_medico}} em {{data_hora_consulta}}. Responda *sim* ou *não*.',
    'Lembramos que sua consulta ainda aguarda confirmação. Por favor, responda esta mensagem.',
    '["nome_paciente","nome_medico","data_hora_consulta"]'::jsonb
  ),
  (
    'lead_reengagement',
    'whatsapp',
    'Reengajamento de lead (WhatsApp)',
    NULL,
    'Olá {{nome_paciente}}! A {{nome_clinica}} está à disposição para ajudar. Podemos continuar seu atendimento?',
    'Olá {{nome_paciente}}! A {{nome_clinica}} está à disposição para ajudar. Podemos continuar seu atendimento?',
    'Estamos à disposição para continuar seu atendimento. Responda quando puder.',
    '["nome_paciente","nome_clinica"]'::jsonb
  ),
  (
    'negotiation_followup',
    'whatsapp',
    'Follow-up negociação (WhatsApp)',
    NULL,
    'Olá {{nome_paciente}}! Passando para saber se ficou alguma dúvida sobre valores ou condições. Podemos ajudar?',
    'Olá {{nome_paciente}}! Passando para saber se ficou alguma dúvida sobre valores ou condições. Podemos ajudar?',
    'Temos uma atualização sobre sua solicitação. Responda quando puder.',
    '["nome_paciente"]'::jsonb
  ),
  (
    'booking_abandoned_followup',
    'whatsapp',
    'Agendamento abandonado (WhatsApp)',
    NULL,
    'Olá {{nome_paciente}}! Notamos que você estava agendando uma consulta na {{nome_clinica}}. Posso ajudar a concluir?',
    'Olá {{nome_paciente}}! Notamos que você estava agendando uma consulta na {{nome_clinica}}. Posso ajudar a concluir?',
    'Podemos ajudar a concluir seu agendamento. Responda quando puder.',
    '["nome_paciente","nome_clinica"]'::jsonb
  )
ON CONFLICT (event_code, channel) DO NOTHING;

-- Configuração padrão para clínicas existentes (WhatsApp automático)
INSERT INTO public.clinic_message_settings (
  clinic_id, event_code, channel, enabled, send_mode, send_only_when_ticket_open
)
SELECT c.id, me.code, 'whatsapp', me.default_enabled_whatsapp, 'automatic', false
FROM public.clinics c
CROSS JOIN public.message_events me
WHERE me.code IN (
  'appointment_confirmation_request',
  'appointment_confirmation_followup',
  'lead_reengagement',
  'negotiation_followup',
  'booking_abandoned_followup'
)
ON CONFLICT (clinic_id, event_code, channel) DO NOTHING;
