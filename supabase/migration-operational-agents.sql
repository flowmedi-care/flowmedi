-- Migration: agentes operacionais (activity feed + dashboard)
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.operational_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  agent_type text NOT NULL CHECK (agent_type IN ('booking', 'journey', 'queue', 'virtual_assistant')),
  status text NOT NULL CHECK (status IN ('running', 'done', 'waiting', 'idle', 'failed')),
  action text NOT NULL,
  contact_id text,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_agent_runs_clinic
  ON public.operational_agent_runs(clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_agent_runs_type
  ON public.operational_agent_runs(clinic_id, agent_type, created_at DESC);

ALTER TABLE public.operational_agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operational_agent_runs_read" ON public.operational_agent_runs;
CREATE POLICY "operational_agent_runs_read" ON public.operational_agent_runs
  FOR SELECT USING (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "operational_agent_runs_insert" ON public.operational_agent_runs;
CREATE POLICY "operational_agent_runs_insert" ON public.operational_agent_runs
  FOR INSERT WITH CHECK (
    clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
  );
