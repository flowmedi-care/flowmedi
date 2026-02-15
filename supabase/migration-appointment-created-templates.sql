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
  variables_used = '["nome_paciente","data_hora_consulta","nome_medico","nome_clinica","instrucao_formulario"]'::jsonb,
  updated_at = now()
WHERE event_code = 'appointment_created'
  AND channel = 'email';

UPDATE public.system_message_templates
SET
  body_html = 'Olá {{nome_paciente}}! Sua consulta foi agendada para {{data_hora_consulta}} com {{nome_medico}}. {{instrucao_formulario}} {{nome_clinica}}.',
  body_text = 'Olá {{nome_paciente}}! Sua consulta foi agendada para {{data_hora_consulta}} com {{nome_medico}}. {{instrucao_formulario}} {{nome_clinica}}.',
  variables_used = '["nome_paciente","data_hora_consulta","nome_medico","nome_clinica","instrucao_formulario"]'::jsonb,
  updated_at = now()
WHERE event_code = 'appointment_created'
  AND channel = 'whatsapp';
