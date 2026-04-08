-- Horário de expediente exibido na agenda (por clínica)
ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS agenda_work_start time without time zone NOT NULL DEFAULT '07:00:00'::time;

ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS agenda_work_end time without time zone NOT NULL DEFAULT '20:00:00'::time;
