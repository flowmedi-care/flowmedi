-- Migration: LangGraph pipeline — feature flags e tabelas de checkpoint
-- Execute no SQL Editor do Supabase após migration-virtual-assistant.sql

ALTER TABLE public.clinic_virtual_assistant_settings
  ADD COLUMN IF NOT EXISTS use_langgraph_pipeline boolean NOT NULL DEFAULT false;

ALTER TABLE public.clinic_virtual_assistant_settings
  ADD COLUMN IF NOT EXISTS langgraph_shadow_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clinic_virtual_assistant_settings.use_langgraph_pipeline IS
  'Quando true, processConversationAi usa o motor LangGraph em vez de runVirtualAssistantAgent.';

COMMENT ON COLUMN public.clinic_virtual_assistant_settings.langgraph_shadow_mode IS
  'Quando true (com use_langgraph_pipeline false), executa LangGraph em paralelo só para log/compare.';

-- Tabelas criadas automaticamente por PostgresSaver.setup() quando LANGGRAPH_DATABASE_URL estiver configurada.
-- Documentação: @langchain/langgraph-checkpoint-postgres
