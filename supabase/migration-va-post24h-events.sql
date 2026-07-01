-- Eventos do assistente virtual para envio fora da janela de 24h (templates Meta)

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
  event_code, channel, name, subject, body_text, whatsapp_meta_phrase, is_system
)
VALUES
  (
    'appointment_confirmation_request',
    'whatsapp',
    'Solicitação de confirmação (WhatsApp)',
    NULL,
    'Olá {{nome_paciente}}! Passando para confirmar sua consulta com {{nome_medico}} em {{data_hora_consulta}}. Você confirma presença? Responda *sim* ou *não*.',
    'Precisamos confirmar sua consulta agendada. Por favor, responda se confirma presença.',
    true
  ),
  (
    'appointment_confirmation_followup',
    'whatsapp',
    'Follow-up confirmação (WhatsApp)',
    NULL,
    'Olá {{nome_paciente}}! Ainda não recebemos sua confirmação para a consulta com {{nome_medico}} em {{data_hora_consulta}}. Responda *sim* ou *não*.',
    'Lembramos que sua consulta ainda aguarda confirmação. Por favor, responda esta mensagem.',
    true
  ),
  (
    'lead_reengagement',
    'whatsapp',
    'Reengajamento de lead (WhatsApp)',
    NULL,
    'Olá {{nome_paciente}}! A {{nome_clinica}} está à disposição para ajudar. Podemos continuar seu atendimento?',
    'Estamos à disposição para continuar seu atendimento. Responda quando puder.',
    true
  ),
  (
    'negotiation_followup',
    'whatsapp',
    'Follow-up negociação (WhatsApp)',
    NULL,
    'Olá {{nome_paciente}}! Passando para saber se ficou alguma dúvida sobre valores ou condições. Podemos ajudar?',
    'Temos uma atualização sobre sua solicitação. Responda quando puder.',
    true
  ),
  (
    'booking_abandoned_followup',
    'whatsapp',
    'Agendamento abandonado (WhatsApp)',
    NULL,
    'Olá {{nome_paciente}}! Notamos que você estava agendando uma consulta na {{nome_clinica}}. Posso ajudar a concluir?',
    'Podemos ajudar a concluir seu agendamento. Responda quando puder.',
    true
  )
ON CONFLICT DO NOTHING;

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
