-- Fix: RLS policies usam COALESCE(active, true) para funcionar se active for null
-- Execute no SQL Editor do Supabase se /api/whatsapp/messages retornar 500
-- (alguns projetos podem não ter coluna active em profiles ou ter valores null)

-- Garante coluna active em profiles (comum em projetos FlowMedi)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "whatsapp_conversations_read_clinic" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "whatsapp_conversations_insert_clinic" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "whatsapp_messages_read_clinic" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "whatsapp_messages_insert_clinic" ON public.whatsapp_messages;

CREATE POLICY "whatsapp_conversations_read_clinic"
  ON public.whatsapp_conversations FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND COALESCE(active, true) = true
    )
  );

CREATE POLICY "whatsapp_conversations_insert_clinic"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.profiles 
      WHERE id = auth.uid() AND COALESCE(active, true) = true
    )
  );

CREATE POLICY "whatsapp_messages_read_clinic"
  ON public.whatsapp_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.whatsapp_conversations
      WHERE clinic_id IN (
        SELECT clinic_id FROM public.profiles 
        WHERE id = auth.uid() AND COALESCE(active, true) = true
      )
    )
  );

CREATE POLICY "whatsapp_messages_insert_clinic"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.whatsapp_conversations
      WHERE clinic_id IN (
        SELECT clinic_id FROM public.profiles 
        WHERE id = auth.uid() AND COALESCE(active, true) = true
      )
    )
  );
