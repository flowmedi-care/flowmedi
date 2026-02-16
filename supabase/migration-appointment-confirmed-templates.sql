-- Migration: Templates padrão para Consulta Confirmada com recomendações/preparo
-- Execute APÓS migration-system-templates-and-email-header-footer.sql
--
-- Cria templates sistema para appointment_confirmed incluindo variáveis de recomendações:
-- - {{preparo_completo}} (formata todas as recomendações: jejum, recomendações, instruções especiais, notas de preparo)
-- - Ou variáveis individuais: {{recomendacoes}}, {{precisa_jejum}}, {{instrucoes_especiais}}, {{notas_preparo}}
-- Quando a consulta tem procedimento vinculado, as recomendações do procedimento já estão em appointments.recommendations

-- Template para email
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('appointment_confirmed', 'email', 'Consulta Confirmada - Email',
   '{{nome_clinica}}: Sua consulta foi confirmada',
   '<p>Olá {{nome_paciente}},</p>
<p>Sua consulta foi <strong>confirmada</strong> para <strong>{{data_hora_consulta}}</strong> com <strong>{{nome_medico}}</strong>.</p>
{{preparo_completo_html}}
<p>{{nome_clinica}}</p>',
   'Olá {{nome_paciente}}, sua consulta foi confirmada para {{data_hora_consulta}} com {{nome_medico}}.

{{preparo_completo}}

{{nome_clinica}}',
   '["{{nome_paciente}}","{{data_hora_consulta}}","{{nome_medico}}","{{nome_clinica}}","{{preparo_completo_html}}"]'::jsonb,
   now())
ON CONFLICT (event_code, channel) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  variables_used = EXCLUDED.variables_used,
  updated_at = EXCLUDED.updated_at;

-- Template para WhatsApp
INSERT INTO public.system_message_templates (event_code, channel, name, subject, body_html, body_text, variables_used, updated_at)
VALUES
  ('appointment_confirmed', 'whatsapp', 'Consulta Confirmada - WhatsApp',
   NULL,
   'Olá {{nome_paciente}}! ✅ Sua consulta foi confirmada para {{data_hora_consulta}} com {{nome_medico}}.

{{preparo_completo}}

{{nome_clinica}}',
   'Olá {{nome_paciente}}! ✅ Sua consulta foi confirmada para {{data_hora_consulta}} com {{nome_medico}}.

{{preparo_completo}}

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
