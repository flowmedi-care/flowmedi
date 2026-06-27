-- Migration: Remover sobrecargas duplicadas (5 params) das funções de eventos
-- O app usa sempre p_secretary_id (6 params). Duplicatas causam ambiguidade e dados inconsistentes.
-- Execute no SQL Editor do Supabase APÓS migration-eventos-secretary-filter.sql.

DROP FUNCTION IF EXISTS public.get_pending_events(uuid, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_all_events(uuid, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_completed_events(uuid, uuid, text, integer, integer);

GRANT EXECUTE ON FUNCTION public.get_pending_events(uuid, uuid, text, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_events(uuid, uuid, text, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_completed_events(uuid, uuid, text, integer, integer, uuid) TO authenticated;
