-- Pipeline tool log: stage + block reason for metrics
ALTER TABLE public.whatsapp_ai_tool_log
  ADD COLUMN IF NOT EXISTS pipeline_stage text,
  ADD COLUMN IF NOT EXISTS block_reason text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_tool_log_stage
  ON public.whatsapp_ai_tool_log(clinic_id, pipeline_stage, tool_name, created_at DESC);
