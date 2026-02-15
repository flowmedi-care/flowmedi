-- Migration: Templates de Consulta Agendada com link opcional de formulário
-- Execute APÓS migration-system-templates-and-email-header-footer.sql
--
-- Atualiza os templates sistema para appointment_created incluindo {{instrucao_formulario}}:
-- - Com formulário pendente: exibe "Para preencher o formulário, acesse: [link]"
-- - Sem formulário pendente: variável fica vazia (template só de consulta agendada)

UPDATE public.system_message_templates
SET
  body_html = '<p>Olá {{nome_paciente}},</p>
<p>Sua consulta foi agendada para <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong>.</p>
<p>{{instrucao_formulario}}</p>
<p>{{nome_clinica}}</p>',
  body_text = 'Olá {{nome_paciente}}, sua consulta foi agendada para {{data_hora_consulta}} com {{nome_medico}}. {{instrucao_formulario}} {{nome_clinica}}.',
  variables_used = '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}","{{instrucao_formulario}}"]'::jsonb,
  updated_at = now()
WHERE event_code = 'appointment_created'
  AND channel = 'email';

UPDATE public.system_message_templates
SET
  body_html = 'Olá {{nome_paciente}}! Sua consulta foi agendada para {{data_hora_consulta}} com {{nome_medico}}. {{instrucao_formulario}} {{nome_clinica}}.',
  body_text = 'Olá {{nome_paciente}}! Sua consulta foi agendada para {{data_hora_consulta}} com {{nome_medico}}. {{instrucao_formulario}} {{nome_clinica}}.',
  variables_used = '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}","{{instrucao_formulario}}"]'::jsonb,
  updated_at = now()
WHERE event_code = 'appointment_created'
  AND channel = 'whatsapp';

-- Templates para appointment_not_confirmed (gerado pelo job de compliance em background)
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('appointment_not_confirmed', 'email', 'Consulta ainda não confirmada - Email',
   '{{nome_clinica}}: Confirme sua consulta',
   '<p>Olá {{nome_paciente}},</p><p>Sua consulta para <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong> ainda não foi confirmada.</p><p>Por favor, confirme sua presença, cancele ou solicite remarcação entrando em contato com {{nome_clinica}}.</p>',
   'Olá {{nome_paciente}}, sua consulta para {{data_hora_consulta}} com {{nome_medico}} ainda não foi confirmada. Confirme, cancele ou solicite remarcação entrando em contato com {{nome_clinica}}.',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now()),
  ('appointment_not_confirmed', 'whatsapp', 'Consulta ainda não confirmada - WhatsApp',
   NULL,
   'Olá {{nome_paciente}}! Sua consulta para {{data_hora_consulta}} com {{nome_medico}} ainda não foi confirmada. Por favor, confirme, cancele ou solicite remarcação entrando em contato com {{nome_clinica}}.',
   'Olá {{nome_paciente}}! Sua consulta para {{data_hora_consulta}} com {{nome_medico}} ainda não foi confirmada. Confirme, cancele ou solicite remarcação entrando em contato com {{nome_clinica}}.',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  variables_used = EXCLUDED.variables_used,
  updated_at = EXCLUDED.updated_at;

-- Templates para form_linked (ao vincular formulário depois do agendamento)
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('form_linked', 'email', 'Formulário vinculado - Email',
   '{{nome_clinica}}: Formulário para preencher',
   '<p>Olá {{nome_paciente}},</p><p>Foi vinculado um formulário à sua consulta.</p><p>{{instrucao_formulario}}</p><p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}}, foi vinculado um formulário à sua consulta. {{instrucao_formulario}} {{nome_clinica}}.',
   '["{{nome_paciente}}","{{instrucao_formulario}}","{{nome_clinica}}"]'::jsonb, now()),
  ('form_linked', 'whatsapp', 'Formulário vinculado - WhatsApp',
   NULL,
   'Olá {{nome_paciente}}! Foi vinculado um formulário à sua consulta. {{instrucao_formulario}} {{nome_clinica}}.',
   'Olá {{nome_paciente}}! Foi vinculado um formulário à sua consulta. {{instrucao_formulario}} {{nome_clinica}}.',
   '["{{nome_paciente}}","{{instrucao_formulario}}","{{nome_clinica}}"]'::jsonb, now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  variables_used = EXCLUDED.variables_used,
  updated_at = EXCLUDED.updated_at;
