-- Modo híbrido: prévia no navegador + transcrição Whisper batch ao finalizar

ALTER TABLE public.appointment_transcriptions
  DROP CONSTRAINT IF EXISTS appointment_transcriptions_transcription_mode_check;

ALTER TABLE public.appointment_transcriptions
  ADD CONSTRAINT appointment_transcriptions_transcription_mode_check
  CHECK (transcription_mode IN ('batch', 'streaming', 'hybrid'));
