-- Migration: streaming + pós-processamento clínico em appointment_transcriptions
-- Execute no SQL Editor do Supabase

ALTER TABLE public.appointment_transcriptions
  ADD COLUMN IF NOT EXISTS transcription_mode text NOT NULL DEFAULT 'batch',
  ADD COLUMN IF NOT EXISTS stream_session_id text,
  ADD COLUMN IF NOT EXISTS live_transcript text,
  ADD COLUMN IF NOT EXISTS transcript_segments jsonb,
  ADD COLUMN IF NOT EXISTS dialogue jsonb,
  ADD COLUMN IF NOT EXISTS clinical_summary jsonb,
  ADD COLUMN IF NOT EXISTS post_processing_status text,
  ADD COLUMN IF NOT EXISTS post_processing_error text,
  ADD COLUMN IF NOT EXISTS audio_storage_path text,
  ADD COLUMN IF NOT EXISTS summarized_at timestamptz;

ALTER TABLE public.appointment_transcriptions
  DROP CONSTRAINT IF EXISTS appointment_transcriptions_transcription_mode_check;
ALTER TABLE public.appointment_transcriptions
  ADD CONSTRAINT appointment_transcriptions_transcription_mode_check
  CHECK (transcription_mode IN ('batch', 'streaming'));

ALTER TABLE public.appointment_transcriptions
  DROP CONSTRAINT IF EXISTS appointment_transcriptions_post_processing_status_check;
ALTER TABLE public.appointment_transcriptions
  ADD CONSTRAINT appointment_transcriptions_post_processing_status_check
  CHECK (
    post_processing_status IS NULL
    OR post_processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')
  );

ALTER TABLE public.appointment_transcriptions
  DROP CONSTRAINT IF EXISTS appointment_transcriptions_status_check;
ALTER TABLE public.appointment_transcriptions
  ADD CONSTRAINT appointment_transcriptions_status_check
  CHECK (status IN ('queued', 'streaming', 'processing', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_appointment_transcriptions_stream_session
  ON public.appointment_transcriptions(stream_session_id)
  WHERE stream_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointment_transcriptions_post_processing
  ON public.appointment_transcriptions(post_processing_status, updated_at)
  WHERE post_processing_status IN ('pending', 'processing');
