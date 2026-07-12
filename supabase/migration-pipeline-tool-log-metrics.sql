-- Apply in Supabase SQL Editor (Dashboard → SQL) if columns are missing.
-- File: supabase/migration-pipeline-tool-log-metrics.sql
--
-- This environment had no DATABASE_URL / service role to apply remotely.
-- After running, tool-log inserts and diagnostics can use block_reason + pipeline_stage.

ALTER TABLE public.whatsapp_ai_tool_log
  ADD COLUMN IF NOT EXISTS pipeline_stage text,
  ADD COLUMN IF NOT EXISTS block_reason text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_tool_log_stage
  ON public.whatsapp_ai_tool_log(clinic_id, pipeline_stage, tool_name, created_at DESC);
