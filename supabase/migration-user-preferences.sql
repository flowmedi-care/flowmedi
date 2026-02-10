-- Preferências do usuário (agenda views e outras preferências futuras)
-- Execute no Supabase: SQL Editor → New query → Cole tudo → Run.

-- Adicionar coluna preferences em profiles (JSONB para flexibilidade)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb;

-- Índice GIN para queries eficientes em JSONB
CREATE INDEX IF NOT EXISTS idx_profiles_preferences ON public.profiles USING GIN (preferences);

-- Comentário explicativo
COMMENT ON COLUMN public.profiles.preferences IS 'Preferências do usuário: agenda_view_mode, agenda_timeline_granularity, agenda_calendar_granularity, etc.';
