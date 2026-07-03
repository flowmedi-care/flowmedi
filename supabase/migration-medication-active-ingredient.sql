ALTER TABLE public.clinical_medication_catalog
  ADD COLUMN IF NOT EXISTS active_ingredient text NOT NULL DEFAULT '';
