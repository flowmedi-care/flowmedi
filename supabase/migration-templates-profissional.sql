-- Revisão completa dos templates: mensagens específicas por evento, tom acolhedor e objetivo
-- Sem emojis. Quebras de linha para WhatsApp. Execute APÓS as migrations de templates existentes

-- ========== APPOINTMENT_CONFIRMED ==========
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('appointment_confirmed', 'email', 'Consulta Confirmada - Email',
   '{{nome_clinica}}: Sua consulta foi confirmada',
   '<p>Olá {{nome_paciente}},</p>
<p>Recebemos sua confirmação. Sua consulta está agendada para <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong>.</p>
{{preparo_completo_html}}
<p>Estamos à disposição para qualquer dúvida.</p>
<p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},

Recebemos sua confirmação. Sua consulta está agendada para {{data_hora_consulta}} com {{nome_medico}}.

{{preparo_completo}}

Estamos à disposição para qualquer dúvida.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}","{{preparo_completo_html}}"]'::jsonb,
   now()),
  ('appointment_confirmed', 'whatsapp', 'Consulta Confirmada - WhatsApp',
   NULL,
   'Olá {{nome_paciente}},

Recebemos sua confirmação. Sua consulta está agendada para {{data_hora_consulta}} com {{nome_medico}}.

{{preparo_completo}}

Estamos à disposição para qualquer dúvida.

{{nome_clinica}}',
   'Olá {{nome_paciente}},

Recebemos sua confirmação. Sua consulta está agendada para {{data_hora_consulta}} com {{nome_medico}}.

{{preparo_completo}}

Estamos à disposição para qualquer dúvida.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}","{{preparo_completo}}"]'::jsonb,
   now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  variables_used = EXCLUDED.variables_used,
  updated_at = EXCLUDED.updated_at;

-- ========== APPOINTMENT_CREATED ==========
UPDATE public.system_message_templates SET
  body_html = '<p>Olá {{nome_paciente}},</p>
<p>Confirmamos o agendamento da sua consulta para <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong>.</p>
<p>{{instrucao_formulario}}</p>
<p>Qualquer dúvida, estamos à disposição.</p>
<p>{{nome_clinica}}</p>',
  body_text = 'Olá {{nome_paciente}},

Confirmamos o agendamento da sua consulta para {{data_hora_consulta}} com {{nome_medico}}.

{{instrucao_formulario}}

Qualquer dúvida, estamos à disposição.

{{nome_clinica}}',
  variables_used = '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}","{{instrucao_formulario}}"]'::jsonb,
  updated_at = now()
WHERE event_code = 'appointment_created' AND channel = 'email';

UPDATE public.system_message_templates SET
  body_html = 'Olá {{nome_paciente}},

Confirmamos o agendamento da sua consulta para {{data_hora_consulta}} com {{nome_medico}}.

{{instrucao_formulario}}

Qualquer dúvida, estamos à disposição.

{{nome_clinica}}',
  body_text = 'Olá {{nome_paciente}},

Confirmamos o agendamento da sua consulta para {{data_hora_consulta}} com {{nome_medico}}.

{{instrucao_formulario}}

Qualquer dúvida, estamos à disposição.

{{nome_clinica}}',
  variables_used = '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}","{{instrucao_formulario}}"]'::jsonb,
  updated_at = now()
WHERE event_code = 'appointment_created' AND channel = 'whatsapp';

-- ========== APPOINTMENT_RESCHEDULED ==========
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('appointment_rescheduled', 'email', 'Consulta Remarcada - Email',
   '{{nome_clinica}}: Sua consulta foi remarcada',
   '<p>Olá {{nome_paciente}},</p>
<p>Informamos que sua consulta foi remarcada para <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong>.</p>
<p>Qualquer dúvida, estamos à disposição.</p>
<p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},

Informamos que sua consulta foi remarcada para {{data_hora_consulta}} com {{nome_medico}}.

Qualquer dúvida, estamos à disposição.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_rescheduled', 'whatsapp', 'Consulta Remarcada - WhatsApp',
   NULL,
   'Olá {{nome_paciente}},

Informamos que sua consulta foi remarcada para {{data_hora_consulta}} com {{nome_medico}}.

Qualquer dúvida, estamos à disposição.

{{nome_clinica}}',
   'Olá {{nome_paciente}},

Informamos que sua consulta foi remarcada para {{data_hora_consulta}} com {{nome_medico}}.

Qualquer dúvida, estamos à disposição.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name, subject = EXCLUDED.subject, body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text, variables_used = EXCLUDED.variables_used, updated_at = EXCLUDED.updated_at;

-- ========== APPOINTMENT_CANCELED ==========
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('appointment_canceled', 'email', 'Consulta Cancelada - Email',
   '{{nome_clinica}}: Sua consulta foi cancelada',
   '<p>Olá {{nome_paciente}},</p>
<p>Informamos que sua consulta que estava agendada para <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong> foi cancelada.</p>
<p>Para reagendar, entre em contato conosco.</p>
<p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},

Informamos que sua consulta que estava agendada para {{data_hora_consulta}} com {{nome_medico}} foi cancelada.

Para reagendar, entre em contato conosco.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_canceled', 'whatsapp', 'Consulta Cancelada - WhatsApp',
   NULL,
   'Olá {{nome_paciente}},

Informamos que sua consulta que estava agendada para {{data_hora_consulta}} com {{nome_medico}} foi cancelada.

Para reagendar, entre em contato conosco.

{{nome_clinica}}',
   'Olá {{nome_paciente}},

Informamos que sua consulta que estava agendada para {{data_hora_consulta}} com {{nome_medico}} foi cancelada.

Para reagendar, entre em contato conosco.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name, subject = EXCLUDED.subject, body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text, variables_used = EXCLUDED.variables_used, updated_at = EXCLUDED.updated_at;

-- ========== APPOINTMENT_NOT_CONFIRMED ==========
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('appointment_not_confirmed', 'email', 'Consulta ainda não confirmada - Email',
   '{{nome_clinica}}: Confirme sua consulta',
   '<p>Olá {{nome_paciente}},</p>
<p>Percebemos que sua consulta para <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong> ainda não foi confirmada.</p>
<p>Por favor, confirme sua presença, cancele ou solicite remarcação entrando em contato conosco.</p>
<p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},

Percebemos que sua consulta para {{data_hora_consulta}} com {{nome_medico}} ainda não foi confirmada.

Por favor, confirme sua presença, cancele ou solicite remarcação entrando em contato conosco.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_not_confirmed', 'whatsapp', 'Consulta ainda não confirmada - WhatsApp',
   NULL,
   'Olá {{nome_paciente}},

Percebemos que sua consulta para {{data_hora_consulta}} com {{nome_medico}} ainda não foi confirmada.

Por favor, confirme sua presença, cancele ou solicite remarcação entrando em contato conosco.

{{nome_clinica}}',
   'Olá {{nome_paciente}},

Percebemos que sua consulta para {{data_hora_consulta}} com {{nome_medico}} ainda não foi confirmada.

Por favor, confirme sua presença, cancele ou solicite remarcação entrando em contato conosco.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name, subject = EXCLUDED.subject, body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text, variables_used = EXCLUDED.variables_used, updated_at = EXCLUDED.updated_at;

-- ========== FORM_LINKED ==========
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('form_linked', 'email', 'Formulário vinculado - Email',
   '{{nome_clinica}}: Formulário para preencher',
   '<p>Olá {{nome_paciente}},</p>
<p>Precisamos que você preencha um formulário antes da sua consulta.</p>
<p>{{instrucao_formulario}}</p>
<p>Obrigado por nos ajudar a preparar seu atendimento.</p>
<p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},

Precisamos que você preencha um formulário antes da sua consulta.

{{instrucao_formulario}}

Obrigado por nos ajudar a preparar seu atendimento.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{instrucao_formulario}}","{{nome_clinica}}"]'::jsonb, now()),
  ('form_linked', 'whatsapp', 'Formulário vinculado - WhatsApp',
   NULL,
   'Olá {{nome_paciente}},

Precisamos que você preencha um formulário antes da sua consulta.

{{instrucao_formulario}}

Obrigado por nos ajudar a preparar seu atendimento.

{{nome_clinica}}',
   'Olá {{nome_paciente}},

Precisamos que você preencha um formulário antes da sua consulta.

{{instrucao_formulario}}

Obrigado por nos ajudar a preparar seu atendimento.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{instrucao_formulario}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name, subject = EXCLUDED.subject, body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text, variables_used = EXCLUDED.variables_used, updated_at = EXCLUDED.updated_at;

-- ========== FORM_REMINDER ==========
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('form_reminder', 'email', 'Lembrete Formulário - Email',
   '{{nome_clinica}}: Lembrete para preencher o formulário',
   '<p>Olá {{nome_paciente}},</p>
<p>Lembramos que ainda precisamos que você preencha o formulário vinculado à sua consulta de <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong>.</p>
<p>{{instrucao_formulario}}</p>
<p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},

Lembramos que ainda precisamos que você preencha o formulário vinculado à sua consulta de {{data_hora_consulta}} com {{nome_medico}}.

{{instrucao_formulario}}

{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{instrucao_formulario}}","{{nome_clinica}}"]'::jsonb, now()),
  ('form_reminder', 'whatsapp', 'Lembrete Formulário - WhatsApp',
   NULL,
   'Olá {{nome_paciente}},

Lembramos que ainda precisamos que você preencha o formulário vinculado à sua consulta de {{data_hora_consulta}} com {{nome_medico}}.

{{instrucao_formulario}}

{{nome_clinica}}',
   'Olá {{nome_paciente}},

Lembramos que ainda precisamos que você preencha o formulário vinculado à sua consulta de {{data_hora_consulta}} com {{nome_medico}}.

{{instrucao_formulario}}

{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{instrucao_formulario}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name, subject = EXCLUDED.subject, body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text, variables_used = EXCLUDED.variables_used, updated_at = EXCLUDED.updated_at;

-- ========== FORM_COMPLETED / PATIENT_FORM_COMPLETED ==========
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('form_completed', 'email', 'Formulário Preenchido - Email',
   '{{nome_clinica}}: Obrigado por preencher o formulário',
   '<p>Olá {{nome_paciente}},</p>
<p>Muito obrigado por preencher o formulário. Recebemos suas informações e elas nos ajudarão a preparar seu atendimento.</p>
<p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},

Muito obrigado por preencher o formulário. Recebemos suas informações e elas nos ajudarão a preparar seu atendimento.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{nome_clinica}}"]'::jsonb, now()),
  ('form_completed', 'whatsapp', 'Formulário Preenchido - WhatsApp',
   NULL,
   'Olá {{nome_paciente}},

Muito obrigado por preencher o formulário. Recebemos suas informações e elas nos ajudarão a preparar seu atendimento.

{{nome_clinica}}',
   'Olá {{nome_paciente}},

Muito obrigado por preencher o formulário. Recebemos suas informações e elas nos ajudarão a preparar seu atendimento.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{nome_clinica}}"]'::jsonb, now()),
  ('patient_form_completed', 'email', 'Formulário de Paciente Preenchido - Email',
   '{{nome_clinica}}: Obrigado por preencher o formulário',
   '<p>Olá {{nome_paciente}},</p>
<p>Muito obrigado por preencher o formulário. Recebemos suas informações e elas nos ajudarão a preparar seu atendimento.</p>
<p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},

Muito obrigado por preencher o formulário. Recebemos suas informações e elas nos ajudarão a preparar seu atendimento.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{nome_clinica}}"]'::jsonb, now()),
  ('patient_form_completed', 'whatsapp', 'Formulário de Paciente Preenchido - WhatsApp',
   NULL,
   'Olá {{nome_paciente}},

Muito obrigado por preencher o formulário. Recebemos suas informações e elas nos ajudarão a preparar seu atendimento.

{{nome_clinica}}',
   'Olá {{nome_paciente}},

Muito obrigado por preencher o formulário. Recebemos suas informações e elas nos ajudarão a preparar seu atendimento.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name, subject = EXCLUDED.subject, body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text, variables_used = EXCLUDED.variables_used, updated_at = EXCLUDED.updated_at;

-- ========== PUBLIC_FORM_COMPLETED ==========
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('public_form_completed', 'email', 'Formulário Público Preenchido - Email',
   '{{nome_clinica}}: Recebemos suas informações',
   '<p>Olá {{nome_paciente}},</p>
<p>Obrigado por entrar em contato. Recebemos suas informações e em breve entraremos em contato.</p>
<p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},

Obrigado por entrar em contato. Recebemos suas informações e em breve entraremos em contato.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{nome_clinica}}"]'::jsonb, now()),
  ('public_form_completed', 'whatsapp', 'Formulário Público Preenchido - WhatsApp',
   NULL,
   'Olá {{nome_paciente}},

Obrigado por entrar em contato. Recebemos suas informações e em breve entraremos em contato.

{{nome_clinica}}',
   'Olá {{nome_paciente}},

Obrigado por entrar em contato. Recebemos suas informações e em breve entraremos em contato.

{{nome_clinica}}',
   '["{{nome_paciente}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name, subject = EXCLUDED.subject, body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text, variables_used = EXCLUDED.variables_used, updated_at = EXCLUDED.updated_at;

-- ========== FORM_INCOMPLETE ==========
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('form_incomplete', 'email', 'Formulário Incompleto - Email',
   '{{nome_clinica}}: Complete o formulário',
   '<p>Olá {{nome_paciente}},</p>
<p>Percebemos que o formulário não foi preenchido completamente. Por favor, acesse o link novamente e complete todos os campos obrigatórios.</p>
<p>{{instrucao_formulario}}</p>
<p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},

Percebemos que o formulário não foi preenchido completamente. Por favor, acesse o link novamente e complete todos os campos obrigatórios.

{{instrucao_formulario}}

{{nome_clinica}}',
   '["{{nome_paciente}}","{{instrucao_formulario}}","{{nome_clinica}}"]'::jsonb, now()),
  ('form_incomplete', 'whatsapp', 'Formulário Incompleto - WhatsApp',
   NULL,
   'Olá {{nome_paciente}},

Percebemos que o formulário não foi preenchido completamente. Por favor, acesse o link novamente e complete todos os campos obrigatórios.

{{instrucao_formulario}}

{{nome_clinica}}',
   'Olá {{nome_paciente}},

Percebemos que o formulário não foi preenchido completamente. Por favor, acesse o link novamente e complete todos os campos obrigatórios.

{{instrucao_formulario}}

{{nome_clinica}}',
   '["{{nome_paciente}}","{{instrucao_formulario}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name, subject = EXCLUDED.subject, body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text, variables_used = EXCLUDED.variables_used, updated_at = EXCLUDED.updated_at;

-- ========== FORM_LINK_SENT ==========
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('form_link_sent', 'email', 'Link Formulário Enviado - Email',
   '{{nome_clinica}}: Link para preencher o formulário',
   '<p>Olá {{nome_paciente}},</p>
<p>Enviamos o link para que você preencha o formulário antes da sua consulta.</p>
<p>{{instrucao_formulario}}</p>
<p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},

Enviamos o link para que você preencha o formulário antes da sua consulta.

{{instrucao_formulario}}

{{nome_clinica}}',
   '["{{nome_paciente}}","{{instrucao_formulario}}","{{nome_clinica}}"]'::jsonb, now()),
  ('form_link_sent', 'whatsapp', 'Link Formulário Enviado - WhatsApp',
   NULL,
   'Olá {{nome_paciente}},

Enviamos o link para que você preencha o formulário antes da sua consulta.

{{instrucao_formulario}}

{{nome_clinica}}',
   'Olá {{nome_paciente}},

Enviamos o link para que você preencha o formulário antes da sua consulta.

{{instrucao_formulario}}

{{nome_clinica}}',
   '["{{nome_paciente}}","{{instrucao_formulario}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name, subject = EXCLUDED.subject, body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text, variables_used = EXCLUDED.variables_used, updated_at = EXCLUDED.updated_at;

-- ========== LEMBRETES (30d, 15d, 7d, 48h, 24h, 2h) ==========
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('appointment_reminder_30d', 'email', 'Lembrete 30 dias - Email', '{{nome_clinica}}: Lembrete da sua consulta',
   '<p>Olá {{nome_paciente}},</p><p>Lembramos que você tem consulta agendada para <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong> em 30 dias.</p><p>Qualquer alteração, entre em contato conosco.</p><p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que você tem consulta agendada para {{data_hora_consulta}} com {{nome_medico}} em 30 dias.' || E'\n\n' || 'Qualquer alteração, entre em contato conosco.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_reminder_30d', 'whatsapp', 'Lembrete 30 dias - WhatsApp', NULL,
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que você tem consulta agendada para {{data_hora_consulta}} com {{nome_medico}} em 30 dias.' || E'\n\n' || 'Qualquer alteração, entre em contato conosco.' || E'\n\n' || '{{nome_clinica}}',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que você tem consulta agendada para {{data_hora_consulta}} com {{nome_medico}} em 30 dias.' || E'\n\n' || 'Qualquer alteração, entre em contato conosco.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_reminder_15d', 'email', 'Lembrete 15 dias - Email', '{{nome_clinica}}: Lembrete da sua consulta',
   '<p>Olá {{nome_paciente}},</p><p>Lembramos que sua consulta com <strong>{{nome_medico}}</strong> está agendada para <strong>{{data_hora_consulta}}</strong> (em 15 dias).</p><p>Qualquer alteração, entre em contato conosco.</p><p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que sua consulta com {{nome_medico}} está agendada para {{data_hora_consulta}} (em 15 dias).' || E'\n\n' || 'Qualquer alteração, entre em contato conosco.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_reminder_15d', 'whatsapp', 'Lembrete 15 dias - WhatsApp', NULL,
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que sua consulta com {{nome_medico}} está agendada para {{data_hora_consulta}} (em 15 dias).' || E'\n\n' || 'Qualquer alteração, entre em contato conosco.' || E'\n\n' || '{{nome_clinica}}',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que sua consulta com {{nome_medico}} está agendada para {{data_hora_consulta}} (em 15 dias).' || E'\n\n' || 'Qualquer alteração, entre em contato conosco.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_reminder_7d', 'email', 'Lembrete 1 semana - Email', '{{nome_clinica}}: Sua consulta é na próxima semana',
   '<p>Olá {{nome_paciente}},</p><p>Lembramos que sua consulta com <strong>{{nome_medico}}</strong> é na próxima semana: <strong>{{data_hora_consulta}}</strong>.</p><p>Qualquer alteração, entre em contato conosco.</p><p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que sua consulta com {{nome_medico}} é na próxima semana: {{data_hora_consulta}}.' || E'\n\n' || 'Qualquer alteração, entre em contato conosco.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_reminder_7d', 'whatsapp', 'Lembrete 1 semana - WhatsApp', NULL,
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que sua consulta com {{nome_medico}} é na próxima semana: {{data_hora_consulta}}.' || E'\n\n' || 'Qualquer alteração, entre em contato conosco.' || E'\n\n' || '{{nome_clinica}}',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que sua consulta com {{nome_medico}} é na próxima semana: {{data_hora_consulta}}.' || E'\n\n' || 'Qualquer alteração, entre em contato conosco.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_reminder_48h', 'email', 'Lembrete 48h - Email', '{{nome_clinica}}: Sua consulta é em 48 horas',
   '<p>Olá {{nome_paciente}},</p><p>Sua consulta com <strong>{{nome_medico}}</strong> está agendada para <strong>{{data_hora_consulta}}</strong> (em 48 horas).</p><p>Nos vemos em breve.</p><p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Sua consulta com {{nome_medico}} está agendada para {{data_hora_consulta}} (em 48 horas).' || E'\n\n' || 'Nos vemos em breve.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_reminder_48h', 'whatsapp', 'Lembrete 48h - WhatsApp', NULL,
   'Olá {{nome_paciente}},' || E'\n\n' || 'Sua consulta com {{nome_medico}} está agendada para {{data_hora_consulta}} (em 48 horas).' || E'\n\n' || 'Nos vemos em breve.' || E'\n\n' || '{{nome_clinica}}',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Sua consulta com {{nome_medico}} está agendada para {{data_hora_consulta}} (em 48 horas).' || E'\n\n' || 'Nos vemos em breve.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_reminder_24h', 'email', 'Lembrete 24h - Email', '{{nome_clinica}}: Sua consulta é amanhã',
   '<p>Olá {{nome_paciente}},</p><p>Lembramos que sua consulta com <strong>{{nome_medico}}</strong> é amanhã às <strong>{{data_hora_consulta}}</strong>.</p><p>Nos vemos em breve.</p><p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que sua consulta com {{nome_medico}} é amanhã às {{data_hora_consulta}}.' || E'\n\n' || 'Nos vemos em breve.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_reminder_24h', 'whatsapp', 'Lembrete 24h - WhatsApp', NULL,
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que sua consulta com {{nome_medico}} é amanhã às {{data_hora_consulta}}.' || E'\n\n' || 'Nos vemos em breve.' || E'\n\n' || '{{nome_clinica}}',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que sua consulta com {{nome_medico}} é amanhã às {{data_hora_consulta}}.' || E'\n\n' || 'Nos vemos em breve.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_reminder_2h', 'email', 'Lembrete 2h - Email', '{{nome_clinica}}: Sua consulta é em 2 horas',
   '<p>Olá {{nome_paciente}},</p><p>Sua consulta com <strong>{{nome_medico}}</strong> é em 2 horas: <strong>{{data_hora_consulta}}</strong>.</p><p>Nos vemos em breve.</p><p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Sua consulta com {{nome_medico}} é em 2 horas: {{data_hora_consulta}}.' || E'\n\n' || 'Nos vemos em breve.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_reminder_2h', 'whatsapp', 'Lembrete 2h - WhatsApp', NULL,
   'Olá {{nome_paciente}},' || E'\n\n' || 'Sua consulta com {{nome_medico}} é em 2 horas: {{data_hora_consulta}}.' || E'\n\n' || 'Nos vemos em breve.' || E'\n\n' || '{{nome_clinica}}',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Sua consulta com {{nome_medico}} é em 2 horas: {{data_hora_consulta}}.' || E'\n\n' || 'Nos vemos em breve.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name, subject = EXCLUDED.subject, body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text, variables_used = EXCLUDED.variables_used, updated_at = EXCLUDED.updated_at;

-- ========== RETURN_APPOINTMENT_REMINDER, APPOINTMENT_MARKED_AS_RETURN, APPOINTMENT_COMPLETED, APPOINTMENT_NO_SHOW, PATIENT_REGISTERED ==========
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('return_appointment_reminder', 'email', 'Lembrete Retorno - Email', '{{nome_clinica}}: Lembrete da sua consulta de retorno',
   '<p>Olá {{nome_paciente}},</p><p>Lembramos que você tem consulta de retorno agendada para <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong>.</p><p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que você tem consulta de retorno agendada para {{data_hora_consulta}} com {{nome_medico}}.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('return_appointment_reminder', 'whatsapp', 'Lembrete Retorno - WhatsApp', NULL,
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que você tem consulta de retorno agendada para {{data_hora_consulta}} com {{nome_medico}}.' || E'\n\n' || '{{nome_clinica}}',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Lembramos que você tem consulta de retorno agendada para {{data_hora_consulta}} com {{nome_medico}}.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_marked_as_return', 'email', 'Consulta de Retorno - Email', '{{nome_clinica}}: Sua consulta de retorno',
   '<p>Olá {{nome_paciente}},</p><p>Informamos que sua consulta foi marcada como retorno para <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong>.</p><p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Informamos que sua consulta foi marcada como retorno para {{data_hora_consulta}} com {{nome_medico}}.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_marked_as_return', 'whatsapp', 'Consulta de Retorno - WhatsApp', NULL,
   'Olá {{nome_paciente}},' || E'\n\n' || 'Informamos que sua consulta foi marcada como retorno para {{data_hora_consulta}} com {{nome_medico}}.' || E'\n\n' || '{{nome_clinica}}',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Informamos que sua consulta foi marcada como retorno para {{data_hora_consulta}} com {{nome_medico}}.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_completed', 'email', 'Consulta Realizada - Email', '{{nome_clinica}}: Obrigado pela sua visita',
   '<p>Olá {{nome_paciente}},</p><p>Obrigado por comparecer à consulta. Foi um prazer atendê-lo(a).</p><p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Obrigado por comparecer à consulta. Foi um prazer atendê-lo(a).' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_completed', 'whatsapp', 'Consulta Realizada - WhatsApp', NULL,
   'Olá {{nome_paciente}},' || E'\n\n' || 'Obrigado por comparecer à consulta. Foi um prazer atendê-lo(a).' || E'\n\n' || '{{nome_clinica}}',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Obrigado por comparecer à consulta. Foi um prazer atendê-lo(a).' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_no_show', 'email', 'Falta Registrada - Email', '{{nome_clinica}}: Registro de falta',
   '<p>Olá {{nome_paciente}},</p><p>Registramos que você não pôde comparecer à consulta que estava agendada para <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong>.</p><p>Para reagendar, entre em contato conosco.</p><p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Registramos que você não pôde comparecer à consulta que estava agendada para {{data_hora_consulta}} com {{nome_medico}}.' || E'\n\n' || 'Para reagendar, entre em contato conosco.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_no_show', 'whatsapp', 'Falta Registrada - WhatsApp', NULL,
   'Olá {{nome_paciente}},' || E'\n\n' || 'Registramos que você não pôde comparecer à consulta que estava agendada para {{data_hora_consulta}} com {{nome_medico}}.' || E'\n\n' || 'Para reagendar, entre em contato conosco.' || E'\n\n' || '{{nome_clinica}}',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Registramos que você não pôde comparecer à consulta que estava agendada para {{data_hora_consulta}} com {{nome_medico}}.' || E'\n\n' || 'Para reagendar, entre em contato conosco.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('patient_registered', 'email', 'Usuário cadastrado - Email', '{{nome_clinica}}: Bem-vindo',
   '<p>Olá {{nome_paciente}},</p><p>Bem-vindo à nossa clínica. Você foi cadastrado em nosso sistema e em breve poderá agendar sua primeira consulta.</p><p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Bem-vindo à nossa clínica. Você foi cadastrado em nosso sistema e em breve poderá agendar sua primeira consulta.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{nome_clinica}}"]'::jsonb, now()),
  ('patient_registered', 'whatsapp', 'Usuário cadastrado - WhatsApp', NULL,
   'Olá {{nome_paciente}},' || E'\n\n' || 'Bem-vindo à nossa clínica. Você foi cadastrado em nosso sistema e em breve poderá agendar sua primeira consulta.' || E'\n\n' || '{{nome_clinica}}',
   'Olá {{nome_paciente}},' || E'\n\n' || 'Bem-vindo à nossa clínica. Você foi cadastrado em nosso sistema e em breve poderá agendar sua primeira consulta.' || E'\n\n' || '{{nome_clinica}}',
   '["{{nome_paciente}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name, subject = EXCLUDED.subject, body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text, variables_used = EXCLUDED.variables_used, updated_at = EXCLUDED.updated_at;
