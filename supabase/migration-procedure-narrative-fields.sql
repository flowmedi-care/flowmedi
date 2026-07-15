-- Narrative fields for WhatsApp / assistants (content lives on procedures; governance is ACL).
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS how_we_perform text,
  ADD COLUMN IF NOT EXISTS recovery text;

COMMENT ON COLUMN public.procedures.short_description IS 'Short public description of the procedure';
COMMENT ON COLUMN public.procedures.how_we_perform IS 'How the clinic performs this procedure (patient-facing)';
COMMENT ON COLUMN public.procedures.recovery IS 'Post-procedure recovery guidance';
