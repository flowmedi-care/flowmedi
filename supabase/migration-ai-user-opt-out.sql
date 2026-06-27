-- Migration: Opt-out permanente de respostas de IA por conversa
-- Execute no SQL Editor do Supabase

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS ai_user_opt_out boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_ai_opt_out
  ON public.whatsapp_conversations(ai_user_opt_out)
  WHERE ai_user_opt_out = true;

COMMENT ON COLUMN public.whatsapp_conversations.ai_user_opt_out IS
  'Paciente pediu desativar IA permanentemente (DESATIVE). Só volta com ATIVAR ou reativação manual no painel.';
