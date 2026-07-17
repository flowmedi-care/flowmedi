-- Operations Snapshot: campos nativos para projeção operacional + claim atômico
-- Sem tabela `cases` — prova o conceito em whatsapp_conversations.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.non_registered_pipeline(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operator_notes text,
  ADD COLUMN IF NOT EXISTS ops_brief text,
  ADD COLUMN IF NOT EXISTS pending_decision jsonb,
  ADD COLUMN IF NOT EXISTS ops_owner_type text
    CHECK (ops_owner_type IS NULL OR ops_owner_type IN ('ai', 'human', 'system', 'patient_waiting')),
  ADD COLUMN IF NOT EXISTS ops_owner_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ownership_history jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.whatsapp_conversations.pipeline_id IS 'Lead CRM vinculado ao atendimento operacional.';
COMMENT ON COLUMN public.whatsapp_conversations.operator_notes IS 'Notas operacionais visíveis no Centro de Operações e no prompt da IA.';
COMMENT ON COLUMN public.whatsapp_conversations.ops_brief IS 'Brief da última passagem humano→IA.';
COMMENT ON COLUMN public.whatsapp_conversations.pending_decision IS 'Próxima decisão operacional (PendingDecision JSON).';
COMMENT ON COLUMN public.whatsapp_conversations.ops_owner_type IS 'Responsável Atual nativo (ai|human|system|patient_waiting).';
COMMENT ON COLUMN public.whatsapp_conversations.ops_owner_user_id IS 'Usuário humano responsável quando ops_owner_type=human.';
COMMENT ON COLUMN public.whatsapp_conversations.ownership_history IS 'Histórico append-only de responsabilidade.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_ops_owner
  ON public.whatsapp_conversations(clinic_id, ops_owner_type, ops_owner_user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_pipeline_id
  ON public.whatsapp_conversations(pipeline_id)
  WHERE pipeline_id IS NOT NULL;

-- Backfill owner a partir das flags existentes
UPDATE public.whatsapp_conversations
SET
  ops_owner_type = CASE
    WHEN ai_user_opt_out = true THEN 'human'
    WHEN assigned_secretary_id IS NOT NULL THEN 'human'
    WHEN ai_handoff_at IS NOT NULL OR ai_enabled = false THEN 'human'
    ELSE 'ai'
  END,
  ops_owner_user_id = assigned_secretary_id
WHERE ops_owner_type IS NULL;
