-- Migration: Pesipeline do agente virtual — modos de confirmação por ferramenta
ALTER TABLE public.clinic_virtual_assistant_settings
  ADD COLUMN IF NOT EXISTS tool_execution_modes jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clinic_virtual_assistant_settings.tool_execution_modes IS
  'Modo de execução por ferramenta: auto (padrão) ou human_confirm (pede sim/não antes de executar)';
