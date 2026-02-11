-- Migration: Inicializar configurações de mensagens para clínicas existentes
-- Execute APÓS migration-message-system.sql
-- Este script cria configurações padrão para todas as clínicas que já existem

-- ========== VERIFICAR SE A TABELA EXISTE ==========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'clinic_message_settings'
  ) THEN
    RAISE EXCEPTION 'ERRO: A tabela clinic_message_settings não existe. Execute primeiro a migration migration-message-system.sql';
  END IF;
END $$;

-- ========== INICIALIZAR CONFIGURAÇÕES PARA CLÍNICAS EXISTENTES ==========
-- Configurações para EMAIL
INSERT INTO public.clinic_message_settings (clinic_id, event_code, channel, enabled, send_mode)
SELECT 
  c.id,
  me.code,
  'email',
  me.default_enabled_email,
  CASE WHEN me.can_be_automatic THEN 'automatic' ELSE 'manual' END
FROM public.clinics c
CROSS JOIN public.message_events me
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.clinic_message_settings cms 
  WHERE cms.clinic_id = c.id 
    AND cms.event_code = me.code 
    AND cms.channel = 'email'
)
ON CONFLICT (clinic_id, event_code, channel) DO NOTHING;

-- Configurações para WHATSAPP
INSERT INTO public.clinic_message_settings (clinic_id, event_code, channel, enabled, send_mode)
SELECT 
  c.id,
  me.code,
  'whatsapp',
  me.default_enabled_whatsapp,
  CASE WHEN me.can_be_automatic THEN 'automatic' ELSE 'manual' END
FROM public.clinics c
CROSS JOIN public.message_events me
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.clinic_message_settings cms 
  WHERE cms.clinic_id = c.id 
    AND cms.event_code = me.code 
    AND cms.channel = 'whatsapp'
)
ON CONFLICT (clinic_id, event_code, channel) DO NOTHING;

-- ========== VERIFICAÇÃO ==========
-- Execute esta query para verificar se as configurações foram criadas:
-- SELECT 
--   c.name as clinica,
--   me.name as evento,
--   cms.channel,
--   cms.enabled,
--   cms.send_mode
-- FROM public.clinic_message_settings cms
-- JOIN public.clinics c ON c.id = cms.clinic_id
-- JOIN public.message_events me ON me.code = cms.event_code
-- ORDER BY c.name, me.name, cms.channel;
