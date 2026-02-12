-- Migration: Estender eventos de mensagens (lembretes 30/15/7 dias e formulários detalhados)
-- Execute no SQL Editor do Supabase após as migrations:
-- - schema.sql
-- - migration-message-system.sql
-- - migration-message-events-allow-automatic.sql
--
-- Objetivo:
-- - Adicionar novos eventos para:
--   - Lembrete 30 dias, 15 dias e 7 dias antes da consulta
--   - Diferenciar formulário público preenchido x formulário de paciente preenchido
--   - Marcar consulta como retorno
-- - Respeitar a estrutura existente de message_events / clinic_message_settings.

-- ========== NOVOS EVENTOS: LEMBRETES 30 / 15 / 7 DIAS ==========
INSERT INTO public.message_events (
  code,
  name,
  description,
  category,
  default_enabled_email,
  default_enabled_whatsapp,
  can_be_automatic,
  requires_appointment
)
VALUES
  -- Lembretes mais distantes (pensados para serem sugeridos; a clínica escolhe se quer automático)
  ('appointment_reminder_30d',
    'Lembrete 30 dias',
    'Lembrete enviado 30 dias antes da consulta',
    'lembrete',
    true,   -- email habilitado por padrão
    true,   -- whatsapp habilitado por padrão
    true,   -- pode ser automático, a clínica decide
    true    -- sempre atrelado a uma consulta
  ),
  ('appointment_reminder_15d',
    'Lembrete 15 dias',
    'Lembrete enviado 15 dias antes da consulta',
    'lembrete',
    true,
    true,
    true,
    true
  ),
  ('appointment_reminder_7d',
    'Lembrete 1 semana',
    'Lembrete enviado 7 dias antes da consulta (1 semana)',
    'lembrete',
    true,
    true,
    true,
    true
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  default_enabled_email = EXCLUDED.default_enabled_email,
  default_enabled_whatsapp = EXCLUDED.default_enabled_whatsapp,
  can_be_automatic = EXCLUDED.can_be_automatic,
  requires_appointment = EXCLUDED.requires_appointment;


-- ========== NOVOS EVENTOS: FORMULÁRIOS ==========
INSERT INTO public.message_events (
  code,
  name,
  description,
  category,
  default_enabled_email,
  default_enabled_whatsapp,
  can_be_automatic,
  requires_appointment
)
VALUES
  -- Formulário vinculado a paciente / consulta
  ('patient_form_completed',
    'Formulário de Paciente Preenchido',
    'Disparado quando um formulário vinculado ao paciente/consulta é preenchido',
    'formulario',
    false,  -- em geral, comunicação interna; sem envio automático por padrão
    false,
    true,   -- pode ser usado para lembretes/avisos automáticos se a clínica desejar
    true
  ),
  -- Formulário público (lead ainda não cadastrado)
  ('public_form_completed',
    'Formulário Público Preenchido',
    'Disparado quando um formulário público é preenchido (sem paciente cadastrado ainda)',
    'formulario',
    true,   -- pode disparar confirmação/agradecimento por email
    true,   -- e/ou whatsapp, se configurado
    true,   -- pode ser automático (ex.: obrigado, em breve entraremos em contato)
    false   -- não requer consulta; pode ser só lead
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  default_enabled_email = EXCLUDED.default_enabled_email,
  default_enabled_whatsapp = EXCLUDED.default_enabled_whatsapp,
  can_be_automatic = EXCLUDED.can_be_automatic,
  requires_appointment = EXCLUDED.requires_appointment;


-- ========== NOVO EVENTO: CONSULTA MARCADA COMO RETORNO ==========
INSERT INTO public.message_events (
  code,
  name,
  description,
  category,
  default_enabled_email,
  default_enabled_whatsapp,
  can_be_automatic,
  requires_appointment
)
VALUES
  (
    'appointment_marked_as_return',
    'Consulta de Retorno',
    'Disparado quando o tipo da consulta é alterado para retorno',
    'agendamento',
    true,
    true,
    false,  -- por padrão, não enviar automaticamente (evento sensível)
    true
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  default_enabled_email = EXCLUDED.default_enabled_email,
  default_enabled_whatsapp = EXCLUDED.default_enabled_whatsapp,
  can_be_automatic = EXCLUDED.can_be_automatic,
  requires_appointment = EXCLUDED.requires_appointment;


-- ========== RECRIAR CONFIGURAÇÕES PARA NOVOS EVENTOS NAS CLÍNICAS EXISTENTES ==========
-- Para cada clínica já existente, criar entradas em clinic_message_settings
-- respeitando os defaults de cada evento.

INSERT INTO public.clinic_message_settings (clinic_id, event_code, channel, enabled, send_mode)
SELECT
  c.id AS clinic_id,
  me.code AS event_code,
  ch.channel,
  CASE
    WHEN ch.channel = 'email' THEN me.default_enabled_email
    WHEN ch.channel = 'whatsapp' THEN me.default_enabled_whatsapp
    ELSE false
  END AS enabled,
  CASE
    WHEN me.can_be_automatic THEN 'automatic'
    ELSE 'manual'
  END AS send_mode
FROM public.clinics c
CROSS JOIN public.message_events me
CROSS JOIN (VALUES ('email'), ('whatsapp')) AS ch(channel)
ON CONFLICT (clinic_id, event_code, channel) DO NOTHING;

