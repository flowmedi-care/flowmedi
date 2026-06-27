-- Migration: RPC concluir_evento (SECURITY DEFINER) para o botão Concluir
-- Contorna RLS/update direto na tabela e garante persistência do status 'completed'.
-- Execute no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION public.concluir_evento(
  p_event_id uuid,
  p_processed_by uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id uuid;
  v_updated_id uuid;
BEGIN
  IF p_processed_by IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT clinic_id INTO v_clinic_id
  FROM public.profiles
  WHERE id = p_processed_by;

  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Clínica não encontrada';
  END IF;

  UPDATE public.event_timeline
  SET
    status = 'completed',
    processed_at = now(),
    processed_by = p_processed_by
  WHERE id = p_event_id
    AND clinic_id = v_clinic_id
    AND status = 'pending'
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'Evento não encontrado ou já processado';
  END IF;

  RETURN v_updated_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.concluir_evento(uuid, uuid) TO authenticated;
